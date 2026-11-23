import '@fontsource/lilita-one/latin.css';
import '@fontsource/zcool-kuaile/chinese-simplified.css';
import '@fontsource/zcool-kuaile/latin.css';
import Phaser from 'phaser';
import { sfx } from './audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './config';
import { touchMove } from './core/input';
import { getSettings } from './core/settings';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
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

sfx.init(getSettings().volume);

async function preloadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.race([
    Promise.all([
      document.fonts.load('400 48px "Lilita One"', '0123456789HEXAPODLV'),
      document.fonts.load('400 48px "ZCOOL KuaiLe"', '六足战虫开始战斗'),
    ]),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}

void preloadFonts().then(() => {
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
    input: { activePointers: 3 },
    render: { antialias: true },
    scene: [BootScene, MenuScene, CharacterSelectScene, GameScene, UIScene, IntermissionScene, ResultScene],
  });

  // 开发模式下暴露给控制台，方便调试；模拟玩家（调难度用）也只在开发模式加载
  if (import.meta.env.DEV) {
    Object.assign(window, { __game: game, __touchMove: touchMove, __sfx: sfx });
    void import('./dev/bot').then((m) => m.installBot(game));
  }
});
