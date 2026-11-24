export interface SpawnRule {
  enemy: string;
  /** 每隔多少秒刷一组 */
  every: number;
  /** 每组数量范围 */
  group: [number, number];
  /** 本波第几秒开始刷（默认 0.5） */
  from?: number;
  /** 本波第几秒停止刷（默认结束前 1.5 秒） */
  until?: number;
}

export interface WaveDef {
  /** 时长（秒）；null 表示 Boss 波，击败 Boss 才结束 */
  duration: number | null;
  rules: SpawnRule[];
  /** 精英：在第 at 秒刷出 count 只 */
  elites?: { enemy: string; count: number; at: number }[];
  /** Boss：开场刷出 */
  boss?: string;
}

/** 各种怪每组刷几只 */
const GROUP: Record<string, [number, number]> = {
  ant: [4, 6],
  mosquito: [4, 6],
  wasp: [1, 2],
  spider: [1, 2],
  slime: [1, 2],
  gasbag: [2, 3],
  queen: [1, 1],
  pursuer: [1, 2],
  healer: [1, 1],
  buffer: [1, 1],
  slasher_egg: [1, 2],
  slasher: [1, 1],
  puffer: [1, 2],
  lamprey: [1, 2],
  spawner: [1, 1],
  curse_slug: [1, 1],
  mummy: [1, 2],
};

/** 新怪种第一次出现时，晚几秒再开始刷 */
const FIRST_FROM: Record<string, number> = {};

/**
 * 用「每秒刷多少只」和各怪种的权重生成一波的刷怪规则。
 * 调难度只需要改 rate（整体密度）和 mix（组成）。
 */
function wave(duration: number, rate: number, mix: Record<string, number>, extra: Partial<WaveDef> = {}): WaveDef {
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  const rules = Object.entries(mix).map(([enemy, w]): SpawnRule => {
    const [min, max] = GROUP[enemy];
    const perSec = (rate * w) / total;
    const from = FIRST_FROM[enemy] === undefined ? 4 : undefined;
    FIRST_FROM[enemy] ??= 1;
    return { enemy, every: (min + max) / 2 / perSec, group: [min, max], from: enemy === 'ant' ? undefined : from };
  });
  return { duration, rules, ...extra };
}

/**
 * 20 波，见 DESIGN.md 第 8 节。rate 是每秒刷怪数，用模拟玩家调过。
 */
export const WAVES: WaveDef[] = [
  // 1–5：30 秒
  wave(30, 1.6, { ant: 1 }),
  wave(30, 2.4, { ant: 1 }),
  wave(30, 2.8, { ant: 3, mosquito: 1 }),
  wave(30, 3.2, { ant: 3, mosquito: 1, wasp: 0.5 }),
  wave(30, 3.6, { ant: 3, mosquito: 1.2, wasp: 0.6 }),
  // 6–10：45 秒（第 7 波疾影猎虫，第 8 波镰斩魔卵，第 9 波绿露医虫，第 10 波棘球毒虫）
  wave(45, 3.1, { ant: 3, mosquito: 1.2, wasp: 0.6, spider: 0.4 }),
  wave(45, 3.3, { ant: 3, mosquito: 1.2, wasp: 0.7, spider: 0.5, pursuer: 0.24 }),
  wave(45, 3.5, { ant: 3, mosquito: 1.2, wasp: 0.7, spider: 0.5, slime: 0.5, pursuer: 0.28, slasher_egg: 0.16 }),
  wave(45, 3.7, { ant: 3, mosquito: 1.3, wasp: 0.8, spider: 0.6, slime: 0.6, pursuer: 0.3, slasher_egg: 0.18, healer: 0.16 }),
  wave(
    45,
    3.3,
    { ant: 3, mosquito: 1.2, wasp: 0.7, spider: 0.5, slime: 0.5, pursuer: 0.24, slasher_egg: 0.15, healer: 0.14, puffer: 0.22 },
    { elites: [{ enemy: 'soldier', count: 1, at: 3 }] },
  ),
  // 11–19：60 秒（第 11 波狂化鸣蝉 & 厄运紫蛞蝓，第 12 波滚球毛虫 & 镰刃螳虫，第 13 波腐巢母虫，第 14 波噬蜜飞鳗）
  wave(60, 4.0, {
    ant: 3,
    mosquito: 1.2,
    wasp: 0.8,
    spider: 0.6,
    slime: 0.6,
    gasbag: 0.6,
    pursuer: 0.3,
    slasher_egg: 0.18,
    puffer: 0.24,
    healer: 0.16,
    buffer: 0.12,
    curse_slug: 0.06,
  }),
  wave(60, 4.2, {
    ant: 3,
    mosquito: 1.3,
    wasp: 0.9,
    spider: 0.6,
    slime: 0.6,
    gasbag: 0.7,
    pursuer: 0.32,
    slasher_egg: 0.18,
    slasher: 0.14,
    puffer: 0.26,
    mummy: 0.22,
    healer: 0.18,
    buffer: 0.14,
    curse_slug: 0.06,
  }),
  wave(60, 4.4, {
    ant: 3,
    mosquito: 1.3,
    wasp: 0.9,
    spider: 0.7,
    slime: 0.7,
    gasbag: 0.7,
    queen: 0.1,
    spawner: 0.16,
    pursuer: 0.32,
    slasher_egg: 0.18,
    slasher: 0.16,
    puffer: 0.28,
    mummy: 0.22,
    healer: 0.18,
    buffer: 0.15,
    curse_slug: 0.06,
  }),
  wave(60, 4.6, {
    ant: 3,
    mosquito: 1.4,
    wasp: 1,
    spider: 0.7,
    slime: 0.7,
    gasbag: 0.8,
    queen: 0.12,
    spawner: 0.18,
    lamprey: 0.22,
    pursuer: 0.34,
    slasher_egg: 0.2,
    slasher: 0.18,
    puffer: 0.3,
    mummy: 0.24,
    healer: 0.2,
    buffer: 0.16,
    curse_slug: 0.07,
  }),
  wave(
    60,
    4.2,
    {
      ant: 3,
      mosquito: 1.3,
      wasp: 0.9,
      spider: 0.7,
      slime: 0.7,
      gasbag: 0.7,
      queen: 0.1,
      spawner: 0.16,
      lamprey: 0.2,
      pursuer: 0.28,
      slasher_egg: 0.16,
      slasher: 0.14,
      puffer: 0.26,
      mummy: 0.2,
      healer: 0.16,
      buffer: 0.14,
    },
    {
      elites: [
        { enemy: 'gargoyle_elite', count: 1, at: 4 },
        { enemy: 'hornet_elite', count: 1, at: 15 },
      ],
    },
  ),
  // 16–19：虫潮
  wave(60, 5.2, {
    ant: 3,
    mosquito: 1.4,
    wasp: 1,
    spider: 0.8,
    slime: 0.8,
    gasbag: 0.8,
    queen: 0.12,
    spawner: 0.2,
    lamprey: 0.26,
    pursuer: 0.36,
    slasher_egg: 0.2,
    slasher: 0.2,
    puffer: 0.32,
    mummy: 0.24,
    healer: 0.2,
    buffer: 0.18,
    curse_slug: 0.08,
  }),
  wave(60, 5.6, {
    ant: 3,
    mosquito: 1.5,
    wasp: 1.1,
    spider: 0.8,
    slime: 0.8,
    gasbag: 0.9,
    queen: 0.14,
    spawner: 0.22,
    lamprey: 0.28,
    pursuer: 0.38,
    slasher_egg: 0.22,
    slasher: 0.22,
    puffer: 0.34,
    mummy: 0.26,
    healer: 0.22,
    buffer: 0.18,
    curse_slug: 0.08,
  }),
  wave(60, 6.0, {
    ant: 3,
    mosquito: 1.5,
    wasp: 1.1,
    spider: 0.9,
    slime: 0.9,
    gasbag: 0.9,
    queen: 0.15,
    spawner: 0.24,
    lamprey: 0.3,
    pursuer: 0.4,
    slasher_egg: 0.24,
    slasher: 0.24,
    puffer: 0.36,
    mummy: 0.28,
    healer: 0.22,
    buffer: 0.2,
    curse_slug: 0.08,
  }),
  wave(60, 6.4, {
    ant: 3,
    mosquito: 1.6,
    wasp: 1.2,
    spider: 0.9,
    slime: 0.9,
    gasbag: 1,
    queen: 0.16,
    spawner: 0.26,
    lamprey: 0.32,
    pursuer: 0.42,
    slasher_egg: 0.24,
    slasher: 0.26,
    puffer: 0.38,
    mummy: 0.3,
    healer: 0.24,
    buffer: 0.22,
    curse_slug: 0.09,
  }),
  // 20：最终 Boss 波（螳螂女王 / 泰坦兜虫轮换），另有少量小怪
  { ...wave(0, 2.2, { ant: 2, mosquito: 1, wasp: 0.4 }), duration: null, boss: 'boss_pool' },
];

const ELITE_ROTATION = ['soldier', 'hornet_elite', 'gargoyle_elite'] as const;

/** 获取任意波次定义：1~20 读取配置表，第 21 波起自动生成无尽递增波次 */
export function waveDefFor(waveNum: number): WaveDef {
  if (waveNum <= WAVES.length) return WAVES[Math.max(0, waveNum - 1)];
  const extra = waveNum - WAVES.length;
  const rate = Math.min(11.5, 6.6 + extra * 0.45);
  const elites: { enemy: string; count: number; at: number }[] = [];
  let boss: string | undefined;
  if (extra % 5 === 0) {
    // 无尽模式每 5 波（25 / 30 / 35...）作为里程碑 Boss 波，轮换泰坦兜虫与螳螂女王
    boss = extra % 10 === 5 ? 'goliath_boss' : 'mantis';
    const pairs = Math.min(2, 1 + Math.floor(extra / 15));
    const eliteId = ELITE_ROTATION[Math.floor(extra / 5) % ELITE_ROTATION.length];
    elites.push({ enemy: eliteId, count: pairs, at: 14 });
  } else if (extra >= 2 && extra % 2 === 0) {
    // 第 21 波作为无尽过渡热身波，第 22 波起每 2 波三精英轮换（兵蚁 / 皇家胡蜂 / 曜石甲像）
    const eliteId = ELITE_ROTATION[Math.floor(extra / 2) % ELITE_ROTATION.length];
    elites.push({ enemy: eliteId, count: 1, at: 6 });
  }
  return wave(
    60,
    rate,
    {
      ant: 2.4,
      mosquito: 1.4,
      wasp: 1.1,
      spider: 0.9,
      slime: 0.9,
      gasbag: 1.0,
      queen: 0.18,
      spawner: 0.24,
      lamprey: 0.3,
      pursuer: 0.36,
      slasher_egg: 0.24,
      slasher: 0.24,
      puffer: 0.34,
      mummy: 0.24,
      healer: 0.22,
      buffer: 0.2,
      curse_slug: 0.08,
    },
    { ...(elites.length > 0 ? { elites } : {}), ...(boss ? { boss } : {}) },
  );
}
