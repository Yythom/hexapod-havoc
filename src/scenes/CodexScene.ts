import Phaser from 'phaser';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
import { weaponTex } from '../art/icons';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { codexMilestones, loadSave } from '../core/save';
import { BASE_STATS } from '../core/stats';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { ITEMS, ZERO_MODS, type ItemDef } from '../data/items';
import { CLASS_LABEL, KIND_LABEL, SHOP_WEAPONS, TIERS, type WeaponDef, type WeaponKind } from '../data/weapons';
import { createButton } from '../ui/Button';
import { fadeInScene, setupUICamera, transitionTo } from '../ui/camera';
import {
  CLASS_STYLE,
  COLOR,
  cardTitle,
  displayLabel,
  divider,
  drawChamferPlate,
  itemLines,
  label,
  layoutLines,
  panel,
  pill,
  slotBox,
  warmBackdrop,
  weaponLines,
  weaponTypeLine,
} from '../ui/widgets';

type Tab = 'weapons' | 'items' | 'enemies';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const COLS = 6;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;
const GRID_X0 = 44;
const GRID_Y0 = 136;
const CARD_W = 188;
const CARD_H = 152;
const GAP_X = 12;
const GAP_Y = 12;

const CODEX_WEAPONS: WeaponDef[] = [...SHOP_WEAPONS].sort((a, b) => (a.minTier ?? 0) - (b.minTier ?? 0));
const ITEM_LIST: ItemDef[] = Object.values(ITEMS).sort((a, b) => a.rarity - b.rarity);
const CODEX_ENEMIES: EnemyDef[] = Object.values(ENEMIES).filter((e) => e.id !== 'tree' && e.id !== 'boomshroom' && e.id !== 'deworb');

const BEHAVIOR_DESC: Record<string, string> = {
  chase: '直线追击玩家，数量庞大（腐巢母虫死亡时会爆出 3 只吐酸幼虫）。',
  swarm: '高速弧线绕行接近，容易成群包围。',
  charger: '蓄力后沿直线高速冲锋，注意侧向走位。',
  ranged: '保持中距离发射黏性丝弹，命中会减速。',
  bomber: '贴近后原地膨胀自爆，及时拉开或提前击杀。',
  summoner: '远离玩家并持续孵化大量工蚁。',
  pursuer: '紧咬追击玩家，存活时间越长移速越快，务必优先点杀。',
  healer: '游走于虫群之中，周期释放翠绿治疗波为周围虫敌回血。',
  buffer: '躲在后排释放赤红声波，使周围虫敌通体泛红并大幅提升血量、移速与伤害！',
  egg: '原地倒计时 5 秒孵化：及时拆卵可保平安，放任孵出镰刃螳虫击杀则掉落更多花蜜！',
  slasher: '保持中距游走，在玩家脚下画 V 字形红带延迟斩击，专克原地站桩。',
  puffer: '亡语向四周 8 向迸发慢速毒球弹幕；但若用近战武器劈死，可直接截断不爆弹幕！',
  lamprey: '诱饵甜果专属突袭怪：高速冲锋并在冲刺沿途向左右两侧甩出成对弹幕。',
  spitter: '由腐巢母虫爆出的游走散射弹幕幼虫，切忌在贴脸时一口气打爆多只母巢。',
  curse_slug: '温顺游走的厄运紫蛞蝓：击杀可永久 +1 诅咒并爆出丰厚花蜜，开启紫光怪高风险刷钱。',
  mummy: '自带负击退抗性的弹弹滚球虫：高击退武器会像台球一样把它弹飞并在边界反弹！',
  elite: '精英：三连冲锋接大范围震击，必掉宝箱。',
  elite_hornet: '精英：5 连扇形与 8 向环形赤红毒针弹幕，必掉宝箱。',
  elite_gargoyle: '三阶段血量突变精英：100%→60%→30% 血逐步裂变，切换慢环弹、X 形地面斩与残血狂暴弹幕雨，必掉宝箱。',
  boss: '最终 Boss：扇形连斩、跳跃砸地，半血狂暴召唤若虫。',
  boss_goliath: '最终 Boss：重角崩冲接碎角弹幕、震地落岩，半血狂暴二连冲。',
  lootbug: '黄金盗宝虫：限时逃跑，击杀掉落宝箱与大量花蜜。',
};

/** 后院图鉴：浏览武器（95）、道具与虫敌，展示历史最高品阶/获得数/击杀数 */
export class CodexScene extends Phaser.Scene {
  private tab: Tab = 'weapons';
  private weaponFilter: WeaponKind | 'all' = 'all';
  private page = 0;
  private root: Phaser.GameObjects.Container | null = null;
  private popup: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Codex');
  }

  create(): void {
    setupUICamera(this);
    bgm.setMode('menu');
    this.tab = 'weapons';
    this.weaponFilter = 'all';
    this.page = 0;
    this.root = null;
    this.popup = null;

    warmBackdrop(this, W, H);
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => {
      if (this.popup) this.closePopup();
      else transitionTo(this, 'Menu');
    });
    kb.on('keydown-LEFT', () => this.stepPage(-1));
    kb.on('keydown-RIGHT', () => this.stepPage(1));
    this.render();
    fadeInScene(this);
  }

  private filteredWeapons(): WeaponDef[] {
    return this.weaponFilter === 'all' ? CODEX_WEAPONS : CODEX_WEAPONS.filter((w) => w.kind === this.weaponFilter);
  }

  private currentTotal(): number {
    if (this.tab === 'weapons') return this.filteredWeapons().length;
    if (this.tab === 'items') return ITEM_LIST.length;
    return CODEX_ENEMIES.length;
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.currentTotal() / PER_PAGE));
  }

  private stepPage(delta: number): void {
    if (this.popup) return;
    const next = Phaser.Math.Clamp(this.page + delta, 0, this.pageCount() - 1);
    if (next === this.page) return;
    this.page = next;
    sfx.play('click');
    this.render();
  }

  private switchTab(next: Tab): void {
    if (this.tab === next) return;
    this.tab = next;
    this.page = 0;
    sfx.play('click');
    this.render();
  }

  private render(): void {
    this.closePopup();
    this.root?.destroy();
    const root = this.add.container(0, 0);
    this.root = root;

    const save = loadSave();
    const seenW = Object.keys(save.seenWeapons).length;
    const seenI = Object.keys(save.seenItems).length;
    const seenE = CODEX_ENEMIES.filter((e) => (save.enemyKills[e.id] ?? 0) > 0).length;

    const title = displayLabel(this, 44, 35, '后院图鉴', 30, COLOR.text).setOrigin(0, 0.5);
    root.add(title);
    const progText =
      this.tab === 'weapons'
        ? `已收录武器 ${seenW} / ${SHOP_WEAPONS.length}`
        : this.tab === 'items'
          ? `已收录道具 ${seenI} / ${ITEM_LIST.length}`
          : `已击败虫敌 ${seenE} / ${CODEX_ENEMIES.length}`;
    const prog = pill(this, 0, 35, progText, COLOR.panelDeep, COLOR.gold, COLOR.goldText, 13, 12, 26);
    prog.x = 44 + title.width + 18 + prog.width / 2;
    root.add(prog);

    // 图鉴里程碑奖励胶囊（展示已解锁禁用槽与炫彩涂装进度）
    const ms = codexMilestones(save);
    const msText = `里程碑：禁用槽 ${ms.banishCap}/3 · 涂装 ${ms.unlockedSkins.length}/5（收录 ${ms.seenEntries}/40 · 击杀 ${ms.totalKills}/1500）`;
    const msPill = pill(this, 0, 35, msText, 0x16241d, 0x5de862, '#b8ffbe', 12, 11, 26);
    msPill.x = prog.x + prog.width / 2 + 12 + msPill.width / 2;
    root.add(msPill);

    root.add(createButton(this, W - 96, 35, '返回菜单', () => transitionTo(this, 'Menu'), { width: 138, height: 42, fontSize: 18, primary: false }));

    // 三个分类标签页
    const tabs: { id: Tab; text: string }[] = [
      { id: 'weapons', text: `武器 (${seenW}/${SHOP_WEAPONS.length})` },
      { id: 'items', text: `道具 (${seenI}/${ITEM_LIST.length})` },
      { id: 'enemies', text: `虫敌 (${seenE}/${CODEX_ENEMIES.length})` },
    ];
    tabs.forEach((t, idx) => {
      root.add(
        createButton(this, 146 + idx * 214, 98, t.text, () => this.switchTab(t.id), {
          width: 202,
          height: 40,
          fontSize: 17,
          primary: this.tab === t.id,
        }),
      );
    });

    const start = this.page * PER_PAGE;
    if (this.tab === 'weapons') {
      // 武器类型快速筛选胶囊（右侧空白区域，零遮挡）
      const filters: { id: WeaponKind | 'all'; text: string }[] = [
        { id: 'all', text: '全部' },
        { id: 'melee', text: KIND_LABEL.melee },
        { id: 'ranged', text: KIND_LABEL.ranged },
        { id: 'toxin', text: KIND_LABEL.toxin },
        { id: 'summon', text: KIND_LABEL.summon },
        { id: 'device', text: KIND_LABEL.device },
      ];
      filters.forEach((f, idx) => {
        const active = this.weaponFilter === f.id;
        root.add(
          createButton(
            this,
            738 + idx * 92,
            98,
            f.text,
            () => {
              if (this.weaponFilter === f.id) return;
              this.weaponFilter = f.id;
              this.page = 0;
              sfx.play('click');
              this.render();
            },
            { width: 84, height: 34, fontSize: 14, primary: active },
          ),
        );
      });
      const slice = this.filteredWeapons().slice(start, start + PER_PAGE);
      slice.forEach((def, i) => this.renderWeaponCard(root, def, i, save.seenWeapons[def.id]));
    } else if (this.tab === 'items') {
      const slice = ITEM_LIST.slice(start, start + PER_PAGE);
      slice.forEach((def, i) => this.renderItemCard(root, def, i, save.seenItems[def.id] ?? 0));
    } else {
      const slice = CODEX_ENEMIES.slice(start, start + PER_PAGE);
      slice.forEach((def, i) => this.renderEnemyCard(root, def, i, save.enemyKills[def.id] ?? 0));
    }

    // 底部分页栏
    const pages = this.pageCount();
    const py = H - 44;
    root.add(
      createButton(this, W / 2 - 140, py, '◀ 上一页', () => this.stepPage(-1), {
        width: 136,
        height: 42,
        fontSize: 17,
        primary: false,
        disabled: this.page <= 0,
      }),
    );
    root.add(label(this, W / 2, py, `第 ${this.page + 1} / ${pages} 页`, 17, COLOR.text, true).setOrigin(0.5));
    root.add(
      createButton(this, W / 2 + 140, py, '下一页 ▶', () => this.stepPage(1), {
        width: 136,
        height: 42,
        fontSize: 17,
        primary: false,
        disabled: this.page >= pages - 1,
      }),
    );
  }

  private cardPos(idx: number): [number, number] {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    return [GRID_X0 + col * (CARD_W + GAP_X), GRID_Y0 + row * (CARD_H + GAP_Y)];
  }

  private renderWeaponCard(root: Phaser.GameObjects.Container, def: WeaponDef, idx: number, bestTier: number | undefined): void {
    const [x, y] = this.cardPos(idx);
    const seen = bestTier !== undefined;
    const tier = seen ? bestTier : def.minTier ?? 0;
    const tInfo = TIERS[tier];
    const g = this.add.graphics();
    drawChamferPlate(g, x, y, CARD_W, CARD_H, {
      fill: seen ? COLOR.panel : COLOR.panelDeep,
      border: seen ? tInfo.color : COLOR.borderSoft,
      borderWidth: seen ? 2 : 1.4,
      accentTop: seen ? tInfo.color : undefined,
      headerH: 0,
      cutBig: 8,
      cutSmall: 3,
      inkWidth: 2.6,
    });
    root.add(g);

    const cx = x + CARD_W / 2;
    root.add(slotBox(this, cx, y + 52, 60, seen ? tInfo.color : COLOR.borderSoft, seen && tier >= 2, seen ? tier : undefined));
    const icon = this.add.image(cx, y + 50, weaponTex(def.icon, seen ? tier : 0, true));
    icon.setScale(44 / Math.max(icon.width, icon.height));
    if (!seen) icon.setTint(0x090a0d).setAlpha(0.55);
    root.add(icon);

    const nameObj = cardTitle(this, cx, y + 102, seen ? def.name : '???', 16, seen ? tInfo.css : COLOR.dim).setOrigin(0.5);
    if (nameObj.width > CARD_W - 18) nameObj.setScale((CARD_W - 18) / nameObj.width);
    root.add(nameObj);

    const sub = seen ? `最高 ${tInfo.name} · ${def.classes.map((c) => CLASS_LABEL[c]).join('/')}` : '局内获得后收录';
    const subObj = label(this, cx, y + 128, sub, 12, seen ? COLOR.dim : '#585c68').setOrigin(0.5);
    if (subObj.width > CARD_W - 16) subObj.setScale((CARD_W - 16) / subObj.width);
    root.add(subObj);

    if (seen) {
      const z = this.add.zone(x, y, CARD_W, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.openWeaponDetail(def, bestTier));
      root.add(z);
    }
  }

  private renderItemCard(root: Phaser.GameObjects.Container, def: ItemDef, idx: number, count: number): void {
    const [x, y] = this.cardPos(idx);
    const seen = count > 0;
    const tInfo = TIERS[def.rarity];
    const g = this.add.graphics();
    drawChamferPlate(g, x, y, CARD_W, CARD_H, {
      fill: seen ? COLOR.panel : COLOR.panelDeep,
      border: seen ? tInfo.color : COLOR.borderSoft,
      borderWidth: seen ? 2 : 1.4,
      accentTop: seen ? tInfo.color : undefined,
      headerH: 0,
      cutBig: 8,
      cutSmall: 3,
      inkWidth: 2.6,
    });
    root.add(g);

    const cx = x + CARD_W / 2;
    root.add(slotBox(this, cx, y + 52, 60, seen ? tInfo.color : COLOR.borderSoft, seen && def.rarity >= 2));
    const icon = this.add.image(cx, y + 52, def.icon).setDisplaySize(42, 42);
    if (!seen) icon.setTint(0x090a0d).setAlpha(0.55);
    root.add(icon);

    const nameObj = cardTitle(this, cx, y + 102, seen ? def.name : '???', 16, seen ? tInfo.css : COLOR.dim).setOrigin(0.5);
    if (nameObj.width > CARD_W - 18) nameObj.setScale((CARD_W - 18) / nameObj.width);
    root.add(nameObj);
    root.add(label(this, cx, y + 128, seen ? `${tInfo.name}道具 · 累计 ×${count}` : '局内获得后收录', 12, seen ? COLOR.dim : '#585c68').setOrigin(0.5));

    if (seen) {
      const z = this.add.zone(x, y, CARD_W, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.openItemDetail(def, count));
      root.add(z);
    }
  }

  private renderEnemyCard(root: Phaser.GameObjects.Container, def: EnemyDef, idx: number, kills: number): void {
    const [x, y] = this.cardPos(idx);
    const seen = kills > 0;
    const accent = def.boss ? 0xff4c42 : def.elite ? 0xffb238 : 0x74d6ff;
    const g = this.add.graphics();
    drawChamferPlate(g, x, y, CARD_W, CARD_H, {
      fill: seen ? COLOR.panel : COLOR.panelDeep,
      border: seen ? accent : COLOR.borderSoft,
      borderWidth: seen ? 2 : 1.4,
      accentTop: seen ? accent : undefined,
      headerH: 0,
      cutBig: 8,
      cutSmall: 3,
      inkWidth: 2.6,
    });
    root.add(g);

    const cx = x + CARD_W / 2;
    root.add(slotBox(this, cx, y + 52, 64, seen ? accent : COLOR.borderSoft, seen && (!!def.boss || !!def.elite)));
    const img = this.add.image(cx, y + 52, def.texture);
    img.setScale(Math.min(48 / Math.max(1, img.width), 48 / Math.max(1, img.height)));
    if (!seen) img.setTint(0x090a0d).setAlpha(0.55);
    root.add(img);

    root.add(cardTitle(this, cx, y + 102, seen ? def.name : '???', 16, seen ? COLOR.text : COLOR.dim).setOrigin(0.5));
    const roleTag = def.boss ? '最终 Boss' : def.elite ? '精英' : '普通虫敌';
    root.add(label(this, cx, y + 128, seen ? `${roleTag} · 击败 ${kills}` : '击败后解锁记录', 12, seen ? COLOR.goldText : '#585c68').setOrigin(0.5));

    if (seen) {
      const z = this.add.zone(x, y, CARD_W, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.openEnemyDetail(def, kills));
      root.add(z);
    }
  }

  private openDetail(w: number, h: number, accent: number, build: (c: Phaser.GameObjects.Container, x: number, y: number) => void): void {
    this.closePopup();
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.74).setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closePopup());
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    const blocker = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    c.add([dim, panel(this, x, y, w, h, accent, COLOR.panel, 2, accent), blocker]);
    build(c, x, y);
    c.add(createButton(this, x + w / 2, y + h - 42, '关闭', () => this.closePopup(), { width: 164, height: 46, fontSize: 19, primary: false }));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 110 });
    this.popup = c;
  }

  private openWeaponDetail(def: WeaponDef, bestTier: number): void {
    const tier = TIERS[bestTier];
    this.openDetail(460, 420, tier.color, (c, x, y) => {
      const cx = x + 230;
      c.add(slotBox(this, cx, y + 66, 90, tier.color, bestTier >= 2, bestTier));
      const img = this.add.image(cx, y + 63, weaponTex(def.icon, bestTier, true));
      img.setScale(68 / Math.max(img.width, img.height));
      c.add(img);
      c.add(cardTitle(this, cx, y + 128, def.name, 24, tier.css).setOrigin(0.5));
      c.add(label(this, cx, y + 154, `${weaponTypeLine(def, bestTier)} · 历史最高 ${tier.name}`, 14, COLOR.dim).setOrigin(0.5));
      const pills = def.classes.map((cls) => {
        const ts = CLASS_STYLE[cls];
        return pill(this, 0, y + 180, CLASS_LABEL[cls], ts.bg, ts.border, ts.text, 12, 10, 22);
      });
      const total = pills.reduce((acc, p) => acc + p.width, 0) + 8 * Math.max(0, pills.length - 1);
      let px = cx - total / 2;
      for (const p of pills) {
        p.x = px + p.width / 2;
        c.add(p);
        px += p.width + 8;
      }
      c.add(divider(this, x + 28, y + 202, 404, tier.color, 0.5));
      layoutLines(this, c, cx, y + 216, weaponLines(def, bestTier, BASE_STATS, ZERO_MODS), 15, 404, 4);
    });
  }

  private openItemDetail(def: ItemDef, count: number): void {
    const tier = TIERS[def.rarity];
    this.openDetail(420, 366, tier.color, (c, x, y) => {
      const cx = x + 210;
      c.add(slotBox(this, cx, y + 66, 90, tier.color, def.rarity >= 2));
      c.add(this.add.image(cx, y + 66, def.icon).setDisplaySize(64, 64));
      c.add(cardTitle(this, cx, y + 130, def.name, 24, tier.css).setOrigin(0.5));
      c.add(label(this, cx, y + 156, `${tier.name}道具 · 生涯累计获得 ×${count}`, 14, COLOR.dim).setOrigin(0.5));
      c.add(divider(this, x + 28, y + 178, 364, tier.color, 0.5));
      layoutLines(this, c, cx, y + 194, itemLines(def), 16, 364, 4);
    });
  }

  private openEnemyDetail(def: EnemyDef, kills: number): void {
    const accent = def.boss ? 0xff4c42 : def.elite ? 0xffb238 : 0x74d6ff;
    this.openDetail(430, 366, accent, (c, x, y) => {
      const cx = x + 215;
      c.add(slotBox(this, cx, y + 70, 96, accent, !!def.boss || !!def.elite));
      const img = this.add.image(cx, y + 70, def.texture);
      img.setScale(Math.min(72 / Math.max(1, img.width), 72 / Math.max(1, img.height)));
      c.add(img);
      c.add(cardTitle(this, cx, y + 136, def.name, 24, COLOR.text).setOrigin(0.5));
      c.add(label(this, cx, y + 162, `生涯累计击败 ${kills} 只`, 15, COLOR.goldText, true).setOrigin(0.5));
      c.add(divider(this, x + 28, y + 184, 374, accent, 0.5));
      layoutLines(
        this,
        c,
        cx,
        y + 200,
        [
          { text: `基础生命 ${def.hp} · 基础伤害 ${def.damage} · 移速 ${def.speed}`, color: COLOR.text },
          { text: `花蜜掉落 ${def.nectar[0]}~${def.nectar[1]}${def.elite ? ' · 必掉宝箱' : ''}`, color: COLOR.goldText },
          { text: BEHAVIOR_DESC[def.behavior] ?? '后院入侵者。', color: COLOR.special },
        ],
        15,
        374,
        6,
      );
    });
  }

  private closePopup(): void {
    this.popup?.destroy();
    this.popup = null;
  }
}
