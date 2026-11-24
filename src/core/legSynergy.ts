import { WEAPONS, type WeaponClass } from '../data/weapons';
import type { OwnedWeapon } from './RunState';

export type LegZone = 'front' | 'mid' | 'rear' | 'tail';

export interface SlotBonus {
  zone: LegZone;
  zoneLabel: string;
  shortLabel: string;
  /** 该槽位额外伤害% */
  damagePct: number;
  /** 该槽位额外攻速% */
  attackSpeedPct: number;
  /** 该槽位额外暴击率 */
  critChance: number;
  /** 该槽位额外射程 */
  range: number;
  /** 该槽位额外击退% */
  knockbackPct: number;
  /** 与左右相邻腿触发同系共鸣的连接数（0 / 1 / 2） */
  adjacentLinks: number;
  /** 共享的羁绊名列表（用于展示） */
  linkedClasses: WeaponClass[];
  /** 简短说明 */
  summary: string;
}

/** 槽位所属的节肢位阶：前足(0-1) / 中足(2-3) / 后足(4-5) / 尾足(6+) */
export function slotZone(index: number, totalSlots = 6): LegZone {
  if (index <= 1) return 'front';
  if (totalSlots <= 4) return 'rear';
  if (index <= 3) return 'mid';
  if (index <= 5) return 'rear';
  return 'tail';
}

export const ZONE_META: Record<LegZone, { label: string; short: string; color: number; css: string; desc: string }> = {
  front: { label: '前足突击', short: '前', color: 0xff8a4c, css: '#ffb07a', desc: '暴击 +6%，伤害 +6%' },
  mid: { label: '中足速攻', short: '中', color: 0x5cd8ff, css: '#8ee8ff', desc: '攻速 +8%' },
  rear: { label: '后足控场', short: '后', color: 0x72e884, css: '#9cf4a8', desc: '射程 +20，击退 +25%' },
  tail: { label: '尾足奇袭', short: '尾', color: 0xd088ff, css: '#e4b8ff', desc: '暴击 +4%，攻速 +6%' },
};

/** 判断相邻两把武器是否共享至少一个 WeaponClass */
export function sharedClasses(a: OwnedWeapon | undefined, b: OwnedWeapon | undefined): WeaponClass[] {
  if (!a || !b) return [];
  const da = WEAPONS[a.id];
  const db = WEAPONS[b.id];
  if (!da || !db) return [];
  return da.classes.filter((c) => db.classes.includes(c));
}

/** 计算第 index 号槽位的六足位阶加成 + 相邻腿同系共鸣（每条相邻连线：伤害 +4%，攻速 +5%） */
export function computeSlotBonus(weapons: OwnedWeapon[], index: number, totalSlots = 6): SlotBonus {
  const zone = slotZone(index, totalSlots);
  const meta = ZONE_META[zone];
  let damagePct = 0;
  let attackSpeedPct = 0;
  let critChance = 0;
  let range = 0;
  let knockbackPct = 0;

  if (zone === 'front') {
    critChance += 0.06;
    damagePct += 0.06;
  } else if (zone === 'mid') {
    attackSpeedPct += 0.08;
  } else if (zone === 'rear') {
    range += 20;
    knockbackPct += 0.25;
  } else {
    critChance += 0.04;
    attackSpeedPct += 0.06;
  }

  const w = weapons[index];
  const linkedSet = new Set<WeaponClass>();
  let adjacentLinks = 0;
  if (w) {
    const left = index > 0 ? sharedClasses(w, weapons[index - 1]) : [];
    if (left.length > 0) {
      adjacentLinks++;
      for (const c of left) linkedSet.add(c);
    }
    const right = index + 1 < weapons.length ? sharedClasses(w, weapons[index + 1]) : [];
    if (right.length > 0) {
      adjacentLinks++;
      for (const c of right) linkedSet.add(c);
    }
  }

  if (adjacentLinks > 0) {
    damagePct += adjacentLinks * 0.04;
    attackSpeedPct += adjacentLinks * 0.05;
  }

  const parts: string[] = [`${meta.label}（${meta.desc}）`];
  if (adjacentLinks > 0) {
    parts.push(`相邻共鸣×${adjacentLinks}（伤害 +${adjacentLinks * 4}%，攻速 +${adjacentLinks * 5}%）`);
  }

  return {
    zone,
    zoneLabel: meta.label,
    shortLabel: meta.short,
    damagePct,
    attackSpeedPct,
    critChance,
    range,
    knockbackPct,
    adjacentLinks,
    linkedClasses: [...linkedSet],
    summary: parts.join(' · '),
  };
}

/** 统计整套武器中所有激活的相邻连接索引（返回每对连接的左侧索引 i，代表 i 与 i+1 相连） */
export function adjacentLinkPairs(weapons: OwnedWeapon[]): { left: number; right: number; classes: WeaponClass[] }[] {
  const out: { left: number; right: number; classes: WeaponClass[] }[] = [];
  for (let i = 0; i + 1 < weapons.length; i++) {
    const shared = sharedClasses(weapons[i], weapons[i + 1]);
    if (shared.length > 0) out.push({ left: i, right: i + 1, classes: shared });
  }
  return out;
}
