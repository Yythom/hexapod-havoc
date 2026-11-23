import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, MAX_ENEMIES, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import type { DifficultyDef } from '../data/difficulty';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import type { SpawnRule, WaveDef } from '../data/waves';
import type { Effects } from './Effects';
import type { EnemyManager } from './EnemyManager';

interface Pending {
  def: EnemyDef;
  x: number;
  y: number;
  t: number;
  /** 预警总时长（精英、Boss 更长） */
  total: number;
  mound: Phaser.GameObjects.Image;
}

/** 刷出前土堆预警的时长 */
const WARN_TIME = 0.8;
/** 刷新点离玩家的距离范围 */
const MIN_DIST = 260;
const MAX_DIST = 650;
const GROUP_SPREAD = 40;

export class SpawnSystem {
  private wave: WaveDef | null = null;
  private waveNo = 1;
  private timers: number[] = [];
  /** 刷怪间隔倍率（难度） */
  private intervalMult = 1;
  /** 本波还没刷出的精英/Boss */
  private specials: { id: string; at: number }[] = [];
  private readonly pending: Pending[] = [];
  private readonly moundPool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: EnemyManager,
    private readonly fx: Effects,
  ) {}

  startWave(def: WaveDef, waveNo: number, difficulty: DifficultyDef): void {
    this.clear();
    this.wave = def;
    this.waveNo = waveNo;
    this.intervalMult = difficulty.spawnInterval;
    this.timers = def.rules.map(() => 0);
    this.specials = [];
    if (def.boss) this.specials.push({ id: def.boss, at: 1 });
    for (const e of def.elites ?? []) for (let k = 0; k < e.count; k++) this.specials.push({ id: e.enemy, at: e.at + k * 0.8 });
    // 小雨及以上：第 5 波起，每隔 3 波混入一只精英（本来就有精英的波次和 Boss 波除外）
    if (difficulty.extraElites && waveNo >= 5 && (waveNo - 5) % 3 === 0 && !def.elites && !def.boss) {
      this.specials.push({ id: 'soldier', at: 6 });
    }
  }

  update(dt: number, elapsed: number, px: number, py: number): void {
    const w = this.wave;
    if (w) {
      const stopAt = w.duration === null ? Infinity : w.duration - 1.5;
      w.rules.forEach((rule, i) => {
        if (elapsed < (rule.from ?? 0.5) || elapsed > (rule.until ?? stopAt)) return;
        this.timers[i] -= dt;
        if (this.timers[i] <= 0) {
          this.timers[i] += rule.every * this.intervalMult;
          this.spawnGroup(rule, px, py);
        }
      });
      for (let i = this.specials.length - 1; i >= 0; i--) {
        if (elapsed < this.specials[i].at) continue;
        const def = ENEMIES[this.specials[i].id];
        this.specials.splice(i, 1);
        const [x, y] = this.pickCenter(px, py);
        const t = def.boss ? 1.6 : 1.2;
        const mound = this.acquireMound().setPosition(x, y).setScale((def.boss ? 1.5 : 1) / SPRITE_RES);
        this.pending.push({ def, x, y, t, total: t, mound });
      }
    }

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t > 0) {
        const k = 1 - p.t / p.total;
        const big = p.def.boss ? 3 : p.def.elite ? 2 : 1;
        p.mound.setScale(((0.5 + 0.5 * k + Math.sin(k * 28) * 0.05) * big) / SPRITE_RES);
        continue;
      }
      this.releaseMound(p.mound);
      this.pending[i] = this.pending[this.pending.length - 1];
      this.pending.pop();
      this.enemies.spawn(p.def, p.x, p.y, this.waveNo);
      this.fx.burst(p.x, p.y, 0x6b4a2b, 6, 110, 0.9);
    }
  }

  /** 停止刷怪，清掉所有预警 */
  clear(): void {
    this.wave = null;
    for (const p of this.pending) this.releaseMound(p.mound);
    this.pending.length = 0;
  }

  private spawnGroup(rule: SpawnRule, px: number, py: number): void {
    const def = ENEMIES[rule.enemy];
    const room = MAX_ENEMIES - this.enemies.count - this.pending.length;
    const n = Math.min(Phaser.Math.Between(rule.group[0], rule.group[1]), room);
    if (n <= 0) return;
    const [cx, cy] = this.pickCenter(px, py);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * GROUP_SPREAD;
      const x = Phaser.Math.Clamp(cx + Math.cos(a) * r, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
      const y = Phaser.Math.Clamp(cy + Math.sin(a) * r, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
      const mound = this.acquireMound().setPosition(x, y).setScale(0.5 / SPRITE_RES);
      const t = WARN_TIME + i * 0.06;
      this.pending.push({ def, x, y, t, total: t, mound });
    }
  }

  private pickCenter(px: number, py: number): [number, number] {
    const m = WORLD_MARGIN + GROUP_SPREAD;
    for (let tries = 0; tries < 16; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = Phaser.Math.Between(MIN_DIST, MAX_DIST);
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      if (x > m && x < WORLD_WIDTH - m && y > m && y < WORLD_HEIGHT - m) return [x, y];
    }
    // 兜底：全图随机找一个够远的点
    for (;;) {
      const x = Phaser.Math.Between(m, WORLD_WIDTH - m);
      const y = Phaser.Math.Between(m, WORLD_HEIGHT - m);
      if (Math.hypot(x - px, y - py) >= MIN_DIST) return [x, y];
    }
  }

  private acquireMound(): Phaser.GameObjects.Image {
    const m = this.moundPool.pop() ?? this.scene.add.image(0, 0, 'mound').setDepth(DEPTH.mound);
    return m.setVisible(true);
  }

  private releaseMound(m: Phaser.GameObjects.Image): void {
    m.setVisible(false);
    this.moundPool.push(m);
  }
}
