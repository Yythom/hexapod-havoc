import Phaser from 'phaser';
import { DEPTH } from '../config';

interface Shape {
  kind: 'circle' | 'fan' | 'line';
  x: number;
  y: number;
  /** 圆/扇形半径，或直线长度 */
  r: number;
  angle: number;
  /** 扇形单侧角度 */
  half: number;
  /** 直线宽度 */
  width: number;
  t: number;
  total: number;
}

/** 怪物大招前的红色预警区域：高亮外框 + 随时间填满的内圈 + 临近爆发脉冲 */
export class Telegraphs {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly list: Shape[] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.mound);
  }

  circle(x: number, y: number, r: number, time: number): void {
    this.list.push({ kind: 'circle', x, y, r, angle: 0, half: 0, width: 0, t: 0, total: time });
  }

  fan(x: number, y: number, r: number, angle: number, half: number, time: number): void {
    this.list.push({ kind: 'fan', x, y, r, angle, half, width: 0, t: 0, total: time });
  }

  line(x: number, y: number, angle: number, length: number, width: number, time: number): void {
    this.list.push({ kind: 'line', x, y, r: length, angle, half: 0, width, t: 0, total: time });
  }

  update(dt: number): void {
    const g = this.g;
    g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.t += dt;
      if (s.t >= s.total) {
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
        continue;
      }
      const k = s.t / s.total;
      const urgent = k > 0.78 ? 0.14 : 0;
      this.draw(s, 1, 0.12 + urgent * 0.5, 0.85, urgent > 0 ? 0xffa488 : 0xff5a4a);
      this.draw(s, k, 0.26 + urgent, 0, 0xff3a2a);
    }
  }

  clear(): void {
    this.list.length = 0;
    this.g.clear();
  }

  private draw(s: Shape, scale: number, fillAlpha: number, lineAlpha: number, lineColor: number): void {
    const g = this.g;
    g.fillStyle(0xff3a2a, fillAlpha);
    g.lineStyle(2.5, lineColor, lineAlpha);
    const r = s.r * scale;
    if (s.kind === 'circle') {
      g.fillCircle(s.x, s.y, r);
      if (lineAlpha > 0) g.strokeCircle(s.x, s.y, r);
    } else if (s.kind === 'fan') {
      g.beginPath();
      g.slice(s.x, s.y, r, s.angle - s.half, s.angle + s.half, false);
      g.closePath();
      g.fillPath();
      if (lineAlpha > 0) g.strokePath();
    } else {
      const c = Math.cos(s.angle);
      const sn = Math.sin(s.angle);
      const hw = s.width / 2;
      const pts = [
        new Phaser.Math.Vector2(s.x - sn * hw, s.y + c * hw),
        new Phaser.Math.Vector2(s.x + c * r - sn * hw, s.y + sn * r + c * hw),
        new Phaser.Math.Vector2(s.x + c * r + sn * hw, s.y + sn * r - c * hw),
        new Phaser.Math.Vector2(s.x + sn * hw, s.y - c * hw),
      ];
      g.fillPoints(pts, true);
      if (lineAlpha > 0) g.strokePoints(pts, true);
    }
  }
}
