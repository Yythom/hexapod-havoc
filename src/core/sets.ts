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
    { stats: { armor: 6 }, mods: { meleeKnockbackPct: 0.5, ramDamage: 1 }, text: '甲壳 +6，近战击退 +50%，移动可撞伤敌人' },
  ],
  尖刺: [
    { stats: { critChance: 0.05 }, text: '暴击 +5%' },
    { stats: { critChance: 0.1 }, text: '暴击 +10%' },
    { stats: { critChance: 0.15 }, mods: { critNova: 1 }, text: '暴击 +15%，暴击时爆发尖刺震波' },
  ],
  投掷: [
    { stats: { range: 15 }, text: '射程 +15' },
    { stats: { range: 35 }, text: '射程 +35' },
    { stats: { range: 55 }, mods: { bounces: 1 }, text: '射程 +55，投掷/回旋类弹射 +1 次' },
  ],
  枪械: [
    { stats: { range: 10, ranged: 1 }, text: '射程 +10，远程 +1' },
    { stats: { range: 25, ranged: 2 }, text: '射程 +25，远程 +2' },
    { stats: { range: 40, ranged: 4, attackSpeedPct: 0.1 }, mods: { gunRicochet: 1 }, text: '射程 +40，远程 +4，攻速 +10%，子弹穿透与弹跳 +1' },
  ],
  腺体: [
    { stats: { toxin: 2 }, text: '毒素 +2' },
    { stats: { toxin: 4 }, text: '毒素 +4' },
    { stats: { toxin: 6 }, mods: { poisonDuration: 1, poisonNova: 1 }, text: '毒素 +6，中毒持续 +1 秒，带毒怪死后留毒云' },
  ],
  共生: [
    { stats: {}, mods: { summonDamagePct: 0.15 }, text: '召唤物伤害 +15%' },
    { stats: {}, mods: { summonDamagePct: 0.3 }, text: '召唤物伤害 +30%' },
    { stats: {}, mods: { summonDamagePct: 0.5, summonCount: 2 }, text: '召唤物伤害 +50%，召唤物数量 +2' },
  ],
  火焰: [
    { stats: {}, mods: { burnDamagePct: 0.2 }, text: '灼烧伤害 +20%' },
    { stats: {}, mods: { burnDamagePct: 0.4 }, text: '灼烧伤害 +40%' },
    { stats: {}, mods: { burnDamagePct: 0.6, burnSpreadPct: 0.5, burnExplode: 1 }, text: '灼烧伤害 +60%，传火范围 +50%，灼烧怪死后火焰爆炸' },
  ],
  电: [
    { stats: {}, mods: { chainJumps: 1 }, text: '链式跳跃 +1 次' },
    { stats: {}, mods: { chainJumps: 2 }, text: '链式跳跃 +2 次' },
    { stats: {}, mods: { chainJumps: 3, chainNoFalloff: 1, chainBolt: 0.2 }, text: '链式跳跃 +3 次，每跳伤害不衰减，20% 概率劈下额外落雷' },
  ],
  机关: [
    { stats: { engineering: 2 }, text: '工程 +2' },
    { stats: { engineering: 4 }, text: '工程 +4' },
    { stats: { engineering: 6 }, mods: { deployCap: 1, turretSpeedPct: 0.35 }, text: '工程 +6，机关上限 +1，炮台攻速 +35%' },
  ],
  蜂蜜: [
    { stats: { regen: 2 }, text: '回复 +2' },
    { stats: { regen: 4 }, text: '回复 +4' },
    { stats: { regen: 6 }, mods: { healingPct: 0.3, overhealShock: 1 }, text: '回复 +6，治疗效果 +30%，满血回血触发冲击波' },
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
