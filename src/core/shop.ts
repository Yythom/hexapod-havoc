import { ITEMS } from '../data/items';
import { SHOP_WEAPONS, TIERS } from '../data/weapons';
import { rollTier } from './progression';
import type { RunState } from './RunState';

/** 商店规则，见 DESIGN.md 2.4 ~ 2.7 */

export const OFFER_COUNT = 4;
const WEAPON_OFFER_CHANCE = 0.35;
const SELL_RATIO = 0.35;
const MAX_TIER = TIERS.length - 1;

export interface Offer {
  kind: 'weapon' | 'item';
  id: string;
  tier: number;
  locked: boolean;
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

/** 这个角色能不能拿到这件道具（不能装武器的角色不出加武器槽的道具） */
function itemAllowed(id: string, run: RunState): boolean {
  const d = ITEMS[id];
  if (d.unique && run.items[d.id]) return false;
  if (run.weaponSlots === 0 && d.mods?.weaponSlots) return false;
  return true;
}

/** 这个角色能买的武器 */
export function weaponPool(run: RunState) {
  if (run.weaponSlots === 0) return [];
  const kinds = run.character.allowedKinds;
  return SHOP_WEAPONS.filter((d) => !kinds || kinds.includes(d.kind));
}

/** 按品质挑一件道具；该品质没有就往低品质找。唯一道具已拥有则跳过。 */
function rollItem(tier: number, run: RunState): string | null {
  for (let t = tier; t >= 0; t--) {
    const pool = Object.values(ITEMS).filter((d) => d.rarity === t && itemAllowed(d.id, run));
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)].id;
  }
  return null;
}

function rollOffer(run: RunState): Offer {
  const tier = rollTier(run.wave, run.stats.luck);
  let pool = weaponPool(run);
  // 白蚁等专精角色：一半概率只出对口标签的武器
  const fav = run.character.favorTags;
  if (fav && Math.random() < 0.5) {
    const f = pool.filter((d) => d.tags.some((t) => fav.includes(t)));
    if (f.length > 0) pool = f;
  }
  const itemId = pool.length > 0 && Math.random() < WEAPON_OFFER_CHANCE ? null : rollItem(tier, run);
  if (itemId) return { kind: 'item', id: itemId, tier: ITEMS[itemId].rarity, locked: false };
  return { kind: 'weapon', id: pool[Math.floor(Math.random() * pool.length)].id, tier, locked: false };
}

/** 进商店或刷新：锁定的商品保留，其余（包括已买走的空位）重新随机 */
export function refreshOffers(run: RunState): void {
  for (let i = 0; i < OFFER_COUNT; i++) {
    const o = run.offers[i];
    if (!o || !o.locked) run.offers[i] = rollOffer(run);
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
  return rollItem(rollTier(run.wave, run.stats.luck), run) ?? Object.keys(ITEMS)[0];
}

export function chestSellValue(id: string, wave: number): number {
  return sellValue(itemPrice(id, wave));
}
