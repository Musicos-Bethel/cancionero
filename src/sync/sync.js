import * as db from '../db.js';
import { classifyPath, isBinaryKind } from '../library/library.js';
import { decodeText } from '../util/text.js';
import { songMeta } from '../chordpro/song-doc.js';

/** Ejecuta `fn` sobre `items` con un máximo de `n` tareas a la vez. */
export async function pool(items, n, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

/**
 * Sincronización incremental con un origen (demostración u OneDrive):
 *  - texto (ChordPro, .txt, listas): se descarga siempre que cambia su eTag
 *  - PDF e imágenes: solo se guardan sus datos; el contenido se descarga bajo
 *    demanda o al preparar las listas próximas (ver prefetch)
 *  - lo que desaparece del origen se borra del dispositivo
 */
/**
 * Qué hay que hacer con cada archivo (puro, para poder probarlo):
 *  removed:     rutas que ya no están en el origen (o son de otro origen)
 *  download:    archivos nuevos o cambiados (eTag distinto)
 *  reclassify:  archivos iguales pero en otra sección/categoría porque cambió la
 *               estructura de carpetas: se actualizan sin volver a descargarlos
 */
export function planSync(local, remote, sourceId) {
  const localByPath = new Map(local.map((f) => [f.path, f]));
  const remotePaths = new Set(remote.map((r) => r.path));
  const removed = local.filter((f) => f.source !== sourceId || !remotePaths.has(f.path)).map((f) => f.path);
  const download = [];
  const reclassify = [];
  for (const r of remote) {
    const l = localByPath.get(r.path);
    if (!l || l.source !== sourceId || l.etag !== r.etag) download.push(r);
    else if (l.section !== r.info.section || l.kind !== r.info.kind || (l.depth ?? 1) !== r.info.depth) {
      // Si pasa de PDF/imagen a texto no tenemos el texto: hay que descargarlo.
      if (!isBinaryKind(r.info.kind) && typeof l.text !== 'string') download.push(r);
      else reclassify.push({ ...l, section: r.info.section, kind: r.info.kind, depth: r.info.depth, ext: r.info.ext });
    }
  }
  return { removed, download, reclassify, added: download.filter((r) => !localByPath.has(r.path)).length };
}

export async function syncFrom(source, { onProgress } = {}) {
  const listed = (await source.list()).map((r) => ({ ...r, info: classifyPath(r.path, source.layout?.() ?? null) }));
  const remote = listed.filter((r) => r.info);
  // Para Ajustes: cuántos archivos hay, cuántos se reconocen y ejemplos de los que no.
  const ignored = listed.filter((r) => !r.info).map((r) => r.path);
  const local = (await db.getAllFiles()).filter((f) => f.origin === 'remote');
  const localPaths = new Set(local.map((f) => f.path));
  const remotePaths = new Set(remote.map((r) => r.path));
  const { removed, download, reclassify, added } = planSync(local, remote, source.id);

  let done = 0;
  const records = [...reclassify];
  const staleBlobs = [];
  await pool(download, 6, async (r) => {
    const { section, ext, kind, depth } = r.info;
    const rec = { path: r.path, origin: 'remote', source: source.id, section, ext, kind, depth, etag: r.etag, size: r.size ?? 0 };
    if (isBinaryKind(kind)) {
      if (localPaths.has(r.path)) staleBlobs.push(r.path);
    } else {
      const text = decodeText(await source.getBuffer(r.path));
      rec.text = text;
      if (kind === 'text') rec.meta = songMeta(text, ext);
    }
    records.push(rec);
    onProgress?.(++done, download.length);
  });

  if (removed.length) await db.deleteFiles(removed);
  for (const p of staleBlobs) await db.deleteBlob(p);
  if (records.length) await db.putFiles(records);
  await db.kvSet('lastSync', { at: Date.now(), source: source.id, total: listed.length, recognized: remote.length, ignored: ignored.slice(0, 8) });

  return {
    added,
    updated: download.length - added + reclassify.length,
    removed: removed.filter((p) => !remotePaths.has(p)).length,
  };
}

/** Devuelve el contenido de un PDF o imagen, descargándolo si hace falta. */
export async function ensureBlob(source, path) {
  const cached = await db.getBlob(path);
  if (cached) return cached;
  if (!source || !navigator.onLine) return null;
  const buf = await source.getBuffer(path);
  const type = /\.pdf$/i.test(path) ? 'application/pdf' : /\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : /\.gif$/i.test(path) ? 'image/gif' : 'image/jpeg';
  const blob = new Blob([buf], { type });
  await db.putBlob(path, blob);
  return blob;
}

/** Descarga los PDF/imágenes de `songs` que aún no estén en el dispositivo. */
export async function prefetch(source, songs, { onProgress } = {}) {
  const have = await db.blobKeys();
  const paths = [...new Set(songs.filter((s) => s && s.origin === 'remote').flatMap((s) => s.paths))].filter(
    (p) => /\.(pdf|png|jpe?g|webp|gif)$/i.test(p) && !have.has(p),
  );
  let done = 0;
  await pool(paths, 3, async (p) => {
    try {
      await ensureBlob(source, p);
    } catch (e) {
      console.warn('prefetch', p, e);
    }
    onProgress?.(++done, paths.length);
  });
  return paths.length;
}
