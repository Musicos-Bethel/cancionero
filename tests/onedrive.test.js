import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOneDriveSource } from '../src/sources/onedrive.js';
import { authorizeUrl, pkceChallenge, scopes, sessionFromTokens } from '../src/sources/onedrive-auth.js';
import { ConflictError, FolderNotFoundError, OfflineError, PermissionError } from '../src/sources/errors.js';
import { classifyPath } from '../src/library/library.js';
import { fakeDrive } from './helpers/fake-drive.js';

const G = 'https://graph.microsoft.com/v1.0';

const make = (drive, layout = { root: 'Cancionero', voces: 'Voces', bateria: 'Bateria', metales: 'Metales', enlaces: 'Enlaces' }, extra = {}) =>
  createOneDriveSource({ getLayout: () => layout, fetchFn: drive.fetchFn, token: async () => 'TOKEN', isOnline: () => true, ...extra });

test('lista la biblioteca y las listas de la carpeta de la app', async () => {
  const d = fakeDrive(
    { 'Cancionero/Voces/Castillo.cho': '{title: Castillo}', 'Cancionero/Voces/Navidad/Noche.cho': 'x', 'Cancionero/Bateria/Castillo.pdf': 'pdf', 'Cancionero/Listas/Vieja.txt': 'no', 'Otra/x.cho': 'no' },
    { app: { 'Listas/2026-11-29 Domingo.txt': 'nombre: Domingo', 'ajustes-lider.json': '{}' } },
  );
  const src = make(d);
  const files = (await src.list()).map((f) => f.path).sort();
  assert.deepEqual(files, ['Bateria/Castillo.pdf', 'Listas/2026-11-29 Domingo.txt', 'Voces/Castillo.cho', 'Voces/Navidad/Noche.cho', 'ajustes-lider.json']);
  assert.ok(d.calls.filter((c) => c.url.startsWith(G)).every((c) => c.headers.Authorization === 'Bearer TOKEN'));
  // Se clasifican con la estructura de carpetas
  const layout = src.layout();
  assert.equal(classifyPath('Listas/2026-11-29 Domingo.txt', layout).section, 'listas');
  assert.equal(classifyPath('Voces/Navidad/Noche.cho', layout).section, 'voces');
  assert.equal(classifyPath('ajustes-lider.json', layout).section, 'config');
  // Descarga por la dirección temporal, sin token
  const buf = await src.getBuffer('Voces/Castillo.cho');
  assert.equal(new TextDecoder().decode(buf), '{title: Castillo}');
});

test('carpeta raíz de SongBook: toda la carpeta es «Voces»', async () => {
  const d = fakeDrive({ 'SongBook/Himnos/Santo.cho': 'a', 'SongBook/Partituras batería/Santo.pdf': 'b' });
  const layout = { root: 'SongBook', voces: '', bateria: 'Partituras batería', metales: 'Metales', enlaces: 'Enlaces' };
  const src = make(d, layout);
  const files = await src.list();
  const l = src.layout();
  assert.deepEqual(files.map((f) => [f.path, classifyPath(f.path, l)?.section]).sort(), [['Himnos/Santo.cho', 'voces'], ['Partituras batería/Santo.pdf', 'bateria']]);
});

test('si no existe la carpeta, propone las que hay', async () => {
  const d = fakeDrive({ 'Documentos/a.txt': 'a', 'SongBook/x.cho': 'b' });
  await assert.rejects(make(d).list(), (e) => e instanceof FolderNotFoundError && e.folder === 'Cancionero' && e.folders.sort().join() === 'Documentos,SongBook');
});

test('escribe listas con control de versiones', async () => {
  const d = fakeDrive({ 'Cancionero/Voces/a.cho': 'a' }, { app: { 'Listas/Domingo.txt': 'v1' } });
  const src = make(d);
  await src.list();
  const cur = await src.readText('Listas/Domingo.txt');
  assert.equal(cur.text, 'v1');
  const { etag } = await src.writeText('Listas/Domingo.txt', 'v2', { ifMatch: cur.etag });
  assert.equal(d.all['app/Listas/Domingo.txt'], 'v2');
  await assert.rejects(src.writeText('Listas/Domingo.txt', 'v3', { ifMatch: cur.etag }), (e) => e instanceof ConflictError && e.reason === 'changed');
  await assert.rejects(src.writeText('Listas/Domingo.txt', 'v3', { ifNoneMatch: '*' }), (e) => e instanceof ConflictError && e.reason === 'exists');
  await src.writeText('Listas/Nueva.txt', 'n', { ifNoneMatch: '*' });
  assert.equal(d.all['app/Listas/Nueva.txt'], 'n');
  await assert.rejects(src.remove('Listas/Domingo.txt', { ifMatch: cur.etag }), (e) => e.reason === 'changed');
  await src.remove('Listas/Domingo.txt', { ifMatch: etag });
  assert.ok(!('app/Listas/Domingo.txt' in d.all));
  await src.remove('Listas/Domingo.txt'); // ya no existe: sin error
  assert.equal(await src.readText('Listas/Domingo.txt'), null);
  await assert.rejects(src.writeText('Listas/Otra.txt', 'x', { ifMatch: '"{E1},1"' }), (e) => e.reason === 'deleted');
});

test('nunca escribe en la carpeta de canciones', async () => {
  const d = fakeDrive({ 'Cancionero/Voces/a.cho': 'a' });
  const src = make(d);
  await assert.rejects(src.writeText('Voces/a.cho', 'x'), /no puede escribir/);
  await assert.rejects(src.remove('Voces/a.cho'), /no puede borrar/);
  assert.equal(d.all['root/Cancionero/Voces/a.cho'], 'a');
});

test('sin conexión', async () => {
  const d = fakeDrive({});
  await assert.rejects(make(d, undefined, { isOnline: () => false }).list(), OfflineError);
  const broken = createOneDriveSource({ fetchFn: async () => { throw new TypeError('Failed to fetch'); }, token: async () => 't', isOnline: () => true });
  await assert.rejects(broken.readText('Listas/x.txt'), OfflineError);
});

test('inicio de sesión: PKCE y permisos', async () => {
  // Ejemplo del RFC 7636
  assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.deepEqual(scopes({ location: 'appFolder' }), ['Files.Read', 'Files.ReadWrite.AppFolder', 'offline_access', 'User.Read']);
  assert.deepEqual(scopes({ location: 'appFolder', songs: true }), ['Files.ReadWrite', 'offline_access', 'User.Read']);
  assert.deepEqual(scopes({ location: 'library' }), ['Files.ReadWrite', 'offline_access', 'User.Read']);
  assert.deepEqual(scopes(), ['Files.ReadWrite', 'offline_access', 'User.Read']); // configuración actual
  const u = new URL(authorizeUrl({ challenge: 'C', state: 'S', redirect: 'https://musicos-bethel.github.io/cancionero/' }));
  assert.equal(u.origin + u.pathname, 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize');
  assert.equal(u.searchParams.get('client_id'), '837f9cf6-8578-477d-bf55-952a19779d8c');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://musicos-bethel.github.io/cancionero/');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  const s1 = sessionFromTokens({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }, 1000);
  assert.deepEqual(s1, { accessToken: 'a', refreshToken: 'r', expiresAt: 3601000, startedAt: 1000, account: null });
  const s2 = sessionFromTokens({ access_token: 'b', expires_in: 60 }, 5000, { ...s1, account: { name: 'X' } });
  assert.equal(s2.refreshToken, 'r');
  assert.equal(s2.startedAt, 1000);
  assert.deepEqual(s2.account, { name: 'X' });
});

test('volver a entrar: sin selector de cuenta y en silencio', () => {
  const base = { challenge: 'C', state: 'S', redirect: 'https://musicos-bethel.github.io/cancionero/', loginHint: 'cuenta@example.com' };
  const silent = new URL(authorizeUrl({ ...base, prompt: 'none' }));
  assert.equal(silent.searchParams.get('prompt'), 'none');
  assert.equal(silent.searchParams.get('login_hint'), 'cuenta@example.com');
  const normal = new URL(authorizeUrl({ ...base, prompt: null }));
  assert.equal(normal.searchParams.has('prompt'), false);
  assert.equal(new URL(authorizeUrl({ challenge: 'C', state: 'S', redirect: base.redirect })).searchParams.get('prompt'), 'select_account');
});

test('borrar canciones de la carpeta del cancionero', async () => {
  const d = fakeDrive({ 'Cancionero/Alabanzas/Te alabaré.pro': 'a', 'Cancionero/Partituras batería/Santo/1.png': 'p', 'Cancionero/Partituras batería/Santo/2.png': 'p' }, { app: { 'Listas/Domingo.txt': 'l' } });
  const target = { location: 'appFolder', listsFolder: 'Listas', leaderFile: 'ajustes-lider.json', songs: true };
  const src = make(d, undefined, { target });
  assert.equal(src.canDeleteSongs, true);
  await src.list();
  const etag = d.etags.get('root/Cancionero/Alabanzas/Te alabaré.pro');
  await assert.rejects(src.removeSong('Alabanzas/Te alabaré.pro', { ifMatch: '"{otra},1"' }), (e) => e instanceof ConflictError);
  await src.removeSong('Alabanzas/Te alabaré.pro', { ifMatch: etag });
  assert.ok(!('root/Cancionero/Alabanzas/Te alabaré.pro' in d.all));
  await src.removeSong('Alabanzas/Te alabaré.pro'); // ya no existe: sin error
  // Nunca la carpeta de la app por este camino
  await assert.rejects(src.removeSong('Listas/Domingo.txt'), /no puede borrar/);
  assert.equal(d.all['app/Listas/Domingo.txt'], 'l');
  // Sin el permiso: no se ofrece
  const sinPermiso = make(d, undefined, { target: { ...target, songs: false } });
  assert.equal(sinPermiso.canDeleteSongs, false);
  await assert.rejects(sinPermiso.removeSong('Partituras batería/Santo'), /no puede borrar/);
});

test('permiso insuficiente (sesión con los permisos antiguos)', async () => {
  const forbidden = async () => ({ ok: false, status: 403, json: async () => ({ error: { code: 'accessDenied' } }) });
  const src = createOneDriveSource({ fetchFn: forbidden, token: async () => 't', isOnline: () => true, target: { location: 'appFolder', listsFolder: 'Listas', leaderFile: 'ajustes-lider.json', songs: true } });
  await assert.rejects(src.removeSong('Himnos/x.cho'), PermissionError);
  await assert.rejects(src.writeSong('Himnos/x.cho', 'x'), PermissionError);
});

test('borrar una canción de varias imágenes borra su carpeta', async () => {
  const { deletionPaths } = await import('../src/library/library.js');
  assert.deepEqual(deletionPaths({ kind: 'imageset', paths: ['Partituras batería/Santo/1.png', 'Partituras batería/Santo/2.png'] }), ['Partituras batería/Santo']);
  assert.deepEqual(deletionPaths({ kind: 'pdf', paths: ['Partituras batería/Santo.pdf'] }), ['Partituras batería/Santo.pdf']);
});

test('crear y guardar canciones en la carpeta del cancionero (editores)', async () => {
  const d = fakeDrive({ 'Cancionero/Himnos/Viejo.pro': '{title: Viejo}' }, { app: { 'Listas/Domingo.txt': 'l' } });
  const target = { location: 'appFolder', listsFolder: 'Listas', leaderFile: 'ajustes-lider.json', songs: true };
  const layout = { root: 'Cancionero', voces: '', bateria: 'Partituras batería', metales: 'Metales', enlaces: 'Enlaces' };
  const src = make(d, layout, { target });
  assert.equal(src.canWriteSongs, true);
  // Nueva: en la carpeta elegida, sin sobrescribir otra con el mismo nombre
  const { etag } = await src.writeSong('Himnos/Nueva.pro', '{title: Nueva}', { ifNoneMatch: '*' });
  assert.equal(d.all['root/Cancionero/Himnos/Nueva.pro'], '{title: Nueva}');
  assert.equal(etag, d.etags.get('root/Cancionero/Himnos/Nueva.pro'));
  await assert.rejects(src.writeSong('Himnos/Nueva.pro', 'otra', { ifNoneMatch: '*' }), (e) => e instanceof ConflictError && e.reason === 'exists');
  await src.writeSong('Partituras batería/Ritmo.pro', 'b', { ifNoneMatch: '*' });
  assert.equal(d.all['root/Cancionero/Partituras batería/Ritmo.pro'], 'b');
  // Editar: solo si nadie la ha cambiado desde la última actualización
  const v1 = d.etags.get('root/Cancionero/Himnos/Viejo.pro');
  await src.writeSong('Himnos/Viejo.pro', 'v2', { ifMatch: v1 });
  await assert.rejects(src.writeSong('Himnos/Viejo.pro', 'v3', { ifMatch: v1 }), (e) => e instanceof ConflictError && e.reason === 'changed');
  assert.equal(d.all['root/Cancionero/Himnos/Viejo.pro'], 'v2');
  // Ni listas ni archivos que no sean de texto por este camino
  await assert.rejects(src.writeSong('Listas/Domingo.txt', 'x'), /no puede escribir/);
  await assert.rejects(src.writeSong('Himnos/a.pdf', 'x'), /no puede escribir/);
  assert.equal(d.all['app/Listas/Domingo.txt'], 'l');
  // Sin el permiso: no se ofrece
  const sinPermiso = make(d, layout, { target: { ...target, songs: false } });
  assert.equal(sinPermiso.canWriteSongs, false);
  await assert.rejects(sinPermiso.writeSong('Himnos/b.pro', 'x'), /no puede escribir/);
});
