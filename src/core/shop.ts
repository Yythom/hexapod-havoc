import { ITEMS, type ItemDef } from '../data/items';
import { SHOP_WEAPONS, TIERS, WEAPONS, type WeaponClass, type WeaponDef, type WeaponKind } from '../data/weapons';
import { enchantCost, type WeaponEnchantId } from './contracts';
import { rollTier } from './progression';
import type { RunState } from './RunState';
import type { Stats } from './stats';

/** 商店规则：含流派关联加权、无用道具过滤、禁用池、紫火诅咒商品与蜕壳赋能/熔炼 */

export const OFFER_COUNT = 4;
const WEAPON_OFFER_CHANCE = 0.23;
const WEAPON_OFFER_CHANCE_FILLING = 0.35;
const SELL_RATIO = 0.25;
/** 诅咒商品每次购买附加的诅咒值（原 3，配合出现率会形成 +9/波的雪球） */
export const CURSED_OFFER_CURSE = 1;
/** 非唯一道具堆叠上限：普通最多 3 件，精良/稀有/传说最多 2 件，压住后期把整个道具池买空 */
function maxItemStack(d: ItemDef): number {
  return d.rarity === 0 ? 3 : 2;
}
const MAX_TIER = TIERS.length - 1;

export interface Offer {
  kind: 'weapon' | 'item';
  id: string;
  tier: number;
  locked: boolean;
  /** 紫火诅咒强化版（武器 伤害+25%/攻速+10%，道具正面属性+35%，购买时诅咒 +3） */
  cursed?: boolean;
}

interface BuildProfile {
  weaponIds: Set<string>;
  kinds: Set<WeaponKind>;
  classes: Set<WeaponClass>;
  hasMelee: boolean;
  hasRanged: boolean;
  hasToxin: boolean;
  hasSummon: boolean;
  hasTurret: boolean;
  hasMine: boolean;
  hasDevice: boolean;
  hasBurn: boolean;
  hasFreeze: boolean;
  hasChain: boolean;
  hasBounce: boolean;
  hasProjectiles: boolean;
}

function pickWeighted<T>(items: T[], weightOf: (item: T) => number, rng: () => number = Math.random): T {
  let total = 0;
  const weights = items.map((it) => {
    const w = Math.max(0.01, weightOf(it));
    total += w;
    return w;
  });
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

function buildProfile(run: RunState): BuildProfile {
  const c = run.character;
  const weaponIds = new Set<string>();
  const kinds = new Set<WeaponKind>();
  const classes = new Set<WeaponClass>(c.favorClasses ?? []);
  let hasMelee = (c.stats.melee ?? 0) > 0;
  let hasRanged = (c.stats.ranged ?? 0) > 0 && (c.mods?.rangedDamagePct ?? 0) >= 0;
  let hasToxin = (c.stats.toxin ?? 0) > 0 || !!c.perks.hurtCloud || (run.items.widowsilk ?? 0) > 0;
  let hasSummon = !!c.perks.workers;
  let hasTurret = false;
  let hasMine = false;
  let hasBurn = false;
  let hasFreeze = false;
  let hasChain = false;
  let hasBounce = false;
  let hasProjectiles = false;

  for (const ow of run.weapons) {
    const w = SHOP_WEAPONS.find((d) => d.id === ow.id);
    if (!w) continue;
    weaponIds.add(w.id);
    kinds.add(w.kind);
    for (const t of w.classes) classes.add(t);
    if (w.kind === 'melee' || w.scaling.melee) hasMelee = true;
    if ((w.kind === 'ranged' || w.scaling.ranged) && (c.mods?.rangedDamagePct ?? 0) >= 0) hasRanged = true;
    if (w.kind === 'toxin' || w.scaling.toxin || w.projectile?.poison || w.onHit?.poison) hasToxin = true;
    if (w.kind === 'summon') hasSummon = true;
    if (w.device?.type === 'turret') hasTurret = true;
    if (w.device?.type === 'mine') hasMine = true;
    if (w.onHit?.burn || w.classes.includes('Elemental')) hasBurn = true;
    if (w.onHit?.freeze) hasFreeze = true;
    if (w.chain || w.classes.includes('Elemental')) hasChain = true;
    if (w.projectile?.returning || w.projectile?.bounce) hasBounce = true;
    if (w.projectile && !w.projectile.lob && !w.projectile.returning && !w.projectile.roll) hasProjectiles = true;
  }

  if (run.weapons.length === 0 && c.allowedKinds) {
    for (const k of c.allowedKinds) kinds.add(k);
    if (c.allowedKinds.includes('melee')) hasMelee = true;
    if (c.allowedKinds.includes('ranged') && (c.mods?.rangedDamagePct ?? 0) >= 0) hasRanged = true;
    if (c.allowedKinds.includes('toxin')) hasToxin = true;
    if (c.allowedKinds.includes('summon')) hasSummon = true;
  }

  return {
    weaponIds,
    kinds,
    classes,
    hasMelee,
    hasRanged,
    hasToxin,
    hasSummon,
    hasTurret,
    hasMine,
    hasDevice: hasTurret || hasMine,
    hasBurn,
    hasFreeze,
    hasChain,
    hasBounce,
    hasProjectiles,
  };
}

/** 价格随波次上涨：每过一波 +15% 基础价 */
export function priceMult(wave: number): number {
  return 1 + 0.22 * (wave - 1);
}

/** 折扣最多 30% */
const MAX_DISCOUNT = -0.3;

export function weaponPrice(def: WeaponDef, tier: number, wave: number, discount = 0): number {
  const base = def.tiers[Math.max(0, Math.min(3, tier))]?.price ?? TIERS[tier].price;
  return Math.max(1, Math.round(base * priceMult(wave) * (1 + discount)));
}

export function itemPrice(id: string, wave: number, discount = 0): number {
  return Math.max(1, Math.round(ITEMS[id].price * priceMult(wave) * (1 + discount)));
}

/** 商品的实际售价（含蜗牛会员卡等折扣） */
export function offerPrice(o: Offer, run: RunState): number {
  const d = Math.max(MAX_DISCOUNT, run.mods.pricePct);
  return o.kind === 'weapon' ? weaponPrice(WEAPONS[o.id], o.tier, run.wave, d) : itemPrice(o.id, run.wave, d);
}

export function sellValue(price: number): number {
  return Math.max(1, Math.floor(price * SELL_RATIO));
}

/** 同一次进商店里第 times+1 次刷新的费用：基础与连刷步长随波次递增，避免中后期无限白嫖刷新 */
export function rerollCost(wave: number, times: number): number {
  const t = Math.max(0, times);
  const base = 2 + Math.floor(wave * 0.85);
  const step = Math.max(1, Math.floor(wave / 2.5));
  return base + t * step;
}

/** 严格过滤当前角色完全用不上的死道具与玩家局前禁用的道具 */
function itemAllowed(id: string, run: RunState): boolean {
  const d = ITEMS[id];
  if (run.setup.banished?.includes(id)) return false;
  if (d.unique && run.items[d.id]) return false;
  if (!d.unique && (run.items[d.id] ?? 0) >= maxItemStack(d)) return false;
  // 孤胆单槽挑战不出「第七条腿」
  if (run.hasMutator('one_slot') && id === 'seventhleg') return false;
  // 存蜜猪猪罐第 20 波后停止派息，无尽模式不再刷出
  if (id === 'piggybank' && run.wave >= 20) return false;
  const perks = run.character.perks;
  const m = d.mods;
  // 苦痛虫壳禁用其他一切回血方式，拿到后不再刷纯回血类死道具
  if (run.mods.torture > 0) {
    if (
      (d.stats.regen ?? 0) > 0 ||
      (d.stats.lifesteal ?? 0) > 0 && !m?.bloodyHand ||
      m?.healingPct ||
      m?.overhealShock ||
      d.trigger === 'honeycomb' ||
      d.trigger === 'honeypotion' ||
      d.trigger === 'fairyring'
    ) {
      return false;
    }
  }
  if (run.weaponSlots === 0) {
    if (
      m?.weaponSlots ||
      m?.bounces ||
      m?.meleeKnockbackPct ||
      m?.rangedDamagePct ||
      m?.nonDeviceDamagePct ||
      m?.meleeCritBonus ||
      m?.burnDamagePct ||
      m?.burnSpreadPct ||
      m?.burnVulnPct ||
      m?.freezeDuration ||
      m?.frozenCrit ||
      m?.chainJumps ||
      m?.chainNoFalloff ||
      m?.chainBolt ||
      m?.deployCap ||
      m?.turretSpeedPct ||
      m?.mineRadiusPct ||
      m?.turretPrism ||
      m?.splitShots ||
      m?.gunRicochet ||
      m?.loneWolf ||
      (d.stats.melee ?? 0) > 0 ||
      (d.stats.ranged ?? 0) > 0 ||
      (d.stats.engineering ?? 0) > 0
    ) {
      return false;
    }
  }
  if (perks.lifestealOnly) {
    if ((d.stats.regen ?? 0) > 0 || m?.healingPct || m?.overhealShock || d.trigger === 'honeycomb' || d.trigger === 'honeypotion' || d.trigger === 'fairyring') {
      return false;
    }
  }
  if (perks.noDodge && (d.stats.dodge ?? 0) > 0 && (d.stats.armor ?? 0) <= 0) {
    return false;
  }
  if (perks.touchPickup && (d.stats.pickupPct ?? 0) > 0) {
    return false;
  }
  const allowed = run.character.allowedKinds;
  if (allowed && !allowed.includes('ranged') && !allowed.includes('toxin') && (d.stats.ranged ?? 0) > 0 && (d.stats.melee ?? 0) <= 0) {
    return false;
  }
  return true;
}

/** 道具与当前构筑的相关度权重：对口专精件高权重，不搭边的冷门机制大幅降权避免污染卡池 */
function itemWeight(d: ItemDef, run: RunState, prof: BuildProfile): number {
  const m = d.mods;
  const s = d.stats;
  const perks = run.character.perks;

  // 强机制绑定类道具（没有对应武器时不应该高频占格子）
  if (m?.burnDamagePct || m?.burnSpreadPct || m?.burnVulnPct) return prof.hasBurn ? 2.6 : 0.08;
  if (m?.freezeDuration || m?.frozenCrit) return prof.hasFreeze ? 2.6 : 0.08;
  if (m?.chainJumps || m?.chainNoFalloff || m?.chainBolt) return prof.hasChain ? 2.6 : 0.08;
  if (m?.turretSpeedPct || m?.turretPrism) return prof.hasTurret ? 2.8 : 0.06;
  if (m?.mineRadiusPct) return prof.hasMine ? 2.8 : 0.06;
  if (m?.deployCap) return prof.hasDevice ? 2.6 : 0.08;
  if ((s.engineering ?? 0) > 0) return prof.hasDevice ? 2.4 : 0.1;
  if (m?.bounces) return prof.hasBounce ? 2.6 : 0.08;
  if (m?.splitShots || m?.gunRicochet) return prof.hasProjectiles ? 2.6 : 0.08;
  if (m?.summonCount) return prof.hasSummon ? 2.8 : 0.1;
  if (m?.loneWolf) return run.weapons.length < run.weaponSlots ? 1.8 : 0.2;

  // 输出属性流派道具
  if ((s.melee ?? 0) > 0 && !(s.ranged ?? 0)) return prof.hasMelee ? 2.2 : 0.18;
  if ((s.ranged ?? 0) > 0 && !(s.melee ?? 0)) return prof.hasRanged ? 2.2 : 0.18;
  if ((s.toxin ?? 0) > 0 || d.trigger === 'widowsilk' || d.trigger === 'stinkgland') return prof.hasToxin ? 2.3 : 0.22;

  // 角色核心特色加权
  let w = 1.0;
  if (perks.speedToDamage && (s.speedPct ?? 0) > 0) w *= 2.4;
  if (perks.thorns && (s.armor ?? 0) > 0) w *= 2.3;
  if (perks.lifestealOnly && (s.lifesteal ?? 0) > 0) w *= 2.8;
  if (perks.interest && (d.id === 'treehole' || d.id === 'piggybank' || (s.luck ?? 0) > 0)) w *= 2.0;
  if (d.id === 'huntingtrophy' && run.stats.critChance >= 0.15) w *= 2.0;
  if (d.id === 'bloodyhand' && run.stats.lifesteal >= 0.06) w *= 2.0;
  if (run.weapons.length >= run.weaponSlots && d.id === 'seventhleg') w *= 1.6;
  return w;
}

/** 武器与当前构筑的相关度权重：优先出同名可合成、同标签凑套装、同类型匹配角色定位的武器 */
function weaponWeight(d: WeaponDef, run: RunState, prof: BuildProfile): number {
  let w = 0.7;
  if (prof.weaponIds.has(d.id)) w = 3.8;
  else if (d.classes.some((t) => prof.classes.has(t))) w = 2.8;
  else if (prof.kinds.has(d.kind)) w = 1.8;

  if ((run.character.mods?.rangedDamagePct ?? 0) < 0 && d.kind === 'ranged') w *= 0.2;
  if ((run.character.mods?.nonDeviceDamagePct ?? 0) < 0 && !d.device) w *= 0.25;
  if (run.character.favorClasses?.some((t) => d.classes.includes(t))) w *= 1.5;
  return w;
}

/** 这个角色能买的武器 */
export function weaponPool(run: RunState, tier = 0) {
  if (run.weaponSlots === 0) return [];
  const kinds = run.character.allowedKinds;
  return SHOP_WEAPONS.filter((d) => (!kinds || kinds.includes(d.kind)) && (d.minTier ?? 0) <= tier);
}

/** 按品质和构筑加权挑一件道具；该品质没有就往低品质找。同一次刷新尽量不重复。 */
function rollItem(
  tier: number,
  run: RunState,
  prof: BuildProfile,
  avoidIds?: Set<string>,
  rng: () => number = Math.random,
): string | null {
  for (let t = tier; t >= 0; t--) {
    let pool = Object.values(ITEMS).filter((d) => d.rarity === t && itemAllowed(d.id, run));
    if (avoidIds && pool.length > 1) {
      const fresh = pool.filter((d) => !avoidIds.has(d.id));
      if (fresh.length > 0) pool = fresh;
    }
    if (pool.length > 0) return pickWeighted(pool, (d) => itemWeight(d, run, prof), rng).id;
  }
  return null;
}

/** 商店刷新出紫火诅咒商品的概率（第 2 波起出现；随诅咒值与诅咒黑市词条提高） */
export function cursedOfferChance(run: RunState): number {
  if (run.wave < 2 && !run.hasMutator('cursed_market')) return 0;
  let p = Math.min(0.2, 0.08 + Math.max(0, run.stats.curse) * 0.006);
  if (run.hasMutator('cursed_market')) p = Math.max(0.45, p * 2);
  if (run.curseOfferBonus) p = Math.min(0.7, p + 0.28);
  return p;
}

function rollOffer(
  run: RunState,
  prof: BuildProfile,
  forceWeapon: boolean,
  avoidItems: Set<string>,
  rng: () => number = Math.random,
): Offer {
  const tier = rollTier(run.wave, run.stats.luck, rng);
  const pool = weaponPool(run, tier);
  const wChance = run.weapons.length < run.weaponSlots ? WEAPON_OFFER_CHANCE_FILLING : WEAPON_OFFER_CHANCE;
  const pickWeapon = pool.length > 0 && (forceWeapon || rng() < wChance);
  const cursed = rng() < cursedOfferChance(run);
  if (!pickWeapon) {
    const itemId = rollItem(tier, run, prof, avoidItems, rng);
    if (itemId) {
      avoidItems.add(itemId);
      const hasPositiveStat = Object.values(ITEMS[itemId].stats).some((v) => typeof v === 'number' && v > 0);
      return { kind: 'item', id: itemId, tier: ITEMS[itemId].rarity, locked: false, cursed: cursed && hasPositiveStat ? true : undefined };
    }
  }
  const w = pickWeighted(pool, (d) => weaponWeight(d, run, prof), rng);
  return { kind: 'weapon', id: w.id, tier, locked: false, cursed: cursed ? true : undefined };
}

/** 进商店或刷新：锁定的商品保留，其余（包括已买走的空位）重新随机 */
export function refreshOffers(run: RunState, rng: () => number = Math.random): void {
  const prof = buildProfile(run);
  const avoidItems = new Set<string>();
  for (const o of run.offers) {
    if (o && o.locked && o.kind === 'item') avoidItems.add(o.id);
  }
  const hasLockedWeapon = run.offers.some((o) => o && o.locked && o.kind === 'weapon');
  const needWeaponSlot = run.weaponSlots > 0 && run.weapons.length < run.weaponSlots && run.wave <= 4 && !hasLockedWeapon;
  let forced = false;
  const count = run.shopOfferCount;
  run.offers.length = count;
  for (let i = 0; i < count; i++) {
    const o = run.offers[i];
    if (!o || !o.locked) {
      const forceW = needWeaponSlot && !forced;
      if (forceW) forced = true;
      run.offers[i] = rollOffer(run, prof, forceW, avoidItems, rng);
    }
  }
}

export type AddMode = 'add' | 'merge' | 'full';

/** 买一把武器会怎样：放进空槽 / 槽满时与同名同品质的合成 / 放不下 */
export function weaponAddMode(run: RunState, id: string, tier: number): AddMode {
  if (run.weapons.length < run.weaponSlots) return 'add';
  if (tier < MAX_TIER && run.weapons.some((w) => w.id === id && w.tier === tier)) return 'merge';
  return 'full';
}

/** 购买商品，成功返回 true */
export function buyOffer(run: RunState, index: number): boolean {
  const o = run.offers[index];
  if (!o) return false;
  const price = offerPrice(o, run);
  if (run.nectar < price) return false;
  if (o.kind === 'weapon') {
    const mode = weaponAddMode(run, o.id, o.tier);
    if (mode === 'full') return false;
    if (mode === 'add') {
      run.weapons.push({ id: o.id, tier: o.tier, cursed: o.cursed ? true : undefined });
    } else {
      const i = run.weapons.findIndex((w) => w.id === o.id && w.tier === o.tier);
      const prev = run.weapons[i];
      run.weapons[i] = {
        id: o.id,
        tier: o.tier + 1,
        kills: prev.kills,
        cursed: prev.cursed || o.cursed ? true : undefined,
        enchant: prev.enchant,
      };
    }
    if (o.cursed) run.bonus.curse += CURSED_OFFER_CURSE;
    run.recomputeStats();
  } else {
    addItem(run, o.id);
    if (o.cursed) {
      applyCursedItemBonus(run, o.id);
      run.bonus.curse += CURSED_OFFER_CURSE;
      run.recomputeStats();
    }
    // 复刻魔镜（Mirror）：下一件在商店购买的非唯一道具免费额外复制 1 份（不突破叠加上限）
    const def = ITEMS[o.id];
    if (def && o.id !== 'mirror' && !def.unique && run.mirrorCharges > 0 && (run.items[o.id] ?? 0) < maxItemStack(def)) {
      run.mirrorCharges--;
      addItem(run, o.id);
    }
  }
  run.nectar -= price;
  run.offers[index] = null;
  return true;
}

/** 诅咒道具的正面属性额外增强 35%（小数保留合理精度，整数至少 +1） */
export function cursedItemExtraStats(id: string): Partial<Stats> {
  const def = ITEMS[id];
  if (!def) return {};
  const out: Partial<Stats> = {};
  for (const [k, v] of Object.entries(def.stats) as [keyof Stats, number][]) {
    if (v <= 0) continue;
    const raw = v * 0.35;
    out[k] = v >= 1 ? Math.max(1, Math.round(raw)) : Math.round(raw * 100) / 100;
  }
  return out;
}

function applyCursedItemBonus(run: RunState, id: string): void {
  for (const [k, v] of Object.entries(cursedItemExtraStats(id)) as [keyof Stats, number][]) {
    run.bonus[k] += v;
  }
}

export function addItem(run: RunState, id: string): void {
  const d = ITEMS[id];
  if (!d.unique && (run.items[id] ?? 0) >= maxItemStack(d)) {
    run.nectar += 5;
    return;
  }
  run.items[id] = (run.items[id] ?? 0) + 1;
  if (id === 'weirdghost') run.nextWaveOneHp = true;
  else if (id === 'bait') run.nextWaveBait++;
  else if (id === 'peacock') run.nextWavePeacock++;
  else if (id === 'mirror') run.mirrorCharges++;
  run.recomputeStats();
}

/** 第 i 把武器可以和哪一把合成，没有返回 -1 */
export function mergePartner(run: RunState, i: number): number {
  const w = run.weapons[i];
  if (!w || w.tier >= MAX_TIER) return -1;
  return run.weapons.findIndex((o, j) => j !== i && o.id === w.id && o.tier === w.tier);
}

export function mergeWeapons(run: RunState, i: number): boolean {
  const j = mergePartner(run, i);
  if (j < 0) return false;
  const w = run.weapons[i];
  const other = run.weapons[j];
  // 成长型武器合成时保留成长得更多的那把，同时继承诅咒与附魔
  const kills = Math.max(w.kills ?? 0, other.kills ?? 0);
  run.weapons[Math.min(i, j)] = {
    id: w.id,
    tier: w.tier + 1,
    kills: kills || undefined,
    cursed: w.cursed || other.cursed ? true : undefined,
    enchant: w.enchant ?? other.enchant,
  };
  run.weapons.splice(Math.max(i, j), 1);
  run.recomputeStats();
  return true;
}

/** 蜗老板蜕壳台：给指定武器打上附魔（每波限用 1 次，含附魔或熔炼） */
export function enchantWeapon(run: RunState, slotIndex: number, enchant: WeaponEnchantId): boolean {
  const w = run.weapons[slotIndex];
  if (!w || run.forgeUsed) return false;
  const cost = enchantCost(run.wave);
  if (run.nectar < cost) return false;
  run.nectar -= cost;
  w.enchant = enchant;
  run.forgeUsed = true;
  run.recomputeStats();
  return true;
}

export interface SmeltResult {
  refund: number;
  stat: keyof Stats;
  amount: number;
}

/** 蜗老板蜕壳台：熔炼 1 件非唯一道具，返还 60% 花蜜并永久奖励随机基础属性 */
export function smeltItem(run: RunState, itemId: string, rng: () => number = Math.random): SmeltResult | null {
  const def = ITEMS[itemId];
  if (!def || def.unique || (run.items[itemId] ?? 0) <= 0 || run.forgeUsed) return null;
  run.items[itemId] -= 1;
  if (run.items[itemId] <= 0) delete run.items[itemId];
  const refund = Math.max(4, Math.round(itemPrice(itemId, run.wave) * 0.6));
  run.nectar += refund;
  const rewardPool: { stat: keyof Stats; amount: number }[] = [
    { stat: 'damagePct', amount: 0.04 },
    { stat: 'attackSpeedPct', amount: 0.05 },
    { stat: 'maxHp', amount: 4 },
    { stat: 'luck', amount: 6 },
  ];
  const pick = rewardPool[Math.floor(rng() * rewardPool.length)];
  run.bonus[pick.stat] += pick.amount;
  run.forgeUsed = true;
  run.recomputeStats();
  return { refund, stat: pick.stat, amount: pick.amount };
}

export function weaponSellValue(run: RunState, i: number): number {
  return sellValue(weaponPrice(WEAPONS[run.weapons[i].id], run.weapons[i].tier, run.wave));
}

/** 卖掉第 i 把武器，返回得到的花蜜。最后一把不能卖。 */
export function sellWeapon(run: RunState, i: number): number {
  if (run.weapons.length <= 1) return 0;
  const v = weaponSellValue(run, i);
  run.weapons.splice(i, 1);
  run.nectar += v;
  run.recomputeStats();
  return v;
}

export function rollChestItem(run: RunState, rng: () => number = Math.random): string {
  const prof = buildProfile(run);
  return rollItem(rollTier(run.wave, run.stats.luck, rng), run, prof, undefined, rng) ?? Object.keys(ITEMS)[0];
}

export function chestSellValue(id: string, wave: number): number {
  return sellValue(itemPrice(id, wave));
}
