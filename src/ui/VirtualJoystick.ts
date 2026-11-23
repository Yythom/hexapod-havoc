import Phaser from 'phaser';
import { HUD_SCALE } from '../config';
import { touchMove } from '../core/input';
import { uiPointer } from './camera';

const DEADZONE = 0.12;
/** 推到这个比例就算全速，手机上不用推到底 */
const FULL_AT = 0.6;

/**
 * 浮动摇杆：在屏幕任意空白处按下即出现，底座固定在按下的位置；拖动控制方向，拖出范围仍保持全速。
 * 触屏和鼠标拖动都能用；按在按钮等可交互物体上时不会触发。
 */
export class VirtualJoystick {
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private pointerId = -1;
  private ox = 0;
  private oy = 0;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    private readonly radius = Math.round(72 * HUD_SCALE),
  ) {
    const knobR = Math.round(28 * HUD_SCALE);
    this.base = scene.add.graphics().setDepth(90).setVisible(false);
    this.base.fillStyle(0x140d07, 0.34);
    this.base.fillCircle(0, 0, radius);
    this.base.lineStyle(3, 0xffe098, 0.48);
    this.base.strokeCircle(0, 0, radius);
    this.base.lineStyle(1.4, 0xffe4a8, 0.22);
    this.base.strokeCircle(0, 0, radius * FULL_AT);
    // 八方位罗盘刻度
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r0 = k % 2 === 0 ? radius - 9 : radius - 5;
      this.base.lineStyle(k % 2 === 0 ? 2 : 1.2, 0xffd87a, k % 2 === 0 ? 0.55 : 0.32);
      this.base.beginPath();
      this.base.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      this.base.lineTo(Math.cos(a) * (radius - 1), Math.sin(a) * (radius - 1));
      this.base.strokePath();
    }

    this.knob = scene.add.graphics().setDepth(91).setVisible(false);
    this.knob.fillStyle(0x000000, 0.36);
    this.knob.fillCircle(2, 4, knobR);
    this.knob.fillStyle(0xc47218, 0.85);
    this.knob.fillCircle(0, 0, knobR);
    this.knob.fillStyle(0xf6b842, 0.88);
    this.knob.fillCircle(0, -1, knobR * 0.86);
    this.knob.fillStyle(0xfff4c8, 0.52);
    this.knob.fillCircle(-knobR * 0.26, -knobR * 0.28, knobR * 0.34);
    this.knob.lineStyle(2.4, 0xfff0c0, 0.9);
    this.knob.strokeCircle(0, 0, knobR);

    const input = scene.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointerupoutside', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.release();
      input.off('pointerdown', this.onDown, this);
      input.off('pointermove', this.onMove, this);
      input.off('pointerup', this.onUp, this);
      input.off('pointerupoutside', this.onUp, this);
    });
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.release();
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.enabled || this.pointerId !== -1 || over.length > 0) return;
    const pos = uiPointer(p);
    this.pointerId = p.id;
    this.ox = pos.x;
    this.oy = pos.y;
    this.base.setPosition(pos.x, pos.y).setVisible(true);
    this.knob.setPosition(pos.x, pos.y).setVisible(true);
    touchMove.x = touchMove.y = 0;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const pos = uiPointer(p);
    let dx = pos.x - this.ox;
    let dy = pos.y - this.oy;
    let len = Math.hypot(dx, dy);
    if (len > this.radius) {
      // 手指拖出范围时，摇杆头停在边缘，按全速算；底座留在按下的位置不动
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
      len = this.radius;
    }
    this.knob.setPosition(this.ox + dx, this.oy + dy);
    const k = len / this.radius;
    if (k < DEADZONE) {
      touchMove.x = touchMove.y = 0;
      return;
    }
    const m = Math.min(1, (k - DEADZONE) / (FULL_AT - DEADZONE));
    touchMove.x = (dx / len) * m;
    touchMove.y = (dy / len) * m;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.pointerId) this.release();
  }

  private release(): void {
    this.pointerId = -1;
    this.base.setVisible(false);
    this.knob.setVisible(false);
    touchMove.x = touchMove.y = 0;
  }
}
