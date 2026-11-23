export type EnemyBehavior = 'chase' | 'swarm' | 'charger' | 'ranged' | 'bomber' | 'summoner' | 'elite' | 'boss';

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
    id: 'mantis',
    name: '螳螂女王',
    hp: 9000,
    damage: 15,
    speed: 85,
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
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

/** 默认生命成长：每过一波 +55% 基础生命 */
export const DEFAULT_HP_GROWTH = 0.55;

/** 每过一波：生命 × (1 + 成长率 × (波数 − 1)) */
export function enemyHp(def: EnemyDef, wave: number): number {
  return def.hp * (1 + (def.hpGrowth ?? DEFAULT_HP_GROWTH) * (wave - 1));
}

/** 默认伤害成长：每过一波 +30% 基础伤害（小怪基础伤害只有 1~2，成长太低会被取整吃掉） */
export const DEFAULT_DAMAGE_GROWTH = 0.3;

/** 每过一波：伤害 × (1 + 成长率 × (波数 − 1)) */
export function enemyDamage(def: EnemyDef, wave: number): number {
  return def.damage * (1 + (def.damageGrowth ?? DEFAULT_DAMAGE_GROWTH) * (wave - 1));
}

export function enemySkillDamage(def: EnemyDef, wave: number): number {
  return (def.skillDamage ?? def.damage) * (1 + (def.damageGrowth ?? DEFAULT_DAMAGE_GROWTH) * (wave - 1));
}
