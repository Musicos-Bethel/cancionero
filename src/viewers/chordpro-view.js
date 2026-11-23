import { h } from '../ui/dom.js';
import { parseGrid, countLine, instrumentLabel } from '../drums/drum-sheet.js';

/**
 * Pinta un documento ChordPro al estilo de SongBook:
 * - Cada acorde va encima de su sílaba y puede sobresalir por encima de la
 *   letra siguiente: solo se abre hueco en la letra cuando choca con el
 *   acorde de al lado (lo calcula layoutChords tras pintar).
 * - Las palabras no se parten al saltar de línea, así la letra se adapta a
 *   pantallas estrechas sin separar el acorde de su sílaba.
 * - Las líneas solo de acordes (intros, solos) van en una fila.
 * - {soh}2x{eoh} se ve como una etiqueta resaltada.
 *
 * @param {object} doc     resultado de parseChordPro
 * @param {object} o
 * @param {(c:string)=>string} o.chord  transforma cada acorde (transponer/notación)
 */
export function renderSong(doc, { chord = (c) => c } = {}) {
  const root = h('div.song');
  for (const block of doc.blocks) {
    const el = h(`section.block.block-${block.type}`);
    if (block.label && block.type !== 'none') el.append(h('div.block-label', ...partsNodes(block.labelParts, block.label)));
    if (block.type === 'tab' || block.type === 'grid') {
      const grid = block.type === 'tab' ? parseGrid(block.lines.map((l) => l.text)) : null;
      el.append(grid ? renderDrumGrid(grid) : h('pre.tab-block', block.lines.map((l) => l.text).join('\n')));
    } else {
      let emptyRun = 0;
      for (const line of block.lines) {
        if (line.type === 'empty') {
          if (emptyRun++ === 0) el.append(h('div.gap'));
          continue;
        }
        emptyRun = 0;
        el.append(renderLine(line, chord));
      }
    }
    root.append(el);
  }
  watchChordLayout(root);
  return root;
}

/** Texto con trozos resaltados ({soh}…{eoh}). */
function partsNodes(parts, text) {
  if (!parts?.length) return [text];
  const out = [];
  parts.forEach((p, i) => {
    if (i) out.push(' ');
    out.push(p.hl ? h('span.hl', p.text) : p.text);
  });
  return out;
}

/**
 * Un acorde escrito justo antes de un espacio («abre [Si/Mi] mis») se pasa a
 * la palabra siguiente, que es donde se toca. Así no queda un hueco entre
 * palabras con el acorde flotando encima.
 */
export function normalizeSegments(segments) {
  const out = segments.map((s) => ({ ...s }));
  for (let i = 0; i < out.length; i++) {
    const s = out[i];
    const m = s.chord ? /^(\s+)(?=\S)/.exec(s.text) : null;
    if (!m) continue;
    if (i > 0) out[i - 1].text += m[1];
    else out.splice(i++, 0, { chord: null, text: m[1] });
    out[i].text = out[i].text.slice(m[1].length);
  }
  return out;
}

function renderLine(line, chord) {
  if (line.type === 'comment') return h(`div.comment.comment-${line.style}`, ...partsNodes(line.parts, line.text));
  if (line.type === 'chorusRef') return h('div.chorus-ref', line.label);
  if (line.type !== 'lyrics') return h('div');

  const hasChords = line.segments.some((s) => s.chord);
  const hasText = line.segments.some((s) => s.text.trim());
  if (hasChords && !hasText) return renderChordRow(line, chord);
  const cls = ['line', hasChords ? 'has-chords' : 'no-chords'].join('.');
  const el = h(`div.${cls}`);

  // Trocea en palabras: los espacios separan palabras; un acorde a mitad de
  // palabra se queda en la misma palabra.
  let word = null;
  const flushWord = () => {
    if (word) el.append(word);
    word = null;
  };
  const add = (seg, text) => {
    word ??= h('span.w');
    word.lastChild?.classList.add('join');
    word.append(chunk(seg, text, chord));
  };
  for (const seg of normalizeSegments(line.segments)) {
    const pieces = seg.text.split(/(\s+)/);
    let first = true;
    for (const piece of pieces) {
      if (/^\s+$/.test(piece)) {
        // Un acorde sobre un espacio (al final de la línea, o entre acordes
        // seguidos) se queda pegado a lo anterior.
        if (first && seg.chord) add(seg, '');
        first = false;
        flushWord();
        el.append(' ');
        continue;
      }
      if (!piece && !(first && seg.chord)) continue;
      add(first ? seg : { chord: null, hl: seg.hl }, piece);
      first = false;
    }
    if (first && seg.chord) add(seg, '');
  }
  flushWord();
  return el;
}

/** Línea solo de acordes (intro, solo…): todos en una fila, separados por sus espacios. */
function renderChordRow(line, chord) {
  const el = h('div.line.chord-row');
  for (const seg of line.segments) {
    if (seg.chord) el.append(h(seg.annotation ? 'span.ch.annotation' : 'span.ch', seg.annotation ? seg.chord : chord(seg.chord)));
    if (seg.hl && seg.text.trim()) el.append(h('span.hl', seg.text.trim()));
    // Muchos espacios en el archivo = más separación (como en SongBook).
    const n = seg.text.length;
    if (n >= 3) el.append(h('span.sp.wide'));
    else if (seg.chord && n >= 1) el.append(h('span.sp'));
  }
  return el;
}

function chunk(seg, text, chord) {
  const c = seg.chord ? (seg.annotation ? seg.chord : chord(seg.chord)) : '';
  const cls = ['c', seg.chord ? 'has-chord' : '', seg.chord && !text ? 'bare' : '', seg.hl ? 'hl-text' : ''].filter(Boolean).join('.');
  return h(
    `span.${cls}`,
    seg.chord ? h(seg.annotation ? 'span.ch.annotation' : 'span.ch', c) : null,
    h('span.ly', text || (seg.chord ? '\u200b' : '')),
  );
}

/**
 * Coloca los acordes para que no se monten: recorre cada línea y, si un acorde
 * choca con el anterior de la misma fila, empuja su sílaba (y él con ella) lo
 * justo. Se repite al cambiar el ancho, el tamaño de letra o «Solo letra».
 */
export function layoutChords(root) {
  const lines = [...root.querySelectorAll('.line.has-chords')];
  if (!lines.length) return;
  const gap = parseFloat(getComputedStyle(root).fontSize) * 0.4;
  const chunksOf = (line) => [...line.querySelectorAll('.c.has-chord')];
  // 1) Quitar los empujes anteriores (todo de una vez, una sola maquetación).
  for (const line of lines) {
    for (const c of chunksOf(line)) {
      c.style.paddingLeft = '';
      c.style.removeProperty('--pl');
      c.classList.remove('pushed');
    }
  }
  // 2) Dos pasadas: medir y empujar; la segunda corrige lo que haya cambiado
  //    de fila al empujar.
  for (let pass = 0; pass < 2; pass++) {
    const plan = [];
    for (const line of lines) {
      let prevRight = -Infinity;
      let rowTop = null;
      let shift = 0;
      for (const el of chunksOf(line)) {
        const ch = el.firstChild;
        const r = ch.getBoundingClientRect();
        const top = Math.round(el.getBoundingClientRect().bottom);
        if (rowTop === null || Math.abs(top - rowTop) > 3) {
          rowTop = top;
          prevRight = -Infinity;
          shift = 0;
        }
        const left = r.left + shift;
        const need = prevRight + gap - left;
        const push = need > 0.5 ? need : 0;
        if (push) {
          plan.push([el, push]);
          shift += push;
        }
        prevRight = left + push + r.width;
      }
    }
    for (const [el, need] of plan) {
      const cur = parseFloat(el.style.paddingLeft) || 0;
      el.style.paddingLeft = `${cur + need}px`;
      el.style.setProperty('--pl', `${cur + need}px`);
      // A mitad de palabra se dibuja una rayita en el hueco (ho — ra).
      if (!el.classList.contains('bare') && el.previousElementSibling?.classList.contains('c')) el.classList.add('pushed');
    }
    if (!plan.length) break;
  }
  // 3) Si la línea se parte y una fila no lleva acordes, sin hueco encima.
  const rows = [];
  for (const line of lines) for (const c of line.querySelectorAll('.c.no-chord-row')) c.classList.remove('no-chord-row');
  for (const line of lines) {
    const byRow = new Map();
    for (const c of line.querySelectorAll('.c')) {
      const k = Math.round(c.getBoundingClientRect().bottom);
      const row = [...byRow.keys()].find((x) => Math.abs(x - k) <= 3) ?? k;
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row).push(c);
    }
    if (byRow.size > 1) rows.push(...byRow.values());
  }
  for (const row of rows) if (!row.some((c) => c.classList.contains('has-chord'))) for (const c of row) c.classList.add('no-chord-row');
}

/** Repite layoutChords cuando cambian el ancho, la letra o el modo «Solo letra». */
function watchChordLayout(root) {
  if (typeof ResizeObserver === 'undefined') return;
  let key = '';
  let raf = 0;
  const ro = new ResizeObserver(() => {
    if (!root.isConnected) {
      ro.disconnect();
      return;
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const k = `${root.clientWidth}|${getComputedStyle(root).fontSize}|${root.closest('.lyrics-only') ? 1 : 0}`;
      if (k === key) return;
      key = k;
      layoutChords(root);
    });
  });
  ro.observe(root);
}

/**
 * Ritmo de batería como cuadrícula: una fila por instrumento y una columna por
 * paso, con la cuenta arriba. Platos con ×, tambores con un punto relleno; los
 * acentos, más grandes y en dorado.
 */
export function renderDrumGrid({ beats, spb, rows }) {
  const n = beats * spb;
  const grid = h('div.drum-grid', { role: 'table', style: `--steps: ${n}`, 'aria-label': 'Ritmo' });
  const beatCls = (i) => (i % spb === 0 ? '.beat' : '') + (i % spb === 0 && i ? '.sep' : '');
  grid.append(
    h('span.dg-label', { role: 'columnheader' }),
    ...countLine(beats, spb).map((t, i) => h(`span.dg-count${beatCls(i)}${/^\d+$/.test(t) ? '.num' : ''}`, { role: 'columnheader' }, t === '.' ? '' : t)),
  );
  for (const r of rows) {
    grid.append(h('span.dg-label', { role: 'rowheader', title: instrumentLabel(r.inst) }, r.inst));
    r.cells.forEach((c, i) => {
      const kind = c === '.' ? 'rest' : c === 'X' || c === 'O' ? 'acc' : c === 'x' || c === 'o' ? 'hit' : 'other';
      const shape = kind === 'rest' || kind === 'other' ? '' : c.toLowerCase() === 'x' ? '.cym' : '.drum';
      grid.append(h(`span.dg-cell.${kind}${shape}${beatCls(i)}`, { role: 'cell' }, kind === 'other' ? c : h('i')));
    });
  }
  return h('div.drum-grid-wrap', grid);
}
