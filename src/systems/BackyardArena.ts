import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { DEPTH, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import type { Effects } from './Effects';
import { MAX_ENEMY_RADIUS, type Enemy, type EnemyManager } from './EnemyManager';
import type { Telegraphs } from './Telegraphs';

interface Puddle {
  x: number;
  y: number;
  r: number;
  /** Infinity 表示常驻雨天水洼，否则为临时水洼倒计时 */
  life: number;
  phase: number;
  flash: number;
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
  wave: number;
  hurtPlayer(damage: number): void;
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
  private puddles: Puddle[] = [];
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

  /** 当前阵风给移动/弹道施加的轻微矢量偏置 */
  get windVector(): [number, number] {
    if (this.windLeft <= 0) return [0, 0];
    return [Math.cos(this.windAng) * 28, Math.sin(this.windAng) * 28];
  }

  startWave(weather: number): void {
    this.clear();
    this.weather = weather;
    this.elapsed = 0;
    this.windCd = 10 + Math.random() * 4;
    this.windLeft = 0;
    this.stormCd = 6.5;

    // 小雨及以上生成 2~3 处后院积水洼
    if (weather >= 2) {
      const count = weather >= 3 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const x = Phaser.Math.Between(WORLD_MARGIN + 220, WORLD_WIDTH - WORLD_MARGIN - 220);
        const y = Phaser.Math.Between(WORLD_MARGIN + 180, WORLD_HEIGHT - WORLD_MARGIN - 180);
        this.puddles.push({ x, y, r: Phaser.Math.Between(74, 98), life: Infinity, phase: Math.random() * 6, flash: 0 });
      }
    }
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
      // 玩家在圈内受击
      const pdx = h.px - s.x;
      const pdy = h.py - s.y;
      if (pdx * pdx + pdy * pdy < (s.r + h.pr) ** 2) h.hurtPlayer(s.playerDamage);
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

    // 4. 金露花抢点圈
    if (this.bloom) {
      const b = this.bloom;
      b.life -= dt;
      const d = Math.hypot(h.px - b.x, h.py - b.y);
      if (d <= b.r + h.pr) {
        b.charge += dt;
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

    // 更新 HUD 提示文本
    const hints: string[] = [];
    if (this.bloom) hints.push(`✿ 金露花充能 ${Math.min(100, Math.round((this.bloom.charge / this.bloom.need) * 100))}%`);
    if (this.windLeft > 0) hints.push('〰 暴雨阵风');
    else if (this.weather >= 4) hints.push('⚡ 雷暴天雷（可引怪）');
    else if (this.puddles.length > 0) hints.push('💧 水洼潮湿（冰/电+25%）');
    h.onArenaHint(hints.join(' · '));

    this.draw();
  }

  clear(): void {
    this.puddles = [];
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
