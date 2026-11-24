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
  // 6–10：45 秒
  wave(45, 3.1, { ant: 3, mosquito: 1.2, wasp: 0.6, spider: 0.4 }),
  wave(45, 3.3, { ant: 3, mosquito: 1.2, wasp: 0.7, spider: 0.5 }),
  wave(45, 3.5, { ant: 3, mosquito: 1.2, wasp: 0.7, spider: 0.5, slime: 0.5 }),
  wave(45, 3.7, { ant: 3, mosquito: 1.3, wasp: 0.8, spider: 0.6, slime: 0.6 }),
  wave(45, 3.3, { ant: 3, mosquito: 1.2, wasp: 0.7, spider: 0.5, slime: 0.5 }, { elites: [{ enemy: 'soldier', count: 1, at: 3 }] }),
  // 11–19：60 秒
  wave(60, 4.0, { ant: 3, mosquito: 1.2, wasp: 0.8, spider: 0.6, slime: 0.6, gasbag: 0.6 }),
  wave(60, 4.2, { ant: 3, mosquito: 1.3, wasp: 0.9, spider: 0.6, slime: 0.6, gasbag: 0.7 }),
  wave(60, 4.4, { ant: 3, mosquito: 1.3, wasp: 0.9, spider: 0.7, slime: 0.7, gasbag: 0.7, queen: 0.1 }),
  wave(60, 4.6, { ant: 3, mosquito: 1.4, wasp: 1, spider: 0.7, slime: 0.7, gasbag: 0.8, queen: 0.12 }),
  wave(
    60,
    4.2,
    { ant: 3, mosquito: 1.3, wasp: 0.9, spider: 0.7, slime: 0.7, gasbag: 0.7, queen: 0.1 },
    {
      elites: [
        { enemy: 'soldier', count: 1, at: 4 },
        { enemy: 'hornet_elite', count: 1, at: 14 },
      ],
    },
  ),
  // 16–19：虫潮
  wave(60, 5.2, { ant: 3, mosquito: 1.4, wasp: 1, spider: 0.8, slime: 0.8, gasbag: 0.8, queen: 0.12 }),
  wave(60, 5.6, { ant: 3, mosquito: 1.5, wasp: 1.1, spider: 0.8, slime: 0.8, gasbag: 0.9, queen: 0.14 }),
  wave(60, 6.0, { ant: 3, mosquito: 1.5, wasp: 1.1, spider: 0.9, slime: 0.9, gasbag: 0.9, queen: 0.15 }),
  wave(60, 6.4, { ant: 3, mosquito: 1.6, wasp: 1.2, spider: 0.9, slime: 0.9, gasbag: 1, queen: 0.16 }),
  // 20：最终 Boss 波（螳螂女王 / 泰坦兜虫轮换），另有少量小怪
  { ...wave(0, 2.2, { ant: 2, mosquito: 1, wasp: 0.4 }), duration: null, boss: 'boss_pool' },
];

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
    elites.push({ enemy: extra % 10 === 5 ? 'hornet_elite' : 'soldier', count: pairs, at: 14 });
  } else if (extra >= 2 && extra % 2 === 0) {
    // 第 21 波作为无尽过渡热身波，第 22 波起每 2 波轮换精英
    elites.push({ enemy: extra % 4 === 2 ? 'hornet_elite' : 'soldier', count: 1, at: 6 });
  }
  return wave(
    60,
    rate,
    { ant: 2.6, mosquito: 1.5, wasp: 1.2, spider: 1.0, slime: 1.0, gasbag: 1.1, queen: 0.22 },
    { ...(elites.length > 0 ? { elites } : {}), ...(boss ? { boss } : {}) },
  );
}
