/**
 * All sound is synthesized with Web Audio, so the MVP ships no audio files.
 * Swap these for licensed recordings later (see plan.md §9).
 * Audio only starts from a user gesture (the Enter click).
 */

const STORAGE_KEY = 'heartglass:muted';

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  muted = readMuted();

  /** Must be called from a click/keydown handler. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.startAmbient();

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(STORAGE_KEY, m ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.1);
    }
  }

  /** Soft evolving pad: detuned sines through a slowly moving low-pass filter. */
  private startAmbient() {
    const ctx = this.ctx!;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.master!);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    // A major-ish open chord, low register
    [110, 164.81, 220.5, 277.18, 329.63].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 2) * 4;
      g.gain.value = 0.05 / (1 + i * 0.4);
      o.connect(g).connect(filter);
      o.start();
    });

    this.ambientGain.gain.setTargetAtTime(0.7, ctx.currentTime, 2.5);
  }

  duck(amount: number, seconds = 1) {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(0.7 * amount, this.ctx.currentTime, seconds / 3);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Bell-like chime: fundamental + inharmonic partials. */
  chime(base = 660) {
    this.tone(base, 2.4, 0.08);
    this.tone(base * 2.76, 1.4, 0.03);
    this.tone(base * 5.4, 0.8, 0.015);
  }

  /** Airy rising swell for entering the mirror. */
  enter() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 2);
    const g = ctx.createGain();
    g.gain.value = 0.25;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    this.chime(880);
  }

  /** Glass breaking: a bright noise crack, then scattered tinkles as shards fall. */
  shatter() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(hp).connect(g).connect(this.master);
    src.start();
    for (let i = 0; i < 14; i++) {
      this.tone(2400 + Math.random() * 4200, 0.25 + Math.random() * 0.5, 0.025, 'sine', 0.05 + Math.random() * 1.4);
    }
  }

  tick() {
    this.tone(1800, 0.06, 0.03, 'triangle');
  }

  heart() {
    this.tone(70, 0.35, 0.25);
    this.tone(62, 0.3, 0.18, 'sine', 0.22);
    this.chime(523.25);
  }
}

export const audio = new Audio();
