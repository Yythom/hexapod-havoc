import type { Stats } from '../core/stats';
import type { Mods } from './items';
import type { WeaponKind, WeaponTag } from './weapons';

/** 解锁条件：单局内达成 */
export type UnlockRule =
  | { kind: 'toxinDamage'; amount: number }
  | { kind: 'holdNectar'; amount: number }
  | { kind: 'weaponsHeld'; amount: number }
  | { kind: 'meleeKills'; amount: number }
  | { kind: 'summons'; amount: number }
  | { kind: 'speed'; amount: number }
  | { kind: 'win' }
  | { kind: 'armor'; amount: number }
  | { kind: 'lifesteal'; amount: number }
  | { kind: 'totalNectar'; amount: number }
  | { kind: 'devices'; amount: number };

export interface CharacterDef {
  id: string;
  name: string;
  /** 定位 */
  role: string;
  /** 外壳贴图 */
  shell: string;
  stats: Partial<Stats>;
  mods?: Partial<Mods>;
  perks: {
    /** 每次进商店，第一次刷新免费 */
    freeReroll?: boolean;
    /** 受到伤害时向身后喷一团毒雾 */
    hurtCloud?: boolean;
    /** 每波结束按持有花蜜给利息 */
    interest?: { per: number; max: number };
    /** 移速加成按 1:1 转成伤害加成 */
    speedToDamage?: boolean;
    /** 静止超过 delay 秒后伤害 × mult */
    idlePenalty?: { delay: number; mult: number };
    /** 前 waves 波武器伤害修正 pct；之后每波开始永久成长 */
    lateBloom?: { waves: number; pct: number; maxHp: number; damagePct: number };
    /** 被怪碰到时反弹 base + 甲壳 点伤害 */
    thorns?: { base: number };
    /** 闪避固定为 0 */
    noDodge?: boolean;
    /** 回复固定为 0，果实、蘑菇等回血物无效（只有吸取能回血） */
    lifestealOnly?: boolean;
    /** 感应范围为 0，花蜜要亲自走过去捡；捡到的每颗算 mult 颗 */
    touchPickup?: { mult: number };
    /** 不能装武器，按等级获得工蚁：base + (等级 − 1) × perLevel，最多 max 只 */
    workers?: { base: number; perLevel: number; max: number };
  };
  /** 加成和限制的说明（界面用） */
  pros: string[];
  cons: string[];
  /** 可选的初始武器（只有一把就不用选；没有表示不能装武器） */
  startWeapons: string[];
  /** 武器槽数量，默认 6 */
  slots?: number;
  /** 只能装这些类型的武器 */
  allowedKinds?: WeaponKind[];
  /** 商店出武器时有一半概率从这些标签里出 */
  favorTags?: WeaponTag[];
  /** null 表示初始可用 */
  unlock: UnlockRule | null;
}

/** 13 个角色，见 DESIGN.md 第 4 节、15.5 节 */
const LIST: CharacterDef[] = [
  {
    id: 'stag',
    name: '锹甲·钳钳',
    role: '均衡 / 新手',
    shell: 'beetle-stag',
    stats: {},
    perks: { freeReroll: true },
    pros: ['每次进商店，第一次刷新免费', '初始武器三选一'],
    cons: [],
    startWeapons: ['mandible', 'slingshot', 'acid'],
    unlock: null,
  },
  {
    id: 'rhino',
    name: '独角仙·大角',
    role: '近战坦克',
    shell: 'beetle-rhino',
    stats: { melee: 3, armor: 3, maxHp: 10, speedPct: -0.08 },
    mods: { rangedDamagePct: -0.5 },
    perks: {},
    pros: ['近战 +3', '甲壳 +3', '最大生命 +10'],
    cons: ['远程武器伤害 −50%', '移速 −8%'],
    startWeapons: ['horn'],
    unlock: null,
  },
  {
    id: 'bombardier',
    name: '屁步甲·噗噗',
    role: '毒素',
    shell: 'beetle-bombardier',
    stats: { toxin: 3 },
    mods: { flatBonusPct: -0.5 },
    perks: { hurtCloud: true },
    pros: ['毒素 +3', '受到伤害时向身后喷一团毒雾'],
    cons: ['近战、远程的固定加成只算一半'],
    startWeapons: ['acid'],
    unlock: { kind: 'toxinDamage', amount: 3000 },
  },
  {
    id: 'ladybug',
    name: '瓢虫·七星',
    role: '幸运 / 经济',
    shell: 'beetle-ladybug',
    stats: { luck: 30, damagePct: -0.1, maxHp: -3 },
    perks: { interest: { per: 20, max: 10 } },
    pros: ['幸运 +30', '每波结束按持有花蜜给利息（每 20 给 1，最多 10）'],
    cons: ['伤害 −10%', '最大生命 −3'],
    startWeapons: ['slingshot'],
    unlock: { kind: 'holdNectar', amount: 200 },
  },
  {
    id: 'spider',
    name: '蜘蛛·八爪',
    role: '堆数量',
    shell: 'bug-spider',
    stats: {},
    mods: { weaponDamagePct: -0.25 },
    perks: {},
    pros: ['8 个武器槽'],
    cons: ['所有武器伤害 −25%'],
    startWeapons: ['slingshot'],
    slots: 8,
    unlock: { kind: 'weaponsHeld', amount: 6 },
  },
  {
    id: 'mantis',
    name: '螳螂·双镰',
    role: '少而精 / 近战',
    shell: 'bug-mantis',
    stats: { damagePct: 0.25 },
    mods: { meleeCritBonus: 0.5 },
    perks: {},
    pros: ['近战暴击倍率 +0.5', '伤害 +25%'],
    cons: ['只有 4 个武器槽', '只能装近战武器'],
    startWeapons: ['scythe'],
    slots: 4,
    allowedKinds: ['melee'],
    unlock: { kind: 'meleeKills', amount: 500 },
  },
  {
    id: 'antqueen',
    name: '蚁后·千军',
    role: '纯召唤',
    shell: 'bug-antqueen',
    stats: { maxHp: 10 },
    perks: { workers: { base: 4, perLevel: 1, max: 30 } },
    pros: ['开局 4 只工蚁，每升一级多 1 只', '工蚁每 5 波升一档品质', '最大生命 +10'],
    cons: ['不能装武器'],
    startWeapons: [],
    slots: 0,
    unlock: { kind: 'summons', amount: 8 },
  },
  {
    id: 'tiger',
    name: '虎甲·疾风',
    role: '走位输出',
    shell: 'beetle-tiger',
    stats: { speedPct: 0.15 },
    perks: { speedToDamage: true, idlePenalty: { delay: 0.5, mult: 0.5 } },
    pros: ['移速 +15%', '每 1% 移速加成 = 伤害 +1%'],
    cons: ['静止超过 0.5 秒伤害 −50%'],
    startWeapons: ['legspike'],
    unlock: { kind: 'speed', amount: 0.4 },
  },
  {
    id: 'cicada',
    name: '蝉·十七年',
    role: '后期爆发',
    shell: 'bug-cicada',
    stats: {},
    perks: { lateBloom: { waves: 5, pct: -0.3, maxHp: 2, damagePct: 0.03 } },
    pros: ['第 6 波起每波开始：最大生命 +2、伤害 +3%（永久）'],
    cons: ['前 5 波所有武器伤害 −30%'],
    startWeapons: ['slingshot'],
    unlock: { kind: 'win' },
  },
  {
    id: 'caterpillar',
    name: '刺蛾幼虫·毛刺',
    role: '站撸反伤',
    shell: 'bug-caterpillar',
    stats: { armor: 3 },
    perks: { thorns: { base: 3 }, noDodge: true },
    pros: ['被怪碰到时反弹 (3 + 甲壳) 点伤害', '甲壳 +3'],
    cons: ['闪避固定为 0'],
    startWeapons: ['shellshield'],
    unlock: { kind: 'armor', amount: 15 },
  },
  {
    id: 'mosquito',
    name: '蚊子·吸血',
    role: '一直打',
    shell: 'bug-mosquito',
    stats: { lifesteal: 0.15 },
    perks: { lifestealOnly: true },
    pros: ['吸取 +15%'],
    cons: ['回复固定为 0', '果实、蘑菇等回血无效'],
    startWeapons: ['stinger'],
    unlock: { kind: 'lifesteal', amount: 150 },
  },
  {
    id: 'dungbeetle',
    name: '蜣螂·推球',
    role: '经济冒险',
    shell: 'beetle-dung',
    stats: { speedPct: 0.05 },
    perks: { touchPickup: { mult: 1.5 } },
    pros: ['亲自捡到的花蜜平均每颗算 1.5 颗', '移速 +5%'],
    cons: ['感应范围为 0，要走过去捡', '波次结束时没捡的只算一颗'],
    startWeapons: ['dungball'],
    unlock: { kind: 'totalNectar', amount: 1500 },
  },
  {
    id: 'termite',
    name: '白蚁·筑巢',
    role: '建筑',
    shell: 'bug-termite',
    stats: { engineering: 6 },
    mods: { nonDeviceDamagePct: -0.3 },
    perks: {},
    pros: ['工程 +6', '开局自带蚁丘炮台', '商店更容易出机关武器'],
    cons: ['非机关武器伤害 −30%'],
    startWeapons: ['turret'],
    favorTags: ['机关'],
    unlock: { kind: 'devices', amount: 30 },
  },
];

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const CHARACTER_ORDER = LIST.map((c) => c.id);

export function unlockText(rule: UnlockRule): string {
  switch (rule.kind) {
    case 'toxinDamage':
      return `单局累计造成 ${rule.amount} 点毒素伤害`;
    case 'holdNectar':
      return `单局同时持有 ${rule.amount} 花蜜`;
    case 'weaponsHeld':
      return `同时装着 ${rule.amount} 把武器`;
    case 'meleeKills':
      return `单局用近战武器击杀 ${rule.amount} 只`;
    case 'summons':
      return `同时拥有 ${rule.amount} 只召唤物`;
    case 'speed':
      return `移速加成达到 +${Math.round(rule.amount * 100)}%`;
    case 'win':
      return '用任意角色通关任意难度';
    case 'armor':
      return `甲壳达到 ${rule.amount}`;
    case 'lifesteal':
      return `单局靠吸取累计回复 ${rule.amount} 生命`;
    case 'totalNectar':
      return `单局累计收集 ${rule.amount} 花蜜`;
    case 'devices':
      return `单局放置 ${rule.amount} 个机关`;
  }
}

/** 角色的武器槽数量（不含道具加成） */
export function baseSlots(c: CharacterDef): number {
  return c.slots ?? 6;
}
