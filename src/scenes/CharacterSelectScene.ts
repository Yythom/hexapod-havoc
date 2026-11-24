import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { RunSetup } from '../core/RunState';
import { CUSTOM_MUTATOR_ORDER, DAILY_MUTATORS, type DailyMutatorId } from '../core/daily';
import {
  bestCleared,
  bestEndlessWave,
  codexMilestones,
  isUnlocked,
  loadSave,
  maxDifficulty,
  rememberChoice,
  setShellSkin,
  SHELL_SKIN_ORDER,
  SHELL_SKINS,
  toggleBanishItem,
} from '../core/save';
import { decodeSeedChallenge, encodeSeedChallenge, generateSeed, normalizeSeed } from '../core/seed';
import { weaponDamage } from '../core/combat';
import { BASE_STATS, type Stats } from '../core/stats';
import { BIOME_ORDER, BIOMES, DEFAULT_BIOME, resolveBiome, type BiomeId } from '../data/biomes';
import { CHARACTER_ORDER, CHARACTERS, unlockText } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { ITEMS, ZERO_MODS, type Mods } from '../data/items';
import { weaponTex } from '../art/icons';
import { SPRITE_RES } from '../art/draw';
import { CLASS_LABEL, KIND_LABEL, TIERS, WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { createButton } from '../ui/Button';
import { fadeInScene, setupUICamera, transitionTo } from '../ui/camera';
import {
  COLOR,
  CLASS_STYLE,
  cardTitle,
  displayLabel,
  divider,
  drawChamferPlate,
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
  private biome: BiomeId = DEFAULT_BIOME;
  private customSeed = '';
  private customMutators: DailyMutatorId[] = [];
  private root: Container | null = null;
  private modal: Container | null = null;
  private beetles: BeetleView[] = [];
  private weatherFx!: WeatherAmbience;
  private animateDetail = false;

  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    setupUICamera(this);
    const last = loadSave().last;
    this.root = null;
    this.modal = null;
    this.customMutators = [];
    this.customSeed = '';
    this.beetles = [];
    this.animateDetail = false;
    this.character = isUnlocked(last.character) ? last.character : CHARACTER_ORDER[0];
    this.difficulty = last.difficulty;
    this.weapon = last.weapon;
    this.biome = resolveBiome(last.biome).id;
    this.normalize();

    warmBackdrop(this, W, H);
    this.weatherFx = new WeatherAmbience(this, 0, this.difficulty);
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (!this.modal) this.start();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.modal) this.closeModal();
      else transitionTo(this, 'Menu');
    });
    this.render();
    fadeInScene(this);
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

  /** 随机盲盒搭配：从已解锁战虫和其初始武器中随机抽取一套 */
  private randomizeChoice(): void {
    const pool = CHARACTER_ORDER.filter((id) => isUnlocked(id));
    if (pool.length === 0) return;
    const pick = pool.length > 1 ? Phaser.Utils.Array.GetRandom(pool.filter((id) => id !== this.character)) : pool[0];
    this.character = pick;
    const c = CHARACTERS[pick];
    this.difficulty = Math.min(this.difficulty, maxDifficulty(pick));
    this.weapon = c.startWeapons.length > 0 ? Phaser.Utils.Array.GetRandom(c.startWeapons) : '';
    this.biome = Phaser.Utils.Array.GetRandom(BIOME_ORDER);
    this.animateDetail = true;
    sfx.play('reroll');
    this.render();
  }

  private render(): void {
    this.root?.destroy();
    this.beetles = [];
    const root = this.add.container(0, 0);
    this.root = root;

    const title = displayLabel(this, CARD_X0, 35, '出战准备', 30, COLOR.text).setOrigin(0, 0.5);
    root.add(title);
    root.add(label(this, CARD_X0 + title.width + 16, 36, '选择战虫、天气、生态与初始武器', 15, COLOR.dim).setOrigin(0, 0.5));
    const save = loadSave();
    const customTagCount =
      this.customMutators.length + save.banishedItems.length + (save.shellSkin !== 'default' ? 1 : 0) + (this.customSeed ? 1 : 0);
    root.add(
      createButton(
        this,
        W - 434,
        35,
        customTagCount > 0 ? `⚙ 局前定制 (${customTagCount})` : '⚙ 词条/禁用/种子',
        () => this.openCustomModal('mutators'),
        { width: 186, height: 42, fontSize: 16, primary: false, variant: customTagCount > 0 ? 'emerald' : undefined },
      ),
    );
    root.add(
      createButton(this, W - 252, 35, '🎲 随机搭配', () => this.randomizeChoice(), {
        width: 148,
        height: 42,
        fontSize: 17,
        primary: false,
        variant: 'emerald',
      }),
    );
    root.add(createButton(this, W - 96, 35, '返回菜单', () => transitionTo(this, 'Menu'), { width: 138, height: 42, fontSize: 18, primary: false }));

    CHARACTER_ORDER.forEach((id, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      this.characterCard(root, id, CARD_X0 + col * (CARD_W + CARD_GAP), CARD_Y + row * (CARD_H + CARD_GAP));
    });
    this.detailPanel(root);
    this.animateDetail = false;
    this.difficultyRow(root);
    this.weaponRow(root);
    this.biomeRow(root);

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
      drawChamferPlate(g, lx, ly, CARD_W, CARD_H, {
        fill: selected ? 0x2e323d : hover ? 0x292b34 : COLOR.panel,
        border: selected ? 0xf5f4ef : hover ? 0xd2d2dc : COLOR.border,
        borderWidth: selected ? 2.6 : 1.8,
        accentTop: selected ? COLOR.gold : undefined,
        headerH: 0,
        shadowX: 3,
        shadowY: 4,
        cutBig: 8,
        cutSmall: 3,
        inkWidth: 2.8,
      });
      // 聚光圆底
      g.fillStyle(0x131418, 0.88);
      g.fillCircle(0, -10, 36);
      if (selected) {
        g.lineStyle(2.2, COLOR.gold, 0.85);
        g.strokeCircle(0, -10, 36);
      }
    };
    draw(false);
    card.add(g);

    const beetle = new BeetleView(this, 0, -10, c.shell).setScale(1.05).setRotation(-Math.PI / 2);
    beetle.setShellSkin(loadSave().shellSkin);
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
    const endlessBest = bestEndlessWave(id);
    if (unlocked && endlessBest > 20) {
      card.add(label(this, lx + CARD_W - 8, ly + 7, `W${endlessBest}`, 11, COLOR.goldText, true).setOrigin(1, 0));
    }

    const zone = this.tapZone(lx, ly, CARD_W, CARD_H, () => {
      if (this.character !== id) this.animateDetail = true;
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
    const dRoot = this.add.container(0, 0);
    root.add(dRoot);
    dRoot.add(panel(this, RIGHT_X, CARD_Y, RIGHT_W, h, COLOR.border, COLOR.panel, 2, COLOR.gold, 78));

    const cx = RIGHT_X + RIGHT_W / 2;
    const lx = RIGHT_X + 18;
    const wrapW = RIGHT_W - 36;

    dRoot.add(cardTitle(this, cx, CARD_Y + 26, c.name, 23, COLOR.goldText).setOrigin(0.5));
    dRoot.add(pill(this, cx, CARD_Y + 56, c.role, COLOR.panelDeep, COLOR.border, COLOR.dim, 13, 12, 22));
    dRoot.add(divider(this, lx, CARD_Y + 80, wrapW));

    let y = CARD_Y + 94;
    dRoot.add(label(this, lx, y, '角色加成', 16, COLOR.goldText, true).setOrigin(0, 0));
    y += 24;
    for (const t of c.pros) {
      const txt = label(this, lx + 4, y, nbsp(`+ ${t}`), 14, COLOR.good, false, wrapW - 4).setOrigin(0, 0).setAlign('left');
      dRoot.add(txt);
      y += txt.height + 4;
    }
    const dashTxt = label(this, lx + 4, y, `⚡ 冲刺：${c.dashTrait}`, 13.5, '#7ce8ff', false, wrapW - 4).setOrigin(0, 0).setAlign('left');
    dRoot.add(dashTxt);
    y += dashTxt.height + 6;

    dRoot.add(label(this, lx, y, '角色限制', 15, COLOR.goldText, true).setOrigin(0, 0));
    y += 22;
    if (c.cons.length) {
      for (const t of c.cons) {
        const txt = label(this, lx + 4, y, nbsp(`− ${t}`), 14, COLOR.bad, false, wrapW - 4).setOrigin(0, 0).setAlign('left');
        dRoot.add(txt);
        y += txt.height + 4;
      }
    } else {
      const none = label(this, lx + 4, y, '无特殊限制', 14, COLOR.dim).setOrigin(0, 0).setAlign('left');
      dRoot.add(none);
      y += none.height + 4;
    }

    const wy = Math.min(CARD_Y + h - 226, Math.max(CARD_Y + 278, y + 14));
    if (!unlocked) {
      const box = this.add.graphics();
      drawChamferPlate(box, RIGHT_X + 12, wy + 8, RIGHT_W - 24, CARD_Y + h - wy - 20, {
        fill: 0x281414,
        fillAlpha: 0.95,
        border: 0xc8403c,
        borderWidth: 2,
        shadowX: 2,
        shadowY: 3,
        cutBig: 8,
        cutSmall: 4,
        inkWidth: 2.5,
      });
      dRoot.add(box);
      dRoot.add(this.add.image(lx + 18, wy + 34, 'ui-lock').setDisplaySize(22, 22));
      dRoot.add(label(this, lx + 36, wy + 24, '解锁条件', 15, '#ff8e86', true).setOrigin(0, 0));
      dRoot.add(label(this, lx + 10, wy + 54, nbsp(unlockText(c.unlock!)), 15, COLOR.text, false, wrapW - 20).setOrigin(0, 0).setAlign('left'));
    } else {
      // 底部初始武器/随从预览内嵌暗框（消除中间空白断层）
      const subBox = this.add.graphics();
      const subH = CARD_Y + h - wy - 12;
      drawChamferPlate(subBox, RIGHT_X + 12, wy, RIGHT_W - 24, subH, {
        fill: COLOR.panelDeep,
        fillAlpha: 0.94,
        border: COLOR.borderSoft,
        borderWidth: 1.5,
        shadowX: 0,
        shadowY: 0,
        cutBig: 8,
        cutSmall: 4,
        inkWidth: 2.4,
      });
      dRoot.add(subBox);

      const previewStats = { ...BASE_STATS, ...c.stats };
      const previewMods = { ...ZERO_MODS, ...c.mods };
      for (const [k, v] of Object.entries(c.stats)) previewStats[k as keyof typeof previewStats] = BASE_STATS[k as keyof typeof BASE_STATS] + (v as number);
      if (!this.weapon) {
        this.workerPreview(dRoot, lx, wy, wrapW, previewStats, previewMods);
      } else {
        const wDef = WEAPONS[this.weapon];
        dRoot.add(label(this, lx, wy + 12, '初始武器预览', 14, COLOR.goldText, true).setOrigin(0, 0));

        const iconCx = lx + 34;
        const iconCy = wy + 68;
        dRoot.add(slotBox(this, iconCx, iconCy, 62, TIERS[0].color, false, 0));
        const wImg = this.add.image(iconCx, iconCy - 2, weaponTex(wDef.icon, 0, true));
        dRoot.add(wImg.setScale(48 / Math.max(wImg.width, wImg.height)));

        dRoot.add(label(this, lx + 76, wy + 40, wDef.name, 19, COLOR.text, true).setOrigin(0, 0));
        dRoot.add(label(this, lx + 76, wy + 65, `${KIND_LABEL[wDef.kind]}武器`, 13, COLOR.dim).setOrigin(0, 0));

        let tagX = lx + 76;
        for (const cls of wDef.classes) {
          const ts = CLASS_STYLE[cls];
          const p = pill(this, tagX + 24, wy + 96, CLASS_LABEL[cls], ts.bg, ts.border, ts.text, 11, 8, 20);
          p.x = tagX + p.width / 2;
          dRoot.add(p);
          tagX += p.width + 6;
        }

        const wLines = weaponLines(wDef, 0, previewStats, previewMods);
        let ly = wy + 116;
        for (const l of wLines) {
          const t = label(this, lx + 2, ly, l.text, 13, l.color, false, wrapW - 8).setOrigin(0, 0).setAlign('left');
          dRoot.add(t);
          ly += t.height + 3;
        }
      }
    }

    if (this.animateDetail) {
      dRoot.setAlpha(0.3).setY(6);
      this.tweens.add({ targets: dRoot, alpha: 1, y: 0, duration: 120, ease: 'Quad.Out' });
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
    drawChamferPlate(box, CARD_X0, 454, infoW, infoH, {
      fill: COLOR.panelDeep,
      border: COLOR.borderSoft,
      borderWidth: 1.4,
      shadowX: 3,
      shadowY: 4,
      cutBig: 8,
      cutSmall: 3,
      inkWidth: 2.5,
    });
    box.fillStyle(mood, 0.92);
    box.fillRect(CARD_X0 + 3, 461, 4, infoH - 14);
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
    const stepX = c.startWeapons.length >= 4 ? 114 : 136;
    root.add(displayLabel(this, CARD_X0, 536, choose ? '初始武器（点击切换）' : '专属初始武器', 20, COLOR.text).setOrigin(0, 0.5));
    c.startWeapons.forEach((id, i) => {
      const def = WEAPONS[id];
      const cx = CARD_X0 + 50 + i * stepX;
      const cy = 604;
      const selected = id === this.weapon;
      const itemWrap = this.add.container(cx, cy);
      itemWrap.add(slotBox(this, 0, 0, 84, selected ? COLOR.gold : COLOR.border, selected, 0));
      const img = this.add.image(0, -2, weaponTex(def.icon, 0, true));
      itemWrap.add(img.setScale(62 / Math.max(img.width, img.height)));
      const nameLbl = label(this, 0, 55, def.name, 15, selected ? COLOR.goldText : COLOR.text, selected).setOrigin(0.5);
      itemWrap.add(nameLbl);
      if (choose) {
        const z = this.tapZone(-44, -44, 88, 112, () => {
          this.weapon = id;
          this.render();
        });
        z.on('pointerover', () => {
          if (!selected) nameLbl.setColor('#ffffff');
          this.tweens.killTweensOf(itemWrap);
          this.tweens.add({ targets: itemWrap, scale: 1.06, y: cy - 3, duration: 75, ease: 'Quad.Out' });
        });
        z.on('pointerout', () => {
          if (!selected) nameLbl.setColor(COLOR.text);
          this.tweens.killTweensOf(itemWrap);
          this.tweens.add({ targets: itemWrap, scale: 1, y: cy, duration: 75, ease: 'Quad.Out' });
        });
        itemWrap.add(z);
      }
      root.add(itemWrap);
    });
  }

  /** 右下后院生态场地选择（经典草坪 / 青苔池塘 / 枯叶树洞） */
  private biomeRow(root: Container): void {
    const bx0 = 516;
    const bw = CARD_X0 + GRID_W - bx0;
    const active = BIOMES[this.biome];
    root.add(displayLabel(this, bx0, 536, '后院生态', 20, COLOR.text).setOrigin(0, 0.5));
    if (this.customSeed) {
      const sp = pill(this, bx0 + bw - 68, 536, `🌱 #${this.customSeed}`, 0x163826, 0x5de862, '#a4ffaa', 11.5, 9, 22);
      sp.x = bx0 + bw - sp.width / 2;
      root.add(sp);
    } else {
      root.add(label(this, bx0 + bw, 536, active.tagline, 13, active.css, true).setOrigin(1, 0.5));
    }

    const gap = 10;
    const btnW = Math.floor((bw - gap * (BIOME_ORDER.length - 1)) / BIOME_ORDER.length);
    BIOME_ORDER.forEach((bid, i) => {
      const def = BIOMES[bid];
      root.add(
        createButton(
          this,
          bx0 + btnW / 2 + i * (btnW + gap),
          580,
          def.name,
          () => {
            this.biome = bid;
            this.render();
          },
          {
            width: btnW,
            height: 44,
            fontSize: 16,
            primary: bid === this.biome,
            shape: 'bevel',
            accentColor: def.accent,
          },
        ),
      );
    });

    const box = this.add.graphics();
    const boxY = 612;
    const boxH = 74;
    drawChamferPlate(box, bx0, boxY, bw, boxH, {
      fill: COLOR.panelDeep,
      border: COLOR.borderSoft,
      borderWidth: 1.4,
      shadowX: 3,
      shadowY: 4,
      cutBig: 8,
      cutSmall: 3,
      inkWidth: 2.5,
    });
    box.fillStyle(active.accent, 0.92);
    box.fillRect(bx0 + 3, boxY + 7, 4, boxH - 14);
    root.add(box);
    root.add(label(this, bx0 + 16, boxY + 11, active.desc, 13, COLOR.text, false, bw - 26).setOrigin(0, 0).setAlign('left'));
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
  }

  /** 局前定制弹窗：自定义词条 / 商店禁用池（Banish）/ 炫彩甲壳涂装 / 种子设定 */
  private openCustomModal(tab: 'mutators' | 'banish' | 'skins' | 'seed', statusMsg = ''): void {
    this.closeModal();
    const save = loadSave();
    const ms = codexMilestones(save);
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.78).setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closeModal());
    const pw = 880;
    const ph = 540;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    const blocker = this.add.zone(px, py, pw, ph).setOrigin(0).setInteractive();
    c.add([dim, panel(this, px, py, pw, ph, COLOR.gold, COLOR.panel, 2, COLOR.gold), blocker]);
    c.add(displayLabel(this, W / 2, py + 36, '⚙ 局前定制', 26, COLOR.goldText).setOrigin(0.5));

    // 四个子标签
    const tabs: { id: 'mutators' | 'banish' | 'skins' | 'seed'; label: string }[] = [
      { id: 'mutators', label: `词条 (${this.customMutators.length}/3)` },
      { id: 'banish', label: `禁用池 (${save.banishedItems.length}/${ms.banishCap})` },
      { id: 'skins', label: `涂装 (${ms.unlockedSkins.length}/${SHELL_SKIN_ORDER.length})` },
      { id: 'seed', label: this.customSeed ? `🌱 #${this.customSeed.slice(0, 8)}` : '🌱 种子设定' },
    ];
    const tabW = 196;
    const tabGap = 12;
    const tabX0 = W / 2 - (tabs.length * tabW + (tabs.length - 1) * tabGap) / 2;
    tabs.forEach((t, idx) => {
      c.add(
        createButton(
          this,
          tabX0 + tabW / 2 + idx * (tabW + tabGap),
          py + 82,
          t.label,
          () => {
            sfx.play('click');
            this.openCustomModal(t.id);
          },
          { width: tabW, height: 38, fontSize: 14.5, primary: tab === t.id },
        ),
      );
    });
    c.add(divider(this, px + 28, py + 110, pw - 56, COLOR.border, 0.6));

    if (tab === 'mutators') {
      c.add(label(this, W / 2, py + 128, '自由勾选 0~3 条趣味词条改变本局规则（不限制角色解锁）', 13.5, COLOR.dim).setOrigin(0.5));
      const cols = 2;
      const cw = 398;
      const ch = 62;
      CUSTOM_MUTATOR_ORDER.forEach((mid, i) => {
        const def = DAILY_MUTATORS[mid];
        const on = this.customMutators.includes(mid);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = px + 34 + col * (cw + 16);
        const by = py + 148 + row * (ch + 10);
        const bg = this.add.graphics();
        drawChamferPlate(bg, bx, by, cw, ch, {
          fill: on ? 0x1d3326 : COLOR.panelDeep,
          border: on ? 0x5de862 : COLOR.borderSoft,
          borderWidth: on ? 2 : 1.4,
          cutBig: 7,
          cutSmall: 3,
          inkWidth: 2.2,
        });
        c.add(bg);
        c.add(label(this, bx + 14, by + 16, `${on ? '✓ ' : ''}${def.name}`, 15, on ? COLOR.good : COLOR.text, true).setOrigin(0, 0.5));
        c.add(label(this, bx + 14, by + 40, def.desc, 12.5, COLOR.dim, false, cw - 24).setOrigin(0, 0.5).setAlign('left'));
        const z = this.tapZone(bx, by, cw, ch, () => {
          if (on) {
            this.customMutators = this.customMutators.filter((x) => x !== mid);
          } else if (this.customMutators.length < 3) {
            this.customMutators = [...this.customMutators, mid];
          }
          sfx.play('click');
          this.render();
          this.openCustomModal('mutators');
        });
        c.add(z);
      });
    } else if (tab === 'banish') {
      c.add(
        label(
          this,
          W / 2,
          py + 128,
          ms.banishCap === 0
            ? `图鉴累计收录 15 种武器/道具后解锁首个禁用槽（当前 ${ms.seenEntries}/15）`
            : `点击勾选不想在商店刷出的道具（已禁用 ${save.banishedItems.length}/${ms.banishCap}）`,
          13.5,
          ms.banishCap === 0 ? COLOR.goldText : COLOR.dim,
        ).setOrigin(0.5),
      );
      const list = Object.values(ITEMS).filter((d) => d.rarity <= 1).slice(0, 24);
      const cols = 6;
      const cw = 132;
      const ch = 76;
      list.forEach((def, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = px + 28 + col * (cw + 8);
        const by = py + 150 + row * (ch + 8);
        const banned = save.banishedItems.includes(def.id);
        const bg = this.add.graphics();
        drawChamferPlate(bg, bx, by, cw, ch, {
          fill: banned ? 0x38161a : COLOR.panelDeep,
          border: banned ? 0xff5a5a : COLOR.borderSoft,
          borderWidth: banned ? 2 : 1.2,
          cutBig: 6,
          cutSmall: 3,
          inkWidth: 2,
        });
        c.add(bg);
        c.add(this.add.image(bx + 26, by + 38, def.icon).setDisplaySize(34, 34).setAlpha(banned ? 0.45 : 1));
        c.add(label(this, bx + 48, by + 26, def.name.slice(0, 5), 13, banned ? '#ff8a8a' : COLOR.text, true).setOrigin(0, 0.5));
        c.add(label(this, bx + 48, by + 48, banned ? '✕ 已禁用' : '允许刷出', 11, banned ? COLOR.bad : COLOR.dim).setOrigin(0, 0.5));
        const z = this.tapZone(bx, by, cw, ch, () => {
          if (toggleBanishItem(def.id)) {
            sfx.play('click');
            this.render();
            this.openCustomModal('banish');
          }
        });
        c.add(z);
      });
    } else if (tab === 'skins') {
      c.add(label(this, W / 2, py + 128, '通过通关与图鉴里程碑解锁炫彩甲壳涂装（纯视觉纪念，不影响数值）', 13.5, COLOR.dim).setOrigin(0.5));
      const cw = 156;
      const ch = 220;
      const gx0 = px + (pw - (SHELL_SKIN_ORDER.length * cw + (SHELL_SKIN_ORDER.length - 1) * 12)) / 2;
      SHELL_SKIN_ORDER.forEach((sid, idx) => {
        const info = SHELL_SKINS[sid];
        const unlocked = ms.unlockedSkins.includes(sid);
        const active = save.shellSkin === sid;
        const bx = gx0 + idx * (cw + 12);
        const by = py + 166;
        const bg = this.add.graphics();
        drawChamferPlate(bg, bx, by, cw, ch, {
          fill: active ? 0x262a34 : COLOR.panelDeep,
          border: active ? COLOR.gold : unlocked ? COLOR.border : COLOR.borderSoft,
          borderWidth: active ? 2.4 : 1.5,
          cutBig: 8,
          cutSmall: 3,
          inkWidth: 2.2,
        });
        c.add(bg);
        const preview = new BeetleView(this, bx + cw / 2, by + 76, CHARACTERS[this.character].shell).setScale(1.3).setRotation(-Math.PI / 2);
        preview.setShellSkin(sid);
        if (!unlocked) preview.setAlpha(0.35);
        c.add(preview);
        c.add(label(this, bx + cw / 2, by + 136, info.name, 16, unlocked ? info.css : COLOR.dim, true).setOrigin(0.5));
        c.add(label(this, bx + cw / 2, by + 168, unlocked ? (active ? '★ 使用中' : '点击装备') : info.req, 11.5, active ? COLOR.good : COLOR.dim, false, cw - 16).setOrigin(0.5));
        if (unlocked) {
          const z = this.tapZone(bx, by, cw, ch, () => {
            setShellSkin(sid);
            sfx.play('click');
            this.render();
            this.openCustomModal('skins');
          });
          c.add(z);
        }
      });
    } else {
      c.add(
        label(
          this,
          W / 2,
          py + 132,
          '使用相同种子与配置开局时，每波商店、升级、宝箱、赌约、地形与 Boss 均完全同步',
          13.5,
          COLOR.dim,
        ).setOrigin(0.5),
      );
      const boxW = 540;
      const boxH = 84;
      const bx = W / 2 - boxW / 2;
      const by = py + 160;
      const box = this.add.graphics();
      drawChamferPlate(box, bx, by, boxW, boxH, {
        fill: COLOR.panelDeep,
        border: this.customSeed ? 0x5de862 : COLOR.border,
        borderWidth: 2,
        cutBig: 8,
        cutSmall: 3,
        inkWidth: 2.4,
      });
      c.add(box);
      c.add(label(this, W / 2, by + 24, '当前本局种子', 13, COLOR.dim).setOrigin(0.5));
      c.add(
        displayLabel(
          this,
          W / 2,
          by + 54,
          this.customSeed ? `#${this.customSeed}` : '随机生成（开战时自动分配）',
          this.customSeed ? 26 : 19,
          this.customSeed ? '#a4ffaa' : COLOR.goldText,
        ).setOrigin(0.5),
      );

      const copySetupCode = () => {
        const seed = this.customSeed || generateSeed();
        this.customSeed = seed;
        const code = encodeSeedChallenge({
          seed,
          character: this.character,
          difficulty: this.difficulty,
          weapon: this.weapon,
          biome: this.biome,
          mutators: this.customMutators.length > 0 ? this.customMutators : undefined,
        });
        const done = () => {
          this.render();
          this.openCustomModal('seed', `已复制开局挑战码（种子 #${seed}），发给好友同局竞速！`);
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(code).then(done, () => {
            window.prompt('请手动复制以下种子挑战码：', code);
            done();
          });
        } else {
          window.prompt('请手动复制以下种子挑战码：', code);
          done();
        }
      };

      c.add(
        createButton(
          this,
          W / 2 - 196,
          py + 286,
          '✎ 输入种子 / 挑战码',
          () => {
            const raw = window.prompt('输入自定义种子（如 BUG2026）或粘贴好友挑战码（HHS1:...）：', this.customSeed);
            if (raw === null) return;
            const decoded = decodeSeedChallenge(raw);
            if (decoded) {
              this.customSeed = decoded.seed;
              this.biome = decoded.biome;
              if (isUnlocked(decoded.character)) {
                this.character = decoded.character;
                this.difficulty = Math.min(decoded.difficulty, maxDifficulty(decoded.character));
                this.weapon = decoded.weapon;
              }
              this.customMutators = decoded.mutators ? [...decoded.mutators] : [];
              sfx.play('unlock');
              this.render();
              this.openCustomModal('seed', `已载入种子 #${decoded.seed} 与场地「${BIOMES[decoded.biome].name}」！`);
              return;
            }
            const clean = normalizeSeed(raw);
            this.customSeed = clean;
            sfx.play('click');
            this.render();
            this.openCustomModal('seed', clean ? `已设定自定义种子 #${clean}` : '已切回随机种子');
          },
          { width: 184, height: 48, fontSize: 15, primary: false },
        ),
      );
      c.add(
        createButton(
          this,
          W / 2,
          py + 286,
          '🎲 随机新种子',
          () => {
            this.customSeed = generateSeed();
            sfx.play('reroll');
            this.render();
            this.openCustomModal('seed', `已生成新种子 #${this.customSeed}`);
          },
          { width: 176, height: 48, fontSize: 15, primary: false },
        ),
      );
      c.add(
        createButton(this, W / 2 + 196, py + 286, '📋 复制开局挑战码', copySetupCode, {
          width: 184,
          height: 48,
          fontSize: 15,
          primary: false,
          variant: 'emerald',
        }),
      );
      if (this.customSeed) {
        c.add(
          createButton(
            this,
            W / 2,
            py + 346,
            '清除固定种子（恢复随机）',
            () => {
              this.customSeed = '';
              sfx.play('click');
              this.render();
              this.openCustomModal('seed', '已恢复开局随机种子');
            },
            { width: 240, height: 38, fontSize: 14, primary: false },
          ),
        );
      }
      if (statusMsg) {
        c.add(label(this, W / 2, py + 402, statusMsg, 14, COLOR.good, true).setOrigin(0.5));
      } else {
        c.add(label(this, W / 2, py + 402, '提示：主菜单「🌱 种子挑战」可直接导入他人战绩挑战码（无需解锁角色）', 13, COLOR.dim).setOrigin(0.5));
      }
    }

    c.add(createButton(this, W / 2, py + ph - 34, '完成', () => this.closeModal(), { width: 180, height: 44, fontSize: 18 }));
    this.modal = c;
  }

  private start(): void {
    if (!isUnlocked(this.character)) return;
    const save = loadSave();
    const setup: RunSetup = {
      character: this.character,
      difficulty: this.difficulty,
      weapon: this.weapon,
      biome: this.biome,
      seed: this.customSeed || undefined,
      mutators: this.customMutators.length > 0 ? [...this.customMutators] : undefined,
      banished: save.banishedItems.length > 0 ? [...save.banishedItems] : undefined,
      shellSkin: save.shellSkin,
    };
    rememberChoice(setup.character, setup.difficulty, setup.weapon, this.biome);
    this.registry.set('setup', setup);
    transitionTo(this, 'Game', setup);
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
