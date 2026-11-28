import { CAMERA_ZOOM, GAME_HEIGHT } from '../config';
import type { Mods } from '../data/items';
import { tierOf, type WeaponDef } from '../data/weapons';
import type { SlotBonus } from './legSynergy';
import type { OwnedWeapon } from './RunState';
import type { Stats } from './stats';

/** 武器极限射程上限：保证上下左右任意方向都不超过屏幕可见边界（扣掉角色腿尖挂点偏移） */
export const MAX_SCREEN_RANGE = Math.floor(GAME_HEIGHT / (2 * CAMERA_ZOOM)) - 38;

/** 长柄类近战（刚性长杆穿过手部握持，略长于手持短兵器） */
const POLE_MELEE_IDS = new Set(['spear', 'jousting-lance', 'trident', 'scythe', 'hiking-pole', 'stick']);

/** 软体/铁链/伸缩连结类远距近战（全程可见实体连杆连回爪尖） */
const FLEX_TETHER_MELEE_IDS = new Set(['whip', 'flail', 'anchor', 'quarterstaff', 'dex-troyer']);

export function isTetheredMelee(def: WeaponDef): boolean {
  return def.kind === 'melee' && (POLE_MELEE_IDS.has(def.id) || FLEX_TETHER_MELEE_IDS.has(def.id));
}

/** 武器在当前属性下的实际射程（对齐土豆兄弟：近战吃约半额射程加成且严格 1:1 对齐真实兵器触碰距离，远程保持全射程） */
export function effectiveRange(def: WeaponDef, stats: Stats, tier = 0, slotBonus?: SlotBonus | null): number {
  const base = tierOf(def, tier).range + (slotBonus?.range ?? 0);
  if (def.kind === 'melee') {
    if (FLEX_TETHER_MELEE_IDS.has(def.id)) {
      // 虫鞭 / 流星锤 / 铁锚 / 四节棍 / 爆雷钳：真实连杆长度（74~128px）
      return Math.max(74, Math.min(128, Math.round(base * 0.44 + stats.range * 0.28)));
    }
    if (POLE_MELEE_IDS.has(def.id)) {
      // 长柄枪/戟/镰/杖/树枝：真实刚性长杆长度（66~102px）
      return Math.max(66, Math.min(102, Math.round(base * 0.38 + stats.range * 0.24)));
    }
    // 手持近战（刀剑/斧锤/盾/拳/爪/匕首）：土豆兄弟式清晰挥扫/直刺射程（50~78px），与实体兵器完全 1:1 触碰
    const styleCap = def.melee?.style === 'sweep' ? 78 : def.melee?.style === 'bash' ? 74 : 72;
    return Math.max(50, Math.min(styleCap, Math.round(base * 0.34 + stats.range * 0.2)));
  }
  const bonus = def.summon || def.device ? 0 : stats.range;
  return Math.max(40, Math.min(MAX_SCREEN_RANGE, base + bonus));
}

/** 远程武器超出屏幕上限的溢出射程自动转化为增伤（每溢出 25 射程 +2% 伤害，上限 +25%），避免枪械流射程白给 */
export function rangeOverflowBonus(def: WeaponDef, stats: Stats, tier = 0): number {
  if (def.kind === 'melee' || def.summon || def.device) return 0;
  const raw = tierOf(def, tier).range + stats.range;
  if (raw <= MAX_SCREEN_RANGE) return 0;
  return Math.min(0.25, ((raw - MAX_SCREEN_RANGE) / 25) * 0.02);
}

/** 成长型武器已经长出来的固定伤害（单把上限 +40，防无尽模式无限膨胀） */
export function growthBonus(def: WeaponDef, owned: OwnedWeapon | null | undefined): number {
  if (!def.growth || !owned) return 0;
  return Math.min(40, Math.floor((owned.kills ?? 0) / def.growth.kills));
}

/**
 * 单次命中的基础伤害（未算暴击）。
 * targetHpRatio：目标当前血量比例（用于 Trident/Sickle 这类条件增伤），不传则不计算。
 */
export function weaponDamage(
  def: WeaponDef,
  tier: number,
  stats: Stats,
  mods: Mods,
  owned?: OwnedWeapon | null,
  mult = 1,
  targetHpRatio?: number,
  emptySlots = 0,
  copies = 1,
  slotBonus?: SlotBonus | null,
): number {
  const t = tierOf(def, tier);
  let flat = t.damage + growthBonus(def, owned);
  if (def.special?.freeSlotDamage) flat += def.special.freeSlotDamage * Math.max(0, emptySlots);
  if (def.special?.damagePerCopy) flat += def.special.damagePerCopy * Math.max(0, copies - 1);
  if (owned?.ramp) flat += owned.ramp;
  for (const [stat, coef] of Object.entries(t.scaling) as [keyof Stats, number][]) {
    const k = stat === 'melee' || stat === 'ranged' ? 1 + mods.flatBonusPct : 1;
    flat += (stats[stat] ?? 0) * coef * k;
  }
  const dmgPctMult = Math.max(0.2, 1 + stats.damagePct + (slotBonus?.damagePct ?? 0));
  let dmg = flat * dmgPctMult * (1 + rangeOverflowBonus(def, stats, tier));
  if (owned?.cursed) dmg *= 1.25;
  if (def.kind === 'ranged') dmg *= Math.max(0, 1 + mods.rangedDamagePct);
  if (def.kind !== 'device') dmg *= Math.max(0, 1 + mods.nonDeviceDamagePct);
  dmg *= Math.max(0, 1 + mods.weaponDamagePct) * mult;
  const sp = def.special;
  if (sp && targetHpRatio !== undefined) {
    if (sp.damageVsHighHp && targetHpRatio >= 0.8) dmg *= 1 + sp.damageVsHighHp;
    if (sp.damageVsLowHp && targetHpRatio <= 0.3) dmg *= 1 + sp.damageVsLowHp;
  }
  return dmg;
}

/** 暴击倍率（螳螂近战暴击倍率 + 精准 6 件套全局暴击倍率） */
export function critMultiplier(def: WeaponDef, mods: Mods, tier = 0): number {
  return tierOf(def, tier).critMultiplier + (def.kind === 'melee' ? mods.meleeCritBonus : 0) + mods.critMultBonus;
}

/** 武器自带的吸取几率（每次命中回 1 血；含嗜血附魔） */
export function weaponLifesteal(def: WeaponDef, tier: number, owned?: OwnedWeapon | null): number {
  return Math.max(0, tierOf(def, tier).lifesteal + (owned?.enchant === 'vamp' ? 0.06 : 0));
}

export function weaponCritChance(def: WeaponDef, tier: number, stats: Stats, slotBonus?: SlotBonus | null): number {
  const legendaryBonus = tier >= 3 ? 0.05 : 0;
  return Math.max(0, stats.critChance + tierOf(def, tier).critChance + (slotBonus?.critChance ?? 0) + legendaryBonus);
}

export function rollDamage(
  def: WeaponDef,
  tier: number,
  stats: Stats,
  mods: Mods,
  owned?: OwnedWeapon | null,
  mult = 1,
  targetHpRatio?: number,
  emptySlots = 0,
  copies = 1,
  slotBonus?: SlotBonus | null,
  forceCrit = false,
): { damage: number; crit: boolean } {
  let dmg = weaponDamage(def, tier, stats, mods, owned, mult, targetHpRatio, emptySlots, copies, slotBonus);
  const crit = forceCrit || Math.random() < weaponCritChance(def, tier, stats, slotBonus);
  if (crit) dmg *= critMultiplier(def, mods, tier);
  return { damage: Math.max(1, Math.round(dmg)), crit };
}
