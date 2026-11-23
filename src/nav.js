/**
 * Historial de la app. El botón «atrás» de la app y el de Android (o el gesto
 * de iPhone) deben llevar al mismo sitio, sin bucles:
 *
 *  - Cada entrada del historial lleva su posición (navIdx) y aquí se recuerda
 *    qué pantalla hay en cada posición.
 *  - `goBackTo(href)`: si la pantalla anterior es esa, se vuelve atrás de verdad
 *    (history.back); si no, se sustituye la actual. Así nunca se apila una
 *    pantalla «hacia atrás» que luego el botón de Android vuelve a deshacer.
 *  - `replaceTo(href)`: cambia de pantalla sin añadir una entrada (por ejemplo,
 *    al guardar en un editor o al pasar de canción en una lista).
 */
const KEY = 'nav-entradas';

let entries = [];
try {
  entries = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
} catch {
  entries = [];
}
let idx = -1;
let replacing = false;
let pending = null; // pantalla a la que ir después de volver atrás

const save = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries.slice(-100)));
  } catch {
    /* sin almacenamiento: se pierde solo al recargar */
  }
};

const norm = (href) => {
  const h = String(href ?? '').replace(/^#/, '').split('?')[0] || '/';
  return h.length > 1 ? h.replace(/\/$/, '') : h;
};
/** ¿Son la misma pantalla? (sin contar filtros ni búsqueda) */
export const sameScreen = (a, b) => norm(a) === norm(b);

/** Se llama al principio de cada cambio de ruta. */
export function trackRoute() {
  const hash = location.hash || '#/';
  let i = history.state?.navIdx;
  if (typeof i !== 'number') {
    i = replacing ? Math.max(idx, 0) : idx + 1;
    history.replaceState({ ...(history.state ?? {}), navIdx: i }, '');
    entries.length = Math.min(entries.length, i); // lo que había «hacia delante» ya no existe
  }
  replacing = false;
  entries[i] = hash;
  idx = i;
  save();
  if (pending) {
    const p = pending;
    pending = null;
    replaceTo(p);
  }
}

/** Pantalla anterior en el historial de la app (o null). */
export const previousScreen = () => (idx > 0 ? entries[idx - 1] ?? null : null);

export function replaceTo(href) {
  if (sameScreen(location.hash, href) && location.hash === href) return;
  replacing = true;
  location.replace(href);
}

/**
 * Vuelve a `href`. `from` es la pantalla desde la que se entró, si puede ser
 * otra (p. ej. una lista que cambia de nombre al guardarla): se vuelve atrás
 * hasta ella y se sustituye por `href`.
 */
export function goBackTo(href, from = href) {
  const prev = previousScreen();
  if (prev && (sameScreen(prev, href) || sameScreen(prev, from))) {
    if (!sameScreen(prev, href)) pending = href;
    history.back();
  } else replaceTo(href);
}

/** Para pruebas. */
export function _reset() {
  entries = [];
  idx = -1;
  replacing = false;
  pending = null;
}
