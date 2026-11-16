import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLibrary, classifyPath, resolveItem, partVersion, vocesVersion, categoriesOf, linkReport,
} from '../src/library/library.js';

test('clasifica la carpeta Metales por instrumento', () => {
  assert.deepEqual(classifyPath('Metales/Saxofon/Himno.pdf'), { section: 'saxofon', ext: 'pdf', kind: 'pdf', depth: 2 });
  assert.deepEqual(classifyPath('Metales/Saxofón alto/Himnos/Himno.cho'), { section: 'saxofon', ext: 'cho', kind: 'text', depth: 2 });
  assert.deepEqual(classifyPath('Metales/Trompetas/Himno.png'), { section: 'trompeta', ext: 'png', kind: 'image', depth: 2 });
  // Fuera de la carpeta de un instrumento: general (para los dos).
  assert.deepEqual(classifyPath('Metales/Himno.pdf'), { section: 'metales', ext: 'pdf', kind: 'pdf', depth: 1 });
  assert.deepEqual(classifyPath('Metales/Navidad/Himno.pdf'), { section: 'metales', ext: 'pdf', kind: 'pdf', depth: 1 });
  // Una partitura llamada «Saxofón» directamente en Metales no es una carpeta de instrumento.
  assert.equal(classifyPath('Metales/Saxofon.pdf').section, 'metales');
});

test('con estructura personalizada', () => {
  const layout = { voces: '', bateria: 'Partituras batería', metales: 'Partituras metales', listas: 'Listas' };
  assert.deepEqual(classifyPath('Partituras metales/Trompeta/Himno.pdf', layout), { section: 'trompeta', ext: 'pdf', kind: 'pdf', depth: 2 });
  assert.deepEqual(classifyPath('Partituras metales/Himno.pdf', layout), { section: 'metales', ext: 'pdf', kind: 'pdf', depth: 1 });
});

const files = [
  { path: 'Voces/Himnos/Castillo fuerte.cho', section: 'voces', kind: 'text', ext: 'cho', meta: { title: 'Castillo fuerte es nuestro Dios' } },
  { path: 'Voces/Amazing Grace.cho', section: 'voces', kind: 'text', ext: 'cho', meta: {} },
  { path: 'Voces/Doxología.txt', section: 'voces', kind: 'text', ext: 'txt', meta: {} },
  { path: 'Metales/Saxofon/Castillo fuerte.pdf', section: 'saxofon', kind: 'pdf', ext: 'pdf', depth: 2 },
  { path: 'Metales/Trompeta/Navidad/Castillo fuerte.cho', section: 'trompeta', kind: 'text', ext: 'cho', depth: 2, meta: {} },
  { path: 'Metales/Trompeta/Amazing Grace/1.png', section: 'trompeta', kind: 'image', ext: 'png', depth: 2 },
  { path: 'Metales/Trompeta/Amazing Grace/2.png', section: 'trompeta', kind: 'image', ext: 'png', depth: 2 },
  { path: 'Metales/Amazing Grace.pdf', section: 'metales', kind: 'pdf', ext: 'pdf', depth: 1 },
  { path: 'Metales/Solo metales.pdf', section: 'metales', kind: 'pdf', ext: 'pdf', depth: 1 },
  { path: 'Listas/Domingo.txt', section: 'listas', kind: 'list', text: 'fecha: 2026-11-15\nCastillo fuerte\nAmazing Grace\nDoxología' },
];

test('cada instrumento tiene sus partituras y las generales', () => {
  const lib = buildLibrary(files, { today: '2026-11-01' });
  assert.deepEqual(lib.songs.saxofon.map((s) => s.name), ['Amazing Grace', 'Castillo fuerte', 'Solo metales']);
  assert.deepEqual(lib.songs.trompeta.map((s) => s.name), ['Amazing Grace', 'Castillo fuerte', 'Solo metales']);
  // La del instrumento gana a la general y no cuenta como repetida.
  assert.equal(lib.byId.trompeta.get('amazing grace').kind, 'imageset');
  assert.equal(lib.byId.saxofon.get('amazing grace').general, true);
  assert.equal(lib.byId.saxofon.get('amazing grace').key, 'saxofon:amazing grace');
  assert.equal(lib.duplicates.length, 0);
  // Categorías: las de su carpeta y las heredadas de voces.
  assert.deepEqual(lib.byId.trompeta.get('castillo fuerte').categories, ['Navidad', 'Himnos']);
  assert.deepEqual(categoriesOf(lib, 'saxofon').map((c) => `${c.label}:${c.count}`), ['Todas:3', 'Sin categoría:2', 'Himnos:1']);
});

test('las listas abren la partitura del instrumento o la de voces', () => {
  const lib = buildLibrary(files, { today: '2026-11-01' });
  const [castillo, amazing, doxo] = lib.lists[0].items;
  assert.equal(resolveItem(lib, castillo, 'saxofon').song.path, 'Metales/Saxofon/Castillo fuerte.pdf');
  assert.equal(resolveItem(lib, castillo, 'trompeta').song.kind, 'chordpro');
  assert.equal(resolveItem(lib, amazing, 'saxofon').song.path, 'Metales/Amazing Grace.pdf');
  assert.deepEqual(
    { fallback: resolveItem(lib, doxo, 'trompeta').fallback, section: resolveItem(lib, doxo, 'trompeta').song.section },
    { fallback: true, section: 'voces' },
  );
  const voces = lib.byId.voces.get('castillo fuerte');
  assert.equal(partVersion(lib, voces, 'saxofon').section, 'saxofon');
  assert.equal(vocesVersion(lib, lib.byId.trompeta.get('castillo fuerte')), voces);
  assert.deepEqual(linkReport(lib).metalesSinVoces, []);
});
