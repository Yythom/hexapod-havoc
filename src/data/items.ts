import type { Stats } from '../core/stats';

/** 不属于属性面板、但会影响规则的加成（道具、套装都可以提供） */
export interface Mods {
  /** 额外武器槽 */
  weaponSlots: number;
  /** 额外召唤物数量 */
  summonCount: number;
  /** 召唤物伤害加成 */
  summonDamagePct: number;
  /** 中毒持续时间加成（秒） */
  poisonDuration: number;
  /** 近战击退加成 */
  meleeKnockbackPct: number;
  /** 最大生命百分比修正 */
  maxHpPct: number;
  /** 商店价格修正 */
  pricePct: number;
  /** 宝箱掉落率加成（1 = 翻倍） */
  chestBonus: number;
  /** 远程武器伤害修正（独角仙 −50%） */
  rangedDamagePct: number;
  /** 近战、远程固定加成的修正（屁步甲 −50%） */
  flatBonusPct: number;
  /** 所有武器伤害修正（蜘蛛 −25%、蝉前 5 波 −30%） */
  weaponDamagePct: number;
  /** 非机关武器伤害修正（白蚁 −30%） */
  nonDeviceDamagePct: number;
  /** 近战武器暴击倍率加成（螳螂 +0.5） */
  meleeCritBonus: number;
  /** 灼烧伤害加成 */
  burnDamagePct: number;
  /** 传火范围加成 */
  burnSpreadPct: number;
  /** 被灼烧的怪受到的伤害加成 */
  burnVulnPct: number;
  /** 冰冻持续时间加成（秒） */
  freezeDuration: number;
  /** 大于 0 时，攻击被冻住的怪必定暴击 */
  frozenCrit: number;
  /** 易伤效果加成 */
  vulnerablePct: number;
  /** 链式闪电额外跳跃次数 */
  chainJumps: number;
  /** 大于 0 时，链式闪电每跳伤害不衰减 */
  chainNoFalloff: number;
  /** 链式闪电每跳一次劈下落雷的概率 */
  chainBolt: number;
  /** 每种机关的数量上限加成 */
  deployCap: number;
  /** 炮台攻速加成 */
  turretSpeedPct: number;
  /** 地雷爆炸半径加成 */
  mineRadiusPct: number;
  /** 治疗效果加成 */
  healingPct: number;
  /** 回旋、弹跳类武器的弹射次数加成 */
  bounces: number;
  /** 击杀时额外掉 1 颗花蜜的概率 */
  killNectar: number;
  /** 击杀尸爆（每层 +15 + 50% 最大生命范围伤害） */
  corpseExplode: number;
  /** 投射物命中后向两侧分裂 2 颗小弹 */
  splitShots: number;
  /** 暴击时射出追踪电火花 */
  critSpark: number;
  /** 每捡 3 颗花蜜射出追踪蜜弹 */
  nectarShot: number;
  /** 生命每低于 10%，伤害与攻速提升 */
  bloodRage: number;
  /** 移动撞击敌人造成伤害 */
  ramDamage: number;
  /** 刷怪密度修正 */
  spawnRatePct: number;
  /** 满血回血触发金蜜冲击波 */
  overhealShock: number;
  /** 每少装 1 把武器加伤害与攻速 */
  loneWolf: number;
  /** 炮台发射冰霜/激光弹概率 */
  turretPrism: number;
  /** 吸取回血时电击最近敌人 */
  vampBite: number;
  /** 直飞弹道额外 +1 穿透与 +1 弹跳 */
  gunRicochet: number;
  /** 每波结束永久增加采蜜 */
  waveHarvest: number;
  /** 拾取物飞行速度翻倍 */
  magnetSpeed: number;
  /** 暴击触发范围尖刺震波 */
  critNova: number;
  /** 中毒怪死后留毒云 */
  poisonNova: number;
  /** 灼烧怪死后火焰爆炸 */
  burnExplode: number;
}

export const ZERO_MODS: Readonly<Mods> = {
  weaponSlots: 0,
  summonCount: 0,
  summonDamagePct: 0,
  poisonDuration: 0,
  meleeKnockbackPct: 0,
  maxHpPct: 0,
  pricePct: 0,
  chestBonus: 0,
  rangedDamagePct: 0,
  flatBonusPct: 0,
  weaponDamagePct: 0,
  nonDeviceDamagePct: 0,
  meleeCritBonus: 0,
  burnDamagePct: 0,
  burnSpreadPct: 0,
  burnVulnPct: 0,
  freezeDuration: 0,
  frozenCrit: 0,
  vulnerablePct: 0,
  chainJumps: 0,
  chainNoFalloff: 0,
  chainBolt: 0,
  deployCap: 0,
  turretSpeedPct: 0,
  mineRadiusPct: 0,
  healingPct: 0,
  bounces: 0,
  killNectar: 0,
  corpseExplode: 0,
  splitShots: 0,
  critSpark: 0,
  nectarShot: 0,
  bloodRage: 0,
  ramDamage: 0,
  spawnRatePct: 0,
  overhealShock: 0,
  loneWolf: 0,
  turretPrism: 0,
  vampBite: 0,
  gunRicochet: 0,
  waveHarvest: 0,
  magnetSpeed: 0,
  critNova: 0,
  poisonNova: 0,
  burnExplode: 0,
};

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

export const MOD_LABEL: Record<keyof Mods, (v: number) => string> = {
  weaponSlots: (v) => `武器槽 ${v > 0 ? '+' : ''}${v}`,
  summonCount: (v) => `召唤物数量 ${v > 0 ? '+' : ''}${v}`,
  summonDamagePct: (v) => `召唤物伤害 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
  poisonDuration: (v) => `中毒持续 +${v} 秒`,
  meleeKnockbackPct: (v) => `近战击退 +${Math.round(v * 100)}%`,
  maxHpPct: (v) => `最大生命 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
  pricePct: (v) => `商店价格 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
  chestBonus: (v) => (v === 1 ? '宝箱掉落率翻倍' : `宝箱掉落率 +${Math.round(v * 100)}%`),
  rangedDamagePct: (v) => `远程武器伤害 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
  flatBonusPct: (v) => `近战、远程固定加成 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
  weaponDamagePct: (v) => `所有武器伤害 ${pct(v)}`,
  nonDeviceDamagePct: (v) => `非机关武器伤害 ${pct(v)}`,
  meleeCritBonus: (v) => `近战暴击倍率 +${v}`,
  burnDamagePct: (v) => `灼烧伤害 ${pct(v)}`,
  burnSpreadPct: (v) => `传火范围 ${pct(v)}`,
  burnVulnPct: (v) => `被灼烧的怪受到的伤害 ${pct(v)}`,
  freezeDuration: (v) => `冰冻持续 +${v} 秒`,
  frozenCrit: () => '攻击被冻住的怪必定暴击',
  vulnerablePct: (v) => `易伤效果 ${pct(v)}`,
  chainJumps: (v) => `链式闪电跳跃 +${v} 次`,
  chainNoFalloff: () => '链式闪电每跳伤害不衰减',
  chainBolt: (v) => `链式闪电每跳有 ${Math.round(v * 100)}% 概率再劈一道落雷`,
  deployCap: (v) => `每种机关数量上限 +${v}`,
  turretSpeedPct: (v) => `炮台攻速 ${pct(v)}`,
  mineRadiusPct: (v) => `地雷爆炸半径 ${pct(v)}`,
  healingPct: (v) => `治疗效果 ${pct(v)}`,
  bounces: (v) => `回旋、弹跳类武器弹射 +${v} 次`,
  killNectar: (v) => `击杀时 ${Math.round(v * 100)}% 概率多掉 1 颗花蜜`,
  corpseExplode: (v) => `击杀敌人引发尸爆，造成 ${15 * v}+${50 * v}% 最大生命范围伤害`,
  splitShots: () => '投射物命中后向两侧分裂 2 颗小弹（40% 伤害）',
  critSpark: (v) => `暴击时向附近敌人发射 ${v} 枚追踪火花`,
  nectarShot: () => '每拾取 3 颗花蜜，向最近敌人射出一枚追踪蜜弹',
  bloodRage: (v) => `生命每损失 10%，伤害 +${8 * v}%、攻速 +${6 * v}%`,
  ramDamage: (v) => `移动撞击敌人造成 ${15 * v}+${200 * v}% 甲壳伤害`,
  spawnRatePct: (v) => `刷怪密度 ${pct(v)}`,
  overhealShock: () => '满血回血时释放金蜜冲击波，造成范围伤害',
  loneWolf: () => '每空 1 个武器槽，所有武器伤害 +30%、攻速 +12%',
  turretPrism: () => '炮台有 35% 概率改射冰霜或穿透激光弹',
  vampBite: () => '每次吸取回血时对最近敌人造成 10 点伤害',
  gunRicochet: (v) => `所有直飞子弹额外穿透 +${v}、弹跳 +${v}`,
  waveHarvest: (v) => `每波结束时，采蜜永久 +${v}`,
  magnetSpeed: () => '花蜜与道具吸附飞行速度翻倍',
  critNova: () => '暴击时在目标处爆发尖刺震波（50% 范围伤害）',
  poisonNova: () => '带毒敌人死亡时原地留下毒云',
  burnExplode: () => '灼烧敌人死亡时引发火焰爆炸',
};

/** 触发型道具的效果，实现在 GameScene（DESIGN.md 第 6 节） */
export type TriggerId =
  | 'honeycomb'
  | 'feather'
  | 'treehole'
  | 'horncharm'
  | 'widowsilk'
  | 'fairyring'
  | 'stinkgland'
  | 'treering'
  | 'lightning'
  | 'honeypotion';

export interface ItemDef {
  id: string;
  name: string;
  /** 品质：0 普通 / 1 精良 / 2 稀有 / 3 传说 */
  rarity: number;
  /** 第 1 波的基础价格 */
  price: number;
  stats: Partial<Stats>;
  mods?: Partial<Mods>;
  trigger?: TriggerId;
  /** 触发效果的说明文字 */
  desc?: string;
  /** 只能拥有一件 */
  unique?: boolean;
  icon: string;
}

interface Extra {
  mods?: Partial<Mods>;
  trigger?: TriggerId;
  desc?: string;
  unique?: boolean;
}

function item(id: string, name: string, rarity: number, price: number, stats: Partial<Stats>, extra: Extra = {}): ItemDef {
  return { id, name, rarity, price, stats, icon: `i-${id}`, ...extra };
}

/** 55 件道具，见 DESIGN.md 第 6 节、15.6 节 */
const LIST: ItemDef[] = [
  // 普通
  item('leaf', '嫩叶', 0, 21, { maxHp: 4 }),
  item('dew', '晨露', 0, 22, { regen: 2 }),
  item('plate', '硬甲片', 0, 24, { armor: 2 }),
  item('whetstone', '磨牙石', 0, 22, { damagePct: 0.05 }),
  item('pollen', '花粉团', 0, 24, { attackSpeedPct: 0.06 }),
  item('antenna', '长触须', 0, 15, { pickupPct: 0.4 }),
  item('clover', '三叶草', 0, 18, { luck: 10 }),
  item('wing', '薄翅', 0, 21, { speedPct: 0.05 }),
  item('spikes', '尖刺毛', 0, 22, { melee: 2 }),
  item('pebbles', '小石子', 0, 22, { ranged: 2 }),
  item('sourberry', '酸果', 0, 22, { toxin: 2 }),
  item('resin', '松脂', 0, 21, { range: 30 }),
  item('honeydew', '蚜虫蜜露', 0, 27, { lifesteal: 0.03 }),
  item('fluff', '蒲公英绒毛', 0, 22, { dodge: 0.03 }),
  item('slime', '蜗牛黏液', 0, 24, { harvest: 5 }),
  item('spots', '瓢虫斑点', 0, 22, { critChance: 0.03 }),
  item('tinder', '火绒', 0, 22, {}, { mods: { burnDamagePct: 0.15 } }),
  item('icecrystal', '冰晶', 0, 22, {}, { mods: { freezeDuration: 0.3 } }),
  item('copperwire', '铜线', 0, 26, {}, { mods: { chainJumps: 1 } }),
  item('blueprint', '蚁丘图纸', 0, 25, { engineering: 3 }),
  item('beeswax', '蜂蜡', 0, 20, {}, { mods: { healingPct: 0.15 } }),
  item('armorclamp', '破甲钳', 0, 20, {}, { mods: { vulnerablePct: 0.05 } }),
  // 精良
  item('kneepad', '甲虫护膝', 1, 48, { armor: 4, speedPct: -0.03 }),
  item('bumblefuzz', '熊蜂绒', 1, 48, { maxHp: 10, dodge: -0.03 }),
  item('formic', '蚁酸腺', 1, 45, { toxin: 4, regen: -1 }),
  item('berserk', '狂暴蘑菇', 1, 51, { damagePct: 0.12, armor: -2 }),
  item('molt', '蝉蜕', 1, 45, { dodge: 0.06, maxHp: -4 }),
  item('moss', '苔藓垫', 1, 45, { regen: 4, attackSpeedPct: -0.03 }),
  item('glowdust', '萤光粉', 1, 48, { critChance: 0.06, range: -20 }),
  item('honeycomb', '蜂巢碎片', 1, 45, {}, { trigger: 'honeycomb', desc: '击杀敌人时，有 8% 概率回复 2 生命' }),
  item('feather', '鸟羽毛', 1, 42, {}, { trigger: 'feather', desc: '受伤后 1 秒内移速 +30%' }),
  item('treehole', '存蜜树洞', 1, 54, {}, { trigger: 'treehole', unique: true, desc: '每波结束，每持有 20 花蜜给 1 利息，最多 10' }),
  item('snailcard', '蜗牛会员卡', 1, 51, {}, { mods: { pricePct: -0.06 } }),
  item('dewcatcher', '露水收集器', 1, 45, { harvest: 10, maxHp: -3 }),
  item('ember', '余烬', 1, 46, {}, { mods: { burnVulnPct: 0.1 } }),
  item('frostflower', '霜花', 1, 52, {}, { mods: { frozenCrit: 1 }, unique: true }),
  item('gear', '齿轮', 1, 45, {}, { mods: { turretSpeedPct: 0.25 } }),
  item('spring', '弹簧', 1, 42, {}, { mods: { mineRadiusPct: 0.3 } }),
  item('honeypotion', '蜂巢药剂', 1, 45, {}, { trigger: 'honeypotion', desc: '生命低于 30% 时每秒回复 2（每波最多持续 10 秒）' }),
  item('lootbag', '战利品袋', 1, 50, {}, { mods: { killNectar: 0.08 } }),
  item('critbolt', '暴击火花', 1, 52, {}, { mods: { critSpark: 1 } }),
  item('nectargun', '采蜜连弩', 1, 50, {}, { mods: { nectarShot: 1 }, unique: true }),
  item('bloodrage', '嗜血狂颚', 1, 52, {}, { mods: { bloodRage: 1 } }),
  item('swarmlure', '引虫香囊', 1, 48, { luck: 15, harvest: 8 }, { mods: { spawnRatePct: 0.25 } }),
  item('overhealcore', '溢出蜂晶', 1, 50, {}, { mods: { overhealShock: 1 }, unique: true }),
  item('harvestaltar', '丰收祭坛', 1, 46, { maxHp: -4 }, { mods: { waveHarvest: 4 } }),
  item('magnetheart', '引力心核', 1, 48, { pickupPct: 0.8, speedPct: 0.1 }, { mods: { magnetSpeed: 1 }, unique: true }),
  // 稀有
  item('amber', '琥珀', 2, 105, { damagePct: 0.15, attackSpeedPct: 0.08, speedPct: -0.05 }),
  item('horncharm', '犀角护符', 2, 98, {}, { trigger: 'horncharm', unique: true, desc: '每波开始时获得一层护盾，可以抵挡一次伤害' }),
  item('widowsilk', '黑寡妇丝', 2, 93, {}, { trigger: 'widowsilk', desc: '暴击时给目标叠 2 层毒' }),
  item('fairyring', '蘑菇圈', 2, 96, {}, { trigger: 'fairyring', desc: '每 10 秒在脚下长出一朵蘑菇，捡起回复 3 生命' }),
  item('stinkgland', '臭腺', 2, 90, {}, { trigger: 'stinkgland', desc: '受伤时向四周喷出毒雾，伤害吃毒素加成' }),
  item('elytra', '金龟子鞘翅', 2, 99, { armor: 5, dodge: 0.05, attackSpeedPct: -0.08 }),
  item('antpact', '蚁群契约', 2, 93, {}, { mods: { summonCount: 1, maxHpPct: -0.08 } }),
  item('sevenstar', '七星吊坠', 2, 90, { luck: 25 }, { mods: { chestBonus: 1 }, unique: true }),
  item('lightningrod', '避雷针', 2, 95, {}, { mods: { chainBolt: 0.25 } }),
  item('antcaptain', '工蚁队长', 2, 96, {}, { mods: { deployCap: 1 } }),
  item('whirlleaf', '旋风叶', 2, 92, {}, { mods: { bounces: 1 } }),
  item('powdergland', '爆裂腺体', 2, 102, {}, { mods: { corpseExplode: 1 } }),
  item('splitprism', '复眼棱镜', 2, 108, {}, { mods: { splitShots: 1 }, unique: true }),
  item('glasswing', '玻璃翼膜', 2, 96, { damagePct: 0.35, attackSpeedPct: 0.2 }, { mods: { maxHpPct: -0.25 } }),
  item('ironmantle', '重甲壁垒', 2, 98, { armor: 4, speedPct: -0.08 }, { mods: { ramDamage: 1 } }),
  item('turretprism', '复合炮心', 2, 96, { engineering: 5 }, { mods: { turretPrism: 1 }, unique: true }),
  item('vampfang', '吸血毒牙', 2, 100, { lifesteal: 0.08, critChance: 0.08, regen: -3 }, { mods: { vampBite: 1 }, unique: true }),
  // 传说
  item('royaljelly', '蜂后王浆', 3, 180, { melee: 4, ranged: 4, toxin: 4, damagePct: 0.1 }),
  item('treering', '古树年轮', 3, 165, {}, { trigger: 'treering', unique: true, desc: '每波开始时，最大生命永久 +2' }),
  item('lightning', '雷击残枝', 3, 188, {}, { trigger: 'lightning', unique: true, desc: '每攻击 8 次，劈下闪电，对附近 3 个敌人造成 30 点伤害' }),
  item('seventhleg', '第七条腿', 3, 195, { speedPct: -0.1 }, { mods: { weaponSlots: 1 }, unique: true }),
  item('lonewolf', '独行甲刃', 3, 185, {}, { mods: { loneWolf: 1 }, unique: true }),
  item('ricochetwing', '跳弹翅鞘', 3, 190, {}, { mods: { gunRicochet: 1 } }),
  item('giantscarab', '巨虫血清', 3, 185, { maxHp: 25, melee: 8, ranged: 8, toxin: 8, dodge: -0.1 }),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));
