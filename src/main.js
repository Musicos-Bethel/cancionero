import '@fontsource/cabin/latin-600.css'; // solo para la marca «Bethel»
import { trackRoute } from './nav.js';
import './styles/base.css';
import './styles/song.css';
import './styles/editor.css';

import { h, clear } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { state, subscribe, loadSettings, reloadLibrary, runSync, setOnline } from './state.js';
import { brandMark, link } from './ui/components.js';
import { applyGlass } from './features/glass.js';
import { setupInstall } from './features/install.js';
import { exitImmersive } from './features/immersive.js';
import { HomeView } from './views/home.js';
import { SongsView } from './views/songs.js';
import { ListsView, ListDetailView } from './views/lists.js';
import { SongView } from './views/song.js';
import { SettingsView } from './views/settings.js';
import { ListEditorView } from './views/list-editor.js';
import { SongEditorView } from './views/song-editor.js';
import { DrumEditorView } from './views/drum-editor.js';
import { flushOutbox } from './lists/outbox-runner.js';
import { plural } from './ui/format.js';
import { completeLogin, startLogin, reconnect, lastAccount } from './sources/onedrive-auth.js';

// ---------- Tema
const themeMeta = document.querySelector('meta[name="theme-color"]');
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  themeMeta?.setAttribute('content', dark ? '#000000' : '#f2f2f7');
  applyGlass(state.settings.glass);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
matchMedia('(prefers-reduced-transparency: reduce)').addEventListener?.('change', applyTheme);

// ---------- Estructura
const app = document.getElementById('app');
// El clic se asigna más abajo (appbarSync.onclick), para informar del resultado.
const appbarSync = h('button.glass-btn.circle.sync-btn', { 'aria-label': 'Actualizar biblioteca' }, icon('refresh', { size: 20 }));
const offlineBadge = h('span.offline-badge', { hidden: true, title: 'Sin conexión' }, icon('wifiOff', { size: 16 }), h('span', 'Sin conexión'));
// Título pequeño que aparece en la barra al desplazar (como en iOS).
const compactTitle = h('div.appbar-title', { 'aria-hidden': 'true' });
const appbar = h('header.appbar', h('div.appbar-inner', brandMark(), compactTitle, h('div.appbar-actions', offlineBadge, appbarSync)));
const progress = h('div.progress', { hidden: true }, h('div.progress-bar'));
const main = h('main#view', { tabindex: '-1' });

const TABS = [
  ['/', 'Inicio', 'home'],
  ['/canciones', 'Canciones', 'music'],
  ['/listas', 'Listas', 'list'],
  ['/ajustes', 'Ajustes', 'settings'],
];
const tabbar = h(
  'nav.tabbar',
  { 'aria-label': 'Secciones de la app' },
  TABS.map(([path, label, ic]) => h('a.tab', { href: link(path), dataset: { path } }, icon(ic), h('span', label))),
);
app.append(appbar, progress, main, tabbar);

/**
 * Pestañas fáciles de pulsar. Con un enlace normal el móvil descarta el toque
 * si el dedo se mueve un poco o si cae en el borde de la cápsula, y había que
 * acertar en el centro. Aquí cuenta toda la barra (y un margen alrededor): la
 * pestaña se elige por la posición horizontal del dedo y se cambia al levantarlo,
 * aunque se haya movido algo. El clic normal sigue valiendo para el teclado.
 */
const TAP_SLOP = 30; // px que se puede mover el dedo sin que deje de ser un toque
let tabTap = null;
let tabHandledAt = 0;
function tabAt(x) {
  const tabs = [...tabbar.children];
  const r = tabbar.getBoundingClientRect();
  const i = Math.floor(((x - r.left) / r.width) * tabs.length);
  return tabs[Math.max(0, Math.min(tabs.length - 1, i))];
}
tabbar.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  tabTap = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
tabbar.addEventListener('pointerup', (e) => {
  const t = tabTap;
  tabTap = null;
  if (!t || t.id !== e.pointerId || Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP) return;
  const tab = tabAt(t.x);
  tabHandledAt = performance.now();
  e.preventDefault();
  const href = tab.getAttribute('href');
  if (location.hash === href || (href === '#/' && !location.hash)) window.scrollTo({ top: 0, behavior: 'smooth' });
  else location.hash = href;
});
tabbar.addEventListener('pointercancel', () => (tabTap = null));
// El clic que sigue al toque ya está atendido; si no hubo toque (teclado), se deja.
tabbar.addEventListener('click', (e) => {
  if (performance.now() - tabHandledAt < 800) e.preventDefault();
});

// Al volver del zoom con los dedos, la página debe quedar en su sitio.
window.visualViewport?.addEventListener('resize', () => {
  if (window.visualViewport.scale <= 1.01 && window.scrollX !== 0) window.scrollTo(0, window.scrollY);
});

// ---------- Títulos grandes que se encogen al desplazar
let titleObserver = null;
function watchLargeTitle(view) {
  titleObserver?.disconnect();
  document.body.classList.remove('title-collapsed');
  const h1 = view.el.querySelector('.page-head h1');
  compactTitle.textContent = h1?.textContent ?? '';
  if (!h1) return;
  titleObserver = new IntersectionObserver(
    ([e]) => document.body.classList.toggle('title-collapsed', !e.isIntersecting && e.boundingClientRect.top < 80),
    { rootMargin: '-56px 0px 0px 0px', threshold: 0 },
  );
  titleObserver.observe(h1);
}
const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 4);
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- Rutas
let current = null;
let currentKey = '';
let lastListHref = '';
const scrollMemory = new Map();

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: new URLSearchParams(qs), raw };
}

const isEditor = (view) => view?.el.classList.contains('list-editor') || view?.el.classList.contains('song-editor') || view?.el.classList.contains('drum-editor');

function route() {
  trackRoute();
  const { path, query, raw } = parseHash();
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const songMode = parts[0] === 'cancion';

  if (current && !current.fullscreen) scrollMemory.set(currentKey, window.scrollY);
  try {
    current?.destroy?.();
  } catch (e) {
    console.error(e);
  }

  let view;
  if (!parts.length) view = HomeView();
  else if (parts[0] === 'canciones') view = SongsView({ query });
  else if (parts[0] === 'listas' && parts[1] === 'nueva') view = ListEditorView({ mode: 'new', query });
  else if (parts[0] === 'listas' && parts[1] === 'editar') view = ListEditorView({ mode: 'edit', id: parts.slice(2).join('/'), query });
  else if (parts[0] === 'listas' && parts[1] === 'duplicar') view = ListEditorView({ mode: 'duplicate', id: parts.slice(2).join('/'), query });
  else if (parts[0] === 'listas') view = ListsView();
  else if (parts[0] === 'editor' && parts[1] === 'nueva') view = SongEditorView({ id: null });
  else if (parts[0] === 'editor' && parts[1] === 'voces') view = SongEditorView({ id: parts.slice(2).join('/') });
  else if (parts[0] === 'editor' && parts[1] === 'bateria-nueva') view = DrumEditorView({ id: null, query });
  else if (parts[0] === 'editor' && parts[1] === 'bateria') view = DrumEditorView({ id: parts.slice(2).join('/'), query });
  else if (parts[0] === 'lista') view = ListDetailView({ id: parts.slice(1).join('/') });
  else if (songMode) view = SongView({ section: parts[1], id: parts[2] ?? '', query, backHref: lastListHref });
  else if (parts[0] === 'ajustes') view = SettingsView();
  else view = HomeView();

  // Los editores no cuentan como «de dónde vengo»: al salir de una canción tras
  // editarla se vuelve a la lista o a Canciones, no otra vez al editor.
  if (!songMode && parts[0] !== 'editor' && !['nueva', 'editar', 'duplicar'].includes(parts[1])) {
    lastListHref = '#' + raw;
  }
  if (!songMode) {
    exitImmersive(); // la pantalla completa solo se mantiene entre canciones
  }
  current = view;
  currentKey = path;
  document.body.classList.toggle('song-mode', !!view.fullscreen);
  document.body.classList.toggle('editor-mode', isEditor(view));
  clear(main).append(view.el);
  watchLargeTitle(view);

  const tabPath = '/' + (parts[0] === 'lista' ? 'listas' : parts[0] === 'editor' ? 'canciones' : parts[0] === 'cancion' ? '' : parts[0] ?? '');
  for (const t of tabbar.children) {
    const on = t.dataset.path === (tabPath === '/' ? '/' : tabPath);
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  }
  if (!view.fullscreen) window.scrollTo(0, scrollMemory.get(path) ?? 0);
  onScroll();
  view.focus?.();
  maybeApplyUpdate();
}

/**
 * Repinta la vista actual cuando cambian datos, salvo una canción abierta o el
 * editor de listas (que no debe perder lo que se está escribiendo).
 */
function refresh() {
  if (current?.fullscreen || isEditor(current)) return;
  const y = window.scrollY;
  scrollMemory.set(currentKey, y);
  route();
}

function renderChrome() {}

subscribe((what) => {
  if (what === 'settings') {
    applyTheme();
    renderChrome();
    refresh();
  } else if (what === 'library' || what === 'install' || what === 'leader') {
    refresh();
  } else if (what === 'editing') {
    maybeApplyUpdate();
  } else if (what === 'sync') {
    appbarSync.classList.toggle('spinning', state.sync.running);
    appbarSync.disabled = state.sync.running;
    const p = state.sync.progress;
    progress.hidden = !state.sync.running;
    progress.firstChild.style.width = p && p.total ? `${Math.round((p.done / p.total) * 100)}%` : '15%';
  } else if (what === 'online') {
    offlineBadge.hidden = state.online;
  }
});

window.addEventListener('hashchange', route);
window.addEventListener('online', () => {
  setOnline(true);
  // Primero se suben los cambios pendientes del modo líder, luego se actualiza.
  flushOutbox().finally(() => runSync({ quiet: true }).then(report));
});
window.addEventListener('offline', () => setOnline(false));

function report(r) {
  if (!r) {
    if (state.sync.needsLogin) {
      toast('La sesión de OneDrive ha caducado. Se usa lo ya descargado.', {
        timeout: 8000,
        action: { label: 'Iniciar sesión', run: () => reconnect() },
      });
    } else if (state.sync.error) toast(state.sync.error);
    return;
  }
  const parts = [];
  if (r.added) parts.push(plural(r.added, 'nueva', 'nuevas'));
  if (r.updated) parts.push(plural(r.updated, 'modificada', 'modificadas'));
  if (r.removed) parts.push(plural(r.removed, 'eliminada', 'eliminadas'));
  if (parts.length) toast('Biblioteca actualizada: ' + parts.join(', '));
  else if (!r.quiet) toast('La biblioteca ya está al día');
}
// El botón de actualizar también informa del resultado. Si la sesión de OneDrive
// caducó y se conoce la cuenta, vuelve a entrar solo (solo al pulsarlo, nunca
// con una canción abierta).
appbarSync.onclick = async () => {
  const r = await runSync();
  if (!r && state.sync.needsLogin && navigator.onLine && !document.body.classList.contains('song-mode') && (await lastAccount())?.user) {
    toast('Volviendo a entrar en OneDrive…', { timeout: 0 });
    return reconnect();
  }
  report(r);
};

// ---------- Service worker (actualizaciones de la app)
// Una versión nueva se instala sola si no hay una canción abierta ni una lista
// a medio editar; si las hay, espera para no interrumpir en mitad de un culto.
let applyUpdate = null;
let updateToast = null;

function safeToReload() {
  return !document.body.classList.contains('song-mode') && !state.editingDirty && !document.body.classList.contains('sheet-open');
}

function maybeApplyUpdate() {
  if (!applyUpdate) return;
  if (safeToReload()) {
    updateToast?.remove();
    toast('Actualizando el cancionero a la nueva versión…', { variant: 'gold', timeout: 0 });
    const run = applyUpdate;
    applyUpdate = null;
    setTimeout(run, 900);
  } else if (!updateToast?.isConnected) {
    const inSong = document.body.classList.contains('song-mode');
    const why = inSong ? 'al cerrar la canción' : 'al terminar de editar';
    // En una canción el aviso se retira solo para no tapar la letra; la
    // actualización sigue esperando y se instala al salir.
    updateToast = toast(`Nueva versión lista: se instalará ${why}.`, {
      variant: 'gold',
      timeout: inSong ? 6000 : 0,
      action: { label: 'Ahora', run: () => applyUpdate?.() },
    });
  }
}

async function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const { registerSW } = await import('virtual:pwa-register');
  const update = registerSW({
    onNeedRefresh() {
      applyUpdate = () => update(true);
      maybeApplyUpdate();
    },
    onOfflineReady() {
      toast('Listo para usar sin conexión');
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Buscar versiones nuevas al volver a la app y cada 30 minutos.
      const check = () => navigator.onLine && reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    },
  });
}

// ---------- Arranque
async function start() {
  setupInstall();
  await loadSettings();
  // ¿Volvemos de la página de Microsoft? Termina el inicio de sesión y limpia la dirección.
  const login = await completeLogin().catch((e) => ({ ok: false, message: e.message }));
  applyTheme();
  renderChrome();
  await reloadLibrary();
  setOnline(navigator.onLine);
  offlineBadge.hidden = navigator.onLine;
  route();
  registerSW();
  const empty = !state.files.length;
  if (login?.interactive) {
    // Microsoft no recordaba la sesión: ahora sí, su página de inicio de sesión.
    return startLogin(login.interactive);
  }
  if (login) {
    toast(login.ok ? `Sesión iniciada en OneDrive${login.account?.name ? ` (${login.account.name})` : ''}` : login.message, { timeout: login.ok ? 3500 : 7000 });
    if (login.ok) {
      runSync().then(report).then(() => flushOutbox());
      return;
    }
  }
  if (navigator.onLine) {
    runSync({ quiet: !empty })
      .then((r) => (empty ? null : report(r)))
      .then(() => flushOutbox());
  }
}
start();
