import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config';
import { getSettings } from '../core/settings';

/**
 * 界面类场景的镜头：按高清渲染倍率放大，左上角对齐，
 * 这样界面代码里的坐标仍然是 1280×720 的逻辑坐标。
 */
export function setupUICamera(scene: Phaser.Scene): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
}

/** 干脆利落的黑墨转场淡入（仅用于全屏独立场景，不用于战斗 HUD 叠加层） */
export function fadeInScene(scene: Phaser.Scene, duration = 150): void {
  const veil = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050507, 1).setOrigin(0).setDepth(9999);
  scene.tweens.add({
    targets: veil,
    alpha: 0,
    duration,
    ease: 'Quad.Out',
    onComplete: () => veil.destroy(),
  });
}

/** 带黑墨淡出转场的场景切换（防连点） */
export function transitionTo(scene: Phaser.Scene, target: string, data?: object, duration = 120): void {
  if (scene.data.get('__transitioning')) return;
  scene.data.set('__transitioning', true);
  const veil = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050507, 0).setOrigin(0).setDepth(9999).setInteractive();
  scene.tweens.add({
    targets: veil,
    alpha: 1,
    duration,
    ease: 'Quad.In',
    onComplete: () => scene.scene.start(target, data),
  });
}

/** 指针在界面逻辑坐标里的位置 */
export function uiPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
  return { x: p.x / RENDER_SCALE, y: p.y / RENDER_SCALE };
}

/** 震屏（设置里可以关掉） */
export function shake(scene: Phaser.Scene, duration: number, intensity: number): void {
  if (getSettings().shake) scene.cameras.main.shake(duration, intensity);
}
