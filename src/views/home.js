import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { state } from '../state.js';
import { nextEvent, upcomingLists, resolveItem, SECTIONS, missingPartLabel } from '../library/library.js';
import { link, listCard, emptyState, pageHeader, displayKey } from '../ui/components.js';
import { longDate, relativeDay } from '../ui/format.js';
import { installBanner } from '../features/install.js';

export function HomeView() {
  const lib = state.library;
  const section = state.settings.section;
  const el = h('div.view.home', h('div.home-glow', { 'aria-hidden': 'true' }));
  const done = () => ({ el, sectionPicker: true });

  const total = SECTIONS.reduce((n, sec) => n + lib.songs[sec].length, 0);
  const next = total || lib.lists.length ? nextEvent(lib) : null;

  // Sin próximo evento: título «Inicio» y accesos al cancionero, como antes.
  if (!next) el.append(pageHeader('Inicio'));
  const banner = installBanner();
  if (banner && !next) el.append(banner);

  if (!total && !lib.lists.length) {
    el.append(
      state.sync.running
        ? emptyState('Preparando la biblioteca…', 'Descargando canciones por primera vez.')
        : emptyState('La biblioteca está vacía', 'Pulsa actualizar para descargar las canciones.'),
    );
    return done();
  }

  if (next) {
    const rel = relativeDay(next.date);
    const items = next.items.map((it, i) => ({ it, i, ...resolveItem(lib, it, section) }));
    const listHref = link('/lista/' + encodeURIComponent(next.id));
    const first = items.find((x) => x.song);
    // El próximo culto es la pantalla: su nombre es el título grande.
    el.append(
      h(
        'header.page-head.next-head',
        h('a.next-kicker', { href: listHref }, h('span.dot'), rel ? `Próximo culto · ${rel.toLowerCase()}` : 'Próximo culto'),
        h('h1', next.name),
        h('p.page-sub', longDate(next.date), next.time ? ` · ${next.time}` : '', next.place ? ` · ${next.place}` : ''),
      ),
    );
    if (banner) el.append(banner);
    el.append(
      first ? h('a.btn.primary.start-btn', { href: songHref(next, first.i, first.song) }, icon('play', { size: 18 }), 'Empezar el culto') : null,
      next.notes ? h('p.next-notes', next.notes) : null,
      h(
        'ol.group.next-songs',
        { 'aria-label': 'Canciones del próximo culto' },
        items.slice(0, 8).map(({ it, i, song, fallback }) => {
          const sub = [song?.tempo ? `${song.tempo} bpm` : '', song?.artist ?? ''].filter(Boolean).join(' · ');
          const listKey = it.key ? displayKey(it.key) : '';
          const ownKey = !listKey && song?.songKey ? displayKey(song.songKey) : '';
          return h(
            'li',
            h(
              song ? 'a.next-song' : 'span.next-song',
              song ? { href: songHref(next, i, song) } : {},
              h('span.num', String(i + 1)),
              h(
                'span.next-main',
                h('span.t', song ? song.title : it.name),
                !song ? h('span.s.missing', 'No está en el cancionero') : fallback ? h('span.s.warn', `${missingPartLabel(section)}: se abre la de voces`) : sub ? h('span.s', sub) : null,
              ),
              listKey ? h('span.key-pill', { title: 'Tono de la lista' }, listKey) : ownKey ? h('span.key-text', ownKey) : null,
            ),
          );
        }),
        items.length > 8 ? h('li.more', h('a.next-song', { href: listHref }, h('span.num'), h('span.next-main', h('span.t', `y ${items.length - 8} más…`)))) : null,
      ),
    );
  }

  const others = upcomingLists(lib).filter((l) => l !== next);
  if (next) {
    el.append(
      h('div.group-head', h('h2.group-title', 'Después'), h('a.link', { href: link('/listas') }, 'Todas las listas')),
      others.length
        ? h(
            'div.later',
            others.slice(0, 4).map((l) =>
              h(
                'a.later-card',
                { href: link('/lista/' + encodeURIComponent(l.id)) },
                h('span.later-date', shortWeekDate(l.date)),
                h('span.later-name', l.name),
              ),
            ),
          )
        : h('p.group-footer', 'No hay más eventos preparados.'),
    );
    return done();
  }

  if (others.length) {
    el.append(h('h2.group-title', 'Más eventos'), h('div.cards', others.slice(0, 4).map((l) => listCard(l))));
  }
  el.append(
    h('h2.group-title', 'Cancionero'),
    h(
      'div.group.quick',
      h('a.quick-item', { href: link('/canciones') }, icon('music', { size: 20 }), h('span', 'Todas las canciones'), h('small', String(lib.songs[section].length)), icon('next', { size: 16, cls: 'icon chev' })),
      h('a.quick-item', { href: link('/listas') }, icon('calendar', { size: 20 }), h('span', 'Todas las listas'), h('small', String(lib.lists.length)), icon('next', { size: 16, cls: 'icon chev' })),
    ),
    emptyState('No hay eventos próximos', 'Cuando alguien prepare una lista con fecha, aparecerá aquí destacada.'),
  );
  return done();
}

/** «Mié 2 dic»: fecha corta con el día de la semana, para las tarjetas de «Después». */
function shortWeekDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  const wd = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  const mo = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getDate()} ${mo}`;
}

export function songHref(list, index, song) {
  const section = song?.section ?? state.settings.section;
  return link(`/cancion/${section}/${encodeURIComponent(song?.id ?? '')}?lista=${encodeURIComponent(list.id)}&i=${index}`);
}
