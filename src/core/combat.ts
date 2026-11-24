import { CAMERA_ZOOM, GAME_HEIGHT } from '../config';
import type { Mods } from '../data/items';
import { tierOf, type WeaponDef } from '../data/weapons';
import type { OwnedWeapon } from './RunState';
import type { Stats } from './stats';

/** 武器极限射程上限：保证上下左右任意方向都不超过屏幕可见边界（扣掉角色腿尖挂点偏移） */
export const MAX_SCREEN_RANGE = Math.floor(GAME_HEIGHT / (2 * CAMERA_ZOOM)) - 38;

/** 武器在当前属性下的实际射程（任何加成都不超过屏幕边界上限） */
export function effectiveRange(def: WeaponDef, stats: Stats, tier = 0): number {
  const base = tierOf(def, tier).range;
  const bonus = def.kind === 'melee' ? stats.range * 0.5 : def.summon || def.device ? 0 : stats.range;
  return Math.max(40, Math.min(MAX_SCREEN_RANGE, base + bonus));
}

/** 成长型武器已经长出来的固定伤害 */
export function growthBonus(def: WeaponDef, owned: OwnedWeapon | null | undefined): number {
  if (!def.growth || !owned) return 0;
  return Math.floor((owned.kills ?? 0) / def.growth.kills);
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
  let dmg = flat * (1 + stats.damagePct);
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

/** 暴击倍率（螳螂的近战暴击倍率加成） */
export function critMultiplier(def: WeaponDef, mods: Mods, tier = 0): number {
  return tierOf(def, tier).critMultiplier + (def.kind === 'melee' ? mods.meleeCritBonus : 0);
}

/** 武器自带的吸取几率（每次命中回 1 血） */
export function weaponLifesteal(def: WeaponDef, tier: number): number {
  return Math.max(0, tierOf(def, tier).lifesteal);
}

export function weaponCritChance(def: WeaponDef, tier: number, stats: Stats): number {
  return Math.max(0, stats.critChance + tierOf(def, tier).critChance);
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
): { damage: number; crit: boolean } {
  let dmg = weaponDamage(def, tier, stats, mods, owned, mult, targetHpRatio, emptySlots, copies);
  const crit = Math.random() < weaponCritChance(def, tier, stats);
  if (crit) dmg *= critMultiplier(def, mods, tier);
  return { damage: Math.max(1, Math.round(dmg)), crit };
}
