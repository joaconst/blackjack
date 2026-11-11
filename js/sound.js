/* =========================================================
   Sonidos
   Todo se sintetiza con Web Audio: no hay archivos de audio,
   asi que funciona offline y no pesa nada.
   Estilo: limpio, redondo y bajo. Sin buzzers.
   ========================================================= */

const VOLUME = 1;
const MAX_TIER = 12;

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.wet = null;
    this.output = null;
    this.muted = false;
    this.ok = false;
  }

  /* ---------- Infraestructura ---------- */

  build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    try {
      const ctx = new Ctx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = VOLUME;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -8;
      comp.knee.value = 8;
      comp.ratio.value = 12;
      comp.attack.value = 0.0015;
      comp.release.value = 0.15;

      // Un poco de presencia en 2-4 kHz: se entiende mejor sin subir todo.
      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 2600;
      treble.gain.value = 3.5;

      master.connect(comp);
      comp.connect(ctx.destination);
      this.master = master;
      this.output = comp;

      const bus = ctx.createGain();
      bus.gain.value = 2.2;
      bus.connect(treble);
      treble.connect(master);

      const reverb = ctx.createConvolver();
      reverb.buffer = this.impulse();
      const wet = ctx.createGain();
      wet.gain.value = 0.15;
      bus.connect(reverb);
      reverb.connect(wet);
      wet.connect(master);

      this.bus = bus;
      this.wet = wet;
      this.noise = this.noiseBuffer();
      this.ok = true;
    } catch {
      this.ok = false;
    }
  }

  impulse() {
    const ctx = this.ctx;
    const seconds = 1.1;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.8) * 0.5;
      }
    }
    return buffer;
  }

  noiseBuffer() {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  ensure() {
    if (!this.ctx) this.build();
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  unlock() {
    this.ensure();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : VOLUME, now, 0.03);
    }
  }

  /* ---------- Piezas ---------- */

  tone({ freq = 440, to = null, dur = 0.2, type = 'sine', gain = 0.08, attack = 0.006, delay = 0 }) {
    if (!this.ok) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);

    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(amp);
    amp.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  hiss({ dur = 0.14, gain = 0.06, freq = 1600, sweep = null, q = 0.9, type = 'bandpass', delay = 0 }) {
    if (!this.ok) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t0 + dur);
    filter.Q.value = q;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur / 3));
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.bus);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  /* ---------- Sonidos ---------- */

  chip({ index = 0 } = {}) {
    const step = Math.min(Math.max(index, 0), MAX_TIER);
    const freq = 1280 * Math.pow(0.9, step);
    this.hiss({ dur: 0.05, gain: 0.1, freq: 2800, q: 0.8 });
    this.tone({ freq, to: freq * 0.66, dur: 0.095, type: 'triangle', gain: 0.085 });
  }

  card() {
    this.hiss({ dur: 0.17, gain: 0.072, freq: 820, sweep: 3400, q: 0.65 });
    this.hiss({ dur: 0.03, gain: 0.04, freq: 5400, q: 1.4, delay: 0.015 });
  }

  win() {
    this.tone({ freq: 523.25, dur: 0.28, type: 'triangle', gain: 0.105 });
    this.tone({ freq: 659.25, dur: 0.34, type: 'triangle', gain: 0.085, delay: 0.09 });
    this.tone({ freq: 783.99, dur: 0.42, type: 'sine', gain: 0.078, delay: 0.18 });
  }

  blackjack() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.tone({ freq, dur: 0.3, type: 'triangle', gain: 0.09, delay: i * 0.075 });
      this.tone({ freq: freq * 2, dur: 0.22, type: 'sine', gain: 0.026, delay: i * 0.075 });
    });
  }

  lose() {
    this.tone({ freq: 168, to: 104, dur: 0.34, type: 'sine', gain: 0.12, attack: 0.012 });
    this.hiss({ dur: 0.16, gain: 0.045, freq: 320, sweep: 140, q: 0.7 });
  }

  push() {
    this.tone({ freq: 392, dur: 0.2, type: 'sine', gain: 0.08 });
    this.tone({ freq: 523.25, dur: 0.24, type: 'sine', gain: 0.065, delay: 0.11 });
  }

  allin() {
    [0, 3, 6].forEach((index, i) => {
      const freq = 1280 * Math.pow(0.9, index);
      this.tone({ freq, to: freq * 0.7, dur: 0.1, type: 'triangle', gain: 0.08, delay: i * 0.055 });
    });
    this.tone({ freq: 196, dur: 0.36, type: 'sine', gain: 0.075, delay: 0.16 });
  }

  unlockTier() {
    this.tone({ freq: 784, dur: 0.24, type: 'triangle', gain: 0.085 });
    this.tone({ freq: 1046.5, dur: 0.34, type: 'sine', gain: 0.07, delay: 0.1 });
  }

  toggle() {
    this.tone({ freq: 660, dur: 0.09, type: 'sine', gain: 0.07 });
  }

  tick() {
    this.hiss({ dur: 0.03, gain: 0.028, freq: 3600, q: 1.2 });
  }

  play(name, options = {}) {
    if (this.muted) return;
    if (!this.ensure()) return;
    const fn = this[name];
    if (typeof fn !== 'function') return;
    try {
      fn.call(this, options);
    } catch {
      /* un sonido no puede romper el juego */
    }
  }
}

export const sound = new SoundEngine();

// iOS exige un gesto antes de habilitar audio.
export function unlockSoundOnGesture() {
  const unlock = () => {
    sound.unlock();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

document.addEventListener('visibilitychange', () => {
  if (!sound.ctx) return;
  if (document.hidden) sound.ctx.suspend().catch(() => {});
  else if (!sound.muted) sound.ctx.resume().catch(() => {});
});
