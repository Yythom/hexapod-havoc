import { baseSlots, CHARACTERS, type CharacterDef } from '../data/characters';
import { DIFFICULTIES, type DifficultyDef } from '../data/difficulty';
import { ITEMS, ZERO_MODS, type Mods } from '../data/items';
import { WEAPONS } from '../data/weapons';
import { DAILY_MUTATORS, type DailyMutatorId } from './daily';
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
  /** Railgun：本波累积的额外伤害 */
  ramp?: number;
  /** 上一波造成的伤害统计 */
  waveDamage?: number;
  /** 本局累计造成的伤害统计 */
  totalDamage?: number;
}

export interface OffscreenMarker {
  x: number;
  y: number;
  kind: 'lootbug' | 'elite' | 'boss' | 'chest';
}

/** 局中断点续玩存档结构（波间进入商店时自动保存） */
export interface SavedRun {
  version: 1;
  setup: RunSetup;
  wave: number;
  endless: boolean;
  won: boolean;
  victoryRecorded: boolean;
  bonus: Stats;
  items: Record<string, number>;
  weapons: OwnedWeapon[];
  offers: (Offer | null)[];
  nectar: number;
  waveNectar: number;
  waveHarvest: number;
  waveInterest: number;
  totalNectar: number;
  kills: number;
  level: number;
  xp: number;
  pendingLevelUps: number;
  chests: number;
  toxinDamage: number;
  meleeKills: number;
  maxSummons: number;
  lifestealHealed: number;
  devicesPlaced: number;
}

/** 开局选择：角色、难度、初始武器（可选每日挑战日期与突变词条） */
export interface RunSetup {
  character: string;
  difficulty: number;
  weapon: string;
  daily?: string;
  mutators?: DailyMutatorId[];
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
  waveKills = 0;
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
  /** 屏幕外高价值目标方向指示（宝藏虫、精英、Boss、宝箱） */
  offscreenMarkers: OffscreenMarker[] = [];
  /** 主动冲刺充能进度（0~1，1 表示就绪） */
  dashRatio = 1;
  /** 琥珀狂热剩余秒数 */
  frenzyTime = 0;
  /** 本局造成的毒素伤害（解锁屁步甲用） */
  toxinDamage = 0;
  /** 其他解锁条件的统计 */
  meleeKills = 0;
  maxSummons = 0;
  lifestealHealed = 0;
  devicesPlaced = 0;
  won = false;
  /** 是否进入第 21 波起的无尽模式 */
  endless = false;
  /** 是否已记录第 20 波通关（防止无尽结束重复计胜场） */
  victoryRecorded = false;
  newDifficultyUnlocked = false;

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

  hasMutator(id: DailyMutatorId): boolean {
    return !!this.setup.mutators?.includes(id);
  }

  /** 商店单次刷新展示的商品数（每日挑战「虫市清仓」为 3 格，常规 4 格） */
  get shopOfferCount(): number {
    return this.hasMutator('discount') ? 3 : 4;
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
    for (const w of this.weapons) {
      const def = WEAPONS[w.id];
      if (!def) continue;
      if (def.bonusStats) addStats(def.bonusStats);
      if (def.special?.growthMaxHp) s.maxHp += Math.min(25, Math.floor(((w.kills ?? 0) / 20) * def.special.growthMaxHp));
      if (def.special?.armorPerWeapon) s.armor += def.special.armorPerWeapon * this.weapons.length;
    }
    for (const set of activeSets(this.weapons)) {
      addStats(set.level.stats);
      addMods(set.level.mods);
    }
    // 每日挑战词条加成
    for (const mid of this.setup.mutators ?? []) {
      const mdef = DAILY_MUTATORS[mid];
      if (!mdef) continue;
      if (mdef.stats) addStats(mdef.stats);
      addMods(mdef.mods);
    }
    // 角色规则
    const perks = this.character.perks;
    if (perks.speedToDamage) s.damagePct += Math.max(0, s.speedPct);
    if (perks.lateBloom && this.wave <= perks.lateBloom.waves) m.weaponDamagePct += perks.lateBloom.pct;
    if (perks.noDodge) s.dodge = 0;
    if (perks.lifestealOnly) s.regen = 0;
    if (m.loneWolf > 0 && this.weaponSlotsBase > 0) {
      const empty = Math.max(0, this.weaponSlots - this.weapons.length);
      s.damagePct += empty * 0.3 * m.loneWolf;
      s.attackSpeedPct += empty * 0.12 * m.loneWolf;
    }
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

  /** 序列化当前局内进度（用于波间断点续玩） */
  serialize(): SavedRun {
    return {
      version: 1,
      setup: { ...this.setup },
      wave: this.wave,
      endless: this.endless,
      won: this.won,
      victoryRecorded: this.victoryRecorded,
      bonus: { ...this.bonus },
      items: { ...this.items },
      weapons: this.weapons.map((w) => ({ ...w })),
      offers: this.offers.map((o) => (o ? { ...o } : null)),
      nectar: this.nectar,
      waveNectar: this.waveNectar,
      waveHarvest: this.waveHarvest,
      waveInterest: this.waveInterest,
      totalNectar: this.totalNectar,
      kills: this.kills,
      level: this.level,
      xp: this.xp,
      pendingLevelUps: this.pendingLevelUps,
      chests: this.chests,
      toxinDamage: this.toxinDamage,
      meleeKills: this.meleeKills,
      maxSummons: this.maxSummons,
      lifestealHealed: this.lifestealHealed,
      devicesPlaced: this.devicesPlaced,
    };
  }

  /** 从断点存档恢复一局状态 */
  static restore(data: SavedRun): RunState {
    const run = new RunState(data.setup);
    run.wave = Math.max(1, Math.floor(data.wave || 1));
    run.endless = !!data.endless;
    run.won = !!data.won;
    run.victoryRecorded = !!data.victoryRecorded;
    run.bonus = { ...ZERO_STATS, ...data.bonus };
    run.items = { ...data.items };
    run.weapons = (data.weapons ?? []).filter((w) => !!WEAPONS[w.id]).map((w) => ({ ...w }));
    run.offers = Array.isArray(data.offers) ? data.offers.map((o) => (o ? { ...o } : null)) : [];
    run.nectar = Number(data.nectar) || 0;
    run.waveNectar = Number(data.waveNectar) || 0;
    run.waveHarvest = Number(data.waveHarvest) || 0;
    run.waveInterest = Number(data.waveInterest) || 0;
    run.totalNectar = Number(data.totalNectar) || 0;
    run.kills = Number(data.kills) || 0;
    run.level = Math.max(1, Number(data.level) || 1);
    run.xp = Math.max(0, Number(data.xp) || 0);
    run.pendingLevelUps = Math.max(0, Number(data.pendingLevelUps) || 0);
    run.chests = Math.max(0, Number(data.chests) || 0);
    run.toxinDamage = Number(data.toxinDamage) || 0;
    run.meleeKills = Number(data.meleeKills) || 0;
    run.maxSummons = Number(data.maxSummons) || 0;
    run.lifestealHealed = Number(data.lifestealHealed) || 0;
    run.devicesPlaced = Number(data.devicesPlaced) || 0;
    run.recomputeStats();
    run.hp = run.maxHp;
    run.phase = 'intermission';
    return run;
  }
}
