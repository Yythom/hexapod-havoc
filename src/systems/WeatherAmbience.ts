import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
  max: number;
}

interface CloudBlob {
  x: number;
  y: number;
  rx: number;
  ry: number;
  vx: number;
  alpha: number;
}

/**
 * 动态天气氛围层（晴天斑驳树影 / 阴天流动云影 / 小雨涟漪 / 暴雨狂风 / 雷暴闪电）：
 * 既用于战斗 HUD 底层，也可在主菜单与选人界面实时预览 5 档天气的电影级光影氛围。
 */
export class WeatherAmbience {
  private readonly container: Phaser.GameObjects.Container;
  private readonly tintRect: Phaser.GameObjects.Rectangle;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly flashRect: Phaser.GameObjects.Rectangle;
  private weather = 0;
  private elapsed = 0;
  private lightningCd = 3.5;
  private flashAlpha = 0;
  private drops: RainDrop[] = [];
  private ripples: Ripple[] = [];
  private clouds: CloudBlob[] = [];

  constructor(
    scene: Phaser.Scene,
    depth = -10,
    initialWeather = 0,
    private readonly w = GAME_WIDTH,
    private readonly h = GAME_HEIGHT,
  ) {
    this.tintRect = scene.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0);
    this.gfx = scene.add.graphics();
    this.flashRect = scene.add.rectangle(0, 0, w, h, 0xd8ecff, 0).setOrigin(0);
    this.container = scene.add.container(0, 0, [this.tintRect, this.gfx, this.flashRect]).setDepth(depth);

    for (let i = 0; i < 95; i++) {
      this.drops.push({
        x: Math.random() * (w + 200) - 100,
        y: Math.random() * h,
        len: Phaser.Math.Between(16, 30),
        speed: Phaser.Math.Between(620, 920),
        alpha: Phaser.Math.FloatBetween(0.16, 0.38),
      });
    }
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: Math.random() * w,
        y: Phaser.Math.Between(60, h - 60),
        rx: Phaser.Math.Between(210, 360),
        ry: Phaser.Math.Between(120, 210),
        vx: Phaser.Math.FloatBetween(14, 28),
        alpha: Phaser.Math.FloatBetween(0.08, 0.15),
      });
    }

    this.setWeather(initialWeather);
  }

  setWeather(weather: number): void {
    this.weather = Phaser.Math.Clamp(weather, 0, 4);
    this.ripples.length = 0;
    this.flashAlpha = 0;
    this.flashRect.setAlpha(0);

    // 全局轻氛围色调（保持战斗高可读性，绝不过暗）
    if (this.weather === 0) {
      this.tintRect.setFillStyle(0xffe090, 0.03);
    } else if (this.weather === 1) {
      this.tintRect.setFillStyle(0x283444, 0.12);
    } else if (this.weather === 2) {
      this.tintRect.setFillStyle(0x182a3e, 0.14);
    } else if (this.weather === 3) {
      this.tintRect.setFillStyle(0x101c34, 0.22);
    } else {
      this.tintRect.setFillStyle(0x12122c, 0.26);
      this.lightningCd = 2.4;
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const g = this.gfx;
    g.clear();

    if (this.weather === 0) {
      // 晴天：柔和斜射林间日光束 + 缓缓移动的斑驳阳光斑
      const sway = Math.sin(this.elapsed * 0.45) * 28;
      g.fillStyle(0xffe498, 0.038);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(140 + sway, 0),
          new Phaser.Math.Vector2(340 + sway, 0),
          new Phaser.Math.Vector2(760 + sway * 1.4, this.h),
          new Phaser.Math.Vector2(480 + sway * 1.4, this.h),
        ],
        true,
      );
      g.fillStyle(0xfff0b8, 0.028);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(680 - sway, 0),
          new Phaser.Math.Vector2(860 - sway, 0),
          new Phaser.Math.Vector2(1240 - sway * 1.2, this.h),
          new Phaser.Math.Vector2(1010 - sway * 1.2, this.h),
        ],
        true,
      );
      return;
    }

    if (this.weather === 1) {
      // 阴天：飘过的云影
      for (const c of this.clouds) {
        c.x += c.vx * dt;
        if (c.x - c.rx > this.w) c.x = -c.rx;
        g.fillStyle(0x060a10, c.alpha);
        g.fillEllipse(c.x, c.y, c.rx * 2, c.ry * 2);
      }
      return;
    }

    // 2: 小雨 / 3: 暴雨 / 4: 雷暴
    const count = this.weather === 2 ? 42 : this.weather === 3 ? 75 : 95;
    const tilt = this.weather === 2 ? -0.18 : -0.3;
    const speedMult = this.weather === 2 ? 0.85 : this.weather === 3 ? 1.12 : 1.28;
    const dxNorm = Math.sin(tilt);
    const dyNorm = Math.cos(tilt);

    for (let i = 0; i < count; i++) {
      const d = this.drops[i];
      d.x += dxNorm * d.speed * speedMult * dt;
      d.y += dyNorm * d.speed * speedMult * dt;
      if (d.y > this.h + 30) {
        d.y = -30;
        d.x = Math.random() * (this.w + 260) - 80;
        if (this.ripples.length < (this.weather === 2 ? 12 : 22) && Math.random() < 0.25) {
          this.ripples.push({
            x: Phaser.Math.Between(60, this.w - 60),
            y: Phaser.Math.Between(60, this.h - 60),
            t: 0,
            max: 0.35,
          });
        }
      }
      g.lineStyle(this.weather === 2 ? 1.2 : 1.6, 0xb8d8f8, d.alpha * (this.weather === 2 ? 0.75 : 1));
      g.beginPath();
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + dxNorm * d.len, d.y + dyNorm * d.len);
      g.strokePath();
    }

    // 地面水花涟漪
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.t += dt;
      if (rp.t >= rp.max) {
        this.ripples[i] = this.ripples[this.ripples.length - 1];
        this.ripples.pop();
        continue;
      }
      const k = rp.t / rp.max;
      g.lineStyle(1.3, 0xb8dcff, (1 - k) * 0.28);
      g.strokeEllipse(rp.x, rp.y, 6 + k * 18, 3 + k * 9);
    }

    // 雷暴远景闪电微闪
    if (this.weather === 4) {
      this.lightningCd -= dt;
      if (this.lightningCd <= 0) {
        this.lightningCd = Phaser.Math.FloatBetween(4.2, 8.5);
        this.flashAlpha = 0.22;
      }
      if (this.flashAlpha > 0) {
        this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.1);
        this.flashRect.setAlpha(this.flashAlpha);
      }
    }
  }
}
