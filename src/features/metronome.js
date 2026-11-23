/**
 * Metrónomo con Web Audio: los golpes se programan con antelación en el reloj
 * del audio (no con temporizadores), así no se retrasan aunque el móvil vaya
 * cargado. El primer tiempo del compás suena más agudo.
 *
 * En iPhone, el audio de la web no suena con el interruptor de silencio puesto.
 */
export const BPM_MIN = 30;
export const BPM_MAX = 260;
export const clampBpm = (v) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(v) || 0)));

/** Tiempos por compás a partir de «4/4», «6/8», «3/4»… (4 si no se sabe). */
export function beatsPerBar(time) {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(String(time ?? ''));
  const n = m ? parseInt(m[1], 10) : 4;
  return n >= 1 && n <= 16 ? n : 4;
}

/** Tempo de un texto como «136», «136 bpm» o «♩ = 72»; null si no hay. */
export function parseBpm(text) {
  const m = /(\d{2,3})/.exec(String(text ?? ''));
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return v >= BPM_MIN && v <= BPM_MAX ? v : null;
}

let sharedCtx = null;
function audioContext() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AC();
  return sharedCtx;
}

export function createMetronome({ bpm = 100, beats = 4, onBeat, onChange } = {}) {
  let tempo = clampBpm(bpm);
  let running = false;
  let nextTime = 0;
  let beat = 0;
  let timer = 0;
  const pending = []; // golpes programados para avisar a la vista cuando suenen

  function click(ctx, time, accent) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1175;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.55, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  function schedule() {
    const ctx = audioContext();
    if (!ctx || !running) return;
    while (nextTime < ctx.currentTime + 0.12) {
      click(ctx, nextTime, beat === 0);
      pending.push({ time: nextTime, beat });
      nextTime += 60 / tempo;
      beat = (beat + 1) % beats;
    }
    while (pending.length && pending[0].time <= ctx.currentTime) onBeat?.(pending.shift().beat);
    timer = setTimeout(schedule, 25);
  }

  async function start() {
    if (running) return;
    const ctx = audioContext();
    if (!ctx) return;
    // Hay que llamarlo dentro del toque del usuario (sobre todo en iPhone).
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    running = true;
    beat = 0;
    pending.length = 0;
    nextTime = ctx.currentTime + 0.06;
    schedule();
    onChange?.(api);
  }
  function stop() {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    pending.length = 0;
    onChange?.(api);
  }

  const api = {
    start,
    stop,
    toggle: () => (running ? stop() : start()),
    get running() {
      return running;
    },
    get bpm() {
      return tempo;
    },
    setBpm(v) {
      tempo = clampBpm(v);
      onChange?.(api);
    },
    destroy: () => stop(),
  };
  return api;
}
