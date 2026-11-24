import { resolveBiome, type BiomeDef, type BiomeId } from '../data/biomes';
import { baseSlots, CHARACTERS, type CharacterDef } from '../data/characters';
import { DIFFICULTIES, type DifficultyDef } from '../data/difficulty';
import { ITEMS, ZERO_MODS, type Mods } from '../data/items';
import { WAVES } from '../data/waves';
import { WEAPONS } from '../data/weapons';
import { CHALLENGES, type ChallengeId } from './challenges';
import type { ContractId, WeaponEnchantId } from './contracts';
import { DAILY_MUTATORS, type DailyMutatorId } from './daily';
import { xpToNext, type UpgradeOption } from './progression';
import type { ShellSkinId } from './save';
import { createScopedRng, generateSeed, normalizeSeed, type SeedChallengeTarget } from './seed';
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
  /** 紫火诅咒版本（伤害 +25%，攻速 +10%） */
  cursed?: boolean;
  /** 蜗老板蜕壳台赋予的武器附魔 */
  enchant?: WeaponEnchantId;
}

export interface OffscreenMarker {
  x: number;
  y: number;
  kind: 'lootbug' | 'elite' | 'boss' | 'chest' | 'bloom';
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
  /** 当前待选的升级强化卡（持久化，防止刷新页面白嫖重抽） */
  pendingUpgrades?: UpgradeOption[];
  /** 当前待开启宝箱的道具 id（持久化，防止刷新页面白嫖重抽） */
  pendingChestItem?: string;
  /** 本波待选的里程碑后院赌约（持久化防重抽） */
  pendingContracts?: ContractId[];
  /** 本波里程碑赌约是否已处理 */
  contractDone?: boolean;
  /** 已签下、将在下一波生效的赌约 */
  activeContract?: ContractId | null;
  /** 商店蜕壳台本波是否已使用 */
  forgeUsed?: boolean;
  /** 深渊献祭赌约：本波商店诅咒货加成 */
  curseOfferBonus?: boolean;
  /** 本波商店已刷新次数（持久化，防止刷新页面重置刷新费/免费刷新） */
  shopRerolls?: number;
  /** 本波商店货架是否已初始化刷新过 */
  shopReady?: boolean;
  /** 本波已抽取升级与宝箱的确定性序号（保证种子续玩不漂移） */
  upgradeRollSeq?: number;
  chestRollSeq?: number;
  /** 幽灵蝉蜕：下一波开局生命锁为 1 */
  nextWaveOneHp?: boolean;
  /** 诱饵甜果：下一波开局额外空降的黄蜂批次数（每批 3 只） */
  nextWaveBait?: number;
  /** 孔雀尾羽：下一波生效的层数（经验 +100%、敌伤 +50%） */
  nextWavePeacock?: number;
  /** 复刻魔镜：待生效的复制次数 */
  mirrorCharges?: number;
  toxinDamage: number;
  meleeKills: number;
  maxSummons: number;
  lifestealHealed: number;
  devicesPlaced: number;
}

/** 开局选择：角色、难度、初始武器（可选生态场地、确定性种子、每日/主题挑战、自定义词条、禁用池与甲壳涂装） */
export interface RunSetup {
  character: string;
  difficulty: number;
  weapon: string;
  biome?: BiomeId;
  seed?: string;
  /** 来自好友种子挑战码的目标战绩（结算时对比胜负） */
  seedTarget?: SeedChallengeTarget;
  daily?: string;
  challenge?: ChallengeId;
  mutators?: DailyMutatorId[];
  banished?: string[];
  shellSkin?: ShellSkinId;
}

/** 蜘蛛 8 个槽 + 第七条腿 */
export const MAX_WEAPON_SLOTS = 9;

/** 一局游戏的全部状态。GameScene 和波次间界面写，UIScene 读。 */
export class RunState {
  readonly setup: RunSetup;
  readonly character: CharacterDef;
  readonly difficulty: DifficultyDef;
  readonly biome: BiomeDef;
  readonly seed: string;
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
  /** 当前已抽出待选的升级强化卡 */
  pendingUpgrades: UpgradeOption[] = [];
  /** 当前已抽出待开启宝箱的道具 id */
  pendingChestItem = '';
  /** 当前待选的里程碑后院赌约 */
  pendingContracts: ContractId[] = [];
  /** 本波里程碑赌约是否已选择完毕 */
  contractDone = false;
  /** 当前生效（或将在下一波生效）的后院赌约 */
  activeContract: ContractId | null = null;
  /** 本波商店蜕壳赋能台是否已使用 */
  forgeUsed = false;
  /** 深渊献祭赌约：本波商店额外提升诅咒货率 */
  curseOfferBonus = false;
  /** 本波商店已刷新次数 */
  shopRerolls = 0;
  /** 本波商店货架是否已初始化刷新过 */
  shopReady = false;
  /** 本波已抽取升级与宝箱的确定性序号 */
  upgradeRollSeq = 0;
  chestRollSeq = 0;
  /** 幽灵蝉蜕：下一波 1 血开局 */
  nextWaveOneHp = false;
  /** 诱饵甜果：下一波开局额外黄蜂批次数 */
  nextWaveBait = 0;
  /** 孔雀尾羽：下一波经验翻倍/敌伤+50% 层数 */
  nextWavePeacock = 0;
  /** 复刻魔镜：待生效的商店道具复制次数 */
  mirrorCharges = 0;
  /** 力量三角：本波因受伤累积的伤害惩罚（下波开局清零） */
  waveDamagePenalty = 0;
  /** 孔雀尾羽/赌约：本波激活的敌人伤害倍率 */
  waveEnemyDamageMult = 1;
  /** 孔雀尾羽/赌约：本波激活的经验获取倍率 */
  waveXpMult = 1;
  /** 赌约：本波激活的临时全伤害加成 */
  waveContractDamagePct = 0;
  /** 赌约：本波是否禁用一切回血（断愈死斗） */
  waveNoHeal = false;
  /** 赌约：本波花蜜拾取倍率（狂潮收割） */
  waveNectarMult = 1;
  /** 当前波次生效的天气序号（常规等于难度，无尽每 5 波轮换） */
  activeWeather = 0;
  /** 战场生态提示（阵风/金露花等，供 HUD 微胶囊展示） */
  arenaHint = '';

  /** Boss 战时的血量，给 HUD 显示 */
  boss: { name: string; hp: number; maxHp: number } | null = null;
  /** 屏幕外高价值目标方向指示（宝藏虫、精英、Boss、宝箱、金露花） */
  offscreenMarkers: OffscreenMarker[] = [];
  /** 主动冲刺充能进度（0~1，1 表示当前充能格已满） */
  dashRatio = 1;
  /** 当前可用冲刺次数 & 最大充能次数 */
  dashCharges = 1;
  maxDashCharges = 1;
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
    const biome = resolveBiome(setup.biome);
    const seed = setup.seed ? normalizeSeed(setup.seed) || generateSeed() : generateSeed();
    this.setup = { ...setup, biome: biome.id, seed };
    this.character = CHARACTERS[setup.character];
    this.difficulty = DIFFICULTIES[setup.difficulty];
    this.biome = biome;
    this.seed = seed;
    this.activeWeather = setup.difficulty;
    this.weapons = setup.weapon && this.weaponSlotsBase > 0 ? [{ id: setup.weapon, tier: 0 }] : [];
    this.recomputeStats();
    this.hp = this.maxHp;
  }

  /** 获取本局对应作用域与步数的确定性随机数流（保证同种子同波次商店/升级/地形/事件一致） */
  rng(scope: string, step = 0): () => number {
    return createScopedRng(this.seed, scope, step);
  }

  /** 本局目标通关波数（常规 20 波，主题挑战 10 波） */
  get maxWaves(): number {
    return this.setup.challenge ? CHALLENGES[this.setup.challenge].maxWaves : WAVES.length;
  }

  get maxHp(): number {
    if (this.hasMutator('glass_soul')) return 1;
    return Math.max(1, Math.round(this.stats.maxHp));
  }

  get xpNeeded(): number {
    return xpToNext(this.level);
  }

  private get weaponSlotsBase(): number {
    const base = baseSlots(this.character);
    if (base <= 0) return 0;
    if (this.hasMutator('one_slot')) return 1;
    return base;
  }

  /** 能装几把武器；蚁后不能装武器；孤胆单槽挑战锁为 1 */
  get weaponSlots(): number {
    const base = this.weaponSlotsBase;
    if (base <= 0) return 0;
    if (this.hasMutator('one_slot')) return 1;
    return Math.min(MAX_WEAPON_SLOTS, base + this.mods.weaponSlots);
  }

  /** 交换两个武器槽的位置（用于调整六足位阶与相邻共鸣） */
  swapWeapons(i: number, j: number): boolean {
    if (i === j || i < 0 || j < 0 || i >= this.weapons.length || j >= this.weapons.length) return false;
    const tmp = this.weapons[i];
    this.weapons[i] = this.weapons[j];
    this.weapons[j] = tmp;
    this.recomputeStats();
    return true;
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
    // 生态场地基础加成
    if (this.biome.stats) addStats(this.biome.stats);
    addMods(this.biome.mods);
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
    // 血色巨钳（Bloody Hand）：每 1% 吸取额外 +2% 伤害
    if (m.bloodyHand > 0 && s.lifesteal > 0) {
      s.damagePct += s.lifesteal * 2 * m.bloodyHand;
    }
    // 力量三角（Triangle of Power）：本波受击累积减伤惩罚
    if (this.waveDamagePenalty > 0) {
      s.damagePct -= this.waveDamagePenalty;
    }
    if (this.waveContractDamagePct !== 0) {
      s.damagePct += this.waveContractDamagePct;
    }
    s.maxHp *= Math.max(0.1, 1 + m.maxHpPct);
    this.stats = s;
    this.mods = m;
    this.maxDashCharges = 1 + Math.max(0, Math.floor(m.dashCharges));
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

  /** 进入新一波战斗前清空本波波间抽卡缓存（保留锁定的商店货架供下一波刷新沿用） */
  resetIntermissionState(): void {
    this.pendingUpgrades = [];
    this.pendingChestItem = '';
    this.pendingContracts = [];
    this.contractDone = false;
    this.forgeUsed = false;
    this.curseOfferBonus = false;
    this.shopRerolls = 0;
    this.shopReady = false;
    this.upgradeRollSeq = 0;
    this.chestRollSeq = 0;
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
      pendingUpgrades: this.pendingUpgrades.map((u) => ({ ...u })),
      pendingChestItem: this.pendingChestItem,
      pendingContracts: [...this.pendingContracts],
      contractDone: this.contractDone,
      activeContract: this.activeContract,
      forgeUsed: this.forgeUsed,
      curseOfferBonus: this.curseOfferBonus,
      shopRerolls: this.shopRerolls,
      shopReady: this.shopReady,
      upgradeRollSeq: this.upgradeRollSeq,
      chestRollSeq: this.chestRollSeq,
      nextWaveOneHp: this.nextWaveOneHp,
      nextWaveBait: this.nextWaveBait,
      nextWavePeacock: this.nextWavePeacock,
      mirrorCharges: this.mirrorCharges,
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
    run.pendingUpgrades = Array.isArray(data.pendingUpgrades)
      ? data.pendingUpgrades
          .filter((u) => u && STAT_KEYS.includes(u.stat) && Number.isFinite(u.value) && Number.isFinite(u.tier))
          .map((u) => ({ stat: u.stat, value: u.value, tier: u.tier }))
      : [];
    run.pendingChestItem = typeof data.pendingChestItem === 'string' && ITEMS[data.pendingChestItem] ? data.pendingChestItem : '';
    run.pendingContracts = Array.isArray(data.pendingContracts) ? [...data.pendingContracts] : [];
    run.contractDone = !!data.contractDone;
    run.activeContract = data.activeContract ?? null;
    run.forgeUsed = !!data.forgeUsed;
    run.curseOfferBonus = !!data.curseOfferBonus;
    run.shopRerolls = Math.max(0, Math.floor(Number(data.shopRerolls) || 0));
    run.shopReady =
      typeof data.shopReady === 'boolean'
        ? data.shopReady
        : run.pendingLevelUps === 0 && run.chests === 0 && run.offers.length === run.shopOfferCount;
    run.upgradeRollSeq = Math.max(0, Math.floor(Number(data.upgradeRollSeq) || 0));
    run.chestRollSeq = Math.max(0, Math.floor(Number(data.chestRollSeq) || 0));
    run.nextWaveOneHp = !!data.nextWaveOneHp;
    run.nextWaveBait = Math.max(0, Math.floor(Number(data.nextWaveBait) || 0));
    run.nextWavePeacock = Math.max(0, Math.floor(Number(data.nextWavePeacock) || 0));
    run.mirrorCharges = Math.max(0, Math.floor(Number(data.mirrorCharges) || 0));
    run.waveDamagePenalty = 0;
    run.waveEnemyDamageMult = 1;
    run.waveXpMult = 1;
    run.waveContractDamagePct = 0;
    run.waveNoHeal = false;
    run.waveNectarMult = 1;
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
