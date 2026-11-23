import { baseSlots, CHARACTERS, type CharacterDef } from '../data/characters';
import { DIFFICULTIES, type DifficultyDef } from '../data/difficulty';
import { ITEMS, ZERO_MODS, type Mods } from '../data/items';
import { xpToNext } from './progression';
import { activeSets } from './sets';
import type { Offer } from './shop';
import { BASE_STATS, STAT_KEYS, ZERO_STATS, type Stats } from './stats';

export type RunPhase = 'combat' | 'cleanup' | 'intermission' | 'dead' | 'victory';

export interface OwnedWeapon {
  id: string;
  /** 品质：0 普通 / 1 精良 / 2 稀有 / 3 传说 */
  tier: number;
  /** 成长型武器：本局用它击杀的数量 */
  kills?: number;
}

/** 开局选择：角色、难度、初始武器 */
export interface RunSetup {
  character: string;
  difficulty: number;
  weapon: string;
}

/** 蜘蛛 8 个槽 + 第七条腿 */
export const MAX_WEAPON_SLOTS = 9;

/** 一局游戏的全部状态。GameScene 和波次间界面写，UIScene 读。 */
export class RunState {
  readonly setup: RunSetup;
  readonly character: CharacterDef;
  readonly difficulty: DifficultyDef;
  wave = 1;
  phase: RunPhase = 'combat';
  waveTimeLeft = 0;

  /** 最终属性 = (基础 + 升级与成长 bonus + 道具 + 套装) × 最大生命修正 */
  stats: Stats = { ...BASE_STATS };
  mods: Mods = { ...ZERO_MODS };
  bonus: Stats = { ...ZERO_STATS };
  /** 道具 id → 数量 */
  items: Record<string, number> = {};
  weapons: OwnedWeapon[];
  /** 商店当前的 4 个商品，null 表示已买走 */
  offers: (Offer | null)[] = [];

  hp: number = BASE_STATS.maxHp;
  /** 护盾层数（犀角护符） */
  shield = 0;
  nectar = 0;
  waveNectar = 0;
  waveHarvest = 0;
  waveInterest = 0;
  totalNectar = 0;
  kills = 0;

  level = 1;
  xp = 0;
  /** 本波攒下、还没选属性的升级次数 */
  pendingLevelUps = 0;
  /** 本波捡到、还没打开的宝箱 */
  chests = 0;

  /** Boss 战时的血量，给 HUD 显示 */
  boss: { name: string; hp: number; maxHp: number } | null = null;
  /** 本局造成的毒素伤害（解锁屁步甲用） */
  toxinDamage = 0;
  /** 其他解锁条件的统计 */
  meleeKills = 0;
  maxSummons = 0;
  lifestealHealed = 0;
  devicesPlaced = 0;
  won = false;

  constructor(setup: RunSetup) {
    this.setup = setup;
    this.character = CHARACTERS[setup.character];
    this.difficulty = DIFFICULTIES[setup.difficulty];
    this.weapons = setup.weapon && this.weaponSlotsBase > 0 ? [{ id: setup.weapon, tier: 0 }] : [];
    this.recomputeStats();
    this.hp = this.maxHp;
  }

  get maxHp(): number {
    return Math.max(1, Math.round(this.stats.maxHp));
  }

  get xpNeeded(): number {
    return xpToNext(this.level);
  }

  private get weaponSlotsBase(): number {
    return baseSlots(this.character);
  }

  /** 能装几把武器；蚁后不能装武器 */
  get weaponSlots(): number {
    const base = this.weaponSlotsBase;
    if (base <= 0) return 0;
    return Math.min(MAX_WEAPON_SLOTS, base + this.mods.weaponSlots);
  }

  /** 蚁后：工蚁的品质，每 5 波提升一档 */
  get workerTier(): number {
    return Math.min(3, Math.floor(this.wave / 5));
  }

  /** 蚁后：当前工蚁数量 */
  get workerCount(): number {
    const w = this.character.perks.workers;
    if (!w) return 0;
    return Math.min(w.max, w.base + (this.level - 1) * w.perLevel);
  }

  itemCount(id: string): number {
    return this.items[id] ?? 0;
  }

  recomputeStats(): void {
    const s: Stats = { ...BASE_STATS };
    const m: Mods = { ...ZERO_MODS };
    const addStats = (st: Partial<Stats>, n = 1) => {
      for (const [k, v] of Object.entries(st) as [keyof Stats, number][]) s[k] += v * n;
    };
    const addMods = (md: Partial<Mods> | undefined, n = 1) => {
      if (!md) return;
      for (const [k, v] of Object.entries(md) as [keyof Mods, number][]) m[k] += v * n;
    };
    for (const k of STAT_KEYS) s[k] += this.bonus[k];
    addStats(this.character.stats);
    addMods(this.character.mods);
    for (const [id, n] of Object.entries(this.items)) {
      const def = ITEMS[id];
      if (!def) continue;
      addStats(def.stats, n);
      addMods(def.mods, n);
    }
    for (const set of activeSets(this.weapons)) {
      addStats(set.level.stats);
      addMods(set.level.mods);
    }
    // 角色规则
    const perks = this.character.perks;
    if (perks.speedToDamage) s.damagePct += Math.max(0, s.speedPct);
    if (perks.lateBloom && this.wave <= perks.lateBloom.waves) m.weaponDamagePct += perks.lateBloom.pct;
    if (perks.noDodge) s.dodge = 0;
    if (perks.lifestealOnly) s.regen = 0;
    s.maxHp *= Math.max(0.1, 1 + m.maxHpPct);
    this.stats = s;
    this.mods = m;
  }

  /** 加经验，返回升了几级 */
  addXp(n: number): number {
    this.xp += n;
    let up = 0;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.pendingLevelUps++;
      up++;
    }
    return up;
  }
}
