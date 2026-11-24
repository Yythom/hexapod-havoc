import type { Stats } from '../core/stats';
import { BROTATO_WEAPONS } from './weaponsBrotato';

export type WeaponKind = 'melee' | 'ranged' | 'toxin' | 'summon' | 'device';

/** Brotato 的 17 个武器 Class（套装按 2/3/4/5/6 把分五档） */
export type WeaponClass =
  | 'Blade'
  | 'Blunt'
  | 'Elemental'
  | 'Ethereal'
  | 'Explosive'
  | 'Gun'
  | 'Heavy'
  | 'Legendary'
  | 'Medical'
  | 'Medieval'
  | 'Musical'
  | 'Naval'
  | 'Precise'
  | 'Primitive'
  | 'Support'
  | 'Tool'
  | 'Unarmed';

export const CLASS_LABEL: Record<WeaponClass, string> = {
  Blade: '刀刃',
  Blunt: '钝器',
  Elemental: '元素',
  Ethereal: '虚灵',
  Explosive: '爆炸',
  Gun: '枪械',
  Heavy: '重型',
  Legendary: '传说',
  Medical: '医疗',
  Medieval: '中世纪',
  Musical: '音乐',
  Naval: '海军',
  Precise: '精准',
  Primitive: '原始',
  Support: '支援',
  Tool: '工具',
  Unarmed: '徒手',
};

export const CLASS_ORDER: WeaponClass[] = [
  'Blade',
  'Blunt',
  'Elemental',
  'Ethereal',
  'Explosive',
  'Gun',
  'Heavy',
  'Legendary',
  'Medical',
  'Medieval',
  'Musical',
  'Naval',
  'Precise',
  'Primitive',
  'Support',
  'Tool',
  'Unarmed',
];

export type ScalingStat = 'melee' | 'ranged' | 'toxin' | 'elemental' | 'armor' | 'engineering';

export const KIND_LABEL: Record<WeaponKind, string> = {
  melee: '近战',
  ranged: '远程',
  toxin: '毒素',
  summon: '召唤',
  device: '机关',
};

export interface ProjectileSpec {
  texture: string;
  speed: number;
  radius: number;
  /** 可以额外穿透的敌人数 */
  pierce: number;
  /** 飞行时的自转速度（弧度/秒），0 表示始终朝飞行方向 */
  spin: number;
  /** 随机散布角（弧度，单侧） */
  spread: number;
  /** 一次发射几发（扇形排开） */
  count?: number;
  /** 多发时的扇形总角度（弧度） */
  arc?: number;
  /** 命中后爆炸的半径 */
  explode?: number;
  /** 命中时叠几层毒 */
  poison?: number;
  /** 抛射：不和敌人碰撞，落到目标点后留下毒云 */
  lob?: { cloudRadius: number; cloudTime: number };
  /** 回旋：飞到最远处后飞回身边，去程和回程各能命中一次 */
  returning?: boolean;
  /** 弹跳：命中后弹向附近最近的怪，最多弹几次、每次伤害衰减 */
  bounce?: { times: number; range: number; falloff: number };
  /** 滚动：越滚越大，飞到最远时半径变为原来的 1 + grow 倍 */
  roll?: { grow: number };
  /** 喷火：飞行中逐渐变大、变淡 */
  fade?: boolean;
  /** 追踪：每秒最多转向多少弧度（0 表示不追踪） */
  homing?: number;
}

export type MeleeStyle = 'thrust' | 'sweep' | 'snap' | 'bash' | 'charge' | 'flurry' | 'pierce';

export interface MeleeSpec {
  /** 武器头的命中半径 */
  hitRadius: number;
  /** thrust 直刺；sweep 扇形横扫；snap 钳颚夹击；bash 盾击震荡波；charge 重角冲刺；flurry 高速连刺；pierce 破甲穿刺 */
  style: MeleeStyle;
  /** 横扫或扇形震荡波的单侧角度（弧度） */
  arc?: number;
}

export interface SummonSpec {
  type: 'aphid' | 'web' | 'moth';
  /** 蚜虫、飞蛾：各品质的数量 */
  counts?: number[];
  /** 蛛网：最多同时存在几张、持续时间、减速比例 */
  max?: number;
  duration?: number;
  slow?: number;
}

/** 机关：放在地上、持续到本波结束 */
export interface DeviceSpec {
  type: 'mine' | 'turret';
  /** 每把武器最多同时存在几个，超出时替换最早放下的 */
  max: number;
  /** 地雷：爆炸半径 */
  radius?: number;
  /** 炮台：每隔几秒放一座（攻击间隔 cooldown 是炮台的射击间隔） */
  placeEvery?: number;
}

/** 命中时的附加效果 */
export interface HitEffects {
  /** 点燃（灼烧每秒伤害 = 这一击的 30%） */
  burn?: boolean;
  /** 叠几层冰 */
  freeze?: number;
  /** 让目标易伤 */
  vulnerable?: boolean;
  /** 减速比例（0~1） */
  slow?: number;
  /** 命中时给自己回 1 血的概率 */
  heal?: number;
  /** 击杀时额外掉 1 颗花蜜的概率 */
  nectarOnKill?: number;
  /** 命中时向周围额外发射的弹片 */
  burst?: { count: number; damage: number; texture: string; radius: number; speed: number };
  /** 命中时按目标当前生命值造成额外伤害的比例（0.1 = 10%） */
  currentHpPct?: number;
  /** 命中时叠几层毒 */
  poison?: number;
}

/** 单把武器某一品质（I~IV）的完整数值 */
export interface WeaponTier {
  damage: number;
  cooldown: number;
  critChance: number;
  critMultiplier: number;
  range: number;
  knockback: number;
  /** 武器自带的吸取几率（每次命中回 1 血） */
  lifesteal: number;
  /** 商店基础价（未乘波次涨价） */
  price: number;
  scaling: Partial<Record<ScalingStat, number>>;
}

/** Brotato 武器的特殊规则；未实现的字段在结算层按 0/无处理 */
export interface WeaponSpecial {
  /** 每有一个空武器槽，伤害增加多少（绝对值） */
  freeSlotDamage?: number;
  /** 对生命高于 80% 的敌人伤害 +pct */
  damageVsHighHp?: number;
  /** 对生命低于 30% 的敌人伤害 +pct */
  damageVsLowHp?: number;
  /** 命中时直接处决非精英/Boss 的概率 */
  executeChance?: number;
  /** 命中时破坏武器并掉落花蜜的概率（Brick） */
  breakChance?: number;
  /** 暴击击杀额外掉 1 颗花蜜的概率 */
  materialOnCritKill?: number;
  /** 近战命中时按概率爆炸 */
  explodeChance?: number;
  /** 近战爆炸半径 */
  explodeRadius?: number;
  /** 攻击被灼烧目标必定暴击（Spoon） */
  critVsBurning?: boolean;
  /** 每秒自伤（Scythe） */
  selfDamagePerSec?: number;
  /** 本波每击杀一只，攻速 +pct（Ghost Flint） */
  growthAttackSpeed?: number;
  /** 本波每击杀一只，最大生命 +1（Ghost Scepter） */
  growthMaxHp?: number;
  /** 站立不动时的伤害/移速修正（Jousting Lance） */
  stationaryPenalty?: { damagePct: number; speedPct: number };
  /** 每移动多少像素，射程 +1（Hiking Pole） */
  rangePerStep?: number;
  /** 每多一把同名武器，基础伤害 +n（Stick） */
  damagePerCopy?: number;
  /** 击杀回复生命 */
  healOnKill?: number;
  /** 每损失 10% 生命，吸取 +pct（Sharp Tooth） */
  lifestealPerMissingHp?: number;
  /** 拾取花蜜时重置冷却（Blunderbuss） */
  cooldownResetOnPickup?: boolean;
  /** 攻击时重置所有炮台冷却（War Hammer） */
  turretResetOnAttack?: boolean;
  /** 每 5 秒基础伤害 +n，受伤后重置（Railgun） */
  rampingDamage?: number;
  /** 暴击时弹跳次数（Shuriken） */
  bounceOnCrit?: number;
  /** 暴击时穿透次数（Crossbow） */
  pierceOnCrit?: number;
  /** 每装备一把武器，甲壳变化（Excalibur） */
  armorPerWeapon?: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  classes: WeaponClass[];
  /** 普通品质的基础伤害（兼容旧字段，等于 tiers[0].damage） */
  damage: number;
  /** 普通品质的攻击间隔（秒，等于 tiers[0].cooldown） */
  cooldown: number;
  range: number;
  /** 属性系数：伤害 += 属性值 × 系数（等于 tiers[0].scaling） */
  scaling: Partial<Record<ScalingStat, number>>;
  critMultiplier: number;
  /** 命中时给敌人的击退初速度（像素/秒，等于 tiers[0].knockback） */
  knockback: number;
  /** 四个品质的完整数值；索引 0~3 = 普通/精良/稀有/传说 */
  tiers: [WeaponTier, WeaponTier, WeaponTier, WeaponTier];
  /** 最低可从商店出现的品质（Brotato 里只在高品质出现的武器） */
  minTier?: number;
  /** 挂在腿上显示的贴图；界面里用 `${icon}@ui` 的大图 */
  icon: string;
  /** 没有现成图标时用的程序化图标形状/颜色 */
  iconShape?: string;
  iconColor?: string;
  projectile?: ProjectileSpec;
  melee?: MeleeSpec;
  summon?: SummonSpec;
  device?: DeviceSpec;
  /** 光束：持续照射最近的怪，每个攻击间隔结算一次 */
  beam?: boolean;
  /** 链式闪电：命中后在怪之间跳跃 */
  chain?: { jumps: number; range: number; falloff: number };
  onHit?: HitEffects;
  special?: WeaponSpecial;
  /** 武器自带的被动属性（装备时生效） */
  bonusStats?: Partial<Stats>;
  /** 生命低于 50% 时攻速加成 */
  lowHpHaste?: number;
  /** 成长：本局每击杀 kills 只，伤害永久 +1 */
  growth?: { kills: number };
  /** false 表示商店不出（蚁后的工蚁） */
  shop?: boolean;
}

/** 品质：倍率、基础价、颜色（道具品质也共用这里的名字和颜色）。 */
export const TIERS = [
  { name: '普通', damage: 1.0, cooldown: 1.0, price: 22, color: 0xc9c1ae, css: '#d8d0bc' },
  { name: '精良', damage: 1.5, cooldown: 0.95, price: 48, color: 0x4f9be8, css: '#6fb2ff' },
  { name: '稀有', damage: 2.2, cooldown: 0.9, price: 98, color: 0xb066e8, css: '#c88cff' },
  { name: '传说', damage: 3.2, cooldown: 0.85, price: 180, color: 0xf0a030, css: '#ffb648' },
] as const;

export function tierOf(def: WeaponDef, tier: number): WeaponTier {
  const i = Math.max(0, Math.min(3, Math.floor(tier)));
  return def.tiers[i] ?? def.tiers[0];
}

/** 蚁后的工蚁：不在商店出售 */
const WORKERS: WeaponDef = {
  id: 'workers',
  name: '工蚁',
  kind: 'summon',
  classes: ['Support'],
  damage: 7,
  cooldown: 0.9,
  range: 400,
  scaling: { melee: 0.5 },
  critMultiplier: 2,
  knockback: 60,
  tiers: [
    { damage: 7, cooldown: 0.9, critChance: 0.03, critMultiplier: 2, range: 400, knockback: 60, lifesteal: 0, price: 0, scaling: { melee: 0.5 } },
    { damage: 10, cooldown: 0.88, critChance: 0.03, critMultiplier: 2, range: 400, knockback: 60, lifesteal: 0, price: 0, scaling: { melee: 0.5 } },
    { damage: 14, cooldown: 0.86, critChance: 0.03, critMultiplier: 2, range: 400, knockback: 60, lifesteal: 0, price: 0, scaling: { melee: 0.5 } },
    { damage: 21, cooldown: 0.84, critChance: 0.03, critMultiplier: 2, range: 400, knockback: 60, lifesteal: 0, price: 0, scaling: { melee: 0.5 } },
  ],
  icon: 'w-aphids',
  summon: { type: 'aphid' },
  shop: false,
};

/** 全部武器定义（95 把 Brotato 对齐武器 + 蚁后的工蚁） */
const ALL: WeaponDef[] = [...BROTATO_WEAPONS, WORKERS];

export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(ALL.map((d) => [d.id, d]));

/** 商店里能出现的武器 */
export const SHOP_WEAPONS = BROTATO_WEAPONS;
