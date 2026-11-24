export type EnemyBehavior =
  | 'chase'
  | 'swarm'
  | 'charger'
  | 'ranged'
  | 'bomber'
  | 'summoner'
  | 'buffer'
  | 'healer'
  | 'pursuer'
  | 'egg'
  | 'slasher'
  | 'puffer'
  | 'lamprey'
  | 'spitter'
  | 'curse_slug'
  | 'mummy'
  | 'elite'
  | 'elite_hornet'
  | 'elite_gargoyle'
  | 'boss'
  | 'boss_goliath'
  | 'tree'
  | 'lootbug';

export interface EnemyDef {
  id: string;
  name: string;
  /** 第 1 波的基础数值 */
  hp: number;
  /** 接触伤害 */
  damage: number;
  speed: number;
  /** 掉落花蜜数量范围 */
  nectar: [number, number];
  radius: number;
  texture: string;
  /** 贴图缩放（比如小黏菌复用黏菌贴图） */
  scale?: number;
  behavior: EnemyBehavior;
  /** 每过一波生命增长的比例（默认 0.55） */
  hpGrowth?: number;
  /** 每过一波伤害增长的比例（默认 0.3） */
  damageGrowth?: number;
  /** 击退抗性 0~1 */
  knockbackResist?: number;
  /** 死后分裂成什么、几个 */
  splitInto?: { id: string; count: number };
  /** 冲刺速度（冲撞类） */
  dashSpeed?: number;
  /** 技能伤害（吐丝、爆炸、震击、Boss 攻击） */
  skillDamage?: number;
  /** 精英：必掉宝箱 */
  elite?: boolean;
  boss?: boolean;
}

/** 怪物表，见 DESIGN.md 第 7 节。数值是第 1 波的基础值，按下面的成长率随波次变强。 */
const LIST: EnemyDef[] = [
  { id: 'ant', name: '工蚁', hp: 4, damage: 1, speed: 110, nectar: [1, 1], radius: 11, texture: 'ant', behavior: 'chase' },
  { id: 'mosquito', name: '蚊子', hp: 2, damage: 1, speed: 170, nectar: [0, 1], radius: 9, texture: 'mosquito', behavior: 'swarm' },
  {
    id: 'wasp',
    name: '黄蜂',
    hp: 8,
    damage: 2,
    speed: 90,
    nectar: [2, 2],
    radius: 13,
    texture: 'wasp',
    behavior: 'charger',
    dashSpeed: 420,
  },
  {
    id: 'spider',
    name: '跳蛛',
    hp: 10,
    damage: 2,
    speed: 80,
    nectar: [2, 2],
    radius: 13,
    texture: 'spider',
    behavior: 'ranged',
    skillDamage: 2,
  },
  {
    id: 'slime',
    name: '黏菌',
    hp: 16,
    damage: 2,
    speed: 60,
    nectar: [2, 2],
    radius: 16,
    texture: 'slime',
    behavior: 'chase',
    splitInto: { id: 'slimelet', count: 2 },
  },
  {
    id: 'slimelet',
    name: '小黏菌',
    hp: 6.4,
    damage: 1,
    speed: 80,
    nectar: [1, 1],
    radius: 10,
    texture: 'slime',
    scale: 0.62,
    behavior: 'chase',
  },
  {
    id: 'gasbag',
    name: '气囊虫',
    hp: 6,
    damage: 1,
    speed: 120,
    nectar: [1, 1],
    radius: 13,
    texture: 'gasbag',
    behavior: 'bomber',
    skillDamage: 5,
  },
  {
    id: 'queen',
    name: '蚁后',
    hp: 40,
    damage: 1,
    speed: 50,
    nectar: [5, 5],
    radius: 18,
    texture: 'queen',
    behavior: 'summoner',
    knockbackResist: 0.5,
  },
  {
    id: 'pursuer',
    name: '疾影猎虫',
    hp: 13,
    damage: 2,
    speed: 96,
    nectar: [2, 3],
    radius: 13,
    texture: 'pursuer',
    behavior: 'pursuer',
  },
  {
    id: 'healer',
    name: '绿露医虫',
    hp: 22,
    damage: 1,
    speed: 92,
    nectar: [3, 4],
    radius: 14,
    texture: 'healer',
    behavior: 'healer',
    knockbackResist: 0.25,
  },
  {
    id: 'buffer',
    name: '狂化鸣蝉',
    hp: 26,
    damage: 1,
    speed: 102,
    nectar: [4, 5],
    radius: 15,
    texture: 'buffer',
    behavior: 'buffer',
    knockbackResist: 0.3,
  },
  {
    id: 'slasher_egg',
    name: '镰斩魔卵',
    hp: 20,
    damage: 1,
    speed: 0,
    nectar: [1, 2],
    radius: 15,
    texture: 'slasher_egg',
    behavior: 'egg',
    knockbackResist: 1,
  },
  {
    id: 'slasher',
    name: '镰刃螳虫',
    hp: 32,
    damage: 2,
    speed: 94,
    nectar: [4, 6],
    radius: 16,
    texture: 'slasher',
    behavior: 'slasher',
    skillDamage: 3.5,
    knockbackResist: 0.35,
  },
  {
    id: 'puffer',
    name: '棘球毒虫',
    hp: 15,
    damage: 2,
    speed: 78,
    nectar: [2, 3],
    radius: 15,
    texture: 'puffer',
    behavior: 'puffer',
    skillDamage: 2.2,
  },
  {
    id: 'lamprey',
    name: '噬蜜飞鳗',
    hp: 18,
    damage: 2,
    speed: 112,
    nectar: [3, 4],
    radius: 14,
    texture: 'lamprey',
    behavior: 'lamprey',
    dashSpeed: 390,
    skillDamage: 2.2,
  },
  {
    id: 'spawner',
    name: '腐巢母虫',
    hp: 38,
    damage: 2,
    speed: 54,
    nectar: [3, 4],
    radius: 19,
    texture: 'spawner',
    behavior: 'chase',
    knockbackResist: 0.65,
    splitInto: { id: 'spitter', count: 3 },
  },
  {
    id: 'spitter',
    name: '吐酸幼虫',
    hp: 9,
    damage: 1,
    speed: 105,
    nectar: [1, 1],
    radius: 10,
    texture: 'spitter',
    behavior: 'spitter',
    skillDamage: 1.8,
  },
  {
    id: 'curse_slug',
    name: '厄运紫蛞蝓',
    hp: 24,
    damage: 0,
    speed: 96,
    nectar: [5, 7],
    radius: 15,
    texture: 'curse_slug',
    behavior: 'curse_slug',
    knockbackResist: 0.3,
    hpGrowth: 0.5,
  },
  {
    id: 'mummy',
    name: '滚球毛虫',
    hp: 28,
    damage: 2,
    speed: 88,
    nectar: [3, 4],
    radius: 16,
    texture: 'mummy',
    behavior: 'mummy',
    knockbackResist: -1.8,
  },
  {
    id: 'soldier',
    name: '兵蚁',
    hp: 300,
    damage: 3,
    speed: 100,
    nectar: [20, 20],
    radius: 22,
    texture: 'soldier',
    behavior: 'elite',
    dashSpeed: 480,
    skillDamage: 4,
    knockbackResist: 0.85,
    elite: true,
  },
  {
    id: 'hornet_elite',
    name: '皇家胡蜂',
    hp: 235,
    damage: 3,
    speed: 112,
    nectar: [22, 22],
    radius: 21,
    texture: 'hornet_elite',
    behavior: 'elite_hornet',
    dashSpeed: 420,
    skillDamage: 2.5,
    knockbackResist: 0.8,
    elite: true,
  },
  {
    id: 'gargoyle_elite',
    name: '曜石甲像',
    hp: 270,
    damage: 3,
    speed: 94,
    nectar: [24, 24],
    radius: 24,
    texture: 'gargoyle_elite',
    behavior: 'elite_gargoyle',
    skillDamage: 2.8,
    knockbackResist: 0.9,
    elite: true,
  },
  {
    id: 'mantis',
    name: '螳螂女王',
    hp: 15000,
    damage: 15,
    speed: 90,
    nectar: [0, 0],
    radius: 38,
    texture: 'mantis',
    behavior: 'boss',
    skillDamage: 30,
    knockbackResist: 1,
    hpGrowth: 0,
    damageGrowth: 0,
    boss: true,
  },
  {
    id: 'goliath_boss',
    name: '泰坦兜虫',
    hp: 16500,
    damage: 16,
    speed: 82,
    nectar: [0, 0],
    radius: 40,
    texture: 'goliath_boss',
    behavior: 'boss_goliath',
    dashSpeed: 500,
    skillDamage: 28,
    knockbackResist: 1,
    hpGrowth: 0,
    damageGrowth: 0,
    boss: true,
  },
  {
    id: 'nymph',
    name: '螳螂若虫',
    hp: 15,
    damage: 3,
    speed: 130,
    nectar: [1, 1],
    radius: 12,
    texture: 'mantis',
    scale: 0.36,
    behavior: 'chase',
    damageGrowth: 0.1,
  },
  {
    id: 'tree',
    name: '蜜树',
    hp: 14,
    damage: 0,
    speed: 0,
    nectar: [3, 5],
    radius: 18,
    texture: 'tree',
    behavior: 'tree',
    knockbackResist: 1,
    hpGrowth: 0.35,
  },
  {
    id: 'boomshroom',
    name: '爆裂毒菇',
    hp: 16,
    damage: 0,
    speed: 0,
    nectar: [1, 2],
    radius: 17,
    texture: 'boomshroom',
    behavior: 'tree',
    knockbackResist: 1,
    hpGrowth: 0.45,
  },
  {
    id: 'deworb',
    name: '露珠冰球',
    hp: 14,
    damage: 0,
    speed: 0,
    nectar: [2, 3],
    radius: 16,
    texture: 'deworb',
    behavior: 'tree',
    knockbackResist: 1,
    hpGrowth: 0.4,
  },
  {
    id: 'lootbug',
    name: '宝藏虫',
    hp: 26,
    damage: 0,
    speed: 195,
    nectar: [8, 12],
    radius: 15,
    texture: 'lootbug',
    behavior: 'lootbug',
    knockbackResist: 0.45,
    hpGrowth: 0.45,
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

/** 默认生命成长：每过一波 +55% 基础生命 */
export const DEFAULT_HP_GROWTH = 0.65;

/**
 * 怪物生命随波次成长：
 * - 1~8 波：线性成长，保证开荒期流畅
 * - 9~20 波：叠加温和二次项，跟上玩家 6 槽+高阶武器+羁绊的乘性 DPS 爆发
 * - 21+ 无尽波：指数拉升（×1.28/波），让成型神装在 25~33 波迎来真正极限
 */
export function enemyHp(def: EnemyDef, wave: number): number {
  const base = def.hp * (1 + (def.hpGrowth ?? DEFAULT_HP_GROWTH) * (wave - 1));
  if (def.boss) return wave > 20 ? base * Math.pow(1.28, wave - 20) : base;
  const lateWave = Math.min(wave, 20);
  const midCurve = lateWave > 8 ? 1 + 0.01 * (lateWave - 8) * (lateWave - 8) : 1;
  const scaled = base * midCurve;
  return wave > 20 ? scaled * Math.pow(1.28, wave - 20) : scaled;
}

/** 默认伤害成长：每过一波 +35% 基础伤害（小怪基础伤害只有 1~2，成长太低会被取整吃掉） */
export const DEFAULT_DAMAGE_GROWTH = 0.35;

/** 每过一波：伤害 × (1 + 成长率 × (波数 − 1))，无尽模式第 21 波起指数递增 */
export function enemyDamage(def: EnemyDef, wave: number): number {
  const base = def.damage * (1 + (def.damageGrowth ?? DEFAULT_DAMAGE_GROWTH) * (wave - 1));
  return wave > 20 ? base * Math.pow(1.15, wave - 20) : base;
}

export function enemySkillDamage(def: EnemyDef, wave: number): number {
  const base = (def.skillDamage ?? def.damage) * (1 + (def.damageGrowth ?? DEFAULT_DAMAGE_GROWTH) * (wave - 1));
  return wave > 20 ? base * Math.pow(1.15, wave - 20) : base;
}
