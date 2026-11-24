import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';

export type EnemyShotKind = 'silk' | 'stinger' | 'orb';

interface Shot {
  sprite: Phaser.GameObjects.Image;
  kind: EnemyShotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  life: number;
  damage: number;
}

const SHOT_RADIUS = 5.5;
const SHOT_LIFE = 2.8;

/** 敌人发射的子弹（跳蛛丝弹 / 皇家胡蜂毒针）：自带高对比洋红危险描边环与尾迹，只与玩家核心躯干碰撞 */
export class EnemyShots {
  private readonly list: Shot[] = [];
  private readonly pool: Shot[] = [];
  private readonly auraG: Phaser.GameObjects.Graphics;
  private pulse = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.auraG = scene.add.graphics().setDepth(DEPTH.projectile - 0.5);
  }

  get shots(): readonly { x: number; y: number }[] {
    return this.list;
  }

  fire(x: number, y: number, angle: number, speed: number, damage: number, kind: EnemyShotKind = 'silk'): void {
    const tex = kind === 'stinger' ? 'enemy-stinger' : kind === 'orb' ? 'enemy-orb' : 'silk';
    const s = this.pool.pop() ?? {
      sprite: this.scene.add.image(0, 0, tex).setDepth(DEPTH.projectile).setScale(1 / SPRITE_RES),
      kind,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      life: 0,
      damage: 0,
    };
    s.kind = kind;
    s.x = x;
    s.y = y;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed;
    s.angle = angle;
    s.life = kind === 'orb' ? 3.2 : SHOT_LIFE;
    s.damage = damage;
    s.sprite
      .setTexture(tex)
      .setPosition(x, y)
      .setRotation(kind === 'stinger' ? angle : 0)
      .setScale((kind === 'stinger' ? 1.05 : kind === 'orb' ? 0.98 : 1) / SPRITE_RES)
      .setVisible(true);
    this.list.push(s);
  }

  /** onHit 返回后子弹消失 */
  update(dt: number, px: number, py: number, pr: number, onHit: (damage: number, kind: EnemyShotKind) => void): void {
    this.pulse += dt;
    const g = this.auraG;
    g.clear();
    const ringPulse = 0.88 + 0.14 * Math.sin(this.pulse * 18);

    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.sprite.setPosition(s.x, s.y);
      if (s.kind === 'silk') s.sprite.rotation += dt * 6;
      const dx = s.x - px;
      const dy = s.y - py;
      const rr = SHOT_RADIUS + pr;
      let dead = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > WORLD_WIDTH || s.y > WORLD_HEIGHT;
      if (!dead && dx * dx + dy * dy < rr * rr) {
        onHit(s.damage, s.kind);
        dead = true;
      }
      if (dead) {
        this.release(i);
        continue;
      }
      // 高对比敌方弹幕危险尾迹 + 脉冲外圈（与己方弹道/刀光彻底区分）
      const ux = Math.cos(s.angle);
      const uy = Math.sin(s.angle);
      const tailLen = s.kind === 'stinger' ? 20 : s.kind === 'orb' ? 12 : 14;
      const col = s.kind === 'stinger' ? 0xff2a48 : s.kind === 'orb' ? 0xff2e84 : 0xff3b8d;
      g.lineStyle(s.kind === 'stinger' ? 4.2 : 3.4, 0x160408, 0.72);
      g.beginPath();
      g.moveTo(s.x - ux * tailLen, s.y - uy * tailLen);
      g.lineTo(s.x, s.y);
      g.strokePath();
      g.lineStyle(s.kind === 'stinger' ? 2.4 : 2.0, col, 0.88);
      g.beginPath();
      g.moveTo(s.x - ux * tailLen, s.y - uy * tailLen);
      g.lineTo(s.x, s.y);
      g.strokePath();

      const haloR = (s.kind === 'stinger' ? 8.2 : s.kind === 'orb' ? 9.4 : 8.8) * ringPulse;
      g.fillStyle(col, 0.22);
      g.fillCircle(s.x, s.y, haloR);
      g.lineStyle(2.0, 0x160408, 0.88);
      g.strokeCircle(s.x, s.y, haloR + 0.8);
      g.lineStyle(1.6, col, 0.94);
      g.strokeCircle(s.x, s.y, haloR);
    }
  }

  clear(): void {
    this.auraG.clear();
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
