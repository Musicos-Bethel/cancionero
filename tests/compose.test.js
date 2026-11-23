import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitSongFile, buildSongFile, chordProToPlain, plainToBody, validateSong } from '../src/chordpro/compose.js';
import { parseChordPro } from '../src/chordpro/parser.js';
import { songMeta } from '../src/chordpro/song-doc.js';

test('separa campos y cuerpo', () => {
  const s = splitSongFile('{title: Sublime gracia}\n{artist: John Newton}\n{key: G}\n{tag: Himnos}\n{tag: Adoración, Lentas}\n{x_youtube: https://youtu.be/abc}\n\n{c: Estrofa 1}\nSu[G]blime');
  assert.deepEqual(
    { ...s },
    { title: 'Sublime gracia', artist: 'John Newton', artistTag: 'artist', key: 'G', tempo: '', tempoTag: 'metronome', time: '', duration: '', tags: ['Himnos', 'Adoración', 'Lentas'], link: 'https://youtu.be/abc', body: '{c: Estrofa 1}\nSu[G]blime' },
  );
});

test('arma el archivo y lo lee igual', () => {
  const song = { title: 'Nueva {canción}', artist: '', key: 'D', tempo: '80', time: '4/4', tags: ['Alabanzas'], link: 'https://youtu.be/x', body: '' };
  const text = buildSongFile(song, '{c: Coro}\n[D]Santo');
  assert.equal(text, '{title: Nueva canción}\n{key: D}\n{metronome: 80}\n{time: 4/4}\n{tag: Alabanzas}\n{x_youtube: https://youtu.be/x}\n\n{c: Coro}\n[D]Santo\n');
  const meta = songMeta(text, 'cho');
  assert.equal(meta.key, 'D');
  assert.deepEqual(meta.tags, ['Alabanzas']);
  assert.equal(meta.link, 'https://youtu.be/x');
});

test('acordes encima de la letra → ChordPro', () => {
  const plain = 'Estrofa 1\nC        G         Am\nCastillo fuerte es nuestro Dios\n\nCoro:\nD   A   D\n{ci: tocar suave}';
  assert.equal(plainToBody(plain), '{c: Estrofa 1}\n[C]Castillo [G]fuerte es [Am]nuestro Dios\n\n{c: Coro}\n[D]   [A]   [D]\n{ci: tocar suave}');
});

test('ChordPro → acordes encima y vuelta sin perder nada', () => {
  const files = ['Voces/Castillo fuerte.cho', 'Voces/Amazing Grace.chordpro', 'Bateria/Castillo fuerte.cho', 'Metales/Trompeta/Castillo fuerte.cho', 'Voces/Navidad/Noche de paz.cho'];
  for (const f of files) {
    const text = readFileSync('public/demo/Cancionero/' + f, 'utf8');
    const { body, ...fields } = splitSongFile(text);
    const back = plainToBody(chordProToPlain(body));
    const a = parseChordPro(body);
    const b = parseChordPro(back);
    assert.deepEqual(b.blocks, a.blocks, f);
    assert.deepEqual(splitSongFile(buildSongFile(fields, back)).title, fields.title);
  }
});

test('alinea los acordes con la letra', () => {
  assert.equal(chordProToPlain('A[G]mazing [G7]grace!'), ' G      G7\nAmazing grace!');
  assert.equal(chordProToPlain('[A] [E] [F#m]'), '[A] [E] [F#m]');
  assert.equal(chordProToPlain('{c: Coro}\n{c: Intro · 4 compases}'), 'Coro\nIntro · 4 compases');
});

test('valida', () => {
  assert.equal(validateSong({ title: ' ', link: '' }), 'Falta el título.');
  assert.equal(validateSong({ title: 'X', link: 'youtu.be/x' }), 'El enlace debe empezar por https://');
  assert.equal(validateSong({ title: 'X', link: '' }), null);
});

test('SongBook: {metronome} es el tempo y {time: m:ss} la duración', () => {
  const s = splitSongFile('{title: X}\n{subtitle: Autor}\n{musicpath:/storage/x.mp3}\n{time:6:58}\n{metronome:136}\n\n[A]Hola');
  assert.equal(s.tempo, '136');
  assert.equal(s.artist, 'Autor');
  assert.equal(s.tempoTag, 'metronome');
  assert.equal(s.time, '');
  assert.equal(s.duration, '6:58');
  assert.match(s.body, /musicpath/); // lo que el formulario no entiende se queda
  const text = buildSongFile(s, s.body);
  assert.match(text, /\{subtitle: Autor\}\n\{metronome: 136\}\n\{time: 6:58\}/);
  const meta = parseChordPro(text).meta;
  assert.equal(meta.tempo, '136');
  assert.equal(meta.duration, '6:58');
  // Si el archivo usaba {tempo}, se respeta
  const t = splitSongFile('{tempo: 72}\n{time: 3/4}');
  assert.equal(t.tempoTag, 'tempo');
  assert.equal(t.time, '3/4');
  assert.match(buildSongFile(t, ''), /\{tempo: 72\}\n\{time: 3\/4\}/);
  assert.equal(validateSong({ title: 'X', link: '', time: '5:28' }), 'El compás se escribe como 4/4 (4:30 iría en Duración).');
});
