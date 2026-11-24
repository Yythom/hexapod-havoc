import '@fontsource/lilita-one/latin.css';
import '@fontsource/zcool-kuaile/chinese-simplified.css';
import '@fontsource/zcool-kuaile/latin.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
import Phaser from 'phaser';
import { bgm } from './audio/bgm';
import { sfx } from './audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './config';
import { touchMove } from './core/input';
import { getSettings } from './core/settings';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { CodexScene } from './scenes/CodexScene';
import { GameScene } from './scenes/GameScene';
import { IntermissionScene } from './scenes/IntermissionScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import { UIScene } from './scenes/UIScene';

// 文字默认按高清倍率渲染，否则放大后会糊
const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
  text: (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
};
const addText = factory.text;
factory.text = function (this: Phaser.GameObjects.GameObjectFactory, x, y, text, style) {
  return addText.call(this, x, y, text, { resolution: RENDER_SCALE, ...style });
};

const initSettings = getSettings();
sfx.init(initSettings.volume);
bgm.init(initSettings.bgm, initSettings.volume);

async function preloadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.race([
    Promise.all([
      document.fonts.load('400 48px "Lilita One"', '0123456789HEXAPODLV'),
      document.fonts.load('400 48px "ZCOOL KuaiLe"', '六足战虫开始战斗出发迎敌'),
      document.fonts.load('500 24px "Noto Sans SC"', '六足战虫商店属性伤害射程'),
      document.fonts.load('700 24px "Noto Sans SC"', '六足战虫商店属性伤害射程'),
    ]),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}

/**
 * 同步 #app 容器与浏览器真实可视区域（visualViewport），避免横屏切换或浏览器顶/底栏
 * 动画展开/收起时 100dvh 滞后导致画布被标签头或底部工具栏遮挡。
 */
function syncAppViewport(game?: Phaser.Game): void {
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0);
  }
  const app = document.getElementById('app');
  if (!app) return;

  const vv = window.visualViewport;
  const zoomed = vv != null && Math.abs(vv.scale - 1) > 0.05;
  const w = Math.floor(!zoomed && vv ? vv.width : window.innerWidth);
  const h = Math.floor(!zoomed && vv ? vv.height : window.innerHeight);
  const left = Math.floor(!zoomed && vv ? vv.offsetLeft : 0);
  const top = Math.floor(!zoomed && vv ? vv.offsetTop : 0);
  if (w <= 0 || h <= 0) return;

  const nextLeft = `${left}px`;
  const nextTop = `${top}px`;
  const nextW = `${w}px`;
  const nextH = `${h}px`;
  const changed =
    app.style.left !== nextLeft ||
    app.style.top !== nextTop ||
    app.style.width !== nextW ||
    app.style.height !== nextH;

  if (changed) {
    app.style.left = nextLeft;
    app.style.top = nextTop;
    app.style.width = nextW;
    app.style.height = nextH;
  }
  if (game && (changed || game.scale.parentSize.width !== w || game.scale.parentSize.height !== h)) {
    game.scale.setParentSize(w, h);
  }
}

function installViewportSync(game: Phaser.Game): void {
  const timers: number[] = [];
  const run = () => syncAppViewport(game);
  const schedule = () => {
    run();
    requestAnimationFrame(run);
    while (timers.length > 0) window.clearTimeout(timers.pop());
    // 手机横竖屏切换时，浏览器标签栏/底部工具栏通常在 100~500ms 后才完成高度动画
    for (const ms of [120, 300, 550]) {
      timers.push(window.setTimeout(run, ms));
    }
  };

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', schedule);
  screen.orientation?.addEventListener?.('change', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', run);
  document.addEventListener('fullscreenchange', schedule);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule();
  });
  schedule();
}

void preloadFonts().then(() => {
  syncAppViewport();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    // 画布按高清倍率放大，各场景镜头再放大同样倍数，逻辑坐标仍是 1280×720
    width: GAME_WIDTH * RENDER_SCALE,
    height: GAME_HEIGHT * RENDER_SCALE,
    backgroundColor: '#0e140b',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { activePointers: 3, gamepad: true },
    render: { antialias: true },
    scene: [BootScene, MenuScene, CharacterSelectScene, CodexScene, GameScene, UIScene, IntermissionScene, ResultScene],
  });
  installViewportSync(game);

  // 开发模式下暴露给控制台，方便调试；模拟玩家（调难度用）也只在开发模式加载
  if (import.meta.env.DEV) {
    Object.assign(window, { __game: game, __touchMove: touchMove, __sfx: sfx });
    void import('./dev/bot').then((m) => m.installBot(game));
  }
});
