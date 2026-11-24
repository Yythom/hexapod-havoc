import { CHARACTER_ORDER, CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import type { SavedRun } from './RunState';

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
  last: { character: string; difficulty: number; weapon: string };
  runs: number;
  wins: number;
  /** 图鉴：使用过的武器 id → 历史最高品阶（0~3） */
  seenWeapons: Record<string, number>;
  /** 图鉴：获得过的道具 id → 累计获取次数 */
  seenItems: Record<string, number>;
  /** 图鉴：击败过的敌人 id → 累计击杀数 */
  enemyKills: Record<string, number>;
}

const KEY = 'hexapod-havoc-save-v1';
const RUN_KEY = 'hexapod-havoc-run-v1';

function fresh(): SaveData {
  return {
    version: 1,
    unlocked: CHARACTER_ORDER.filter((id) => CHARACTERS[id].unlock === null),
    best: {},
    bestEndless: {},
    dailyBest: {},
    last: { character: CHARACTER_ORDER[0], difficulty: 0, weapon: CHARACTERS[CHARACTER_ORDER[0]].startWeapons[0] },
    runs: 0,
    wins: 0,
    seenWeapons: {},
    seenItems: {},
    enemyKills: {},
  };
}

let cache: SaveData | null = null;
/** 沙盒模式：只改内存里的副本，不写浏览器存储（模拟玩家用，避免污染真实存档） */
let sandbox = false;

/** 打开时从一份全新的默认存档开始；关闭时重新读回真实存档 */
export function setSaveSandbox(on: boolean): void {
  sandbox = on;
  cache = null;
}

/** 读存档。隐私模式、存储被禁用或数据损坏时退回默认值，游戏照常能玩。 */
export function loadSave(): SaveData {
  if (cache) return cache;
  const data = fresh();
  if (sandbox) {
    cache = data;
    return data;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (Array.isArray(parsed.unlocked)) data.unlocked = [...new Set([...data.unlocked, ...parsed.unlocked.filter((id) => CHARACTERS[id])])];
      if (parsed.best && typeof parsed.best === 'object') data.best = { ...parsed.best };
      if (parsed.bestEndless && typeof parsed.bestEndless === 'object') data.bestEndless = { ...parsed.bestEndless };
      if (parsed.dailyBest && typeof parsed.dailyBest === 'object') data.dailyBest = { ...parsed.dailyBest };
      if (parsed.last && CHARACTERS[parsed.last.character]) data.last = { ...data.last, ...parsed.last };
      data.runs = Number(parsed.runs) || 0;
      data.wins = Number(parsed.wins) || 0;
      if (parsed.seenWeapons && typeof parsed.seenWeapons === 'object') data.seenWeapons = { ...parsed.seenWeapons };
      if (parsed.seenItems && typeof parsed.seenItems === 'object') data.seenItems = { ...parsed.seenItems };
      if (parsed.enemyKills && typeof parsed.enemyKills === 'object') data.enemyKills = { ...parsed.enemyKills };
    }
  } catch {
    // 读不到就用默认存档
  }
  cache = data;
  return data;
}

function persist(): void {
  if (sandbox) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(loadSave()));
  } catch {
    // 写不进去（隐私模式等）就只在本次会话里生效
  }
}

export function isUnlocked(character: string): boolean {
  return loadSave().unlocked.includes(character);
}

/** 解锁角色，返回是不是新解锁的 */
export function unlockCharacter(character: string): boolean {
  const s = loadSave();
  if (s.unlocked.includes(character)) return false;
  s.unlocked.push(character);
  persist();
  return true;
}

export function bestCleared(character: string): number {
  return loadSave().best[character] ?? -1;
}

export function bestEndlessWave(character: string): number {
  return loadSave().bestEndless[character] ?? 0;
}

/** 记录角色的无尽模式最高波次，返回是否刷新纪录 */
export function recordEndlessWave(character: string, wave: number): boolean {
  if (wave <= 20) return false;
  const s = loadSave();
  const prev = s.bestEndless[character] ?? 0;
  if (wave <= prev) return false;
  s.bestEndless[character] = wave;
  persist();
  return true;
}

export function getDailyBest(dateKey: string): { wave: number; win: boolean } | null {
  return loadSave().dailyBest[dateKey] ?? null;
}

/** 记录当日每日挑战成绩，返回是否刷新当日最佳 */
export function recordDailyResult(dateKey: string, wave: number, win: boolean): boolean {
  const s = loadSave();
  const prev = s.dailyBest[dateKey];
  const improved = !prev || wave > prev.wave || (win && !prev.win);
  if (improved) {
    s.dailyBest[dateKey] = { wave: Math.max(wave, prev?.wave ?? 0), win: win || !!prev?.win };
    persist();
  }
  return improved;
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
    const data = fresh();
    data.unlocked = [...new Set([...data.unlocked, ...parsed.unlocked.filter((id) => typeof id === 'string' && !!CHARACTERS[id])])];
    if (parsed.best && typeof parsed.best === 'object') data.best = { ...parsed.best };
    if (parsed.bestEndless && typeof parsed.bestEndless === 'object') data.bestEndless = { ...parsed.bestEndless };
    if (parsed.dailyBest && typeof parsed.dailyBest === 'object') data.dailyBest = { ...parsed.dailyBest };
    if (parsed.last && CHARACTERS[parsed.last.character]) data.last = { ...data.last, ...parsed.last };
    data.runs = Math.max(0, Number(parsed.runs) || 0);
    data.wins = Math.max(0, Number(parsed.wins) || 0);
    if (parsed.seenWeapons && typeof parsed.seenWeapons === 'object') data.seenWeapons = { ...parsed.seenWeapons };
    if (parsed.seenItems && typeof parsed.seenItems === 'object') data.seenItems = { ...parsed.seenItems };
    if (parsed.enemyKills && typeof parsed.enemyKills === 'object') data.enemyKills = { ...parsed.enemyKills };
    cache = data;
    persist();
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
  const s = loadSave();
  s.runs++;
  let newTier = false;
  if (win) {
    s.wins++;
    const before = maxDifficulty(character);
    s.best[character] = Math.max(bestCleared(character), difficulty);
    newTier = maxDifficulty(character) > before;
  }
  persist();
  return newTier;
}

export function rememberChoice(character: string, difficulty: number, weapon: string): void {
  loadSave().last = { character, difficulty, weapon };
  persist();
}

/** 保存波间局中进度（断点续玩） */
export function saveActiveRun(data: SavedRun): void {
  if (sandbox) return;
  try {
    window.localStorage.setItem(RUN_KEY, JSON.stringify(data));
  } catch {
    // 忽略存储异常
  }
}

/** 读取未完成的断点存档 */
export function loadActiveRun(): SavedRun | null {
  if (sandbox) return null;
  try {
    const raw = window.localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedRun>;
    if (parsed.version !== 1 || !parsed.setup || !CHARACTERS[parsed.setup.character]) return null;
    return parsed as SavedRun;
  } catch {
    return null;
  }
}

/** 清除局中断点存档（结算或重开新局时） */
export function clearActiveRun(): void {
  if (sandbox) return;
  try {
    window.localStorage.removeItem(RUN_KEY);
  } catch {
    // 忽略
  }
}

/** 图鉴记录：获得/升级武器 */
export function recordWeaponSeen(id: string, tier: number): void {
  const s = loadSave();
  const prev = s.seenWeapons[id];
  if (prev === undefined || tier > prev) {
    s.seenWeapons[id] = tier;
    persist();
  }
}

/** 图鉴记录：获得道具 */
export function recordItemSeen(id: string): void {
  const s = loadSave();
  s.seenItems[id] = (s.seenItems[id] ?? 0) + 1;
  persist();
}

/** 图鉴记录：批量写入击杀统计（每波结束/结算写入，避免高频刷盘） */
export function recordEnemyKillsBatch(kills: Record<string, number>): void {
  const entries = Object.entries(kills);
  if (entries.length === 0) return;
  const s = loadSave();
  for (const [id, n] of entries) {
    if (n > 0) s.enemyKills[id] = (s.enemyKills[id] ?? 0) + n;
  }
  persist();
}
