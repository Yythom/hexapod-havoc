import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';

type PickupKind = 'nectar' | 'chest' | 'heal';

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
}

interface Collector {
  x: number;
  y: number;
  radius: number;
}

const EDGE = 30;
/** 宝箱不被感应范围吸，要走到这个距离内才会被捡起 */
const CHEST_TOUCH = 22;

/** 地上的掉落物：花蜜和回血物（进入感应范围会被吸过来）、宝箱（要走过去捡） */
export class PickupManager {
  /** 本帧捡到的数量 */
  gotNectar = 0;
  gotChests = 0;
  gotHeals = 0;
  private readonly list: Pickup[] = [];
  private readonly pool: Pickup[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get count(): number {
    return this.list.length;
  }

  dropNectar(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) this.spawn('nectar', x, y, 50 + Math.random() * 90);
  }

  dropChest(x: number, y: number): void {
    this.spawn('chest', x, y, 40);
  }

  /** 回血物：果实（怪物掉落）、蘑菇（蘑菇圈） */
  dropHeal(x: number, y: number, texture: 'fruit' | 'mushroom'): void {
    this.spawn('heal', x, y, texture === 'fruit' ? 60 : 0, texture);
  }

  /** vacuum 为 true 时全图掉落物都飞向玩家（波次结束） */
  update(dt: number, who: Collector, pickupRange: number, vacuum: boolean): void {
    this.gotNectar = 0;
    this.gotChests = 0;
    this.gotHeals = 0;
    const friction = Math.exp(-6 * dt);
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
          if (d.kind === 'nectar') this.gotNectar++;
          else if (d.kind === 'chest') this.gotChests++;
          else this.gotHeals++;
          this.release(i);
          continue;
        }
        d.pullTime += dt;
        const sp = Math.min(1100, 260 + d.pullTime * 1500);
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
      else d.sprite.setScale((1 + bob * 0.1) / SPRITE_RES);
    }
  }

  /** 立刻收走全部掉落物（回血物直接丢弃） */
  collectAll(): { nectar: number; chests: number } {
    let nectar = 0;
    let chests = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].kind === 'nectar') nectar++;
      else if (this.list[i].kind === 'chest') chests++;
      this.release(i);
    }
    return { nectar, chests };
  }

  private spawn(kind: PickupKind, x: number, y: number, speed: number, texture?: string): void {
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
    d.sprite
      .setTexture(texture ?? (kind === 'nectar' ? 'nectar' : 'chest'))
      .setDepth(kind === 'nectar' ? DEPTH.nectar : DEPTH.nectar + 1)
      .setPosition(x, y)
      .setScale(1 / SPRITE_RES)
      .setRotation(0)
      .setVisible(true);
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
