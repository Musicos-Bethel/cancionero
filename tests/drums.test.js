import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseGrid, gridLines, countLine, cycleCell, resizeRhythm, defaultMeter, newRhythm, insertRow,
  splitDrumFile, buildDrumFile, validateSheet,
} from '../src/drums/drum-sheet.js';
import { parseChordPro } from '../src/chordpro/parser.js';
import { songMeta } from '../src/chordpro/song-doc.js';

const demo = (f) => readFileSync('public/demo/Cancionero/Bateria/' + f, 'utf8');

test('línea de cuenta', () => {
  assert.equal(countLine(4, 4).join(' '), '1 . & . 2 . & . 3 . & . 4 . & .');
  assert.equal(countLine(2, 2).join(' '), '1 & 2 &');
  assert.equal(countLine(2, 3).join(' '), '1 . . 2 . .');
  assert.equal(countLine(3, 1).join(' '), '1 2 3');
});

test('lee una cuadrícula de batería', () => {
  const g = parseGrid([
    '       1 . & . 2 . & .',
    'Ch   | x . x . x . x . |',
    'Bom  | o . . . o . . . |',
  ]);
  assert.equal(g.beats, 2);
  assert.equal(g.spb, 4);
  assert.deepEqual(g.rows[1], { inst: 'Bom', cells: ['o', '.', '.', '.', 'o', '.', '.', '.'] });
  assert.deepEqual(gridLines(g), ['       1 . & . 2 . & .', 'Ch   | x . x . x . x . |', 'Bom  | o . . . o . . . |']);
});

test('acepta cuadrículas sin espacios (x-x-) y descarta tablaturas de guitarra', () => {
  const g = parseGrid(['HH|x-x-x-x-|', 'SD|----o---|', 'BD|o-------|']);
  assert.equal(g.rows.length, 3);
  assert.deepEqual(g.rows[1].cells, ['.', '.', '.', '.', 'o', '.', '.', '.']);
  assert.equal(parseGrid(['e|---0---3---|', 'B|---1-------|', 'G|-----------|']), null);
  assert.equal(parseGrid(['Ch | x . x |', 'Bom | o . |']), null); // longitudes distintas
});

test('tocar una celda: nada → golpe → acento → nada', () => {
  assert.equal(cycleCell('.', 'Ch'), 'x');
  assert.equal(cycleCell('x', 'Ch'), 'X');
  assert.equal(cycleCell('X', 'Ch'), '.');
  assert.equal(cycleCell('.', 'Caja'), 'o');
  assert.equal(cycleCell('o', 'Caja'), 'O');
  assert.equal(cycleCell('g', 'Caja'), '.');
});

test('cambiar la subdivisión conserva los golpes', () => {
  const r = { name: 'A', beats: 2, spb: 2, rows: [{ inst: 'Bom', cells: ['o', '.', 'o', 'o'] }] };
  assert.deepEqual(resizeRhythm(r, 2, 4).rows[0].cells, ['o', '.', '.', '.', 'o', '.', 'o', '.']);
  assert.deepEqual(resizeRhythm(resizeRhythm(r, 2, 4), 2, 2).rows[0].cells, ['o', '.', 'o', 'o']);
  assert.deepEqual(resizeRhythm(r, 3, 2).rows[0].cells, ['o', '.', 'o', 'o', '.', '.']);
});

test('compás por defecto y ritmo nuevo', () => {
  assert.deepEqual(defaultMeter('4/4'), { beats: 4, spb: 2 });
  assert.deepEqual(defaultMeter('6/8'), { beats: 2, spb: 3 });
  assert.deepEqual(defaultMeter('3/4'), { beats: 3, spb: 2 });
  assert.deepEqual(defaultMeter(''), { beats: 4, spb: 2 });
  const r = newRhythm('Ritmo A', '4/4');
  assert.equal(r.rows.map((x) => x.cells.join('')).join(' '), 'xxxxxxxx ..o...o. o...o...');
  const r2 = insertRow(r, 'Plat');
  assert.equal(r2.rows[0].inst, 'Plat');
  assert.equal(insertRow(r, 'Base').rows.map((x) => x.inst).join(','), 'Ch,Caja,Base,Bom');
});

test('lee las hojas de la demostración', () => {
  const s = splitDrumFile(demo('Castillo fuerte.cho'));
  assert.equal(s.title, 'Castillo fuerte es nuestro Dios');
  assert.equal(s.subtitle, 'Batería · marcha solemne');
  assert.equal(s.tempo, '76');
  assert.deepEqual(s.extra, ['{duration: 3:40}']);
  assert.deepEqual(s.tags, ['Partituras batería']);
  assert.deepEqual(s.rhythms.map((r) => [r.name, r.beats, r.spb, r.rows.length]), [
    ['Ritmo A · estrofas (aro + charles)', 4, 4, 3],
    ['Ritmo B · última estrofa (ride + caja)', 4, 4, 3],
  ]);
  assert.deepEqual(s.route[0], { kind: 'section', title: 'Intro', detail: '4 compases', note: 'Toms en negras con crescendo. Platillo en el 1 del compás 4.' });
  assert.equal(s.route.length, 6);
  assert.ok(s.route.every((r) => r.kind === 'section'));

  const b = splitDrumFile(demo('Blessed Assurance (6-8).cho'));
  assert.deepEqual(b.rhythms.map((r) => [r.beats, r.spb]), [[4, 3], [4, 3]]);
  assert.ok(b.route.some((r) => r.kind === 'raw' && r.text.includes('{start_of_chorus: Coro}')));
});

test('ida y vuelta sin perder nada', () => {
  for (const f of ['Castillo fuerte.cho', 'Blessed Assurance (6-8).cho']) {
    const text = demo(f);
    const back = buildDrumFile(splitDrumFile(text));
    const a = parseChordPro(text);
    const b = parseChordPro(back);
    assert.deepEqual(b.meta, a.meta, f);
    // Mismo contenido: los ritmos van primero y pueden cambiar los espacios.
    const norm = (doc) => {
      const lines = (t) => doc.blocks.filter((x) => (x.type === 'tab') === t).flatMap((x) => [...(x.type === 'none' ? [] : [x.type + ':' + x.label]), ...x.lines.filter((l) => l.type !== 'empty').map((l) => JSON.stringify(l).replace(/ +/g, ' '))]);
      return [...lines(true), ...lines(false)];
    };
    assert.deepEqual(norm(b), norm(a), f);
    assert.equal(buildDrumFile(splitDrumFile(back)), back, f);
  }
});

test('arma una hoja nueva', () => {
  const sheet = {
    title: 'Santo {santo}', subtitle: 'Batería · balada', tempo: '72', time: '4/4', tags: [], link: '', extra: [],
    rhythms: [newRhythm('Ritmo A', '4/4')],
    route: [
      { kind: 'section', title: 'Intro', detail: '4 compases', note: '' },
      { kind: 'section', title: 'Estrofa 1', detail: 'Ritmo A', note: 'Suave\nSin platos' },
    ],
  };
  const text = buildDrumFile(sheet);
  assert.equal(
    text,
    [
      '{title: Santo santo}', '{subtitle: Batería · balada}', '{tempo: 72}', '{time: 4/4}', '',
      '{start_of_tab: Ritmo A}', '       1 & 2 & 3 & 4 &', 'Ch   | x x x x x x x x |', 'Caja | . . o . . . o . |', 'Bom  | o . . . o . . . |', '{end_of_tab}', '',
      '{c: Intro · 4 compases}', '', '{c: Estrofa 1 · Ritmo A}', '{ci: Suave}', '{ci: Sin platos}', '',
    ].join('\n'),
  );
  assert.equal(songMeta(text, 'cho').title, 'Santo santo');
  assert.deepEqual(splitDrumFile(text).route, sheet.route);
});

test('valida', () => {
  const ok = { title: 'X', tempo: '', time: '', rhythms: [] };
  assert.equal(validateSheet({ ...ok, title: ' ' }), 'Falta el nombre de la canción.');
  assert.match(validateSheet({ ...ok, tempo: 'rápido' }), /tempo/);
  assert.match(validateSheet({ ...ok, time: '4-4' }), /compás/);
  assert.equal(validateSheet(ok), null);
});
