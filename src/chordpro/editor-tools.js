import { parseChord, parseKey, keyPrefersFlats, noteName } from '../music/chords.js';

/**
 * Herramientas del editor de ChordPro (como el de SongBook): acordes de la
 * canción, acordes de la tonalidad, insertar códigos y colorear el texto.
 * Todo es puro (sin navegador) para poder probarlo.
 */

const RAW_START = /^\s*\{\s*(start_of_tab|sot|start_of_grid|sog)\b/i;
const RAW_END = /^\s*\{\s*(end_of_tab|eot|end_of_grid|eog)\b/i;

/** Acordes usados en la canción, en el orden en que aparecen y sin repetir. */
export function songChords(body) {
  const out = [];
  const seen = new Set();
  let raw = false;
  for (const line of String(body ?? '').split('\n')) {
    if (RAW_START.test(line)) raw = true;
    if (RAW_END.test(line)) raw = false;
    if (raw) continue;
    for (const m of line.matchAll(/\[([^\]]+)\]/g)) {
      const c = m[1].trim();
      if (!c || c.startsWith('*') || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/**
 * Acordes de la tonalidad: I ii iii IV V vi (mayor) o i III iv v V VI VII
 * (menor). Sirve de punto de partida cuando la canción aún no tiene acordes.
 */
export function keyChords(keyText, notation = 'american') {
  const key = parseKey(keyText);
  if (!key) return [];
  const spelling = keyPrefersFlats(key) ? 'flat' : 'sharp';
  const steps = key.minor
    ? [[0, 'm'], [3, ''], [5, 'm'], [7, 'm'], [7, ''], [8, ''], [10, '']]
    : [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm']];
  return steps.map(([i, q]) => noteName(key.pc + i, { spelling, notation }) + q);
}

/** ¿Es un acorde que se puede escribir entre corchetes? */
export const validChord = (text) => !!parseChord(String(text ?? '').trim()) && !/[[\]{}]/.test(text);

/**
 * Rodea las líneas seleccionadas con un par de códigos (p. ej. {soc} y {eoc}).
 * Sin selección, inserta el par vacío en la línea del cursor y lo deja dentro.
 * Devuelve { text, start, end } con la nueva posición del cursor.
 */
export function wrapLines(text, start, end, open, close) {
  const s = String(text);
  const lineStart = s.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = s.indexOf('\n', end > start && s[end - 1] === '\n' ? end - 1 : end);
  if (lineEnd < 0) lineEnd = s.length;
  const inner = s.slice(lineStart, lineEnd);
  if (!inner.trim()) {
    const ins = `${open}\n\n${close}`;
    const t = s.slice(0, lineStart) + ins + s.slice(lineEnd);
    const pos = lineStart + open.length + 1;
    return { text: t, start: pos, end: pos };
  }
  const block = `${open}\n${inner}\n${close}`;
  const t = s.slice(0, lineStart) + block + s.slice(lineEnd);
  // El cursor queda al final del bloque (sin selección: un acorde no lo borra).
  const pos = lineStart + block.length;
  return { text: t, start: pos, end: pos };
}

/**
 * Inserta una línea propia (p. ej. «{c: Coro}») antes de la línea del cursor,
 * o en ella si está vacía. Devuelve { text, start, end }.
 */
export function insertLine(text, pos, line) {
  const s = String(text);
  const lineStart = s.lastIndexOf('\n', pos - 1) + 1;
  let lineEnd = s.indexOf('\n', pos);
  if (lineEnd < 0) lineEnd = s.length;
  const current = s.slice(lineStart, lineEnd);
  if (!current.trim()) {
    const t = s.slice(0, lineStart) + line + s.slice(lineEnd);
    const p = lineStart + line.length;
    return { text: t, start: p, end: p };
  }
  const t = s.slice(0, lineStart) + line + '\n' + s.slice(lineStart);
  const p = lineStart + line.length;
  return { text: t, start: p, end: p };
}

const COMMENT_NAMES = /^(c|comment|ci|comment_italic|cb|comment_box|highlight)$/i;
const LABEL_NAMES = /^(soc|start_of_chorus|sov|start_of_verse|sob|start_of_bridge|title|t|subtitle|st)$/i;

/**
 * Trocea el texto en fragmentos con clase para colorearlo:
 * 'dir' (códigos), 'label' (texto de un comentario o sección), 'chord',
 * 'hl' (entre {soh} y {eoh}) o '' (letra). Devuelve una lista de [clase, texto]
 * que, unida, es exactamente el texto original.
 */
export function highlightTokens(text) {
  const out = [];
  const push = (cls, t) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last[0] === cls) last[1] += t;
    else out.push([cls, t]);
  };
  let raw = false;
  const lines = String(text ?? '').split('\n');
  lines.forEach((line, i) => {
    if (RAW_START.test(line)) raw = true;
    let hl = false;
    let last = 0;
    for (const m of line.matchAll(/\{[^{}]*\}|\[[^\][]*\]/g)) {
      push(hl ? 'hl' : '', line.slice(last, m.index));
      last = m.index + m[0].length;
      const tok = m[0];
      if (tok[0] === '[') {
        push(raw ? '' : 'chord', tok);
        continue;
      }
      const inner = /^\{\s*([^:\s}]+)\s*(:?)([\s\S]*)\}$/.exec(tok);
      const name = inner?.[1] ?? '';
      if (/^(soh|start_of_highlight)$/i.test(name)) hl = true;
      if (/^(eoh|end_of_highlight)$/i.test(name)) {
        push('dir', tok);
        hl = false;
        continue;
      }
      if (inner && inner[2] && (COMMENT_NAMES.test(name) || LABEL_NAMES.test(name)) && inner[3].trim()) {
        const head = tok.length - inner[3].length - 1;
        push('dir', tok.slice(0, head));
        push('label', inner[3]);
        push('dir', '}');
      } else push('dir', tok);
    }
    push(hl ? 'hl' : '', line.slice(last));
    if (RAW_END.test(line)) raw = false;
    if (i < lines.length - 1) push('', '\n');
  });
  return out;
}

/** Secciones habituales para el botón «Sección». */
export const SECTION_NAMES = ['Intro', 'Estrofa', 'Pre-coro', 'Coro', 'Puente', 'Interludio', 'Solo', 'Final'];
