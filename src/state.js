import * as db from './db.js';
import { buildLibrary } from './library/library.js';
import { syncFrom, prefetch } from './sync/sync.js';
import { demoSource } from './sources/demo.js';
import { createOneDriveSource } from './sources/onedrive.js';
import { LoginRequiredError, FolderNotFoundError } from './sources/errors.js';
import { upcomingLists, resolveItem, SECTIONS } from './library/library.js';
import { songMeta } from './chordpro/song-doc.js';
import { applyOutbox } from './lists/outbox.js';
import { DEFAULT_LAYOUT } from './config.js';

export const DEFAULT_PEDAL = {
  scrollDown: ['PageDown', 'ArrowDown'],
  scrollUp: ['PageUp', 'ArrowUp'],
  nextSong: ['ArrowRight'],
  prevSong: ['ArrowLeft'],
  toggleScroll: [' '],
};

export const DEFAULT_SETTINGS = {
  section: 'voces', // 'voces' | 'bateria' | 'saxofon' | 'trompeta'
  metal: 'saxofon', // último instrumento de metales elegido
  saxTuning: 'Eb', // saxofón en Mi♭ (alto/barítono) o Si♭ (tenor/soprano)
  notation: 'american',
  theme: 'auto',
  fontScale: 1,
  lyricsOnly: false,
  pedal: DEFAULT_PEDAL,
  autoAdvance: true,
  downloadAll: false,
  sundayTime: '11:00', // hora que propone la plantilla «Domingo»
  layout: DEFAULT_LAYOUT, // estructura de carpetas en OneDrive (fase 2b)
  glass: 'auto', // efecto cristal: 'auto' | 'on' | 'off'
  pageMode: 'paged', // PDF/imágenes: 'paged' (página a página) o 'scroll' (continuo)
  source: 'demo',
};

const SOURCES = {
  demo: demoSource,
  onedrive: createOneDriveSource({ getLayout: () => state.settings.layout }),
};

const emptyLib = buildLibrary([]);

export const state = {
  settings: { ...DEFAULT_SETTINGS },
  library: emptyLib,
  files: [],
  outbox: [],
  sync: { running: false, progress: null, last: null, error: null, needsLogin: false, folders: null },
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  installPrompt: null,
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(what) {
  for (const fn of listeners) fn(what);
}
export const emitChange = emit;

export function currentSource() {
  return SOURCES[state.settings.source] ?? demoSource;
}

export async function loadSettings() {
  const saved = await db.kvGet('settings', {});
  state.settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    pedal: { ...DEFAULT_PEDAL, ...(saved.pedal ?? {}) },
    layout: { ...DEFAULT_LAYOUT, ...(saved.layout ?? {}) },
  };
  state.sync.last = await db.kvGet('lastSync', null);
  emit('settings');
}

export async function setSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  emit('settings'); // la pantalla responde al instante; se guarda después
  await db.kvSet('settings', state.settings);
}

export async function reloadLibrary() {
  state.files = await db.getAllFiles();
  // Archivos guardados por una versión anterior: se recalculan sus datos (categorías, enlace).
  for (const f of state.files) {
    if (f.kind === 'text' && typeof f.text === 'string' && !Array.isArray(f.meta?.tags)) f.meta = songMeta(f.text, f.ext);
  }
  state.outbox = await db.outboxAll();
  state.library = buildLibrary(applyOutbox(state.files, state.outbox));
  emit('library');
}

export function setInstallPrompt(e) {
  state.installPrompt = e;
  emit('install');
}

export function setOnline(v) {
  state.online = v;
  emit('online');
}

/** Sincroniza con el origen configurado y prepara los PDF/imágenes necesarios. */
export async function runSync({ quiet = false } = {}) {
  if (state.sync.running) return null;
  if (!navigator.onLine) {
    state.sync.error = 'Sin conexión: se muestra la última versión guardada.';
    emit('sync');
    return null;
  }
  state.sync = { ...state.sync, running: true, progress: null, error: null, needsLogin: false, folders: null };
  emit('sync');
  try {
    const source = currentSource();
    const result = await syncFrom(source, {
      onProgress: (done, total) => {
        state.sync.progress = { done, total, label: 'Actualizando' };
        emit('sync');
      },
    });
    await reloadLibrary();
    navigator.storage?.persist?.().catch(() => {});
    await prefetchNeeded();
    state.sync.last = await db.kvGet('lastSync', null);
    return { ...result, quiet };
  } catch (e) {
    if (e instanceof LoginRequiredError) {
      state.sync.needsLogin = true;
      state.sync.error = `${e.message} Para actualizar, vuelve a iniciar sesión; mientras tanto se usa lo ya descargado.`;
    } else if (e instanceof FolderNotFoundError) {
      state.sync.folders = e.folders;
      state.sync.error = e.message;
    } else {
      console.error(e);
      state.sync.error = 'No se pudo actualizar: ' + (e.message || e);
    }
    return null;
  } finally {
    state.sync.running = false;
    state.sync.progress = null;
    emit('sync');
  }
}

/**
 * PDF e imágenes: se descargan los de las listas próximas (todas las secciones,
 * para poder cambiar de sección sin conexión) o todo si el ajuste lo pide.
 */
export async function prefetchNeeded() {
  const lib = state.library;
  let songs;
  if (state.settings.downloadAll) {
    songs = SECTIONS.flatMap((sec) => lib.songs[sec]);
  } else {
    songs = upcomingLists(lib)
      .slice(0, 3)
      .flatMap((l) => l.items.flatMap((it) => SECTIONS.map((sec) => resolveItem(lib, it, sec).song)));
  }
  return prefetch(currentSource(), songs, {
    onProgress: (done, total) => {
      state.sync.progress = { done, total, label: 'Descargando partituras' };
      emit('sync');
    },
  });
}
