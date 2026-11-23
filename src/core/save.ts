import { CHARACTER_ORDER, CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';

/** 存在浏览器本地的进度：解锁的角色、每个角色的最高通关难度、上次的选择 */
export interface SaveData {
  version: 1;
  unlocked: string[];
  /** 角色 id → 已通关的最高难度序号（没通关为 -1） */
  best: Record<string, number>;
  last: { character: string; difficulty: number; weapon: string };
  runs: number;
  wins: number;
}

const KEY = 'hexapod-havoc-save-v1';

function fresh(): SaveData {
  return {
    version: 1,
    unlocked: CHARACTER_ORDER.filter((id) => CHARACTERS[id].unlock === null),
    best: {},
    last: { character: CHARACTER_ORDER[0], difficulty: 0, weapon: CHARACTERS[CHARACTER_ORDER[0]].startWeapons[0] },
    runs: 0,
    wins: 0,
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
      if (parsed.last && CHARACTERS[parsed.last.character]) data.last = { ...data.last, ...parsed.last };
      data.runs = Number(parsed.runs) || 0;
      data.wins = Number(parsed.wins) || 0;
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
