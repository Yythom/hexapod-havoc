import type { ContractId, WeaponEnchantId } from '../core/contracts';
import type { OwnedWeapon, RunPhase, RunState } from '../core/RunState';
import type { ShellSkinId } from '../core/save';
import { ZERO_STATS, type Stats } from '../core/stats';
import type { BiomeId } from '../data/biomes';
import { WEAPONS, type WeaponClass } from '../data/weapons';

export type CoopRole = 'off' | 'host' | 'guest';

export interface LobbyPlayer {
  character: string;
  weapon: string;
  shellSkin: ShellSkinId;
  ready: boolean;
}

export interface LobbyStatePayload {
  roomCode: string;
  difficulty: number;
  biome: BiomeId;
  seed: string;
  host: LobbyPlayer;
  guest: LobbyPlayer | null;
}

export interface MatchStartPayload {
  seed: string;
  difficulty: number;
  biome: BiomeId;
  host: LobbyPlayer;
  guest: LobbyPlayer;
}

/** 客机发给房主的实时操作帧 */
export interface GuestInputPayload {
  seq: number;
  ix: number;
  iy: number;
  dash: boolean;
}

export interface SnapWeapon {
  id: string;
  tier: number;
  cursed?: boolean;
  enchant?: WeaponEnchantId;
}

export interface SnapPlayer {
  x: number;
  y: number;
  rot: number;
  hp: number;
  maxHp: number;
  shield: number;
  downed: boolean;
  revivePct: number;
  dashTime: number;
  dashRatio: number;
  dashCharges: number;
  maxDashCharges: number;
  frenzyTime: number;
  invuln: number;
  nectar: number;
  totalNectar: number;
  level: number;
  xp: number;
  xpNeeded: number;
  pendingLevelUps: number;
  chests: number;
  kills: number;
  moving: boolean;
  speed: number;
  weaponSlots: number;
  weapons: SnapWeapon[];
  aims: number[];
}

/**
 * 紧凑敌人数组：[uid, defId, x, y, hp, maxHp, scale, rot, flags, statusBits]
 * flags: bit0=flash, bit1=cursed, bit2=buffed, bit3=elite, bit4=boss
 * statusBits: bit0=poison, bit1=burn, bit2=frozen, bit3=slow, bit4=vuln, bit5=wet
 */
export type SnapEnemy = [number, string, number, number, number, number, number, number, number, number];

/** [tex, x, y, rot, scale, alpha, tint, vx, vy, spin] */
export type SnapProj = [string, number, number, number, number, number, number, number, number, number];

/** [kind: 0=silk 1=stinger 2=orb, x, y, angle, vx, vy] */
export type SnapShot = [number, number, number, number, number, number];

/** [uid, kind: 0=nectar 1=chest 2=fruit 3=mushroom 4=frenzy, x, y, val] */
export type SnapPickup = [number, number, number, number, number];

/** [uid, tex, x, y, rot, scale] */
export type SnapSummon = [number, string, number, number, number, number];

/** [tex, x, y, rot, scale] */
export type SnapSprite = [string, number, number, number, number];

/** [kind: 0=cloud 1=web, x, y, r, alpha] */
export type SnapHazard = [number, number, number, number, number];

export interface SnapArena {
  puddles: [number, number, number][];
  leaves: [number, number, number, number][]; // [x, y, r, burnLeft]
  stumps: [number, number, number][];
  bloom: [number, number, number, number] | null; // [x, y, r, ratio]
  flames: [number, number, number][];
  decoys: [number, number][];
}

export type SnapFxEvent =
  | { t: 'num'; x: number; y: number; v: string | number; kind: 'normal' | 'crit' | 'poison' | 'burn' | 'player' | 'heal' | 'dodge' | 'level' }
  | { t: 'ring'; x: number; y: number; r: number; col: number }
  | { t: 'exp'; x: number; y: number; r: number; col: number; tier: number }
  | { t: 'burst'; x: number; y: number; col: number; n: number; sp: number; sc: number }
  | { t: 'beam'; x1: number; y1: number; x2: number; y2: number; col: number; w: number }
  | { t: 'chain'; pts: [number, number][]; col: number }
  | { t: 'sfx'; name: string }
  | { t: 'banner'; text: string; col?: string }
  | { t: 'streak'; count: number }
  | { t: 'shake'; ms: number; amp: number };

export interface CombatSnapshotPayload {
  tick: number;
  wave: number;
  endless: boolean;
  phase: RunPhase;
  waveTimeLeft: number;
  activeWeather: number;
  arenaHint: string;
  boss: { name: string; hp: number; maxHp: number } | null;
  p1: SnapPlayer;
  p2: SnapPlayer;
  enemies: SnapEnemy[];
  projs: SnapProj[];
  shots: SnapShot[];
  pickups: SnapPickup[];
  summons: SnapSummon[];
  devices: SnapSprite[];
  hazards: SnapHazard[];
  arena: SnapArena;
  fx: SnapFxEvent[];
}

/** 房主通知客机进入波间界面（携带客机本波真实收获与状态） */
export interface EnterIntermissionPayload {
  wave: number;
  endless: boolean;
  won: boolean;
  nectar: number;
  totalNectar: number;
  waveNectar: number;
  waveKills: number;
  waveHarvest: number;
  waveInterest: number;
  kills: number;
  level: number;
  xp: number;
  pendingLevelUps: number;
  chests: number;
  bonus: Stats;
  weapons: OwnedWeapon[];
  activeContract: ContractId | null;
  nextWaveOneHp: boolean;
  nextWaveBait: number;
  nextWavePeacock: number;
  mirrorCharges: number;
  curseOfferBonus: boolean;
}

/** 客机逛完波间商店点「准备」后发回房主的完整构筑同步 */
export interface GuestBuildPayload {
  bonus: Stats;
  items: Record<string, number>;
  weapons: OwnedWeapon[];
  nectar: number;
  totalNectar: number;
  level: number;
  xp: number;
  pendingLevelUps: number;
  chests: number;
  activeContract: ContractId | null;
  nextWaveOneHp: boolean;
  nextWaveBait: number;
  nextWavePeacock: number;
  mirrorCharges: number;
  curseOfferBonus: boolean;
}

export interface CoopResultPlayer {
  character: string;
  weapon: string;
  level: number;
  kills: number;
  nectar: number;
  weapons: { id: string; tier: number; totalDamage: number }[];
  sets: { cls: WeaponClass; count: number }[];
}

export interface MatchResultPayload {
  win: boolean;
  endless: boolean;
  wave: number;
  difficulty: number;
  biome: BiomeId;
  seed: string;
  maxWaves: number;
  host: CoopResultPlayer;
  guest: CoopResultPlayer;
}

export type CoopMessage =
  | { type: 'ping'; ts: number }
  | { type: 'pong'; ts: number }
  | { type: 'lobby_state'; data: LobbyStatePayload }
  | { type: 'guest_profile'; data: LobbyPlayer }
  | { type: 'start_match'; data: MatchStartPayload }
  | { type: 'input'; data: GuestInputPayload }
  | { type: 'snap'; data: CombatSnapshotPayload }
  | { type: 'pause_state'; paused: boolean; by: 'host' | 'guest' }
  | { type: 'enter_intermission'; data: EnterIntermissionPayload }
  | { type: 'host_ready'; ready: boolean }
  | { type: 'guest_ready'; ready: boolean; build?: GuestBuildPayload }
  | { type: 'start_wave'; wave: number; endless: boolean }
  | { type: 'victory_choice' }
  | { type: 'continue_endless' }
  | { type: 'finish_run' }
  | { type: 'match_result'; data: MatchResultPayload }
  | { type: 'return_lobby' }
  | { type: 'leave'; reason?: string };

export const COOP_PEER_PREFIX = 'hexapod-coop-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 生成 6 位易读联机房间码（去除 0/O/1/I 混淆字符） */
export function generateRoomCode(local = false): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return local ? `LOCAL-${out}` : out;
}

export function normalizeRoomCode(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.startsWith('LOCAL-')) {
    const rest = s.slice(6).replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return rest ? `LOCAL-${rest}` : '';
  }
  const urlMatch = s.match(/[?&]COOP=([A-Z0-9-]+)/);
  if (urlMatch) return normalizeRoomCode(urlMatch[1]);
  return s.replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function isLocalRoomCode(code: string): boolean {
  return code.toUpperCase().startsWith('LOCAL-');
}

export const REVIVE_RADIUS = 76;
export const REVIVE_TIME = 2.5;

/** 纯函数：更新队友救援进度（圈内按 2.5s 充满，离开后缓慢衰减） */
export function stepReviveProgress(cur: number, inRange: boolean, dt: number): number {
  if (inRange) return Math.min(1, cur + dt / REVIVE_TIME);
  return Math.max(0, cur - dt * 0.35);
}

/** 提取客机波间结算后的构筑快照，用于同步回房主 */
export function extractGuestBuild(run: RunState): GuestBuildPayload {
  return {
    bonus: { ...run.bonus },
    items: { ...run.items },
    weapons: run.weapons.map((w) => ({ ...w })),
    nectar: run.nectar,
    totalNectar: run.totalNectar,
    level: run.level,
    xp: run.xp,
    pendingLevelUps: run.pendingLevelUps,
    chests: run.chests,
    activeContract: run.activeContract,
    nextWaveOneHp: run.nextWaveOneHp,
    nextWaveBait: run.nextWaveBait,
    nextWavePeacock: run.nextWavePeacock,
    mirrorCharges: run.mirrorCharges,
    curseOfferBonus: run.curseOfferBonus,
  };
}

/** 房主侧将客机波间构筑应用到 run2 */
export function applyGuestBuild(run: RunState, build: GuestBuildPayload): void {
  run.bonus = { ...ZERO_STATS, ...build.bonus };
  run.items = { ...build.items };
  run.weapons = (build.weapons ?? []).filter((w) => !!WEAPONS[w.id]).map((w) => ({ ...w }));
  run.nectar = Number(build.nectar) || 0;
  run.totalNectar = Number(build.totalNectar) || 0;
  run.level = Math.max(1, Number(build.level) || 1);
  run.xp = Math.max(0, Number(build.xp) || 0);
  run.pendingLevelUps = Math.max(0, Number(build.pendingLevelUps) || 0);
  run.chests = Math.max(0, Number(build.chests) || 0);
  run.activeContract = build.activeContract ?? null;
  run.nextWaveOneHp = !!build.nextWaveOneHp;
  run.nextWaveBait = Math.max(0, Math.floor(Number(build.nextWaveBait) || 0));
  run.nextWavePeacock = Math.max(0, Math.floor(Number(build.nextWavePeacock) || 0));
  run.mirrorCharges = Math.max(0, Math.floor(Number(build.mirrorCharges) || 0));
  run.curseOfferBonus = !!build.curseOfferBonus;
  run.recomputeStats();
}

/** 客机侧接收房主波末结算，权威同步花蜜/升级/已消耗赌博状态并进入波间商店 */
export function applyEnterIntermission(run: RunState, d: EnterIntermissionPayload): void {
  run.wave = d.wave;
  run.endless = d.endless;
  run.won = d.won;
  run.nectar = d.nectar;
  run.totalNectar = d.totalNectar;
  run.waveNectar = d.waveNectar;
  run.waveKills = d.waveKills;
  run.waveHarvest = d.waveHarvest;
  run.waveInterest = d.waveInterest;
  run.kills = d.kills;
  run.level = d.level;
  run.xp = d.xp;
  run.pendingLevelUps = d.pendingLevelUps;
  run.chests = d.chests;
  run.bonus = { ...ZERO_STATS, ...d.bonus };
  run.weapons = (d.weapons ?? []).filter((w) => !!WEAPONS[w.id]).map((w) => ({ ...w }));
  run.activeContract = d.activeContract ?? null;
  run.nextWaveOneHp = !!d.nextWaveOneHp;
  run.nextWaveBait = Math.max(0, Math.floor(Number(d.nextWaveBait) || 0));
  run.nextWavePeacock = Math.max(0, Math.floor(Number(d.nextWavePeacock) || 0));
  run.mirrorCharges = Math.max(0, Math.floor(Number(d.mirrorCharges) || 0));
  run.curseOfferBonus = !!d.curseOfferBonus;
  run.coopMaxHp = null;
  run.coopDowned = false;
  run.coopRevivePct = 0;
  run.recomputeStats();
  run.resetIntermissionState();
  run.phase = 'intermission';
}
