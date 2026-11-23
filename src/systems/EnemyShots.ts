import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';

interface Shot {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
}

const SHOT_RADIUS = 5.5;
const SHOT_LIFE = 2.6;

/** 敌人发射的子弹（跳蛛的丝弹），只和玩家碰撞 */
export class EnemyShots {
  private readonly list: Shot[] = [];
  private readonly pool: Shot[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get shots(): readonly { x: number; y: number }[] {
    return this.list;
  }

  fire(x: number, y: number, angle: number, speed: number, damage: number): void {
    const s = this.pool.pop() ?? {
      sprite: this.scene.add.image(0, 0, 'silk').setDepth(DEPTH.projectile).setScale(1 / SPRITE_RES),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      damage: 0,
    };
    s.x = x;
    s.y = y;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed;
    s.life = SHOT_LIFE;
    s.damage = damage;
    s.sprite.setPosition(x, y).setVisible(true);
    this.list.push(s);
  }

  /** onHit 返回后子弹消失 */
  update(dt: number, px: number, py: number, pr: number, onHit: (damage: number) => void): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.sprite.setPosition(s.x, s.y);
      s.sprite.rotation += dt * 6;
      const dx = s.x - px;
      const dy = s.y - py;
      const rr = SHOT_RADIUS + pr;
      let dead = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > WORLD_WIDTH || s.y > WORLD_HEIGHT;
      if (!dead && dx * dx + dy * dy < rr * rr) {
        onHit(s.damage);
        dead = true;
      }
      if (dead) this.release(i);
    }
  }

  clear(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.release(i);
  }

  private release(i: number): void {
    const s = this.list[i];
    const last = this.list.pop()!;
    if (last !== s) this.list[i] = last;
    s.sprite.setVisible(false);
    this.pool.push(s);
  }
}
