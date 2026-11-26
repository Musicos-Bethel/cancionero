const G = 'https://graph.microsoft.com/v1.0';

/** OneDrive simulada: rutas → archivo; cada respuesta como la de Graph. */
export function fakeDrive(files, { app = {} } = {}) {
  const calls = [];
  const items = new Map(); // id → { name, folder, path }
  let n = 0;
  const all = { ...Object.fromEntries(Object.entries(files).map(([p, t]) => ['root/' + p, t])), ...Object.fromEntries(Object.entries(app).map(([p, t]) => ['app/' + p, t])) };
  const etags = new Map(Object.keys(all).map((p) => [p, `"{E${++n}},1"`]));
  const childrenOf = (dir) => {
    const names = new Map();
    for (const p of Object.keys(all)) {
      if (!p.startsWith(dir + '/')) continue;
      const rest = p.slice(dir.length + 1).split('/');
      if (rest.length === 1) names.set(rest[0], { name: rest[0], file: {}, size: all[p].length, eTag: etags.get(p), '@microsoft.graph.downloadUrl': `https://dl.example/${encodeURIComponent(p)}` });
      else if (!names.has(rest[0])) {
        const id = 'id' + ++n;
        items.set(id, dir + '/' + rest[0]);
        names.set(rest[0], { id, name: rest[0], folder: { childCount: 1 } });
      }
    }
    return [...names.values()];
  };
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body, arrayBuffer: async () => new TextEncoder().encode(body).buffer, headers: { get: () => null } });
  const pathOf = (u) => {
    let m;
    if ((m = /\/me\/drive\/root:\/(.*?):?(\/children|\/content)?(\?.*)?$/.exec(u))) return ['root/' + decodeURIComponent(m[1]).replace(/:$/, ''), m[2], m[3]];
    if ((m = /\/me\/drive\/special\/approot:\/(.*?):?(\/children|\/content)?(\?.*)?$/.exec(u))) return ['app/' + decodeURIComponent(m[1]).replace(/:$/, ''), m[2], m[3]];
    return [null];
  };
  async function fetchFn(url, opts = {}) {
    calls.push({ url, method: opts.method ?? 'GET', headers: opts.headers ?? {}, body: opts.body });
    if (url.startsWith('https://dl.example/')) {
      const p = decodeURIComponent(url.slice(19));
      if (opts.headers?.Authorization) throw new Error('no debe enviar el token');
      return json(200, all[p]);
    }
    const u = url.split('?')[0];
    if (u === `${G}/me/drive/root/children`) return json(200, { value: childrenOf('root') });
    if (u === `${G}/me/drive/special/approot/children`) return json(200, { value: childrenOf('app') });
    let m = /\/me\/drive\/items\/(id\d+)\/children$/.exec(u);
    if (m) return json(200, { value: childrenOf(items.get(m[1])) });
    const [p, kind, q] = pathOf(url);
    if (!p) return json(400, { error: { message: 'ruta desconocida ' + url } });
    const isDir = Object.keys(all).some((k) => k.startsWith(p + '/'));
    if (kind === '/children') return isDir ? json(200, { value: childrenOf(p) }) : json(404, { error: { code: 'itemNotFound' } });
    if (opts.method === 'PUT') {
      if (q?.includes('conflictBehavior=fail') && p in all) return json(409, { error: { code: 'nameAlreadyExists' } });
      if (opts.headers['If-Match'] && !(p in all)) return json(404, {});
      if (opts.headers['If-Match'] && opts.headers['If-Match'] !== etags.get(p)) return json(412, {});
      all[p] = opts.body;
      etags.set(p, `"{E${++n}},1"`);
      return json(201, { eTag: etags.get(p) });
    }
    if (opts.method === 'DELETE') {
      if (!(p in all) && isDir) {
        for (const k of Object.keys(all)) if (k.startsWith(p + '/')) delete all[k];
        return { ok: true, status: 204, json: async () => ({}) };
      }
      if (!(p in all)) return json(404, {});
      if (opts.headers['If-Match'] && opts.headers['If-Match'] !== etags.get(p)) return json(412, {});
      delete all[p];
      return { ok: true, status: 204, json: async () => ({}) };
    }
    if (!(p in all)) return json(404, { error: { code: 'itemNotFound' } });
    return json(200, { id: 'x', eTag: etags.get(p), '@microsoft.graph.downloadUrl': `https://dl.example/${encodeURIComponent(p)}` });
  }
  return { fetchFn, calls, all, etags };
}

