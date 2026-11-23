import Phaser from 'phaser';
import { DEPTH, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import { BeetleView } from './BeetleView';

export class Player {
  readonly view: BeetleView;
  readonly radius = 12;
  /** 剩余无敌时间（秒） */
  invuln = 0;
  /** 被丝弹减速的剩余时间 */
  slowTime = 0;
  /** 鸟羽毛加速的剩余时间 */
  hasteTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, shell: string) {
    this.view = new BeetleView(scene, x, y, shell);
    this.view.setScale(0.78);
    this.view.setDepth(DEPTH.player);
  }

  get x(): number {
    return this.view.x;
  }

  get y(): number {
    return this.view.y;
  }

  /** ix/iy：移动方向，长度 0~1 */
  update(dt: number, ix: number, iy: number, baseSpeed: number, shield = false): void {
    if (this.slowTime > 0) this.slowTime -= dt;
    if (this.hasteTime > 0) this.hasteTime -= dt;
    const speed = baseSpeed * (this.slowTime > 0 ? 0.7 : 1) * (this.hasteTime > 0 ? 1.3 : 1);
    let len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
      len = 1;
    }
    const v = this.view;
    if (len > 0.01) {
      v.x = Phaser.Math.Clamp(v.x + ix * speed * dt, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
      v.y = Phaser.Math.Clamp(v.y + iy * speed * dt, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
      v.rotation = Phaser.Math.Angle.RotateTo(v.rotation, Math.atan2(iy, ix), 12 * dt);
    }
    v.setStatus(shield, this.hasteTime > 0, this.slowTime > 0);
    v.animate(dt, len);

    if (this.invuln > 0) {
      this.invuln -= dt;
      v.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0 ? 0.45 : 1);
    } else {
      v.setAlpha(1);
    }
  }
}
