'use strict';

// Efectos de sonido sintetizados con WebAudio (sin archivos). Cada sonido es una lista de notas.
// Nota: { freq (Hz), dur (s), delay (s), type ('square'|'sine'|'triangle'|'sawtooth'), gain (0–1), slideTo (Hz) }
const SOUNDS = {
  lock:     [{ freq: 160, dur: 0.06, type: 'square', gain: 0.12 }],
  clear1:   [{ freq: 523, dur: 0.09 }, { freq: 659, dur: 0.12, delay: 0.07 }],
  clear2:   [{ freq: 523, dur: 0.09 }, { freq: 659, dur: 0.09, delay: 0.07 }, { freq: 784, dur: 0.14, delay: 0.14 }],
  clear3:   [{ freq: 523, dur: 0.08 }, { freq: 659, dur: 0.08, delay: 0.06 }, { freq: 784, dur: 0.08, delay: 0.12 }, { freq: 988, dur: 0.16, delay: 0.18 }],
  clear4:   [{ freq: 523, dur: 0.08 }, { freq: 659, dur: 0.08, delay: 0.06 }, { freq: 784, dur: 0.08, delay: 0.12 }, { freq: 1047, dur: 0.1, delay: 0.18 }, { freq: 1319, dur: 0.25, delay: 0.26, type: 'triangle' }],
  combo:    [{ freq: 440, dur: 0.07, type: 'triangle', gain: 0.18 }, { freq: 660, dur: 0.1, delay: 0.06, type: 'triangle', gain: 0.18 }],
  tspin:    [{ freq: 300, dur: 0.3, type: 'sawtooth', gain: 0.12, slideTo: 900 }, { freq: 1200, dur: 0.15, delay: 0.25, type: 'sine' }],
  b2b:      [{ freq: 880, dur: 0.08, type: 'sine' }, { freq: 1175, dur: 0.18, delay: 0.08, type: 'sine' }],
  perfect:  [{ freq: 523, dur: 0.12 }, { freq: 659, dur: 0.12, delay: 0.1 }, { freq: 784, dur: 0.12, delay: 0.2 }, { freq: 1047, dur: 0.12, delay: 0.3 }, { freq: 1568, dur: 0.5, delay: 0.4, type: 'triangle' }],
  powerup:  [{ freq: 400, dur: 0.2, type: 'sine', slideTo: 1000, gain: 0.2 }],
  ability:  [{ freq: 520, dur: 0.1, type: 'triangle', gain: 0.2 }, { freq: 780, dur: 0.18, delay: 0.08, type: 'triangle', gain: 0.2 }],
  energyFull: [{ freq: 660, dur: 0.08, type: 'sine' }, { freq: 880, dur: 0.08, delay: 0.07, type: 'sine' }, { freq: 1320, dur: 0.2, delay: 0.14, type: 'sine' }],
  gameover: [{ freq: 400, dur: 0.5, type: 'sawtooth', gain: 0.15, slideTo: 80 }],
};

const AudioManager = (() => {
  let ctx = null, master = null;
  const settings = { volume: 0.5, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('sound')) || {}); } catch (e) { /* sin almacenamiento: valores por defecto */ }

  function save() {
    try { localStorage.setItem('sound', JSON.stringify(settings)); } catch (e) { /* ignorar */ }
  }

  function applyGain() {
    if (master) master.gain.value = settings.muted ? 0 : settings.volume * settings.volume; // curva perceptual
  }

  // Crear/reanudar el contexto solo tras un gesto del usuario (política de autoplay).
  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      applyGain();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function play(name, { pitch = 1 } = {}) {
    const notes = SOUNDS[name];
    if (!notes || !ctx || settings.muted || settings.volume <= 0) return;
    const t0 = ctx.currentTime;
    for (const n of notes) {
      const start = t0 + (n.delay || 0), dur = n.dur || 0.1, peak = n.gain ?? 0.2;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type || 'square';
      osc.frequency.setValueAtTime(n.freq * pitch, start);
      if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo * pitch, start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
  }

  return {
    settings, unlock, play,
    setVolume(v) { settings.volume = Math.min(1, Math.max(0, v)); if (v > 0) settings.muted = false; applyGain(); save(); },
    toggleMute() { settings.muted = !settings.muted; applyGain(); save(); return settings.muted; },
  };
})();

function playSound(name, opts) { AudioManager.play(name, opts); }
