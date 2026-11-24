import { BIOME_ORDER, type BiomeId } from '../data/biomes';
import { CHARACTER_ORDER, CHARACTERS } from '../data/characters';
import type { Mods } from '../data/items';
import type { Stats } from './stats';

export type DailyMutatorId =
  | 'turbo'
  | 'discount'
  | 'treasure'
  | 'glass'
  | 'swarm'
  | 'vamp'
  | 'chaos'
  | 'cursed_market'
  | 'quick_dash'
  | 'boom_party'
  | 'one_slot'
  | 'glass_soul';

export interface DailyMutatorDef {
  id: DailyMutatorId;
  name: string;
  desc: string;
  stats?: Partial<Stats>;
  mods?: Partial<Mods>;
  /** 仅挑战关专属（不进每日挑战和常规自定义池） */
  challengeOnly?: boolean;
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
  chaos: {
    id: 'chaos',
    name: '百变武器',
    desc: '每波开始时所有武器随机重铸为同品阶新武器',
  },
  cursed_market: {
    id: 'cursed_market',
    name: '诅咒黑市',
    desc: '开局诅咒 +12，商店紫火诅咒商品概率翻倍',
    stats: { curse: 12 },
  },
  quick_dash: {
    id: 'quick_dash',
    name: '疾影连冲',
    desc: '冲刺冷却 −40%，冲刺充能 +1',
    mods: { dashCooldownPct: -0.4, dashCharges: 1 },
  },
  boom_party: {
    id: 'boom_party',
    name: '爆裂派对',
    desc: '爆裂毒菇翻倍，气囊虫死亡对周围虫群引发连锁爆破',
    mods: { explodeRadiusPct: 0.2 },
  },
  one_slot: {
    id: 'one_slot',
    name: '孤胆单槽',
    desc: '武器槽锁为 1 个，伤害 +180%、攻速 +80%、暴击 +20%',
    stats: { damagePct: 1.8, attackSpeedPct: 0.8, critChance: 0.2 },
    challengeOnly: true,
  },
  glass_soul: {
    id: 'glass_soul',
    name: '玻璃之魂',
    desc: '生命上限锁为 1，伤害 +100%，开局 2 盾且每 12 秒再生 1 盾',
    stats: { damagePct: 1.0 },
    challengeOnly: true,
  },
};

const MUTATOR_ORDER = (Object.keys(DAILY_MUTATORS) as DailyMutatorId[]).filter((id) => !DAILY_MUTATORS[id].challengeOnly);
/** 可供玩家在选人页自由勾选的自定义词条列表 */
export const CUSTOM_MUTATOR_ORDER: DailyMutatorId[] = MUTATOR_ORDER;

export interface DailyChallenge {
  dateKey: string;
  character: string;
  weapon: string;
  difficulty: number;
  biome: BiomeId;
  seed: string;
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
  const biome = BIOME_ORDER[Math.floor(rng() * BIOME_ORDER.length)];
  const seed = `DAILY-${dateKey.replace(/-/g, '')}`;
  const pool = [...MUTATOR_ORDER];
  const mutators: DailyMutatorId[] = [];
  for (let k = 0; k < 2 && pool.length > 0; k++) {
    const idx = Math.floor(rng() * pool.length);
    mutators.push(pool.splice(idx, 1)[0]);
  }
  return { dateKey, character: charId, weapon, difficulty, biome, seed, mutators };
}
