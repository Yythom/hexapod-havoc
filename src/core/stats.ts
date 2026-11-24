/** 角色属性。百分比类属性用小数表示（0.05 = 5%）。见 DESIGN.md 第 3 节。 */
export interface Stats {
  maxHp: number;
  /** 每秒回复 regen × 0.15 生命 */
  regen: number;
  /** 命中时回复 1 生命的概率 */
  lifesteal: number;
  damagePct: number;
  melee: number;
  ranged: number;
  toxin: number;
  /** Brotato 的 Elemental：火焰、冰、电与元素武器共用 */
  elemental: number;
  /** Brotato 的 Curse：越高敌人越强、掉落越好 */
  curse: number;
  attackSpeedPct: number;
  critChance: number;
  range: number;
  armor: number;
  dodge: number;
  speedPct: number;
  luck: number;
  harvest: number;
  /** 花蜜感应范围加成，实际范围 = 80 × (1 + pickupPct) */
  pickupPct: number;
  /** 工程：机关（炮台、地雷）的伤害加成 */
  engineering: number;
}

export const ZERO_STATS: Readonly<Stats> = {
  maxHp: 0,
  regen: 0,
  lifesteal: 0,
  damagePct: 0,
  melee: 0,
  ranged: 0,
  toxin: 0,
  elemental: 0,
  curse: 0,
  attackSpeedPct: 0,
  critChance: 0,
  range: 0,
  armor: 0,
  dodge: 0,
  speedPct: 0,
  luck: 0,
  harvest: 0,
  pickupPct: 0,
  engineering: 0,
};

export const BASE_STATS: Readonly<Stats> = {
  ...ZERO_STATS,
  maxHp: 20,
  critChance: 0.03,
};

export const STAT_KEYS = Object.keys(ZERO_STATS) as (keyof Stats)[];

/** 属性面板的显示名和格式 */
export const STAT_META: Record<keyof Stats, { label: string; pct: boolean }> = {
  maxHp: { label: '最大生命', pct: false },
  regen: { label: '回复', pct: false },
  lifesteal: { label: '吸取', pct: true },
  damagePct: { label: '伤害', pct: true },
  melee: { label: '近战', pct: false },
  ranged: { label: '远程', pct: false },
  toxin: { label: '毒素', pct: false },
  elemental: { label: '元素', pct: false },
  curse: { label: '诅咒', pct: false },
  attackSpeedPct: { label: '攻速', pct: true },
  critChance: { label: '暴击', pct: true },
  range: { label: '射程', pct: false },
  armor: { label: '甲壳', pct: false },
  dodge: { label: '闪避', pct: true },
  speedPct: { label: '移速', pct: true },
  luck: { label: '幸运', pct: false },
  harvest: { label: '采蜜', pct: false },
  pickupPct: { label: '感应', pct: true },
  engineering: { label: '工程', pct: false },
};

function round1(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** 属性值的显示文本，如 "5%"、"12"（最大生命只显示整数） */
export function formatStat(key: keyof Stats, v: number): string {
  if (STAT_META[key].pct) return `${Math.round(v * 100)}%`;
  return key === 'maxHp' ? String(Math.round(v)) : round1(v);
}

/** 属性变化的显示文本，如 "+5%"、"-3" */
export function formatStatDelta(key: keyof Stats, v: number): string {
  return (v >= 0 ? '+' : '') + formatStat(key, v);
}

export const BASE_MOVE_SPEED = 200;
export const BASE_PICKUP_RANGE = 80;
export const MAX_DODGE = 0.6;

export function moveSpeed(s: Stats): number {
  return BASE_MOVE_SPEED * Math.max(0.2, 1 + s.speedPct);
}

export function pickupRange(s: Stats): number {
  return BASE_PICKUP_RANGE * Math.max(0.2, 1 + s.pickupPct);
}

/** 甲壳减伤：0~20 按 15/(15+甲壳)，超过 20 软递减且最高减伤 68%（防高甲无敌）；负甲壳增伤上限 2 倍 */
export function damageTakenMultiplier(armor: number): number {
  if (armor < 0) return Math.min(2, (15 - armor) / 15);
  const eff = armor <= 20 ? armor : 20 + (armor - 20) * 0.45;
  return Math.max(0.32, 15 / (15 + eff));
}

export function dodgeChance(s: Stats): number {
  return Math.min(MAX_DODGE, Math.max(0, s.dodge));
}

export function regenPerSecond(s: Stats): number {
  return Math.max(0, s.regen) * 0.15;
}

export function attackInterval(baseCooldown: number, s: Stats): number {
  return baseCooldown / Math.max(0.2, 1 + s.attackSpeedPct);
}
