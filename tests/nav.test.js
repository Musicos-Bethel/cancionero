import { test } from 'node:test';
import assert from 'node:assert/strict';

// Navegador mínimo: historial con estado y location.hash/replace.
const stack = [{ hash: '#/', state: null }];
let pos = 0;
const fire = () => nav.trackRoute(); // como el evento hashchange
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.history = {
  get state() {
    return stack[pos].state;
  },
  replaceState(state) {
    stack[pos].state = state;
  },
  back() {
    if (pos > 0) {
      pos--;
      fire();
    }
  },
};
globalThis.location = {
  get hash() {
    return stack[pos].hash;
  },
  set hash(h) {
    stack.length = pos + 1;
    stack.push({ hash: h, state: null });
    pos++;
    fire();
  },
  replace(h) {
    stack[pos] = { hash: h, state: null };
    fire();
  },
};
const nav = await import('../src/nav.js');
const where = () => stack.slice(0, pos + 1).map((e) => e.hash);

test('editar y guardar una canción no deja el editor en el historial', () => {
  fire();
  location.hash = '#/canciones';
  location.hash = '#/cancion/voces/x';
  location.hash = '#/editor/voces/x';
  // Guardar: vuelve a la canción
  nav.goBackTo('#/cancion/voces/x', '#/cancion/voces/x');
  assert.deepEqual(where(), ['#/', '#/canciones', '#/cancion/voces/x']);
  // Atrás de la app desde la canción: a Canciones (y no al editor)
  nav.goBackTo('#/canciones');
  assert.deepEqual(where(), ['#/', '#/canciones']);
  // El botón de Android desde ahí lleva al inicio, sin bucles
  history.back();
  assert.deepEqual(where(), ['#/']);
});

test('canción nueva: el editor se sustituye por la canción', () => {
  location.hash = '#/canciones?cat=himnos';
  location.hash = '#/editor/nueva';
  nav.replaceTo('#/cancion/voces/nueva');
  assert.deepEqual(where(), ['#/', '#/canciones?cat=himnos', '#/cancion/voces/nueva']);
  // «Atrás» vuelve a Canciones con su filtro
  nav.goBackTo('#/canciones');
  assert.deepEqual(where(), ['#/', '#/canciones?cat=himnos']);
});

test('sin pantalla anterior, «atrás» sustituye en lugar de apilar', () => {
  nav.replaceTo('#/cancion/voces/y'); // como abrir un enlace directo
  nav.goBackTo('#/canciones');
  assert.deepEqual(where(), ['#/', '#/canciones']);
});

test('lista que cambia de nombre al guardarla', () => {
  location.hash = '#/listas';
  location.hash = '#/lista/vieja';
  location.hash = '#/listas/editar/vieja';
  nav.goBackTo('#/lista/nueva', '#/lista/vieja');
  assert.deepEqual(where(), ['#/', '#/canciones', '#/listas', '#/lista/nueva']);
});
