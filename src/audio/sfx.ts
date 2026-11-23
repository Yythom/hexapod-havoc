/**
 * 音效：全部用 Web Audio 现场合成（振荡器 + 噪声 + 滤波），不依赖音频文件。
 * 浏览器要求用户操作后才能出声，所以第一次点击或按键时才真正启动。
 */

export type SfxName =
  | 'shoot'
  | 'shootHeavy'
  | 'spray'
  | 'melee'
  | 'hit'
  | 'kill'
  | 'killBig'
  | 'nectar'
  | 'chest'
  | 'heal'
  | 'hurt'
  | 'dodge'
  | 'shield'
  | 'levelUp'
  | 'explode'
  | 'lightning'
  | 'spit'
  | 'warn'
  | 'waveStart'
  | 'waveClear'
  | 'bossRoar'
  | 'death'
  | 'victory'
  | 'click'
  | 'buy'
  | 'heartbeat'
  | 'unlock'
  | 'freeze'
  | 'zap'
  | 'flame'
  | 'beam'
  | 'place';

interface ToneOpts {
  type: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  vol: number;
  delay?: number;
  /** 低通滤波截止频率，锯齿波太刺耳时用 */
  lowpass?: number;
}

interface NoiseOpts {
  dur: number;
  vol: number;
  filter: BiquadFilterType;
  from: number;
  to?: number;
  delay?: number;
}

/** 同时发声上限，防止大量命中时爆音 */
const MAX_VOICES = 28;
/** 花蜜连捡音高递增的重置时间 */
const COMBO_RESET = 0.6;

class SfxEngine {
  /** 开发用的模拟玩家跑局时静音 */
  muted = false;
  private volume = 0.7;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly last = new Map<SfxName, number>();
  private voices = 0;
  private combo = 0;
  private comboAt = 0;

  /** 注册第一次用户操作时解锁音频 */
  init(volume: number): void {
    this.volume = volume;
    const unlock = () => this.ensure();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v * 0.6;
  }

  play(name: SfxName): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.voices >= MAX_VOICES) return;
    const now = ctx.currentTime;
    const gap = GAPS[name];
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    SOUNDS[name](this, now);
  }

  /** 花蜜：连续捡的时候音高一路往上走 */
  nectarPitch(now: number): number {
    this.combo = now - this.comboAt < COMBO_RESET ? Math.min(this.combo + 1, 24) : 0;
    this.comboAt = now;
    return Math.pow(2, this.combo / 12);
  }

  tone(t0: number, o: ToneOpts): void {
    const ctx = this.ctx!;
    const t = t0 + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.from, t);
    if (o.to && o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(o.vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node: AudioNode = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      osc.connect(f);
      node = f;
    }
    node.connect(gain).connect(this.master!);
    this.track(osc);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  noiseBurst(t0: number, o: NoiseOpts): void {
    const ctx = this.ctx!;
    const t = t0 + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.from, t);
    if (o.to && o.to !== o.from) filter.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(o.vol, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(filter).connect(gain).connect(this.master!);
    this.track(src);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.02);
  }

  private track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
  }

  private ensure(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.gain.value = this.volume * 0.6;
        this.master.connect(comp);
        // 1 秒白噪声，所有噪声类音效共用
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buf;
        this.ctx = ctx;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // 不支持 Web Audio 就静音
    }
  }
}

/** 同一个音效两次播放的最小间隔（秒），防止密集射击时糊成一片 */
const GAPS: Record<SfxName, number> = {
  shoot: 0.045,
  shootHeavy: 0.08,
  spray: 0.09,
  melee: 0.05,
  hit: 0.03,
  kill: 0.025,
  killBig: 0.15,
  nectar: 0.028,
  chest: 0.2,
  heal: 0.15,
  hurt: 0.1,
  dodge: 0.1,
  shield: 0.1,
  levelUp: 0.2,
  explode: 0.06,
  lightning: 0.08,
  spit: 0.08,
  warn: 0.25,
  waveStart: 0.5,
  waveClear: 0.5,
  bossRoar: 1,
  death: 1,
  victory: 1,
  click: 0.03,
  buy: 0.05,
  heartbeat: 0.3,
  unlock: 0.5,
  freeze: 0.08,
  zap: 0.07,
  flame: 0.12,
  beam: 0.3,
  place: 0.1,
};

type Play = (e: SfxEngine, t: number) => void;

const arpeggio = (notes: number[], step: number, dur: number, vol: number): Play => (e, t) =>
  notes.forEach((f, i) => e.tone(t, { type: 'triangle', from: f, dur, vol, delay: i * step }));

const SOUNDS: Record<SfxName, Play> = {
  shoot: (e, t) => e.tone(t, { type: 'square', from: 620, to: 300, dur: 0.07, vol: 0.05, lowpass: 3000 }),
  shootHeavy: (e, t) => {
    e.tone(t, { type: 'sawtooth', from: 220, to: 70, dur: 0.16, vol: 0.08, lowpass: 1200 });
    e.noiseBurst(t, { dur: 0.12, vol: 0.06, filter: 'lowpass', from: 1500, to: 300 });
  },
  spray: (e, t) => e.noiseBurst(t, { dur: 0.09, vol: 0.035, filter: 'bandpass', from: 2500, to: 1200 }),
  freeze: (e, t) => {
    e.tone(t, { type: 'sine', from: 1900, to: 2600, dur: 0.12, vol: 0.035 });
    e.tone(t, { type: 'triangle', from: 2900, dur: 0.1, vol: 0.025, delay: 0.035 });
  },
  zap: (e, t) => {
    e.noiseBurst(t, { dur: 0.12, vol: 0.06, filter: 'highpass', from: 3200, to: 1500 });
    e.tone(t, { type: 'square', from: 900, to: 260, dur: 0.1, vol: 0.025, lowpass: 2400 });
  },
  flame: (e, t) => e.noiseBurst(t, { dur: 0.14, vol: 0.04, filter: 'lowpass', from: 1100, to: 380 }),
  beam: (e, t) => e.tone(t, { type: 'sine', from: 560, to: 620, dur: 0.22, vol: 0.018 }),
  place: (e, t) => {
    e.tone(t, { type: 'triangle', from: 320, to: 170, dur: 0.09, vol: 0.06 });
    e.noiseBurst(t, { dur: 0.06, vol: 0.03, filter: 'lowpass', from: 900 });
  },
  melee: (e, t) => e.noiseBurst(t, { dur: 0.09, vol: 0.07, filter: 'bandpass', from: 1800, to: 500 }),
  hit: (e, t) => e.tone(t, { type: 'sine', from: 190, to: 70, dur: 0.06, vol: 0.08 }),
  kill: (e, t) => {
    e.tone(t, { type: 'triangle', from: 500, to: 1100, dur: 0.06, vol: 0.05 });
    e.noiseBurst(t, { dur: 0.05, vol: 0.03, filter: 'highpass', from: 3000 });
  },
  killBig: (e, t) => {
    e.noiseBurst(t, { dur: 0.4, vol: 0.14, filter: 'lowpass', from: 1200, to: 150 });
    e.tone(t, { type: 'sine', from: 110, to: 40, dur: 0.4, vol: 0.14 });
  },
  nectar: (e, t) => {
    const f = 880 * e.nectarPitch(t);
    e.tone(t, { type: 'sine', from: f, to: f * 1.02, dur: 0.07, vol: 0.04 });
  },
  chest: (e, t) => {
    e.tone(t, { type: 'square', from: 880, dur: 0.08, vol: 0.04, lowpass: 4000 });
    e.tone(t, { type: 'square', from: 1320, dur: 0.12, vol: 0.04, lowpass: 4000, delay: 0.08 });
  },
  heal: (e, t) => e.tone(t, { type: 'triangle', from: 523, to: 1046, dur: 0.18, vol: 0.06 }),
  hurt: (e, t) => {
    e.tone(t, { type: 'sawtooth', from: 220, to: 70, dur: 0.18, vol: 0.12, lowpass: 1500 });
    e.noiseBurst(t, { dur: 0.12, vol: 0.08, filter: 'lowpass', from: 900 });
  },
  dodge: (e, t) => e.noiseBurst(t, { dur: 0.12, vol: 0.05, filter: 'highpass', from: 1500, to: 5000 }),
  shield: (e, t) => {
    e.tone(t, { type: 'sine', from: 1320, dur: 0.25, vol: 0.07 });
    e.tone(t, { type: 'sine', from: 1980, dur: 0.25, vol: 0.04 });
  },
  levelUp: arpeggio([523, 659, 784, 1047], 0.06, 0.12, 0.07),
  explode: (e, t) => {
    e.noiseBurst(t, { dur: 0.35, vol: 0.13, filter: 'lowpass', from: 1400, to: 120 });
    e.tone(t, { type: 'sine', from: 120, to: 40, dur: 0.35, vol: 0.12 });
  },
  lightning: (e, t) => {
    e.noiseBurst(t, { dur: 0.25, vol: 0.14, filter: 'highpass', from: 2000, to: 800 });
    e.tone(t, { type: 'square', from: 70, dur: 0.3, vol: 0.05, lowpass: 600 });
  },
  spit: (e, t) => e.tone(t, { type: 'sine', from: 760, to: 300, dur: 0.09, vol: 0.04 }),
  warn: (e, t) => e.tone(t, { type: 'sine', from: 380, to: 760, dur: 0.22, vol: 0.05 }),
  waveStart: (e, t) => {
    e.tone(t, { type: 'triangle', from: 220, dur: 0.4, vol: 0.06 });
    e.tone(t, { type: 'triangle', from: 330, dur: 0.4, vol: 0.05, delay: 0.06 });
    e.tone(t, { type: 'triangle', from: 440, dur: 0.45, vol: 0.05, delay: 0.12 });
  },
  waveClear: arpeggio([784, 988, 1175], 0.09, 0.14, 0.06),
  bossRoar: (e, t) => {
    e.tone(t, { type: 'sawtooth', from: 90, to: 55, dur: 0.9, vol: 0.12, lowpass: 500 });
    e.noiseBurst(t, { dur: 0.9, vol: 0.08, filter: 'lowpass', from: 400, to: 150 });
  },
  death: (e, t) => e.tone(t, { type: 'sawtooth', from: 440, to: 55, dur: 0.7, vol: 0.12, lowpass: 1500 }),
  victory: arpeggio([523, 659, 784, 1047, 1319], 0.1, 0.25, 0.08),
  click: (e, t) => e.tone(t, { type: 'square', from: 1200, to: 1000, dur: 0.025, vol: 0.03, lowpass: 5000 }),
  buy: (e, t) => {
    e.tone(t, { type: 'square', from: 988, dur: 0.05, vol: 0.05, lowpass: 5000 });
    e.tone(t, { type: 'square', from: 1319, dur: 0.08, vol: 0.05, lowpass: 5000, delay: 0.06 });
  },
  heartbeat: (e, t) => {
    e.tone(t, { type: 'sine', from: 70, to: 50, dur: 0.12, vol: 0.2 });
    e.tone(t, { type: 'sine', from: 65, to: 45, dur: 0.12, vol: 0.14, delay: 0.17 });
  },
  unlock: arpeggio([659, 784, 1047, 1319], 0.08, 0.2, 0.07),
};

export const sfx = new SfxEngine();
