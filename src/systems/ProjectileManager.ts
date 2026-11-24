import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { sfx } from '../audio/sfx';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import type { Effects } from './Effects';
import { MAX_ENEMY_RADIUS, type Enemy, type EnemyManager } from './EnemyManager';
import type { Hazards } from './Hazards';
import type { HitResolver, HitSource } from './HitResolver';

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
}

interface Projectile extends FireOptions {
  sprite: Phaser.GameObjects.Image;
  dirX: number;
  dirY: number;
  traveled: number;
  hits: Enemy[];
  life: number;
  r0: number;
  scale0: number;
  /** 回旋：正在往回飞 */
  back: boolean;
  tripsLeft: number;
  bouncesLeft: number;
}

/** 每个子步最多走多少像素，防止高速子弹穿过小怪 */
const MAX_STEP = 12;
/** 回旋叶刃飞回到离玩家这么近就算接住 */
const CATCH_DIST = 22;
const MAX_LIFE = 6;

export class ProjectileManager {
  private readonly list: Projectile[] = [];
  private readonly pool: Phaser.GameObjects.Image[] = [];
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
    const sprite = this.pool.pop() ?? this.scene.add.image(0, 0, o.texture).setDepth(DEPTH.projectile);
    const scale0 = (o.crit ? 1.3 : 1) / SPRITE_RES;
    sprite.setTexture(o.texture).setPosition(o.x, o.y).setRotation(o.angle).setScale(scale0).setAlpha(1).setVisible(true);
    this.list.push({
      ...o,
      sprite,
      dirX: Math.cos(o.angle),
      dirY: Math.sin(o.angle),
      traveled: 0,
      hits: [],
      life: 0,
      r0: o.radius,
      scale0,
      back: false,
      tripsLeft: o.trips ?? 0,
      bouncesLeft: o.bounce?.times ?? 0,
    });
  }

  /** px/py：玩家位置（回旋叶刃要飞回来） */
  update(dt: number, enemies: EnemyManager, px: number, py: number): void {
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
      if (p.texture === 'rocketproj' && Math.random() < dt * 36) {
        this.fx.streaks(p.x - p.dirX * 8, p.y - p.dirY * 8, Math.atan2(-p.dirY, -p.dirX), 0xff8a28, 1, 90, 0.85);
      } else if (p.texture === 'laserbolt' && Math.random() < dt * 32) {
        this.fx.streaks(p.x - p.dirX * 8, p.y - p.dirY * 8, Math.atan2(-p.dirY, -p.dirX), 0x38f2ff, 1, 75, 0.75);
      } else if (p.texture === 'leafblade' && Math.random() < dt * 24) {
        this.fx.burst(p.x, p.y, 0x9cff58, 1, 45, 0.55);
      } else if (p.texture === 'dungball' && Math.random() < dt * 16) {
        this.fx.burst(p.x, p.y, 0xa8824c, 1, 38, 0.65, false);
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
      if (p.bouncesLeft > 0) return !this.bounce(p, e, enemies);
      if (p.pierce <= 0) return true;
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
    const ang = Math.atan2(p.dirY, p.dirX);
    if (p.poison) {
      enemies.applyPoison(e, p.poison.stacks, p.poison.perStack, p.poison.duration);
      this.fx.burst(p.x, p.y, 0x9cf428, 3, 105, 0.65);
    }
    if (p.texture === 'laserbolt') {
      this.fx.ring(p.x, p.y, 18, 0x38f2ff);
      this.fx.star(p.x, p.y, 14, 0x38f2ff, ang);
    } else if (p.texture === 'honeyblob') {
      this.fx.burst(p.x, p.y, 0xffd040, 4, 120, 0.75);
    } else if (p.texture === 'bullet' || p.texture === 'heavybullet' || p.texture === 'pellet') {
      this.fx.streaks(p.x, p.y, ang, 0xffe270, p.texture === 'heavybullet' ? 3 : 2, 160, 0.65);
    } else if (p.texture === 'leafblade') {
      this.fx.star(p.x, p.y, 13, 0x9cff58, ang);
    }
    if (p.crit && p.src) {
      const sp = p.src.def.special;
      if (sp?.pierceOnCrit) p.pierce += sp.pierceOnCrit;
      if (sp?.bounceOnCrit && p.bounce) p.bouncesLeft += sp.bounceOnCrit;
    }
    this.resolver.hit(e, p.damage, p.crit, p.dirX, p.dirY, p.knockback, p.src ?? null);
  }

  private explode(p: Projectile, enemies: EnemyManager): void {
    sfx.play('explode');
    const rocket = p.texture === 'rocketproj';
    this.fx.ring(p.x, p.y, p.explode, rocket ? 0xff7030 : 0xffc070);
    if (rocket) this.fx.ring(p.x, p.y, p.explode * 0.55, 0xffe484);
    this.fx.burst(p.x, p.y, rocket ? 0xff8a28 : 0xc08040, rocket ? 16 : 10, rocket ? 240 : 200, rocket ? 1.2 : 1);
    for (const e of enemies.grid.query(p.x, p.y, p.explode + MAX_ENEMY_RADIUS, this.aoeBuf).slice()) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = p.explode + e.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.resolver.hit(e, p.damage, p.crit, dx / d, dy / d, p.knockback, p.src ?? null);
    }
  }

  private land(p: Projectile): void {
    sfx.play('spray');
    const c = p.cloud!;
    this.hazards.addCloud(p.x, p.y, c.radius, c.time, c.damage, c.perStack, c.duration);
    this.fx.burst(p.x, p.y, 0x9ad040, 8, 120, 1);
  }

  private release(i: number): void {
    const p = this.list[i];
    const last = this.list.pop()!;
    if (last !== p) this.list[i] = last;
    p.sprite.setVisible(false);
    this.pool.push(p.sprite);
  }
}
