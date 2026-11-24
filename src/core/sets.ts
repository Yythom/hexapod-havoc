import type { Mods } from '../data/items';
import { CLASS_ORDER, WEAPONS, type WeaponClass } from '../data/weapons';
import type { OwnedWeapon } from './RunState';
import type { Stats } from './stats';

/** Brotato 的武器 Class 套装：2/3/4/5/6 把触发五档 */
export const SET_THRESHOLDS = [2, 3, 4, 5, 6] as const;

interface SetLevel {
  stats: Partial<Stats>;
  mods?: Partial<Mods>;
  text: string;
}

type FiveLevels = [SetLevel, SetLevel, SetLevel, SetLevel, SetLevel];

/** 17 个 Class 的五档套装加成（按 Brotato 数值翻译；同名多把也计数） */
export const SETS: Record<WeaponClass, FiveLevels> = {
  Blade: [
    { stats: { melee: 1, lifesteal: 0.01 }, text: '近战 +1，吸取 +1%' },
    { stats: { melee: 2, lifesteal: 0.02 }, text: '近战 +2，吸取 +2%' },
    { stats: { melee: 3, lifesteal: 0.03 }, text: '近战 +3，吸取 +3%' },
    { stats: { melee: 4, lifesteal: 0.04 }, text: '近战 +4，吸取 +4%' },
    { stats: { melee: 5, lifesteal: 0.05 }, mods: { bladeWave: 1 }, text: '近战 +5，吸取 +5% ★觉醒：挥击释放穿透剑气' },
  ],
  Blunt: [
    { stats: { armor: 1, speedPct: -0.02 }, text: '甲壳 +1，移速 −2%' },
    { stats: { armor: 1, maxHp: 3, speedPct: -0.04 }, text: '甲壳 +1，最大生命 +3，移速 −4%' },
    { stats: { armor: 2, maxHp: 3, speedPct: -0.06 }, text: '甲壳 +2，最大生命 +3，移速 −6%' },
    { stats: { armor: 2, maxHp: 6, speedPct: -0.08 }, text: '甲壳 +2，最大生命 +6，移速 −8%' },
    { stats: { armor: 4, maxHp: 8, speedPct: -0.08 }, mods: { meleeKnockbackPct: 0.45 }, text: '甲壳 +4，生命 +8 ★觉醒：击退 +45%' },
  ],
  Elemental: [
    { stats: { elemental: 1 }, text: '元素 +1' },
    { stats: { elemental: 2 }, text: '元素 +2' },
    { stats: { elemental: 3 }, text: '元素 +3' },
    { stats: { elemental: 4 }, text: '元素 +4' },
    { stats: { elemental: 6 }, mods: { elementalBurst: 1, burnExplode: 1 }, text: '元素 +6 ★觉醒：冰火/雷火交汇触发元素爆裂' },
  ],
  Ethereal: [
    { stats: { dodge: 0.06, armor: -1 }, text: '闪避 +6%，甲壳 −1' },
    { stats: { dodge: 0.12, armor: -2 }, text: '闪避 +12%，甲壳 −2' },
    { stats: { dodge: 0.18, armor: -3 }, text: '闪避 +18%，甲壳 −3' },
    { stats: { dodge: 0.24, armor: -4 }, text: '闪避 +24%，甲壳 −4' },
    { stats: { dodge: 0.3, armor: -4, attackSpeedPct: 0.15 }, mods: { dashCooldownPct: -0.25 }, text: '闪避 +30%，攻速 +15% ★觉醒：冲刺冷却 −25%' },
  ],
  Explosive: [
    { mods: { explodeRadiusPct: 0.05 }, stats: {}, text: '爆炸范围 +5%' },
    { mods: { explodeRadiusPct: 0.1 }, stats: {}, text: '爆炸范围 +10%' },
    { mods: { explodeRadiusPct: 0.15 }, stats: {}, text: '爆炸范围 +15%' },
    { mods: { explodeRadiusPct: 0.2 }, stats: {}, text: '爆炸范围 +20%' },
    { mods: { explodeRadiusPct: 0.28, explosiveAftershock: 1 }, stats: {}, text: '爆炸范围 +28% ★觉醒：爆炸触发二次余震' },
  ],
  Gun: [
    { stats: { range: 10 }, text: '射程 +10' },
    { stats: { range: 20 }, text: '射程 +20' },
    { stats: { range: 30 }, text: '射程 +30' },
    { stats: { range: 40 }, text: '射程 +40' },
    { stats: { range: 50 }, mods: { gunVolley: 1 }, text: '射程 +50 ★觉醒：每 4 次射击附带穿透弹' },
  ],
  Heavy: [
    { stats: { damagePct: 0.05 }, text: '伤害 +5%' },
    { stats: { damagePct: 0.1 }, text: '伤害 +10%' },
    { stats: { damagePct: 0.15 }, text: '伤害 +15%' },
    { stats: { damagePct: 0.2 }, text: '伤害 +20%' },
    { stats: { damagePct: 0.28 }, mods: { vulnerablePct: 0.15 }, text: '伤害 +28% ★觉醒：重压破甲（易伤效果 +15%）' },
  ],
  Legendary: [
    { stats: { maxHp: -20 }, text: '最大生命 −20' },
    { stats: { maxHp: -40 }, text: '最大生命 −40' },
    { stats: { maxHp: -60 }, text: '最大生命 −60' },
    { stats: { maxHp: -80 }, text: '最大生命 −80' },
    { stats: { maxHp: -100, damagePct: 0.4, attackSpeedPct: 0.25 }, text: '生命 −100 ★觉醒：传说共鸣 伤害+40% 攻速+25%' },
  ],
  Medical: [
    { stats: { regen: 1 }, text: '回复 +1' },
    { stats: { regen: 2 }, text: '回复 +2' },
    { stats: { regen: 3 }, text: '回复 +3' },
    { stats: { regen: 4 }, text: '回复 +4' },
    { stats: { regen: 6 }, mods: { healingPct: 0.25, overhealShock: 1 }, text: '回复 +6 ★觉醒：治疗 +25% 且满血溢出震波' },
  ],
  Medieval: [
    { stats: { armor: 1 }, text: '甲壳 +1' },
    { stats: { armor: 1, dodge: 0.03 }, text: '甲壳 +1，闪避 +3%' },
    { stats: { armor: 2, dodge: 0.03 }, text: '甲壳 +2，闪避 +3%' },
    { stats: { armor: 2, dodge: 0.06 }, text: '甲壳 +2，闪避 +6%' },
    { stats: { armor: 4, dodge: 0.08 }, mods: { ramDamage: 1 }, text: '甲壳 +4，闪避 +8% ★觉醒：移动撞击甲壳伤害' },
  ],
  Musical: [
    { stats: { luck: 5 }, text: '幸运 +5' },
    { stats: { luck: 10 }, text: '幸运 +10' },
    { stats: { luck: 15 }, text: '幸运 +15' },
    { stats: { luck: 20 }, text: '幸运 +20' },
    { stats: { luck: 30 }, mods: { killNectar: 0.1, critSpark: 1 }, text: '幸运 +30 ★觉醒：击杀掉蜜 +10% · 暴击火花' },
  ],
  Naval: [
    { stats: { curse: 1 }, text: '诅咒 +1' },
    { stats: { curse: 2 }, text: '诅咒 +2' },
    { stats: { curse: 3 }, text: '诅咒 +3' },
    { stats: { curse: 4 }, text: '诅咒 +4' },
    { stats: { curse: 6 }, mods: { curseBonusNectar: 2 }, text: '诅咒 +6 ★觉醒：击杀诅咒怪额外掉落 +2 花蜜' },
  ],
  Precise: [
    { stats: { critChance: 0.03 }, text: '暴击 +3%' },
    { stats: { critChance: 0.06 }, text: '暴击 +6%' },
    { stats: { critChance: 0.09 }, text: '暴击 +9%' },
    { stats: { critChance: 0.12 }, text: '暴击 +12%' },
    { stats: { critChance: 0.16 }, mods: { critMultBonus: 0.5 }, text: '暴击 +16% ★觉醒：全局暴击倍率 +0.5' },
  ],
  Primitive: [
    { stats: { maxHp: 3 }, text: '最大生命 +3' },
    { stats: { maxHp: 6 }, text: '最大生命 +6' },
    { stats: { maxHp: 9 }, text: '最大生命 +9' },
    { stats: { maxHp: 12 }, text: '最大生命 +12' },
    { stats: { maxHp: 18, damagePct: 0.12 }, mods: { meleeKnockbackPct: 0.3 }, text: '最大生命 +18 ★觉醒：野性伤害 +12% 击退 +30%' },
  ],
  Support: [
    { stats: { harvest: 5 }, text: '采蜜 +5' },
    { stats: { harvest: 10 }, text: '采蜜 +10' },
    { stats: { harvest: 15 }, text: '采蜜 +15' },
    { stats: { harvest: 20 }, text: '采蜜 +20' },
    { stats: { harvest: 28 }, mods: { waveHarvest: 4, summonDamagePct: 0.25 }, text: '采蜜 +28 ★觉醒：每波采蜜 +4 · 召唤伤害 +25%' },
  ],
  Tool: [
    { stats: { engineering: 1 }, text: '工程 +1' },
    { stats: { engineering: 2 }, text: '工程 +2' },
    { stats: { engineering: 3 }, text: '工程 +3' },
    { stats: { engineering: 4 }, text: '工程 +4' },
    { stats: { engineering: 6 }, mods: { deployCap: 1, turretSpeedPct: 0.2 }, text: '工程 +6 ★觉醒：机关上限 +1 · 炮台攻速 +20%' },
  ],
  Unarmed: [
    { stats: { dodge: 0.03 }, text: '闪避 +3%' },
    { stats: { dodge: 0.06 }, text: '闪避 +6%' },
    { stats: { dodge: 0.09 }, text: '闪避 +9%' },
    { stats: { dodge: 0.12 }, text: '闪避 +12%' },
    { stats: { dodge: 0.16, attackSpeedPct: 0.12 }, mods: { critNova: 1 }, text: '闪避 +16%，攻速 +12% ★觉醒：暴击触发震波' },
  ],
};

export function classCounts(weapons: OwnedWeapon[]): Map<WeaponClass, number> {
  const m = new Map<WeaponClass, number>();
  for (const w of weapons) {
    const def = WEAPONS[w.id];
    if (!def) continue;
    for (const c of def.classes) m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}

/** 当前生效的 Class 套装：每个 Class 取达到的最高档 */
export function activeSets(weapons: OwnedWeapon[]): { cls: WeaponClass; count: number; level: SetLevel }[] {
  const out: { cls: WeaponClass; count: number; level: SetLevel }[] = [];
  const counts = classCounts(weapons);
  for (const cls of CLASS_ORDER) {
    const count = counts.get(cls) ?? 0;
    let lv = -1;
    SET_THRESHOLDS.forEach((n, i) => {
      if (count >= n) lv = i;
    });
    if (lv >= 0) out.push({ cls, count, level: SETS[cls][lv] });
  }
  return out;
}
