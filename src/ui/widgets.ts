import Phaser from 'phaser';
import { DISPLAY_FONT, FONT_FAMILY, NUM_FONT, fontPx } from '../config';
import { growthBonus, weaponDamage } from '../core/combat';
import type { OwnedWeapon } from '../core/RunState';
import { attackInterval, BASE_STATS, formatStat, formatStatDelta, STAT_KEYS, STAT_META, type Stats } from '../core/stats';
import { MOD_LABEL, type ItemDef, type Mods } from '../data/items';
import { KIND_LABEL, TIERS, type WeaponDef, type WeaponTag } from '../data/weapons';
import { chamferPoints } from './Button';

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

/** 武器套装标签配色（深炭底 + 鲜明描边） */
export const TAG_STYLE: Record<WeaponTag, { bg: number; border: number; text: string }> = {
  甲角: { bg: 0x342014, border: 0xc87a38, text: '#ffca88' },
  尖刺: { bg: 0x381820, border: 0xd05264, text: '#ff9ea8' },
  投掷: { bg: 0x162a3a, border: 0x4ea0d4, text: '#9ad8ff' },
  腺体: { bg: 0x1b3014, border: 0x68be3a, text: '#baf488' },
  共生: { bg: 0x143024, border: 0x40b07a, text: '#96f0c0' },
  火焰: { bg: 0x3c1c0c, border: 0xee7828, text: '#ffae6e' },
  电: { bg: 0x182442, border: 0x6296f8, text: '#b2d0ff' },
  机关: { bg: 0x2c2616, border: 0xb2944c, text: '#ecd492' },
  蜂蜜: { bg: 0x362a10, border: 0xe2ae28, text: '#ffe076' },
};

const STAT_DOT: Record<keyof Stats, number> = {
  maxHp: 0xe84848,
  regen: 0x5ee064,
  lifesteal: 0xd44668,
  damagePct: 0xf4a836,
  melee: 0xe47e38,
  ranged: 0x5cb6f0,
  toxin: 0x90dc3c,
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
  return scene.add.text(x, y, str, {
    fontFamily: DISPLAY_FONT,
    fontSize: fontPx(size),
    fontStyle: 'bold',
    color,
    stroke,
    strokeThickness: Math.max(4, Math.round(size * 0.18)),
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

/**
 * 土豆兄弟风手绘黑墨面板：
 * 硬朗纯黑偏移投影 + 3px 黑墨外轮廓 + 哑光炭黑/品质微晕底板 + 可选顶部斜纹版画头带
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
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const r = Math.min(8, Math.round(Math.min(w, h) * 0.08));

  // 1. 纯黑硬偏移漫画投影
  g.fillStyle(COLOR.ink, 0.92);
  g.fillRoundedRect(x + 4, y + 5, w, h, r);

  // 2. 主体哑光底色
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);

  // 3. 可选品质顶部染色洗层 + 45° 版画斜排线（增加作画细节，不显单调）
  if (accentTop !== undefined) {
    const bandH = Math.min(72, Math.round(h * 0.25));
    g.fillStyle(accentTop, 0.13);
    g.fillRoundedRect(x + 2, y + 2, w - 4, bandH, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
    g.lineStyle(2, 0xffffff, 0.045);
    for (let sx = x + 12; sx < x + w - 8; sx += 12) {
      const topX = Math.min(x + w - 4, sx + 16);
      const botX = Math.max(x + 4, sx - 12);
      g.beginPath();
      g.moveTo(topX, y + 5);
      g.lineTo(botX, y + Math.min(bandH - 4, 34));
      g.strokePath();
    }
    g.fillStyle(accentTop, 0.88);
    g.fillRect(x + 2, y + 2, w - 4, 4);
  }

  // 4. 极轻顶部暗角高光（保持哑光质感）
  g.lineStyle(1, 0xffffff, 0.06);
  g.beginPath();
  g.moveTo(x + r, y + 2);
  g.lineTo(x + w - r, y + 2);
  g.strokePath();

  // 5. 内边框 + 外重黑墨描边
  if (border !== COLOR.ink) {
    g.lineStyle(borderWidth, border, 0.92);
    g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(2, r - 1));
  }
  g.lineStyle(3, COLOR.ink, 1);
  g.strokeRoundedRect(x, y, w, h, r);
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
  if (def.melee?.style === 'sweep') parts.push('扇形横扫');
  if (def.critMultiplier !== 2) parts.push(`暴击 ×${def.critMultiplier}`);
  if (def.summon?.type === 'aphid') parts.push(`召唤 ${(def.summon.counts?.[tier] ?? 2) + mods.summonCount} 只蚜虫`);
  if (def.summon?.type === 'moth') parts.push(`${(def.summon.counts?.[tier] ?? 2) + mods.summonCount} 只飞蛾绕身旋转，碰到怪造成伤害`);
  if (def.summon?.type === 'web') parts.push(`减速 ${Math.round((def.summon.slow ?? 0) * 100)}%，最多 ${def.summon.max} 张`);
  const dev = def.device;
  if (dev?.type === 'mine') parts.push(`埋在脚下，怪踩到爆炸（半径 ${Math.round((dev.radius ?? 70) * (1 + mods.mineRadiusPct))}），最多 ${dev.max + mods.deployCap} 颗`);
  if (dev?.type === 'turret') parts.push(`每 ${dev.placeEvery} 秒放一座炮台自动射击，最多 ${dev.max + mods.deployCap} 座`);
  const hit = def.onHit;
  if (hit?.burn) parts.push('点燃命中的怪');
  if (hit?.freeze) parts.push(`每次命中叠 ${hit.freeze} 层冰（每层减速 15%），3 层冻住`);
  if (hit?.vulnerable) parts.push('命中让怪易伤 3 秒');
  if (hit?.heal) parts.push(`命中时 ${Math.round(hit.heal * 100)}% 概率回 1 血`);
  if (def.lowHpHaste) parts.push(`生命低于 50% 时攻速 +${Math.round(def.lowHpHaste * 100)}%`);
  if (hit?.nectarOnKill) parts.push(`击杀时 ${Math.round(hit.nectarOnKill * 100)}% 概率多掉 1 颗花蜜`);
  if (def.growth) {
    const grown = growthBonus(def, owned);
    parts.push(`本局每击杀 ${def.growth.kills} 只，伤害永久 +1${grown > 0 ? `（已 +${grown}）` : ''}`);
  }
  return parts.join('，');
}

/** 武器说明：按当前属性算出的实际数值 */
export function weaponLines(def: WeaponDef, tier: number, stats: Stats, mods: Mods, owned?: OwnedWeapon | null): Line[] {
  let dmg = weaponDamage(def, tier, stats, mods, owned);
  if (def.summon) dmg *= 1 + mods.summonDamagePct;
  const scaling = Object.entries(def.scaling)
    .map(([k, c]) => `${STAT_META[k as keyof Stats].label}×${Math.round((c as number) * 100)}%`)
    .join(' ');
  const isDevice = !!def.device;
  const interval = isDevice
    ? (def.cooldown * TIERS[tier].cooldown) / (def.device!.type === 'turret' ? Math.max(0.2, 1 + mods.turretSpeedPct) : 1)
    : attackInterval(def.cooldown * TIERS[tier].cooldown, stats);
  const range = def.range + (def.kind === 'melee' ? stats.range * 0.5 : def.summon || isDevice ? 0 : stats.range);
  const dmgLabel =
    def.summon?.type === 'web' ? `每秒伤害 ${Math.round(dmg)}` : def.summon ? `每只伤害 ${Math.round(dmg)}` : def.beam ? `每次伤害 ${Math.round(dmg)}` : `伤害 ${Math.round(dmg)}`;
  let timing: string;
  if (def.summon?.type === 'aphid' || def.summon?.type === 'moth') timing = `间隔 ${interval.toFixed(2)} 秒`;
  else if (def.device?.type === 'mine') timing = `每 ${interval.toFixed(1)} 秒埋一颗`;
  else timing = `间隔 ${interval.toFixed(2)} 秒 · 射程 ${Math.round(range)}`;
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

/** 右侧土豆兄弟风格属性面板：暗炭黑框 + 斑马底纹 + 鲜明色标 */
export function statsPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, stats: Stats): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  c.add(panel(scene, x, y, w, h, COLOR.border, COLOR.panel, 2));
  c.add(displayLabel(scene, x + w / 2, y + 23, '属性', 21, COLOR.text).setOrigin(0.5));
  c.add(divider(scene, x + 16, y + 42, w - 32, COLOR.border, 0.7));

  const g = scene.add.graphics();
  const topY = y + 48;
  const rowH = (h - 54) / STAT_KEYS.length;

  STAT_KEYS.forEach((k, i) => {
    const ry = topY + i * rowH;
    if (i % 2 === 0) {
      g.fillStyle(0xffffff, 0.03);
      g.fillRect(x + 6, ry - 1, w - 12, rowH - 1);
    }
    const dotY = ry + rowH * 0.44;
    g.fillStyle(COLOR.ink, 1);
    g.fillRect(x + 14, dotY - 4, 8, 8);
    g.fillStyle(STAT_DOT[k], 1);
    g.fillRect(x + 15.5, dotY - 2.5, 5, 5);

    const v = stats[k];
    const base = BASE_STATS[k];
    const color = v > base + 1e-6 ? COLOR.good : v < base - 1e-6 ? COLOR.bad : COLOR.text;
    c.add(label(scene, x + 28, ry + 1, STAT_META[k].label, 16, COLOR.dim));
    c.add(label(scene, x + w - 14, ry + 1, formatStat(k, v), 16, color, true).setOrigin(1, 0));
  });

  c.addAt(g, 1);
  return c;
}

/** 土豆兄弟风格方正凹槽（黑墨重描边 + 品质微底色 + 硬投影 + 可选武器品阶菱点） */
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
  const r = Math.min(7, Math.round(size * 0.1));

  // 硬投影
  g.fillStyle(COLOR.ink, 0.9);
  g.fillRoundedRect(x + 3, y + 4, size, size, r);

  if (glow || (tier !== undefined && tier >= 2)) {
    g.lineStyle(3, border, glow ? 0.58 : 0.36);
    g.strokeRoundedRect(x - 3, y - 3, size + 6, size + 6, r + 2);
  }
  // 暗炭底 + 随品阶递增的品质微染底
  const fillAlpha = tier !== undefined ? 0.14 + tier * 0.06 : 0.14;
  g.fillStyle(COLOR.panelDeep, 1);
  g.fillRoundedRect(x, y, size, size, r);
  g.fillStyle(border, fillAlpha);
  g.fillRoundedRect(x + 2, y + 2, size - 4, size - 4, Math.max(2, r - 2));

  // 内品质描边 + 外纯黑墨线
  g.lineStyle(tier !== undefined && tier >= 2 ? 2.4 : 2, border, 0.95);
  g.strokeRoundedRect(x + 1.5, y + 1.5, size - 3, size - 3, Math.max(2, r - 1));
  g.lineStyle(2.8, COLOR.ink, 1);
  g.strokeRoundedRect(x, y, size, size, r);

  // 武器品阶指示点（左下角 1~4 颗黑边品质晶块，一眼分辨等级）
  if (tier !== undefined && size >= 44) {
    const count = Math.max(1, Math.min(4, tier + 1));
    const step = 7;
    const py = y + size - 7;
    for (let k = 0; k < count; k++) {
      const px = x + 8 + k * step;
      g.fillStyle(COLOR.ink, 1);
      g.fillRect(px - 3, py - 3, 6, 6);
      g.fillStyle(border, 1);
      g.fillRect(px - 2, py - 2, 4, 4);
    }
  }
  return g;
}
