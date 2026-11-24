import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, IS_COARSE_POINTER, NUM_FONT } from '../config';
import { bus, EVT } from '../core/bus';
import { levelRerollCost, rollUpgrades, type UpgradeOption } from '../core/progression';
import type { RunState } from '../core/RunState';
import { checkUnlocks } from '../core/unlocks';
import { CHARACTERS } from '../data/characters';
import {
  addItem,
  buyOffer,
  chestSellValue,
  mergePartner,
  mergeWeapons,
  OFFER_COUNT,
  offerPrice,
  refreshOffers,
  rerollCost,
  rollChestItem,
  sellWeapon,
  weaponAddMode,
  weaponSellValue,
  type Offer,
} from '../core/shop';
import { activeSets, classCounts, SET_THRESHOLDS, SETS } from '../core/sets';
import { formatStat, formatStatDelta, STAT_META } from '../core/stats';
import { ITEMS, type ItemDef } from '../data/items';
import { TIER_ROMAN, weaponTex } from '../art/icons';
import { SPRITE_RES } from '../art/draw';
import { CLASS_LABEL, TIERS, WEAPONS, type WeaponClass } from '../data/weapons';
import { createButton, drawKeycap } from '../ui/Button';
import { setupUICamera } from '../ui/camera';
import {
  COLOR,
  CLASS_STYLE,
  cardTitle,
  displayLabel,
  divider,
  itemLines,
  label,
  layoutLines,
  numLabel,
  panel,
  pill,
  slotBox,
  statsPanel,
  warmBackdrop,
  weaponLines,
  weaponTypeLine,
  type Line,
} from '../ui/widgets';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const PHONE = IS_COARSE_POINTER;
const CARD_W = PHONE ? 286 : 220;
const CARD_H = PHONE ? 350 : 332;
const CARD_GAP = PHONE ? 12 : 16;
const CARD_X0 = 40;
const CARD_Y = 88;
const LOW_Y = PHONE ? 450 : 434;
const PHONE_BTN_X = 1110;
const POPUP_SCALE = PHONE ? 1.18 : 1;
const CARDS_CX = CARD_X0 + (CARD_W * 4 + CARD_GAP * 3) / 2;
const RIGHT_X = 1000;
const RIGHT_W = 240;

type Page = 'level' | 'chest' | 'shop';

type Container = Phaser.GameObjects.Container;

/**
 * 波次之间的界面（参照土豆兄弟商店/升级排版）：
 * 左上角图标方格 + 标题左对齐 + 绿红数值条目 + 底部锁/买按钮 + 右侧属性栏。
 */
export class IntermissionScene extends Phaser.Scene {
  private run!: RunState;
  private page: Page = 'shop';
  private root: Container | null = null;
  private popup: Container | null = null;
  private upgrades: UpgradeOption[] = [];
  private chestItem = '';
  private shopRerolls = 0;
  private shopReady = false;
  private spinRays: Phaser.GameObjects.Image[] = [];
  private toasts: string[] = [];
  private toastBusy = false;

  constructor() {
    super('Intermission');
  }

  create(): void {
    setupUICamera(this);
    this.run = this.registry.get('run') as RunState;
    this.root = null;
    this.popup = null;
    this.upgrades = [];
    this.chestItem = '';
    this.shopRerolls = 0;
    this.shopReady = false;
    this.spinRays = [];
    this.toasts = [];
    this.toastBusy = false;

    warmBackdrop(this, W, H);
    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => {
      if (this.page === 'shop' && !this.popup) this.finish();
    });
    kb.on('keydown-ESC', () => this.closePopup());
    this.nextPage();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    for (const r of this.spinRays) r.rotation += dt * 0.25;
  }

  private nextPage(): void {
    const run = this.run;
    if (run.pendingLevelUps > 0) {
      this.page = 'level';
      this.upgrades = rollUpgrades(run.wave, run.stats.luck);
    } else if (run.chests > 0) {
      this.page = 'chest';
      this.chestItem = rollChestItem(run);
    } else {
      this.page = 'shop';
      if (!this.shopReady) {
        refreshOffers(run);
        this.shopReady = true;
      }
    }
    this.render();
  }

  private render(): void {
    for (const id of checkUnlocks(this.run)) this.toast(`解锁新角色：${CHARACTERS[id].name}`);
    this.closePopup();
    this.root?.destroy();
    this.spinRays = [];
    const root = this.add.container(0, 0);
    this.root = root;

    if (PHONE) {
      root.add(createButton(this, PHONE_BTN_X, 492, '属性', () => this.statsPopup(), { width: 220, height: 56, fontSize: 22, primary: false }));
    } else {
      root.add(statsPanel(this, RIGHT_X, CARD_Y, RIGHT_W, 474, this.run.stats));
    }

    // 顶部右侧花蜜计数胶囊（右对齐右侧属性面板，避免悬空）
    const nectarText = numLabel(this, 0, 0, String(this.run.nectar), 24, COLOR.goldText).setOrigin(0, 0.5);
    const pillW = Math.max(122, Math.ceil(nectarText.width + 64));
    const pillX = RIGHT_X + RIGHT_W - pillW;
    const nBg = this.add.graphics();
    nBg.fillStyle(COLOR.ink, 0.9);
    nBg.fillRoundedRect(pillX + 3, 18, pillW, 38, 7);
    nBg.fillStyle(COLOR.panelDeep, 1);
    nBg.fillRoundedRect(pillX, 15, pillW, 38, 7);
    nBg.lineStyle(1.6, COLOR.gold, 0.55);
    nBg.strokeRoundedRect(pillX + 1.5, 16.5, pillW - 3, 35, 6);
    nBg.lineStyle(2.5, COLOR.ink, 1);
    nBg.strokeRoundedRect(pillX, 15, pillW, 38, 7);
    root.add(nBg);
    root.add(this.add.image(pillX + 24, 34, 'nectar').setDisplaySize(24, 24));
    nectarText.setPosition(pillX + 44, 35);
    root.add(nectarText);

    if (this.page === 'level') this.buildLevel(root);
    else if (this.page === 'chest') this.buildChest(root);
    else this.buildShop(root);
  }

  private title(root: Container, text: string, sub = '', portrait?: string): void {
    let x = CARD_X0;
    if (portrait) {
      root.add(this.add.image(x + 22, 35, portrait).setDisplaySize(44, 44));
      x += 56;
    }
    const t = displayLabel(this, x, 35, text, 30, COLOR.text).setOrigin(0, 0.5);
    root.add(t);
    if (sub) {
      const sp = pill(this, 0, 35, sub, COLOR.panelDeep, COLOR.borderSoft, COLOR.dim, 13, 12, 26);
      sp.x = x + t.width + 16 + sp.width / 2;
      root.add(sp);
    }
  }

  // ---------- 升级 ----------

  private buildLevel(root: Container): void {
    const run = this.run;
    const lv = run.level - run.pendingLevelUps + 1;
    this.title(root, `升级！Lv ${lv}`, run.pendingLevelUps > 1 ? `还有 ${run.pendingLevelUps - 1} 次升级机会` : '选择一项强化');

    this.upgrades.forEach((u, i) => {
      const x = CARD_X0 + i * (CARD_W + CARD_GAP);
      const cx = x + CARD_W / 2;
      const cy = CARD_Y + CARD_H / 2;
      const tier = TIERS[u.tier];
      const card = this.add.container(cx, cy);
      const lx = -CARD_W / 2;
      const ly = -CARD_H / 2;
      const bg = this.add.graphics();
      const drawCard = (hover: boolean) => {
        bg.clear();
        bg.fillStyle(COLOR.ink, 0.92);
        bg.fillRoundedRect(lx + 4, ly + 5, CARD_W, CARD_H, 8);
        bg.fillStyle(hover ? COLOR.panelHi : COLOR.panel, 1);
        bg.fillRoundedRect(lx, ly, CARD_W, CARD_H, 8);
        bg.fillStyle(tier.color, hover ? 0.2 : 0.12);
        bg.fillRoundedRect(lx + 2, ly + 2, CARD_W - 4, 62, { tl: 6, tr: 6, bl: 0, br: 0 });
        bg.fillStyle(tier.color, 0.9);
        bg.fillRect(lx + 2, ly + 2, CARD_W - 4, 4);
        bg.lineStyle(hover ? 3 : 2, hover ? 0xffffff : tier.color, 1);
        bg.strokeRoundedRect(lx + 1.5, ly + 1.5, CARD_W - 3, CARD_H - 3, 7);
        bg.lineStyle(3, COLOR.ink, 1);
        bg.strokeRoundedRect(lx, ly, CARD_W, CARD_H, 8);
      };
      drawCard(false);
      card.add(bg);

      card.add(pill(this, 0, ly + 34, `${tier.name}强化`, COLOR.panelDeep, tier.color, tier.css, 13, 12, 24));
      card.add(cardTitle(this, 0, ly + 104, STAT_META[u.stat].label, 26, COLOR.text).setOrigin(0.5));
      card.add(divider(this, lx + 26, ly + 132, CARD_W - 52, tier.color, 0.55));
      card.add(numLabel(this, 0, ly + 180, formatStatDelta(u.stat, u.value), 44, u.tier === 0 ? COLOR.good : tier.css).setOrigin(0.5));
      card.add(label(this, 0, ly + 222, `当前 ${formatStat(u.stat, run.stats[u.stat])}`, 13, COLOR.dim).setOrigin(0.5));
      card.add(pill(this, 0, ly + CARD_H - 34, '选择强化', COLOR.panelHi, tier.color, COLOR.text, 14, 22, 32));

      const zone = this.tapZone(lx, ly, CARD_W, CARD_H, () => this.chooseUpgrade(u));
      zone.on('pointerover', () => {
        drawCard(true);
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, y: cy - 4, angle: i % 2 === 0 ? -1.2 : 1.2, duration: 85, ease: 'Quad.Out' });
      });
      zone.on('pointerout', () => {
        drawCard(false);
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, y: cy, angle: 0, duration: 85, ease: 'Quad.Out' });
      });
      card.add(zone);
      card.setAlpha(0).setY(cy + 16);
      this.tweens.add({ targets: card, alpha: 1, y: cy, delay: i * 40, duration: 150, ease: 'Back.Out' });
      root.add(card);
    });

    // 升级时也在下方展示当前配装，方便针对性选属性，同时消除大面积空白
    this.weaponRow(root);
    this.itemGrid(root);

    const cost = levelRerollCost(run.wave);
    const rx = PHONE ? PHONE_BTN_X : RIGHT_X + RIGHT_W / 2;
    const bw = PHONE ? 220 : RIGHT_W;
    root.add(
      createButton(this, rx, PHONE ? 572 : 598, `刷新  ${cost}`, () => this.rerollUpgrades(), {
        width: bw,
        height: 54,
        fontSize: 21,
        primary: false,
        icon: 'nectar',
        disabled: run.nectar < cost,
      }),
    );
  }

  private chooseUpgrade(u: UpgradeOption): void {
    sfx.play('buy');
    const run = this.run;
    run.bonus[u.stat] += u.value;
    run.recomputeStats();
    run.pendingLevelUps--;
    this.nextPage();
  }

  private rerollUpgrades(): void {
    const run = this.run;
    const cost = levelRerollCost(run.wave);
    if (run.nectar < cost) return;
    run.nectar -= cost;
    this.upgrades = rollUpgrades(run.wave, run.stats.luck);
    this.render();
  }

  // ---------- 宝箱 ----------

  private buildChest(root: Container): void {
    const run = this.run;
    const def = ITEMS[this.chestItem];
    const tier = TIERS[def.rarity];
    this.title(root, '战利品宝箱', run.chests > 1 ? `还有 ${run.chests - 1} 个待开启` : '获得一件后院战利品');

    const rays = this.add.image(CARDS_CX, CARD_Y + CARD_H / 2, 'ui-sunrays').setScale(1.0).setTint(tier.color).setAlpha(0.45);
    root.add(rays);
    this.spinRays.push(rays);

    const chestImg = this.add.image(CARDS_CX - CARD_W / 2 - 115, CARD_Y + CARD_H / 2, 'chest@ui').setScale(1.15);
    root.add(chestImg);
    this.tweens.add({ targets: chestImg, y: chestImg.y - 8, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.itemCard(root, CARDS_CX - CARD_W / 2, def);
    const value = chestSellValue(def.id, run.wave);
    root.add(createButton(this, CARDS_CX - 120, 488, '拿走', () => this.takeChest(), { width: 200, height: 58 }));
    root.add(
      createButton(this, CARDS_CX + 120, 488, `分解 +${value}`, () => this.sellChest(value), {
        width: 200,
        height: 58,
        fontSize: 22,
        primary: false,
        icon: 'nectar',
      }),
    );
  }

  private takeChest(): void {
    sfx.play('chest');
    addItem(this.run, this.chestItem);
    this.run.chests--;
    this.nextPage();
  }

  private sellChest(value: number): void {
    sfx.play('buy');
    this.run.nectar += value;
    this.run.chests--;
    this.nextPage();
  }

  // ---------- 商店 ----------

  private buildShop(root: Container): void {
    const run = this.run;
    const harvest = run.waveHarvest > 0 ? `（采蜜 +${run.waveHarvest}）` : '';
    const interest = run.waveInterest > 0 ? ` · 利息 +${run.waveInterest}` : '';
    this.title(root, `商店 · 第 ${run.wave} 波`, `本波收入 +${run.waveNectar}${harvest}${interest}`, 'snail-merchant');

    for (let i = 0; i < OFFER_COUNT; i++) {
      const x = CARD_X0 + i * (CARD_W + CARD_GAP);
      const o = run.offers[i];
      if (o) {
        const cardWrap = this.add.container(0, 0);
        this.offerCard(cardWrap, x, o, i);
        cardWrap.setAlpha(0).setY(14);
        this.tweens.add({ targets: cardWrap, alpha: 1, y: 0, delay: i * 38, duration: 145, ease: 'Back.Out' });
        root.add(cardWrap);
      } else {
        root.add(panel(this, x, CARD_Y, CARD_W, CARD_H, COLOR.borderSoft, COLOR.panelDeep, 1.5));
        root.add(label(this, x + CARD_W / 2, CARD_Y + CARD_H / 2, '已售罄', 18, COLOR.dim, true).setOrigin(0.5));
      }
    }

    this.weaponRow(root);
    this.itemGrid(root);

    const cost = this.shopRerollCost();
    const rx = PHONE ? PHONE_BTN_X : RIGHT_X + RIGHT_W / 2;
    const bw = PHONE ? 220 : RIGHT_W;
    root.add(
      createButton(this, rx, PHONE ? 572 : 598, cost === 0 ? '免费刷新' : `刷新  ${cost}`, () => this.rerollShop(), {
        width: bw,
        height: 50,
        fontSize: 20,
        primary: false,
        variant: cost === 0 ? 'emerald' : undefined,
        icon: cost === 0 ? undefined : 'nectar',
        disabled: run.nectar < cost,
      }),
    );
    root.add(createButton(this, rx, PHONE ? 654 : 664, `出发 ▶ 第 ${run.wave + 1} 波`, () => this.finish(), { width: bw, height: 58, fontSize: 22 }));
  }

  private offerCard(root: Container, x: number, o: Offer, index: number): void {
    const run = this.run;
    if (o.kind === 'weapon') this.weaponCard(root, x, o.id, o.tier);
    else this.itemCard(root, x, ITEMS[o.id]);

    const price = offerPrice(o, run);
    let text = String(price);
    let icon: string | undefined = 'nectar';
    let disabled = run.nectar < price;
    let isMerge = false;
    if (o.kind === 'weapon') {
      const mode = weaponAddMode(run, o.id, o.tier);
      if (mode === 'full') {
        text = '已满';
        icon = undefined;
        disabled = true;
      } else if (mode === 'merge') {
        text = `合成 ${price}`;
        isMerge = true;
      }
    }
    // 购买按钮 + 底部右侧锁定按钮（土豆兄弟标准底部双键）
    const lockW = 54;
    const gap = 8;
    const buyW = CARD_W - 28 - lockW - gap;
    root.add(
      createButton(this, x + 14 + buyW / 2, CARD_Y + CARD_H - 34, text, () => this.buy(index), {
        width: buyW,
        height: 44,
        fontSize: 19,
        variant: isMerge && !disabled ? 'emerald' : undefined,
        icon,
        disabled,
      }),
    );
    root.add(
      this.lockButton(x + CARD_W - 14 - lockW / 2, CARD_Y + CARD_H - 34, lockW, 44, o.locked, () => {
        o.locked = !o.locked;
        this.render();
      }),
    );
  }

  private buy(index: number): void {
    if (!buyOffer(this.run, index)) return;
    sfx.play('buy');
    this.render();
  }

  private shopRerollCost(): number {
    if (this.run.character.perks.freeReroll && this.shopRerolls === 0) return 0;
    return rerollCost(this.run.wave, this.shopRerolls - (this.run.character.perks.freeReroll ? 1 : 0));
  }

  private rerollShop(): void {
    const run = this.run;
    const cost = this.shopRerollCost();
    if (run.nectar < cost) return;
    run.nectar -= cost;
    this.shopRerolls++;
    refreshOffers(run);
    this.render();
  }

  private weaponRow(root: Container): void {
    const run = this.run;
    const slots = run.weaponSlots;
    if (slots === 0) {
      root.add(displayLabel(this, CARD_X0, LOW_Y + 10, '工蚁随从', 19, COLOR.text).setOrigin(0, 0.5));
      const cx = CARD_X0 + 39;
      const cy = LOW_Y + 68;
      root.add(slotBox(this, cx, cy, 78, COLOR.borderSoft));
      root.add(this.add.image(cx, cy, 'workerant').setScale(3.0 / SPRITE_RES));
      root.add(label(this, cx + 54, cy - 12, `${run.workerCount + run.mods.summonCount} 只工蚁`, 18, COLOR.text, true).setOrigin(0, 0.5));
      root.add(label(this, cx + 54, cy + 14, `${TIERS[run.workerTier].name}品质 · 每升一级多 1 只`, 14, COLOR.dim).setOrigin(0, 0.5));
      return;
    }
    const step = Math.min(88, Math.floor(540 / slots));
    const size = step - 10;
    root.add(cardTitle(this, CARD_X0, LOW_Y + 10, `武器  ${run.weapons.length}/${slots}`, 19, COLOR.text).setOrigin(0, 0.5));
    root.add(divider(this, CARD_X0, LOW_Y + 24, step * slots - 10, COLOR.borderSoft, 0.7));
    for (let j = 0; j < slots; j++) {
      const cx = CARD_X0 + size / 2 + j * step;
      const cy = LOW_Y + 70;
      const w = run.weapons[j];
      const canMerge = w ? mergePartner(run, j) >= 0 : false;
      root.add(slotBox(this, cx, cy, size, w ? TIERS[w.tier].color : COLOR.borderSoft, canMerge, w?.tier));
      if (!w) continue;
      root.add(this.fitImage(cx, cy - 3, weaponTex(WEAPONS[w.id].icon, w.tier, true), size - 18));
      if (canMerge) {
        const badge = this.add.container(cx + size / 2 - 10, cy - size / 2 + 10);
        const g = this.add.graphics();
        g.fillStyle(0x358c38, 1);
        g.fillRoundedRect(-10, -10, 20, 20, 4);
        g.lineStyle(2, COLOR.ink, 1);
        g.strokeRoundedRect(-10, -10, 20, 20, 4);
        badge.add([g, label(this, 0, 0, '合', 12, '#ffffff', true).setOrigin(0.5)]);
        root.add(badge);
        this.tweens.add({ targets: badge, scale: 1.12, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      root.add(this.tapZone(cx - size / 2, cy - size / 2, size, size, () => this.weaponPopup(j)));
    }
    this.setLines(root);
  }

  private setLines(root: Container): void {
    const counts = [...classCounts(this.run.weapons)];
    const active = new Map(activeSets(this.run.weapons).map((a) => [a.cls, a]));
    const rowH = PHONE ? 26 : 24;
    const maxRows = Math.floor((H - 8 - (LOW_Y + 118)) / rowH);
    const twoCols = counts.length > maxRows;
    const colW = (586 - 16 - CARD_X0) / 2;
    counts.forEach(([cls, count], i) => {
      const col = twoCols ? Math.floor(i / Math.ceil(counts.length / 2)) : 0;
      const row = twoCols ? i % Math.ceil(counts.length / 2) : i;
      const x = CARD_X0 + col * colW;
      const y = LOW_Y + 118 + row * rowH;
      const on = active.get(cls);
      const next = SET_THRESHOLDS.find((n) => n > count);
      const ts = CLASS_STYLE[cls];
      const tagPill = pill(this, x + 28, y + 10, `${CLASS_LABEL[cls]}×${count}`, ts.bg, ts.border, ts.text, 12, 8, 20);
      tagPill.x = x + tagPill.width / 2;
      root.add(tagPill);

      let info: string;
      if (twoCols) {
        info = on ? on.level.text : next ? `${next} 把生效` : '';
      } else {
        const nextText = next ? `（${next}把：${SETS[cls][SET_THRESHOLDS.indexOf(next as 2 | 3 | 4 | 5 | 6)].text}）` : '';
        info = on ? `${on.level.text}${nextText}` : nextText.replace(/^（|）$/g, '');
      }
      const t = label(this, x + tagPill.width + 8, y + 10, info, twoCols ? 13 : 14, on ? COLOR.good : COLOR.dim).setOrigin(0, 0.5);
      const room = (twoCols ? colW : 586 - CARD_X0) - tagPill.width - 14;
      if (t.width > room) t.setScale(room / t.width);
      root.add(t);
    });
  }

  private itemGrid(root: Container): void {
    const run = this.run;
    const ids = Object.keys(run.items).filter((id) => run.items[id] > 0);
    const totalCount = ids.reduce((s, id) => s + run.items[id], 0);
    root.add(cardTitle(this, 586, LOW_Y + 10, totalCount > 0 ? `道具  ${totalCount}` : '道具', 19, COLOR.text).setOrigin(0, 0.5));
    root.add(divider(this, 586, LOW_Y + 24, 384, COLOR.borderSoft, 0.7));
    if (ids.length === 0) root.add(label(this, 586, LOW_Y + 42, '暂无道具', 15, COLOR.dim));
    ids.forEach((id, k) => {
      const cx = 614 + (k % 6) * 64;
      const cy = LOW_Y + 60 + Math.floor(k / 6) * 64;
      const def = ITEMS[id];
      root.add(slotBox(this, cx, cy, 56, TIERS[def.rarity].color));
      root.add(this.add.image(cx, cy, def.icon).setDisplaySize(42, 42));
      const n = run.items[id];
      if (n > 1) {
        root.add(
          this.add
            .text(cx + 24, cy + 25, `×${n}`, { fontFamily: NUM_FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff', stroke: '#050507', strokeThickness: 4 })
            .setOrigin(1, 1),
        );
      }
      root.add(this.tapZone(cx - 28, cy - 28, 56, 56, () => this.itemPopup(id)));
    });
  }

  private finish(): void {
    bus.emit(EVT.NEXT_WAVE);
    this.scene.stop();
  }

  // ---------- 土豆兄弟风格商店卡片（左上角方块图标 + 右侧标题/分类 + 左对齐属性条目） ----------

  private card(
    root: Container,
    x: number,
    tier: number,
    iconKey: string,
    iconSize: number,
    title: string,
    typeLine: string,
    lines: Line[],
    classes?: WeaponClass[],
    weaponTier?: number,
  ): void {
    const t = TIERS[tier];
    root.add(panel(this, x, CARD_Y, CARD_W, CARD_H, t.color, COLOR.panel, 2, t.color, 90));

    // 左上角方正图标槽
    const boxSize = 62;
    const iconCx = x + 14 + boxSize / 2;
    const iconCy = CARD_Y + 18 + boxSize / 2;
    root.add(slotBox(this, iconCx, iconCy, boxSize, t.color, tier >= 2, weaponTier));
    root.add(this.fitImage(iconCx, iconCy - (weaponTier !== undefined ? 2 : 0), iconKey, iconSize));

    // 图标右侧：标题 + 类型副标（使用清透粗体字，小号汉字不糊）
    const tx = x + 14 + boxSize + 10;
    const titleMaxW = CARD_W - (tx - x) - 10;
    const titleObj = cardTitle(this, tx, CARD_Y + 32, title, 19, t.css).setOrigin(0, 0.5);
    if (titleObj.width > titleMaxW) titleObj.setScale(titleMaxW / titleObj.width);
    root.add(titleObj);
    root.add(label(this, tx, CARD_Y + 56, typeLine, 12, COLOR.dim).setOrigin(0, 0.5));

    let bodyY = CARD_Y + 92;
    if (classes && classes.length > 0) {
      let px = x + 14;
      for (const cls of classes) {
        const ts = CLASS_STYLE[cls];
        const p = pill(this, px, bodyY + 12, CLASS_LABEL[cls], ts.bg, ts.border, ts.text, 11, 8, 19);
        p.x = px + p.width / 2;
        root.add(p);
        px += p.width + 6;
      }
      bodyY += 28;
    }

    root.add(divider(this, x + 14, bodyY, CARD_W - 28, COLOR.border, 0.5));
    const isItem = !classes || classes.length === 0;
    layoutLines(this, root, x + 14, bodyY + (isItem ? 12 : 8), lines, isItem ? 15 : 14, CARD_W - 28, isItem ? 6 : 3, 0);
  }

  private weaponCard(root: Container, x: number, id: string, tier: number): void {
    const def = WEAPONS[id];
    const title = tier > 0 ? `${def.name} ${TIER_ROMAN[tier]}` : def.name;
    this.card(
      root,
      x,
      tier,
      weaponTex(def.icon, tier, true),
      50,
      title,
      weaponTypeLine(def, tier),
      weaponLines(def, tier, this.run.stats, this.run.mods),
      def.classes,
      tier,
    );
  }

  private itemCard(root: Container, x: number, def: ItemDef): void {
    this.card(root, x, def.rarity, def.icon, 46, def.name, `${TIERS[def.rarity].name}道具`, itemLines(def));
  }

  // ---------- 弹窗 ----------

  private openPopup(w: number, h: number, accent: number, build: (c: Container, x: number, y: number) => void): void {
    this.closePopup();
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.74).setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closePopup());
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    const blocker = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    c.add([dim, panel(this, x, y, w, h, accent, COLOR.panel, 2, accent), blocker]);
    build(c, x, y);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 110 });
    this.popup = c;
  }

  private closePopup(): void {
    this.popup?.destroy();
    this.popup = null;
  }

  private weaponPopup(j: number): void {
    const run = this.run;
    const w = run.weapons[j];
    const def = WEAPONS[w.id];
    const tier = TIERS[w.tier];
    const pw = Math.round(456 * POPUP_SCALE);
    const ph = Math.round(410 * POPUP_SCALE);
    this.openPopup(pw, ph, tier.color, (c, x, y) => {
      const cx = x + pw / 2;
      c.add(slotBox(this, cx, y + 66, 92, tier.color, w.tier >= 2, w.tier));
      c.add(this.fitImage(cx, y + 63, weaponTex(def.icon, w.tier, true), 74));
      const wTitle = w.tier > 0 ? `${def.name} ${TIER_ROMAN[w.tier]}` : def.name;
      c.add(cardTitle(this, cx, y + 130, wTitle, 24, tier.css).setOrigin(0.5));
      c.add(label(this, cx, y + 156, weaponTypeLine(def, w.tier), 15, COLOR.dim).setOrigin(0.5));

      const pills = def.classes.map((cls) => {
        const ts = CLASS_STYLE[cls];
        return pill(this, 0, y + 182, CLASS_LABEL[cls], ts.bg, ts.border, ts.text, 12, 10, 22);
      });
      const total = pills.reduce((acc, p) => acc + p.width, 0) + 8 * (pills.length - 1);
      let px = cx - total / 2;
      for (const p of pills) {
        p.x = px + p.width / 2;
        c.add(p);
        px += p.width + 8;
      }

      c.add(divider(this, x + 28, y + 204, pw - 56, tier.color, 0.5));
      layoutLines(this, c, cx, y + 216, weaponLines(def, w.tier, run.stats, run.mods, w), 16, pw - 48, 4);

      const by = y + ph - 44;
      const canMerge = mergePartner(run, j) >= 0;
      const canSell = run.weapons.length > 1;
      const value = weaponSellValue(run, j);
      const mergeLabel = canMerge ? `升至${TIERS[w.tier + 1].name}` : '合成升级';
      c.add(
        createButton(
          this,
          cx - 144,
          by,
          mergeLabel,
          () => {
            mergeWeapons(run, j);
            sfx.play('levelUp');
            this.render();
          },
          { width: 132, height: 48, fontSize: 19, variant: canMerge ? 'emerald' : undefined, disabled: !canMerge },
        ),
      );
      c.add(
        createButton(
          this,
          cx,
          by,
          canSell ? `卖出 +${value}` : '最后一把',
          () => {
            sellWeapon(run, j);
            sfx.play('buy');
            this.render();
          },
          { width: 142, height: 48, fontSize: 19, primary: false, disabled: !canSell, icon: canSell ? 'nectar' : undefined },
        ),
      );
      c.add(createButton(this, cx + 144, by, '关闭', () => this.closePopup(), { width: 124, height: 48, fontSize: 20, primary: false }));
    });
  }

  private statsPopup(): void {
    const pw = 340;
    const ph = 600;
    this.openPopup(pw, ph, COLOR.gold, (c, x, y) => {
      c.add(statsPanel(this, x + 12, y + 12, pw - 24, ph - 24, this.run.stats));
    });
  }

  private itemPopup(id: string): void {
    const def = ITEMS[id];
    const tier = TIERS[def.rarity];
    const pw = Math.round(412 * POPUP_SCALE);
    const ph = Math.round(370 * POPUP_SCALE);
    this.openPopup(pw, ph, tier.color, (c, x, y) => {
      const cx = x + pw / 2;
      c.add(slotBox(this, cx, y + 66, 92, tier.color, def.rarity >= 2));
      c.add(this.fitImage(cx, y + 66, def.icon, 68));
      c.add(cardTitle(this, cx, y + 132, def.name, 24, tier.css).setOrigin(0.5));
      c.add(label(this, cx, y + 158, `${tier.name}道具 · 当前持有 ×${this.run.items[id]}`, 15, COLOR.dim).setOrigin(0.5));
      c.add(divider(this, x + 28, y + 180, pw - 56, tier.color, 0.5));
      layoutLines(this, c, cx, y + 194, itemLines(def), 16, pw - 48, 4);
      c.add(createButton(this, cx, y + ph - 44, '关闭', () => this.closePopup(), { width: 164, height: 48, fontSize: 21, primary: false }));
    });
  }

  // ---------- 小部件 ----------

  private toast(text: string): void {
    this.toasts.push(text);
    if (!this.toastBusy) this.nextToast();
  }

  private nextToast(): void {
    const text = this.toasts.shift();
    if (!text) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    const badge = pill(this, CARDS_CX + 80, 35, `★ ${text}`, 0x282012, COLOR.gold, COLOR.goldText, 15, 16, 32)
      .setDepth(200)
      .setScale(0.9)
      .setAlpha(0);
    this.tweens.add({ targets: badge, alpha: 1, scale: 1, duration: 160, ease: 'Back.Out' });
    this.tweens.add({
      targets: badge,
      alpha: 0,
      y: 22,
      delay: 2200,
      duration: 360,
      onComplete: () => {
        badge.destroy();
        this.nextToast();
      },
    });
  }

  private fitImage(x: number, y: number, key: string, size: number): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, key);
    return img.setScale(size / Math.max(img.width, img.height));
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

  private lockButton(cx: number, cy: number, w: number, h: number, locked: boolean, onTap: () => void): Container {
    const g = this.add.graphics();
    const lipH = 4;
    const draw = (state: 'idle' | 'hover' | 'down') => {
      const hover = state === 'hover';
      const oy = state === 'down' ? lipH - 1 : hover ? -1 : 0;
      drawKeycap(g, {
        w,
        h,
        shape: 'notch',
        bg: locked ? (hover ? 0xf7b63a : 0xe39622) : hover ? 0xf0efe9 : 0x252730,
        lip: locked ? 0x94540a : hover ? 0x8e8d87 : 0x121318,
        border: locked ? 0xffe48a : hover ? 0x050507 : 0x5c606e,
        lipH,
        ox: 0,
        oy,
        lightBevel: !(hover && !locked),
      });
      const col = locked ? 0x140b03 : hover ? 0x111216 : 0xf2f1ec;
      g.fillStyle(col, 1);
      g.fillRoundedRect(-6.5, -1 + oy, 13, 9.5, 2);
      g.lineStyle(2.2, col, 1);
      g.beginPath();
      if (locked) g.arc(0, -1 + oy, 4.8, Math.PI, 0, false);
      else g.arc(3.5, -3.5 + oy, 4.8, Math.PI, -0.3, false);
      g.strokePath();
    };
    draw('idle');
    const c = this.add.container(cx, cy, [g]).setSize(w, h + lipH);
    const zone = this.tapZone(-w / 2, -h / 2, w, h + lipH, onTap);
    zone.on('pointerover', () => draw('hover'));
    zone.on('pointerout', () => draw('idle'));
    zone.on('pointerdown', () => draw('down'));
    zone.on('pointerup', () => draw('hover'));
    c.add(zone);
    return c;
  }
}
