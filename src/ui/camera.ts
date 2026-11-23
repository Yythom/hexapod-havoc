import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { getSettings } from '../core/settings';

/**
 * 界面类场景的镜头：按高清渲染倍率放大，左上角对齐，
 * 这样界面代码里的坐标仍然是 1280×720 的逻辑坐标。
 */
export function setupUICamera(scene: Phaser.Scene): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
}

/** 指针在界面逻辑坐标里的位置 */
export function uiPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
  return { x: p.x / RENDER_SCALE, y: p.y / RENDER_SCALE };
}

/** 震屏（设置里可以关掉） */
export function shake(scene: Phaser.Scene, duration: number, intensity: number): void {
  if (getSettings().shake) scene.cameras.main.shake(duration, intensity);
}
