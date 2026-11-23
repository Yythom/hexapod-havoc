import Phaser from 'phaser';
import { DEPTH } from '../config';
import { MAX_ENEMY_RADIUS, type Enemy, type EnemyManager } from './EnemyManager';

interface Zone {
  kind: 'cloud' | 'web';
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
  tick: number;
  /** 每跳（0.5 秒）的直接伤害 */
  damage: number;
  poisonPer: number;
  poisonDuration: number;
  /** 减速后的速度倍率 */
  slowMult: number;
}

const TICK = 0.5;

/** 玩家这边放在地上的区域：毒云（毒孢子、臭腺）和蛛网（蛛网陷阱） */
export class Hazards {
  private readonly list: Zone[] = [];
  private readonly buf: Enemy[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  addCloud(x: number, y: number, r: number, time: number, damage: number, poisonPer: number, poisonDuration: number): void {
    this.add({ kind: 'cloud', x, y, r, life: time, maxLife: time, tick: 0, damage, poisonPer, poisonDuration, slowMult: 1 });
  }

  /** 最多同时 max 张，超出时替换最早的那张 */
  addWeb(x: number, y: number, r: number, time: number, damage: number, slow: number, max: number): void {
    const webs = this.list.filter((z) => z.kind === 'web');
    if (webs.length >= max) this.remove(this.list.indexOf(webs[0]));
    this.add({ kind: 'web', x, y, r, life: time, maxLife: time, tick: 0, damage, poisonPer: 0, poisonDuration: 0, slowMult: 1 - slow });
  }

  update(dt: number, enemies: EnemyManager): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const z = this.list[i];
      z.life -= dt;
      if (z.life <= 0) {
        this.remove(i);
        continue;
      }
      const fade = Math.min(1, z.life / 0.5, (z.maxLife - z.life) / 0.2);
      z.sprite.setAlpha(fade * (z.kind === 'web' ? 0.9 : 1));
      if (z.kind === 'cloud') z.sprite.rotation += dt * 0.4;

      z.tick -= dt;
      if (z.tick > 0) continue;
      z.tick += TICK;
      for (const e of enemies.grid.query(z.x, z.y, z.r + MAX_ENEMY_RADIUS, this.buf)) {
        const dx = e.x - z.x;
        const dy = e.y - z.y;
        const rr = z.r + e.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (z.kind === 'cloud') {
          enemies.applyPoison(e, 1, z.poisonPer, z.poisonDuration);
        } else {
          enemies.applySlow(e, TICK + 0.15, z.slowMult);
        }
        const dmg = Math.round(z.damage);
        if (dmg >= 1) enemies.hit(e, dmg, false, 0, 0, 0, z.kind === 'cloud' ? 'poison' : 'normal');
      }
    }
  }

  clear(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
  }

  private add(z: Omit<Zone, 'sprite'>): void {
    const sprite = this.scene.add
      .image(z.x, z.y, z.kind === 'cloud' ? 'cloud' : 'webzone')
      .setDepth(DEPTH.mound - 1)
      .setDisplaySize(z.r * 2.2, z.r * 2.2)
      .setAlpha(0);
    this.list.push({ ...z, sprite });
  }

  private remove(i: number): void {
    if (i < 0) return;
    this.list[i].sprite.destroy();
    this.list.splice(i, 1);
  }
}
