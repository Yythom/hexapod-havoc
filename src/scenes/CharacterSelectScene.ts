import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, IS_COARSE_POINTER } from '../config';
import type { RunSetup } from '../core/RunState';
import { bestCleared, isUnlocked, loadSave, maxDifficulty, rememberChoice } from '../core/save';
import { weaponDamage } from '../core/combat';
import { BASE_STATS, type Stats } from '../core/stats';
import { CHARACTER_ORDER, CHARACTERS, unlockText } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { ZERO_MODS, type Mods } from '../data/items';
import { weaponTex } from '../art/icons';
import { SPRITE_RES } from '../art/draw';
import { KIND_LABEL, TIERS, WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { createButton } from '../ui/Button';
import { setupUICamera } from '../ui/camera';
import {
  COLOR,
  TAG_STYLE,
  cardTitle,
  displayLabel,
  divider,
  label,
  panel,
  pill,
  slotBox,
  warmBackdrop,
  weaponLines,
} from '../ui/widgets';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
/** 左侧角色网格：7 列 × 2 行 */
const GRID_COLS = 7;
const GRID_W = 896;
const CARD_GAP = 8;
const CARD_W = (GRID_W - CARD_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CARD_H = 125;
const CARD_X0 = 36;
const CARD_Y = 86;
const RIGHT_X = 968;
const RIGHT_W = 276;

/** 天气难度左色条（晴天琥珀 / 阴天灰蓝 / 小雨青蓝 / 暴雨深靛 / 雷暴紫电） */
const WEATHER_ACCENT = [0xf0b238, 0x86a2bc, 0x4ec0de, 0x5c7ae8, 0xb46eff];

type Container = Phaser.GameObjects.Container;

const nbsp = (s: string) => s.replace(/ /g, '\u00a0');

/** 开局前选角色、难度、初始武器（土豆兄弟方正高对比面板风） */
export class CharacterSelectScene extends Phaser.Scene {
  private character = '';
  private difficulty = 0;
  private weapon = '';
  private root: Container | null = null;
  private beetles: BeetleView[] = [];
  private weatherFx!: WeatherAmbience;

  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    setupUICamera(this);
    const last = loadSave().last;
    this.root = null;
    this.beetles = [];
    this.character = isUnlocked(last.character) ? last.character : CHARACTER_ORDER[0];
    this.difficulty = last.difficulty;
    this.weapon = last.weapon;
    this.normalize();

    warmBackdrop(this, W, H);
    this.weatherFx = new WeatherAmbience(this, 0, this.difficulty);
    this.input.keyboard!.on('keydown-ENTER', () => this.start());
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('Menu'));
    this.render();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.weatherFx.update(dt);
    for (const b of this.beetles) b.animate(dt, 0.45);
  }

  private normalize(): void {
    const c = CHARACTERS[this.character];
    this.difficulty = Phaser.Math.Clamp(this.difficulty, 0, maxDifficulty(this.character));
    if (!c.startWeapons.includes(this.weapon)) this.weapon = c.startWeapons[0] ?? '';
  }

  private render(): void {
    this.root?.destroy();
    this.beetles = [];
    const root = this.add.container(0, 0);
    this.root = root;

    const title = displayLabel(this, CARD_X0, 35, '出战准备', 30, COLOR.text).setOrigin(0, 0.5);
    root.add(title);
    root.add(label(this, CARD_X0 + title.width + 16, 36, '选择战虫、天气难度与初始武器', 15, COLOR.dim).setOrigin(0, 0.5));
    root.add(createButton(this, W - 96, 35, '返回菜单', () => this.scene.start('Menu'), { width: 138, height: 42, fontSize: 18, primary: false }));

    CHARACTER_ORDER.forEach((id, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      this.characterCard(root, id, CARD_X0 + col * (CARD_W + CARD_GAP), CARD_Y + row * (CARD_H + CARD_GAP));
    });
    this.detailPanel(root);
    this.difficultyRow(root);
    this.weaponRow(root);

    const locked = !isUnlocked(this.character);
    root.add(
      createButton(this, RIGHT_X + RIGHT_W / 2, 654, locked ? '尚未解锁' : '出发迎敌 ▶', () => this.start(), {
        width: RIGHT_W,
        height: 66,
        fontSize: 27,
        disabled: locked,
        leftIcon: locked ? 'ui-lock' : undefined,
      }),
    );
  }

  private characterCard(root: Container, id: string, x: number, y: number): void {
    const c = CHARACTERS[id];
    const unlocked = isUnlocked(id);
    const selected = id === this.character;

    const card = this.add.container(x + CARD_W / 2, y + CARD_H / 2);
    const lx = -CARD_W / 2;
    const ly = -CARD_H / 2;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      // 硬偏移黑影
      g.fillStyle(COLOR.ink, 0.92);
      g.fillRoundedRect(lx + 3, ly + 4, CARD_W, CARD_H, 7);
      // 底色
      g.fillStyle(selected ? 0x2e313a : hover ? 0x292b33 : COLOR.panel, 1);
      g.fillRoundedRect(lx, ly, CARD_W, CARD_H, 7);
      // 聚光圆底
      g.fillStyle(0x131418, 0.85);
      g.fillCircle(0, -10, 36);
      if (selected) {
        g.lineStyle(2, COLOR.gold, 0.7);
        g.strokeCircle(0, -10, 36);
      }
      // 选中白/金高亮内框 + 外黑墨线
      g.lineStyle(selected ? 3 : 2, selected ? 0xf5f4ef : hover ? 0xd2d2dc : COLOR.border, 1);
      g.strokeRoundedRect(lx + 1.5, ly + 1.5, CARD_W - 3, CARD_H - 3, 6);
      g.lineStyle(2.8, COLOR.ink, 1);
      g.strokeRoundedRect(lx, ly, CARD_W, CARD_H, 7);
    };
    draw(false);
    card.add(g);

    const beetle = new BeetleView(this, 0, -10, c.shell).setScale(1.05).setRotation(-Math.PI / 2);
    if (!unlocked) beetle.setAlpha(0.4);
    card.add(beetle);
    this.beetles.push(beetle);

    if (!unlocked) {
      const lb = this.add.graphics();
      lb.fillStyle(0x101116, 0.94);
      lb.fillCircle(lx + CARD_W - 16, ly + 16, 11);
      lb.lineStyle(1.6, COLOR.border, 0.85);
      lb.strokeCircle(lx + CARD_W - 16, ly + 16, 11);
      card.add(lb);
      card.add(this.add.image(lx + CARD_W - 16, ly + 16, 'ui-lock').setDisplaySize(14, 14).setAlpha(0.9));
    }

    const name = label(this, 0, ly + CARD_H - 18, c.name, 14, unlocked ? (selected ? '#ffffff' : COLOR.text) : COLOR.dim, true).setOrigin(0.5);
    if (name.width > CARD_W - 12) name.setScale((CARD_W - 12) / name.width);
    card.add(name);

    const best = bestCleared(id);
    if (unlocked && best >= 0) {
      card.add(label(this, lx + 8, ly + 7, `★${DIFFICULTIES[best].name}`, 11, COLOR.good, true).setOrigin(0, 0));
    }

    const zone = this.tapZone(lx, ly, CARD_W, CARD_H, () => {
      this.character = id;
      this.normalize();
      this.render();
    });
    zone.on('pointerover', () => {
      if (!selected) {
        draw(true);
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 1.04, angle: -1.4, duration: 75, ease: 'Quad.Out' });
      }
    });
    zone.on('pointerout', () => {
      if (!selected) {
        draw(false);
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 1, angle: 0, duration: 75, ease: 'Quad.Out' });
      }
    });
    card.add(zone);
    root.add(card);
  }

  /** 右侧详情面板 */
  private detailPanel(root: Container): void {
    const c = CHARACTERS[this.character];
    const unlocked = isUnlocked(this.character);
    const h = 514;
    root.add(panel(this, RIGHT_X, CARD_Y, RIGHT_W, h, COLOR.border, COLOR.panel, 2, COLOR.gold, 78));

    const cx = RIGHT_X + RIGHT_W / 2;
    const lx = RIGHT_X + 18;
    const wrapW = RIGHT_W - 36;

    root.add(cardTitle(this, cx, CARD_Y + 26, c.name, 23, COLOR.goldText).setOrigin(0.5));
    root.add(pill(this, cx, CARD_Y + 56, c.role, COLOR.panelDeep, COLOR.border, COLOR.dim, 13, 12, 22));
    root.add(divider(this, lx, CARD_Y + 80, wrapW));

    let y = CARD_Y + 94;
    root.add(label(this, lx, y, '角色加成', 16, COLOR.goldText, true).setOrigin(0, 0));
    y += 24;
    for (const t of c.pros) {
      const txt = label(this, lx + 4, y, nbsp(`+ ${t}`), 15, COLOR.good, false, wrapW - 4).setOrigin(0, 0).setAlign('left');
      root.add(txt);
      y += txt.height + 5;
    }

    y += 10;
    root.add(label(this, lx, y, '角色限制', 16, COLOR.goldText, true).setOrigin(0, 0));
    y += 24;
    if (c.cons.length) {
      for (const t of c.cons) {
        const txt = label(this, lx + 4, y, nbsp(`− ${t}`), 15, COLOR.bad, false, wrapW - 4).setOrigin(0, 0).setAlign('left');
        root.add(txt);
        y += txt.height + 5;
      }
    } else {
      const none = label(this, lx + 4, y, '无特殊限制', 15, COLOR.dim).setOrigin(0, 0).setAlign('left');
      root.add(none);
      y += none.height + 5;
    }

    const wy = Math.min(CARD_Y + h - 226, Math.max(CARD_Y + 278, y + 14));
    if (!unlocked) {
      const box = this.add.graphics();
      box.fillStyle(0x281414, 0.95);
      box.fillRoundedRect(RIGHT_X + 12, wy + 8, RIGHT_W - 24, CARD_Y + h - wy - 20, 6);
      box.lineStyle(2, 0xc8403c, 0.9);
      box.strokeRoundedRect(RIGHT_X + 12, wy + 8, RIGHT_W - 24, CARD_Y + h - wy - 20, 6);
      root.add(box);
      root.add(this.add.image(lx + 18, wy + 34, 'ui-lock').setDisplaySize(22, 22));
      root.add(label(this, lx + 36, wy + 24, '解锁条件', 15, '#ff8e86', true).setOrigin(0, 0));
      root.add(label(this, lx + 10, wy + 54, nbsp(unlockText(c.unlock!)), 15, COLOR.text, false, wrapW - 20).setOrigin(0, 0).setAlign('left'));
      return;
    }

    // 底部初始武器/随从预览内嵌暗框（消除中间空白断层）
    const subBox = this.add.graphics();
    const subH = CARD_Y + h - wy - 12;
    subBox.fillStyle(COLOR.panelDeep, 0.92);
    subBox.fillRoundedRect(RIGHT_X + 12, wy, RIGHT_W - 24, subH, 6);
    subBox.lineStyle(1.5, COLOR.borderSoft, 0.9);
    subBox.strokeRoundedRect(RIGHT_X + 12, wy, RIGHT_W - 24, subH, 6);
    root.add(subBox);

    const previewStats = { ...BASE_STATS, ...c.stats };
    const previewMods = { ...ZERO_MODS, ...c.mods };
    for (const [k, v] of Object.entries(c.stats)) previewStats[k as keyof typeof previewStats] = BASE_STATS[k as keyof typeof BASE_STATS] + (v as number);
    if (!this.weapon) {
      this.workerPreview(root, lx, wy, wrapW, previewStats, previewMods);
      return;
    }
    const wDef = WEAPONS[this.weapon];
    root.add(label(this, lx, wy + 12, '初始武器预览', 14, COLOR.goldText, true).setOrigin(0, 0));

    const iconCx = lx + 34;
    const iconCy = wy + 68;
    root.add(slotBox(this, iconCx, iconCy, 62, TIERS[0].color, false, 0));
    const wImg = this.add.image(iconCx, iconCy - 2, weaponTex(wDef.icon, 0, true));
    root.add(wImg.setScale(48 / Math.max(wImg.width, wImg.height)));

    root.add(label(this, lx + 76, wy + 40, wDef.name, 19, COLOR.text, true).setOrigin(0, 0));
    root.add(label(this, lx + 76, wy + 65, `${KIND_LABEL[wDef.kind]}武器`, 13, COLOR.dim).setOrigin(0, 0));

    let tagX = lx + 76;
    for (const tag of wDef.tags) {
      const ts = TAG_STYLE[tag];
      const p = pill(this, tagX + 24, wy + 96, tag, ts.bg, ts.border, ts.text, 11, 8, 20);
      p.x = tagX + p.width / 2;
      root.add(p);
      tagX += p.width + 6;
    }

    const wLines = weaponLines(wDef, 0, previewStats, previewMods);
    let ly = wy + 116;
    for (const l of wLines) {
      const t = label(this, lx + 2, ly, l.text, 13, l.color, false, wrapW - 8).setOrigin(0, 0).setAlign('left');
      root.add(t);
      ly += t.height + 3;
    }
  }

  private workerPreview(root: Container, lx: number, wy: number, wrapW: number, stats: Stats, mods: Mods): void {
    const c = CHARACTERS[this.character];
    const w = c.perks.workers!;
    const def = WEAPONS.workers;
    root.add(label(this, lx, wy + 12, '随从预览', 15, COLOR.goldText, true).setOrigin(0, 0));
    const iconCx = lx + 34;
    const iconCy = wy + 68;
    root.add(slotBox(this, iconCx, iconCy, 62, TIERS[0].color));
    root.add(this.add.image(iconCx, iconCy, 'workerant').setScale(2.2 / SPRITE_RES));
    root.add(label(this, lx + 76, wy + 40, '工蚁', 19, COLOR.text, true).setOrigin(0, 0));
    root.add(label(this, lx + 76, wy + 65, '召唤物', 13, COLOR.dim).setOrigin(0, 0));
    const dmg = Math.round(weaponDamage(def, 0, stats, mods) * (1 + mods.summonDamagePct));
    const lines = [
      { text: `每只伤害 ${dmg}`, color: COLOR.text },
      { text: '加成 近战×50%', color: COLOR.dim },
      { text: `开局 ${w.base} 只，每升一级多 ${w.perLevel} 只（最多 ${w.max} 只）`, color: COLOR.special },
      { text: '每 5 波提升一档品质', color: COLOR.special },
      { text: '生命随波次成长，阵亡 5 秒后在身边重生', color: COLOR.special },
    ];
    let ly = wy + 104;
    for (const l of lines) {
      const t = label(this, lx + 2, ly, l.text, 13, l.color, false, wrapW - 4).setOrigin(0, 0).setAlign('left');
      root.add(t);
      ly += t.height + 3;
    }
  }

  private difficultyRow(root: Container): void {
    root.add(displayLabel(this, CARD_X0, 368, '天气难度', 20, COLOR.text).setOrigin(0, 0.5));
    const max = maxDifficulty(this.character);
    const btnW = 172;
    const gap = 13;
    DIFFICULTIES.forEach((d, i) => {
      const locked = i > max;
      root.add(
        createButton(
          this,
          CARD_X0 + btnW / 2 + i * (btnW + gap),
          418,
          d.name,
          () => {
            this.difficulty = i;
            this.weatherFx.setWeather(i);
            this.render();
          },
          {
            width: btnW,
            height: 50,
            fontSize: 20,
            primary: i === this.difficulty,
            shape: 'bevel',
            accentColor: WEATHER_ACCENT[i],
            disabled: locked,
            leftIcon: locked ? 'ui-lock' : `weather-${i}`,
          },
        ),
      );
    });

    const d = DIFFICULTIES[this.difficulty];
    const mood = WEATHER_ACCENT[this.difficulty] ?? COLOR.gold;
    const infoW = GRID_W;
    const infoH = max < DIFFICULTIES.length - 1 ? 58 : 38;
    const box = this.add.graphics();
    box.fillStyle(COLOR.ink, 0.9);
    box.fillRoundedRect(CARD_X0 + 3, 458, infoW, infoH, 7);
    box.fillStyle(COLOR.panelDeep, 1);
    box.fillRoundedRect(CARD_X0, 454, infoW, infoH, 7);
    box.fillStyle(mood, 0.9);
    box.fillRect(CARD_X0 + 2, 456, 5, infoH - 4);
    box.lineStyle(2.5, COLOR.ink, 1);
    box.strokeRoundedRect(CARD_X0, 454, infoW, infoH, 7);
    root.add(box);
    root.add(this.add.image(CARD_X0 + 25, 472, `weather-${this.difficulty}`).setDisplaySize(22, 22));
    root.add(label(this, CARD_X0 + 44, 463, d.desc, 15, COLOR.text, false, infoW - 58).setOrigin(0, 0).setAlign('left'));
    if (max < DIFFICULTIES.length - 1) {
      root.add(
        label(this, CARD_X0 + 44, 488, `使用当前角色通关「${DIFFICULTIES[max].name}」可解锁下一档天气`, 13, COLOR.dim)
          .setOrigin(0, 0)
          .setAlign('left'),
      );
    }
  }

  private weaponRow(root: Container): void {
    const c = CHARACTERS[this.character];
    if (c.startWeapons.length === 0) {
      root.add(displayLabel(this, CARD_X0, 536, '没有武器槽', 20, COLOR.text).setOrigin(0, 0.5));
      const cx = CARD_X0 + 52;
      const cy = 604;
      root.add(slotBox(this, cx, cy, 86, COLOR.border, false));
      root.add(this.add.image(cx, cy, 'workerant').setScale(3.2 / SPRITE_RES));
      root.add(label(this, cx + 66, cy - 12, '不能装武器，商店也不出武器', 17, COLOR.text).setOrigin(0, 0.5));
      root.add(label(this, cx + 66, cy + 16, '靠越来越多的工蚁随从作战', 15, COLOR.dim).setOrigin(0, 0.5));
      return;
    }
    const choose = c.startWeapons.length > 1;
    root.add(displayLabel(this, CARD_X0, 536, choose ? '初始武器（点击切换）' : '专属初始武器', 20, COLOR.text).setOrigin(0, 0.5));
    c.startWeapons.forEach((id, i) => {
      const def = WEAPONS[id];
      const cx = CARD_X0 + 52 + i * 144;
      const cy = 604;
      const selected = id === this.weapon;
      root.add(slotBox(this, cx, cy, 86, selected ? COLOR.gold : COLOR.border, selected, 0));
      const img = this.add.image(cx, cy - 2, weaponTex(def.icon, 0, true));
      root.add(img.setScale(64 / Math.max(img.width, img.height)));
      root.add(label(this, cx, cy + 56, def.name, 16, selected ? COLOR.goldText : COLOR.text, selected).setOrigin(0.5));
      if (choose) {
        root.add(
          this.tapZone(cx - 45, cy - 45, 90, 114, () => {
            this.weapon = id;
            this.render();
          }),
        );
      }
    });
  }

  private start(): void {
    if (!isUnlocked(this.character)) return;
    const setup: RunSetup = { character: this.character, difficulty: this.difficulty, weapon: this.weapon };
    rememberChoice(setup.character, setup.difficulty, setup.weapon);
    if (IS_COARSE_POINTER && this.scale.fullscreen.available && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
      } catch {
        // 忽略不支持全屏的浏览器
      }
    }
    this.registry.set('setup', setup);
    this.scene.start('Game', setup);
  }

  private tapZone(x: number, y: number, w: number, h: number, onTap: () => void): Phaser.GameObjects.Zone {
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    let pressed = false;
    z.on('pointerdown', () => (pressed = true));
    z.on('pointerout', () => (pressed = false));
    z.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      onTap();
    });
    return z;
  }
}
