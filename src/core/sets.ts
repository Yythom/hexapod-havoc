import type { Mods } from '../data/items';
import { WEAPONS, type WeaponTag } from '../data/weapons';
import type { OwnedWeapon } from './RunState';
import type { Stats } from './stats';

/** 武器标签套装：同一标签凑够 2 / 4 / 6 把触发（DESIGN.md 5.1） */
export const SET_THRESHOLDS = [2, 4, 6] as const;

interface SetLevel {
  stats: Partial<Stats>;
  mods?: Partial<Mods>;
  text: string;
}

export const SETS: Record<WeaponTag, [SetLevel, SetLevel, SetLevel]> = {
  甲角: [
    { stats: { armor: 2 }, text: '甲壳 +2' },
    { stats: { armor: 4 }, text: '甲壳 +4' },
    { stats: { armor: 6 }, mods: { meleeKnockbackPct: 0.5 }, text: '甲壳 +6，近战击退 +50%' },
  ],
  尖刺: [
    { stats: { critChance: 0.05 }, text: '暴击 +5%' },
    { stats: { critChance: 0.1 }, text: '暴击 +10%' },
    { stats: { critChance: 0.15 }, text: '暴击 +15%' },
  ],
  投掷: [
    { stats: { range: 25 }, text: '射程 +25' },
    { stats: { range: 50 }, text: '射程 +50' },
    { stats: { range: 75 }, text: '射程 +75' },
  ],
  枪械: [
    { stats: { range: 10, ranged: 1 }, text: '射程 +10，远程 +1' },
    { stats: { range: 25, ranged: 2 }, text: '射程 +25，远程 +2' },
    { stats: { range: 40, ranged: 4, attackSpeedPct: 0.1 }, text: '射程 +40，远程 +4，攻速 +10%' },
  ],
  腺体: [
    { stats: { toxin: 2 }, text: '毒素 +2' },
    { stats: { toxin: 4 }, text: '毒素 +4' },
    { stats: { toxin: 6 }, mods: { poisonDuration: 1 }, text: '毒素 +6，中毒持续 +1 秒' },
  ],
  共生: [
    { stats: {}, mods: { summonDamagePct: 0.15 }, text: '召唤物伤害 +15%' },
    { stats: {}, mods: { summonDamagePct: 0.3 }, text: '召唤物伤害 +30%' },
    { stats: {}, mods: { summonDamagePct: 0.5 }, text: '召唤物伤害 +50%' },
  ],
  火焰: [
    { stats: {}, mods: { burnDamagePct: 0.2 }, text: '灼烧伤害 +20%' },
    { stats: {}, mods: { burnDamagePct: 0.4 }, text: '灼烧伤害 +40%' },
    { stats: {}, mods: { burnDamagePct: 0.6, burnSpreadPct: 0.5 }, text: '灼烧伤害 +60%，传火范围 +50%' },
  ],
  电: [
    { stats: {}, mods: { chainJumps: 1 }, text: '链式跳跃 +1 次' },
    { stats: {}, mods: { chainJumps: 2 }, text: '链式跳跃 +2 次' },
    { stats: {}, mods: { chainJumps: 3, chainNoFalloff: 1 }, text: '链式跳跃 +3 次，每跳伤害不衰减' },
  ],
  机关: [
    { stats: { engineering: 2 }, text: '工程 +2' },
    { stats: { engineering: 4 }, text: '工程 +4' },
    { stats: { engineering: 6 }, mods: { deployCap: 1 }, text: '工程 +6，机关数量上限 +1' },
  ],
  蜂蜜: [
    { stats: { regen: 2 }, text: '回复 +2' },
    { stats: { regen: 4 }, text: '回复 +4' },
    { stats: { regen: 6 }, mods: { healingPct: 0.25 }, text: '回复 +6，治疗效果 +25%' },
  ],
};

export function tagCounts(weapons: OwnedWeapon[]): Map<WeaponTag, number> {
  const m = new Map<WeaponTag, number>();
  for (const w of weapons) for (const t of WEAPONS[w.id].tags) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** 当前生效的套装：每个标签取达到的最高档 */
export function activeSets(weapons: OwnedWeapon[]): { tag: WeaponTag; count: number; level: SetLevel }[] {
  const out: { tag: WeaponTag; count: number; level: SetLevel }[] = [];
  for (const [tag, count] of tagCounts(weapons)) {
    let lv = -1;
    SET_THRESHOLDS.forEach((n, i) => {
      if (count >= n) lv = i;
    });
    if (lv >= 0) out.push({ tag, count, level: SETS[tag][lv] });
  }
  return out;
}
