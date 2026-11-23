import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChordPro, splitInlineCodes } from '../src/chordpro/parser.js';
import { normalizeSegments } from '../src/viewers/chordpro-view.js';

// Ejemplo con la forma de los archivos de SongBook (letra inventada).
const SB = `{title: Prueba}
{subtitle: Autor}
{musicpath:/storage/emulated/0/Music/prueba.mp3}
{time:6:58}
{metronome:136}

{c: Intro } {soh} 2x {eoh}
[E/G#][A]       [A/C#][D]

{c: Coro }
{soc}
A [A]ti la gloria
{eoc}

{c: Solo } {soh} 2x {eoh}
[G]   [Gsus][G]

[A]A[A]mén. {soh}3x{eoh}
`;

test('SongBook: duración, tempo y marcador de repeticiones', () => {
  const doc = parseChordPro(SB);
  assert.equal(doc.meta.duration, '6:58');
  assert.equal(doc.meta.time, undefined); // no es el compás
  assert.equal(doc.meta.tempo, '136');
  const intro = doc.blocks[0].lines[0];
  assert.equal(intro.type, 'comment');
  assert.equal(intro.text, 'Intro 2x');
  assert.deepEqual(intro.parts, [{ text: 'Intro', hl: false }, { text: '2x', hl: true }]);
});

test('{c: Coro} + {soc}: «Coro» sale una sola vez', () => {
  const doc = parseChordPro(SB);
  const chorus = doc.blocks.find((b) => b.type === 'chorus');
  assert.equal(chorus.label, 'Coro');
  assert.ok(!doc.blocks.some((b) => b.lines.some((l) => l.type === 'comment' && l.text === 'Coro')));
  // Con resaltado en la etiqueta
  const d2 = parseChordPro('{c: Coro } {soh} 2x {eoh}\n{soc}\n[A]Hola\n{eoc}');
  assert.deepEqual(d2.blocks[0].labelParts, [{ text: 'Coro', hl: false }, { text: '2x', hl: true }]);
  // Un {soc} con nombre propio no se come el comentario anterior
  const d3 = parseChordPro('{c: Nota}\n{soc: Coro final}\n[A]Hola\n{eoc}');
  assert.equal(d3.blocks[0].lines[0].text, 'Nota');
  assert.equal(d3.blocks[1].label, 'Coro final');
});

test('resaltado dentro de la letra', () => {
  const doc = parseChordPro(SB);
  const amen = doc.blocks.at(-1).lines.at(-1);
  assert.equal(amen.type, 'lyrics');
  assert.deepEqual(amen.segments.filter((s) => s.hl).map((s) => s.text.trim()), ['3x']);
  assert.deepEqual(amen.segments.filter((s) => s.chord).map((s) => s.chord), ['A', 'A']);
});

test('líneas que no llevan códigos de SongBook se leen como siempre', () => {
  assert.equal(splitInlineCodes('{title: Hola}'), null);
  assert.equal(splitInlineCodes('[A]Letra con {llaves} sueltas'), null);
  const d = parseChordPro('{c: Intro}\n[A]Hola {tag: x}');
  assert.equal(d.blocks[0].lines[0].text, 'Intro');
  assert.equal(d.meta.time, undefined);
  assert.equal(parseChordPro('{time: 6/8}').meta.time, '6/8');
  assert.equal(parseChordPro('{tempo: 72}\n{metronome: 90}').meta.tempo, '72');
});

test('acorde antes de un espacio pasa a la palabra siguiente', () => {
  const segs = normalizeSegments([
    { chord: null, text: 'abre' },
    { chord: 'B/E', text: ' mis ojos' },
  ]);
  assert.deepEqual(segs, [
    { chord: null, text: 'abre ' },
    { chord: 'B/E', text: 'mis ojos' },
  ]);
  const first = normalizeSegments([{ chord: 'A', text: '  Hola' }]);
  assert.deepEqual(first, [{ chord: null, text: '  ' }, { chord: 'A', text: 'Hola' }]);
  // Acorde sobre espacios sin palabra detrás (fin de línea): se queda.
  assert.deepEqual(normalizeSegments([{ chord: 'E', text: '   ' }]), [{ chord: 'E', text: '   ' }]);
});
