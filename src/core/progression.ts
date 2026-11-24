import { WEAPONS } from '../data/weapons';
import type { RunState } from './RunState';
import type { Stats } from './stats';

/** 第 level 级升到下一级需要的经验（DESIGN.md 2.3） */
export function xpToNext(level: number): number {
  return 10 + 6 * level + level * level;
}

/** 商品/升级/宝箱的品质权重表（第 2~3 波即可稳定见到精良蓝色，第 4~6 波出稀有紫色） */
const TIER_TABLE: { maxWave: number; weights: [number, number, number, number] }[] = [
  { maxWave: 1, weights: [90, 10, 0, 0] },
  { maxWave: 3, weights: [72, 28, 0, 0] },
  { maxWave: 6, weights: [50, 38, 12, 0] },
  { maxWave: 9, weights: [36, 40, 20, 4] },
  { maxWave: 13, weights: [26, 38, 27, 9] },
  { maxWave: Infinity, weights: [18, 36, 32, 14] },
];

/** 幸运阶梯加成：品质越高吃到的幸运倍率越大，避免高幸运时精良与传说同比例竞争 */
const LUCK_EXP = [0, 0.6, 1.0, 1.35];

export function tierWeights(wave: number, luck: number): number[] {
  const row = TIER_TABLE.find((r) => wave <= r.maxWave)!;
  const f = Math.pow(1.08, Math.max(0, luck) / 10);
  return row.weights.map((w, i) => (i === 0 ? w : w * Math.pow(f, LUCK_EXP[i])));
}

export function rollTier(wave: number, luck: number): number {
  const weights = tierWeights(wave, luck);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
}

export interface UpgradeOption {
  stat: keyof Stats;
  tier: number;
  value: number;
}

/** 升级时可选的属性，按品质给不同数值 */
const UPGRADES: { stat: keyof Stats; values: [number, number, number, number] }[] = [
  { stat: 'maxHp', values: [3, 6, 9, 12] },
  { stat: 'regen', values: [2, 3, 4, 5] },
  { stat: 'lifesteal', values: [0.01, 0.02, 0.03, 0.04] },
  { stat: 'damagePct', values: [0.05, 0.08, 0.12, 0.16] },
  { stat: 'melee', values: [2, 3, 4, 5] },
  { stat: 'ranged', values: [1, 2, 3, 4] },
  { stat: 'toxin', values: [1, 2, 3, 4] },
  { stat: 'elemental', values: [1, 2, 3, 4] },
  { stat: 'curse', values: [1, 1, 2, 3] },
  { stat: 'attackSpeedPct', values: [0.05, 0.1, 0.15, 0.2] },
  { stat: 'critChance', values: [0.03, 0.05, 0.07, 0.09] },
  { stat: 'range', values: [15, 30, 45, 60] },
  { stat: 'armor', values: [1, 2, 3, 4] },
  { stat: 'dodge', values: [0.03, 0.06, 0.09, 0.12] },
  { stat: 'speedPct', values: [0.03, 0.06, 0.09, 0.12] },
  { stat: 'luck', values: [5, 10, 15, 20] },
  { stat: 'harvest', values: [5, 8, 10, 12] },
  { stat: 'engineering', values: [1, 2, 3, 4] },
];

/** 按角色与当前武器构筑计算升级属性权重：过滤死属性、冷门流派降权、对口属性提权 */
function upgradeWeight(stat: keyof Stats, run?: RunState): number {
  if (!run) return stat === 'curse' ? 0.35 : 1;
  const c = run.character;
  const perks = c.perks;
  if (perks.lifestealOnly && stat === 'regen') return 0;
  if (perks.noDodge && stat === 'dodge') return 0;
  if (run.weaponSlots === 0 && (stat === 'ranged' || stat === 'engineering' || stat === 'elemental' || stat === 'range')) return 0;
  if (c.allowedKinds && !c.allowedKinds.includes('ranged') && !c.allowedKinds.includes('toxin') && (stat === 'ranged' || stat === 'engineering')) return 0;

  let hasMelee = !!perks.workers || (c.stats.melee ?? 0) > 0;
  let hasRanged = (c.stats.ranged ?? 0) > 0 && (c.mods?.rangedDamagePct ?? 0) >= 0;
  let hasToxin = (c.stats.toxin ?? 0) > 0 || !!perks.hurtCloud || (run.items.widowsilk ?? 0) > 0;
  let hasElemental = (c.stats.elemental ?? 0) > 0;
  let hasDevice = (c.stats.engineering ?? 0) > 0;
  let hasNaval = run.stats.curse > 0;

  for (const ow of run.weapons) {
    const w = WEAPONS[ow.id];
    if (!w) continue;
    if (w.kind === 'melee' || w.scaling.melee) hasMelee = true;
    if ((w.kind === 'ranged' || w.scaling.ranged) && (c.mods?.rangedDamagePct ?? 0) >= 0) hasRanged = true;
    if (w.kind === 'toxin' || w.scaling.toxin || w.projectile?.poison || w.onHit?.poison) hasToxin = true;
    if (w.scaling.elemental || w.classes.includes('Elemental') || w.onHit?.burn || w.onHit?.freeze || w.chain) hasElemental = true;
    if (w.device || w.scaling.engineering) hasDevice = true;
    if (w.classes.includes('Naval')) hasNaval = true;
  }

  switch (stat) {
    case 'melee':
      return hasMelee ? 1.55 : 0.22;
    case 'ranged':
      return (c.mods?.rangedDamagePct ?? 0) < 0 ? 0.08 : hasRanged ? 1.55 : 0.22;
    case 'toxin':
      return hasToxin ? 1.65 : 0.14;
    case 'elemental':
      return hasElemental ? 1.65 : 0.14;
    case 'engineering':
      return hasDevice ? 1.75 : 0.12;
    case 'curse':
      return hasNaval ? 1.0 : 0.32;
    case 'lifesteal':
      return perks.lifestealOnly ? 1.6 : 1.0;
    case 'armor':
      return perks.thorns ? 1.45 : 1.0;
    case 'speedPct':
      return perks.speedToDamage ? 1.5 : 1.0;
    default:
      return 1.0;
  }
}

/** 按构筑权重随机出 count 个不重复的属性升级选项 */
export function rollUpgrades(wave: number, luck: number, count = 4, run?: RunState): UpgradeOption[] {
  const pool = UPGRADES.map((u) => ({ u, w: upgradeWeight(u.stat, run) })).filter((x) => x.w > 0);
  const out: UpgradeOption[] = [];
  while (out.length < count && pool.length > 0) {
    let total = 0;
    for (const p of pool) total += p.w;
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r < 0) {
        idx = i;
        break;
      }
    }
    const picked = pool.splice(idx, 1)[0].u;
    const tier = rollTier(wave, luck);
    out.push({ stat: picked.stat, tier, value: picked.values[tier] });
  }
  return out;
}

/** 升级选项刷新费用（DESIGN.md 2.3） */
export function levelRerollCost(wave: number): number {
  return 2 + wave;
}
