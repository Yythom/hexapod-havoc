import { ITEMS, type ItemDef } from '../data/items';
import { SHOP_WEAPONS, TIERS, type WeaponDef, type WeaponKind, type WeaponTag } from '../data/weapons';
import { rollTier } from './progression';
import type { RunState } from './RunState';

/** 商店规则：含流派关联加权与无用道具过滤 */

export const OFFER_COUNT = 4;
const WEAPON_OFFER_CHANCE = 0.36;
const WEAPON_OFFER_CHANCE_FILLING = 0.5;
const SELL_RATIO = 0.35;
const MAX_TIER = TIERS.length - 1;

export interface Offer {
  kind: 'weapon' | 'item';
  id: string;
  tier: number;
  locked: boolean;
}

interface BuildProfile {
  weaponIds: Set<string>;
  kinds: Set<WeaponKind>;
  tags: Set<WeaponTag>;
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
}

function pickWeighted<T>(items: T[], weightOf: (item: T) => number): T {
  let total = 0;
  const weights = items.map((it) => {
    const w = Math.max(0.01, weightOf(it));
    total += w;
    return w;
  });
  let r = Math.random() * total;
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
  const tags = new Set<WeaponTag>(c.favorTags ?? []);
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

  for (const ow of run.weapons) {
    const w = SHOP_WEAPONS.find((d) => d.id === ow.id);
    if (!w) continue;
    weaponIds.add(w.id);
    kinds.add(w.kind);
    for (const t of w.tags) tags.add(t);
    if (w.kind === 'melee' || w.scaling.melee) hasMelee = true;
    if ((w.kind === 'ranged' || w.scaling.ranged) && (c.mods?.rangedDamagePct ?? 0) >= 0) hasRanged = true;
    if (w.kind === 'toxin' || w.scaling.toxin || w.projectile?.poison) hasToxin = true;
    if (w.kind === 'summon') hasSummon = true;
    if (w.device?.type === 'turret') hasTurret = true;
    if (w.device?.type === 'mine') hasMine = true;
    if (w.onHit?.burn || w.tags.includes('火焰')) hasBurn = true;
    if (w.onHit?.freeze) hasFreeze = true;
    if (w.chain || w.tags.includes('电')) hasChain = true;
    if (w.projectile?.returning || w.projectile?.bounce) hasBounce = true;
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
    tags,
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
  };
}

/** 价格随波次上涨：每过一波 +15% 基础价 */
export function priceMult(wave: number): number {
  return 1 + 0.15 * (wave - 1);
}

/** 折扣最多 30% */
const MAX_DISCOUNT = -0.3;

export function weaponPrice(tier: number, wave: number, discount = 0): number {
  return Math.max(1, Math.round(TIERS[tier].price * priceMult(wave) * (1 + discount)));
}

export function itemPrice(id: string, wave: number, discount = 0): number {
  return Math.max(1, Math.round(ITEMS[id].price * priceMult(wave) * (1 + discount)));
}

/** 商品的实际售价（含蜗牛会员卡等折扣） */
export function offerPrice(o: Offer, run: RunState): number {
  const d = Math.max(MAX_DISCOUNT, run.mods.pricePct);
  return o.kind === 'weapon' ? weaponPrice(o.tier, run.wave, d) : itemPrice(o.id, run.wave, d);
}

export function sellValue(price: number): number {
  return Math.max(1, Math.floor(price * SELL_RATIO));
}

/** 同一次进商店里第 times+1 次刷新的费用 */
export function rerollCost(wave: number, times: number): number {
  return 1 + Math.ceil(wave / 2) + times;
}

/** 严格过滤当前角色完全用不上的死道具（例如蚁后不出武器向机械件、蚊子不出普通回血件等） */
function itemAllowed(id: string, run: RunState): boolean {
  const d = ITEMS[id];
  if (d.unique && run.items[d.id]) return false;
  const perks = run.character.perks;
  const m = d.mods;
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
      (d.stats.melee ?? 0) > 0 ||
      (d.stats.ranged ?? 0) > 0 ||
      (d.stats.engineering ?? 0) > 0
    ) {
      return false;
    }
  }
  if (perks.lifestealOnly) {
    if ((d.stats.regen ?? 0) > 0 || m?.healingPct || d.trigger === 'honeycomb' || d.trigger === 'honeypotion' || d.trigger === 'fairyring') {
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
  if (m?.turretSpeedPct) return prof.hasTurret ? 2.8 : 0.06;
  if (m?.mineRadiusPct) return prof.hasMine ? 2.8 : 0.06;
  if (m?.deployCap) return prof.hasDevice ? 2.6 : 0.08;
  if ((s.engineering ?? 0) > 0) return prof.hasDevice ? 2.4 : 0.1;
  if (m?.bounces) return prof.hasBounce ? 2.6 : 0.08;
  if (m?.summonCount) return prof.hasSummon ? 2.8 : 0.1;

  // 输出属性流派道具
  if ((s.melee ?? 0) > 0 && !(s.ranged ?? 0)) return prof.hasMelee ? 2.2 : 0.18;
  if ((s.ranged ?? 0) > 0 && !(s.melee ?? 0)) return prof.hasRanged ? 2.2 : 0.18;
  if ((s.toxin ?? 0) > 0 || d.trigger === 'widowsilk' || d.trigger === 'stinkgland') return prof.hasToxin ? 2.3 : 0.22;

  // 角色核心特色加权
  let w = 1.0;
  if (perks.speedToDamage && (s.speedPct ?? 0) > 0) w *= 2.4;
  if (perks.thorns && (s.armor ?? 0) > 0) w *= 2.3;
  if (perks.lifestealOnly && (s.lifesteal ?? 0) > 0) w *= 2.8;
  if (perks.interest && (d.id === 'treehole' || (s.luck ?? 0) > 0)) w *= 2.0;
  if (run.weapons.length >= run.weaponSlots && d.id === 'seventhleg') w *= 1.6;
  return w;
}

/** 武器与当前构筑的相关度权重：优先出同名可合成、同标签凑套装、同类型匹配角色定位的武器 */
function weaponWeight(d: WeaponDef, run: RunState, prof: BuildProfile): number {
  let w = 0.7;
  if (prof.weaponIds.has(d.id)) w = 3.8;
  else if (d.tags.some((t) => prof.tags.has(t))) w = 2.8;
  else if (prof.kinds.has(d.kind)) w = 1.8;

  if ((run.character.mods?.rangedDamagePct ?? 0) < 0 && d.kind === 'ranged') w *= 0.2;
  if ((run.character.mods?.nonDeviceDamagePct ?? 0) < 0 && !d.device) w *= 0.25;
  if (run.character.favorTags?.some((t) => d.tags.includes(t))) w *= 1.5;
  return w;
}

/** 这个角色能买的武器 */
export function weaponPool(run: RunState) {
  if (run.weaponSlots === 0) return [];
  const kinds = run.character.allowedKinds;
  return SHOP_WEAPONS.filter((d) => !kinds || kinds.includes(d.kind));
}

/** 按品质和构筑加权挑一件道具；该品质没有就往低品质找。同一次刷新尽量不重复。 */
function rollItem(tier: number, run: RunState, prof: BuildProfile, avoidIds?: Set<string>): string | null {
  for (let t = tier; t >= 0; t--) {
    let pool = Object.values(ITEMS).filter((d) => d.rarity === t && itemAllowed(d.id, run));
    if (avoidIds && pool.length > 1) {
      const fresh = pool.filter((d) => !avoidIds.has(d.id));
      if (fresh.length > 0) pool = fresh;
    }
    if (pool.length > 0) return pickWeighted(pool, (d) => itemWeight(d, run, prof)).id;
  }
  return null;
}

function rollOffer(run: RunState, prof: BuildProfile, forceWeapon: boolean, avoidItems: Set<string>): Offer {
  const tier = rollTier(run.wave, run.stats.luck);
  const pool = weaponPool(run);
  const wChance = run.weapons.length < run.weaponSlots ? WEAPON_OFFER_CHANCE_FILLING : WEAPON_OFFER_CHANCE;
  const pickWeapon = pool.length > 0 && (forceWeapon || Math.random() < wChance);
  if (!pickWeapon) {
    const itemId = rollItem(tier, run, prof, avoidItems);
    if (itemId) {
      avoidItems.add(itemId);
      return { kind: 'item', id: itemId, tier: ITEMS[itemId].rarity, locked: false };
    }
  }
  const w = pickWeighted(pool, (d) => weaponWeight(d, run, prof));
  return { kind: 'weapon', id: w.id, tier, locked: false };
}

/** 进商店或刷新：锁定的商品保留，其余（包括已买走的空位）重新随机 */
export function refreshOffers(run: RunState): void {
  const prof = buildProfile(run);
  const avoidItems = new Set<string>();
  for (const o of run.offers) {
    if (o && o.locked && o.kind === 'item') avoidItems.add(o.id);
  }
  const hasLockedWeapon = run.offers.some((o) => o && o.locked && o.kind === 'weapon');
  const needWeaponSlot = run.weaponSlots > 0 && run.weapons.length < run.weaponSlots && run.wave <= 4 && !hasLockedWeapon;
  let forced = false;
  for (let i = 0; i < OFFER_COUNT; i++) {
    const o = run.offers[i];
    if (!o || !o.locked) {
      const forceW = needWeaponSlot && !forced;
      if (forceW) forced = true;
      run.offers[i] = rollOffer(run, prof, forceW, avoidItems);
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
      run.weapons.push({ id: o.id, tier: o.tier });
    } else {
      const i = run.weapons.findIndex((w) => w.id === o.id && w.tier === o.tier);
      run.weapons[i] = { id: o.id, tier: o.tier + 1, kills: run.weapons[i].kills };
    }
    run.recomputeStats();
  } else {
    addItem(run, o.id);
  }
  run.nectar -= price;
  run.offers[index] = null;
  return true;
}

export function addItem(run: RunState, id: string): void {
  run.items[id] = (run.items[id] ?? 0) + 1;
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
  // 成长型武器合成时保留成长得更多的那把
  const kills = Math.max(w.kills ?? 0, run.weapons[j].kills ?? 0);
  run.weapons[Math.min(i, j)] = { id: w.id, tier: w.tier + 1, kills: kills || undefined };
  run.weapons.splice(Math.max(i, j), 1);
  run.recomputeStats();
  return true;
}

export function weaponSellValue(run: RunState, i: number): number {
  return sellValue(weaponPrice(run.weapons[i].tier, run.wave));
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

export function rollChestItem(run: RunState): string {
  const prof = buildProfile(run);
  return rollItem(rollTier(run.wave, run.stats.luck), run, prof) ?? Object.keys(ITEMS)[0];
}

export function chestSellValue(id: string, wave: number): number {
  return sellValue(itemPrice(id, wave));
}
