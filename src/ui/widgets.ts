import Phaser from 'phaser';
import { DISPLAY_FONT, FONT_FAMILY, NUM_FONT, fontPx } from '../config';
import { effectiveRange, growthBonus, rangeOverflowBonus, weaponDamage } from '../core/combat';
import type { OwnedWeapon } from '../core/RunState';
import { attackInterval, BASE_STATS, formatStat, formatStatDelta, STAT_META, type Stats } from '../core/stats';
import { MOD_LABEL, type ItemDef, type Mods } from '../data/items';
import { CLASS_LABEL, KIND_LABEL, TIERS, tierOf, type WeaponClass, type WeaponDef } from '../data/weapons';
import { chamferPoints, fillPoly, insetPoints, strokePoly, type Pt } from './Button';

/** 土豆兄弟风格（Brotato）色板：哑光炭黑石板 + 纯黑重墨描边 + 骨白高对比字 + 鲜明绿红数值 */
export const COLOR = {
  bg: 0x131418,
  panel: 0x202127,
  panelDeep: 0x16171b,
  panelHi: 0x2c2e36,
  ink: 0x050507,
  border: 0x4b4e5a,
  borderSoft: 0x343640,
  gold: 0xf0b238,
  text: '#f2f1ec',
  dim: '#9c9da6',
  good: '#5de862',
  bad: '#ff5d57',
  goldText: '#ffd44c',
  special: '#74d6ff',
};

/** 17 个 Weapon Class 的配色（深炭底 + 鲜明描边） */
export const CLASS_STYLE: Record<WeaponClass, { bg: number; border: number; text: string }> = {
  Blade: { bg: 0x381820, border: 0xd05264, text: '#ff9ea8' },
  Blunt: { bg: 0x342014, border: 0xc87a38, text: '#ffca88' },
  Elemental: { bg: 0x3c1c0c, border: 0xee7828, text: '#ffae6e' },
  Ethereal: { bg: 0x182a30, border: 0x50c8c0, text: '#9cf0e8' },
  Explosive: { bg: 0x382c10, border: 0xe0b030, text: '#ffe08a' },
  Gun: { bg: 0x2a241a, border: 0xd8a848, text: '#ffe296' },
  Heavy: { bg: 0x2a2c32, border: 0x9aa4b8, text: '#d0d8e8' },
  Legendary: { bg: 0x2e1838, border: 0xb066e8, text: '#d8a8ff' },
  Medical: { bg: 0x143024, border: 0x40b07a, text: '#96f0c0' },
  Medieval: { bg: 0x1a2238, border: 0x6a92d8, text: '#b8ccff' },
  Musical: { bg: 0x34182c, border: 0xd068a8, text: '#ffb0d8' },
  Naval: { bg: 0x142c34, border: 0x48a8c0, text: '#9ce0f0' },
  Precise: { bg: 0x361c18, border: 0xe07848, text: '#ffb08a' },
  Primitive: { bg: 0x1b3014, border: 0x68be3a, text: '#baf488' },
  Support: { bg: 0x14302a, border: 0x50b890, text: '#a0f0d0' },
  Tool: { bg: 0x2c2616, border: 0xb2944c, text: '#ecd492' },
  Unarmed: { bg: 0x302824, border: 0xc89060, text: '#f0c8a0' },
};

const STAT_DOT: Record<keyof Stats, number> = {
  maxHp: 0xe84848,
  regen: 0x5ee064,
  lifesteal: 0xd44668,
  damagePct: 0xf4a836,
  melee: 0xe47e38,
  ranged: 0x5cb6f0,
  toxin: 0x90dc3c,
  elemental: 0xff9a3c,
  curse: 0xb06cff,
  attackSpeedPct: 0xf4d84c,
  critChance: 0xf27e46,
  range: 0x7ac0e8,
  armor: 0xb29064,
  dodge: 0x8ad8f8,
  speedPct: 0x76e088,
  luck: 0xf0c238,
  harvest: 0xffc63a,
  pickupPct: 0xa492e8,
  engineering: 0xc4a464,
};

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color = COLOR.text,
  bold = false,
  wrapWidth = 0,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, {
    fontFamily: FONT_FAMILY,
    fontSize: fontPx(size),
    fontStyle: bold ? 'bold' : 'normal',
    color,
    align: 'center',
    wordWrap: wrapWidth > 0 ? { width: wrapWidth, useAdvancedWrap: true } : undefined,
  });
}

/** 卡片/面板小标题（粗体清透 + 轻硬投影，不用重黑描边糊住小号汉字） */
export function cardTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color = COLOR.text,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, {
    fontFamily: DISPLAY_FONT,
    fontSize: fontPx(size),
    fontStyle: 'bold',
    color,
    shadow: { offsetX: 1, offsetY: 2, color: '#050507', blur: 0, fill: true, stroke: false },
  });
}

/** 土豆兄弟风格粗体墨线标题字（重黑外轮廓 + 硬投影，零模糊感） */
export function displayLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color = COLOR.text,
  stroke = '#050507',
): Phaser.GameObjects.Text {
  const thickness = size >= 28 ? Math.round(size * 0.17) : Math.max(2, Math.round(size * 0.12));
  return scene.add.text(x, y, str, {
    fontFamily: DISPLAY_FONT,
    fontSize: fontPx(size),
    fontStyle: 'bold',
    color,
    stroke,
    strokeThickness: thickness,
    shadow: { offsetX: 2, offsetY: 3, color: '#050507', blur: 0, fill: true, stroke: true },
  });
}

/** 粗体纯数字/短徽标（使用压缩无衬线字体，更有 PC 独立游戏硬朗数字感） */
export function numLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color = COLOR.text,
  stroke = '#050507',
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, {
    fontFamily: NUM_FONT,
    fontSize: fontPx(size),
    fontStyle: 'bold',
    color,
    stroke,
    strokeThickness: Math.max(4, Math.round(size * 0.18)),
    shadow: { offsetX: 2, offsetY: 3, color: '#050507', blur: 0, fill: true, stroke: true },
  });
}

export interface ChamferPlateOpts {
  fill?: number;
  fillAlpha?: number;
  border?: number;
  borderWidth?: number;
  borderAlpha?: number;
  accentTop?: number;
  headerH?: number;
  bevel?: boolean;
  cornerTicks?: boolean;
  shadowX?: number;
  shadowY?: number;
  cutBig?: number;
  cutSmall?: number;
  inkWidth?: number;
}

/** 绘制硬核非对称切角面板（供主面板、卡片、弹框、选人框共用） */
export function drawChamferPlate(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: ChamferPlateOpts = {},
): Pt[] {
  const fill = opts.fill ?? COLOR.panel;
  const fillAlpha = opts.fillAlpha ?? 1;
  const border = opts.border ?? COLOR.border;
  const borderWidth = opts.borderWidth ?? 2;
  const borderAlpha = opts.borderAlpha ?? 0.92;
  const sx = opts.shadowX ?? 4;
  const sy = opts.shadowY ?? 5;
  const cBig = opts.cutBig ?? Math.min(11, Math.max(5, Math.round(Math.min(w, h) * 0.085)));
  const cSmall = opts.cutSmall ?? Math.max(3, Math.round(cBig * 0.45));
  const pts = chamferPoints(x, y, w, h, cBig, cSmall, cBig, cSmall);

  // 1. 纯黑硬偏移漫画投影
  if (sx !== 0 || sy !== 0) {
    fillPoly(g, chamferPoints(x + sx, y + sy, w, h, cBig, cSmall, cBig, cSmall), COLOR.ink, 0.92);
  }

  // 2. 主体哑光底色
  fillPoly(g, pts, fill, fillAlpha);

  // 3. 可选品质顶部染色洗层 + 45° 版画斜排线（headerH = 0 仅保留顶部细彩条）
  if (opts.accentTop !== undefined) {
    const bandH = opts.headerH ?? Math.min(72, Math.round(h * 0.25));
    if (bandH > 0) {
      const topPts: Pt[] = [
        { x: pts[0].x + 1, y: y + 2 },
        { x: pts[1].x - 1, y: y + 2 },
        { x: x + w - 2, y: Math.min(y + bandH, pts[2].y + 1) },
        { x: x + w - 2, y: y + bandH },
        { x: x + 2, y: y + bandH },
        { x: x + 2, y: Math.min(y + bandH, pts[7].y + 1) },
      ];
      fillPoly(g, topPts, opts.accentTop, 0.13);
      g.lineStyle(2, 0xffffff, 0.045);
      for (let hx = x + cBig + 6; hx < x + w - 10; hx += 12) {
        const topX = Math.min(pts[1].x - 4, hx + 16);
        const botX = Math.max(x + 4, hx - 12);
        g.beginPath();
        g.moveTo(topX, y + 5);
        g.lineTo(botX, y + Math.min(bandH - 4, 34));
        g.strokePath();
      }
      g.lineStyle(1.5, COLOR.ink, 0.48);
      g.beginPath();
      g.moveTo(x + 3, y + bandH);
      g.lineTo(x + w - 3, y + bandH);
      g.strokePath();
    }
    fillPoly(
      g,
      [
        { x: pts[0].x + 1, y: y + 2 },
        { x: pts[1].x - 1, y: y + 2 },
        { x: pts[1].x + 1, y: y + 6 },
        { x: pts[0].x - 1, y: y + 6 },
      ],
      opts.accentTop,
      0.92,
    );
  }

  // 4. 立体倒角棱线：左上亮棱 + 右下暗唇（营造甲壳/金属铭牌厚度）
  if (opts.bevel !== false) {
    g.lineStyle(1.4, 0xffffff, 0.11);
    g.beginPath();
    g.moveTo(pts[6].x + 2, pts[6].y - 2);
    g.lineTo(pts[7].x + 2, pts[7].y + 1);
    g.lineTo(pts[0].x + 1, pts[0].y + 2);
    g.lineTo(pts[1].x - 1, pts[1].y + 2);
    g.strokePath();

    g.lineStyle(2, 0x000000, 0.34);
    g.beginPath();
    g.moveTo(pts[2].x - 2, pts[2].y + 2);
    g.lineTo(pts[3].x - 2, pts[3].y - 1);
    g.lineTo(pts[4].x - 1, pts[4].y - 2);
    g.lineTo(pts[5].x + 1, pts[5].y - 2);
    g.strokePath();
  }

  // 5. 大尺寸面板边角机械卡扣刻度
  if (opts.cornerTicks && w >= 160 && h >= 110) {
    g.lineStyle(1.8, border, 0.42);
    g.beginPath();
    g.moveTo(x + w - cSmall - 16, y + 6);
    g.lineTo(x + w - cSmall - 2, y + 6);
    g.lineTo(x + w - 6, y + cSmall + 2);
    g.lineTo(x + w - 6, y + cSmall + 14);
    g.moveTo(x + cSmall + 16, y + h - 6);
    g.lineTo(x + cSmall + 2, y + h - 6);
    g.lineTo(x + 6, y + h - cSmall - 2);
    g.lineTo(x + 6, y + h - cSmall - 14);
    g.strokePath();
  }

  // 6. 内边框 + 外重黑墨描边
  if (border !== COLOR.ink && borderWidth > 0) {
    strokePoly(g, insetPoints(pts, 1.8), borderWidth, border, borderAlpha);
  }
  strokePoly(g, pts, opts.inkWidth ?? 3, COLOR.ink, 1);
  return pts;
}

/**
 * 土豆兄弟风手绘黑墨面板：
 * 硬朗纯黑偏移投影 + 3px 黑墨外轮廓 + 非对称切角哑光底板 + 立体棱线 + 可选顶部斜纹版画头带
 */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  border: number = COLOR.border,
  fill: number = COLOR.panel,
  borderWidth = 2,
  accentTop?: number,
  headerH?: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawChamferPlate(g, x, y, w, h, {
    fill,
    border,
    borderWidth,
    accentTop,
    headerH,
    cornerTicks: w >= 200 && h >= 160,
  });
  return g;
}

/** 保持兼容导出（不再使用小程序角花） */
export function addCornerFiligree(): Phaser.GameObjects.Image[] {
  return [];
}

/** 利落分隔线 */
export function divider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  color = COLOR.border,
  alpha = 0.7,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(2, COLOR.ink, 0.75);
  g.beginPath();
  g.moveTo(x, y + 1);
  g.lineTo(x + w, y + 1);
  g.strokePath();
  g.lineStyle(1.5, color, alpha);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.strokePath();
  return g;
}

/** 利落手绘斜切角徽标（非对称切角 + 硬黑描边 + 偏移投影） */
export function pill(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  text: string,
  bgColor: number,
  borderColor: number,
  textColor: string,
  fontSize = 13,
  padX = 11,
  height = 24,
): Phaser.GameObjects.Container {
  const t = label(scene, 0, 0, text, fontSize, textColor, true).setOrigin(0.5);
  const w = Math.max(height + 12, Math.ceil(t.width + padX * 2));
  const big = Math.min(7, Math.round(height * 0.28));
  const small = Math.min(3, Math.round(height * 0.12));
  const g = scene.add.graphics();
  const trace = (pts: { x: number; y: number }[]) => {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
  };
  g.fillStyle(COLOR.ink, 0.9);
  trace(chamferPoints(-w / 2 + 2, -height / 2 + 2.5, w, height, big, small, big, small));
  g.fillPath();
  g.fillStyle(bgColor, 1);
  trace(chamferPoints(-w / 2, -height / 2, w, height, big, small, big, small));
  g.fillPath();
  g.lineStyle(1.4, borderColor, 0.95);
  trace(chamferPoints(-w / 2 + 1.5, -height / 2 + 1.5, w - 3, height - 3, Math.max(2, big - 1), small, Math.max(2, big - 1), small));
  g.strokePath();
  g.lineStyle(2, COLOR.ink, 1);
  trace(chamferPoints(-w / 2, -height / 2, w, height, big, small, big, small));
  g.strokePath();
  return scene.add.container(cx, cy, [g, t]).setSize(w, height);
}

/** 土豆兄弟风暗调磨砂背景（深炭黑 + 平铺颗粒噪点 + 干净顶栏） */
export function warmBackdrop(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLOR.bg, 1);
  g.fillRect(0, 0, w, h);

  // 哑光粗粒纸面平铺，营造实物质感
  scene.add.tileSprite(0, 0, w, h, 'ui-grunge-tile').setOrigin(0).setAlpha(0.95);

  const over = scene.add.graphics();
  // 中央极轻微聚光
  over.fillStyle(0xffffff, 0.018);
  over.fillEllipse(w * 0.45, h * 0.45, w * 0.85, h * 0.75);
  // 顶部栏纯黑分割线
  over.fillStyle(0x0c0d10, 0.88);
  over.fillRect(0, 0, w, 70);
  over.lineStyle(3, COLOR.ink, 1);
  over.beginPath();
  over.moveTo(0, 70);
  over.lineTo(w, 70);
  over.strokePath();
  over.lineStyle(1, 0xffffff, 0.08);
  over.beginPath();
  over.moveTo(0, 68);
  over.lineTo(w, 68);
  over.strokePath();

  return over;
}

export interface Line {
  text: string;
  color: string;
}

/** 道具效果描述：属性（正面绿色、负面红色）、规则加成、触发效果 */
export function itemLines(def: ItemDef): Line[] {
  const lines: Line[] = (Object.entries(def.stats) as [keyof Stats, number][]).map(([k, v]) => ({
    text: `${STAT_META[k].label} ${formatStatDelta(k, v)}`,
    color: v >= 0 ? COLOR.good : COLOR.bad,
  }));
  for (const [k, v] of Object.entries(def.mods ?? {}) as [keyof Mods, number][]) {
    const bad = k === 'maxHpPct' ? v < 0 : k === 'pricePct' ? v > 0 : v < 0;
    lines.push({ text: MOD_LABEL[k](v), color: bad ? COLOR.bad : COLOR.good });
  }
  if (def.desc) lines.push({ text: def.desc.replace(/ /g, ''), color: COLOR.special });
  if (def.unique) lines.push({ text: '✦ 唯一道具', color: COLOR.goldText });
  return lines;
}

/** 武器特性的一句话说明 */
function weaponSpecial(def: WeaponDef, tier: number, mods: Mods, owned?: OwnedWeapon | null): string {
  const parts: string[] = [];
  const p = def.projectile;
  if (p?.count && p.count > 1) parts.push(`一次 ${p.count} 发`);
  if (p?.explode) parts.push(`命中爆炸（半径 ${p.explode}）`);
  if (p?.returning) parts.push(mods.bounces > 0 ? `飞出后飞回，来回 ${1 + mods.bounces} 趟，可穿透` : '飞出后飞回，去程回程各打一次，可穿透');
  else if (p?.roll) parts.push('越滚越大，碾压沿途所有怪');
  else if (p && p.pierce > 0) parts.push(`穿透 ${p.pierce} 个`);
  if (p?.bounce) parts.push(`命中后弹向附近的怪，最多弹 ${p.bounce.times + mods.bounces} 次，每次伤害 −${Math.round(p.bounce.falloff * 100)}%`);
  if (p?.fade) parts.push('锥形喷火');
  if (p?.poison) parts.push(`命中叠 ${p.poison} 层毒`);
  if (p?.lob) parts.push(`落地留下 ${p.lob.cloudTime} 秒毒云`);
  if (def.beam) parts.push('持续照射最近的怪');
  if (def.chain) {
    const nofall = mods.chainNoFalloff > 0;
    parts.push(`链式闪电，在怪之间跳 ${def.chain.jumps + mods.chainJumps} 次${nofall ? '，伤害不衰减' : `，每跳伤害 −${Math.round(def.chain.falloff * 100)}%`}`);
  }
  const meleeLabel: Record<string, string> = {
    sweep: '扇形横扫',
    snap: '钳颚撕咬',
    bash: '盾击震荡',
    charge: '重角突刺',
    flurry: '高速连刺',
    pierce: '破甲穿刺',
  };
  if (def.melee && meleeLabel[def.melee.style]) parts.push(meleeLabel[def.melee.style]);
  const cm = tierOf(def, tier).critMultiplier;
  if (cm !== 2) parts.push(`暴击 ×${cm}`);
  if (def.summon?.type === 'aphid') parts.push(`召唤 ${(def.summon.counts?.[tier] ?? 2) + mods.summonCount} 只蚜虫`);
  if (def.summon?.type === 'moth') parts.push(`${(def.summon.counts?.[tier] ?? 2) + mods.summonCount} 只飞蛾绕身旋转，碰到怪造成伤害`);
  if (def.summon?.type === 'web') parts.push(`减速 ${Math.round((def.summon.slow ?? 0) * 100)}%，最多 ${def.summon.max} 张`);
  const dev = def.device;
  if (dev?.type === 'mine') parts.push(`埋在脚下，怪踩到爆炸（半径 ${Math.round((dev.radius ?? 70) * (1 + mods.mineRadiusPct))}），最多 ${dev.max + mods.deployCap} 颗`);
  if (dev?.type === 'turret') parts.push(`每 ${dev.placeEvery} 秒放一座炮台自动射击，最多 ${dev.max + mods.deployCap} 座`);
  const hit = def.onHit;
  if (hit?.burn) parts.push('点燃命中的怪');
  if (hit?.freeze) parts.push(`每次命中叠 ${hit.freeze} 层冰（每层减速 15%），3 层冻住`);
  if (hit?.poison) parts.push(`命中叠 ${hit.poison} 层毒`);
  if (hit?.slow) parts.push(`命中减速 ${Math.round(hit.slow * 100)}%`);
  if (hit?.vulnerable) parts.push('命中让怪易伤 3 秒');
  if (hit?.heal) parts.push(`命中时 ${Math.round(hit.heal * 100)}% 概率回 1 血`);
  if (def.lowHpHaste) parts.push(`生命低于 50% 时攻速 +${Math.round(def.lowHpHaste * 100)}%`);
  if (hit?.nectarOnKill) parts.push(`击杀时 ${Math.round(hit.nectarOnKill * 100)}% 概率多掉 1 颗花蜜`);
  if (def.growth) {
    const grown = growthBonus(def, owned);
    parts.push(`本局每击杀 ${def.growth.kills} 只，伤害永久 +1（上限 +40${grown > 0 ? `，已 +${grown}` : ''}）`);
  }
  if (def.special?.growthMaxHp) {
    const gained = Math.min(25, Math.floor(((owned?.kills ?? 0) / 20) * def.special.growthMaxHp));
    parts.push(`每击杀 20 只，最大生命 +1（上限 +25${gained > 0 ? `，已 +${gained}` : ''}）`);
  }
  if (def.special?.growthAttackSpeed) {
    const pctGained = Math.round(Math.min(0.6, Math.floor((owned?.kills ?? 0) / 12) * def.special.growthAttackSpeed) * 100);
    parts.push(`每击杀 12 只，攻速 +1%（上限 +60%${pctGained > 0 ? `，已 +${pctGained}%` : ''}）`);
  }
  return parts.join('，');
}

/** 武器说明：按当前属性算出的实际数值 */
export function weaponLines(def: WeaponDef, tier: number, stats: Stats, mods: Mods, owned?: OwnedWeapon | null): Line[] {
  let dmg = weaponDamage(def, tier, stats, mods, owned);
  if (def.summon) dmg *= 1 + mods.summonDamagePct;
  const t = tierOf(def, tier);
  const scaling = Object.entries(t.scaling)
    .map(([k, c]) => `${STAT_META[k as keyof Stats].label}×${Math.round((c as number) * 100)}%`)
    .join(' ');
  const isDevice = !!def.device;
  const interval = isDevice
    ? t.cooldown / (def.device!.type === 'turret' ? Math.max(0.2, 1 + mods.turretSpeedPct) : 1)
    : attackInterval(t.cooldown, stats);
  const range = effectiveRange(def, stats, tier);
  const overflow = rangeOverflowBonus(def, stats, tier);
  const dmgLabel =
    def.summon?.type === 'web' ? `每秒伤害 ${Math.round(dmg)}` : def.summon ? `每只伤害 ${Math.round(dmg)}` : def.beam ? `每次伤害 ${Math.round(dmg)}` : `伤害 ${Math.round(dmg)}`;
  let timing: string;
  if (def.summon?.type === 'aphid' || def.summon?.type === 'moth') timing = `间隔 ${interval.toFixed(2)} 秒`;
  else if (def.device?.type === 'mine') timing = `每 ${interval.toFixed(1)} 秒埋一颗`;
  else timing = `间隔 ${interval.toFixed(2)} 秒 · 射程 ${Math.round(range)}${overflow > 0 ? ` (+${Math.round(overflow * 100)}%伤)` : ''}`;
  const lines: Line[] = [
    { text: dmgLabel, color: COLOR.text },
    { text: scaling ? `加成 ${scaling}` : '加成 伤害%', color: COLOR.dim },
    { text: timing, color: COLOR.text },
  ];
  const special = weaponSpecial(def, tier, mods, owned);
  if (special) lines.push({ text: special, color: COLOR.special });
  return lines;
}

export function weaponTypeLine(def: WeaponDef, tier: number): string {
  return `${TIERS[tier].name} · ${KIND_LABEL[def.kind]}`;
}

export function classLine(def: WeaponDef): string {
  return def.classes.map((c) => CLASS_LABEL[c]).join(' / ');
}

/** 竖排放置几行说明文字 */
export function layoutLines(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  y: number,
  lines: Line[],
  size: number,
  wrapWidth: number,
  gap = 4,
  originX = 0.5,
): number {
  let cy = y;
  for (const l of lines) {
    const t = label(scene, cx, cy, l.text, size, l.color, false, wrapWidth)
      .setOrigin(originX, 0)
      .setAlign(originX === 0 ? 'left' : 'center');
    parent.add(t);
    cy += t.height + gap;
  }
  return cy - y;
}

const STAT_GROUPS: (keyof Stats)[][] = [
  ['maxHp', 'regen', 'lifesteal', 'armor', 'dodge'],
  ['damagePct', 'melee', 'ranged', 'toxin', 'elemental', 'curse', 'attackSpeedPct', 'critChance', 'range'],
  ['speedPct', 'luck', 'harvest', 'pickupPct', 'engineering'],
];

export interface StatsPanelHandle {
  container: Phaser.GameObjects.Container;
  /** 鼠标悬停卡片时实时预览属性增减 */
  preview: (deltas?: Partial<Stats>) => void;
  /** 升级/购买引起属性变化后脉冲高亮对应行 */
  pulse: (keys: (keyof Stats)[]) => void;
}

/** 创建支持悬停预览与变化脉冲的右侧属性面板（三段式分组 + 切角顶栏） */
export function createStatsPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  stats: Stats,
): StatsPanelHandle {
  const c = scene.add.container(0, 0);
  c.add(panel(scene, x, y, w, h, COLOR.border, COLOR.panel, 2));

  const hdr = scene.add.graphics();
  const cBig = Math.min(11, Math.max(5, Math.round(Math.min(w, h) * 0.085)));
  const cSmall = Math.max(3, Math.round(cBig * 0.45));
  fillPoly(
    hdr,
    [
      { x: x + cBig + 1, y: y + 2 },
      { x: x + w - cSmall - 1, y: y + 2 },
      { x: x + w - 2, y: y + cSmall + 1 },
      { x: x + w - 2, y: y + 40 },
      { x: x + 2, y: y + 40 },
      { x: x + 2, y: y + cBig + 1 },
    ],
    COLOR.panelDeep,
    0.78,
  );
  c.add(hdr);
  c.add(cardTitle(scene, x + w / 2, y + 21, '属性', 20, COLOR.text).setOrigin(0.5));
  c.add(divider(scene, x + 14, y + 40, w - 28, COLOR.border, 0.78));

  const g = scene.add.graphics();
  const totalStats = STAT_GROUPS.reduce((sum, grp) => sum + grp.length, 0);
  const groupGap = 7;
  const topY = y + 46;
  const rowH = (h - 52 - groupGap * (STAT_GROUPS.length - 1)) / totalStats;

  const rows = new Map<
    keyof Stats,
    {
      nameText: Phaser.GameObjects.Text;
      valText: Phaser.GameObjects.Text;
      previewText: Phaser.GameObjects.Text;
      flash: Phaser.GameObjects.Rectangle;
      baseVal: number;
    }
  >();

  let curY = topY;
  let rowIdx = 0;
  STAT_GROUPS.forEach((group, gi) => {
    if (gi > 0) {
      const sepY = curY + groupGap * 0.45;
      g.lineStyle(1, COLOR.borderSoft, 0.85);
      g.beginPath();
      g.moveTo(x + 14, sepY);
      g.lineTo(x + w - 14, sepY);
      g.strokePath();
      curY += groupGap;
    }
    for (const k of group) {
      const ry = curY;
      if (rowIdx % 2 === 0) {
        g.fillStyle(0xffffff, 0.024);
        g.fillRect(x + 6, ry - 0.5, w - 12, rowH - 1);
      }
      const dotY = ry + rowH * 0.46;
      g.fillStyle(COLOR.ink, 1);
      g.fillRect(x + 14, dotY - 4, 8, 8);
      g.fillStyle(STAT_DOT[k], 1);
      g.fillRect(x + 15.5, dotY - 2.5, 5, 5);

      const v = stats[k];
      const base = BASE_STATS[k];
      const changed = Math.abs(v - base) > 1e-6;
      const color = v > base + 1e-6 ? COLOR.good : v < base - 1e-6 ? COLOR.bad : '#717786';

      const flash = scene.add.rectangle(x + w / 2, ry + rowH * 0.46, w - 12, rowH, 0x5de862, 0).setOrigin(0.5);
      const nameText = label(scene, x + 27, ry + 0.5, STAT_META[k].label, 14.5, changed ? COLOR.text : '#8c909f', changed);
      const valText = label(scene, x + w - 14, ry + 0.5, formatStat(k, v), 14.5, color, changed).setOrigin(1, 0);
      const previewText = label(scene, x + w - 18, ry + 0.5, '', 13, COLOR.good, true).setOrigin(1, 0).setVisible(false);

      c.add([flash, nameText, previewText, valText]);
      rows.set(k, { nameText, valText, previewText, flash, baseVal: v });

      curY += rowH;
      rowIdx++;
    }
  });

  c.addAt(g, 2);

  const preview = (deltas?: Partial<Stats>) => {
    for (const [k, row] of rows) {
      const d = deltas?.[k] ?? 0;
      if (Math.abs(d) > 1e-6) {
        const col = d > 0 ? COLOR.good : COLOR.bad;
        row.previewText
          .setText(`(${formatStatDelta(k, d)})`)
          .setColor(col)
          .setPosition(row.valText.x - row.valText.displayWidth - 5, row.valText.y + 1)
          .setVisible(true);
        row.flash.setFillStyle(d > 0 ? 0x5de862 : 0xff5d57, 0.14);
        row.nameText.setColor('#ffffff');
      } else {
        row.previewText.setVisible(false);
        row.flash.setAlpha(0);
        const changed = Math.abs(row.baseVal - BASE_STATS[k]) > 1e-6;
        row.nameText.setColor(changed ? COLOR.text : '#8c909f');
      }
    }
  };

  const pulse = (keys: (keyof Stats)[]) => {
    for (const k of keys) {
      const row = rows.get(k);
      if (!row) continue;
      row.flash.setFillStyle(stats[k] >= BASE_STATS[k] ? 0x5de862 : 0xff5d57, 0.36);
      scene.tweens.add({ targets: row.flash, alpha: 0, duration: 550, ease: 'Quad.Out' });
      row.valText.setScale(1.24);
      scene.tweens.add({ targets: row.valText, scale: 1, duration: 360, ease: 'Back.Out' });
    }
  };

  return { container: c, preview, pulse };
}

/** 右侧土豆兄弟风格属性面板（兼容旧调用） */
export function statsPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, stats: Stats): Phaser.GameObjects.Container {
  return createStatsPanel(scene, x, y, w, h, stats).container;
}

/** 土豆兄弟风格切角凹槽（黑墨重描边 + 品质微底色 + 倒角高光 + 硬投影 + 可选武器品阶菱点） */
export function slotBox(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  size: number,
  border: number,
  glow = false,
  tier?: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const x = cx - size / 2;
  const y = cy - size / 2;
  const cBig = Math.min(8, Math.max(4, Math.round(size * 0.13)));
  const cSmall = Math.max(2, Math.round(cBig * 0.45));
  const pts = chamferPoints(x, y, size, size, cBig, cSmall, cBig, cSmall);

  // 硬投影
  fillPoly(g, chamferPoints(x + 3, y + 4, size, size, cBig, cSmall, cBig, cSmall), COLOR.ink, 0.9);

  if (glow || (tier !== undefined && tier >= 2)) {
    strokePoly(g, chamferPoints(x - 3, y - 3, size + 6, size + 6, cBig + 2, cSmall + 1, cBig + 2, cSmall + 1), 3, border, glow ? 0.62 : 0.36);
  }
  // 暗炭底 + 随品阶递增的品质微染底
  const fillAlpha = tier !== undefined ? 0.14 + tier * 0.06 : 0.14;
  fillPoly(g, pts, COLOR.panelDeep, 1);
  fillPoly(g, insetPoints(pts, 2), border, fillAlpha);

  // 内倒角亮棱线与底槽暗线
  g.lineStyle(1.3, 0xffffff, 0.16);
  g.beginPath();
  g.moveTo(pts[6].x + 2, pts[6].y - 2);
  g.lineTo(pts[7].x + 2, pts[7].y + 1);
  g.lineTo(pts[0].x + 1, pts[0].y + 2);
  g.lineTo(pts[1].x - 1, pts[1].y + 2);
  g.strokePath();

  g.lineStyle(1.8, 0x000000, 0.38);
  g.beginPath();
  g.moveTo(pts[2].x - 2, pts[2].y + 2);
  g.lineTo(pts[3].x - 2, pts[3].y - 1);
  g.lineTo(pts[4].x - 1, pts[4].y - 2);
  g.lineTo(pts[5].x + 1, pts[5].y - 2);
  g.strokePath();

  // 内品质描边 + 外纯黑墨线
  strokePoly(g, insetPoints(pts, 1.6), tier !== undefined && tier >= 2 ? 2.4 : 2, border, 0.95);
  strokePoly(g, pts, 2.8, COLOR.ink, 1);

  // 武器品阶指示点（左下角 1~4 颗黑边品质菱晶，一眼分辨等级）
  if (tier !== undefined && size >= 44) {
    const count = Math.max(1, Math.min(4, tier + 1));
    const step = 8;
    const py = y + size - 8;
    for (let k = 0; k < count; k++) {
      const px = x + 9 + k * step;
      const rOut = 3.8;
      const rIn = 2.4;
      fillPoly(
        g,
        [
          { x: px, y: py - rOut },
          { x: px + rOut, y: py },
          { x: px, y: py + rOut },
          { x: px - rOut, y: py },
        ],
        COLOR.ink,
        1,
      );
      fillPoly(
        g,
        [
          { x: px, y: py - rIn },
          { x: px + rIn, y: py },
          { x: px, y: py + rIn },
          { x: px - rIn, y: py },
        ],
        border,
        1,
      );
    }
  }
  return g;
}
