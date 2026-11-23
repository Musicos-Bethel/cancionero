import { h } from '../ui/dom.js';
import { parseGrid, countLine, instrumentLabel } from '../drums/drum-sheet.js';

/**
 * Pinta un documento ChordPro. Cada línea se divide en "palabras" que no se
 * parten al saltar de línea; dentro de cada palabra, cada trozo lleva su acorde
 * encima. Así la letra se adapta a pantallas estrechas sin separar el acorde
 * de su sílaba.
 *
 * @param {object} doc     resultado de parseChordPro
 * @param {object} o
 * @param {(c:string)=>string} o.chord  transforma cada acorde (transponer/notación)
 */
export function renderSong(doc, { chord = (c) => c } = {}) {
  const root = h('div.song');
  for (const block of doc.blocks) {
    const el = h(`section.block.block-${block.type}`);
    if (block.label && block.type !== 'none') el.append(h('div.block-label', block.label));
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
  return root;
}

function renderLine(line, chord) {
  if (line.type === 'comment') return h(`div.comment.comment-${line.style}`, line.text);
  if (line.type === 'chorusRef') return h('div.chorus-ref', line.label);
  if (line.type !== 'lyrics') return h('div');

  const hasChords = line.segments.some((s) => s.chord);
  const hasText = line.segments.some((s) => s.text.trim());
  const cls = ['line', hasChords ? 'has-chords' : 'no-chords', hasText ? '' : 'chords-only'].filter(Boolean).join('.');
  const el = h(`div.${cls}`);

  // Trocea en palabras: los espacios separan palabras; un acorde a mitad de
  // palabra se queda en la misma palabra.
  let word = null;
  const flushWord = () => {
    if (word) el.append(word);
    word = null;
  };
  for (const seg of line.segments) {
    const pieces = seg.text.split(/(\s+)/);
    let first = true;
    for (const piece of pieces) {
      if (/^\s+$/.test(piece)) {
        // El espacio pertenece al trozo anterior para que el acorde de una
        // palabra corta ("[G]a [D]ti") no se pegue al siguiente.
        if (first && seg.chord) {
          word ??= h('span.w');
          word.append(chunk(seg, ' ', chord));
          first = false;
        }
        flushWord();
        el.append(' ');
        continue;
      }
      if (!piece && !(first && seg.chord)) continue;
      word ??= h('span.w');
      word.lastChild?.classList.add('join');
      word.append(chunk(first ? seg : { chord: null }, piece, chord));
      first = false;
    }
    if (first && seg.chord) {
      word ??= h('span.w');
      word.lastChild?.classList.add('join');
      word.append(chunk(seg, '', chord));
    }
  }
  flushWord();
  return el;
}

function chunk(seg, text, chord) {
  const c = seg.chord ? (seg.annotation ? seg.chord : chord(seg.chord)) : '';
  return h(
    seg.chord ? 'span.c.has-chord' : 'span.c',
    seg.chord ? h(seg.annotation ? 'span.ch.annotation' : 'span.ch', c) : null,
    h('span.ly', text || (seg.chord ? '​' : '')),
  );
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
