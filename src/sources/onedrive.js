import { ONEDRIVE, WRITE_TARGET, DEFAULT_LAYOUT } from '../config.js';
import { normalize } from '../util/text.js';
import { ConflictError, OfflineError, FolderNotFoundError, PermissionError } from './errors.js';
import { getAccessToken } from './onedrive-auth.js';

/**
 * Origen OneDrive (Microsoft Graph). Usa las mismas rutas «lógicas» que la
 * demostración, relativas a la carpeta del cancionero:
 *   Voces/…, Bateria/…, Metales/…, Enlaces/…   → en la carpeta del cancionero (solo lectura)
 *   Listas/…, ajustes-lider.json                → donde escribe el modo líder (WRITE_TARGET):
 *       appFolder: Aplicaciones/Cancionero Bethel/ (la app no puede tocar las canciones)
 *       library:   dentro de la carpeta del cancionero
 *
 * `deps` permite probarlo sin navegador (fetch y token simulados).
 */
export function createOneDriveSource({
  getLayout = () => DEFAULT_LAYOUT,
  target = WRITE_TARGET,
  fetchFn = (...a) => fetch(...a),
  token = getAccessToken,
  isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  now = () => Date.now(),
} = {}) {
  const GRAPH = ONEDRIVE.graph;
  const enc = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const join = (...p) => p.filter(Boolean).join('/');
  const rootPath = () => String(getLayout().root ?? '').replace(/^\/+|\/+$/g, '');

  const isWritePath = (path) => {
    const first = normalize(path.split('/')[0]);
    return first === normalize(target.listsFolder) || (normalize(path) === normalize(target.leaderFile) && !path.includes('/'));
  };

  /** Dirección de Graph de un archivo por su ruta lógica. */
  function itemUrl(path) {
    if (isWritePath(path) && target.location === 'appFolder') return `${GRAPH}/me/drive/special/approot:/${enc(path)}:`;
    const full = join(rootPath(), path);
    return `${GRAPH}/me/drive/root:/${enc(full)}:`;
  }

  // Direcciones de descarga que da OneDrive al listar (valen ~1 hora).
  const downloads = new Map();

  async function api(url, { method = 'GET', headers = {}, body, auth = true } = {}, attempt = 0) {
    if (!isOnline()) throw new OfflineError();
    const h = { ...headers };
    if (auth) h.Authorization = `Bearer ${await token({ force: attempt > 0 && attempt < 2 })}`;
    let res;
    try {
      res = await fetchFn(url, { method, headers: h, body });
    } catch {
      throw new OfflineError();
    }
    if (auth && res.status === 401 && attempt === 0) return api(url, { method, headers, body, auth }, 1);
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      const wait = Math.min(Number(res.headers?.get?.('Retry-After')) || 2, 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return api(url, { method, headers, body, auth }, attempt + 2);
    }
    return res;
  }

  async function json(url, opts) {
    const res = await api(url, opts);
    if (!res.ok) throw await graphError(res);
    return res.json();
  }

  async function graphError(res) {
    const data = await res.json().catch(() => ({}));
    const e = new Error(data.error?.message || `OneDrive respondió ${res.status}`);
    e.status = res.status;
    e.code = data.error?.code;
    return e;
  }

  /** Todos los elementos de una carpeta (siguiendo las páginas). */
  async function children(url) {
    const out = [];
    let next = `${url}?$top=500`;
    while (next) {
      const data = await json(next);
      out.push(...(data.value ?? []));
      next = data['@odata.nextLink'] ?? null;
    }
    return out;
  }

  /** Recorre una carpeta y sus subcarpetas: [{ path, size, etag, url }]. */
  async function walk(startUrl, prefix = '') {
    const files = [];
    const queue = [{ url: startUrl, prefix }];
    const running = new Set();
    const one = async ({ url, prefix: pre }) => {
      for (const it of await children(url)) {
        const path = join(pre, it.name);
        if (it.folder) queue.push({ url: `${GRAPH}/me/drive/items/${it.id}/children`, prefix: path });
        else if (it.file) files.push({ path, size: it.size ?? 0, etag: it.eTag ?? it.cTag ?? '', url: it['@microsoft.graph.downloadUrl'] ?? null });
      }
    };
    // Hasta 4 carpetas a la vez.
    while (queue.length || running.size) {
      while (queue.length && running.size < 4) {
        const p = one(queue.shift()).finally(() => running.delete(p));
        running.add(p);
      }
      await Promise.race(running);
    }
    return files;
  }

  async function rootFolders() {
    const items = await children(`${GRAPH}/me/drive/root/children`);
    return items.filter((i) => i.folder).map((i) => i.name);
  }

  /**
   * Contenido de un archivo. Se descarga de la dirección temporal que da
   * OneDrive (sin enviar el token): así no hace falta seguir redirecciones
   * con cabeceras de autorización, que Safari no siempre permite.
   */
  async function download(path) {
    const cached = downloads.get(path);
    if (cached && now() - cached.at < 45 * 60 * 1000) {
      const res = await api(cached.url, { auth: false }).catch((e) => {
        if (e instanceof OfflineError && !isOnline()) throw e;
        return null;
      });
      if (res?.ok) return res.arrayBuffer();
    }
    const res = await api(`${itemUrl(path)}?select=id,eTag,@microsoft.graph.downloadUrl`);
    if (res.status === 404) throw new Error(`No se encuentra «${path}» en OneDrive.`);
    if (!res.ok) throw await graphError(res);
    const url = (await res.json())['@microsoft.graph.downloadUrl'];
    if (!url) throw new Error(`OneDrive no da la descarga de «${path}».`);
    downloads.set(path, { url, at: now() });
    const file = await api(url, { auth: false });
    if (!file.ok) throw new Error(`No se pudo descargar «${path}» (${file.status}).`);
    return file.arrayBuffer();
  }

  return {
    id: 'onedrive',
    label: 'OneDrive',
    writable: true,

    /** Estructura de carpetas para clasificar las rutas (la de Ajustes + las listas del modo líder). */
    layout() {
      return { ...getLayout(), listas: target.listsFolder };
    },

    async list() {
      const root = rootPath();
      let lib;
      try {
        lib = await walk(root ? `${GRAPH}/me/drive/root:/${enc(root)}:/children` : `${GRAPH}/me/drive/root/children`);
      } catch (e) {
        if (e.status === 404) throw new FolderNotFoundError(root, await rootFolders().catch(() => []));
        throw e;
      }
      // En la carpeta del cancionero se ignoran las rutas reservadas al modo líder
      // cuando este escribe en la carpeta de la app (así no se mezclan).
      if (target.location === 'appFolder') lib = lib.filter((f) => !isWritePath(f.path));
      let app = [];
      if (target.location === 'appFolder') {
        app = (await walk(`${GRAPH}/me/drive/special/approot/children`)).filter((f) => isWritePath(f.path));
      }
      const all = [...lib, ...app];
      downloads.clear();
      for (const f of all) if (f.url) downloads.set(f.path, { url: f.url, at: now() });
      return all.map(({ path, size, etag }) => ({ path, size, etag }));
    },

    getBuffer: download,

    /** Lee un archivo de texto con su versión actual, o null si no existe. */
    async readText(path) {
      const res = await api(itemUrl(path));
      if (res.status === 404) return null;
      if (!res.ok) throw await graphError(res);
      const meta = await res.json();
      if (meta['@microsoft.graph.downloadUrl']) downloads.set(path, { url: meta['@microsoft.graph.downloadUrl'], at: now() });
      const text = new TextDecoder().decode(await download(path));
      return { text, etag: meta.eTag };
    },

    /**
     * Escribe un archivo de texto (listas y ajustes del líder).
     *  ifMatch: solo si su versión sigue siendo esa (si no, ConflictError)
     *  ifNoneMatch: '*' → solo si no existe todavía
     */
    async writeText(path, text, { ifMatch, ifNoneMatch } = {}) {
      if (!isWritePath(path)) throw new Error(`La app no puede escribir en «${path}».`);
      const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
      if (ifMatch) headers['If-Match'] = ifMatch;
      const q = ifNoneMatch === '*' ? '?@microsoft.graph.conflictBehavior=fail' : '';
      const res = await api(`${itemUrl(path)}/content${q}`, { method: 'PUT', headers, body: text });
      if (res.status === 412) throw new ConflictError('changed', path);
      if (res.status === 409) throw new ConflictError(ifNoneMatch === '*' ? 'exists' : 'changed', path);
      if (res.status === 404 && ifMatch) throw new ConflictError('deleted', path);
      if (res.status === 403) throw new PermissionError();
      if (!res.ok) throw await graphError(res);
      const meta = await res.json();
      downloads.delete(path);
      return { etag: meta.eTag };
    },

    async remove(path, { ifMatch } = {}) {
      if (!isWritePath(path)) throw new Error(`La app no puede borrar «${path}».`);
      const res = await api(itemUrl(path), { method: 'DELETE', headers: ifMatch ? { 'If-Match': ifMatch } : {} });
      if (res.status === 404) return; // ya no existe
      if (res.status === 412) throw new ConflictError('changed', path);
      if (!res.ok) throw await graphError(res);
      downloads.delete(path);
    },

    /** ¿Se pueden borrar canciones de la carpeta del cancionero? */
    canDeleteSongs: !!target.songs,

    /**
     * Borra un archivo (o la carpeta de una canción de imágenes) de la carpeta
     * del cancionero. Va a la papelera de OneDrive. Nunca toca la carpeta de la app.
     */
    async removeSong(path, { ifMatch } = {}) {
      if (!target.songs || isWritePath(path) || !path) throw new Error(`La app no puede borrar «${path}».`);
      const res = await api(itemUrl(path), { method: 'DELETE', headers: ifMatch ? { 'If-Match': ifMatch } : {} });
      if (res.status === 404) return; // ya no existe
      if (res.status === 412) throw new ConflictError('changed', path);
      if (res.status === 403) throw new PermissionError();
      if (!res.ok) throw await graphError(res);
      downloads.delete(path);
    },

    /** Carpetas de la raíz de OneDrive (para elegir la del cancionero en Ajustes). */
    rootFolders,
  };
}
