import { CHARACTER_ORDER, CHARACTERS } from '../data/characters';
import type { Mods } from '../data/items';
import type { Stats } from './stats';

export type DailyMutatorId = 'turbo' | 'discount' | 'treasure' | 'glass' | 'swarm' | 'vamp';

export interface DailyMutatorDef {
  id: DailyMutatorId;
  name: string;
  desc: string;
  stats?: Partial<Stats>;
  mods?: Partial<Mods>;
}

export const DAILY_MUTATORS: Record<DailyMutatorId, DailyMutatorDef> = {
  turbo: {
    id: 'turbo',
    name: '极速狂飙',
    desc: '移速 +25%、攻速 +20%，怪物移速 +15%',
    stats: { speedPct: 0.25, attackSpeedPct: 0.2 },
  },
  discount: {
    id: 'discount',
    name: '虫市清仓',
    desc: '商店全线 −25% 价格，但每次仅展示 3 件商品',
    mods: { pricePct: -0.25 },
  },
  treasure: {
    id: 'treasure',
    name: '宝藏狂潮',
    desc: '第 2 波起每波必出 1 只黄金盗宝虫',
  },
  glass: {
    id: 'glass',
    name: '玻璃大炮',
    desc: '所有伤害 +35%，最大生命 −20%',
    stats: { damagePct: 0.35 },
    mods: { maxHpPct: -0.2 },
  },
  swarm: {
    id: 'swarm',
    name: '虫潮涌动',
    desc: '刷怪密度 +30%，击杀额外 12% 概率掉花蜜',
    mods: { spawnRatePct: 0.3, killNectar: 0.12 },
  },
  vamp: {
    id: 'vamp',
    name: '猩红盛宴',
    desc: '吸取 +10%，每波开局额外 +1 层护盾',
    stats: { lifesteal: 0.1 },
  },
};

const MUTATOR_ORDER = Object.keys(DAILY_MUTATORS) as DailyMutatorId[];

export interface DailyChallenge {
  dateKey: string;
  character: string;
  weapon: string;
  difficulty: number;
  mutators: DailyMutatorId[];
}

export function todayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 按日期确定性生成当日每日挑战：固定角色 + 初始武器 + 天气难度 + 2 条趣味词条 */
export function getDailyChallenge(dateKey = todayDateKey()): DailyChallenge {
  const rng = mulberry32(hashSeed(`hexapod-daily-${dateKey}`));
  const charId = CHARACTER_ORDER[Math.floor(rng() * CHARACTER_ORDER.length)];
  const c = CHARACTERS[charId];
  const weapon = c.startWeapons.length > 0 ? c.startWeapons[Math.floor(rng() * c.startWeapons.length)] : '';
  const difficulty = rng() < 0.5 ? 1 : 2; // 阴天或小雨，人人都能上手又有挑战性
  const pool = [...MUTATOR_ORDER];
  const mutators: DailyMutatorId[] = [];
  for (let k = 0; k < 2 && pool.length > 0; k++) {
    const idx = Math.floor(rng() * pool.length);
    mutators.push(pool.splice(idx, 1)[0]);
  }
  return { dateKey, character: charId, weapon, difficulty, mutators };
}
