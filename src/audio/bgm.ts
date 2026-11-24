import { sfx } from './sfx';

export type BgmMode = 'off' | 'menu' | 'shop' | 'combat' | 'boss';

/**
 * 零素材 Web Audio 动态程序化 BGM：
 * - menu / shop：舒缓木琴五声音阶 + 温暖拨弦低音（喘息感）
 * - combat：明快弹跳的合成打击乐 + 活跃节拍旋律（割草节奏）
 * - boss：加速驱动低音 + 密集踩镲 + 紧张高音动机（精英/Boss 压迫感）
 */
class BgmEngine {
  private mode: BgmMode = 'off';
  private enabled = true;
  private volume = 0.7;
  private paused = false;
  private hidden = false;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private step = 0;

  init(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = volume;
    sfx.onUnlock((ctx) => this.attach(ctx));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.hidden = document.hidden;
        this.syncGain();
      });
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.syncGain();
    this.ensureLoop();
  }

  setVolume(v: number): void {
    this.volume = v;
    this.syncGain();
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.syncGain();
  }

  setMode(next: BgmMode): void {
    if (this.mode === next) return;
    this.mode = next;
    this.step = 0;
    this.syncGain();
    this.restartLoop();
  }

  private attach(ctx: AudioContext): void {
    if (this.master) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ctx.destination);
    this.master = g;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.syncGain();
    this.ensureLoop();
  }

  private targetGain(): number {
    if (!this.enabled || this.paused || this.hidden || this.mode === 'off' || this.volume <= 0 || sfx.muted) return 0;
    const modeScale = this.mode === 'menu' || this.mode === 'shop' ? 0.15 : this.mode === 'boss' ? 0.22 : 0.19;
    return this.volume * modeScale;
  }

  private syncGain(): void {
    const ctx = sfx.context;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.targetGain(), now, 0.08);
  }

  private restartLoop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.ensureLoop();
  }

  private ensureLoop(): void {
    if (this.timer !== null) return;
    if (!this.enabled || this.mode === 'off') return;
    const bpm = this.mode === 'boss' ? 142 : this.mode === 'combat' ? 124 : 96;
    const stepMs = Math.round((60000 / bpm) / 2); // 八分音符步进
    this.timer = window.setInterval(() => this.tick(), stepMs);
  }

  private tick(): void {
    const ctx = sfx.context;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    if (this.targetGain() <= 0.0005) return;
    const now = ctx.currentTime + 0.015;
    const s = this.step % 32;
    this.step++;

    if (this.mode === 'menu' || this.mode === 'shop') {
      this.playChill(ctx, now, s);
    } else if (this.mode === 'combat') {
      this.playCombat(ctx, now, s);
    } else if (this.mode === 'boss') {
      this.playBoss(ctx, now, s);
    }
  }

  /** 舒缓木琴 + 轻贝斯（商店 / 主菜单） */
  private playChill(ctx: AudioContext, t: number, s: number): void {
    // D 大调温暖五声音阶
    const bass = [146.83, 0, 0, 0, 110.0, 0, 0, 0, 123.47, 0, 0, 0, 98.0, 0, 110.0, 0];
    const mel = [
      587.33, 0, 659.25, 0, 739.99, 0, 587.33, 0,
      440.0, 0, 587.33, 0, 493.88, 0, 0, 0,
      587.33, 0, 739.99, 0, 880.0, 0, 739.99, 0,
      659.25, 0, 587.33, 0, 440.0, 0, 0, 0,
    ];
    const b = bass[s % 16];
    if (b > 0) this.note(ctx, t, 'triangle', b, 0.32, 0.34, 480);
    const m = mel[s];
    if (m > 0) this.note(ctx, t, 'sine', m, 0.22, 0.22, 2200);
    if (s % 4 === 2) this.hat(ctx, t, 0.04, 0.08);
  }

  /** 明快割草节奏（普通战斗波） */
  private playCombat(ctx: AudioContext, t: number, s: number): void {
    // E 小调弹跳贝斯 + 鼓点 + 轻快主旋律
    const bass = [
      82.41, 0, 82.41, 123.47, 98.0, 0, 110.0, 0,
      82.41, 0, 82.41, 146.83, 123.47, 0, 110.0, 98.0,
    ];
    const lead = [
      329.63, 0, 392.0, 440.0, 493.88, 0, 392.0, 0,
      329.63, 0, 293.66, 0, 329.63, 0, 0, 0,
      493.88, 0, 587.33, 493.88, 440.0, 0, 392.0, 0,
      440.0, 0, 392.0, 329.63, 293.66, 0, 329.63, 0,
    ];
    const b = bass[s % 16];
    if (b > 0) this.note(ctx, t, 'sawtooth', b, 0.16, 0.28, 520);
    const l = lead[s];
    if (l > 0) this.note(ctx, t, 'triangle', l, 0.15, 0.2, 2600);
    if (s % 4 === 0) this.kick(ctx, t, 0.34);
    if (s % 4 === 2) this.snare(ctx, t, 0.16);
    if (s % 2 === 1) this.hat(ctx, t, 0.035, 0.1);
  }

  /** 精英 / Boss 压迫节拍 */
  private playBoss(ctx: AudioContext, t: number, s: number): void {
    const bass = [
      73.42, 73.42, 0, 73.42, 87.31, 0, 82.41, 73.42,
      73.42, 73.42, 0, 110.0, 98.0, 0, 87.31, 82.41,
    ];
    const lead = [
      293.66, 0, 349.23, 0, 440.0, 0, 415.3, 349.23,
      293.66, 0, 261.63, 0, 293.66, 329.63, 349.23, 0,
      587.33, 0, 523.25, 0, 440.0, 0, 349.23, 440.0,
      523.25, 0, 440.0, 349.23, 329.63, 0, 293.66, 0,
    ];
    const b = bass[s % 16];
    if (b > 0) this.note(ctx, t, 'sawtooth', b, 0.14, 0.36, 680);
    const l = lead[s];
    if (l > 0) this.note(ctx, t, 'square', l, 0.13, 0.14, 1800);
    if (s % 4 === 0 || s % 8 === 6) this.kick(ctx, t, 0.42);
    if (s % 4 === 2) this.snare(ctx, t, 0.22);
    this.hat(ctx, t, 0.03, s % 2 === 0 ? 0.07 : 0.13);
  }

  private note(ctx: AudioContext, t: number, type: OscillatorType, freq: number, dur: number, vol: number, lowpass: number): void {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp).connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private snare(ctx: AudioContext, t: number, vol: number): void {
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1850;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.1);
  }

  private hat(ctx: AudioContext, t: number, dur: number, vol: number): void {
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const bgm = new BgmEngine();
