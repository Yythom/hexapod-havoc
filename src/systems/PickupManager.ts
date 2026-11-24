import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';

type PickupKind = 'nectar' | 'chest' | 'heal' | 'frenzy';

interface Pickup {
  kind: PickupKind;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  pullTime: number;
  pulled: boolean;
  phase: number;
  /** 合并后的价值（花蜜支持 ×4 / ×10 大颗金蜜合并以优化后期帧率） */
  value: number;
}

interface Collector {
  x: number;
  y: number;
  radius: number;
}

const EDGE = 30;
/** 宝箱不被感应范围吸，要走到这个距离内才会被捡起 */
const CHEST_TOUCH = 22;
/** 场上花蜜超过该数量时自动合并为大颗金蜜，大幅降低后期与无尽模式的渲染与计算开销 */
const MERGE_THRESHOLD = 75;
const MERGE_RADIUS_SQ = 84 * 84;

/** 地上的掉落物：花蜜和回血物（进入感应范围会被吸过来）、宝箱（要走过去捡） */
export class PickupManager {
  /** 本帧捡到的数量 */
  gotNectar = 0;
  gotChests = 0;
  gotHeals = 0;
  gotFrenzy = 0;
  private readonly list: Pickup[] = [];
  private readonly pool: Pickup[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get count(): number {
    return this.list.length;
  }

  /** 遍历场上未捡起的宝箱坐标（供屏幕边缘方向箭头指示） */
  forEachChest(fn: (x: number, y: number) => void): void {
    for (const d of this.list) {
      if (d.kind === 'chest') fn(d.x, d.y);
    }
  }

  dropNectar(x: number, y: number, n: number): void {
    if (n <= 0) return;
    let activeNectar = 0;
    let nearest: Pickup | null = null;
    let bestD2 = MERGE_RADIUS_SQ;
    for (const d of this.list) {
      if (d.kind !== 'nectar') continue;
      activeNectar++;
      if (d.pulled) continue;
      const dx = d.x - x;
      const dy = d.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        nearest = d;
      }
    }
    if (activeNectar >= MERGE_THRESHOLD || n >= 8) {
      if (nearest) {
        nearest.value += n;
        this.styleNectar(nearest);
        return;
      }
      this.spawn('nectar', x, y, 50 + Math.random() * 80, undefined, n);
      return;
    }
    for (let i = 0; i < n; i++) this.spawn('nectar', x, y, 50 + Math.random() * 90, undefined, 1);
  }

  dropChest(x: number, y: number): void {
    this.spawn('chest', x, y, 40);
  }

  /** 回血物：果实（怪物掉落）、蘑菇（蘑菇圈） */
  dropHeal(x: number, y: number, texture: 'fruit' | 'mushroom'): void {
    this.spawn('heal', x, y, texture === 'fruit' ? 60 : 0, texture);
  }

  /** 琥珀狂热露珠：拾取后 5 秒攻速/移速狂热 */
  dropFrenzy(x: number, y: number): void {
    this.spawn('frenzy', x, y, 50, 'frenzy-dew');
  }

  /** vacuum 为 true 时全图掉落物都飞向玩家（波次结束） */
  update(dt: number, who: Collector, pickupRange: number, vacuum: boolean, fastPull = false): void {
    this.gotNectar = 0;
    this.gotChests = 0;
    this.gotHeals = 0;
    this.gotFrenzy = 0;
    const friction = Math.exp(-6 * dt);
    const pullMult = fastPull ? 2 : 1;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.age += dt;
      const dx = who.x - d.x;
      const dy = who.y - d.y;
      const dist = Math.hypot(dx, dy);
      const reach = d.kind === 'chest' ? who.radius + CHEST_TOUCH : pickupRange;

      if (!d.pulled && d.age > 0.2 && (vacuum || dist < reach)) d.pulled = true;

      if (d.pulled) {
        if (dist < who.radius + 6) {
          if (d.kind === 'nectar') this.gotNectar += d.value;
          else if (d.kind === 'chest') this.gotChests++;
          else if (d.kind === 'frenzy') this.gotFrenzy++;
          else this.gotHeals++;
          this.release(i);
          continue;
        }
        d.pullTime += dt;
        const sp = Math.min(1100 * pullMult, (260 + d.pullTime * 1500) * pullMult);
        const k = Math.min(dist, sp * dt) / (dist || 1);
        d.x += dx * k;
        d.y += dy * k;
      } else {
        d.x = Phaser.Math.Clamp(d.x + d.vx * dt, EDGE, WORLD_WIDTH - EDGE);
        d.y = Phaser.Math.Clamp(d.y + d.vy * dt, EDGE, WORLD_HEIGHT - EDGE);
        d.vx *= friction;
        d.vy *= friction;
      }
      d.sprite.setPosition(d.x, d.y);
      const bob = Math.sin(d.age * 6 + d.phase);
      if (d.kind === 'chest') d.sprite.setScale(1.2 / SPRITE_RES).setRotation(bob * 0.08);
      else if (d.kind === 'frenzy') d.sprite.setScale((1.22 + bob * 0.14) / SPRITE_RES).setRotation(bob * 0.12);
      else {
        const sizeBoost = d.kind === 'nectar' ? (d.value >= 10 ? 1.44 : d.value >= 4 ? 1.24 : 1) : 1;
        d.sprite.setScale(((1 + bob * 0.1) * sizeBoost) / SPRITE_RES);
      }
    }
  }

  /** 立刻收走全部掉落物（回血物直接丢弃） */
  collectAll(): { nectar: number; chests: number } {
    let nectar = 0;
    let chests = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].kind === 'nectar') nectar += this.list[i].value;
      else if (this.list[i].kind === 'chest') chests++;
      this.release(i);
    }
    return { nectar, chests };
  }

  private styleNectar(d: Pickup): void {
    if (d.value >= 10) d.sprite.setTint(0xffc838);
    else if (d.value >= 4) d.sprite.setTint(0xffe67a);
    else d.sprite.clearTint();
  }

  private spawn(kind: PickupKind, x: number, y: number, speed: number, texture?: string, value = 1): void {
    let d = this.pool.pop();
    if (!d) {
      d = {
        kind,
        sprite: this.scene.add.image(0, 0, 'nectar'),
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        pullTime: 0,
        pulled: false,
        phase: 0,
        value: 1,
      };
    }
    const a = Math.random() * Math.PI * 2;
    d.kind = kind;
    d.x = x;
    d.y = y;
    d.vx = Math.cos(a) * speed;
    d.vy = Math.sin(a) * speed;
    d.age = 0;
    d.pullTime = 0;
    d.pulled = false;
    d.phase = Math.random() * Math.PI * 2;
    d.value = value;
    d.sprite
      .setTexture(texture ?? (kind === 'nectar' ? 'nectar' : 'chest'))
      .setDepth(kind === 'nectar' ? DEPTH.nectar : DEPTH.nectar + 1)
      .setPosition(x, y)
      .setScale(1 / SPRITE_RES)
      .setRotation(0)
      .clearTint()
      .setVisible(true);
    if (kind === 'nectar') this.styleNectar(d);
    this.list.push(d);
  }

  private release(i: number): void {
    const d = this.list[i];
    const last = this.list.pop()!;
    if (last !== d) this.list[i] = last;
    d.sprite.setVisible(false);
    this.pool.push(d);
  }
}
