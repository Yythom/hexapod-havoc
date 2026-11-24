import { DEFAULT_BIOME, isBiomeId, type BiomeId } from '../data/biomes';
import { CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { WEAPONS } from '../data/weapons';
import { DAILY_MUTATORS, type DailyMutatorId } from './daily';

/** 去掉易混淆字符（0/O/1/I）的清晰种子字符表 */
const SEED_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PREFIX = 'HHS1:';

export interface SeedChallengeTarget {
  win: boolean;
  wave: number;
  kills: number;
  nectar: number;
  level: number;
  mvpId?: string;
  mvpTier?: number;
}

export interface SeedChallengePayload {
  seed: string;
  character: string;
  difficulty: number;
  weapon: string;
  biome: BiomeId;
  mutators?: DailyMutatorId[];
  target?: SeedChallengeTarget;
}

export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 规范化用户输入的短种子字符串（全大写，仅保留字母数字与短横线） */
export function normalizeSeed(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return cleaned.slice(0, 16);
}

/** 生成 8 位可读随机种子（如 K7M2P9Q4） */
export function generateSeed(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  }
  return out;
}

/** 按 (种子, 作用域, 序号) 生成独立确定性 PRNG 流，避免战斗操作差异污染后续波次的商店/升级/地形 */
export function createScopedRng(seed: string, scope: string, step = 0): () => number {
  return mulberry32(hashSeed(`hexapod:${seed}:${scope}:${step}`));
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const std = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = std.length % 4 === 0 ? '' : '='.repeat(4 - (std.length % 4));
  const bin = atob(std + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

interface CompactWire {
  s: string;
  c: string;
  d: number;
  w: string;
  b: BiomeId;
  m?: DailyMutatorId[];
  r?: {
    v: 0 | 1;
    w: number;
    k: number;
    n: number;
    l: number;
    m?: [string, number];
  };
}

/** 将一局开局配置与可选发起者成绩打包为可分享的短码（HHS1:...） */
export function encodeSeedChallenge(payload: SeedChallengePayload): string {
  const seed = normalizeSeed(payload.seed) || generateSeed();
  const wire: CompactWire = {
    s: seed,
    c: payload.character,
    d: Math.max(0, Math.min(DIFFICULTIES.length - 1, Math.floor(payload.difficulty))),
    w: payload.weapon,
    b: isBiomeId(payload.biome) ? payload.biome : DEFAULT_BIOME,
  };
  if (payload.mutators && payload.mutators.length > 0) {
    wire.m = payload.mutators.filter((id) => !!DAILY_MUTATORS[id]);
  }
  if (payload.target) {
    const t = payload.target;
    wire.r = {
      v: t.win ? 1 : 0,
      w: Math.max(1, Math.floor(t.wave)),
      k: Math.max(0, Math.floor(t.kills)),
      n: Math.max(0, Math.floor(t.nectar)),
      l: Math.max(1, Math.floor(t.level)),
      m: t.mvpId && WEAPONS[t.mvpId] ? [t.mvpId, Math.max(0, Math.min(3, Math.floor(t.mvpTier ?? 0)))] : undefined,
    };
  }
  return `${PREFIX}${toBase64Url(JSON.stringify(wire))}`;
}

/** 解析好友分享的种子挑战码（支持粘贴整段带提示文字的内容，自动提取 HHS1:... 片段） */
export function decodeSeedChallenge(input: string): SeedChallengePayload | null {
  try {
    const match = input.trim().match(/HHS1:[A-Za-z0-9_-]+/);
    if (!match) return null;
    const raw = JSON.parse(fromBase64Url(match[0].slice(PREFIX.length))) as Partial<CompactWire>;
    if (!raw || typeof raw !== 'object') return null;
    const seed = typeof raw.s === 'string' ? normalizeSeed(raw.s) : '';
    if (!seed) return null;
    if (typeof raw.c !== 'string' || !CHARACTERS[raw.c]) return null;
    const charDef = CHARACTERS[raw.c];
    const difficulty = Number.isFinite(raw.d) ? Math.max(0, Math.min(DIFFICULTIES.length - 1, Math.floor(raw.d!))) : 0;
    const weapon =
      typeof raw.w === 'string' && (raw.w === '' ? charDef.startWeapons.length === 0 : !!WEAPONS[raw.w])
        ? raw.w
        : (charDef.startWeapons[0] ?? '');
    const biome: BiomeId = isBiomeId(raw.b) ? raw.b : DEFAULT_BIOME;
    const mutators = Array.isArray(raw.m)
      ? [...new Set(raw.m.filter((id): id is DailyMutatorId => typeof id === 'string' && !!DAILY_MUTATORS[id as DailyMutatorId]))].slice(0, 3)
      : undefined;
    let target: SeedChallengeTarget | undefined;
    if (raw.r && typeof raw.r === 'object') {
      const r = raw.r;
      const mvp =
        Array.isArray(r.m) && typeof r.m[0] === 'string' && WEAPONS[r.m[0]]
          ? { mvpId: r.m[0], mvpTier: Math.max(0, Math.min(3, Math.floor(Number(r.m[1]) || 0))) }
          : {};
      target = {
        win: r.v === 1,
        wave: Math.max(1, Math.floor(Number(r.w) || 1)),
        kills: Math.max(0, Math.floor(Number(r.k) || 0)),
        nectar: Math.max(0, Math.floor(Number(r.n) || 0)),
        level: Math.max(1, Math.floor(Number(r.l) || 1)),
        ...mvp,
      };
    }
    return {
      seed,
      character: raw.c,
      difficulty,
      weapon,
      biome,
      mutators: mutators && mutators.length > 0 ? mutators : undefined,
      target,
    };
  } catch {
    return null;
  }
}

/** 对比本局成绩与发起者目标：通关 > 波次 > 击杀 > 花蜜 */
export function compareSeedTarget(
  actual: { win: boolean; wave: number; kills: number; nectar: number },
  target: SeedChallengeTarget,
): 'beat' | 'tie' | 'behind' {
  if (actual.win !== target.win) return actual.win ? 'beat' : 'behind';
  if (actual.wave !== target.wave) return actual.wave > target.wave ? 'beat' : 'behind';
  if (actual.kills !== target.kills) return actual.kills > target.kills ? 'beat' : 'behind';
  if (actual.nectar !== target.nectar) return actual.nectar > target.nectar ? 'beat' : 'behind';
  return 'tie';
}
