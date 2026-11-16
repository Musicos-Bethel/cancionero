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
    { title: 'Sublime gracia', artist: 'John Newton', key: 'G', tempo: '', time: '', tags: ['Himnos', 'Adoración', 'Lentas'], link: 'https://youtu.be/abc', body: '{c: Estrofa 1}\nSu[G]blime' },
  );
});

test('arma el archivo y lo lee igual', () => {
  const song = { title: 'Nueva {canción}', artist: '', key: 'D', tempo: '80', time: '4/4', tags: ['Alabanzas'], link: 'https://youtu.be/x', body: '' };
  const text = buildSongFile(song, '{c: Coro}\n[D]Santo');
  assert.equal(text, '{title: Nueva canción}\n{key: D}\n{tempo: 80}\n{time: 4/4}\n{tag: Alabanzas}\n{x_youtube: https://youtu.be/x}\n\n{c: Coro}\n[D]Santo\n');
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
