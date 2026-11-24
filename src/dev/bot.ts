/**
 * 开发用的模拟玩家，用来跑整局、调难度。只在 `npm run dev` 时加载，不会打进正式包。
 *
 * 在浏览器控制台里：
 *   __bot.start('smart')   // 'smart' 会躲怪和预警 / 'circle' 只会绕圈 / 'idle' 站着不动
 *   __bot.start('smart', { character: 'rhino', difficulty: 4 })   // 指定角色和难度
 *   __bot.run(5)           // 往下打 5 波（含波次间的升级和购物），返回每波的记录
 *   __bot.stop()           // 结束模拟，回到菜单，恢复读写真实存档
 *
 * 模拟期间存档处于沙盒模式：胜负和解锁只记在内存里，不会写进浏览器存储。
 */
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { touchMove } from '../core/input';
import type { RunSetup, RunState } from '../core/RunState';
import { CHARACTERS } from '../data/characters';
import { setSaveSandbox } from '../core/save';
import * as shop from '../core/shop';
import { ITEMS } from '../data/items';
import { WEAPONS } from '../data/weapons';
import type { Stats } from '../core/stats';

type Mode = 'smart' | 'circle' | 'idle';

interface WaveLog {
  w: number;
  /** 本波击杀、本波收入（含采蜜）、其中采蜜 */
  kills: number;
  income: number;
  harvest: number;
  /** 本波用时（秒），Boss 波看打了多久 */
  time: number;
  minHp: number;
  maxHp: number;
  maxEnemies: number;
  level: number;
  phase: string;
  gear?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyScene = any;

const UPGRADE_PRIORITY: (keyof Stats)[] = [
  'damagePct',
  'attackSpeedPct',
  'maxHp',
  'armor',
  'ranged',
  'melee',
  'toxin',
  'elemental',
  'critChance',
  'regen',
  'dodge',
  'speedPct',
  'lifesteal',
  'range',
  'harvest',
  'luck',
  'engineering',
];

/** 按角色调整升级偏好：机关角色在伤害之后优先工程 */
function upgradeRank(stat: keyof Stats, r: RunState): number {
  const devices = r.weapons.some((w) => WEAPONS[w.id].device);
  if (devices && stat === 'engineering') return 0.5;
  // 蚁后的工蚁吃近战
  if (r.character.perks.workers && stat === 'melee') return 0.5;
  return UPGRADE_PRIORITY.indexOf(stat);
}

/** 买东西的偏好：能合成的武器 > 能凑套装的武器 > 其他武器 > 道具；白蚁优先机关武器 */
function offerScore(r: RunState, kind: string, id: string, tier: number): number {
  if (kind !== 'weapon') return 0;
  const def = WEAPONS[id];
  if (r.mods.nonDeviceDamagePct < 0 && !def.device) return 0.5;
  if (r.weapons.some((w) => w.id === id && w.tier === tier)) return 3;
  const classes = new Set(r.weapons.flatMap((w) => WEAPONS[w.id].classes));
  return def.classes.some((t) => classes.has(t)) ? 2 : 1;
}

function hurtsHp(id: string): boolean {
  const d = ITEMS[id];
  return (d.stats.maxHp ?? 0) < 0 || (d.mods?.maxHpPct ?? 0) < 0;
}

export function installBot(game: Phaser.Game): void {
  let t = performance.now();
  let mode: Mode = 'smart';
  let circleT = 0;
  /** false 时波次间不买东西（单独测某把武器） */
  let shopOn = true;
  /** 固定和怪保持的距离（不传则按武器射程自动算） */
  let keepFixed = 0;
  const frame = () => {
    t += 1000 / 60;
    game.headlessStep(t, 1000 / 60);
  };
  const run = (): RunState => game.registry.get('run');
  /** 读取当前阶段（循环里会变，单独取避免 TS 收窄类型） */
  const phase = (): string => run().phase;
  const gs = (): AnyScene => game.scene.getScene('Game');

  const steer = (): [number, number] => {
    if (mode === 'idle') return [0, 0];
    if (mode === 'circle') {
      circleT += 1 / 60;
      return [Math.cos(circleT * 0.8), Math.sin(circleT * 0.8)];
    }
    const g = gs();
    const p = g.player;
    let fx = 0;
    let fy = 0;
    // 和怪保持的距离：按身上武器射程的中位数来，近战、喷火、飞蛾为主的构筑要贴近打
    const reaches: number[] = [];
    for (const w of run().weapons) {
      const d = WEAPONS[w.id];
      if (d.device || d.summon?.type === 'aphid' || d.summon?.type === 'web') continue;
      reaches.push(d.summon?.type === 'moth' ? 80 : d.kind === 'melee' ? d.range * 0.45 : d.range * 0.85);
    }
    reaches.sort((a, b) => a - b);
    const median = reaches.length ? reaches[Math.floor((reaches.length - 1) / 2)] : 200;
    const keep = keepFixed || Phaser.Math.Clamp(median, 80, 200);
    const flee = (x: number, y: number, radius: number, weight: number) => {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < radius) {
        const k = ((radius - d) / radius) * weight;
        fx += (dx / d) * k;
        fy += (dy / d) * k;
      }
    };
    for (const e of g.enemies.active) flee(e.x, e.y, keep + e.radius, e.def.boss ? 3 : 1);
    for (const s of g.shots.shots) flee(s.x, s.y, 140, 2);
    for (const s of g.tel.list) {
      if (s.kind === 'circle') flee(s.x, s.y, s.r + 30, 4);
      else flee(s.x, s.y, s.r + 30, 4);
    }
    let mx = fx;
    let my = fy;
    if (Math.hypot(fx, fy) < 0.3) {
      let best: any = null;
      let bd = 1e9;
      for (const d of g.pickups.list) {
        const dd = Math.hypot(d.x - p.x, d.y - p.y);
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      if (best) {
        const dd = bd || 1;
        mx += (best.x - p.x) / dd;
        my += (best.y - p.y) / dd;
      }
    }
    const cx = 1000 - p.x;
    const cy = 700 - p.y;
    const cd = Math.hypot(cx, cy);
    if (cd > 350) {
      mx += (cx / cd) * (cd - 350) / 250;
      my += (cy / cd) * (cd - 350) / 250;
    }
    const l = Math.hypot(mx, my);
    return l < 0.05 ? [0, 0] : [mx / l, my / l];
  };

  const shopping = () => {
    for (let i = 0; i < 4; i++) frame();
    const sc: AnyScene = game.scene.getScene('Intermission');
    const r = run();
    let guard = 0;
    while (sc.page === 'level' && guard++ < 30) {
      const u = [...sc.upgrades].sort((a: any, b: any) => upgradeRank(a.stat, r) - upgradeRank(b.stat, r))[0];
      sc.chooseUpgrade(u);
    }
    while (sc.page === 'chest' && guard++ < 60) sc.takeChest();
    let rerolls = 0;
    for (let k = 0; k < (shopOn ? 9 : 0); k++) {
      const cands = r.offers
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => o && r.nectar >= shop.offerPrice(o, r) && (o.kind === 'item' || shop.weaponAddMode(r, o.id, o.tier) !== 'full'))
        .filter(({ o }) => o!.kind === 'weapon' || !hurtsHp(o!.id))
        .filter(({ o }) => offerScore(r, o!.kind, o!.id, o!.tier) >= 0);
      cands.sort((a, b) => offerScore(r, b.o!.kind, b.o!.id, b.o!.tier) - offerScore(r, a.o!.kind, a.o!.id, a.o!.tier));
      if (cands.length) {
        sc.buy(cands[0].i);
        continue;
      }
      if (rerolls < 2 && r.nectar >= shop.rerollCost(r.wave, sc.shopRerolls) + 20) {
        sc.rerollShop();
        rerolls++;
        continue;
      }
      break;
    }
    for (let j = 0; j < r.weapons.length; j++) {
      if (shop.mergePartner(r, j) >= 0) {
        shop.mergeWeapons(r, j);
        j = -1;
      }
    }
    sc.finish();
    for (let i = 0; i < 4; i++) frame();
  };

  const api = {
    /** setup 不传时用：锹甲、晴天、种子弹弓 */
    start(m: Mode = 'smart', setup: Partial<RunSetup> = {}, opts: { shop?: boolean; keep?: number } = {}) {
      mode = m;
      circleT = 0;
      shopOn = opts.shop ?? true;
      keepFixed = opts.keep ?? 0;
      // 模拟出来的胜负和解锁不写进真实存档；跑局时静音
      setSaveSandbox(true);
      sfx.muted = true;
      for (const k of ['Intermission', 'UI', 'Game', 'Result', 'Menu', 'CharacterSelect']) {
        if (game.scene.isActive(k) || game.scene.isPaused(k)) game.scene.stop(k);
      }
      const character = setup.character ?? 'stag';
      game.scene.start('Game', {
        character,
        difficulty: setup.difficulty ?? 0,
        weapon: setup.weapon ?? (CHARACTERS[character].startWeapons.includes('slingshot') ? 'slingshot' : (CHARACTERS[character].startWeapons[0] ?? '')),
      });
      for (let i = 0; i < 10; i++) frame();
      return 'started ' + m;
    },
    /** 往下打 n 波 */
    run(n = 1): WaveLog[] {
      const logs: WaveLog[] = [];
      for (let w = 0; w < n; w++) {
        const r = run();
        if (r.phase !== 'combat') break;
        const g = gs();
        const kills0 = r.kills;
        let minHp = Infinity;
        let maxEnemies = 0;
        for (let i = 0; i < 60 * 300; i++) {
          const ui: AnyScene = game.scene.getScene('UI');
          if (ui.paused) ui.resume();
          const [x, y] = steer();
          touchMove.x = x;
          touchMove.y = y;
          frame();
          if (phase() === 'combat') {
            minHp = Math.min(minHp, r.hp);
            maxEnemies = Math.max(maxEnemies, g.enemies.count);
          }
          if (phase() !== 'combat' && phase() !== 'cleanup') break;
        }
        touchMove.x = touchMove.y = 0;
        const log: WaveLog = { w: r.wave, time: Math.round(g.elapsed), kills: r.kills - kills0, income: r.waveNectar, harvest: r.waveHarvest, minHp: Math.max(0, Math.ceil(minHp)), maxHp: r.maxHp, maxEnemies, level: r.level, phase: phase() };
        logs.push(log);
        if (phase() !== 'intermission') {
          for (let i = 0; i < 120; i++) frame();
          break;
        }
        shopping();
        log.gear = r.weapons.map((x) => x.id + x.tier).join(',') + ` | ${Object.values(r.items).reduce((a, b) => a + b, 0)} 件道具`;
      }
      return logs;
    },
    stop() {
      setSaveSandbox(false);
      sfx.muted = false;
      for (const k of ['Intermission', 'UI', 'Game', 'Result', 'Menu', 'CharacterSelect']) {
        if (game.scene.isActive(k) || game.scene.isPaused(k)) game.scene.stop(k);
      }
      game.scene.start('Menu');
      return 'stopped';
    },
    /** 当前一局的概况 */
    state() {
      const r = run();
      return { wave: r.wave, phase: r.phase, hp: r.hp, level: r.level, weapons: r.weapons, items: r.items, stats: r.stats };
    },
  };
  Object.assign(window, { __bot: api, __game: game, __weapons: WEAPONS });
}
