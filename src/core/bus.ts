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
  /** 波次随机小事件横幅（参数：text, color） */
  WAVE_EVENT: 'wave-event',
  /** 第 20 波通关：选择凯旋结算或进入无尽模式 */
  VICTORY_CHOICE: 'victory-choice',
  /** 玩家选择进入无尽模式 */
  CONTINUE_ENDLESS: 'continue-endless',
  /** 玩家选择结束并进入结算页 */
  FINISH_RUN: 'finish-run',
  /** 移动端触控冲刺按钮触发 */
  DASH_TRIGGER: 'dash-trigger',
  /** 极短时间内连杀清屏爆发（参数：count） */
  KILL_STREAK: 'kill-streak',
  VICTORY: 'victory',
} as const;

/** 监听总线事件，场景关闭时自动解绑，避免重开一局后重复触发 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listen(scene: Phaser.Scene, event: string, fn: (...args: any[]) => void): void {
  bus.on(event, fn, scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off(event, fn, scene));
}
