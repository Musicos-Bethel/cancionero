import { parseDirective, splitTags } from '../chordpro/parser.js';

/**
 * Hojas de batería en ChordPro. Todo es puro (sin navegador) para poder
 * probarlo. Una hoja es un archivo ChordPro normal, así que SongBook también
 * la abre (los ritmos se ven como tablatura):
 *
 *   {title: Castillo fuerte}
 *   {subtitle: Batería · marcha solemne}
 *   {tempo: 76}
 *   {time: 4/4}
 *
 *   {start_of_tab: Ritmo A · estrofas}
 *          1 . & . 2 . & . 3 . & . 4 . & .
 *   Ch   | x . x . x . x . x . x . x . x . |
 *   Caja | . . . . O . . . . . . . O . . . |
 *   Bom  | o . . . . . o . o . . . . . . . |
 *   {end_of_tab}
 *
 *   {c: Estrofa 1 · Ritmo A · 8 compases}
 *   {ci: Entrar suave}
 *
 * Celdas: «.» nada, «x» platos (charles, ride, crash), «o» tambores y bombo,
 * en mayúscula (X, O) con acento. Se respeta cualquier otra letra que ya
 * viniera en el archivo (por ejemplo «g» para nota fantasma).
 */

/** Instrumentos que se ofrecen, en el orden en que se colocan (platos arriba, bombo abajo). */
export const INSTRUMENTS = [
  { id: 'Plat', label: 'Plato (crash)' },
  { id: 'Ride', label: 'Ride' },
  { id: 'Ch', label: 'Charles' },
  { id: 'ChP', label: 'Charles con el pie' },
  { id: 'Tom1', label: 'Tom 1' },
  { id: 'Tom2', label: 'Tom 2' },
  { id: 'Caja', label: 'Caja' },
  { id: 'Aro', label: 'Aro (cross-stick)' },
  { id: 'Base', label: 'Tom base' },
  { id: 'Bom', label: 'Bombo' },
];

const CYMBAL = /^(ch|hh|hi-?hat|charles|ride|rd|plat|platillo|crash|cr|china|spl|splash|cym)/i;
const KNOWN = /^(ch|chp|hh|hi-?hat|charles|ride|rd|plat|platillo|crash|cr|china|spl|splash|cym|caja|sn|sd|snare|aro|rim|cs|tom|t[1-4]|tom ?[1-4]|base|ft|floor|bom|bombo|bd|kick|cencerro|cb|cow|pand|pandereta|tamb|shaker)/i;

export const isCymbal = (inst) => CYMBAL.test(String(inst).trim());
/** Etiqueta larga de un instrumento (para la ayuda y la accesibilidad). */
export const instrumentLabel = (inst) => INSTRUMENTS.find((i) => i.id.toLowerCase() === String(inst).trim().toLowerCase())?.label ?? inst;

/** Siguiente valor de una celda al tocarla: nada → golpe → acento → nada. */
export function cycleCell(cell, inst) {
  const [hit, accent] = isCymbal(inst) ? ['x', 'X'] : ['o', 'O'];
  if (cell === '.' || !cell) return hit;
  if (cell === hit || cell === hit.toLowerCase() || cell === (hit === 'x' ? 'o' : 'x')) return accent;
  return '.';
}

/** Línea de cuenta: «1 . & . 2 . & .» (semicorcheas), «1 & 2 &» (corcheas), «1 . . 2 . .» (tresillos). */
export function countLine(beats, spb) {
  const out = [];
  for (let b = 1; b <= beats; b++) {
    const t = [String(b), ...Array(Math.max(0, spb - 1)).fill('.')];
    if (spb % 2 === 0 && spb > 1) t[spb / 2] = '&';
    out.push(...t);
  }
  return out;
}

const ROW = /^\s*([^|]*?)\s*\|(.*)\|\s*$/;

/**
 * Lee la cuadrícula de un {start_of_tab}. Devuelve
 *   { beats, spb, rows: [{ inst, cells: [...] }] }
 * o null si no parece un ritmo de batería (por ejemplo, una tablatura de guitarra).
 */
export function parseGrid(lines) {
  const rows = [];
  let header = null;
  for (const raw of lines) {
    const line = String(raw).replace(/\t/g, '    ');
    if (!line.trim()) continue;
    const m = ROW.exec(line);
    if (!m) {
      if (header || rows.length) return null;
      header = line.trim().split(/\s+/);
      continue;
    }
    const inst = m[1].trim();
    const inner = m[2].trim();
    if (!inst) return null;
    const cells = (/\s/.test(inner) ? inner.split(/\s+/) : [...inner.replace(/\|/g, '')]).map((c) => (c === '-' ? '.' : c));
    if (!cells.length || cells.some((c) => c.length !== 1)) return null;
    rows.push({ inst, cells });
  }
  if (!rows.length) return null;
  const n = rows[0].cells.length;
  if (rows.some((r) => r.cells.length !== n)) return null;
  const labelsKnown = rows.every((r) => KNOWN.test(r.inst));
  const headerOk = header && header.length === n && /^1$/.test(header[0]);
  if (!labelsKnown && !headerOk) return null;
  if (rows.some((r) => r.cells.some((c) => !/[.xXoOgGfFrR]/.test(c)))) return null;

  const beats = header ? header.filter((t) => /^\d+$/.test(t)).length : 0;
  if (beats > 0 && n % beats === 0) return { beats, spb: n / beats, rows };
  if (n % 4 === 0) return { beats: n / 4, spb: 4, rows };
  return { beats: 1, spb: n, rows };
}

/** Texto de la cuadrícula (las líneas entre {start_of_tab} y {end_of_tab}). */
export function gridLines({ beats, spb, rows }) {
  const w = Math.max(4, ...rows.map((r) => r.inst.length)) + 1;
  const out = [' '.repeat(w + 2) + countLine(beats, spb).join(' ')];
  for (const r of rows) out.push(`${r.inst.padEnd(w)}| ${r.cells.join(' ')} |`);
  return out;
}

/** Cambia tiempos o subdivisión conservando los golpes que caen en el mismo sitio. */
export function resizeRhythm(rhythm, beats, spb) {
  const n = beats * spb;
  const rows = rhythm.rows.map((r) => {
    const cells = Array(n).fill('.');
    r.cells.forEach((c, i) => {
      const pos = (i / rhythm.spb) * spb; // posición en pasos nuevos
      if (Number.isInteger(pos) && pos < n) cells[pos] = c;
    });
    return { ...r, cells };
  });
  return { ...rhythm, beats, spb, rows };
}

/** Tiempos y subdivisión por defecto según el compás: 4/4 → 4 × corcheas; 6/8 → 2 × tresillos. */
export function defaultMeter(time) {
  const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(time ?? '');
  const num = m ? Number(m[1]) : 4;
  const den = m ? Number(m[2]) : 4;
  if (den === 8 && num % 3 === 0 && num >= 6) return { beats: num / 3, spb: 3 };
  if (den === 8) return { beats: num, spb: 1 };
  return { beats: Math.min(Math.max(num, 1), 8), spb: 2 };
}

export function newRhythm(name, time) {
  const { beats, spb } = defaultMeter(time);
  const n = beats * spb;
  const row = (inst, f) => ({ inst, cells: Array.from({ length: n }, (_, i) => f(i)) });
  return {
    name,
    beats,
    spb,
    rows: [
      row('Ch', () => 'x'),
      row('Caja', (i) => (beats >= 2 && i % (2 * spb) === spb ? 'o' : '.')),
      row('Bom', (i) => (i % (2 * spb) === 0 ? 'o' : '.')),
    ],
  };
}

/** Coloca un instrumento nuevo en su sitio (platos arriba, bombo abajo). */
export function insertRow(rhythm, inst) {
  const order = (x) => {
    const i = INSTRUMENTS.findIndex((p) => p.id.toLowerCase() === x.toLowerCase());
    return i < 0 ? INSTRUMENTS.length : i;
  };
  const rows = [...rhythm.rows];
  const row = { inst, cells: Array(rhythm.beats * rhythm.spb).fill('.') };
  let at = rows.findIndex((r) => order(r.inst) > order(inst));
  if (at < 0) at = rows.length;
  rows.splice(at, 0, row);
  return { ...rhythm, rows };
}

// ---------- Archivo completo

const HEAD = new Map([
  ['title', 'title'],
  ['subtitle', 'subtitle'],
  ['tempo', 'tempo'],
  ['time', 'time'],
]);
const TAG_NAMES = new Set(['tag', 'tags', 'category', 'categories', 'categoria', 'categorias', 'x_tag', 'x_tags', 'x_category', 'x_categories', 'x_sbp_tags', 'x_sbp_tag', 'x_spb_tag']);
const LINK_NAMES = new Set(['x_youtube', 'youtube', 'x_link', 'link', 'x_url', 'url', 'x_audio', 'audio']);
/** Directivas de cabecera que el editor no muestra pero conserva. */
const KEEP_HEAD = new Set(['artist', 'composer', 'key', 'capo', 'duration', 'copyright', 'year', 'album', 'lyricist']);

export const emptySheet = () => ({ title: '', subtitle: '', tempo: '', time: '', tags: [], link: '', extra: [], rhythms: [], route: [] });

const SEP = ' · ';

/**
 * Archivo → hoja: { title, subtitle, tempo, time, tags, link, extra, rhythms, route }.
 * route: [{ kind: 'section', title, detail, note }] o { kind: 'raw', text } para lo que
 * el editor no entiende (coros, tablaturas de otro tipo…), que se conserva tal cual.
 */
export function splitDrumFile(text) {
  const sheet = emptySheet();
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  let raw = [];
  let section = null; // sección abierta, a la que se le pueden añadir notas {ci:}
  const flushRaw = () => {
    while (raw.length && !raw[raw.length - 1].trim()) raw.pop();
    if (raw.length) sheet.route.push({ kind: 'raw', text: raw.join('\n') });
    raw = [];
  };
  const pushRaw = (...l) => {
    section = null;
    raw.push(...l);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const d = /^\s*\{/.test(line) ? parseDirective(line) : null;

    // Ritmos (y tablaturas que no son de batería, que se conservan)
    if (d && (d.name === 'start_of_tab' || d.name === 'start_of_grid')) {
      const end = `end_of_${d.name.slice(9)}`;
      let j = i + 1;
      while (j < lines.length && parseDirective(lines[j])?.name !== end) j++;
      const grid = d.name === 'start_of_tab' ? parseGrid(lines.slice(i + 1, j)) : null;
      if (grid) {
        flushRaw();
        section = null;
        sheet.rhythms.push({ name: d.value, ...grid });
      } else {
        pushRaw(...lines.slice(i, Math.min(j + 1, lines.length)));
      }
      i = j;
      continue;
    }

    const atHead = !raw.length && !sheet.route.length && !sheet.rhythms.length;
    if (d && HEAD.has(d.name) && !sheet[HEAD.get(d.name)]) {
      sheet[HEAD.get(d.name)] = d.value;
      continue;
    }
    if (d && TAG_NAMES.has(d.name)) {
      for (const t of splitTags(d.value)) if (!sheet.tags.includes(t)) sheet.tags.push(t);
      continue;
    }
    if (d && LINK_NAMES.has(d.name)) {
      sheet.link ||= d.value;
      continue;
    }
    if (d && (KEEP_HEAD.has(d.name) || (atHead && d.name.startsWith('x_')))) {
      sheet.extra.push(line.trim());
      continue;
    }
    if (!line.trim()) {
      if (raw.length) raw.push(line);
      continue;
    }
    if (d && d.name === 'comment') {
      flushRaw();
      const [title, ...rest] = d.value.split(SEP);
      section = { kind: 'section', title: title.trim(), detail: rest.join(SEP).trim(), note: '' };
      sheet.route.push(section);
      continue;
    }
    if (d && d.name === 'comment_italic' && section) {
      section.note = section.note ? `${section.note}\n${d.value}` : d.value;
      continue;
    }
    pushRaw(line);
  }
  flushRaw();
  return sheet;
}

const clean = (v) => String(v ?? '').replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();

/** Hoja → archivo ChordPro. */
export function buildDrumFile(sheet) {
  const out = [];
  const add = (name, value) => {
    const v = clean(value);
    if (v) out.push(`{${name}: ${v}}`);
  };
  add('title', sheet.title);
  add('subtitle', sheet.subtitle);
  add('tempo', sheet.tempo);
  add('time', sheet.time);
  for (const e of sheet.extra ?? []) out.push(e);
  for (const t of sheet.tags ?? []) add('tag', t);
  add('x_youtube', sheet.link);

  for (const r of sheet.rhythms ?? []) {
    out.push('');
    const name = clean(r.name);
    out.push(name ? `{start_of_tab: ${name}}` : '{start_of_tab}');
    out.push(...gridLines(r));
    out.push('{end_of_tab}');
  }

  for (const item of sheet.route ?? []) {
    out.push('');
    if (item.kind === 'raw') {
      out.push(String(item.text).replace(/\s+$/, ''));
    } else {
      const head = [clean(item.title) || 'Sección', clean(item.detail)].filter(Boolean).join(SEP);
      out.push(`{c: ${head}}`);
      for (const n of String(item.note ?? '').split('\n').map(clean).filter(Boolean)) out.push(`{ci: ${n}}`);
    }
  }
  return out.join('\n').replace(/^\n+/, '') + '\n';
}

/** Error de validación o null. */
export function validateSheet(sheet) {
  if (!sheet.title.trim()) return 'Falta el nombre de la canción.';
  if (sheet.tempo && !/^\d{2,3}$/.test(String(sheet.tempo).trim())) return 'El tempo debe ser un número (por ejemplo, 76).';
  if (sheet.time && !/^\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/.test(sheet.time)) return 'El compás se escribe así: 4/4, 3/4, 6/8…';
  if (sheet.rhythms.some((r) => !r.rows.length)) return 'Cada ritmo necesita al menos un instrumento.';
  return null;
}
