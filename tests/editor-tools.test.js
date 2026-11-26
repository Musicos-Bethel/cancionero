import { test } from 'node:test';
import assert from 'node:assert/strict';
import { songChords, keyChords, wrapLines, insertLine, highlightTokens, validChord, SECTION_NAMES } from '../src/chordpro/editor-tools.js';

test('acordes de la canción, por orden y sin repetir', () => {
  const body = '{c: Intro}\n[E/G#][A]   [A/C#][D]\n[A]Ho[*rit.]la [E]que [A]tal\n{sot}\n[x] no cuenta\n{eot}';
  assert.deepEqual(songChords(body), ['E/G#', 'A', 'A/C#', 'D', 'E']);
});

test('acordes de la tonalidad', () => {
  assert.deepEqual(keyChords('G'), ['G', 'Am', 'Bm', 'C', 'D', 'Em']);
  assert.deepEqual(keyChords('F'), ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm']);
  assert.deepEqual(keyChords('Em'), ['Em', 'G', 'Am', 'Bm', 'B', 'C', 'D']);
  assert.deepEqual(keyChords(''), []);
  assert.ok(validChord('F#m7/C#'));
  assert.ok(!validChord('Hola'));
  assert.ok(!validChord('A]'));
});

test('rodear líneas con {soc} … {eoc}', () => {
  const t = 'uno\ndos\ntres\ncuatro';
  // selección desde la mitad de «dos» hasta la mitad de «tres»
  const r = wrapLines(t, 5, 10, '{soc}', '{eoc}');
  assert.equal(r.text, 'uno\n{soc}\ndos\ntres\n{eoc}\ncuatro');
  assert.equal(r.text.slice(0, r.start), 'uno\n{soc}\ndos\ntres\n{eoc}');
  assert.equal(r.start, r.end);
  // en una línea vacía: par vacío con el cursor dentro
  const e = wrapLines('uno\n\ndos', 4, 4, '{soc}', '{eoc}');
  assert.equal(e.text, 'uno\n{soc}\n\n{eoc}\ndos');
  assert.equal(e.start, 10);
});

test('insertar una línea de sección', () => {
  assert.deepEqual(insertLine('uno\ndos', 5, '{c: Coro}'), { text: 'uno\n{c: Coro}\ndos', start: 13, end: 13 });
  assert.equal(insertLine('uno\n\ndos', 4, '{c: Coro}').text, 'uno\n{c: Coro}\ndos');
});

test('colorea sin cambiar el texto', () => {
  const text = '{c: Intro } {soh} 2x {eoh}\n[A]Ho[E]la {soh}3x{eoh}\n{sot}\n[x]--\n{eot}';
  const toks = highlightTokens(text);
  assert.equal(toks.map((t) => t[1]).join(''), text);
  const of = (cls) => toks.filter((t) => t[0] === cls).map((t) => t[1].trim());
  assert.deepEqual(of('label'), ['Intro']);
  assert.deepEqual(of('chord'), ['[A]', '[E]']);
  assert.deepEqual(of('hl'), ['2x', '3x']);
});

test('el botón Sección ofrece Outro y Cierre después de Final', () => {
  const i = SECTION_NAMES.indexOf('Final');
  assert.deepEqual(SECTION_NAMES.slice(i, i + 3), ['Final', 'Outro', 'Cierre']);
});
