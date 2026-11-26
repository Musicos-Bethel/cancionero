import { h } from './dom.js';
import { icon } from './icons.js';
import { state, setSettings } from '../state.js';
import { SECTION_SHORT, SECTIONS, isMetal } from '../library/library.js';
import { longDate, relativeDay, plural, shortDate } from './format.js';
import { BRAND } from '../config.js';
import { parseKey } from '../music/chords.js';
import { keyName } from '../music/transpose.js';

/** Sostenidos y bemoles tipográficos para mostrar tonalidades: «Mib» → «Mi♭». */
export function prettyKey(name) {
  return String(name ?? '').replace(/^([A-G]|Do|Re|Mi|Fa|Sol|La|Si)([#b])/, (_m, n, a) => n + (a === '#' ? '♯' : '♭'));
}

/** Tonalidad en la notación elegida ("Re" → "D" si se usa la americana), con ♯/♭. */
export function displayKey(k) {
  const key = k ? parseKey(k) : null;
  return key ? prettyKey(keyName(key, 0, state.settings.notation)) : k || '';
}

export const link = (path) => '#' + path;

/**
 * Selector de sección compacto para la barra superior: un botón «Voces ⌄» que
 * abre un menú (Voces, Batería, Saxofón, Trompeta). Ocupa una sola línea en
 * lugar del control segmentado bajo el título.
 */
export function sectionPicker() {
  const current = state.settings.section;
  const btn = h(
    'button.glass-btn.section-pick',
    { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': `Sección: ${SECTION_SHORT[current]}. Cambiar` },
    h('span', SECTION_SHORT[current]),
    icon('chevDown', { size: 16 }),
  );
  btn.onclick = () => (btn.getAttribute('aria-expanded') === 'true' ? closePicker() : openPicker(btn, current));
  return btn;
}

let openMenu = null;
function closePicker() {
  if (!openMenu) return;
  const { menu, btn, off } = openMenu;
  openMenu = null;
  off();
  menu.remove();
  btn.setAttribute('aria-expanded', 'false');
}
function openPicker(btn, current) {
  closePicker();
  const choose = (id) => {
    closePicker();
    if (id !== current) setSettings(isMetal(id) ? { section: id, metal: id } : { section: id });
  };
  const menu = h(
    'div.pick-menu',
    { role: 'menu', 'aria-label': 'Sección' },
    SECTIONS.map((id) =>
      h(
        'button.pick-item',
        { type: 'button', role: 'menuitemradio', 'aria-checked': String(id === current), onclick: () => choose(id) },
        h('span', SECTION_SHORT[id]),
        id === current ? icon('check', { size: 18 }) : null,
      ),
    ),
  );
  const r = btn.getBoundingClientRect();
  menu.style.top = `${Math.round(r.bottom + 8)}px`;
  menu.style.right = `${Math.max(8, Math.round(document.documentElement.clientWidth - r.right))}px`;
  document.body.append(menu);
  btn.setAttribute('aria-expanded', 'true');
  const outside = (e) => !menu.contains(e.target) && !btn.contains(e.target) && closePicker();
  const key = (e) => e.key === 'Escape' && (closePicker(), btn.focus());
  const later = setTimeout(() => document.addEventListener('pointerdown', outside, true));
  document.addEventListener('keydown', key);
  window.addEventListener('hashchange', closePicker);
  window.addEventListener('scroll', closePicker, { passive: true });
  openMenu = {
    menu,
    btn,
    off: () => {
      clearTimeout(later);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('hashchange', closePicker);
      window.removeEventListener('scroll', closePicker);
    },
  };
  menu.querySelector('[aria-checked="true"]')?.focus();
}

export function brandMark() {
  return h(
    'a.brand',
    { href: link('/'), 'aria-label': `${BRAND.name} · Inicio` },
    BRAND.logo
      ? h('span.brand-logo', { role: 'img', 'aria-label': BRAND.name, style: `--logo: url("${BRAND.logo}"); --logo-ratio: ${BRAND.logoRatio ?? 1}` })
      : h('span.brand-name', BRAND.name),
  );
}

const KIND_BADGE = { pdf: 'PDF', image: 'IMG', imageset: 'IMG' };

export function songRow(song, { href, number, keyLabel, note, warn } = {}) {
  return h(
    'a.row.song-row',
    { href },
    number != null ? h('span.row-num', String(number)) : null,
    h(
      'span.row-main',
      h('span.row-title', song ? song.title : '—'),
      song?.artist || note || warn
        ? h(
            'span.row-sub',
            warn ? h('span.warn', icon('alert', { size: 14 }), warn) : null,
            song?.artist ? h('span', song.artist) : null,
            note ? h('span.note', note) : null,
          )
        : null,
    ),
    h(
      'span.row-end',
      song && KIND_BADGE[song.kind] ? h('span.kind', KIND_BADGE[song.kind]) : null,
      song?.origin === 'local' ? h('span.kind', 'Local') : null,
      keyLabel ? h('span.key-text', keyLabel) : null,
      href ? icon('next', { size: 16, cls: 'icon chev' }) : null,
    ),
  );
}

export function listCard(list, { featured = false } = {}) {
  const rel = relativeDay(list.date);
  return h(
    `a.card.list-card${featured ? '.featured' : ''}`,
    { href: link('/lista/' + encodeURIComponent(list.id)) },
    h(
      'div.date-badge',
      list.date ? [h('span.m', shortDate(list.date).split(' ')[1] ?? ''), h('span.d', list.date.slice(8, 10).replace(/^0/, ''))] : icon('calendar', { size: 20 }),
    ),
    h(
      'div.card-main',
      h('div.card-title', featured ? h('span.dot', { title: 'Próximo evento' }) : null, list.name),
      h('div.card-sub', [rel ? rel + ' · ' : '', longDate(list.date), ' · ', plural(list.items.length, 'canción', 'canciones')]),
      list.pending ? pendingChip(list.pending.status) : null,
    ),
    icon('next', { size: 16, cls: 'icon chev' }),
  );
}

const PENDING_LABEL = { pending: 'Pendiente de subir', conflict: 'Conflicto', error: 'No se pudo subir' };
/** Etiqueta de estado de una lista guardada en el dispositivo y aún no subida. */
export function pendingChip(status) {
  return h(`span.status-chip.${status}`, icon(status === 'pending' ? 'cloud' : 'alert', { size: 13 }), PENDING_LABEL[status] ?? status);
}

export function emptyState(title, text, action) {
  return h('div.empty', h('div.empty-title', title), text ? h('p', text) : null, action ?? null);
}

/** Título grande (se encoge al desplazar) con subtítulo y contenido extra opcionales. */
export function pageHeader(title, sub, ...extra) {
  return h('header.page-head', h('h1', title), sub ? h('p.page-sub', sub) : null, ...extra);
}
