import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { DEFAULT_BIOME, isBiomeId, type BiomeId } from '../data/biomes';
import { CHARACTER_ORDER, CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { ITEMS } from '../data/items';
import type { SavedRun } from './RunState';
import { createCompatStorage, syncOnStorageEvent } from './storage';

export type ShellSkinId = 'default' | 'gold' | 'frost' | 'neon' | 'cosmic';

export const SHELL_SKINS: Record<ShellSkinId, { id: ShellSkinId; name: string; tint: number | null; css: string; req: string }> = {
  default: { id: 'default', name: '原色甲壳', tint: null, css: '#f2f1ec', req: '初始可用' },
  neon: { id: 'neon', name: '霓虹翠光', tint: 0x7cffb2, css: '#7cffb2', req: '通关任意模式或挑战' },
  gold: { id: 'gold', name: '流金战甲', tint: 0xffd86b, css: '#ffd86b', req: '图鉴累计收录 40 种武器/道具' },
  frost: { id: 'frost', name: '冰霜琉璃', tint: 0x9ce8ff, css: '#9ce8ff', req: '图鉴累计收录 40 种武器/道具' },
  cosmic: { id: 'cosmic', name: '星穹紫金', tint: 0xd89cff, css: '#e4b8ff', req: '累计击败 1500 只虫敌' },
};

export const SHELL_SKIN_ORDER: ShellSkinId[] = ['default', 'neon', 'gold', 'frost', 'cosmic'];

export interface CodexMilestoneInfo {
  seenEntries: number;
  totalKills: number;
  banishCap: number;
  unlockedSkins: ShellSkinId[];
}

/** 存在浏览器本地的进度：解锁的角色、每个角色的最高通关难度、上次的选择与后院图鉴收集记录 */
export interface SaveData {
  version: 1;
  unlocked: string[];
  /** 角色 id → 已通关的最高难度序号（没通关为 -1） */
  best: Record<string, number>;
  /** 角色 id → 无尽模式到达的最高波次（未进入过无尽则缺省） */
  bestEndless: Record<string, number>;
  /** 每日挑战记录：YYYY-MM-DD → 当日最高波次与是否通关 */
  dailyBest: Record<string, { wave: number; win: boolean }>;
  /** 已通关的主题挑战 id 列表 */
  challengesCleared: string[];
  /** 局前商店禁用道具列表（图鉴里程碑最多解锁 3 格） */
  banishedItems: string[];
  /** 当前选用的甲壳涂装 */
  shellSkin: ShellSkinId;
  last: { character: string; difficulty: number; weapon: string; biome?: BiomeId };
  runs: number;
  wins: number;
  /** 图鉴：使用过的武器 id → 历史最高品阶（0~3） */
  seenWeapons: Record<string, number>;
  /** 图鉴：获得过的道具 id → 累计获取次数 */
  seenItems: Record<string, number>;
  /** 图鉴：击败过的敌人 id → 累计击杀数 */
  enemyKills: Record<string, number>;
}

export interface SaveStoreState extends SaveData {
  unlockCharacter: (character: string) => boolean;
  recordEndlessWave: (character: string, wave: number) => boolean;
  recordDailyResult: (dateKey: string, wave: number, win: boolean) => boolean;
  recordChallengeCleared: (challengeId: string) => boolean;
  toggleBanishItem: (itemId: string) => boolean;
  setShellSkin: (skin: ShellSkinId) => void;
  recordRun: (character: string, difficulty: number, win: boolean) => boolean;
  rememberChoice: (character: string, difficulty: number, weapon: string, biome?: BiomeId) => void;
  recordWeaponSeen: (id: string, tier: number) => void;
  recordItemSeen: (id: string) => void;
  recordEnemyKillsBatch: (kills: Record<string, number>) => void;
  replaceSave: (data: SaveData) => void;
}

export interface ActiveRunStoreState {
  activeRun: SavedRun | null;
  saveActiveRun: (data: SavedRun) => void;
  clearActiveRun: () => void;
}

const KEY = 'hexapod-havoc-save-v1';
const RUN_KEY = 'hexapod-havoc-run-v1';

/** 沙盒模式：只改内存里的副本，不写浏览器存储（模拟玩家与单测用，避免污染真实存档） */
let sandbox = false;
const isSandbox = () => sandbox;

function freshSaveData(): SaveData {
  return {
    version: 1,
    unlocked: CHARACTER_ORDER.filter((id) => CHARACTERS[id].unlock === null),
    best: {},
    bestEndless: {},
    dailyBest: {},
    challengesCleared: [],
    banishedItems: [],
    shellSkin: 'default',
    last: { character: CHARACTER_ORDER[0], difficulty: 0, weapon: CHARACTERS[CHARACTER_ORDER[0]].startWeapons[0], biome: DEFAULT_BIOME },
    runs: 0,
    wins: 0,
    seenWeapons: {},
    seenItems: {},
    enemyKills: {},
  };
}

function sanitizeSaveData(parsed: Partial<SaveData> | undefined): SaveData {
  const data = freshSaveData();
  if (!parsed || typeof parsed !== 'object') return data;
  if (Array.isArray(parsed.unlocked)) {
    data.unlocked = [...new Set([...data.unlocked, ...parsed.unlocked.filter((id) => typeof id === 'string' && !!CHARACTERS[id])])];
  }
  if (parsed.best && typeof parsed.best === 'object') data.best = { ...parsed.best };
  if (parsed.bestEndless && typeof parsed.bestEndless === 'object') data.bestEndless = { ...parsed.bestEndless };
  if (parsed.dailyBest && typeof parsed.dailyBest === 'object') data.dailyBest = { ...parsed.dailyBest };
  if (Array.isArray(parsed.challengesCleared)) {
    data.challengesCleared = [...new Set(parsed.challengesCleared.filter((id) => typeof id === 'string'))];
  }
  if (Array.isArray(parsed.banishedItems)) {
    data.banishedItems = [...new Set(parsed.banishedItems.filter((id) => typeof id === 'string' && !!ITEMS[id]))].slice(0, 3);
  }
  if (typeof parsed.shellSkin === 'string' && SHELL_SKINS[parsed.shellSkin as ShellSkinId]) {
    data.shellSkin = parsed.shellSkin as ShellSkinId;
  }
  if (parsed.last && typeof parsed.last === 'object' && CHARACTERS[parsed.last.character]) {
    data.last = {
      ...data.last,
      ...parsed.last,
      biome: isBiomeId(parsed.last.biome) ? parsed.last.biome : DEFAULT_BIOME,
    };
  }
  data.runs = Math.max(0, Number(parsed.runs) || 0);
  data.wins = Math.max(0, Number(parsed.wins) || 0);
  if (parsed.seenWeapons && typeof parsed.seenWeapons === 'object') data.seenWeapons = { ...parsed.seenWeapons };
  if (parsed.seenItems && typeof parsed.seenItems === 'object') data.seenItems = { ...parsed.seenItems };
  if (parsed.enemyKills && typeof parsed.enemyKills === 'object') data.enemyKills = { ...parsed.enemyKills };
  return data;
}

function pickSaveData(s: SaveStoreState): SaveData {
  return {
    version: 1,
    unlocked: s.unlocked,
    best: s.best,
    bestEndless: s.bestEndless,
    dailyBest: s.dailyBest,
    challengesCleared: s.challengesCleared,
    banishedItems: s.banishedItems,
    shellSkin: s.shellSkin,
    last: s.last,
    runs: s.runs,
    wins: s.wins,
    seenWeapons: s.seenWeapons,
    seenItems: s.seenItems,
    enemyKills: s.enemyKills,
  };
}

/** 计算图鉴里程碑：禁用槽上限（最多 3 格）与已解锁的甲壳涂装 */
export function codexMilestones(save: SaveData = loadSave()): CodexMilestoneInfo {
  const seenEntries = Object.keys(save.seenWeapons).length + Object.keys(save.seenItems).length;
  const totalKills = Object.values(save.enemyKills).reduce((a, b) => a + (Number(b) || 0), 0);
  const banishCap = (seenEntries >= 15 ? 1 : 0) + (seenEntries >= 40 ? 1 : 0) + (totalKills >= 1500 ? 1 : 0);
  const unlockedSkins: ShellSkinId[] = ['default'];
  if (save.wins > 0 || save.challengesCleared.length > 0) unlockedSkins.push('neon');
  if (seenEntries >= 40) unlockedSkins.push('gold', 'frost');
  if (totalKills >= 1500) unlockedSkins.push('cosmic');
  return { seenEntries, totalKills, banishCap, unlockedSkins };
}

function sanitizeActiveRun(raw: unknown): SavedRun | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<SavedRun>;
  if (parsed.version !== 1 || !parsed.setup || !CHARACTERS[parsed.setup.character]) return null;
  return parsed as SavedRun;
}

/** 局外永久进度 Zustand Store（解锁/图鉴/最高纪录/每日战绩，自动持久化 + 多标签同步） */
export const useSaveStore = createStore<SaveStoreState>()(
  persist(
    (set, get) => ({
      ...freshSaveData(),

      unlockCharacter: (character) => {
        const cur = get().unlocked;
        if (cur.includes(character)) return false;
        set({ unlocked: [...cur, character] });
        return true;
      },

      recordEndlessWave: (character, wave) => {
        if (wave <= 20) return false;
        const cur = get().bestEndless;
        const prev = cur[character] ?? 0;
        if (wave <= prev) return false;
        set({ bestEndless: { ...cur, [character]: wave } });
        return true;
      },

      recordDailyResult: (dateKey, wave, win) => {
        const cur = get().dailyBest;
        const prev = cur[dateKey];
        const improved = !prev || wave > prev.wave || (win && !prev.win);
        if (!improved) return false;
        set({
          dailyBest: {
            ...cur,
            [dateKey]: { wave: Math.max(wave, prev?.wave ?? 0), win: win || !!prev?.win },
          },
        });
        return true;
      },

      recordChallengeCleared: (challengeId) => {
        const cur = get().challengesCleared;
        if (cur.includes(challengeId)) return false;
        set({ challengesCleared: [...cur, challengeId] });
        return true;
      },

      toggleBanishItem: (itemId) => {
        if (!ITEMS[itemId]) return false;
        const s = get();
        if (s.banishedItems.includes(itemId)) {
          set({ banishedItems: s.banishedItems.filter((id) => id !== itemId) });
          return true;
        }
        const cap = codexMilestones(pickSaveData(s)).banishCap;
        if (s.banishedItems.length >= cap) return false;
        set({ banishedItems: [...s.banishedItems, itemId] });
        return true;
      },

      setShellSkin: (skin) => {
        const s = get();
        const unlocked = codexMilestones(pickSaveData(s)).unlockedSkins;
        if (!unlocked.includes(skin)) return;
        set({ shellSkin: skin });
      },

      recordRun: (character, difficulty, win) => {
        const s = get();
        let newTier = false;
        let nextBest = s.best;
        if (win) {
          const prevBest = s.best[character] ?? -1;
          const beforeMax = Math.min(DIFFICULTIES.length - 1, prevBest + 1);
          const updated = Math.max(prevBest, difficulty);
          const afterMax = Math.min(DIFFICULTIES.length - 1, updated + 1);
          newTier = afterMax > beforeMax;
          nextBest = { ...s.best, [character]: updated };
        }
        set({
          runs: s.runs + 1,
          wins: win ? s.wins + 1 : s.wins,
          best: nextBest,
        });
        return newTier;
      },

      rememberChoice: (character, difficulty, weapon, biome = DEFAULT_BIOME) => {
        set({ last: { character, difficulty, weapon, biome } });
      },

      recordWeaponSeen: (id, tier) => {
        const cur = get().seenWeapons;
        const prev = cur[id];
        if (prev === undefined || tier > prev) {
          set({ seenWeapons: { ...cur, [id]: tier } });
        }
      },

      recordItemSeen: (id) => {
        const cur = get().seenItems;
        set({ seenItems: { ...cur, [id]: (cur[id] ?? 0) + 1 } });
      },

      recordEnemyKillsBatch: (kills) => {
        const entries = Object.entries(kills).filter(([, n]) => n > 0);
        if (entries.length === 0) return;
        const next = { ...get().enemyKills };
        for (const [id, n] of entries) {
          next[id] = (next[id] ?? 0) + n;
        }
        set({ enemyKills: next });
      },

      replaceSave: (data) => {
        set(sanitizeSaveData(data));
      },
    }),
    {
      name: KEY,
      version: 1,
      storage: createCompatStorage<SaveData>({ isSandbox }),
      partialize: (state) => pickSaveData(state),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSaveData(persisted as Partial<SaveData> | undefined),
      }),
    },
  ),
);

/** 波间断点续玩 Zustand Store（独立 key 持久化，不污染永久存档导出码） */
export const useActiveRunStore = createStore<ActiveRunStoreState>()(
  persist(
    (set) => ({
      activeRun: null,
      saveActiveRun: (data) => set({ activeRun: data }),
      clearActiveRun: () => set({ activeRun: null }),
    }),
    {
      name: RUN_KEY,
      version: 1,
      storage: createCompatStorage<{ activeRun: SavedRun | null }>({
        isSandbox,
        legacyWrap: (raw) => ({ activeRun: sanitizeActiveRun(raw) }),
      }),
      partialize: (state) => ({ activeRun: state.activeRun }),
      merge: (persisted, current) => {
        const p = persisted as { activeRun?: unknown } | undefined;
        return {
          ...current,
          activeRun: sanitizeActiveRun(p?.activeRun),
        };
      },
    },
  ),
);

syncOnStorageEvent(
  KEY,
  () => {
    void useSaveStore.persist.rehydrate();
  },
  isSandbox,
);

syncOnStorageEvent(
  RUN_KEY,
  () => {
    void useActiveRunStore.persist.rehydrate();
  },
  isSandbox,
);

/** 打开时从一份全新的默认存档开始（纯内存）；关闭时重新读回真实存档 */
export function setSaveSandbox(on: boolean): void {
  sandbox = on;
  if (on) {
    useSaveStore.setState(freshSaveData());
    useActiveRunStore.setState({ activeRun: null });
  } else {
    void useSaveStore.persist.rehydrate();
    void useActiveRunStore.persist.rehydrate();
  }
}

/** 读存档（返回当前 Zustand 持久化状态快照） */
export function loadSave(): SaveData {
  return pickSaveData(useSaveStore.getState());
}

export function isUnlocked(character: string): boolean {
  return useSaveStore.getState().unlocked.includes(character);
}

/** 解锁角色，返回是不是新解锁的 */
export function unlockCharacter(character: string): boolean {
  return useSaveStore.getState().unlockCharacter(character);
}

export function bestCleared(character: string): number {
  return useSaveStore.getState().best[character] ?? -1;
}

export function bestEndlessWave(character: string): number {
  return useSaveStore.getState().bestEndless[character] ?? 0;
}

/** 记录角色的无尽模式最高波次，返回是否刷新纪录 */
export function recordEndlessWave(character: string, wave: number): boolean {
  return useSaveStore.getState().recordEndlessWave(character, wave);
}

export function getDailyBest(dateKey: string): { wave: number; win: boolean } | null {
  return useSaveStore.getState().dailyBest[dateKey] ?? null;
}

/** 记录当日每日挑战成绩，返回是否刷新当日最佳 */
export function recordDailyResult(dateKey: string, wave: number, win: boolean): boolean {
  return useSaveStore.getState().recordDailyResult(dateKey, wave, win);
}

export function recordChallengeCleared(challengeId: string): boolean {
  return useSaveStore.getState().recordChallengeCleared(challengeId);
}

export function toggleBanishItem(itemId: string): boolean {
  return useSaveStore.getState().toggleBanishItem(itemId);
}

export function setShellSkin(skin: ShellSkinId): void {
  useSaveStore.getState().setShellSkin(skin);
}

/** 导出存档码（带版本前缀的 Base64，便于玩家备份或跨设备迁移） */
export function exportSaveCode(): string {
  const json = JSON.stringify(loadSave());
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `HH1:${btoa(bin)}`;
}

/** 导入存档码并立即持久化；格式无效返回 false */
export function importSaveCode(code: string): boolean {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith('HH1:')) return false;
    const bin = atob(trimmed.slice(4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SaveData>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.unlocked)) return false;
    useSaveStore.getState().replaceSave(sanitizeSaveData(parsed));
    return true;
  } catch {
    return false;
  }
}

/** 这个角色能选的最高难度：通关一档解锁下一档 */
export function maxDifficulty(character: string): number {
  return Math.min(DIFFICULTIES.length - 1, bestCleared(character) + 1);
}

/** 记录一局结束，返回是否解锁了新难度 */
export function recordRun(character: string, difficulty: number, win: boolean): boolean {
  return useSaveStore.getState().recordRun(character, difficulty, win);
}

export function rememberChoice(character: string, difficulty: number, weapon: string, biome?: BiomeId): void {
  useSaveStore.getState().rememberChoice(character, difficulty, weapon, biome);
}

/** 保存波间局中进度（断点续玩） */
export function saveActiveRun(data: SavedRun): void {
  useActiveRunStore.getState().saveActiveRun(data);
}

/** 读取未完成的断点存档 */
export function loadActiveRun(): SavedRun | null {
  return useActiveRunStore.getState().activeRun;
}

/** 清除局中断点存档（开战/结算/重开新局时） */
export function clearActiveRun(): void {
  useActiveRunStore.getState().clearActiveRun();
}

/** 图鉴记录：获得/升级武器 */
export function recordWeaponSeen(id: string, tier: number): void {
  useSaveStore.getState().recordWeaponSeen(id, tier);
}

/** 图鉴记录：获得道具 */
export function recordItemSeen(id: string): void {
  useSaveStore.getState().recordItemSeen(id);
}

/** 图鉴记录：批量写入击杀统计（每波结束/结算写入，避免高频刷盘） */
export function recordEnemyKillsBatch(kills: Record<string, number>): void {
  useSaveStore.getState().recordEnemyKillsBatch(kills);
}
