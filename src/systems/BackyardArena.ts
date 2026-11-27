import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { DEPTH, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import { BIOMES, DEFAULT_BIOME, type BiomeDef } from '../data/biomes';
import type { SnapArena } from '../net/protocol';
import type { Effects } from './Effects';
import { MAX_ENEMY_RADIUS, type Enemy, type EnemyManager } from './EnemyManager';
import type { Telegraphs } from './Telegraphs';

interface Puddle {
  x: number;
  y: number;
  r: number;
  /** Infinity 表示常驻水洼，否则为临时水洼倒计时 */
  life: number;
  phase: number;
  flash: number;
}

interface LeafPile {
  x: number;
  y: number;
  r: number;
  /** >0 表示正在燃烧的剩余秒数 */
  burnLeft: number;
  /** 点燃后传火给相邻干叶堆的延迟 */
  spreadLeft: number;
  /** 烧尽后的焦黑冷却秒数（归零后重新长出干叶） */
  cooldown: number;
  tick: number;
  dps: number;
  seed: number;
}

export interface ArenaObstacle {
  x: number;
  y: number;
  r: number;
}

interface BloomZone {
  x: number;
  y: number;
  r: number;
  /** 剩余存活秒数 */
  life: number;
  /** 玩家站在圈内已充能秒数（满 3.5 秒盛开） */
  charge: number;
  need: number;
}

interface Decoy {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  damage: number;
}

interface FlamePatch {
  x: number;
  y: number;
  r: number;
  life: number;
  tick: number;
  dps: number;
}

interface AmbientStrike {
  x: number;
  y: number;
  r: number;
  t: number;
  enemyDamage: number;
  playerDamage: number;
}

export interface ArenaHost {
  px: number;
  py: number;
  pr: number;
  /** 双人联机：P1 是否存活（倒地时不可充能金露花也不再吃天雷） */
  p1Alive?: boolean;
  wave: number;
  /** 双人联机：额外检查 2P 坐标（用于金露花抢点与自然天雷） */
  p2?: { x: number; y: number; r: number; alive: boolean };
  hurtPlayer(damage: number): void;
  hurtPlayer2?(damage: number): void;
  onBloomComplete(x: number, y: number): void;
  onArenaHint(text: string): void;
}

/**
 * 后院战场生态与互动系统：
 * - 雨天积水洼（敌人踩入潮湿：受冰/电/元素伤 +25%；雷击/闪电落入水洼全域导电）
 * - 暴雨/雷暴周期性定向阵风
 * - 雷暴自然天雷（可把精英怪引到落雷预警圈里借雷击杀）
 * - 动态抢点事件「金露花绽放」
 * - 蝉冲刺「金蝉蜕壳」诱饵 & 炽翼靴冲刺烈焰火迹
 */
export class BackyardArena {
  host!: ArenaHost;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly topGfx: Phaser.GameObjects.Graphics;
  private weather = 0;
  private biome: BiomeDef = BIOMES[DEFAULT_BIOME];
  private rng: () => number = Math.random;
  private puddles: Puddle[] = [];
  private leafPiles: LeafPile[] = [];
  private stumps: ArenaObstacle[] = [];
  private bloom: BloomZone | null = null;
  private decoys: Decoy[] = [];
  private flames: FlamePatch[] = [];
  private strikes: AmbientStrike[] = [];
  private buf: Enemy[] = [];
  private elapsed = 0;
  private windCd = 11;
  private windLeft = 0;
  private windAng = 0;
  private stormCd = 7;

  constructor(
    scene: Phaser.Scene,
    private readonly fx: Effects,
    private readonly tel: Telegraphs,
  ) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.mound - 2);
    this.topGfx = scene.add.graphics().setDepth(DEPTH.text - 3);
  }

  get activeBloom(): { x: number; y: number } | null {
    return this.bloom ? { x: this.bloom.x, y: this.bloom.y } : null;
  }

  /** 场内静态木桩掩体列表（挡敌弹 & 柔和绕行） */
  get obstacles(): readonly ArenaObstacle[] {
    return this.stumps;
  }

  snapshot(): SnapArena {
    return {
      puddles: this.puddles.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(p.r)]),
      leaves: this.leafPiles
        .filter((lp) => lp.cooldown <= 0)
        .map((lp) => [Math.round(lp.x), Math.round(lp.y), Math.round(lp.r), Math.round(lp.burnLeft * 10) / 10]),
      stumps: this.stumps.map((s) => [Math.round(s.x), Math.round(s.y), Math.round(s.r)]),
      bloom: this.bloom
        ? [Math.round(this.bloom.x), Math.round(this.bloom.y), Math.round(this.bloom.r), Math.round((this.bloom.charge / this.bloom.need) * 100) / 100]
        : null,
      flames: this.flames.map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.r)]),
      decoys: this.decoys.map((d) => [Math.round(d.x), Math.round(d.y)]),
    };
  }

  /** 当前阵风给移动/弹道施加的轻微矢量偏置 */
  get windVector(): [number, number] {
    if (this.windLeft <= 0) return [0, 0];
    return [Math.cos(this.windAng) * 28, Math.sin(this.windAng) * 28];
  }

  private randRange(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  startWave(weather: number, biome: BiomeDef = BIOMES[DEFAULT_BIOME], rng: () => number = Math.random): void {
    this.clear();
    this.weather = weather;
    this.biome = biome;
    this.rng = rng;
    this.elapsed = 0;
    this.windCd = 10 + rng() * 4;
    this.windLeft = 0;
    this.stormCd = 6.5;

    // 1. 青苔池塘：4 处常驻大水洼（均匀分散）
    const extraPuddles = biome.extraPuddles ?? 0;
    for (let i = 0; i < extraPuddles; i++) {
      const r = Math.round(this.randRange(106, 134));
      let px = WORLD_WIDTH / 2;
      let py = WORLD_HEIGHT / 2;
      for (let tries = 0; tries < 24; tries++) {
        const cx = this.randRange(WORLD_MARGIN + 220, WORLD_WIDTH - WORLD_MARGIN - 220);
        const cy = this.randRange(WORLD_MARGIN + 180, WORLD_HEIGHT - WORLD_MARGIN - 180);
        const farEnough = this.puddles.every((p) => Math.hypot(cx - p.x, cy - p.y) >= p.r + r + 70);
        if (farEnough) {
          px = cx;
          py = cy;
          break;
        }
      }
      this.puddles.push({ x: px, y: py, r, life: Infinity, phase: rng() * 6, flash: 0 });
    }

    // 2. 小雨及以上额外生成 2~3 处后院积水洼
    if (weather >= 2) {
      const count = weather >= 3 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const x = Math.round(this.randRange(WORLD_MARGIN + 220, WORLD_WIDTH - WORLD_MARGIN - 220));
        const y = Math.round(this.randRange(WORLD_MARGIN + 180, WORLD_HEIGHT - WORLD_MARGIN - 180));
        this.puddles.push({ x, y, r: Math.round(this.randRange(74, 98)), life: Infinity, phase: rng() * 6, flash: 0 });
      }
    }

    // 3. 枯叶树洞：5 处可引燃干叶堆 + 2 根天然木桩掩体
    const leafCount = biome.leafPiles ?? 0;
    for (let i = 0; i < leafCount; i++) {
      const r = Math.round(this.randRange(64, 78));
      let lx = WORLD_WIDTH / 2;
      let ly = WORLD_HEIGHT / 2;
      for (let tries = 0; tries < 24; tries++) {
        const cx = this.randRange(WORLD_MARGIN + 210, WORLD_WIDTH - WORLD_MARGIN - 210);
        const cy = this.randRange(WORLD_MARGIN + 170, WORLD_HEIGHT - WORLD_MARGIN - 170);
        if (Math.hypot(cx - WORLD_WIDTH / 2, cy - WORLD_HEIGHT / 2) < 135) continue;
        const ok = this.leafPiles.every((p) => Math.hypot(cx - p.x, cy - p.y) >= p.r + r + 36);
        if (ok) {
          lx = cx;
          ly = cy;
          break;
        }
      }
      this.leafPiles.push({ x: lx, y: ly, r, burnLeft: 0, spreadLeft: 0, cooldown: 0, tick: 0, dps: 0, seed: rng() * 10 });
    }

    const stumpCount = biome.stumpCount ?? 0;
    const baseAng = rng() * Math.PI * 2;
    for (let i = 0; i < stumpCount; i++) {
      const a = baseAng + (i * Math.PI * 2) / Math.max(1, stumpCount) + this.randRange(-0.4, 0.4);
      const dist = this.randRange(260, 410);
      const sx = Phaser.Math.Clamp(WORLD_WIDTH / 2 + Math.cos(a) * dist, WORLD_MARGIN + 160, WORLD_WIDTH - WORLD_MARGIN - 160);
      const sy = Phaser.Math.Clamp(WORLD_HEIGHT / 2 + Math.sin(a) * dist, WORLD_MARGIN + 140, WORLD_HEIGHT - WORLD_MARGIN - 140);
      this.stumps.push({ x: sx, y: sy, r: 26 });
    }
  }

  /** 火焰/灼烧命中或火迹经过时，引燃附近的枯叶树洞干叶堆 */
  igniteAt(x: number, y: number, dps: number): boolean {
    if (this.leafPiles.length === 0) return false;
    let lit = false;
    const baseDps = Math.max(dps, 14 + (this.host?.wave ?? 1) * 4);
    for (const lp of this.leafPiles) {
      if (lp.burnLeft > 0 || lp.cooldown > 0) continue;
      const dx = x - lp.x;
      const dy = y - lp.y;
      const rr = lp.r + 48;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.igniteLeafPile(lp, baseDps);
      lit = true;
    }
    return lit;
  }

  private igniteLeafPile(lp: LeafPile, dps: number): void {
    lp.burnLeft = 5.5;
    lp.spreadLeft = 0.38;
    lp.tick = 0;
    lp.dps = Math.max(lp.dps, dps);
    this.fx.ring(lp.x, lp.y, lp.r, 0xff8a28);
    this.fx.burst(lp.x, lp.y, 0xffa838, 8, 120, 0.9);
    sfx.play('explode');
  }

  /** 露珠冰球打爆时临时生成一片 6 秒积水洼 */
  addTempPuddle(x: number, y: number, r = 96, life = 6.5): void {
    this.puddles.push({ x, y, r, life, phase: Math.random() * 6, flash: 0.4 });
  }

  /** 触发「金露花绽放」限时抢点事件 */
  spawnBloom(px: number, py: number): void {
    const m = WORLD_MARGIN + 170;
    let bx = WORLD_WIDTH / 2;
    let by = WORLD_HEIGHT / 2;
    for (let tries = 0; tries < 16; tries++) {
      const a = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(210, 380);
      const cx = px + Math.cos(a) * dist;
      const cy = py + Math.sin(a) * dist;
      if (cx > m && cx < WORLD_WIDTH - m && cy > m && cy < WORLD_HEIGHT - m) {
        bx = cx;
        by = cy;
        break;
      }
    }
    this.bloom = { x: bx, y: by, r: 92, life: 16, charge: 0, need: 3.5 };
    this.fx.ring(bx, by, 96, 0xffd84c);
  }

  /** 蝉：冲刺在起点留下金蝉蜕壳诱饵，2.5 秒后爆炸震退 */
  addDecoy(x: number, y: number, damage: number): void {
    this.decoys.push({ x, y, life: 2.5, maxLife: 2.5, damage });
    this.fx.ring(x, y, 28, 0xd8c878);
  }

  /** 炽翼靴：冲刺路径留下一团持续灼烧的烈焰火迹 */
  addFlamePatch(x: number, y: number, dps: number): void {
    this.flames.push({ x, y, r: 42, life: 3.0, tick: 0, dps });
    this.igniteAt(x, y, dps);
  }

  /** 坐标是否位于任一积水洼内 */
  isWet(x: number, y: number): boolean {
    for (const p of this.puddles) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= p.r * p.r) return true;
    }
    return false;
  }

  /** 雷电命中水洼时触发全洼导电，电击洼内所有敌人 */
  conductLightning(x: number, y: number, damage: number, enemies: EnemyManager): boolean {
    let hitAny = false;
    for (const p of this.puddles) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy > (p.r + 24) * (p.r + 24)) continue;
      p.flash = 0.45;
      hitAny = true;
      this.fx.ring(p.x, p.y, p.r, 0x7ce8ff);
      const shockDmg = Math.max(2, Math.round(damage * 0.65));
      for (const e of enemies.grid.query(p.x, p.y, p.r + MAX_ENEMY_RADIUS, this.buf).slice()) {
        if (!e.active) continue;
        const ex = e.x - p.x;
        const ey = e.y - p.y;
        if (ex * ex + ey * ey > (p.r + e.radius) ** 2) continue;
        this.fx.star(e.x, e.y, 13, 0x8ce2ff);
        enemies.hit(e, shockDmg, false, 0, 0, 50);
      }
    }
    return hitAny;
  }

  update(dt: number, enemies: EnemyManager): void {
    this.elapsed += dt;
    const h = this.host;

    // 1. 水洼更新 & 给踩进水洼的怪挂潮湿（Wet）状态
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
      if (Number.isFinite(p.life)) {
        p.life -= dt;
        if (p.life <= 0) {
          this.puddles.splice(i, 1);
          continue;
        }
      }
      for (const e of enemies.grid.query(p.x, p.y, p.r + MAX_ENEMY_RADIUS, this.buf)) {
        if (!e.active) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy <= (p.r + e.radius * 0.6) ** 2) {
          e.wetTime = Math.max(e.wetTime, 0.35);
        }
      }
    }

    // 2. 暴雨 / 雷暴周期性阵风
    if (this.weather >= 3) {
      if (this.windLeft > 0) {
        this.windLeft = Math.max(0, this.windLeft - dt);
        if (this.windLeft <= 0) {
          this.windCd = 13 + Math.random() * 4;
        }
      } else {
        this.windCd -= dt;
        if (this.windCd <= 0) {
          this.windLeft = 4.5;
          this.windAng = Math.random() * Math.PI * 2;
          sfx.play('dash');
        }
      }
    }

    // 3. 雷暴自然天雷（同时伤怪与玩家，可主动引精英进雷区！）
    if (this.weather >= 4) {
      this.stormCd -= dt;
      if (this.stormCd <= 0) {
        this.stormCd = 7.8;
        const a = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(90, 260);
        const sx = Phaser.Math.Clamp(h.px + Math.cos(a) * dist, WORLD_MARGIN + 50, WORLD_WIDTH - WORLD_MARGIN - 50);
        const sy = Phaser.Math.Clamp(h.py + Math.sin(a) * dist, WORLD_MARGIN + 50, WORLD_HEIGHT - WORLD_MARGIN - 50);
        const r = 74;
        this.strikes.push({
          x: sx,
          y: sy,
          r,
          t: 1.1,
          enemyDamage: Math.round(42 + h.wave * 18),
          playerDamage: Math.round(4 + h.wave * 0.9),
        });
        this.tel.circle(sx, sy, r, 1.1);
      }
    }

    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.strikes.splice(i, 1);
      this.fx.bolt(s.x, s.y);
      this.fx.ring(s.x, s.y, s.r, 0x9ceeff);
      sfx.play('lightning');
      // 玩家在圈内受击（双人模式两位玩家都检测）
      if (h.p1Alive !== false) {
        const pdx = h.px - s.x;
        const pdy = h.py - s.y;
        if (pdx * pdx + pdy * pdy < (s.r + h.pr) ** 2) h.hurtPlayer(s.playerDamage);
      }
      if (h.p2 && h.p2.alive) {
        const pdx2 = h.p2.x - s.x;
        const pdy2 = h.p2.y - s.y;
        if (pdx2 * pdx2 + pdy2 * pdy2 < (s.r + h.p2.r) ** 2) h.hurtPlayer2?.(s.playerDamage);
      }
      // 敌人同样吃高额天雷伤害
      for (const e of enemies.grid.query(s.x, s.y, s.r + MAX_ENEMY_RADIUS, this.buf).slice()) {
        if (!e.active) continue;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        if (dx * dx + dy * dy > (s.r + e.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        const dmg = e.def.boss ? Math.round(s.enemyDamage * 0.5) : s.enemyDamage;
        enemies.hit(e, dmg, true, dx / d, dy / d, 220);
      }
      // 天雷劈中水洼同样导电
      this.conductLightning(s.x, s.y, s.enemyDamage, enemies);
    }

    // 4. 金露花抢点圈（双人站圈内共同加速充能）
    if (this.bloom) {
      const b = this.bloom;
      b.life -= dt;
      const in1 = h.p1Alive !== false && Math.hypot(h.px - b.x, h.py - b.y) <= b.r + h.pr;
      const in2 = !!(h.p2 && h.p2.alive && Math.hypot(h.p2.x - b.x, h.p2.y - b.y) <= b.r + h.p2.r);
      if (in1 || in2) {
        b.charge += dt * (in1 && in2 ? 1.5 : 1);
        if (b.charge >= b.need) {
          const bx = b.x;
          const by = b.y;
          this.bloom = null;
          h.onBloomComplete(bx, by);
        }
      }
      if (this.bloom && b.life <= 0) {
        this.bloom = null;
      }
    }

    // 5. 金蝉蜕壳诱饵（2.5s 后爆破震退）
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.decoys.splice(i, 1);
        const r = 108;
        this.fx.explosion(d.x, d.y, r, 0xffe068, 1);
        sfx.play('explode');
        for (const e of enemies.grid.query(d.x, d.y, r + MAX_ENEMY_RADIUS, this.buf).slice()) {
          if (!e.active) continue;
          const dx = e.x - d.x;
          const dy = e.y - d.y;
          if (dx * dx + dy * dy > (r + e.radius) ** 2) continue;
          const dist = Math.hypot(dx, dy) || 1;
          enemies.hit(e, d.damage, false, dx / dist, dy / dist, 280);
        }
      }
    }

    // 6. 炽翼靴火焰火迹
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.flames.splice(i, 1);
        continue;
      }
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.35;
        for (const e of enemies.grid.query(f.x, f.y, f.r + MAX_ENEMY_RADIUS, this.buf).slice()) {
          if (!e.active) continue;
          const dx = e.x - f.x;
          const dy = e.y - f.y;
          if (dx * dx + dy * dy > (f.r + e.radius) ** 2) continue;
          enemies.applyBurn(e, f.dps);
          enemies.hit(e, Math.max(1, Math.round(f.dps * 0.4)), false, 0, 0, 0, 'burn');
        }
      }
    }

    // 7. 枯叶树洞：可燃干叶堆（着火怪踩入引燃 / 燃烧蔓延到相邻干叶堆）
    for (const lp of this.leafPiles) {
      if (lp.cooldown > 0) {
        lp.cooldown = Math.max(0, lp.cooldown - dt);
        continue;
      }
      if (lp.burnLeft > 0) {
        lp.burnLeft -= dt;
        if (lp.spreadLeft > 0) {
          lp.spreadLeft -= dt;
          if (lp.spreadLeft <= 0) {
            for (const other of this.leafPiles) {
              if (other === lp || other.burnLeft > 0 || other.cooldown > 0) continue;
              if (Math.hypot(other.x - lp.x, other.y - lp.y) <= lp.r + other.r + 130) {
                this.igniteLeafPile(other, lp.dps);
              }
            }
          }
        }
        lp.tick -= dt;
        if (lp.tick <= 0) {
          lp.tick = 0.4;
          for (const e of enemies.grid.query(lp.x, lp.y, lp.r + MAX_ENEMY_RADIUS, this.buf).slice()) {
            if (!e.active) continue;
            const dx = e.x - lp.x;
            const dy = e.y - lp.y;
            if (dx * dx + dy * dy > (lp.r + e.radius) ** 2) continue;
            enemies.applyBurn(e, lp.dps);
            enemies.hit(e, Math.max(2, Math.round(lp.dps * 0.45)), false, 0, 0, 0, 'burn');
          }
        }
        if (lp.burnLeft <= 0) {
          lp.burnLeft = 0;
          lp.cooldown = 6.5;
        }
      } else {
        // 已被点燃的怪物跑进干叶堆也会引燃干叶
        for (const e of enemies.grid.query(lp.x, lp.y, lp.r + MAX_ENEMY_RADIUS, this.buf)) {
          if (!e.active || e.burnTime <= 0) continue;
          const dx = e.x - lp.x;
          const dy = e.y - lp.y;
          if (dx * dx + dy * dy <= (lp.r + e.radius * 0.7) ** 2) {
            this.igniteLeafPile(lp, Math.max(e.burnDps, 14 + h.wave * 4));
            break;
          }
        }
      }
    }

    // 8. 枯叶树洞：天然木桩掩体对非 Boss 怪物施加柔和绕行推离
    for (const s of this.stumps) {
      for (const e of enemies.grid.query(s.x, s.y, s.r + MAX_ENEMY_RADIUS + 4, this.buf)) {
        if (!e.active || e.def.boss || e.def.speed <= 0) continue;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const minD = s.r + e.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = minD - d;
          e.x += (dx / d) * push;
          e.y += (dy / d) * push;
          e.sprite.setPosition(e.x, e.y);
        }
      }
    }

    // 更新 HUD 提示文本
    const hints: string[] = [];
    if (this.bloom) hints.push(`✿ 金露花充能 ${Math.min(100, Math.round((this.bloom.charge / this.bloom.need) * 100))}%`);
    if (this.windLeft > 0) hints.push('〰 暴雨阵风');
    else if (this.weather >= 4) hints.push('⚡ 雷暴天雷（可引怪）');
    else if (this.biome.id === 'hollow' && this.leafPiles.length > 0) {
      const litCount = this.leafPiles.filter((lp) => lp.burnLeft > 0).length;
      hints.push(litCount > 0 ? `🔥 干叶火墙燃烧中 ×${litCount}` : '🍂 干叶堆遇火蔓延 · 木桩可挡弹');
    } else if (this.puddles.length > 0) {
      hints.push(this.biome.id === 'pond' ? '💧 青苔池塘（冰/电+25% · 湿滑）' : '💧 水洼潮湿（冰/电+25%）');
    }
    h.onArenaHint(hints.join(' · '));

    this.draw();
  }

  clear(): void {
    this.puddles = [];
    this.leafPiles = [];
    this.stumps = [];
    this.bloom = null;
    this.decoys = [];
    this.flames = [];
    this.strikes = [];
    this.windLeft = 0;
    this.gfx.clear();
    this.topGfx.clear();
  }

  private draw(): void {
    const g = this.gfx;
    const tg = this.topGfx;
    g.clear();
    tg.clear();

    // 积水洼
    for (const p of this.puddles) {
      const fade = Number.isFinite(p.life) ? Math.min(1, p.life / 0.8) : 1;
      const wave = 1 + Math.sin(this.elapsed * 2.4 + p.phase) * 0.03;
      const rx = p.r * wave;
      const ry = p.r * 0.82 * wave;
      const col = p.flash > 0 ? 0x9ceeff : 0x2a6c98;
      g.fillStyle(col, (p.flash > 0 ? 0.36 : 0.22) * fade);
      g.fillEllipse(p.x, p.y, rx * 2, ry * 2);
      g.lineStyle(2, p.flash > 0 ? 0xe8ffff : 0x76c8f0, (p.flash > 0 ? 0.85 : 0.42) * fade);
      g.strokeEllipse(p.x, p.y, rx * 2, ry * 2);
      // 水面高光波纹
      const rip = ((this.elapsed * 0.55 + p.phase) % 1) * rx * 0.8;
      g.lineStyle(1.4, 0xc8f0ff, (1 - rip / (rx * 0.85)) * 0.3 * fade);
      g.strokeEllipse(p.x, p.y, rip * 2, rip * 1.5);
    }

    // 枯叶树洞：干叶堆（干枯态 / 烈焰燃烧态 / 焦黑恢复态）
    for (const lp of this.leafPiles) {
      if (lp.burnLeft > 0) {
        const a = Math.min(1, lp.burnLeft / 0.8);
        const pulse = 1 + Math.sin(this.elapsed * 14 + lp.seed) * 0.05;
        g.fillStyle(0xff5214, 0.28 * a);
        g.fillCircle(lp.x, lp.y, lp.r * pulse);
        g.fillStyle(0xffaa2c, 0.18 * a);
        g.fillCircle(lp.x, lp.y, lp.r * 0.65 * pulse);
        g.lineStyle(2.6, 0xffb838, 0.82 * a);
        g.strokeCircle(lp.x, lp.y, lp.r * pulse);
        for (let k = 0; k < 5; k++) {
          const ang = this.elapsed * 2.4 + lp.seed + (k * Math.PI * 2) / 5;
          const dist = lp.r * (0.32 + 0.38 * Math.abs(Math.sin(this.elapsed * 6 + k)));
          tg.fillStyle(k % 2 === 0 ? 0xffe068 : 0xff7824, 0.72 * a);
          tg.fillCircle(lp.x + Math.cos(ang) * dist, lp.y + Math.sin(ang) * dist, 5.5);
        }
      } else if (lp.cooldown > 0) {
        const fade = Math.min(1, lp.cooldown / 1.5);
        g.fillStyle(0x161210, 0.34 * fade);
        g.fillCircle(lp.x, lp.y, lp.r * 0.88);
        g.lineStyle(1.4, 0x48382c, 0.35 * fade);
        g.strokeCircle(lp.x, lp.y, lp.r * 0.88);
      } else {
        g.fillStyle(0x885224, 0.22);
        g.fillCircle(lp.x, lp.y, lp.r);
        g.lineStyle(1.8, 0xd4883a, 0.48);
        g.strokeCircle(lp.x, lp.y, lp.r);
        for (let k = 0; k < 7; k++) {
          const a = lp.seed + k * 2.39996;
          const dist = lp.r * (0.22 + ((k * 0.13) % 0.56));
          const lx = lp.x + Math.cos(a) * dist;
          const ly = lp.y + Math.sin(a) * dist;
          g.fillStyle(k % 3 === 0 ? 0xc26e2c : k % 3 === 1 ? 0x9c4d20 : 0xd4963c, 0.65);
          g.fillEllipse(lx, ly, 16, 8);
          g.lineStyle(1.1, 0x261408, 0.7);
          g.strokeEllipse(lx, ly, 16, 8);
        }
      }
    }

    // 枯叶树洞：天然苔木桩掩体（可挡敌弹）
    for (const s of this.stumps) {
      g.fillStyle(0x060504, 0.48);
      g.fillEllipse(s.x + 4, s.y + 5, s.r * 2.15, s.r * 1.9);
      g.fillStyle(0x462b16, 1);
      g.fillCircle(s.x, s.y, s.r);
      g.lineStyle(3, 0x0b0806, 0.95);
      g.strokeCircle(s.x, s.y, s.r);
      g.fillStyle(0x8a653e, 1);
      g.fillCircle(s.x, s.y - 1, s.r * 0.78);
      g.lineStyle(1.5, 0x3b2514, 0.7);
      g.strokeCircle(s.x, s.y - 1, s.r * 0.5);
      g.strokeCircle(s.x, s.y - 1, s.r * 0.25);
      g.fillStyle(0x528840, 0.85);
      g.fillEllipse(s.x - s.r * 0.45, s.y + s.r * 0.42, 16, 9);
    }

    // 烈焰火迹
    for (const f of this.flames) {
      const a = Math.min(1, f.life / 0.6);
      g.fillStyle(0xff5a18, 0.26 * a);
      g.fillCircle(f.x, f.y, f.r);
      g.lineStyle(2, 0xffaa38, 0.65 * a);
      g.strokeCircle(f.x, f.y, f.r * (0.88 + 0.1 * Math.sin(this.elapsed * 14)));
    }

    // 金露花抢点圈
    if (this.bloom) {
      const b = this.bloom;
      const ratio = Math.min(1, b.charge / b.need);
      const pulse = 1 + Math.sin(this.elapsed * 5.5) * 0.04;
      g.fillStyle(0xffd44c, 0.1 + ratio * 0.16);
      g.fillCircle(b.x, b.y, b.r * pulse);
      g.lineStyle(3, 0x050507, 0.75);
      g.strokeCircle(b.x, b.y, b.r);
      g.lineStyle(2.4, 0xffd84c, 0.85);
      g.strokeCircle(b.x, b.y, b.r);
      // 充能圆弧
      if (ratio > 0.01) {
        tg.lineStyle(5, 0x5de862, 0.95);
        tg.beginPath();
        tg.arc(b.x, b.y, b.r + 5, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        tg.strokePath();
      }
      // 中心发光花蕊
      const petalR = 14 + ratio * 8;
      tg.fillStyle(0xffe068, 0.92);
      for (let k = 0; k < 6; k++) {
        const a = this.elapsed * 1.2 + (k / 6) * Math.PI * 2;
        tg.fillCircle(b.x + Math.cos(a) * petalR, b.y + Math.sin(a) * petalR, 6.5);
      }
      tg.fillStyle(0xffffff, 0.95);
      tg.fillCircle(b.x, b.y, 7);
    }

    // 金蝉蜕壳诱饵
    for (const d of this.decoys) {
      const ratio = 1 - d.life / d.maxLife;
      const pulse = 1 + Math.sin(this.elapsed * 18) * 0.12;
      tg.fillStyle(0xd8c878, 0.55);
      tg.fillCircle(d.x, d.y, 16 * pulse);
      tg.lineStyle(2.4, 0xffe468, 0.9);
      tg.strokeCircle(d.x, d.y, 16 + ratio * 22);
    }

    // 阵风视觉流线（沿玩家周围画 8 条半透明风痕）
    if (this.windLeft > 0) {
      const ux = Math.cos(this.windAng);
      const uy = Math.sin(this.windAng);
      const px = this.host.px;
      const py = this.host.py;
      tg.lineStyle(2, 0xd4ecff, 0.34);
      for (let k = 0; k < 8; k++) {
        const seed = k * 97.3;
        const drift = ((this.elapsed * 320 + seed * 7) % 520) - 260;
        const side = ((k % 4) - 1.5) * 115 + Math.sin(seed) * 28;
        const x0 = px + ux * drift - uy * side;
        const y0 = py + uy * drift + ux * side;
        tg.beginPath();
        tg.moveTo(x0, y0);
        tg.lineTo(x0 + ux * 46, y0 + uy * 46);
        tg.strokePath();
      }
    }
  }
}
