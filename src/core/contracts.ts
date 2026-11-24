/**
 * 波间里程碑「后院赌约」与「蜗老板蜕壳赋能台」配置：
 * - 第 5 / 10 / 15 波结算后提供二选一高风险高回报赌约（也可稳健领保底花蜜）
 * - 第 4 波起商店开放「蜕壳赋能」，给武器打上专属附魔或熔炼卡手道具
 */

export type ContractId = 'elite_bounty' | 'no_heal_vow' | 'swarm_harvest' | 'glass_frenzy' | 'curse_tribute';

export interface ContractDef {
  id: ContractId;
  name: string;
  risk: string;
  reward: string;
  accent: number;
  css: string;
}

export const CONTRACTS: Record<ContractId, ContractDef> = {
  elite_bounty: {
    id: 'elite_bounty',
    name: '猎王悬赏',
    risk: '下一波额外空降 1 只精英怪',
    reward: '过关后立刻获得 1 个免费宝箱 + 45 花蜜',
    accent: 0xffb648,
    css: '#ffd478',
  },
  no_heal_vow: {
    id: 'no_heal_vow',
    name: '断愈死斗',
    risk: '下一波禁用所有回血（回复/吸取/果实无效）',
    reward: '撑过后永久获得 最大生命 +10、甲壳 +3',
    accent: 0xff5a68,
    css: '#ff96a0',
  },
  swarm_harvest: {
    id: 'swarm_harvest',
    name: '狂潮收割',
    risk: '下一波刷怪密度 +40%',
    reward: '下一波花蜜与经验获取 +55%，并永久 采蜜 +10',
    accent: 0x5de862,
    css: '#a4ffaa',
  },
  glass_frenzy: {
    id: 'glass_frenzy',
    name: '薄壳狂袭',
    risk: '下一波受到伤害 +35%',
    reward: '下一波全伤害 +40%，过关额外掉 1 个免费宝箱',
    accent: 0x62d8ff,
    css: '#aceeff',
  },
  curse_tribute: {
    id: 'curse_tribute',
    name: '深渊献祭',
    risk: '立刻获得 诅咒 +6（怪物更强但掉落更丰厚）',
    reward: '立刻获得 70 花蜜，且下一波商店额外刷出诅咒强化货',
    accent: 0xc068ff,
    css: '#e2a8ff',
  },
};

export const CONTRACT_ORDER: ContractId[] = ['elite_bounty', 'no_heal_vow', 'swarm_harvest', 'glass_frenzy', 'curse_tribute'];

/** 第 5 / 10 / 15 波结算后触发后院赌约（无尽模式不再打断节奏） */
export function isContractWave(wave: number): boolean {
  return wave === 5 || wave === 10 || wave === 15;
}

/** 抽取两条不同的赌约供选择 */
export function rollContracts(): [ContractId, ContractId] {
  const pool = [...CONTRACT_ORDER];
  const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  return [a, b];
}

// ---------- 蜗老板蜕壳赋能（武器附魔） ----------

export type WeaponEnchantId = 'vamp' | 'ignite' | 'frost' | 'greed';

export interface WeaponEnchantDef {
  id: WeaponEnchantId;
  name: string;
  short: string;
  desc: string;
  color: number;
  css: string;
}

export const WEAPON_ENCHANTS: Record<WeaponEnchantId, WeaponEnchantDef> = {
  vamp: {
    id: 'vamp',
    name: '嗜血附魔',
    short: '血',
    desc: '该武器命中额外获得 +6% 吸取',
    color: 0xff4668,
    css: '#ff8a9e',
  },
  ignite: {
    id: 'ignite',
    name: '炽焰附魔',
    short: '焰',
    desc: '该武器命中点燃目标（灼烧伤害 +20%）',
    color: 0xff8230,
    css: '#ffb878',
  },
  frost: {
    id: 'frost',
    name: '寒霜附魔',
    short: '霜',
    desc: '该武器命中额外叠 1 层冰并减速',
    color: 0x5cd8ff,
    css: '#9ceeff',
  },
  greed: {
    id: 'greed',
    name: '贪婪附魔',
    short: '蜜',
    desc: '该武器击杀敌人时 22% 概率多掉 1 花蜜',
    color: 0xffd038,
    css: '#ffe888',
  },
};

export const ENCHANT_ORDER: WeaponEnchantId[] = ['vamp', 'ignite', 'frost', 'greed'];

/** 武器赋能费用：随波次微涨 */
export function enchantCost(wave: number): number {
  return Math.round(28 + wave * 4);
}
