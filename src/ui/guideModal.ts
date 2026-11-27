import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { GUIDE_TAB_MAP, MECHANICS_GUIDE, type GuideTabId } from '../data/mechanicsGuide';
import { createButton } from './Button';
import { COLOR, cardTitle, displayLabel, divider, drawChamferPlate, label, panel, pill } from './widgets';

export interface GuideModalHandle {
  container: Phaser.GameObjects.Container;
  close: () => void;
}

/**
 * 在指定矩形区域 (x, y, w, h) 内渲染某一分类的 2×2 机制速查卡片。
 * 供全屏图鉴「机制速查」标签页与局内/菜单弹窗复用。
 */
export function renderMechanicsCards(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  tabId: GuideTabId,
): void {
  const tab = GUIDE_TAB_MAP[tabId];
  const gapX = 16;
  const gapY = 14;
  const cardW = Math.floor((w - gapX) / 2);
  const cardH = Math.floor((h - gapY) / 2);
  const compact = cardH < 215;

  tab.cards.forEach((card, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = x + col * (cardW + gapX);
    const cy = y + row * (cardH + gapY);

    const g = scene.add.graphics();
    drawChamferPlate(g, cx, cy, cardW, cardH, {
      fill: COLOR.panelDeep,
      border: card.accent,
      borderWidth: 1.8,
      borderAlpha: 0.72,
      accentTop: card.accent,
      headerH: 0,
      shadowX: 3,
      shadowY: 4,
      cutBig: 9,
      cutSmall: 3,
      inkWidth: 2.6,
    });
    parent.add(g);

    // 标题 + 右侧徽章胶囊
    const titleObj = cardTitle(scene, cx + 16, cy + (compact ? 22 : 26), card.title, compact ? 17 : 19, card.css).setOrigin(0, 0.5);
    const badgeObj = pill(scene, 0, cy + (compact ? 22 : 26), card.badge, 0x12141a, card.accent, card.css, 11.5, 9, 21);
    badgeObj.x = cx + cardW - 14 - badgeObj.width / 2;
    const maxTitleW = badgeObj.x - badgeObj.width / 2 - (cx + 16) - 10;
    if (titleObj.width > maxTitleW && maxTitleW > 40) titleObj.setScale(maxTitleW / titleObj.width);
    parent.add([titleObj, badgeObj]);

    const divY = cy + (compact ? 41 : 47);
    parent.add(divider(scene, cx + 16, divY, cardW - 32, card.accent, 0.35));

    // 要点列表（自适应行距防止溢出）
    const bulletCount = card.bullets.length;
    const fontSize = compact ? (bulletCount >= 4 ? 12.2 : 13) : bulletCount >= 4 ? 13 : 13.8;
    const wrapW = cardW - 38;
    let curY = divY + (compact ? 9 : 12);
    const bottomLimit = cy + cardH - 8;

    for (const line of card.bullets) {
      if (curY >= bottomLimit - 12) break;
      const dot = scene.add.circle(cx + 21, curY + fontSize * 0.62, 2.8, card.accent, 0.95);
      const txt = label(scene, cx + 30, curY, line, fontSize, '#e6e5de', false, wrapW)
        .setOrigin(0, 0)
        .setAlign('left')
        .setLineSpacing(compact ? 2 : 3);
      parent.add([dot, txt]);
      curY += txt.height + (compact ? 5 : 7);
    }
  });
}

/**
 * 打开全功能「机制速查手册」弹窗（支持主菜单、暂停界面、波间商店随时查阅）。
 * 快捷键：← / → 切分类，1~5 直达分类，ESC 关闭。
 */
export function openMechanicsGuide(
  scene: Phaser.Scene,
  opts?: { initialTab?: GuideTabId; depth?: number; onClose?: () => void },
): GuideModalHandle {
  const W = GAME_WIDTH;
  const H = GAME_HEIGHT;
  const pw = 1056;
  const ph = 648;
  const px = Math.round((W - pw) / 2);
  const py = Math.round((H - ph) / 2);
  let activeTab: GuideTabId = opts?.initialTab ?? 'combat';

  const root = scene.add.container(0, 0).setDepth(opts?.depth ?? 130);
  const dim = scene.add.rectangle(0, 0, W, H, 0x050507, 0.8).setOrigin(0).setInteractive();
  const blocker = scene.add.zone(px, py, pw, ph).setOrigin(0).setInteractive();
  const body = scene.add.container(0, 0);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sfx.play('click');
    root.destroy();
  };

  dim.on('pointerup', close);
  root.add([dim, panel(scene, px, py, pw, ph, COLOR.gold, COLOR.panel, 2, COLOR.gold), blocker, body]);

  const renderBody = () => {
    body.removeAll(true);
    const tab = GUIDE_TAB_MAP[activeTab];
    const tabIdx = MECHANICS_GUIDE.findIndex((t) => t.id === activeTab);

    // 顶栏标题 + 当前分类副标题 + 页码提示
    body.add(displayLabel(scene, px + 28, py + 32, '📖 机制速查手册', 27, COLOR.goldText).setOrigin(0, 0.5));
    const subPill = pill(scene, 0, py + 32, tab.subtitle, COLOR.panelDeep, tab.accent, tab.css, 12.5, 12, 24);
    subPill.x = px + 252 + subPill.width / 2;
    body.add(subPill);
    body.add(label(scene, px + pw - 28, py + 32, `${tabIdx + 1} / ${MECHANICS_GUIDE.length}`, 14, COLOR.dim, true).setOrigin(1, 0.5));

    // 5 个分类标签按钮
    const tabW = 188;
    const tabGap = 15;
    const tabX0 = px + 28;
    const tabY = py + 78;
    MECHANICS_GUIDE.forEach((t, i) => {
      const active = t.id === activeTab;
      body.add(
        createButton(
          scene,
          tabX0 + i * (tabW + tabGap) + tabW / 2,
          tabY,
          `${i + 1}. ${t.label}`,
          () => {
            if (activeTab === t.id) return;
            activeTab = t.id;
            sfx.play('click');
            renderBody();
          },
          {
            width: tabW,
            height: 36,
            fontSize: 15.5,
            primary: active,
            accentColor: active ? undefined : t.accent,
          },
        ),
      );
    });

    body.add(divider(scene, px + 28, py + 104, pw - 56, tab.accent, 0.45));

    // 主体 2×2 速查卡片区
    renderMechanicsCards(scene, body, px + 28, py + 114, pw - 56, ph - 178, activeTab);

    // 底栏：上一篇 / 关闭 / 下一篇
    const footY = py + ph - 32;
    body.add(
      createButton(
        scene,
        px + 104,
        footY,
        '◀ 上一分类',
        () => stepTab(-1),
        { width: 148, height: 40, fontSize: 15, primary: false },
      ),
    );
    body.add(
      createButton(
        scene,
        W / 2,
        footY,
        '关闭 [Esc]',
        close,
        { width: 176, height: 42, fontSize: 17, primary: false },
      ),
    );
    body.add(
      createButton(
        scene,
        px + pw - 104,
        footY,
        '下一分类 ▶',
        () => stepTab(1),
        { width: 148, height: 40, fontSize: 15, primary: false },
      ),
    );
  };

  const stepTab = (delta: number) => {
    const idx = MECHANICS_GUIDE.findIndex((t) => t.id === activeTab);
    const next = (idx + delta + MECHANICS_GUIDE.length) % MECHANICS_GUIDE.length;
    activeTab = MECHANICS_GUIDE[next].id;
    sfx.play('click');
    renderBody();
  };

  const jumpTab = (idx: number) => {
    const target = MECHANICS_GUIDE[idx];
    if (!target || target.id === activeTab) return;
    activeTab = target.id;
    sfx.play('click');
    renderBody();
  };

  const kb = scene.input.keyboard;
  const onLeft = () => stepTab(-1);
  const onRight = () => stepTab(1);
  const onEsc = () => close();
  const numHandlers = [0, 1, 2, 3, 4].map((i) => () => jumpTab(i));
  const numEvents = ['keydown-ONE', 'keydown-TWO', 'keydown-THREE', 'keydown-FOUR', 'keydown-FIVE'];

  if (kb) {
    kb.on('keydown-LEFT', onLeft);
    kb.on('keydown-RIGHT', onRight);
    kb.on('keydown-ESC', onEsc);
    numEvents.forEach((ev, i) => kb.on(ev, numHandlers[i]));
  }

  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    closed = true;
    if (kb) {
      kb.off('keydown-LEFT', onLeft);
      kb.off('keydown-RIGHT', onRight);
      kb.off('keydown-ESC', onEsc);
      numEvents.forEach((ev, i) => kb.off(ev, numHandlers[i]));
    }
    opts?.onClose?.();
  });

  renderBody();
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 120 });

  return { container: root, close };
}
