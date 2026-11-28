import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { canInstallPwa, isStandalonePwa, triggerPwaInstall } from '../core/pwa';
import { exportSaveCode, importSaveCode } from '../core/save';
import {
  cameraZoomLabel,
  damageNumbersLabel,
  getSettings,
  nextCameraZoom,
  nextDamageNumbers,
  nextVolume,
  updateSettings,
  volumeLabel,
} from '../core/settings';
import { createButton } from './Button';

/** 整齐设置按钮网格（音效/音乐/震屏 + 隐藏武器/伤害数字 + 视角缩放整行，主菜单可选附带存档导出/导入行）。点一下立即生效并保存。 */
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
    const fullW = stepX * 2 + bw;
    const halfGap = 14;
    const halfW = (fullW - halfGap) / 2;
    const halfOff = (halfW + halfGap) / 2;
    const rowY0 = y;
    const rowY1 = y + 54;
    const rowY2 = y + 108;
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
        cx - halfOff,
        rowY1,
        `隐藏武器：${s.hideWeapons ? '开' : '关'}`,
        () => {
          updateSettings({ hideWeapons: !getSettings().hideWeapons });
          build();
        },
        { width: halfW, height: bh, fontSize: 17, primary: false },
      ),
      createButton(
        scene,
        cx + halfOff,
        rowY1,
        `伤害数字：${damageNumbersLabel(s.damageNumbers)}`,
        () => {
          updateSettings({ damageNumbers: nextDamageNumbers(getSettings().damageNumbers) });
          build();
        },
        { width: halfW, height: bh, fontSize: 17, primary: false },
      ),
      createButton(
        scene,
        cx,
        rowY2,
        `视角缩放：${cameraZoomLabel(s.cameraZoom)}`,
        () => {
          updateSettings({ cameraZoom: nextCameraZoom(getSettings().cameraZoom) });
          build();
        },
        { width: fullW, height: bh, fontSize: 17, primary: false },
      ),
    ]);

    if (options?.showSaveTransfer) {
      const rowY3 = y + 168;
      const showPwaBtn = canInstallPwa();
      const btnW = showPwaBtn ? 162 : 240;
      const exportX = showPwaBtn ? cx - stepX : cx - 128;
      const importX = showPwaBtn ? cx : cx + 128;
      group.add([
        createButton(
          scene,
          exportX,
          rowY3,
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
          { width: btnW, height: 42, fontSize: 16, primary: false },
        ),
        createButton(
          scene,
          importX,
          rowY3,
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
          { width: btnW, height: 42, fontSize: 16, primary: false },
        ),
      ]);
      if (showPwaBtn) {
        group.add(
          createButton(
            scene,
            cx + stepX,
            rowY3,
            '📲 安装应用',
            () => {
              void triggerPwaInstall().then((res) => {
                if (res === 'accepted') {
                  transferMsg = '已安装到设备桌面，支持全屏离线畅玩！';
                  sfx.play('unlock');
                } else if (res === 'ios-guide') {
                  transferMsg = 'iOS 请点浏览器「分享」→「添加到主屏幕」';
                }
                build();
              });
            },
            { width: btnW, height: 42, fontSize: 16, primary: false, variant: 'emerald' },
          ),
        );
      } else if (isStandalonePwa() && !transferMsg) {
        transferMsg = '★ 当前已处于 PWA 独立全屏应用模式（支持离线游玩）';
      }
      if (transferMsg) {
        group.add(
          scene.add
            .text(cx, rowY3 + 34, transferMsg, {
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
