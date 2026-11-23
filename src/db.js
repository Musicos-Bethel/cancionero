import { openDB } from 'idb';

/**
 * Almacenamiento local (IndexedDB):
 *  - files: metadatos y texto de cada archivo (clave: path)
 *  - blobs: contenido de PDF e imágenes, separado para no cargarlo al listar
 *  - prefs: ajustes por canción (transposición, capo, zoom, velocidad…)
 *  - kv:    ajustes generales y estado de sincronización
 *  - outbox: cambios del modo líder pendientes de subir (listas guardadas o borradas)
 *  - demoRemote: la «OneDrive simulada» del modo demostración (archivos escritos)
 */
// Se abre al primer uso (así los módulos se pueden probar fuera del navegador).
let dbPromise = null;
const openDb = () =>
  (dbPromise ??= openDB('cancionero-bethel', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('files', { keyPath: 'path' });
        db.createObjectStore('blobs');
        db.createObjectStore('prefs');
        db.createObjectStore('kv');
      }
      if (oldVersion < 2) {
        db.createObjectStore('outbox', { keyPath: 'key' });
        db.createObjectStore('demoRemote', { keyPath: 'path' });
      }
    },
  }));

export async function getAllFiles() {
  return (await openDb()).getAll('files');
}

export async function putFiles(records) {
  const db = await openDb();
  const tx = db.transaction('files', 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

export async function deleteFiles(paths) {
  const db = await openDb();
  const tx = db.transaction(['files', 'blobs'], 'readwrite');
  await Promise.all([
    ...paths.flatMap((p) => [tx.objectStore('files').delete(p), tx.objectStore('blobs').delete(p)]),
    tx.done,
  ]);
}

export async function getBlob(path) {
  return (await openDb()).get('blobs', path);
}
export async function putBlob(path, blob) {
  return (await openDb()).put('blobs', blob, path);
}
export async function deleteBlob(path) {
  return (await openDb()).delete('blobs', path);
}
export async function blobKeys() {
  return new Set(await (await openDb()).getAllKeys('blobs'));
}

export async function kvGet(key, fallback = undefined) {
  const v = await (await openDb()).get('kv', key);
  return v === undefined ? fallback : v;
}
export async function kvSet(key, value) {
  return (await openDb()).put('kv', value, key);
}

export async function prefGet(key) {
  return (await (await openDb()).get('prefs', key)) ?? {};
}
export async function prefPatch(key, patch) {
  const db = await openDb();
  const cur = (await db.get('prefs', key)) ?? {};
  const next = { ...cur, ...patch };
  await db.put('prefs', next, key);
  return next;
}
export async function allPrefs() {
  const db = await openDb();
  const [keys, values] = await Promise.all([db.getAllKeys('prefs'), db.getAll('prefs')]);
  return keys.map((k, i) => [k, values[i]]);
}
export async function putPrefs(entries) {
  const db = await openDb();
  const tx = db.transaction('prefs', 'readwrite');
  await Promise.all([...entries.map(([k, v]) => tx.store.put(v, k)), tx.done]);
}

// ---- Cambios pendientes de subir
export async function outboxAll() {
  return (await openDb()).getAll('outbox');
}
export async function outboxPut(entry) {
  return (await openDb()).put('outbox', entry);
}
export async function outboxDelete(key) {
  return (await openDb()).delete('outbox', key);
}

// ---- OneDrive simulada (demostración)
export async function demoRemoteAll() {
  return (await openDb()).getAll('demoRemote');
}
export async function demoRemoteGet(path) {
  return (await openDb()).get('demoRemote', path);
}
export async function demoRemotePut(rec) {
  return (await openDb()).put('demoRemote', rec);
}
export async function demoRemoteClear() {
  return (await openDb()).clear('demoRemote');
}
export async function kvDelete(key) {
  return (await openDb()).delete('kv', key);
}
