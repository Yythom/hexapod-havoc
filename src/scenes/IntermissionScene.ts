import Phaser from 'phaser';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, IS_COARSE_POINTER, NUM_FONT } from '../config';
import { bus, EVT } from '../core/bus';
import {
  CONTRACTS,
  ENCHANT_ORDER,
  WEAPON_ENCHANTS,
  enchantCost,
  isContractWave,
  rollContracts,
  type ContractId,
} from '../core/contracts';
import { adjacentLinkPairs, computeSlotBonus, ZONE_META } from '../core/legSynergy';
import { levelRerollCost, rollUpgrades, type UpgradeOption } from '../core/progression';
import type { RunState } from '../core/RunState';
import { recordItemSeen, recordWeaponSeen, saveActiveRun } from '../core/save';
import { checkUnlocks } from '../core/unlocks';
import { CHARACTERS } from '../data/characters';
import {
  addItem,
  buyOffer,
  chestSellValue,
  cursedItemExtraStats,
  CURSED_OFFER_CURSE,
  enchantWeapon,
  mergePartner,
  mergeWeapons,
  OFFER_COUNT,
  offerPrice,
  refreshOffers,
  rerollCost,
  rollChestItem,
  sellWeapon,
  smeltItem,
  weaponAddMode,
  weaponSellValue,
  type Offer,
} from '../core/shop';
import { activeSets, classCounts, SET_THRESHOLDS, SETS } from '../core/sets';
import { formatStat, formatStatDelta, STAT_KEYS, STAT_META, type Stats } from '../core/stats';
import { ITEMS, type ItemDef } from '../data/items';
import { TIER_ROMAN, weaponTex } from '../art/icons';
import { SPRITE_RES } from '../art/draw';
import { CLASS_LABEL, TIERS, WEAPONS, type WeaponClass } from '../data/weapons';
import { createButton, drawKeycap } from '../ui/Button';
import { fadeInScene, setupUICamera } from '../ui/camera';
import {
  COLOR,
  CLASS_STYLE,
  cardTitle,
  createStatsPanel,
  displayLabel,
  divider,
  drawChamferPlate,
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
  type StatsPanelHandle,
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

type Page = 'level' | 'chest' | 'contract' | 'shop';

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
  private spinRays: Phaser.GameObjects.Image[] = [];
  private toasts: string[] = [];
  private toastBusy = false;
  private statsHandle: StatsPanelHandle | null = null;
  private weaponHoverTip: Container | null = null;
  private prevNectar = -1;
  private prevStats: Stats | null = null;
  private changedSlot = -1;
  private animateOffers = true;

  constructor() {
    super('Intermission');
  }

  create(): void {
    setupUICamera(this);
    this.input.mouse?.disableContextMenu();
    this.run = this.registry.get('run') as RunState;
    this.root = null;
    this.popup = null;
    this.spinRays = [];
    this.toasts = [];
    this.toastBusy = false;
    this.statsHandle = null;
    this.prevNectar = this.run.nectar;
    this.prevStats = { ...this.run.stats };
    this.changedSlot = -1;
    this.animateOffers = true;

    warmBackdrop(this, W, H);
    bgm.setMode('shop');
    const kb = this.input.keyboard!;
    const confirmKey = () => {
      if (this.popup) return;
      if (this.page === 'shop') this.finish();
      else if (this.page === 'chest') this.takeChest();
    };
    kb.on('keydown-ENTER', confirmKey);
    kb.on('keydown-SPACE', confirmKey);
    kb.on('keydown-R', () => {
      if (this.popup) return;
      if (this.page === 'shop') this.rerollShop();
      else if (this.page === 'level') this.rerollUpgrades();
    });
    const pickSlot = (idx: number) => {
      if (this.popup) return;
      if (this.page === 'shop') this.buy(idx);
      else if (this.page === 'level' && this.run.pendingUpgrades[idx]) this.chooseUpgrade(this.run.pendingUpgrades[idx]);
    };
    kb.on('keydown-ONE', () => pickSlot(0));
    kb.on('keydown-TWO', () => pickSlot(1));
    kb.on('keydown-THREE', () => pickSlot(2));
    kb.on('keydown-FOUR', () => pickSlot(3));
    kb.on('keydown-ESC', () => this.closePopup());
    this.nextPage();
    fadeInScene(this);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    for (const r of this.spinRays) r.rotation += dt * 0.25;
  }

  private nextPage(): void {
    const run = this.run;
    if (run.pendingLevelUps > 0) {
      this.page = 'level';
      if (run.pendingUpgrades.length === 0) {
        run.pendingUpgrades = rollUpgrades(run.wave, run.stats.luck, 4, run);
      }
    } else if (run.chests > 0) {
      this.page = 'chest';
      if (!run.pendingChestItem || !ITEMS[run.pendingChestItem]) {
        run.pendingChestItem = rollChestItem(run);
      }
    } else if (!run.endless && !run.setup.challenge && isContractWave(run.wave) && !run.contractDone) {
      this.page = 'contract';
      if (run.pendingContracts.length < 2) {
        run.pendingContracts = rollContracts();
      }
    } else {
      this.page = 'shop';
      if (!run.shopReady) {
        refreshOffers(run);
        run.shopReady = true;
      }
    }
    this.animateOffers = true;
    this.render();
  }

  private render(): void {
    for (const id of checkUnlocks(this.run)) this.toast(`解锁新角色：${CHARACTERS[id].name}`);
    saveActiveRun(this.run.serialize());
    this.closePopup();
    this.root?.destroy();
    this.spinRays = [];
    this.statsHandle = null;
    this.weaponHoverTip = null;
    const root = this.add.container(0, 0);
    this.root = root;

    if (PHONE) {
      root.add(createButton(this, PHONE_BTN_X, 492, '属性', () => this.statsPopup(), { width: 220, height: 56, fontSize: 22, primary: false }));
    } else {
      this.statsHandle = createStatsPanel(this, RIGHT_X, CARD_Y, RIGHT_W, 474, this.run.stats);
      root.add(this.statsHandle.container);
      if (this.prevStats) {
        const changed = STAT_KEYS.filter((k) => Math.abs(this.run.stats[k] - this.prevStats![k]) > 1e-6);
        if (changed.length > 0) this.statsHandle.pulse(changed);
      }
    }
    this.prevStats = { ...this.run.stats };

    // 顶部右侧花蜜计数铭牌（右对齐右侧属性面板，带扣费/加钱跳动飘字）
    const nectarText = numLabel(this, 0, 0, String(this.run.nectar), 24, COLOR.goldText).setOrigin(0, 0.5);
    const pillW = Math.max(122, Math.ceil(nectarText.width + 64));
    const pillX = RIGHT_X + RIGHT_W - pillW;
    const nBg = this.add.graphics();
    drawChamferPlate(nBg, pillX, 15, pillW, 38, {
      fill: COLOR.panelDeep,
      border: COLOR.gold,
      borderWidth: 1.6,
      borderAlpha: 0.6,
      shadowX: 3,
      shadowY: 3,
      cutBig: 8,
      cutSmall: 4,
      inkWidth: 2.5,
    });
    root.add(nBg);
    root.add(this.add.image(pillX + 24, 34, 'nectar').setDisplaySize(24, 24));
    nectarText.setPosition(pillX + 44, 35);
    root.add(nectarText);

    const nectarDelta = this.run.nectar - this.prevNectar;
    if (this.prevNectar >= 0 && nectarDelta !== 0) {
      nectarText.setScale(1.26);
      this.tweens.add({ targets: nectarText, scale: 1, duration: 240, ease: 'Back.Out' });
      const deltaStr = nectarDelta > 0 ? `+${nectarDelta}` : String(nectarDelta);
      const deltaCol = nectarDelta > 0 ? COLOR.good : '#ff8c5a';
      const floatTxt = numLabel(this, pillX + pillW - 14, 58, deltaStr, 18, deltaCol).setOrigin(1, 0).setDepth(120);
      this.tweens.add({
        targets: floatTxt,
        y: 78,
        alpha: 0,
        duration: 620,
        ease: 'Quad.Out',
        onComplete: () => floatTxt.destroy(),
      });
    }
    this.prevNectar = this.run.nectar;

    if (this.page === 'level') this.buildLevel(root);
    else if (this.page === 'chest') this.buildChest(root);
    else if (this.page === 'contract') this.buildContract(root);
    else this.buildShop(root);

    this.changedSlot = -1;
    this.animateOffers = false;
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

    this.run.pendingUpgrades.forEach((u, i) => {
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
        drawChamferPlate(bg, lx, ly, CARD_W, CARD_H, {
          fill: hover ? COLOR.panelHi : COLOR.panel,
          border: hover ? 0xffffff : tier.color,
          borderWidth: hover ? 2.8 : 2,
          accentTop: tier.color,
          headerH: 62,
          cornerTicks: true,
        });
      };
      drawCard(false);
      card.add(bg);

      card.add(pill(this, 0, ly + 34, `${tier.name}强化`, COLOR.panelDeep, tier.color, tier.css, 13, 12, 24));
      if (!PHONE) {
        card.add(pill(this, lx + 20, ly + 18, String(i + 1), COLOR.panelDeep, COLOR.borderSoft, COLOR.dim, 11, 6, 18));
      }
      card.add(cardTitle(this, 0, ly + 104, STAT_META[u.stat].label, 26, COLOR.text).setOrigin(0.5));
      card.add(divider(this, lx + 26, ly + 132, CARD_W - 52, tier.color, 0.55));
      card.add(numLabel(this, 0, ly + 180, formatStatDelta(u.stat, u.value), 44, u.tier === 0 ? COLOR.good : tier.css).setOrigin(0.5));
      card.add(label(this, 0, ly + 222, `当前 ${formatStat(u.stat, run.stats[u.stat])}`, 13, COLOR.dim).setOrigin(0.5));
      card.add(pill(this, 0, ly + CARD_H - 34, '选择强化', COLOR.panelHi, tier.color, COLOR.text, 14, 22, 32));

      const zone = this.tapZone(lx, ly, CARD_W, CARD_H, () => this.chooseUpgrade(u));
      zone.on('pointerover', () => {
        drawCard(true);
        this.statsHandle?.preview({ [u.stat]: u.value });
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, y: cy - 4, angle: i % 2 === 0 ? -1.2 : 1.2, duration: 85, ease: 'Quad.Out' });
      });
      zone.on('pointerout', () => {
        drawCard(false);
        this.statsHandle?.preview();
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, y: cy, angle: 0, duration: 85, ease: 'Quad.Out' });
      });
      card.add(zone);
      if (this.animateOffers) {
        card.setAlpha(0).setY(cy + 16);
        this.tweens.add({ targets: card, alpha: 1, y: cy, delay: i * 40, duration: 150, ease: 'Back.Out' });
      }
      root.add(card);
    });

    // 升级时也在下方展示当前配装，方便针对性选属性，同时消除大面积空白
    this.weaponRow(root);
    this.itemGrid(root);

    const cost = levelRerollCost(run.wave);
    const rx = PHONE ? PHONE_BTN_X : RIGHT_X + RIGHT_W / 2;
    const bw = PHONE ? 220 : RIGHT_W;
    root.add(
      createButton(this, rx, PHONE ? 572 : 598, PHONE ? `刷新  ${cost}` : `刷新 [R]  ${cost}`, () => this.rerollUpgrades(), {
        width: bw,
        height: 54,
        fontSize: 20,
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
    run.pendingUpgrades = [];
    run.pendingLevelUps--;
    this.nextPage();
  }

  private rerollUpgrades(): void {
    const run = this.run;
    const cost = levelRerollCost(run.wave);
    if (run.nectar < cost) return;
    run.nectar -= cost;
    sfx.play('reroll');
    run.pendingUpgrades = rollUpgrades(run.wave, run.stats.luck, 4, run);
    this.animateOffers = true;
    this.render();
  }

  // ---------- 宝箱 ----------

  private buildChest(root: Container): void {
    const run = this.run;
    const def = ITEMS[run.pendingChestItem];
    const tier = TIERS[def.rarity];
    this.title(root, '战利品宝箱', run.chests > 1 ? `还有 ${run.chests - 1} 个待开启` : '获得一件后院战利品');

    const rays = this.add.image(CARDS_CX, CARD_Y + CARD_H / 2, 'ui-sunrays').setScale(1.0).setTint(tier.color).setAlpha(0.45);
    root.add(rays);
    this.spinRays.push(rays);

    const chestImg = this.add.image(CARDS_CX - CARD_W / 2 - 115, CARD_Y + CARD_H / 2, 'chest@ui').setScale(1.15);
    root.add(chestImg);
    this.tweens.add({ targets: chestImg, y: chestImg.y - 8, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.itemCard(root, CARDS_CX - CARD_W / 2, def);
    this.statsHandle?.preview(def.stats);
    const value = chestSellValue(def.id, run.wave);
    root.add(createButton(this, CARDS_CX - 120, 488, PHONE ? '拿走' : '拿走 [Space]', () => this.takeChest(), { width: 200, height: 58, fontSize: 20 }));
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
    const item = this.run.pendingChestItem;
    if (!item || !ITEMS[item]) return;
    sfx.play('chest');
    addItem(this.run, item);
    recordItemSeen(item);
    this.run.pendingChestItem = '';
    this.run.chests--;
    this.nextPage();
  }

  private sellChest(value: number): void {
    sfx.play('buy');
    this.run.nectar += value;
    this.run.pendingChestItem = '';
    this.run.chests--;
    this.nextPage();
  }

  // ---------- 里程碑后院赌约（第 5 / 10 / 15 波） ----------

  private buildContract(root: Container): void {
    const run = this.run;
    this.title(root, `后院赌约 · 第 ${run.wave + 1} 波前`, '高风险高回报契约，二选一或稳健跳过');
    const cw = 420;
    const ch = 290;
    const gap = 36;
    const x0 = CARDS_CX - cw - gap / 2;
    const cy = CARD_Y + 24;

    run.pendingContracts.slice(0, 2).forEach((cid, i) => {
      const def = CONTRACTS[cid];
      const x = x0 + i * (cw + gap);
      const cx = x + cw / 2;
      root.add(panel(this, x, cy, cw, ch, def.accent, COLOR.panel, 2.2, def.accent, 64));
      root.add(cardTitle(this, cx, cy + 32, def.name, 26, def.css).setOrigin(0.5));
      root.add(divider(this, x + 26, cy + 64, cw - 52, def.accent, 0.55));
      root.add(label(this, x + 26, cy + 84, '风险代价', 14, '#ff8e86', true).setOrigin(0, 0));
      root.add(label(this, x + 26, cy + 108, def.risk, 16, COLOR.bad, false, cw - 52).setOrigin(0, 0).setAlign('left'));
      root.add(label(this, x + 26, cy + 162, '赌约回报', 14, COLOR.goldText, true).setOrigin(0, 0));
      root.add(label(this, x + 26, cy + 186, def.reward, 16, COLOR.good, false, cw - 52).setOrigin(0, 0).setAlign('left'));
      root.add(
        createButton(this, cx, cy + ch - 36, '签下此赌约 ▶', () => this.chooseContract(cid), {
          width: 240,
          height: 46,
          fontSize: 19,
          variant: i === 0 ? 'emerald' : undefined,
        }),
      );
    });

    root.add(
      createButton(this, CARDS_CX, cy + ch + 46, '稳健放弃赌约（直接领 +20 花蜜）', () => this.skipContract(), {
        width: 380,
        height: 48,
        fontSize: 18,
        primary: false,
        icon: 'nectar',
      }),
    );

    this.weaponRow(root);
    this.itemGrid(root);
  }

  private chooseContract(id: ContractId): void {
    const run = this.run;
    sfx.play('chest');
    run.contractDone = true;
    run.pendingContracts = [];
    if (id === 'curse_tribute') {
      run.bonus.curse += 6;
      run.nectar += 70;
      run.totalNectar += 70;
      run.curseOfferBonus = true;
      run.recomputeStats();
      this.toast('深渊献祭：+70 花蜜 · 诅咒 +6 · 诅咒黑市开启！');
    } else {
      run.activeContract = id;
      this.toast(`已签下赌约：${CONTRACTS[id].name}（下一波生效）`);
    }
    this.nextPage();
  }

  private skipContract(): void {
    const run = this.run;
    sfx.play('buy');
    run.contractDone = true;
    run.pendingContracts = [];
    run.nectar += 20;
    run.totalNectar += 20;
    this.nextPage();
  }

  // ---------- 商店 ----------

  private buildShop(root: Container): void {
    const run = this.run;
    const kills = run.waveKills > 0 ? `击杀 ${run.waveKills} · ` : '';
    const harvest = run.waveHarvest > 0 ? `（采蜜 +${run.waveHarvest}）` : '';
    const interest = run.waveInterest > 0 ? ` · 利息 +${run.waveInterest}` : '';
    this.title(root, `商店 · 第 ${run.wave} 波`, `${kills}本波收入 +${run.waveNectar}${harvest}${interest}`, 'snail-merchant');

    const offerCount = run.shopOfferCount;
    const rowWidth = offerCount * CARD_W + (offerCount - 1) * CARD_GAP;
    const fullRowWidth = OFFER_COUNT * CARD_W + (OFFER_COUNT - 1) * CARD_GAP;
    const startX = CARD_X0 + Math.floor((fullRowWidth - rowWidth) / 2);
    for (let i = 0; i < offerCount; i++) {
      const x = startX + i * (CARD_W + CARD_GAP);
      const o = run.offers[i];
      if (o) {
        const cardWrap = this.add.container(0, 0);
        this.offerCard(cardWrap, x, o, i);
        if (this.animateOffers) {
          cardWrap.setAlpha(0).setY(14);
          this.tweens.add({ targets: cardWrap, alpha: 1, y: 0, delay: i * 38, duration: 145, ease: 'Back.Out' });
        }
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
    const rerollLabel = cost === 0 ? (PHONE ? '免费刷新' : '免费刷新 [R]') : PHONE ? `刷新  ${cost}` : `刷新 [R]  ${cost}`;
    const nextWaveLabel = run.endless ? `无尽 ▶ 第 ${run.wave + 1} 波` : `出发 ▶ 第 ${run.wave + 1} 波`;
    root.add(
      createButton(this, rx, PHONE ? 572 : 598, rerollLabel, () => this.rerollShop(), {
        width: bw,
        height: 50,
        fontSize: 19,
        primary: false,
        variant: cost === 0 ? 'emerald' : undefined,
        icon: cost === 0 ? undefined : 'nectar',
        disabled: run.nectar < cost,
      }),
    );
    root.add(createButton(this, rx, PHONE ? 654 : 664, nextWaveLabel, () => this.finish(), { width: bw, height: 58, fontSize: 21 }));
  }

  /** 判断买下该武器是否会激活新的套装羁绊或升级到下一档 */
  private weaponSynergyGain(id: string): boolean {
    const def = WEAPONS[id];
    if (!def) return false;
    const counts = classCounts(this.run.weapons);
    for (const cls of def.classes) {
      const next = (counts.get(cls) ?? 0) + 1;
      if (SET_THRESHOLDS.includes(next as 2 | 3 | 4 | 5 | 6)) return true;
    }
    return false;
  }

  /** 计算购买该武器后的属性变化预览（含武器自带 bonusStats 与新增套装羁绊） */
  private weaponPreviewDeltas(id: string, tier: number): Partial<Stats> {
    const def = WEAPONS[id];
    if (!def) return {};
    const mode = weaponAddMode(this.run, id, tier);
    if (mode !== 'add') return {};
    const out: Partial<Stats> = {};
    const add = (st?: Partial<Stats>, sign = 1) => {
      if (!st) return;
      for (const [k, v] of Object.entries(st) as [keyof Stats, number][]) {
        out[k] = (out[k] ?? 0) + v * sign;
      }
    };
    add(def.bonusStats, 1);
    const curSets = new Map(activeSets(this.run.weapons).map((a) => [a.cls, a.level.stats]));
    const simWeapons = [...this.run.weapons, { id, tier }];
    for (const a of activeSets(simWeapons)) {
      const prev = curSets.get(a.cls);
      if (prev !== a.level.stats) {
        add(prev, -1);
        add(a.level.stats, 1);
      }
    }
    return out;
  }

  private offerCard(root: Container, x: number, o: Offer, index: number): void {
    const run = this.run;
    if (o.kind === 'weapon') this.weaponCard(root, x, o.id, o.tier, !!o.cursed);
    else this.itemCard(root, x, ITEMS[o.id], !!o.cursed);

    if (!PHONE) {
      root.add(pill(this, x + 16, CARD_Y + 12, String(index + 1), COLOR.panelDeep, COLOR.borderSoft, COLOR.dim, 11, 6, 18));
    }

    const price = offerPrice(o, run);
    let text = String(price);
    let icon: string | undefined = 'nectar';
    let disabled = run.nectar < price;
    let isMerge = false;
    let isSynergy = false;
    if (o.kind === 'weapon') {
      const mode = weaponAddMode(run, o.id, o.tier);
      if (mode === 'full') {
        text = '已满';
        icon = undefined;
        disabled = true;
      } else if (mode === 'merge') {
        text = `合成 ${price}`;
        isMerge = true;
      } else {
        isSynergy = this.weaponSynergyGain(o.id);
      }
    }

    // 右上角高光角标：紫火诅咒 / 可合成 / 凑羁绊 / 已锁定
    let badgeRightX = x + CARD_W - 10;
    if (o.locked) {
      const lockBadge = pill(this, 0, CARD_Y + 12, '已锁', 0x3b2608, COLOR.gold, COLOR.goldText, 11, 7, 20);
      lockBadge.x = badgeRightX - lockBadge.width / 2;
      badgeRightX -= lockBadge.width + 4;
      root.add(lockBadge);
    }
    if (o.cursed) {
      const cb = pill(this, 0, CARD_Y + 12, '✦ 诅咒', 0x381252, 0xc868ff, '#f0c8ff', 11, 7, 20);
      cb.x = badgeRightX - cb.width / 2;
      badgeRightX -= cb.width + 4;
      root.add(cb);
      this.tweens.add({ targets: cb, scale: 1.07, duration: 640, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    if (isMerge) {
      const mb = pill(this, 0, CARD_Y + 12, '✦ 可合成', 0x164a22, 0x5de862, '#c8ffd0', 11, 7, 20);
      mb.x = badgeRightX - mb.width / 2;
      root.add(mb);
      this.tweens.add({ targets: mb, scale: 1.07, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else if (isSynergy) {
      const sb = pill(this, 0, CARD_Y + 12, '✦ 凑羁绊', 0x16384e, 0x62d8ff, '#ccf2ff', 11, 7, 20);
      sb.x = badgeRightX - sb.width / 2;
      root.add(sb);
      this.tweens.add({ targets: sb, scale: 1.06, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else if (o.kind === 'item' && o.id !== 'mirror' && !ITEMS[o.id].unique && run.mirrorCharges > 0) {
      const mr = pill(this, 0, CARD_Y + 12, '✦ 魔镜双倍', 0x3b1854, 0xd888ff, '#f6dcff', 11, 7, 20);
      mr.x = badgeRightX - mr.width / 2;
      root.add(mr);
      this.tweens.add({ targets: mr, scale: 1.07, duration: 680, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    const hoverStats: Partial<Stats> = o.kind === 'item' ? { ...ITEMS[o.id].stats } : this.weaponPreviewDeltas(o.id, o.tier);
    if (o.cursed) {
      if (o.kind === 'item') {
        for (const [k, v] of Object.entries(cursedItemExtraStats(o.id)) as [keyof Stats, number][]) {
          hoverStats[k] = (hoverStats[k] ?? 0) + v;
        }
      }
      hoverStats.curse = (hoverStats.curse ?? 0) + CURSED_OFFER_CURSE;
    }
    if (Object.keys(hoverStats).length > 0) {
      const hoverZone = this.add.zone(x, CARD_Y, CARD_W, CARD_H - 60).setOrigin(0).setInteractive();
      hoverZone.on('pointerover', () => this.statsHandle?.preview(hoverStats));
      hoverZone.on('pointerout', () => this.statsHandle?.preview());
      root.add(hoverZone);
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
    const o = this.run.offers[index];
    if (!o) return;
    const isMerge = o.kind === 'weapon' && weaponAddMode(this.run, o.id, o.tier) === 'merge';
    const before = this.run.weapons.map((w) => `${w.id}:${w.tier}`);
    const beforeMirror = this.run.mirrorCharges;
    if (!buyOffer(this.run, index)) return;
    if (o.kind === 'weapon') {
      this.changedSlot = this.run.weapons.findIndex((w, idx) => before[idx] !== `${w.id}:${w.tier}`);
      const bought = this.run.weapons[this.changedSlot];
      if (bought) recordWeaponSeen(bought.id, bought.tier);
    } else {
      recordItemSeen(o.id);
      if (this.run.mirrorCharges < beforeMirror) {
        this.toast(`✦ 复刻魔镜生效：额外复制了 ${ITEMS[o.id].name}！`);
      } else if (o.id === 'weirdghost') {
        this.toast('幽灵蝉蜕：下一波将以 1 血开局！');
      } else if (o.id === 'bait') {
        this.toast(`诱饵甜果：下波开局将有 ${this.run.nextWaveBait * 3} 只噬蜜飞鳗突袭！`);
      } else if (o.id === 'peacock') {
        this.toast('孔雀尾羽：下波经验 +100% · 敌人伤害 +50%！');
      } else if (o.id === 'mirror') {
        this.toast('复刻魔镜就绪：下件非唯一道具将免费双倍！');
      }
    }
    sfx.play(isMerge ? 'merge' : 'buy');
    this.render();
  }

  private shopRerollCost(): number {
    if (this.run.character.perks.freeReroll && this.run.shopRerolls === 0) return 0;
    return rerollCost(this.run.wave, this.run.shopRerolls - (this.run.character.perks.freeReroll ? 1 : 0));
  }

  private rerollShop(): void {
    const run = this.run;
    const cost = this.shopRerollCost();
    if (run.nectar < cost) return;
    run.nectar -= cost;
    run.shopRerolls++;
    sfx.play('reroll');
    refreshOffers(run);
    this.animateOffers = true;
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
    const waveDmgTotal = run.weapons.reduce((acc, ow) => acc + (ow.waveDamage ?? 0), 0);
    let mvpIdx = -1;
    let bestWaveDmg = 0;
    run.weapons.forEach((ow, idx) => {
      if ((ow.waveDamage ?? 0) > bestWaveDmg) {
        bestWaveDmg = ow.waveDamage ?? 0;
        mvpIdx = idx;
      }
    });
    root.add(cardTitle(this, CARD_X0, LOW_Y + 10, `武器  ${run.weapons.length}/${slots}`, 19, COLOR.text).setOrigin(0, 0.5));
    const linkPairs = adjacentLinkPairs(run.weapons);
    if (linkPairs.length > 0) {
      root.add(label(this, CARD_X0 + 114, LOW_Y + 10, `⚡ 相邻共鸣 ×${linkPairs.length}`, 12.5, COLOR.goldText, true).setOrigin(0, 0.5));
    } else if (run.weapons.length >= 2) {
      root.add(label(this, CARD_X0 + 114, LOW_Y + 10, '点武器可调换六足位阶', 12, COLOR.dim).setOrigin(0, 0.5));
    }
    // 蜗老板蜕壳赋能台按钮（第 4 波起在商店页开放）
    if (this.page === 'shop' && run.wave >= 4) {
      const canForge = !run.forgeUsed;
      root.add(
        createButton(
          this,
          CARD_X0 + Math.min(520, step * slots - 10) - 56,
          LOW_Y + 8,
          canForge ? '🔨 蜕壳台' : '已赋能',
          () => this.forgePopup(),
          { width: 112, height: 28, fontSize: 13, primary: false, variant: canForge ? 'emerald' : undefined, disabled: !canForge },
        ),
      );
    }
    root.add(divider(this, CARD_X0, LOW_Y + 24, step * slots - 10, COLOR.borderSoft, 0.7));

    // 相邻同系共鸣发光连线（画在武器槽底层）
    if (linkPairs.length > 0) {
      const lg = this.add.graphics();
      const cy = LOW_Y + 68;
      for (const pair of linkPairs) {
        const x1 = CARD_X0 + size / 2 + pair.left * step;
        const x2 = CARD_X0 + size / 2 + pair.right * step;
        lg.lineStyle(6, 0x050507, 0.9);
        lg.beginPath();
        lg.moveTo(x1, cy);
        lg.lineTo(x2, cy);
        lg.strokePath();
        lg.lineStyle(3, COLOR.gold, 0.95);
        lg.beginPath();
        lg.moveTo(x1, cy);
        lg.lineTo(x2, cy);
        lg.strokePath();
      }
      root.add(lg);
    }

    for (let j = 0; j < slots; j++) {
      const cx = CARD_X0 + size / 2 + j * step;
      const cy = LOW_Y + 68;
      const w = run.weapons[j];
      const slotBonus = computeSlotBonus(run.weapons, j, slots);
      const zMeta = ZONE_META[slotBonus.zone];
      const canMerge = w ? mergePartner(run, j) >= 0 : false;
      const slotWrap = this.add.container(cx, cy);
      const borderCol = w ? (w.cursed ? 0xc868ff : TIERS[w.tier].color) : COLOR.borderSoft;
      slotWrap.add(slotBox(this, 0, 0, size, borderCol, canMerge || !!w?.cursed, w?.tier));
      // 底部紧凑六足位阶小标（前 / 中 / 后 / 尾）
      slotWrap.add(label(this, 0, size / 2 + 10, zMeta.short, 11, zMeta.css, true).setOrigin(0.5));
      root.add(slotWrap);
      if (!w) continue;
      slotWrap.add(this.fitImage(0, -3, weaponTex(WEAPONS[w.id].icon, w.tier, true), size - 18));
      if (w.enchant) {
        const enc = WEAPON_ENCHANTS[w.enchant];
        slotWrap.add(pill(this, -size / 2 + 11, -size / 2 + 10, enc.short, 0x161820, enc.color, enc.css, 10, 4, 16));
      }
      if (j === mvpIdx && bestWaveDmg > 0) {
        slotWrap.add(pill(this, -size / 2 + 17, size / 2 - 9, 'MVP', 0x523408, COLOR.gold, COLOR.goldText, 9, 5, 15));
      }
      const quickMerge = () => {
        if (!mergeWeapons(run, j)) return;
        this.changedSlot = Math.min(j, run.weapons.length - 1);
        const merged = run.weapons[this.changedSlot];
        if (merged) recordWeaponSeen(merged.id, merged.tier);
        sfx.play('merge');
        this.render();
      };
      const z = this.add.zone(-size / 2, -size / 2, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', (ptr: Phaser.Input.Pointer) => {
        if (ptr.rightButtonReleased() && canMerge) {
          quickMerge();
        } else {
          this.weaponPopup(j);
        }
      });
      z.on('pointerover', () => {
        this.tweens.killTweensOf(slotWrap);
        this.tweens.add({ targets: slotWrap, scale: 1.07, duration: 70, ease: 'Quad.Out' });
        this.showWeaponHoverTip(root, cx, cy - size / 2 - 18, w, waveDmgTotal, canMerge, slotBonus.summary);
      });
      z.on('pointerout', () => {
        this.tweens.killTweensOf(slotWrap);
        this.tweens.add({ targets: slotWrap, scale: 1, duration: 70, ease: 'Quad.Out' });
        this.weaponHoverTip?.destroy();
        this.weaponHoverTip = null;
      });
      slotWrap.add(z);
      if (canMerge) {
        const badge = this.add.container(size / 2 - 10, -size / 2 + 10);
        const g = this.add.graphics();
        g.fillStyle(0x358c38, 1);
        g.fillRoundedRect(-11, -11, 22, 22, 4);
        g.lineStyle(2, COLOR.ink, 1);
        g.strokeRoundedRect(-11, -11, 22, 22, 4);
        const bz = this.add.zone(-12, -12, 24, 24).setOrigin(0).setInteractive({ useHandCursor: true });
        bz.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          quickMerge();
        });
        badge.add([g, label(this, 0, 0, '合', 12, '#ffffff', true).setOrigin(0.5), bz]);
        slotWrap.add(badge);
        this.tweens.add({ targets: badge, scale: 1.12, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      if (j === this.changedSlot) {
        slotWrap.setScale(1.22);
        this.tweens.add({ targets: slotWrap, scale: 1, duration: 280, ease: 'Back.Out' });
        const pulse = this.add.graphics().setPosition(cx, cy);
        pulse.lineStyle(3, TIERS[w.tier].color, 0.9);
        pulse.strokeRect(-size / 2, -size / 2, size, size);
        root.add(pulse);
        this.tweens.add({ targets: pulse, scale: 1.38, alpha: 0, duration: 360, ease: 'Quad.Out', onComplete: () => pulse.destroy() });
      }
    }
    this.setLines(root);
  }

  /** 商店底部武器槽悬停微型输出条（无需点开弹窗即可速览六足位阶与上波输出占比） */
  private showWeaponHoverTip(
    root: Container,
    x: number,
    y: number,
    w: RunState['weapons'][number],
    waveDmgTotal: number,
    canMerge = false,
    slotHint = '',
  ): void {
    this.weaponHoverTip?.destroy();
    const def = WEAPONS[w.id];
    const wWave = Math.round(w.waveDamage ?? 0);
    const share = waveDmgTotal > 0 ? Math.round((wWave / waveDmgTotal) * 100) : 0;
    const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n));
    const title = w.tier > 0 ? `${def.name} ${TIER_ROMAN[w.tier]}` : def.name;
    const mergeHint = canMerge ? ' · 点「合」升级' : '';
    const txt = `${title} · 上波 ${fmt(wWave)}（${share}%）${slotHint ? ` · ${slotHint}` : ''}${mergeHint}`;
    const tip = pill(this, x, y, txt, 0x11131a, w.cursed ? 0xc868ff : TIERS[w.tier].color, '#fff6dc', 11.5, 11, 24).setDepth(30);
    tip.x = Phaser.Math.Clamp(x, CARD_X0 + tip.width / 2, RIGHT_X - 18 - tip.width / 2);
    root.add(tip);
    this.weaponHoverTip = tip;
  }

  private setLines(root: Container): void {
    const counts = [...classCounts(this.run.weapons)];
    const active = new Map(activeSets(this.run.weapons).map((a) => [a.cls, a]));
    const rowH = PHONE ? 26 : 23;
    const maxRows = Math.floor((H - 8 - (LOW_Y + 126)) / rowH);
    const twoCols = counts.length > maxRows;
    const colW = (586 - 16 - CARD_X0) / 2;
    counts.forEach(([cls, count], i) => {
      const col = twoCols ? Math.floor(i / Math.ceil(counts.length / 2)) : 0;
      const row = twoCols ? i % Math.ceil(counts.length / 2) : i;
      const x = CARD_X0 + col * colW;
      const y = LOW_Y + 126 + row * rowH;
      const on = active.get(cls);
      const next = SET_THRESHOLDS.find((n) => n > count);
      const ts = CLASS_STYLE[cls];
      const tagPill = pill(this, x + 28, y + 10, `${CLASS_LABEL[cls]}×${count}`, ts.bg, ts.border, ts.text, 12, 8, 20);
      tagPill.x = x + tagPill.width / 2;
      root.add(tagPill);

      // 羁绊阈值进度刻度点（● ● ○）
      const targetPips = Math.min(6, next ?? Math.max(2, count));
      const pipX0 = x + tagPill.width + 8;
      const pipG = this.add.graphics();
      for (let p = 0; p < targetPips; p++) {
        const px = pipX0 + p * 8 + 3;
        const py = y + 10;
        const filled = p < count;
        pipG.fillStyle(COLOR.ink, 1);
        pipG.fillCircle(px, py, 3.6);
        pipG.fillStyle(filled ? (on ? 0x5de862 : ts.border) : 0x2a2d36, 1);
        pipG.fillCircle(px, py, 2.5);
      }
      root.add(pipG);
      const pipsW = targetPips * 8 + 4;

      let info: string;
      if (twoCols) {
        info = on ? on.level.text : next ? `${next} 把生效` : '';
      } else {
        const nextText = next ? `（${next}把：${SETS[cls][SET_THRESHOLDS.indexOf(next as 2 | 3 | 4 | 5 | 6)].text}）` : '';
        info = on ? `${on.level.text}${nextText}` : nextText.replace(/^（|）$/g, '');
      }
      const textX = pipX0 + pipsW;
      const t = label(this, textX, y + 10, info, twoCols ? 13 : 14, on ? COLOR.good : COLOR.dim).setOrigin(0, 0.5);
      const room = (twoCols ? colW : 586 - CARD_X0) - (textX - x) - 6;
      if (t.width > room && room > 10) t.setScale(room / t.width);
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
      const itemWrap = this.add.container(cx, cy);
      itemWrap.add(slotBox(this, 0, 0, 56, TIERS[def.rarity].color));
      itemWrap.add(this.add.image(0, 0, def.icon).setDisplaySize(42, 42));
      const n = run.items[id];
      if (n > 1) {
        itemWrap.add(
          this.add
            .text(24, 25, `×${n}`, { fontFamily: NUM_FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff', stroke: '#050507', strokeThickness: 4 })
            .setOrigin(1, 1),
        );
      }
      const z = this.tapZone(-28, -28, 56, 56, () => this.itemPopup(id));
      z.on('pointerover', () => {
        this.tweens.killTweensOf(itemWrap);
        this.tweens.add({ targets: itemWrap, scale: 1.08, duration: 70, ease: 'Quad.Out' });
      });
      z.on('pointerout', () => {
        this.tweens.killTweensOf(itemWrap);
        this.tweens.add({ targets: itemWrap, scale: 1, duration: 70, ease: 'Quad.Out' });
      });
      itemWrap.add(z);
      root.add(itemWrap);
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
    cursed = false,
  ): void {
    const t = TIERS[tier];
    const borderCol = cursed ? 0xc868ff : t.color;
    root.add(panel(this, x, CARD_Y, CARD_W, CARD_H, borderCol, COLOR.panel, cursed ? 2.6 : 2, borderCol, 90));

    // 左上角方正图标槽
    const boxSize = 62;
    const iconCx = x + 14 + boxSize / 2;
    const iconCy = CARD_Y + 18 + boxSize / 2;
    root.add(slotBox(this, iconCx, iconCy, boxSize, borderCol, tier >= 2 || cursed, weaponTier));
    root.add(this.fitImage(iconCx, iconCy - (weaponTier !== undefined ? 2 : 0), iconKey, iconSize));

    // 图标右侧：标题 + 类型副标（使用清透粗体字，小号汉字不糊）
    const tx = x + 14 + boxSize + 10;
    const titleMaxW = CARD_W - (tx - x) - 10;
    const titleObj = cardTitle(this, tx, CARD_Y + 32, title, 19, cursed ? '#ebbaff' : t.css).setOrigin(0, 0.5);
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
    layoutLines(this, root, x + 14, bodyY + (isItem ? 10 : 7), lines, isItem ? 14 : 13, CARD_W - 28, isItem ? 4 : 2.5, 0);
  }

  private weaponCard(root: Container, x: number, id: string, tier: number, cursed = false): void {
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
      weaponLines(def, tier, this.run.stats, this.run.mods, null, null, cursed),
      def.classes,
      tier,
      cursed,
    );
  }

  private itemCard(root: Container, x: number, def: ItemDef, cursed = false): void {
    this.card(root, x, def.rarity, def.icon, 46, def.name, `${TIERS[def.rarity].name}道具`, itemLines(def, cursed), undefined, undefined, cursed);
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
    const slotBonus = computeSlotBonus(run.weapons, j, run.weaponSlots);
    const pw = Math.round(484 * POPUP_SCALE);
    const ph = Math.round(516 * POPUP_SCALE);
    this.openPopup(pw, ph, w.cursed ? 0xc868ff : tier.color, (c, x, y) => {
      const cx = x + pw / 2;
      c.add(slotBox(this, cx, y + 60, 88, w.cursed ? 0xc868ff : tier.color, w.tier >= 2 || !!w.cursed, w.tier));
      c.add(this.fitImage(cx, y + 57, weaponTex(def.icon, w.tier, true), 70));
      const wTitle = w.tier > 0 ? `${def.name} ${TIER_ROMAN[w.tier]}` : def.name;
      c.add(cardTitle(this, cx, y + 120, wTitle, 24, w.cursed ? '#ebbaff' : tier.css).setOrigin(0.5));
      c.add(label(this, cx, y + 146, `${weaponTypeLine(def, w.tier)} · 槽位 #${j + 1} (${slotBonus.zoneLabel})`, 14, COLOR.dim).setOrigin(0.5));

      const pills = def.classes.map((cls) => {
        const ts = CLASS_STYLE[cls];
        return pill(this, 0, y + 172, CLASS_LABEL[cls], ts.bg, ts.border, ts.text, 12, 10, 22);
      });
      const total = pills.reduce((acc, p) => acc + p.width, 0) + 8 * (pills.length - 1);
      let px = cx - total / 2;
      for (const p of pills) {
        p.x = px + p.width / 2;
        c.add(p);
        px += p.width + 8;
      }

      c.add(divider(this, x + 28, y + 194, pw - 56, tier.color, 0.5));
      layoutLines(this, c, cx, y + 206, weaponLines(def, w.tier, run.stats, run.mods, w, slotBonus), 14.5, pw - 48, 3.5);

      // 槽位移动调整六足位阶 & 相邻共鸣
      if (run.weapons.length > 1) {
        const moveY = y + ph - 144;
        c.add(
          createButton(
            this,
            cx - 96,
            moveY,
            '◀ 左移槽位',
            () => {
              if (run.swapWeapons(j, j - 1)) {
                this.changedSlot = j - 1;
                sfx.play('click');
                this.render();
                this.weaponPopup(j - 1);
              }
            },
            { width: 170, height: 36, fontSize: 15, primary: false, disabled: j <= 0 },
          ),
        );
        c.add(
          createButton(
            this,
            cx + 96,
            moveY,
            '右移槽位 ▶',
            () => {
              if (run.swapWeapons(j, j + 1)) {
                this.changedSlot = j + 1;
                sfx.play('click');
                this.render();
                this.weaponPopup(j + 1);
              }
            },
            { width: 170, height: 36, fontSize: 15, primary: false, disabled: j >= run.weapons.length - 1 },
          ),
        );
      }

      // 每把武器伤害输出统计条（上波占比 + 累计总伤）
      const waveSum = run.weapons.reduce((acc, ow) => acc + (ow.waveDamage ?? 0), 0);
      const wWave = Math.round(w.waveDamage ?? 0);
      const wTotal = Math.round(w.totalDamage ?? 0);
      const share = waveSum > 0 ? Math.round((wWave / waveSum) * 100) : 0;
      c.add(
        pill(
          this,
          cx,
          y + ph - 96,
          `上波输出 ${wWave}（${share}%） · 本局累计 ${wTotal}`,
          COLOR.panelDeep,
          COLOR.gold,
          COLOR.goldText,
          13,
          14,
          26,
        ),
      );

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
            this.changedSlot = Math.min(j, run.weapons.length - 1);
            const merged = run.weapons[this.changedSlot];
            if (merged) recordWeaponSeen(merged.id, merged.tier);
            sfx.play('merge');
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

  /** 蜗老板蜕壳赋能台弹窗：给武器打附魔 或 熔炼非唯一卡手道具（每波 1 次） */
  private forgePopup(selectedWeapon = 0): void {
    const run = this.run;
    const pw = 680;
    const ph = 520;
    const cost = enchantCost(run.wave);
    const wIdx = Math.min(selectedWeapon, Math.max(0, run.weapons.length - 1));
    this.openPopup(pw, ph, COLOR.gold, (c, x, y) => {
      const cx = x + pw / 2;
      c.add(displayLabel(this, cx, y + 36, '🔨 蜗老板蜕壳赋能台', 26, COLOR.goldText).setOrigin(0.5));
      c.add(label(this, cx, y + 66, '每波商店限使用 1 次：给武器打附魔 或 熔炼多余道具换属性', 13, COLOR.dim).setOrigin(0.5));
      c.add(divider(this, x + 28, y + 84, pw - 56, COLOR.gold, 0.5));

      // 上半区：武器附魔
      c.add(label(this, x + 28, y + 98, `一、武器附魔（消耗 ${cost} 花蜜 · 先选武器，再点附魔）`, 15, COLOR.text, true).setOrigin(0, 0));
      if (run.weapons.length === 0) {
        c.add(label(this, cx, y + 150, '当前无装备武器', 14, COLOR.dim).setOrigin(0.5));
      } else {
        const wStep = Math.min(72, Math.floor((pw - 70) / run.weapons.length));
        run.weapons.forEach((ow, idx) => {
          const sx = x + 58 + idx * wStep;
          const sy = y + 154;
          const sel = idx === wIdx;
          c.add(slotBox(this, sx, sy, 58, sel ? COLOR.gold : TIERS[ow.tier].color, sel, ow.tier));
          c.add(this.fitImage(sx, sy - 2, weaponTex(WEAPONS[ow.id].icon, ow.tier, true), 44));
          if (ow.enchant) {
            const e = WEAPON_ENCHANTS[ow.enchant];
            c.add(pill(this, sx - 18, sy - 18, e.short, 0x161820, e.color, e.css, 9, 4, 15));
          }
          const z = this.tapZone(sx - 29, sy - 29, 58, 58, () => {
            sfx.play('click');
            this.forgePopup(idx);
          });
          c.add(z);
        });

        ENCHANT_ORDER.forEach((eid, idx) => {
          const enc = WEAPON_ENCHANTS[eid];
          const ex = x + 104 + idx * 156;
          const ey = y + 228;
          c.add(
            createButton(
              this,
              ex,
              ey,
              `${enc.name}`,
              () => {
                if (enchantWeapon(run, wIdx, eid)) {
                  sfx.play('merge');
                  this.toast(`✦ ${WEAPONS[run.weapons[wIdx].id].name} 已获得${enc.name}！`);
                  this.render();
                }
              },
              { width: 146, height: 42, fontSize: 15, primary: false, accentColor: enc.color, disabled: run.nectar < cost || run.forgeUsed },
            ),
          );
          c.add(label(this, ex, ey + 34, enc.desc, 11, enc.css, false, 146).setOrigin(0.5, 0));
        });
      }

      // 下半区：熔炼非唯一道具
      c.add(divider(this, x + 28, y + 306, pw - 56, COLOR.border, 0.6));
      c.add(label(this, x + 28, y + 320, '二、熔炼非唯一道具（返还 60% 花蜜 + 永久随机基础属性）', 15, COLOR.text, true).setOrigin(0, 0));
      const smeltable = Object.keys(run.items).filter((id) => run.items[id] > 0 && !ITEMS[id].unique);
      if (smeltable.length === 0) {
        c.add(label(this, cx, y + 382, '暂无可熔炼的非唯一道具', 14, COLOR.dim).setOrigin(0.5));
      } else {
        smeltable.slice(0, 8).forEach((id, k) => {
          const def = ITEMS[id];
          const sx = x + 68 + k * 76;
          const sy = y + 382;
          c.add(slotBox(this, sx, sy, 58, TIERS[def.rarity].color));
          c.add(this.add.image(sx, sy, def.icon).setDisplaySize(40, 40));
          c.add(label(this, sx, sy + 39, def.name.slice(0, 4), 11, COLOR.text).setOrigin(0.5));
          const z = this.tapZone(sx - 29, sy - 29, 58, 58, () => {
            const res = smeltItem(run, id);
            if (res) {
              sfx.play('merge');
              this.toast(`熔炼 ${def.name}：+${res.refund} 花蜜 · ${STAT_META[res.stat].label} ${formatStatDelta(res.stat, res.amount)}`);
              this.render();
            }
          });
          c.add(z);
        });
      }

      c.add(createButton(this, cx, y + ph - 38, '关闭', () => this.closePopup(), { width: 164, height: 46, fontSize: 19, primary: false }));
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
