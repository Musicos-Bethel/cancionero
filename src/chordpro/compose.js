import { parseDirective, parseLyricsLine, splitTags } from './parser.js';
import { plainToChordPro, SECTION_HEADER } from './txt-import.js';

/**
 * Editor de canciones: pasa de un archivo ChordPro a los campos del formulario
 * y al texto «acordes encima de la letra», y vuelta. Todo es puro para poder
 * probarlo sin navegador.
 */

/** Campos del formulario y la directiva con la que se guardan. */
export const FIELDS = [
  ['title', 'title'],
  ['artist', 'artist'],
  ['key', 'key'],
  ['tempo', 'tempo'],
  ['time', 'time'],
];
const FIELD_NAMES = new Map([
  ['title', 'title'],
  ['artist', 'artist'],
  ['composer', 'artist'],
  ['key', 'key'],
  ['tempo', 'tempo'],
  ['time', 'time'],
]);
const TAG_NAMES = new Set(['tag', 'tags', 'category', 'categories', 'categoria', 'categorias', 'x_tag', 'x_tags', 'x_category', 'x_categories', 'x_sbp_tags', 'x_sbp_tag', 'x_spb_tag']);
const LINK_NAMES = new Set(['x_youtube', 'youtube', 'x_link', 'link', 'x_url', 'url', 'x_audio', 'audio']);

export const emptySong = () => ({ title: '', artist: '', key: '', tempo: '', time: '', tags: [], link: '', body: '' });

/**
 * Separa un archivo ChordPro en campos ({title, artist, key, tempo, time, tags,
 * link}) y cuerpo (el resto, en ChordPro, tal cual).
 */
export function splitSongFile(text) {
  const song = emptySong();
  const body = [];
  for (const line of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const d = /^\s*\{/.test(line) ? parseDirective(line) : null;
    if (d && FIELD_NAMES.has(d.name)) {
      const k = FIELD_NAMES.get(d.name);
      if (!song[k]) song[k] = d.value;
      continue;
    }
    if (d && TAG_NAMES.has(d.name)) {
      for (const t of splitTags(d.value)) if (!song.tags.includes(t)) song.tags.push(t);
      continue;
    }
    if (d && LINK_NAMES.has(d.name)) {
      song.link ||= d.value;
      continue;
    }
    body.push(line);
  }
  while (body.length && !body[0].trim()) body.shift();
  while (body.length && !body[body.length - 1].trim()) body.pop();
  song.body = body.join('\n');
  return song;
}

/** Arma el archivo ChordPro a partir de los campos y el cuerpo (en ChordPro). */
export function buildSongFile(song, bodyChordPro) {
  const head = [];
  const add = (name, value) => {
    const v = String(value ?? '').replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();
    if (v) head.push(`{${name}: ${v}}`);
  };
  for (const [k, name] of FIELDS) add(name, song[k]);
  for (const t of song.tags ?? []) add('tag', t);
  add('x_youtube', song.link);
  const body = String(bodyChordPro ?? '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  return head.join('\n') + (body ? '\n\n' + body : '') + '\n';
}

/**
 * ChordPro → «acordes encima de la letra». Las directivas se quedan como están
 * salvo los títulos de sección ({c: Coro} → «Coro»); las líneas con solo
 * acordes se dejan entre corchetes para que no se peguen a la letra siguiente.
 * Las dos formas se pueden mezclar: «Escribir» acepta también [acordes] en la letra.
 */
export function chordProToPlain(body) {
  const out = [];
  let raw = false; // dentro de {start_of_tab}/{start_of_grid}
  for (const line of String(body ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const d = /^\s*\{/.test(line) ? parseDirective(line) : null;
    if (d) {
      if (/^start_of_(tab|grid)/.test(d.name)) raw = true;
      if (/^end_of_(tab|grid)/.test(d.name)) raw = false;
      if (d.name === 'comment' && SECTION_HEADER.test(d.value) && !/[{}]/.test(d.value)) out.push(d.value);
      else out.push(line.trim());
      continue;
    }
    if (raw || !line.includes('[')) {
      out.push(line);
      continue;
    }
    const segs = parseLyricsLine(line);
    if (segs.some((s) => s.annotation)) {
      out.push(line); // [*anotaciones]: se dejan en ChordPro
      continue;
    }
    const lyric = segs.map((s) => s.text).join('');
    if (!lyric.trim()) {
      out.push(line.trim());
      continue;
    }
    // Si dos acordes no caben encima de su sílaba (van muy juntos), la línea
    // se deja en ChordPro: moverlos cambiaría dónde caen.
    let chords = '';
    let col = 0;
    let fits = true;
    for (const s of segs) {
      if (s.chord) {
        if (chords.length && chords.length + 1 > col) fits = false;
        chords = chords.padEnd(col, ' ') + s.chord;
      }
      col += s.text.length;
    }
    if (fits) out.push(chords, lyric.replace(/\s+$/, ''));
    else out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n');
}

/** «Acordes encima de la letra» (con directivas si las hay) → ChordPro. */
export const plainToBody = (plain) => plainToChordPro(plain);

/** Error de validación del formulario o null. */
export function validateSong(song) {
  if (!song.title.trim()) return 'Falta el título.';
  if (song.link && !/^https?:\/\//i.test(song.link.trim())) return 'El enlace debe empezar por https://';
  return null;
}
