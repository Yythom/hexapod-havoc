import { CAMERA_ZOOM, GAME_HEIGHT } from '../config';
import type { Mods } from '../data/items';
import { TIERS, type WeaponDef } from '../data/weapons';
import type { OwnedWeapon } from './RunState';
import type { Stats } from './stats';

/** 武器极限射程上限：保证上下左右任意方向都不超过屏幕可见边界（扣掉角色腿尖挂点偏移） */
export const MAX_SCREEN_RANGE = Math.floor(GAME_HEIGHT / (2 * CAMERA_ZOOM)) - 38;

/** 武器在当前属性下的实际射程（任何加成都不超过屏幕边界上限） */
export function effectiveRange(def: WeaponDef, stats: Stats): number {
  const bonus = def.kind === 'melee' ? stats.range * 0.5 : def.summon || def.device ? 0 : stats.range;
  return Math.max(40, Math.min(MAX_SCREEN_RANGE, def.range + bonus));
}

/** 成长型武器已经长出来的固定伤害 */
export function growthBonus(def: WeaponDef, owned: OwnedWeapon | null | undefined): number {
  if (!def.growth || !owned) return 0;
  return Math.floor((owned.kills ?? 0) / def.growth.kills);
}

/**
 * 单次命中的基础伤害（未算暴击）。见 DESIGN.md 第 3 节伤害公式。
 * mods 里的角色限制：屁步甲的近战/远程固定加成减半，独角仙的远程武器伤害减半，
 * 蜘蛛、蝉的整体武器伤害修正，白蚁的非机关武器伤害修正。
 * mult：本帧的临时倍率（虎甲静止时的惩罚）。
 */
export function weaponDamage(def: WeaponDef, tier: number, stats: Stats, mods: Mods, owned?: OwnedWeapon | null, mult = 1): number {
  let flat = def.damage * TIERS[tier].damage + growthBonus(def, owned);
  for (const [stat, coef] of Object.entries(def.scaling) as [keyof WeaponDef['scaling'], number][]) {
    const k = stat === 'melee' || stat === 'ranged' ? 1 + mods.flatBonusPct : 1;
    flat += stats[stat] * coef * k;
  }
  let dmg = flat * (1 + stats.damagePct);
  if (def.kind === 'ranged') dmg *= Math.max(0, 1 + mods.rangedDamagePct);
  if (def.kind !== 'device') dmg *= Math.max(0, 1 + mods.nonDeviceDamagePct);
  dmg *= Math.max(0, 1 + mods.weaponDamagePct) * mult;
  return dmg;
}

/** 暴击倍率（螳螂的近战暴击倍率加成） */
export function critMultiplier(def: WeaponDef, mods: Mods): number {
  return def.critMultiplier + (def.kind === 'melee' ? mods.meleeCritBonus : 0);
}

export function rollDamage(
  def: WeaponDef,
  tier: number,
  stats: Stats,
  mods: Mods,
  owned?: OwnedWeapon | null,
  mult = 1,
): { damage: number; crit: boolean } {
  let dmg = weaponDamage(def, tier, stats, mods, owned, mult);
  const crit = Math.random() < stats.critChance;
  if (crit) dmg *= critMultiplier(def, mods);
  return { damage: Math.max(1, Math.round(dmg)), crit };
}
