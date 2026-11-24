import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { exportSaveCode, importSaveCode } from '../core/save';
import { damageNumbersLabel, getSettings, nextDamageNumbers, nextVolume, updateSettings, volumeLabel } from '../core/settings';
import { createButton } from './Button';

/** 2×3 整齐设置按钮网格（主菜单可选附带存档导出/导入行）。点一下立即生效并保存。 */
export function addSettingsButtons(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  y: number,
  options?: { showSaveTransfer?: boolean; onSaveImported?: () => void },
): void {
  const group = scene.add.container(0, 0);
  parent.add(group);
  let transferMsg = '';
  const build = () => {
    group.removeAll(true);
    const s = getSettings();
    const bw = 162;
    const bh = 44;
    const stepX = 174;
    const rowY0 = y;
    const rowY1 = y + 54;
    group.add([
      createButton(
        scene,
        cx - stepX,
        rowY0,
        `音效：${volumeLabel(s.volume)}`,
        () => {
          updateSettings({ volume: nextVolume(getSettings().volume) });
          build();
        },
        { width: bw, height: bh, fontSize: 17, primary: false },
      ),
      createButton(
        scene,
        cx,
        rowY0,
        `音乐：${s.bgm ? '开' : '关'}`,
        () => {
          updateSettings({ bgm: !getSettings().bgm });
          build();
        },
        { width: bw, height: bh, fontSize: 17, primary: false },
      ),
      createButton(
        scene,
        cx + stepX,
        rowY0,
        `震屏：${s.shake ? '开' : '关'}`,
        () => {
          updateSettings({ shake: !getSettings().shake });
          build();
        },
        { width: bw, height: bh, fontSize: 17, primary: false },
      ),
      createButton(
        scene,
        cx - stepX,
        rowY1,
        `隐藏武器：${s.hideWeapons ? '开' : '关'}`,
        () => {
          updateSettings({ hideWeapons: !getSettings().hideWeapons });
          build();
        },
        { width: bw, height: bh, fontSize: 17, primary: false },
      ),
      createButton(
        scene,
        cx,
        rowY1,
        `数字：${damageNumbersLabel(s.damageNumbers)}`,
        () => {
          updateSettings({ damageNumbers: nextDamageNumbers(getSettings().damageNumbers) });
          build();
        },
        { width: bw, height: bh, fontSize: 17, primary: false },
      ),
      createButton(
        scene,
        cx + stepX,
        rowY1,
        `瞄准：${s.manualAim ? '鼠标' : '自动'}`,
        () => {
          updateSettings({ manualAim: !getSettings().manualAim });
          build();
        },
        { width: bw, height: bh, fontSize: 17, primary: false },
      ),
    ]);

    if (options?.showSaveTransfer) {
      const rowY2 = y + 114;
      group.add([
        createButton(
          scene,
          cx - 128,
          rowY2,
          '导出存档码',
          () => {
            const code = exportSaveCode();
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(code).then(
                () => {
                  transferMsg = '已复制存档码到剪贴板！';
                  build();
                },
                () => {
                  window.prompt('请手动复制以下存档码：', code);
                },
              );
            } else {
              window.prompt('请手动复制以下存档码：', code);
            }
          },
          { width: 240, height: 42, fontSize: 16, primary: false },
        ),
        createButton(
          scene,
          cx + 128,
          rowY2,
          '导入存档码',
          () => {
            const input = window.prompt('请粘贴之前导出的存档码（HH1:...）：');
            if (!input) return;
            if (importSaveCode(input)) {
              transferMsg = '存档导入成功！';
              sfx.play('unlock');
              build();
              options.onSaveImported?.();
            } else {
              transferMsg = '存档码格式无效，未改动当前进度';
              build();
            }
          },
          { width: 240, height: 42, fontSize: 16, primary: false },
        ),
      ]);
      if (transferMsg) {
        group.add(
          scene.add
            .text(cx, rowY2 + 34, transferMsg, {
              fontFamily: '"Noto Sans SC", sans-serif',
              fontSize: '13px',
              fontStyle: 'bold',
              color: transferMsg.includes('无效') ? '#ff7d78' : '#74ea78',
            })
            .setOrigin(0.5),
        );
      }
    }
  };
  build();
}
