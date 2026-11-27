import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { sfx } from '../audio/sfx';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import type { Effects } from './Effects';
import { MAX_ENEMY_RADIUS, type Enemy, type EnemyManager } from './EnemyManager';
import type { Hazards } from './Hazards';
import type { HitResolver, HitSource } from './HitResolver';
import type { SnapProj } from '../net/protocol';

export interface PoisonPayload {
  stacks: number;
  perStack: number;
  duration: number;
}

export interface CloudPayload {
  radius: number;
  time: number;
  damage: number;
  perStack: number;
  duration: number;
}

export interface BouncePayload {
  times: number;
  range: number;
  falloff: number;
}

export interface FireOptions {
  texture: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxDist: number;
  damage: number;
  crit: boolean;
  radius: number;
  knockback: number;
  pierce: number;
  /** 自转速度（弧度/秒），0 表示始终朝飞行方向 */
  spin: number;
  /** 命中后爆炸的半径，0 表示不爆炸 */
  explode: number;
  poison: PoisonPayload | null;
  /** 抛射：飞完 maxDist 落地留下毒云，途中不碰撞 */
  cloud: CloudPayload | null;
  /** 来自哪把武器（命中效果），敌我无关的弹为 null */
  src?: HitSource | null;
  /** 回旋：来回几趟（0 表示不回旋） */
  trips?: number;
  /** 弹跳 */
  bounce?: BouncePayload | null;
  /** 滚动变大的倍率（0 表示不变） */
  grow?: number;
  /** 喷火：逐渐变大、变淡 */
  fade?: boolean;
  /** 复眼棱镜：命中后向两侧分裂 2 颗小弹 */
  split?: boolean;
  /** 新月穿透剑气波颜色（如刀刃 6 件套觉醒）：用 1:1 真实半径宽度的弧形剑气渲染替代小贴图 */
  waveColor?: number;
}

interface Projectile extends FireOptions {
  sprite: Phaser.GameObjects.Image;
  dirX: number;
  dirY: number;
  prevX: number;
  prevY: number;
  traveled: number;
  hits: Enemy[];
  life: number;
  r0: number;
  scale0: number;
  /** 回旋：正在往回飞 */
  back: boolean;
  tripsLeft: number;
  bouncesLeft: number;
  /** 是否天生或加成自带穿透（用于高亮穿透拖尾表现） */
  hasPierce: boolean;
}

/** 每个子步最多走多少像素，防止高速子弹穿过小怪 */
const MAX_STEP = 12;
/** 回旋叶刃飞回到离玩家这么近就算接住 */
const CATCH_DIST = 22;
const MAX_LIFE = 6;

export class ProjectileManager {
  onExplode: ((r: number) => void) | null = null;
  /** 爆炸 6 件套觉醒：爆炸后 0.35 秒触发二次余震 */
  aftershockEnabled = false;
  private readonly list: Projectile[] = [];
  private readonly aftershocks: { x: number; y: number; r: number; damage: number; t: number; src: HitSource | null }[] = [];
  /** 整包复用 Projectile 对象与 hits 数组，减少高频弹幕的 GC 抖动 */
  private readonly pool: Projectile[] = [];
  private readonly buf: Enemy[] = [];
  private readonly aoeBuf: Enemy[] = [];
  private readonly bounceBuf: Enemy[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: Effects,
    private readonly hazards: Hazards,
    private readonly resolver: HitResolver,
  ) {}

  fire(o: FireOptions): void {
    const scale0 = (o.crit ? 1.3 : 1) / SPRITE_RES;
    const isWave = o.waveColor !== undefined;
    const p = this.pool.pop();
    if (p) {
      p.texture = o.texture;
      p.x = o.x;
      p.y = o.y;
      p.angle = o.angle;
      p.speed = o.speed;
      p.maxDist = o.maxDist;
      p.damage = o.damage;
      p.crit = o.crit;
      p.radius = o.radius;
      p.knockback = o.knockback;
      p.pierce = o.pierce;
      p.spin = o.spin;
      p.explode = o.explode;
      p.poison = o.poison;
      p.cloud = o.cloud;
      p.src = o.src ?? null;
      p.trips = o.trips ?? 0;
      p.bounce = o.bounce ?? null;
      p.grow = o.grow ?? 0;
      p.fade = !!o.fade;
      p.split = !!o.split;
      p.waveColor = o.waveColor;
      p.dirX = Math.cos(o.angle);
      p.dirY = Math.sin(o.angle);
      p.prevX = o.x;
      p.prevY = o.y;
      p.traveled = 0;
      p.hits.length = 0;
      p.life = 0;
      p.r0 = o.radius;
      p.scale0 = scale0;
      p.back = false;
      p.tripsLeft = o.trips ?? 0;
      p.bouncesLeft = o.bounce?.times ?? 0;
      p.hasPierce = o.pierce > 0;
      p.sprite
        .setTexture(isWave ? 'fx-blade-wave' : o.texture)
        .setPosition(o.x, o.y)
        .setRotation(o.angle)
        .setScale(isWave ? (o.radius * 2.2) / 128 : scale0)
        .setAlpha(1)
        .setVisible(true);
      if (isWave && o.waveColor !== undefined) p.sprite.setTint(o.waveColor);
      else p.sprite.clearTint();
      this.list.push(p);
      return;
    }
    const sprite = this.scene.add
      .image(o.x, o.y, isWave ? 'fx-blade-wave' : o.texture)
      .setDepth(DEPTH.projectile)
      .setRotation(o.angle)
      .setScale(isWave ? (o.radius * 2.2) / 128 : scale0)
      .setAlpha(1)
      .setVisible(true);
    if (isWave && o.waveColor !== undefined) sprite.setTint(o.waveColor);
    this.list.push({
      ...o,
      sprite,
      dirX: Math.cos(o.angle),
      dirY: Math.sin(o.angle),
      prevX: o.x,
      prevY: o.y,
      traveled: 0,
      hits: [],
      life: 0,
      r0: o.radius,
      scale0,
      back: false,
      tripsLeft: o.trips ?? 0,
      bouncesLeft: o.bounce?.times ?? 0,
      hasPierce: o.pierce > 0,
    });
  }

  /** px/py：玩家位置（回旋叶刃要飞回来） */
  update(dt: number, enemies: EnemyManager, px: number, py: number): void {
    // 爆炸 6 件套二次余震结算
    for (let i = this.aftershocks.length - 1; i >= 0; i--) {
      const a = this.aftershocks[i];
      a.t -= dt;
      if (a.t > 0) continue;
      this.aftershocks.splice(i, 1);
      sfx.play('explode');
      this.fx.explosion(a.x, a.y, a.r, 0xffd048, 1);
      for (const e of enemies.grid.query(a.x, a.y, a.r + MAX_ENEMY_RADIUS, this.aoeBuf).slice()) {
        if (!e.active) continue;
        const dx = e.x - a.x;
        const dy = e.y - a.y;
        if (dx * dx + dy * dy > (a.r + e.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.resolver.hit(e, a.damage, false, dx / d, dy / d, 90, a.src);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      let dead = p.life > MAX_LIFE;
      if (p.back) {
        const dx = px - p.x;
        const dy = py - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < CATCH_DIST) {
          if (p.tripsLeft > 0) this.relaunch(p, enemies);
          else dead = true;
        } else {
          p.dirX = dx / d;
          p.dirY = dy / d;
        }
      }
      p.prevX = p.x;
      p.prevY = p.y;
      const dist = p.speed * dt;
      const steps = Math.max(1, Math.ceil(dist / MAX_STEP));
      const step = dist / steps;
      for (let s = 0; s < steps && !dead; s++) {
        p.x += p.dirX * step;
        p.y += p.dirY * step;
        p.traveled += step;
        if (p.grow) p.radius = p.r0 * (1 + p.grow * Math.min(1, p.traveled / p.maxDist));
        if (!p.cloud) dead = this.collide(p, enemies);
        if (!dead && !p.back && p.traveled >= p.maxDist) {
          if (p.trips) {
            // 回旋：到最远处掉头，回程可以再打中一次
            p.back = true;
            p.tripsLeft--;
            p.hits.length = 0;
          } else {
            dead = true;
            if (p.cloud) this.land(p);
          }
        }
      }
      if (p.x < 0 || p.y < 0 || p.x > WORLD_WIDTH || p.y > WORLD_HEIGHT) dead = true;
      p.sprite.setPosition(p.x, p.y);
      if (p.spin !== 0) p.sprite.rotation += dt * p.spin;
      if (p.waveColor !== undefined && !dead) {
        const alpha = Math.min(1, 1.15 - (p.traveled / Math.max(1, p.maxDist)) * 0.55);
        p.sprite.setAlpha(alpha);
      } else if (p.texture === 'rocketproj') {
        if (Math.random() < dt * 16) this.fx.smoke(p.x - p.dirX * 10, p.y - p.dirY * 10, Math.atan2(-p.dirY, -p.dirX), 1, 0xd4ccc2);
      }
      const k = Math.min(1, p.traveled / p.maxDist);
      if (p.cloud) {
        // 抛射物飞行时有个上下的弧度感
        p.sprite.setScale((1 + Math.sin(k * Math.PI) * 0.5) / SPRITE_RES);
      } else if (p.grow) {
        p.sprite.setScale((p.scale0 * p.radius) / p.r0);
      } else if (p.fade) {
        p.radius = p.r0 * (1 + 0.6 * k);
        p.sprite.setScale(p.scale0 * (0.7 + 1.1 * k)).setAlpha(1 - 0.75 * k);
      }
      if (dead) this.release(i);
    }
  }

  clear(): void {
    this.aftershocks.length = 0;
    for (let i = this.list.length - 1; i >= 0; i--) this.release(i);
  }

  /** 回旋叶刃接回来后，如果还有趟数，再朝最近的怪飞出去 */
  private relaunch(p: Projectile, enemies: EnemyManager): void {
    p.back = false;
    p.traveled = 0;
    p.hits.length = 0;
    const t = enemies.nearest(p.x, p.y, p.maxDist);
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(-p.dirY, -p.dirX);
    p.dirX = Math.cos(a);
    p.dirY = Math.sin(a);
  }

  /** 返回子弹是否该消失 */
  private collide(p: Projectile, enemies: EnemyManager): boolean {
    for (const e of enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS, this.buf)) {
      if (!e.active || p.hits.includes(e)) continue;
      const rr = p.radius + e.radius;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (p.explode > 0) {
        this.explode(p, enemies);
        return true;
      }
      this.strike(p, e, enemies);
      p.hits.push(e);
      if (p.split) this.spawnSplits(p, e);
      if (p.bouncesLeft > 0) {
        const bounced = this.bounce(p, e, enemies);
        return !bounced;
      }
      if (p.pierce <= 0) {
        // 单体子弹（或穿透已耗尽）：直接命中消失，不播放额外火花特效
        return true;
      }
      p.pierce--;
    }
    return false;
  }

  /** 弹跳：转向命中点附近最近、还没打过的怪；找不到就消失 */
  private bounce(p: Projectile, from: Enemy, enemies: EnemyManager): boolean {
    const b = p.bounce!;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of enemies.grid.query(from.x, from.y, b.range + MAX_ENEMY_RADIUS, this.bounceBuf)) {
      if (!e.active || p.hits.includes(e)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < b.range + e.radius && d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) return false;
    p.bouncesLeft--;
    p.damage = Math.max(1, Math.round(p.damage * (1 - b.falloff)));
    const a = Math.atan2(best.y - p.y, best.x - p.x);
    p.dirX = Math.cos(a);
    p.dirY = Math.sin(a);
    p.traveled = 0;
    p.maxDist = b.range + 60;
    if (p.spin === 0) p.sprite.setRotation(a);
    return true;
  }

  private spawnSplits(p: Projectile, hitEnemy: Enemy): void {
    const baseA = Math.atan2(p.dirY, p.dirX);
    const dmg = Math.max(1, Math.round(p.damage * 0.4));
    for (const off of [-0.45, 0.45]) {
      const a = baseA + off;
      this.fire({
        texture: 'sparkbolt',
        x: hitEnemy.x + Math.cos(a) * 8,
        y: hitEnemy.y + Math.sin(a) * 8,
        angle: a,
        speed: Math.min(760, Math.max(480, p.speed * 0.85)),
        maxDist: 165,
        damage: dmg,
        crit: false,
        radius: 5,
        knockback: p.knockback * 0.4,
        pierce: 0,
        spin: 0,
        explode: 0,
        poison: null,
        cloud: null,
        src: p.src ?? null,
        split: false,
      });
      // 跳过刚命中的那只怪，避免贴脸立刻撞同一只
      this.list[this.list.length - 1].hits.push(hitEnemy);
    }
  }

  private strike(p: Projectile, e: Enemy, enemies: EnemyManager): void {
    if (p.poison) {
      enemies.applyPoison(e, p.poison.stacks, p.poison.perStack, p.poison.duration);
    }
    if (p.crit && p.src) {
      const sp = p.src.def.special;
      if (sp?.pierceOnCrit) {
        p.pierce += sp.pierceOnCrit;
        p.hasPierce = true;
      }
      if (sp?.bounceOnCrit && p.bounce) p.bouncesLeft += sp.bounceOnCrit;
    }
    this.resolver.hit(e, p.damage, p.crit, p.dirX, p.dirY, p.knockback, p.src ?? null);
  }

  private explode(p: Projectile, enemies: EnemyManager): void {
    sfx.play('explode');
    const rocket = p.texture === 'rocketproj';
    this.fx.explosion(p.x, p.y, p.explode, rocket ? 0xff7028 : 0xffa848, p.src?.tier ?? 0);
    if (p.explode >= 55) this.onExplode?.(p.explode);
    for (const e of enemies.grid.query(p.x, p.y, p.explode + MAX_ENEMY_RADIUS, this.aoeBuf).slice()) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = p.explode + e.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.resolver.hit(e, p.damage, p.crit, dx / d, dy / d, p.knockback, p.src ?? null);
    }
    if (this.aftershockEnabled && p.explode >= 30) {
      this.aftershocks.push({
        x: p.x,
        y: p.y,
        r: Math.round(p.explode * 0.85),
        damage: Math.max(2, Math.round(p.damage * 0.55)),
        t: 0.35,
        src: p.src ?? null,
      });
    }
  }

  private land(p: Projectile): void {
    sfx.play('spray');
    const c = p.cloud!;
    this.hazards.addCloud(p.x, p.y, c.radius, c.time, c.damage, c.perStack, c.duration);
    this.fx.burst(p.x, p.y, 0x9ad040, 8, 120, 1);
  }

  snapshot(): SnapProj[] {
    const out: SnapProj[] = [];
    for (const p of this.list) {
      out.push([
        p.sprite.texture.key,
        Math.round(p.x),
        Math.round(p.y),
        Math.round(p.sprite.rotation * 100) / 100,
        Math.round(p.sprite.scaleX * 100) / 100,
        Math.round(p.sprite.alpha * 100) / 100,
        p.sprite.tintTopLeft ?? 0xffffff,
      ]);
    }
    return out;
  }

  private release(i: number): void {
    const p = this.list[i];
    const last = this.list.pop()!;
    if (last !== p) this.list[i] = last;
    p.sprite.setVisible(false);
    p.hits.length = 0;
    p.src = null;
    p.poison = null;
    p.cloud = null;
    p.bounce = null;
    p.waveColor = undefined;
    p.hasPierce = false;
    this.pool.push(p);
  }
}
