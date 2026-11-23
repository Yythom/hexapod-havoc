import type { Stats } from './stats';

/** 第 level 级升到下一级需要的经验（DESIGN.md 2.3） */
export function xpToNext(level: number): number {
  return 10 + 6 * level + level * level;
}

/** 商品/升级/宝箱的品质权重表（DESIGN.md 2.7） */
const TIER_TABLE: { maxWave: number; weights: [number, number, number, number] }[] = [
  { maxWave: 3, weights: [100, 0, 0, 0] },
  { maxWave: 7, weights: [80, 20, 0, 0] },
  { maxWave: 11, weights: [60, 30, 10, 0] },
  { maxWave: 15, weights: [45, 33, 18, 4] },
  { maxWave: Infinity, weights: [35, 35, 22, 8] },
];

/** 每 10 点幸运，精良及以上的权重 × 1.05 */
export function tierWeights(wave: number, luck: number): number[] {
  const row = TIER_TABLE.find((r) => wave <= r.maxWave)!;
  const f = Math.pow(1.05, luck / 10);
  return row.weights.map((w, i) => (i === 0 ? w : w * f));
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

/** 随机出 count 个不重复的属性升级选项 */
export function rollUpgrades(wave: number, luck: number, count = 4): UpgradeOption[] {
  const pool = [...UPGRADES];
  const out: UpgradeOption[] = [];
  while (out.length < count && pool.length > 0) {
    const u = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const tier = rollTier(wave, luck);
    out.push({ stat: u.stat, tier, value: u.values[tier] });
  }
  return out;
}

/** 升级选项刷新费用（DESIGN.md 2.3） */
export function levelRerollCost(wave: number): number {
  return 2 + wave;
}
