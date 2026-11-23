export type WeaponKind = 'melee' | 'ranged' | 'toxin' | 'summon' | 'device';
export type WeaponTag = '甲角' | '尖刺' | '投掷' | '腺体' | '共生' | '火焰' | '电' | '机关' | '蜂蜜';
export type ScalingStat = 'melee' | 'ranged' | 'toxin' | 'armor' | 'engineering';

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
}

export interface MeleeSpec {
  /** 武器头的命中半径 */
  hitRadius: number;
  /** thrust 直刺；sweep 扇形横扫 */
  style: 'thrust' | 'sweep';
  /** 横扫的单侧角度（弧度） */
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

/** 机关：放在地上、持续到本波结束（DESIGN.md 15.2） */
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
  /** 命中时给自己回 1 血的概率 */
  heal?: number;
  /** 击杀时额外掉 1 颗花蜜的概率 */
  nectarOnKill?: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  tags: WeaponTag[];
  /** 普通品质的基础伤害 */
  damage: number;
  /** 普通品质的攻击间隔（秒） */
  cooldown: number;
  range: number;
  /** 属性系数：伤害 += 属性值 × 系数 */
  scaling: Partial<Record<ScalingStat, number>>;
  critMultiplier: number;
  /** 命中时给敌人的击退初速度（像素/秒） */
  knockback: number;
  /** 挂在腿上显示的贴图；界面里用 `${icon}@ui` 的大图 */
  icon: string;
  projectile?: ProjectileSpec;
  melee?: MeleeSpec;
  summon?: SummonSpec;
  device?: DeviceSpec;
  /** 光束：持续照射最近的怪，每个攻击间隔结算一次 */
  beam?: boolean;
  /** 链式闪电：命中后在怪之间跳跃 */
  chain?: { jumps: number; range: number; falloff: number };
  onHit?: HitEffects;
  /** 生命低于 50% 时攻速加成 */
  lowHpHaste?: number;
  /** 成长：本局每击杀 kills 只，伤害永久 +1 */
  growth?: { kills: number };
  /** false 表示商店不出（蚁后的工蚁） */
  shop?: boolean;
}

/** 品质：倍率、基础价、颜色（DESIGN.md 2.6）。道具品质也共用这里的名字和颜色。 */
export const TIERS = [
  { name: '普通', damage: 1.0, cooldown: 1.0, price: 22, color: 0xc9c1ae, css: '#d8d0bc' },
  { name: '精良', damage: 1.5, cooldown: 0.95, price: 48, color: 0x4f9be8, css: '#6fb2ff' },
  { name: '稀有', damage: 2.2, cooldown: 0.9, price: 98, color: 0xb066e8, css: '#c88cff' },
  { name: '传说', damage: 3.2, cooldown: 0.85, price: 180, color: 0xf0a030, css: '#ffb648' },
] as const;

/** 29 把武器，见 DESIGN.md 第 5 节、15.4 节 */
const LIST: WeaponDef[] = [
  {
    id: 'mandible',
    name: '大颚',
    kind: 'melee',
    tags: ['甲角'],
    damage: 10,
    cooldown: 1.0,
    range: 140,
    scaling: { melee: 1 },
    critMultiplier: 2,
    knockback: 260,
    icon: 'w-mandible',
    melee: { hitRadius: 18, style: 'thrust' },
  },
  {
    id: 'horn',
    name: '犄角',
    kind: 'melee',
    tags: ['甲角'],
    damage: 22,
    cooldown: 1.6,
    range: 160,
    scaling: { melee: 1.5 },
    critMultiplier: 2,
    knockback: 520,
    icon: 'w-horn',
    melee: { hitRadius: 22, style: 'thrust' },
  },
  {
    id: 'legspike',
    name: '刺足',
    kind: 'melee',
    tags: ['尖刺'],
    damage: 5,
    cooldown: 0.45,
    range: 120,
    scaling: { melee: 0.6 },
    critMultiplier: 2.5,
    knockback: 80,
    icon: 'w-legspike',
    melee: { hitRadius: 14, style: 'thrust' },
  },
  {
    id: 'scythe',
    name: '镰臂',
    kind: 'melee',
    tags: ['尖刺'],
    damage: 12,
    cooldown: 1.2,
    range: 170,
    scaling: { melee: 1 },
    critMultiplier: 2,
    knockback: 200,
    icon: 'w-scythe',
    melee: { hitRadius: 20, style: 'sweep', arc: 1.0 },
  },
  {
    id: 'shellshield',
    name: '甲壳盾',
    kind: 'melee',
    tags: ['甲角'],
    damage: 7,
    cooldown: 0.9,
    range: 120,
    scaling: { melee: 0.5, armor: 1 },
    critMultiplier: 2,
    knockback: 300,
    icon: 'w-shellshield',
    melee: { hitRadius: 22, style: 'thrust' },
  },
  {
    id: 'slingshot',
    name: '种子弹弓',
    kind: 'ranged',
    tags: ['投掷'],
    damage: 9,
    cooldown: 0.9,
    range: 380,
    scaling: { ranged: 1 },
    critMultiplier: 2,
    knockback: 200,
    icon: 'w-slingshot',
    projectile: { texture: 'seed', speed: 720, radius: 6, pierce: 0, spin: 14, spread: 0 },
  },
  {
    id: 'pine',
    name: '松针连射',
    kind: 'ranged',
    tags: ['尖刺'],
    damage: 3,
    cooldown: 0.18,
    range: 340,
    scaling: { ranged: 0.5 },
    critMultiplier: 2,
    knockback: 40,
    icon: 'w-pine',
    projectile: { texture: 'needle', speed: 900, radius: 4, pierce: 0, spin: 0, spread: 0.1 },
  },
  {
    id: 'acorn',
    name: '橡果炮',
    kind: 'ranged',
    tags: ['投掷'],
    damage: 18,
    cooldown: 1.8,
    range: 420,
    scaling: { ranged: 1.2 },
    critMultiplier: 2,
    knockback: 160,
    icon: 'w-acorn',
    projectile: { texture: 'acorn', speed: 520, radius: 8, pierce: 0, spin: 8, spread: 0, explode: 60 },
  },
  {
    id: 'dandelion',
    name: '蒲公英散射',
    kind: 'ranged',
    tags: ['投掷'],
    damage: 4,
    cooldown: 1.3,
    range: 300,
    scaling: { ranged: 0.6 },
    critMultiplier: 2,
    knockback: 70,
    icon: 'w-dandelion',
    projectile: { texture: 'fluffseed', speed: 620, radius: 5, pierce: 0, spin: 4, spread: 0.04, count: 5, arc: 0.6 },
  },
  {
    id: 'dewsniper',
    name: '露珠狙击',
    kind: 'ranged',
    tags: ['投掷'],
    damage: 25,
    cooldown: 2.0,
    range: 600,
    scaling: { ranged: 1.5 },
    critMultiplier: 2,
    knockback: 140,
    icon: 'w-dewsniper',
    projectile: { texture: 'dewdrop', speed: 1100, radius: 6, pierce: 2, spin: 0, spread: 0 },
  },
  {
    id: 'acid',
    name: '酸液喷囊',
    kind: 'toxin',
    tags: ['腺体'],
    damage: 2,
    cooldown: 0.25,
    range: 180,
    scaling: { toxin: 0.8 },
    critMultiplier: 2,
    knockback: 0,
    icon: 'w-acid',
    projectile: { texture: 'acid', speed: 420, radius: 9, pierce: 3, spin: 6, spread: 0.3, poison: 1 },
  },
  {
    id: 'spore',
    name: '毒孢子',
    kind: 'toxin',
    tags: ['腺体'],
    damage: 0,
    cooldown: 2.2,
    range: 360,
    scaling: { toxin: 1.2 },
    critMultiplier: 2,
    knockback: 0,
    icon: 'w-spore',
    projectile: { texture: 'sporeball', speed: 380, radius: 8, pierce: 0, spin: 5, spread: 0, lob: { cloudRadius: 64, cloudTime: 3 } },
  },
  {
    id: 'stinger',
    name: '蜂刺吹针',
    kind: 'ranged',
    tags: ['尖刺', '腺体'],
    damage: 6,
    cooldown: 0.8,
    range: 400,
    scaling: { ranged: 0.5, toxin: 0.8 },
    critMultiplier: 2,
    knockback: 40,
    icon: 'w-stinger',
    projectile: { texture: 'stinger', speed: 820, radius: 4, pierce: 0, spin: 0, spread: 0.02, poison: 1 },
  },
  {
    id: 'aphids',
    name: '蚜虫牧群',
    kind: 'summon',
    tags: ['共生'],
    damage: 4,
    cooldown: 0.8,
    range: 400,
    scaling: {},
    critMultiplier: 2,
    knockback: 60,
    icon: 'w-aphids',
    summon: { type: 'aphid', counts: [2, 3, 4, 5] },
  },
  {
    id: 'web',
    name: '蛛网陷阱',
    kind: 'summon',
    tags: ['共生'],
    damage: 3,
    cooldown: 3.0,
    range: 300,
    scaling: { toxin: 0.5 },
    critMultiplier: 2,
    knockback: 0,
    icon: 'w-web',
    summon: { type: 'web', max: 3, duration: 8, slow: 0.4 },
  },
  // ---------- M6：新的攻击形态 ----------
  {
    id: 'boomerang',
    name: '回旋叶刃',
    kind: 'ranged',
    tags: ['投掷'],
    damage: 7,
    cooldown: 1.1,
    range: 300,
    scaling: { ranged: 0.8 },
    critMultiplier: 2,
    knockback: 110,
    icon: 'w-boomerang',
    projectile: { texture: 'leafblade', speed: 560, radius: 10, pierce: 999, spin: 18, spread: 0, returning: true },
  },
  {
    id: 'dungball',
    name: '滚粪球',
    kind: 'melee',
    tags: ['甲角'],
    damage: 14,
    cooldown: 2.4,
    range: 260,
    scaling: { melee: 1 },
    critMultiplier: 2,
    knockback: 360,
    icon: 'w-dungball',
    projectile: { texture: 'dungball', speed: 250, radius: 11, pierce: 999, spin: 7, spread: 0, roll: { grow: 1 } },
  },
  {
    id: 'firebeam',
    name: '萤火光束',
    kind: 'ranged',
    tags: ['火焰'],
    damage: 3,
    cooldown: 0.2,
    range: 320,
    scaling: { ranged: 0.4 },
    critMultiplier: 1.5,
    knockback: 0,
    icon: 'w-firebeam',
    beam: true,
    onHit: { burn: true },
  },
  {
    id: 'moths',
    name: '绕身飞蛾',
    kind: 'summon',
    tags: ['共生'],
    damage: 5,
    cooldown: 0.5,
    range: 0,
    scaling: {},
    critMultiplier: 2,
    knockback: 90,
    icon: 'w-moths',
    summon: { type: 'moth', counts: [2, 3, 4, 5] },
  },
  {
    id: 'skipstone',
    name: '弹跳石子',
    kind: 'ranged',
    tags: ['投掷'],
    damage: 8,
    cooldown: 1.0,
    range: 360,
    scaling: { ranged: 0.9 },
    critMultiplier: 2,
    knockback: 120,
    icon: 'w-skipstone',
    projectile: { texture: 'pebble', speed: 720, radius: 6, pierce: 0, spin: 12, spread: 0, bounce: { times: 3, range: 150, falloff: 0.15 } },
  },
  {
    id: 'thunder',
    name: '雷甲触须',
    kind: 'ranged',
    tags: ['电'],
    damage: 10,
    cooldown: 1.4,
    range: 340,
    scaling: { ranged: 0.7 },
    critMultiplier: 2,
    knockback: 60,
    icon: 'w-thunder',
    chain: { jumps: 4, range: 150, falloff: 0.15 },
  },
  {
    id: 'mine',
    name: '种子地雷',
    kind: 'device',
    tags: ['机关'],
    damage: 20,
    cooldown: 2.0,
    range: 0,
    scaling: { engineering: 1.5 },
    critMultiplier: 2,
    knockback: 220,
    icon: 'w-mine',
    device: { type: 'mine', max: 4, radius: 70 },
  },
  {
    id: 'turret',
    name: '蚁丘炮台',
    kind: 'device',
    tags: ['机关'],
    damage: 8,
    cooldown: 0.8,
    range: 360,
    scaling: { engineering: 1 },
    critMultiplier: 2,
    knockback: 80,
    icon: 'w-turret',
    device: { type: 'turret', max: 2, placeEvery: 4 },
  },
  // ---------- M6：新的效果类型 ----------
  {
    id: 'flamegland',
    name: '爆燃腺',
    kind: 'ranged',
    tags: ['火焰'],
    damage: 2,
    cooldown: 0.15,
    range: 150,
    scaling: { ranged: 0.3 },
    critMultiplier: 2,
    knockback: 0,
    icon: 'w-flamegland',
    projectile: { texture: 'flame', speed: 360, radius: 11, pierce: 3, spin: 3, spread: 0.28, fade: true },
    onHit: { burn: true },
  },
  {
    id: 'frostdew',
    name: '霜露弹',
    kind: 'ranged',
    tags: ['投掷'],
    damage: 8,
    cooldown: 0.9,
    range: 380,
    scaling: { ranged: 0.9 },
    critMultiplier: 2,
    knockback: 30,
    icon: 'w-frostdew',
    projectile: { texture: 'frostshot', speed: 760, radius: 6, pierce: 0, spin: 0, spread: 0 },
    onHit: { freeze: 1 },
  },
  {
    id: 'armorbreak',
    name: '破甲刺',
    kind: 'melee',
    tags: ['尖刺'],
    damage: 8,
    cooldown: 0.7,
    range: 130,
    scaling: { melee: 0.8 },
    critMultiplier: 2,
    knockback: 120,
    icon: 'w-armorbreak',
    melee: { hitRadius: 15, style: 'thrust' },
    onHit: { vulnerable: true },
  },
  {
    id: 'honeyjar',
    name: '蜂蜜罐',
    kind: 'ranged',
    tags: ['蜂蜜'],
    damage: 8,
    cooldown: 1.0,
    range: 300,
    scaling: { ranged: 0.6 },
    critMultiplier: 2,
    knockback: 100,
    icon: 'w-honeyjar',
    projectile: { texture: 'honeyblob', speed: 600, radius: 7, pierce: 0, spin: 6, spread: 0 },
    onHit: { heal: 0.1 },
    lowHpHaste: 0.3,
  },
  {
    id: 'scarab',
    name: '金龟子钳',
    kind: 'melee',
    tags: ['甲角'],
    damage: 9,
    cooldown: 1.1,
    range: 140,
    scaling: { melee: 0.9 },
    critMultiplier: 2,
    knockback: 240,
    icon: 'w-scarab',
    melee: { hitRadius: 18, style: 'thrust' },
    onHit: { nectarOnKill: 0.25 },
  },
  // ---------- M6：成长型 ----------
  {
    id: 'scarred',
    name: '战痕大颚',
    kind: 'melee',
    tags: ['甲角'],
    damage: 8,
    cooldown: 1.0,
    range: 140,
    scaling: { melee: 1 },
    critMultiplier: 2,
    knockback: 260,
    icon: 'w-scarred',
    melee: { hitRadius: 18, style: 'thrust' },
    growth: { kills: 40 },
  },
  // ---------- 不在商店出售 ----------
  {
    id: 'workers',
    name: '工蚁',
    kind: 'summon',
    tags: [],
    damage: 6,
    cooldown: 0.9,
    range: 400,
    scaling: { melee: 0.5 },
    critMultiplier: 2,
    knockback: 60,
    icon: 'w-aphids',
    summon: { type: 'aphid' },
    shop: false,
  },
];

export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

/** 商店里能出现的武器 */
export const SHOP_WEAPONS = Object.values(WEAPONS).filter((d) => d.shop !== false);
