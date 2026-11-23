import Phaser from 'phaser';

/** 场景之间的事件总线（GameScene ⇄ UIScene ⇄ IntermissionScene） */
export const bus = new Phaser.Events.EventEmitter();

export const EVT = {
  WAVE_START: 'wave-start',
  WAVE_CLEAR: 'wave-clear',
  /** 波次结束、进入升级/宝箱/商店界面 */
  INTERMISSION: 'intermission',
  /** 波次间界面结束，开始下一波 */
  NEXT_WAVE: 'next-wave',
  PLAYER_HIT: 'player-hit',
  PLAYER_DEAD: 'player-dead',
  LEVEL_UP: 'level-up',
  /** 解锁了新角色（参数：角色 id） */
  UNLOCK: 'unlock',
  VICTORY: 'victory',
} as const;

/** 监听总线事件，场景关闭时自动解绑，避免重开一局后重复触发 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listen(scene: Phaser.Scene, event: string, fn: (...args: any[]) => void): void {
  bus.on(event, fn, scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off(event, fn, scene));
}
