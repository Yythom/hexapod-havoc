import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { getSettings, nextVolume, updateSettings, volumeLabel } from '../core/settings';
import { createButton } from './Button';

/** 一排两个设置按钮：音效音量（关/小/中/大 循环）、震屏开关。点一下立即生效并保存。 */
export function addSettingsButtons(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, cx: number, y: number): void {
  const group = scene.add.container(0, 0);
  parent.add(group);
  const build = () => {
    group.removeAll(true);
    const s = getSettings();
    group.add(
      createButton(
        scene,
        cx - 135,
        y,
        `音效：${volumeLabel(s.volume)}`,
        () => {
          const v = nextVolume(getSettings().volume);
          updateSettings({ volume: v });
          sfx.setVolume(v);
          build();
        },
        { width: 240, height: 52, fontSize: 22, primary: false },
      ),
    );
    group.add(
      createButton(
        scene,
        cx + 135,
        y,
        `震屏：${s.shake ? '开' : '关'}`,
        () => {
          updateSettings({ shake: !getSettings().shake });
          build();
        },
        { width: 240, height: 52, fontSize: 22, primary: false },
      ),
    );
  };
  build();
}
