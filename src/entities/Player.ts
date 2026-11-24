import Phaser from 'phaser';
import { DEPTH, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import type { ShellSkinId } from '../core/save';
import { getSettings } from '../core/settings';
import { BeetleView } from './BeetleView';

export class Player {
  readonly view: BeetleView;
  readonly radius = 12;
  /** 剩余无敌时间（秒） */
  invuln = 0;
  /** 被丝弹减速的剩余时间 */
  slowTime = 0;
  /** 鸟羽毛/虎甲加速的剩余时间 */
  hasteTime = 0;
  /** 琥珀狂热剩余时间（攻速 +25%，移速 +15%） */
  frenzyTime = 0;
  /** 螳螂冲刺后短暂近战必暴击窗口 */
  mantisCritTime = 0;
  /** 主动轻冲刺状态与多段充能冷却 */
  dashTime = 0;
  dashCd = 0;
  dashCdMax = 5.5;
  dashCharges = 1;
  maxDashCharges = 1;
  /** 本次冲刺是否已触发过极限擦弹 */
  dashGrazed = false;
  /** 本次冲刺起点的坐标（供冲刺收尾或拉丝使用） */
  dashStartX = 0;
  dashStartY = 0;
  dashDirX = 1;
  dashDirY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, shell: string, skin?: ShellSkinId) {
    this.view = new BeetleView(scene, x, y, shell);
    this.view.setScale(0.78);
    this.view.setDepth(DEPTH.player);
    this.view.setWeaponsVisible(!getSettings().hideWeapons);
    if (skin) this.view.setShellSkin(skin);
  }

  get x(): number {
    return this.view.x;
  }

  get y(): number {
    return this.view.y;
  }

  /** 同步最大冲刺充能数与动态冷却上限 */
  syncDashConfig(maxCharges: number, speedPct = 0, cooldownPct = 0): void {
    const prevMax = this.maxDashCharges;
    this.maxDashCharges = Math.max(1, maxCharges);
    if (this.maxDashCharges > prevMax) {
      this.dashCharges = Math.min(this.maxDashCharges, this.dashCharges + (this.maxDashCharges - prevMax));
    } else if (this.dashCharges > this.maxDashCharges) {
      this.dashCharges = this.maxDashCharges;
    }
    const base = 5.5 / Math.max(0.65, 1 + speedPct * 0.45);
    this.dashCdMax = Math.max(1.8, base * Math.max(0.35, 1 + cooldownPct));
  }

  /** 尝试触发主动轻冲刺（Space / Shift），返回是否成功 */
  tryDash(ix: number, iy: number, speedPct = 0, cooldownPct = 0, maxCharges = 1): boolean {
    this.syncDashConfig(maxCharges, speedPct, cooldownPct);
    if (this.dashCharges <= 0 || this.dashTime > 0) return false;
    const len = Math.hypot(ix, iy);
    if (len > 0.08) {
      this.dashDirX = ix / len;
      this.dashDirY = iy / len;
    } else {
      this.dashDirX = Math.cos(this.view.rotation);
      this.dashDirY = Math.sin(this.view.rotation);
    }
    this.dashStartX = this.view.x;
    this.dashStartY = this.view.y;
    this.dashGrazed = false;
    this.dashTime = 0.16;
    this.dashCharges--;
    if (this.dashCd <= 0) this.dashCd = this.dashCdMax;
    this.invuln = Math.max(this.invuln, 0.2);
    return true;
  }

  /** ix/iy：移动方向，长度 0~1；windX/windY：暴雨阵风偏置 */
  update(dt: number, ix: number, iy: number, baseSpeed: number, shield = false, windX = 0, windY = 0): boolean {
    if (!Number.isFinite(ix) || !Number.isFinite(iy)) {
      ix = 0;
      iy = 0;
    }
    if (this.slowTime > 0) this.slowTime -= dt;
    if (this.hasteTime > 0) this.hasteTime -= dt;
    if (this.frenzyTime > 0) this.frenzyTime = Math.max(0, this.frenzyTime - dt);
    if (this.mantisCritTime > 0) this.mantisCritTime = Math.max(0, this.mantisCritTime - dt);

    if (this.dashCharges < this.maxDashCharges) {
      if (this.dashCd <= 0) this.dashCd = this.dashCdMax;
      this.dashCd -= dt;
      if (this.dashCd <= 0) {
        this.dashCharges = Math.min(this.maxDashCharges, this.dashCharges + 1);
        this.dashCd = this.dashCharges < this.maxDashCharges ? this.dashCdMax : 0;
      }
    } else {
      this.dashCd = 0;
    }

    const v = this.view;
    v.setWeaponsVisible(!getSettings().hideWeapons);
    let animLen = 0;
    let dashEnded = false;

    if (this.dashTime > 0) {
      this.dashTime = Math.max(0, this.dashTime - dt);
      const dashSpeed = 650;
      v.x = Phaser.Math.Clamp(v.x + this.dashDirX * dashSpeed * dt, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
      v.y = Phaser.Math.Clamp(v.y + this.dashDirY * dashSpeed * dt, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
      v.rotation = Math.atan2(this.dashDirY, this.dashDirX);
      animLen = 1;
      if (this.dashTime <= 0) dashEnded = true;
    } else {
      const speed =
        baseSpeed *
        (this.slowTime > 0 ? 0.7 : 1) *
        (this.hasteTime > 0 ? 1.3 : 1) *
        (this.frenzyTime > 0 ? 1.15 : 1);
      let len = Math.hypot(ix, iy);
      if (len > 1) {
        ix /= len;
        iy /= len;
        len = 1;
      }
      if (len > 0.01) {
        v.x = Phaser.Math.Clamp(v.x + (ix * speed + windX) * dt, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
        v.y = Phaser.Math.Clamp(v.y + (iy * speed + windY) * dt, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
        v.rotation = Phaser.Math.Angle.RotateTo(v.rotation, Math.atan2(iy, ix), 12 * dt);
      } else if (Math.abs(windX) > 0.1 || Math.abs(windY) > 0.1) {
        v.x = Phaser.Math.Clamp(v.x + windX * 0.35 * dt, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
        v.y = Phaser.Math.Clamp(v.y + windY * 0.35 * dt, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
      }
      animLen = len;
    }

    v.setStatus(shield, this.hasteTime > 0 || this.dashTime > 0, this.slowTime > 0, this.frenzyTime > 0 || this.mantisCritTime > 0);
    v.animate(dt, animLen);

    if (this.invuln > 0) {
      this.invuln -= dt;
      v.setAlpha(this.dashTime > 0 ? 0.72 : this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0 ? 0.45 : 1);
    } else {
      v.setAlpha(1);
    }
    return dashEnded;
  }
}
