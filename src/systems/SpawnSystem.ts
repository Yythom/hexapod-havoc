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
  /** 随机波次小事件触发回调（供 HUD 播报横幅） */
  onEvent: ((title: string, color: string) => void) | null = null;
  /** 金露花抢点事件触发回调 */
  onBloom: (() => void) | null = null;
  private wave: WaveDef | null = null;
  private waveNo = 1;
  private timers: number[] = [];
  /** 刷怪间隔倍率（难度） */
  private intervalMult = 1;
  /** 本波还没刷出的精英/Boss */
  private specials: { id: string; at: number }[] = [];
  private treeTimer = 4;
  private shroomTimer = 11;
  private dewTimer = 16;
  private dewIntervalMult = 1;
  private boomParty = false;
  private lootbugAt = Infinity;
  private rng: () => number = Math.random;
  /** 随机波次事件 */
  private eventAt = Infinity;
  private eventKind: 'swarm' | 'treasure' | 'grove' | 'bloom' | null = null;
  private swarmRushLeft = 0;
  private readonly pending: Pending[] = [];
  private readonly moundPool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: EnemyManager,
    private readonly fx: Effects,
  ) {}

  private randRange(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  private randInt(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  startWave(
    def: WaveDef,
    waveNo: number,
    difficulty: DifficultyDef,
    spawnRatePct = 0,
    alwaysLootbug = false,
    extraOpts?: { boomParty?: boolean; extraElite?: boolean; dewIntervalMult?: number; rng?: () => number },
  ): void {
    this.clear();
    this.wave = def;
    this.waveNo = waveNo;
    this.rng = extraOpts?.rng ?? Math.random;
    this.dewIntervalMult = Math.max(0.4, extraOpts?.dewIntervalMult ?? 1);
    this.boomParty = !!extraOpts?.boomParty;
    this.intervalMult = difficulty.spawnInterval / Math.max(0.5, 1 + spawnRatePct);
    this.timers = def.rules.map(() => 0);
    this.treeTimer = 6;
    this.shroomTimer = this.boomParty ? 5 : waveNo >= 3 ? this.randRange(12, 18) : Infinity;
    this.dewTimer = waveNo >= 4 && !def.boss ? this.randRange(14, 22) * this.dewIntervalMult : Infinity;
    const guaranteedLoot = waveNo === 5 || waveNo === 11 || waveNo === 17 || (alwaysLootbug && waveNo >= 2);
    this.lootbugAt = (waveNo >= 3 || (alwaysLootbug && waveNo >= 2)) && !def.boss && (guaranteedLoot || this.rng() < 0.35) ? this.randRange(10, 22) : Infinity;
    this.swarmRushLeft = 0;
    // 第 6 / 12 / 18 波必出「金露花绽放」动态抢点，其余波次 35% 概率触发中段事件
    if (waveNo >= 4 && !def.boss && def.duration) {
      if ((waveNo === 6 || waveNo === 12 || waveNo === 18) && !def.elites) {
        this.eventAt = def.duration * 0.34;
        this.eventKind = 'bloom';
      } else if (!def.elites && this.rng() < 0.35) {
        this.eventAt = def.duration * this.randRange(0.36, 0.5);
        const kinds: ('swarm' | 'treasure' | 'grove' | 'bloom')[] = ['swarm', 'treasure', 'grove', 'bloom'];
        this.eventKind = kinds[Math.floor(this.rng() * kinds.length)];
      } else {
        this.eventAt = Infinity;
        this.eventKind = null;
      }
    } else {
      this.eventAt = Infinity;
      this.eventKind = null;
    }
    this.specials = [];
    if (def.boss) {
      const bossId = def.boss === 'boss_pool' ? (this.rng() < 0.5 ? 'mantis' : 'goliath_boss') : def.boss;
      this.specials.push({ id: bossId, at: 1 });
    }
    for (const e of def.elites ?? []) for (let k = 0; k < e.count; k++) this.specials.push({ id: e.enemy, at: e.at + k * 0.8 });
    // 小雨及以上：第 7 波起，每隔 3 波混入一只精英（兵蚁 / 皇家胡蜂 / 曜石甲像三轮换）
    if (difficulty.extraElites && waveNo >= 7 && (waveNo - 7) % 3 === 0 && !def.elites && !def.boss) {
      const pool = ['soldier', 'hornet_elite', 'gargoyle_elite'];
      const idx = Math.floor((waveNo - 7) / 3) % pool.length;
      this.specials.push({ id: pool[idx], at: 6 });
    }
    // 第 6~10 波偶尔游走刷出 1 只厄运紫蛞蝓（Sea Pig），让玩家自由决定是否叠诅咒刷钱
    if (waveNo >= 6 && waveNo <= 10 && !def.boss && this.rng() < 0.32) {
      this.specials.push({ id: 'curse_slug', at: this.randRange(12, 24) });
    }
    // 猎王悬赏赌约：额外空降一只精英怪
    if (extraOpts?.extraElite) {
      this.specials.push({ id: waveNo % 2 === 0 ? 'soldier' : 'hornet_elite', at: 5 });
    }
  }

  update(dt: number, elapsed: number, px: number, py: number): void {
    const w = this.wave;
    if (w) {
      if (this.swarmRushLeft > 0) this.swarmRushLeft = Math.max(0, this.swarmRushLeft - dt);
      const rushMult = this.swarmRushLeft > 0 ? 1.55 : 1;
      const stopAt = w.duration === null ? Infinity : w.duration - 1.5;
      w.rules.forEach((rule, i) => {
        if (elapsed < (rule.from ?? 0.5) || elapsed > (rule.until ?? stopAt)) return;
        this.timers[i] -= dt * rushMult;
        if (this.timers[i] <= 0) {
          this.timers[i] += rule.every * this.intervalMult;
          this.spawnGroup(rule, px, py);
        }
      });
      // 随机波次中段小事件
      if (elapsed >= this.eventAt && this.eventKind) {
        const kind = this.eventKind;
        this.eventAt = Infinity;
        this.eventKind = null;
        if (kind === 'swarm') {
          this.swarmRushLeft = 6.5;
          this.onEvent?.('⚡ 虫潮狂涌！', '#ff7b47');
        } else if (kind === 'treasure') {
          this.onEvent?.('★ 额外宝藏虫现身！', '#ffd44c');
          const [lx, ly] = this.pickCenter(px, py, 190, 340);
          const lb = this.enemies.spawn(ENEMIES.lootbug, lx, ly, this.waveNo);
          this.fx.ring(lb.x, lb.y, 44, 0xffd038);
        } else if (kind === 'bloom') {
          this.onEvent?.('✿ 金露花绽放！站入花圈抢夺宝箱！', '#ffd44c');
          this.onBloom?.();
        } else {
          this.onEvent?.('✿ 蜜果丰收！', '#78ec74');
          for (let k = 0; k < 2; k++) {
            const [tx, ty] = this.pickCenter(px, py, 130, 320);
            this.enemies.spawn(ENEMIES.tree, tx, ty, this.waveNo);
            this.fx.ring(tx, ty, 34, 0x62c048);
          }
        }
      }
      for (let i = this.specials.length - 1; i >= 0; i--) {
        if (elapsed < this.specials[i].at) continue;
        const def = ENEMIES[this.specials[i].id];
        this.specials.splice(i, 1);
        const [x, y] = this.pickCenter(px, py);
        const t = def.boss ? 1.6 : 1.2;
        const mound = this.acquireMound().setPosition(x, y).setScale((def.boss ? 1.5 : 1) / SPRITE_RES);
        this.pending.push({ def, x, y, t, total: t, mound });
      }
      // 蜜树：每隔 13 秒在场内长一棵（最多 3 棵）
      this.treeTimer -= dt;
      if (this.treeTimer <= 0) {
        this.treeTimer = 13;
        let trees = 0;
        for (const e of this.enemies.active) if (e.def.id === 'tree') trees++;
        if (trees < 3 && this.enemies.count < MAX_ENEMIES) {
          const [tx, ty] = this.pickCenter(px, py, 140, 360);
          this.enemies.spawn(ENEMIES.tree, tx, ty, this.waveNo);
          this.fx.burst(tx, ty, 0x62c048, 6, 90, 0.8);
        }
      }
      // 爆裂毒菇：第 3 波起偶尔长出可打爆的战术爆炸菇（爆裂派对下翻倍刷新并加刷气囊虫）
      this.shroomTimer -= dt;
      if (this.shroomTimer <= 0) {
        this.shroomTimer = this.boomParty ? 9 : 24;
        let shrooms = 0;
        for (const e of this.enemies.active) if (e.def.id === 'boomshroom') shrooms++;
        const cap = this.boomParty ? 3 : 1;
        if (shrooms < cap && this.enemies.count < MAX_ENEMIES) {
          const [sx, sy] = this.pickCenter(px, py, 150, 340);
          this.enemies.spawn(ENEMIES.boomshroom, sx, sy, this.waveNo);
          this.fx.ring(sx, sy, 32, 0xff6288);
        }
        if (this.boomParty && this.enemies.count < MAX_ENEMIES) {
          const [gx, gy] = this.pickCenter(px, py, 240, 420);
          this.enemies.spawn(ENEMIES.gasbag, gx, gy, this.waveNo);
        }
      }
      // 露珠冰球：第 4 波起偶尔刷出可打爆的冰冻水浪球（场上最多 1 颗）
      this.dewTimer -= dt;
      if (this.dewTimer <= 0) {
        this.dewTimer = 26 * this.dewIntervalMult;
        let orbs = 0;
        for (const e of this.enemies.active) if (e.def.id === 'deworb') orbs++;
        if (orbs < 1 && this.enemies.count < MAX_ENEMIES) {
          const [dx, dy] = this.pickCenter(px, py, 160, 340);
          this.enemies.spawn(ENEMIES.deworb, dx, dy, this.waveNo);
          this.fx.ring(dx, dy, 32, 0x62e2ff);
        }
      }
      // 宝藏虫：第 2 波起每波出没一次
      if (elapsed >= this.lootbugAt) {
        this.lootbugAt = Infinity;
        const [lx, ly] = this.pickCenter(px, py, 200, 340);
        const lb = this.enemies.spawn(ENEMIES.lootbug, lx, ly, this.waveNo);
        this.fx.ring(lb.x, lb.y, 42, 0xffd038);
        this.fx.number(lb.x, lb.y - 24, '宝藏虫！', 'crit');
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
    const n = Math.min(this.randInt(rule.group[0], rule.group[1]), room);
    if (n <= 0) return;
    const [cx, cy] = this.pickCenter(px, py);
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = this.rng() * GROUP_SPREAD;
      const x = Phaser.Math.Clamp(cx + Math.cos(a) * r, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
      const y = Phaser.Math.Clamp(cy + Math.sin(a) * r, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
      const mound = this.acquireMound().setPosition(x, y).setScale(0.5 / SPRITE_RES);
      const t = WARN_TIME + i * 0.06;
      this.pending.push({ def, x, y, t, total: t, mound });
    }
  }

  private pickCenter(px: number, py: number, minD = MIN_DIST, maxD = MAX_DIST): [number, number] {
    const m = WORLD_MARGIN + GROUP_SPREAD;
    for (let tries = 0; tries < 16; tries++) {
      const a = this.rng() * Math.PI * 2;
      const r = this.randRange(minD, maxD);
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      if (x > m && x < WORLD_WIDTH - m && y > m && y < WORLD_HEIGHT - m) return [x, y];
    }
    // 兜底：全图随机找一个够远的点
    for (;;) {
      const x = this.randRange(m, WORLD_WIDTH - m);
      const y = this.randRange(m, WORLD_HEIGHT - m);
      if (Math.hypot(x - px, y - py) >= minD) return [x, y];
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
