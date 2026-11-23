/**
 * Desplazamiento automático suave. La velocidad va de 1 a 20; cada nivel es un
 * 18 % más rápido que el anterior (nivel 1 ≈ 7 px/s, nivel 20 ≈ 160 px/s).
 * Si el usuario mueve la pantalla a mano, se continúa desde la nueva posición.
 *
 * Modo «Auto»: si la canción tiene duración ({time: 6:58} de SongBook), la
 * velocidad se calcula para recorrerla entera en ese tiempo.
 */
export const SPEED_MIN = 1;
export const SPEED_MAX = 20;
export const pxPerSecond = (level) => 7 * Math.pow(1.18, level - 1);
/** Nivel más cercano a una velocidad en px/s. */
export const nearestLevel = (rate) => Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(Math.log(Math.max(rate, 1) / 7) / Math.log(1.18)) + 1));
/** «6:58» → 418 segundos (null si no es una duración). */
export function durationSeconds(text) {
  const m = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(String(text ?? ''));
  const s = m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
  return s >= 20 ? s : null;
}

export function createAutoScroller(el, { speed = 6, onChange } = {}) {
  let running = false;
  let level = speed;
  let pos = 0;
  let last = 0;
  let raf = 0;
  let autoSeconds = null;

  const rate = () => (autoSeconds ? Math.max(1, (el.scrollHeight - el.clientHeight) / autoSeconds) : pxPerSecond(level));

  const atEnd = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    // Si la posición real se aleja de la calculada, el usuario ha movido la pantalla.
    if (Math.abs(el.scrollTop - pos) > 3) pos = el.scrollTop;
    pos += rate() * dt;
    el.scrollTop = pos;
    if (atEnd()) {
      stop();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    if (atEnd()) el.scrollTop = 0;
    running = true;
    pos = el.scrollTop;
    last = performance.now();
    raf = requestAnimationFrame(frame);
    onChange?.(api);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    onChange?.(api);
  }

  const api = {
    start,
    stop,
    toggle: () => (running ? stop() : start()),
    get running() {
      return running;
    },
    get speed() {
      return level;
    },
    /** Segundos de la canción en modo «Auto», o null. */
    get auto() {
      return autoSeconds;
    },
    /** Nivel equivalente a la velocidad actual (también en «Auto»). */
    get effectiveLevel() {
      return autoSeconds ? nearestLevel(rate()) : level;
    },
    setSpeed(v) {
      autoSeconds = null;
      level = Math.max(SPEED_MIN, Math.min(SPEED_MAX, v));
      onChange?.(api);
    },
    setAuto(seconds) {
      autoSeconds = seconds || null;
      onChange?.(api);
    },
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
  return api;
}
