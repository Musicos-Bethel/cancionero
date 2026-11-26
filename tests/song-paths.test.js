// Dónde se guardan en la biblioteca compartida las canciones de los editores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionFolder, songFolders, newSongPath, editPaths, withoutFolderTags, suggestFolder, folderCategoriesOf } from '../src/library/song-paths.js';
import { classifyPath } from '../src/library/library.js';

// Estructura real de la iglesia: la carpeta del cancionero es «Voces» y sus subcarpetas, categorías.
const REAL = { root: 'Cancionero', voces: '', bateria: 'Partituras batería', metales: 'Metales', enlaces: 'Enlaces', listas: 'Listas' };

const rec = (path, layout, origin = 'remote') => ({ path, origin, ...classifyPath(path, layout) });

test('carpeta de cada sección', () => {
  assert.equal(sectionFolder('voces', REAL), '');
  assert.equal(sectionFolder('bateria', REAL), 'Partituras batería');
  assert.equal(sectionFolder('voces', null), 'Voces'); // demostración
  assert.equal(sectionFolder('bateria', null), 'Bateria');
});

test('carpetas que se ofrecen: las categorías que ya existen', () => {
  const files = [
    rec('Alabanzas/Uno.pro', REAL),
    rec('Himnos/Dos.pro', REAL),
    rec('Himnos/Tres.pdf', REAL),
    rec('No Usadas/Cuatro.pro', REAL),
    rec('Suelta.pro', REAL),
    rec('Partituras batería/Cinco.pdf', REAL),
    rec('Partituras batería/Con imágenes/1.png', REAL),
    rec('Navidad/Seis.cho', REAL, 'local'), // las del dispositivo no cuentan
  ];
  assert.deepEqual(songFolders('voces', files, REAL), ['Alabanzas', 'Himnos', 'No Usadas']);
  assert.deepEqual(songFolders('bateria', files, REAL), []);
});

test('ruta de una canción nueva (.pro, como la biblioteca de SongBook)', () => {
  assert.equal(newSongPath('voces', 'Himnos', 'Canción de prueba', REAL), 'Himnos/Canción de prueba.pro');
  assert.equal(newSongPath('voces', '', 'Canción de prueba', REAL), 'Canción de prueba.pro');
  assert.equal(newSongPath('bateria', '', 'Ritmo inventado', REAL), 'Partituras batería/Ritmo inventado.pro');
  assert.equal(newSongPath('voces', 'Navidad', 'Prueba', null), 'Voces/Navidad/Prueba.pro');
  // Y la app la reconoce en la sección correcta
  assert.equal(classifyPath('Himnos/Canción de prueba.pro', REAL).section, 'voces');
  assert.equal(classifyPath('Partituras batería/Ritmo inventado.pro', REAL).section, 'bateria');
});

test('editar: mismo archivo si es ChordPro; un .txt pasa a .pro', () => {
  assert.deepEqual(editPaths({ path: 'Himnos/A.pro', ext: 'pro' }), { path: 'Himnos/A.pro', replaces: null });
  assert.deepEqual(editPaths({ path: 'Voces/B.cho', ext: 'cho' }), { path: 'Voces/B.cho', replaces: null });
  assert.deepEqual(editPaths({ path: 'Himnos/C.txt', ext: 'txt' }), { path: 'Himnos/C.pro', replaces: 'Himnos/C.txt' });
});

test('la categoría que da la carpeta no se repite como {tag}', () => {
  assert.deepEqual(folderCategoriesOf('Himnos/A.pro', REAL), ['Himnos']);
  assert.deepEqual(withoutFolderTags(['Himnos', 'Lentas'], 'Himnos/A.pro', REAL), ['Lentas']);
  assert.deepEqual(withoutFolderTags(['Himnos'], 'A.pro', REAL), ['Himnos']);
});

test('carpeta propuesta según las categorías', () => {
  assert.equal(suggestFolder(['lentas', 'himnos'], ['Alabanzas', 'Himnos']), 'Himnos');
  assert.equal(suggestFolder(['Otra'], ['Alabanzas']), '');
  assert.equal(suggestFolder([], []), '');
});
