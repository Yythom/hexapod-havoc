import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
type SoundName = Parameters<typeof sfx.play>[0];
import { DEPTH, FONT_FAMILY, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import { bus, EVT } from '../core/bus';
import { MAX_SCREEN_RANGE } from '../core/combat';
import { RunState } from '../core/RunState';
import { activeSets } from '../core/sets';
import { damageTakenMultiplier, dodgeChance, moveSpeed, pickupRange, regenPerSecond } from '../core/stats';
import { WAVES } from '../data/waves';
import { WEAPONS } from '../data/weapons';
import { Player } from '../entities/Player';
import { coop } from './coop';
import {
  applyGuestBuild,
  extractGuestBuild,
  REVIVE_RADIUS,
  REVIVE_TIME,
  stepReviveProgress,
  type CombatSnapshotPayload,
  type CoopMessage,
  type EnterIntermissionPayload,
  type GuestInputPayload,
  type MatchResultPayload,
  type MatchStartPayload,
  type SnapFxEvent,
  type SnapPlayer,
} from './protocol';
import type { BackyardArena } from '../systems/BackyardArena';
import type { Effects } from '../systems/Effects';
import { MAX_ENEMY_RADIUS, SPAWN_POP, type Enemy, type EnemyManager } from '../systems/EnemyManager';
import type { EnemyShots } from '../systems/EnemyShots';
import type { Hazards } from '../systems/Hazards';
import { HitResolver } from '../systems/HitResolver';
import type { PickupManager } from '../systems/PickupManager';
import type { ProjectileManager } from '../systems/ProjectileManager';
import { Summons } from '../systems/Summons';
import { POISON_DURATION, poisonPerStack, WeaponSystem } from '../systems/WeaponSystem';

export { REVIVE_RADIUS, REVIVE_TIME, stepReviveProgress, extractGuestBuild, applyGuestBuild };
const INVULN_TIME = 0.5;
const TOUCH_PICKUP = 10;
const HEAL_AMOUNT = 3;
const HARVEST_GROWTH = 0.03;
const SNAP_INTERVAL = 0.05; // 20Hz 状态快照

export interface CoopHostDeps {
  scene: Phaser.Scene;
  run1: RunState;
  player1: Player;
  weapons1: WeaponSystem;
  summons1: Summons;
  enemies: EnemyManager;
  projectiles: ProjectileManager;
  shots: EnemyShots;
  hazards: Hazards;
  pickups: PickupManager;
  arena: BackyardArena;
  fx: Effects;
  match: MatchStartPayload;
  onBothDowned: () => void;
  onRemotePause: (paused: boolean) => void;
  onBothReady: () => void;
  onStartEndless: () => void;
  onFinishRun: () => void;
}

/**
 * 双人联机房主控制器：
 * - 在房主侧完整模拟 P2（独立 RunState / Player / WeaponSystem / Summons / HitResolver）
 * - 管理双方倒地与 2.5s 靠近互救
 * - 以 20Hz 向客机发送紧凑世界快照与特效事件
 * - 协调波间同时逛商店与双人准备握手
 */
export class CoopHostController {
  readonly run2: RunState;
  readonly player2: Player;
  readonly resolver2: HitResolver;
  readonly summons2: Summons;
  readonly weapons2: WeaponSystem;

  p1Downed = false;
  p2Downed = false;
  p1Revive = 0;
  p2Revive = 0;

  private guestInput: GuestInputPayload = { seq: 0, ix: 0, iy: 0, dash: false, manualAim: false };
  private guestDashQueued = false;
  private p2Moving = false;
  private p2IdleTime = 0;
  private p2LifestealBudget = 10;
  private p2DashHitSet = new Set<Enemy>();
  private p2DashFlameAcc = 0;
  private p2SelfDamageAcc = 0;
  private p2PotionTime = 0;
  private p2FairyTimer = 0;
  private p2OverhealCd = 0;
  private p2RamCd = 0;

  private readonly overlayG: Phaser.GameObjects.Graphics;
  private readonly p1Tag: Phaser.GameObjects.Text;
  private readonly p2Tag: Phaser.GameObjects.Text;
  private readonly contactBuf: Enemy[] = [];
  private readonly fxQueue: SnapFxEvent[] = [];
  private snapAcc = 0;
  private snapTick = 0;
  private unsubMsg: (() => void) | null = null;
  private unsubState: (() => void) | null = null;

  constructor(private readonly deps: CoopHostDeps) {
    const { scene, match, enemies, projectiles, hazards, fx } = deps;
    this.run2 = new RunState({
      character: match.guest.character,
      difficulty: match.difficulty,
      weapon: match.guest.weapon,
      biome: match.biome,
      seed: `${match.seed}-P2`,
      shellSkin: match.guest.shellSkin,
    });
    this.player2 = new Player(scene, WORLD_WIDTH / 2 + 72, WORLD_HEIGHT / 2, this.run2.character.shell, match.guest.shellSkin);
    this.resolver2 = new HitResolver(enemies, fx);
    this.summons2 = new Summons(scene, fx, this.resolver2);
    this.weapons2 = new WeaponSystem(this.player2, projectiles, enemies, hazards, this.summons2, this.resolver2, fx);

    this.resolver2.host = {
      get mods() {
        return deps.run1.phase === 'combat' ? self.run2.mods : self.run2.mods;
      },
      get hpRatio() {
        return self.run2.hp / Math.max(1, self.run2.maxHp);
      },
      heal: (n, fxX, fxY, kind) => this.healP2(n, kind ?? 'other', fxX, fxY),
      dropBonusNectar: (x, y, n) => deps.pickups.dropNectar(x, y, n),
      onWeaponKill: (def) => {
        if (def.kind === 'melee') this.run2.meleeKills++;
        this.run2.kills++;
        this.run2.waveKills++;
      },
      onFireHit: (x, y, dps) => deps.arena.igniteAt(x, y, dps),
    };
    const self = this;
    this.weapons2.onLightningHit = (x, y, dmg) => deps.arena.conductLightning(x, y, dmg, enemies);

    this.overlayG = scene.add.graphics().setDepth(DEPTH.player - 1);
    const tagStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      fontStyle: 'bold',
      stroke: '#050507',
      strokeThickness: 3,
    };
    this.p1Tag = scene.add.text(0, 0, 'P1', { ...tagStyle, color: '#ffd44c' }).setOrigin(0.5).setDepth(DEPTH.player + 4);
    this.p2Tag = scene.add.text(0, 0, 'P2', { ...tagStyle, color: '#7ceeff' }).setOrigin(0.5).setDepth(DEPTH.player + 4);

    this.unsubMsg = coop.onMessage((msg) => this.handleMessage(msg));
    this.unsubState = coop.onState((st) => {
      if (st === 'disconnected') {
        bus.emit(EVT.WAVE_EVENT, '⚠ 队友已断开连接', '#ff6a5e');
      }
    });
  }

  destroy(): void {
    this.unsubMsg?.();
    this.unsubState?.();
    this.unsubMsg = null;
    this.unsubState = null;
    this.overlayG.destroy();
    this.p1Tag.destroy();
    this.p2Tag.destroy();
    this.player2.view.destroy();
    this.summons2.clear();
    this.weapons2.clearDevices();
  }

  pushFx(ev: SnapFxEvent): void {
    if (this.fxQueue.length < 48) this.fxQueue.push(ev);
  }

  pushSfx(name: SoundName): void {
    this.pushFx({ t: 'sfx', name });
  }

  /** 返回离 (x, y) 最近的存活玩家：1 表示房主，2 表示客机 */
  nearestLivingTarget(x: number, y: number): 1 | 2 {
    if (this.p1Downed && !this.p2Downed) return 2;
    if (this.p2Downed && !this.p1Downed) return 1;
    const p1 = this.deps.player1;
    const p2 = this.player2;
    const d1 = (p1.x - x) ** 2 + (p1.y - y) ** 2;
    const d2 = (p2.x - x) ** 2 + (p2.y - y) ** 2;
    return d2 < d1 ? 2 : 1;
  }

  startWave(n: number): void {
    const r2 = this.run2;
    r2.wave = n;
    r2.endless = this.deps.run1.endless;
    r2.phase = 'combat';
    r2.resetIntermissionState();
    r2.waveDamagePenalty = 0;
    r2.waveContractDamagePct = 0;
    r2.waveNoHeal = false;
    r2.waveNectarMult = 1;
    const contract = r2.activeContract;
    const peacock = r2.nextWavePeacock;
    r2.nextWavePeacock = 0;
    r2.waveXpMult = (1 + peacock) * (contract === 'swarm_harvest' ? 1.55 : 1);
    r2.waveEnemyDamageMult = (1 + peacock * 0.5) * (contract === 'glass_frenzy' ? 1.35 : 1);
    if (contract === 'no_heal_vow') r2.waveNoHeal = true;
    if (contract === 'swarm_harvest') r2.waveNectarMult = 1.55;
    if (contract === 'glass_frenzy') r2.waveContractDamagePct = 0.4;

    if (r2.itemCount('treering') > 0) r2.bonus.maxHp += 2;
    const bloom = r2.character.perks.lateBloom;
    if (bloom && n > bloom.waves) {
      r2.bonus.maxHp += bloom.maxHp;
      r2.bonus.damagePct += bloom.damagePct;
    }
    r2.recomputeStats();
    const oneHp = r2.nextWaveOneHp;
    r2.nextWaveOneHp = false;
    r2.hp = oneHp ? 1 : r2.maxHp;
    if (n > 1 && n <= WAVES.length && r2.itemCount('piggybank') > 0 && r2.nectar > 0) {
      const piggy = Math.floor(r2.nectar * 0.2);
      if (piggy > 0) {
        r2.nectar += piggy;
        r2.totalNectar += piggy;
      }
    }
    r2.nextWaveBait = 0;
    r2.shield = r2.itemCount('horncharm') > 0 ? 1 : 0;
    r2.waveNectar = 0;
    r2.waveKills = 0;
    r2.waveHarvest = 0;
    r2.waveInterest = 0;
    for (const w of r2.weapons) {
      w.ramp = 0;
      w.waveDamage = 0;
    }

    // 双方满血复活并稍微错开站位
    this.p1Downed = false;
    this.p2Downed = false;
    this.p1Revive = 0;
    this.p2Revive = 0;
    this.deps.player1.view.setPosition(WORLD_WIDTH / 2 - 48, WORLD_HEIGHT / 2).setVisible(true).setAlpha(1);
    this.player2.view.setPosition(WORLD_WIDTH / 2 + 48, WORLD_HEIGHT / 2).setVisible(true).setAlpha(1);
    this.player2.invuln = 0;
    this.player2.slowTime = 0;
    this.player2.hasteTime = 0;
    this.player2.frenzyTime = 0;
    this.player2.mantisCritTime = 0;
    this.player2.dashTime = 0;
    this.player2.dashCd = 0;
    this.player2.resetMotion();
    this.player2.syncDashConfig(r2.maxDashCharges, r2.stats.speedPct, r2.mods.dashCooldownPct);
    this.player2.dashCharges = this.player2.maxDashCharges;
    this.p2IdleTime = 0;
    this.p2SelfDamageAcc = 0;
    this.p2PotionTime = 0;
    this.p2FairyTimer = 0;
    this.p2OverhealCd = 0;
    this.p2RamCd = 0;
    this.p2LifestealBudget = r2.character.perks.lifestealOnly ? 13 : 10;
    this.weapons2.sync(r2.weapons, r2.weaponSlots);
    this.summons2.clear();
    this.weapons2.clearDevices();
    this.fxQueue.length = 0;

    if (n > 1) {
      coop.resetWaveReady();
      coop.send({ type: 'start_wave', wave: n, endless: this.deps.run1.endless });
    }
    this.syncHudState();
  }

  /** 每帧更新 P2 模拟、互救机制与 20Hz 快照推送 */
  update(dt: number, windX: number, windY: number, p1Moving: boolean): void {
    const { run1, player1, arena } = this.deps;
    const r2 = this.run2;
    const p2 = this.player2;
    const stats2 = r2.stats;

    // 1. P2 移动与冲刺
    if (!this.p2Downed && (run1.phase === 'combat' || run1.phase === 'cleanup')) {
      const inp = this.guestInput;
      const ix = Phaser.Math.Clamp(inp.ix, -1, 1);
      const iy = Phaser.Math.Clamp(inp.iy, -1, 1);
      this.p2Moving = Math.hypot(ix, iy) > 0.1;
      this.p2IdleTime = Math.hypot(ix, iy) > 0.05 ? 0 : this.p2IdleTime + dt;
      this.p2RamCd = Math.max(0, this.p2RamCd - dt);
      this.p2OverhealCd = Math.max(0, this.p2OverhealCd - dt);

      if (this.guestDashQueued && run1.phase === 'combat') {
        this.guestDashQueued = false;
        this.performDashP2(ix, iy);
      }

      p2.syncDashConfig(r2.maxDashCharges, stats2.speedPct, r2.mods.dashCooldownPct);
      const dashEnded = p2.update(
        dt,
        ix,
        iy,
        moveSpeed(stats2),
        r2.shield > 0,
        windX,
        windY,
        !!run1.biome.slippery,
        arena.obstacles,
      );
      if (p2.dashTime > 0 && run1.phase === 'combat') this.updateDashActiveP2(dt);
      if (dashEnded && run1.phase === 'combat') this.onDashEndP2();
    } else {
      this.p2Moving = false;
      this.guestDashQueued = false;
      p2.view.setAlpha(this.p2Downed ? 0.48 : 1);
    }

    // 2. 战斗阶段：P2 武器、回复、接触伤害、道具计时
    if (run1.phase === 'combat' && !this.p2Downed) {
      const lsCap = r2.character.perks.lifestealOnly ? 13 : 10;
      this.p2LifestealBudget = Math.min(lsCap, this.p2LifestealBudget + lsCap * dt);
      const missingTenths = Math.floor(Math.max(0, 1 - r2.hp / r2.maxHp) * 10);
      const frenzyAspd = p2.frenzyTime > 0 ? 0.25 : 0;
      const combatStats =
        (r2.mods.bloodRage > 0 && missingTenths > 0) || frenzyAspd > 0
          ? {
              ...stats2,
              damagePct: stats2.damagePct + (r2.mods.bloodRage > 0 ? missingTenths * 0.08 * r2.mods.bloodRage : 0),
              attackSpeedPct: stats2.attackSpeedPct + (r2.mods.bloodRage > 0 ? missingTenths * 0.06 * r2.mods.bloodRage : 0) + frenzyAspd,
            }
          : stats2;
      const idle = r2.character.perks.idlePenalty;
      const dmgMult = idle && this.p2IdleTime > idle.delay ? idle.mult : 1;
      const aimPoint =
        this.guestInput.manualAim && this.guestInput.aimX !== undefined && this.guestInput.aimY !== undefined
          ? { x: this.guestInput.aimX, y: this.guestInput.aimY }
          : null;
      this.weapons2.update(dt, {
        stats: combatStats,
        mods: r2.mods,
        damageMult: dmgMult,
        hpRatio: r2.hp / Math.max(1, r2.maxHp),
        emptySlots: Math.max(0, r2.weaponSlots - r2.weapons.length),
        moving: this.p2Moving,
        workers: r2.workerCount,
        workerTier: r2.workerTier,
        workerHp: Math.round((12 + 4 * (run1.wave - 1)) * (1 + Math.max(0, stats2.armor) * 0.04)),
        aimPoint,
        mantisCrit: p2.mantisCritTime > 0,
      });

      const selfDps = r2.weapons.reduce((a, w) => a + (WEAPONS[w.id]?.special?.selfDamagePerSec ?? 0), 0) + r2.mods.selfDamagePerSec;
      if (selfDps > 0) {
        this.p2SelfDamageAcc += selfDps * dt;
        const n = Math.floor(this.p2SelfDamageAcc);
        if (n > 0) {
          this.p2SelfDamageAcc -= n;
          r2.hp = Math.max(1, r2.hp - n);
        }
      }

      if (!r2.waveNoHeal) {
        if (r2.mods.torture > 0) r2.hp = Math.min(r2.maxHp, r2.hp + 5 * dt);
        else r2.hp = Math.min(r2.maxHp, r2.hp + regenPerSecond(stats2) * (1 + r2.mods.healingPct) * dt);
      }

      this.checkContactP2();
      this.updateItemTimersP2(dt);
    }

    // 3. 倒地互救逻辑
    if (run1.phase === 'combat') {
      this.updateRevive(dt);
    }

    // 4. 绘制脚底角色光环、P1/P2 标识与救援圆环
    this.drawCoopOverlays(player1, p2);
    this.syncHudState();

    // 5. 20Hz 快照推送
    this.snapAcc += dt;
    if (this.snapAcc >= SNAP_INTERVAL) {
      this.snapAcc %= SNAP_INTERVAL;
      this.sendSnapshot(p1Moving);
    }
  }

  /** P1 生命归零时尝试转入倒地状态；若 P2 也已倒地或没血则返回 false（全灭） */
  onPlayer1Fatal(): boolean {
    if (this.p2Downed || this.run2.hp <= 0) {
      this.p1Downed = true;
      this.p2Downed = true;
      this.deps.run1.hp = 0;
      this.run2.hp = 0;
      return false;
    }
    if (!this.p1Downed) {
      this.p1Downed = true;
      this.p1Revive = 0;
      this.deps.run1.hp = 0;
      this.deps.player1.dashTime = 0;
      this.deps.player1.resetMotion();
      this.deps.player1.view.setAlpha(0.48);
      this.deps.fx.ring(this.deps.player1.x, this.deps.player1.y, REVIVE_RADIUS, 0xff5d57);
      this.pushFx({ t: 'ring', x: Math.round(this.deps.player1.x), y: Math.round(this.deps.player1.y), r: REVIVE_RADIUS, col: 0xff5d57 });
      this.pushFx({ t: 'banner', text: '⚠ P1 倒地！快靠近光圈救起队友', col: '#ff7a72' });
      bus.emit(EVT.WAVE_EVENT, '⚠ 你已倒地！等待 P2 队友救援', '#ff7a72');
      sfx.play('hurt');
      this.pushSfx('hurt');
      this.syncHudState();
      this.sendSnapshot(false);
    }
    return true;
  }

  /** 双方全灭时清理 P2 战场对象并立刻推送死亡状态快照，避免客机在 1.6s 过渡期间卡住 */
  onBothDownedSync(): void {
    this.p1Downed = true;
    this.p2Downed = true;
    this.deps.run1.hp = 0;
    this.run2.hp = 0;
    this.summons2.clear();
    this.weapons2.clearDevices();
    this.player2.view.setVisible(false);
    this.drawCoopOverlays(this.deps.player1, this.player2);
    this.syncHudState();
    this.pushSfx('death');
    this.sendSnapshot(false);
  }

  /** 死亡过渡期间继续向客机推送快照，防止客机画面定格 */
  tickDeadSnapshot(dt: number): void {
    this.snapAcc += dt;
    if (this.snapAcc >= SNAP_INTERVAL) {
      this.snapAcc %= SNAP_INTERVAL;
      this.syncHudState();
      this.sendSnapshot(false);
    }
  }

  /** 对 P2 造成伤害 */
  damagePlayer2(raw: number): boolean {
    const r2 = this.run2;
    const p2 = this.player2;
    if (this.deps.run1.phase !== 'combat' || this.p2Downed || p2.invuln > 0) return false;
    p2.invuln = INVULN_TIME;
    this.weapons2.resetRamps();
    if (Math.random() < dodgeChance(r2.stats)) {
      this.deps.fx.number(p2.x, p2.y - 28, '闪避', 'dodge');
      this.pushFx({ t: 'num', x: Math.round(p2.x), y: Math.round(p2.y - 28), v: '闪避', kind: 'dodge' });
      this.pushSfx('dodge');
      return false;
    }
    if (r2.shield > 0) {
      r2.shield--;
      this.deps.fx.ring(p2.x, p2.y, 40, 0x9fd8ff);
      this.pushFx({ t: 'ring', x: Math.round(p2.x), y: Math.round(p2.y), r: 40, col: 0x9fd8ff });
      this.pushSfx('shield');
      return false;
    }
    const dmg = Math.max(1, Math.round(raw * r2.waveEnemyDamageMult * damageTakenMultiplier(r2.stats.armor)));
    r2.hp -= dmg;
    if (r2.mods.trianglePenalty > 0) {
      r2.waveDamagePenalty += 0.02 * r2.mods.trianglePenalty;
      r2.recomputeStats();
    }
    this.deps.fx.number(p2.x, p2.y - 28, dmg, 'player');
    this.pushFx({ t: 'num', x: Math.round(p2.x), y: Math.round(p2.y - 28), v: dmg, kind: 'player' });
    this.pushSfx('hurt');
    if (r2.itemCount('feather') > 0) p2.hasteTime = 1;
    if (r2.character.perks.hurtCloud) {
      const back = p2.view.rotation + Math.PI;
      this.deps.hazards.addCloud(
        p2.x + Math.cos(back) * 34,
        p2.y + Math.sin(back) * 34,
        70,
        2.5,
        2 + r2.stats.toxin,
        poisonPerStack(r2.stats, r2.mods),
        POISON_DURATION + r2.mods.poisonDuration,
      );
    }
    if (r2.hp <= 0) {
      r2.hp = 0;
      p2.dashTime = 0;
      p2.resetMotion();
      if (this.p1Downed || this.deps.run1.hp <= 0) {
        this.p1Downed = true;
        this.p2Downed = true;
        this.deps.run1.hp = 0;
        this.deps.onBothDowned();
      } else {
        this.p2Downed = true;
        this.p2Revive = 0;
        p2.view.setAlpha(0.48);
        this.deps.fx.ring(p2.x, p2.y, REVIVE_RADIUS, 0xff5d57);
        this.pushFx({ t: 'ring', x: Math.round(p2.x), y: Math.round(p2.y), r: REVIVE_RADIUS, col: 0xff5d57 });
        this.pushFx({ t: 'banner', text: '⚠ 你已倒地！等待 P1 队友救援', col: '#ff7a72' });
        bus.emit(EVT.WAVE_EVENT, '⚠ P2 队友倒地！靠近红圈 2.5 秒救起', '#ff7a72');
        this.syncHudState();
        this.sendSnapshot(false);
      }
    }
    return true;
  }

  /** P2 拾取花蜜/宝箱/回血/狂热 */
  addNectarP2(n: number): void {
    const r2 = this.run2;
    this.weapons2.resetPickupCooldowns();
    r2.nectar += n;
    r2.waveNectar += n;
    r2.totalNectar += n;
    const xpGain = n * 0.65 * (1 + r2.mods.xpGainPct) * r2.waveXpMult;
    if (r2.addXp(xpGain) > 0) {
      this.deps.fx.number(this.player2.x, this.player2.y - 44, '升级！', 'level');
      this.pushFx({ t: 'num', x: Math.round(this.player2.x), y: Math.round(this.player2.y - 44), v: '升级！', kind: 'level' });
      this.pushSfx('levelUp');
    }
  }

  addChestsP2(n: number): void {
    this.run2.chests += n;
    this.deps.fx.number(this.player2.x, this.player2.y - 44, '宝箱！', 'level');
    this.pushFx({ t: 'num', x: Math.round(this.player2.x), y: Math.round(this.player2.y - 44), v: '宝箱！', kind: 'level' });
    this.pushSfx('chest');
  }

  healP2(n: number, kind: 'lifesteal' | 'other' = 'other', fromX?: number, fromY?: number): void {
    const r2 = this.run2;
    if (this.p2Downed || r2.mods.torture > 0 || r2.waveNoHeal) return;
    if (kind === 'other' && r2.character.perks.lifestealOnly) return;
    let effectiveN = n;
    if (kind === 'lifesteal') {
      if (this.p2LifestealBudget < 1) return;
      effectiveN = Math.min(n, Math.floor(this.p2LifestealBudget));
      this.p2LifestealBudget -= effectiveN;
    }
    const before = r2.hp;
    r2.hp = Math.min(r2.maxHp, r2.hp + effectiveN * (1 + r2.mods.healingPct));
    const gained = r2.hp - before;
    if (gained > 0) {
      if (fromX !== undefined && fromY !== undefined) {
        this.deps.fx.tether(fromX, fromY, () => this.player2, kind === 'lifesteal' ? 0xff4d6d : 0x5cff8a);
      }
      this.pushFx({ t: 'num', x: Math.round(this.player2.x), y: Math.round(this.player2.y - 28), v: `+${Math.max(1, Math.round(gained))}`, kind: 'heal' });
      if (n >= 2) this.pushSfx('heal');
    }
  }

  giveFrenzyP2(sec = 4): void {
    this.player2.frenzyTime = Math.max(this.player2.frenzyTime, sec);
    this.deps.fx.ring(this.player2.x, this.player2.y, 44, 0xffd44c);
    this.pushFx({ t: 'ring', x: Math.round(this.player2.x), y: Math.round(this.player2.y), r: 44, col: 0xffd44c });
    this.pushSfx('frenzy');
  }

  getP2PickupRange(): number {
    return this.run2.character.perks.touchPickup ? this.player2.radius + TOUCH_PICKUP : pickupRange(this.run2.stats);
  }

  onWaveEndCleanup(): void {
    this.summons2.clear();
    this.weapons2.clearDevices();
    this.pushSfx('waveClear');
    this.pushFx({ t: 'banner', text: '撑过去了！', col: '#ffd44c' });
    this.sendSnapshot(false);
  }

  /** 波次彻底结算，结算 P2 采蜜/利息/赌约并通知客机进入波间界面 */
  onWaveEnterIntermission(extraNectarForP2: number, extraChestsForP2: number): void {
    const r2 = this.run2;
    if (extraNectarForP2 > 0) this.addNectarP2(extraNectarForP2);
    if (extraChestsForP2 > 0) r2.chests += extraChestsForP2;

    const doneContract = r2.activeContract;
    r2.activeContract = null;
    r2.waveContractDamagePct = 0;
    r2.waveNoHeal = false;
    r2.waveNectarMult = 1;
    if (doneContract === 'elite_bounty') {
      r2.chests += 1;
      r2.nectar += 45;
      r2.totalNectar += 45;
    } else if (doneContract === 'no_heal_vow') {
      r2.bonus.maxHp += 10;
      r2.bonus.armor += 3;
      r2.recomputeStats();
    } else if (doneContract === 'swarm_harvest') {
      r2.bonus.harvest += 10;
      r2.recomputeStats();
    } else if (doneContract === 'glass_frenzy') {
      r2.chests += 1;
    }

    const harvest = Math.max(0, Math.round(r2.stats.harvest));
    r2.waveHarvest = harvest;
    if (harvest > 0) this.addNectarP2(harvest);
    if (r2.endless) {
      if (r2.stats.harvest > 0) {
        r2.bonus.harvest -= Math.ceil(r2.stats.harvest * 0.2);
        r2.recomputeStats();
      }
    } else if (r2.stats.harvest > 0 || r2.mods.waveHarvest > 0) {
      r2.bonus.harvest += Math.max(0, r2.stats.harvest) * HARVEST_GROWTH + r2.mods.waveHarvest;
      r2.recomputeStats();
    }

    let interest = 0;
    if (r2.itemCount('treehole') > 0) interest += Math.min(10, Math.floor(r2.nectar / 20));
    const perk = r2.character.perks.interest;
    if (perk) interest += Math.min(perk.max, Math.floor(r2.nectar / perk.per));
    r2.waveInterest = interest;
    r2.nectar += interest;

    r2.phase = 'intermission';
    coop.resetWaveReady();

    const payload: EnterIntermissionPayload = {
      wave: this.deps.run1.wave,
      endless: this.deps.run1.endless,
      won: this.deps.run1.won,
      nectar: r2.nectar,
      totalNectar: r2.totalNectar,
      waveNectar: r2.waveNectar,
      waveKills: r2.waveKills,
      waveHarvest: r2.waveHarvest,
      waveInterest: r2.waveInterest,
      kills: r2.kills,
      level: r2.level,
      xp: r2.xp,
      pendingLevelUps: r2.pendingLevelUps,
      chests: r2.chests,
      bonus: { ...r2.bonus },
      weapons: r2.weapons.map((w) => ({ ...w })),
    };
    coop.send({ type: 'enter_intermission', data: payload });
  }

  notifyVictoryChoice(): void {
    coop.send({ type: 'victory_choice' });
  }

  sendMatchResult(win: boolean): MatchResultPayload {
    const r1 = this.deps.run1;
    const r2 = this.run2;
    const payload: MatchResultPayload = {
      win,
      endless: r1.endless,
      wave: r1.wave,
      difficulty: r1.setup.difficulty,
      biome: r1.biome.id,
      seed: r1.seed,
      maxWaves: r1.maxWaves,
      host: {
        character: r1.setup.character,
        weapon: r1.setup.weapon,
        level: r1.level,
        kills: r1.kills,
        nectar: r1.totalNectar,
        weapons: r1.weapons.map((w) => ({ id: w.id, tier: w.tier, totalDamage: w.totalDamage ?? 0 })),
        sets: activeSets(r1.weapons).map((s) => ({ cls: s.cls, count: s.count })),
      },
      guest: {
        character: r2.setup.character,
        weapon: r2.setup.weapon,
        level: r2.level,
        kills: r2.kills,
        nectar: r2.totalNectar,
        weapons: r2.weapons.map((w) => ({ id: w.id, tier: w.tier, totalDamage: w.totalDamage ?? 0 })),
        sets: activeSets(r2.weapons).map((s) => ({ cls: s.cls, count: s.count })),
      },
    };
    coop.send({ type: 'match_result', data: payload });
    return payload;
  }

  private handleMessage(msg: CoopMessage): void {
    if (msg.type === 'input') {
      this.guestInput = msg.data;
      if (msg.data.dash) this.guestDashQueued = true;
    } else if (msg.type === 'pause_state') {
      this.deps.onRemotePause(msg.paused);
    } else if (msg.type === 'guest_ready') {
      coop.guestReady = msg.ready;
      if (msg.build) applyGuestBuild(this.run2, msg.build);
      if (coop.hostReady && coop.guestReady && this.deps.run1.phase === 'intermission') {
        this.deps.onBothReady();
      }
    } else if (msg.type === 'continue_endless') {
      this.deps.onStartEndless();
    } else if (msg.type === 'finish_run') {
      this.deps.onFinishRun();
    }
  }

  private updateRevive(dt: number): void {
    const p1 = this.deps.player1;
    const p2 = this.player2;
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

    if (this.p1Downed && !this.p2Downed) {
      this.p1Revive = stepReviveProgress(this.p1Revive, dist <= REVIVE_RADIUS, dt);
      if (this.p1Revive >= 1) {
        this.p1Downed = false;
        this.p1Revive = 0;
        this.deps.run1.hp = Math.max(1, Math.round(this.deps.run1.maxHp * 0.4));
        p1.invuln = 1.5;
        p1.view.setAlpha(1);
        this.reviveShockwave(p1.x, p1.y);
        bus.emit(EVT.WAVE_EVENT, '❤ P2 队友把你救起来了！', '#74ea78');
        this.pushFx({ t: 'banner', text: '❤ 成功救起 P1 队友！', col: '#74ea78' });
      }
    } else if (this.p2Downed && !this.p1Downed) {
      this.p2Revive = stepReviveProgress(this.p2Revive, dist <= REVIVE_RADIUS, dt);
      if (this.p2Revive >= 1) {
        this.p2Downed = false;
        this.p2Revive = 0;
        this.run2.hp = Math.max(1, Math.round(this.run2.maxHp * 0.4));
        p2.invuln = 1.5;
        p2.view.setAlpha(1);
        this.reviveShockwave(p2.x, p2.y);
        bus.emit(EVT.WAVE_EVENT, '❤ 成功救起 P2 队友！', '#74ea78');
        this.pushFx({ t: 'banner', text: '❤ P1 队友把你救起来了！', col: '#74ea78' });
      }
    }
  }

  private reviveShockwave(x: number, y: number): void {
    const r = 160;
    this.deps.fx.ring(x, y, r, 0x74ea78);
    this.pushFx({ t: 'ring', x: Math.round(x), y: Math.round(y), r, col: 0x74ea78 });
    sfx.play('heal');
    this.pushSfx('heal');
    for (const e of this.deps.enemies.grid.query(x, y, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
      if (!e.active || e.def.behavior === 'tree') continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= r + e.radius) {
        this.deps.enemies.hit(e, 10, false, dx / d, dy / d, 420);
      }
    }
  }

  private checkContactP2(): void {
    const p = this.player2;
    const r2 = this.run2;
    let dmg = 0;
    const touching: Enemy[] = [];
    for (const e of this.deps.enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS, this.contactBuf)) {
      if (!e.active || e.age < SPAWN_POP || e.frozen > 0 || e.damage <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = p.radius + e.radius;
      if (dx * dx + dy * dy < rr * rr) {
        if (e.damage > dmg) dmg = e.damage;
        touching.push(e);
      }
    }
    if (touching.length > 0 && r2.mods.ramDamage > 0 && this.p2Moving && this.p2RamCd <= 0) {
      this.p2RamCd = 0.35;
      const rdmg = Math.max(4, Math.round((8 + Math.max(0, r2.stats.armor) * 2.5) * (1 + r2.stats.damagePct)));
      for (const e of touching.slice()) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        this.deps.enemies.hit(e, rdmg, false, (e.x - p.x) / d, (e.y - p.y) / d, 260);
      }
    }
    if (dmg <= 0) return;
    this.damagePlayer2(dmg);
    const thorns = r2.character.perks.thorns;
    if (thorns) {
      const back = Math.max(1, Math.round((thorns.base + Math.max(0, r2.stats.armor)) * (1 + r2.stats.damagePct)));
      for (const e of touching.slice()) {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        this.deps.enemies.hit(e, back, false, (e.x - p.x) / d, (e.y - p.y) / d, 240);
      }
    }
  }

  private updateItemTimersP2(dt: number): void {
    const r2 = this.run2;
    const potion = r2.itemCount('honeypotion');
    if (potion > 0 && r2.mods.torture === 0 && !r2.waveNoHeal && this.p2PotionTime < 10 && r2.hp < r2.maxHp * 0.3 && !r2.character.perks.lifestealOnly) {
      this.p2PotionTime += dt;
      r2.hp = Math.min(r2.maxHp, r2.hp + 2 * potion * (1 + r2.mods.healingPct) * dt);
    }
    if (r2.itemCount('fairyring') > 0) {
      this.p2FairyTimer += dt;
      if (this.p2FairyTimer >= 10) {
        this.p2FairyTimer -= 10;
        const a = Math.random() * Math.PI * 2;
        this.deps.pickups.dropHeal(this.player2.x + Math.cos(a) * 50, this.player2.y + Math.sin(a) * 50, 'mushroom');
      }
    }
  }

  private performDashP2(ix: number, iy: number): void {
    const r2 = this.run2;
    const p = this.player2;
    if (!p.tryDash(ix, iy, r2.stats.speedPct, r2.mods.dashCooldownPct, r2.maxDashCharges)) return;
    this.p2DashHitSet.clear();
    this.p2DashFlameAcc = 0;
    this.deps.fx.ring(p.x, p.y, 26, 0x7ceeff);
    this.pushFx({ t: 'ring', x: Math.round(p.x), y: Math.round(p.y), r: 26, col: 0x7ceeff });
    this.pushSfx('dash');

    const cid = r2.character.id;
    const stats = r2.stats;
    if (cid === 'bombardier') {
      this.deps.hazards.addCloud(p.x, p.y, 72, 2.8, 3 + stats.toxin, poisonPerStack(stats, r2.mods), POISON_DURATION + r2.mods.poisonDuration);
    } else if (cid === 'ladybug') {
      this.deps.pickups.pullNectarInRadius(p.x, p.y, 290);
      this.deps.fx.ring(p.x, p.y, 120, 0xffd44c);
    } else if (cid === 'spider') {
      this.deps.hazards.addWeb(p.x, p.y, 72, 3.8, Math.max(2, 3 + stats.toxin * 0.5), 0.45, 4);
    } else if (cid === 'cicada') {
      this.deps.arena.addDecoy(p.x, p.y, Math.max(18, Math.round((24 + r2.wave * 6) * (1 + stats.damagePct))));
    } else if (cid === 'termite') {
      this.weapons2.placeFreeMine(p.x, p.y);
    }
  }

  private updateDashActiveP2(dt: number): void {
    const p = this.player2;
    const r2 = this.run2;
    const stats = r2.stats;
    if (r2.mods.dashFlame > 0) {
      this.p2DashFlameAcc += dt;
      if (this.p2DashFlameAcc >= 0.065) {
        this.p2DashFlameAcc = 0;
        this.deps.arena.addFlamePatch(p.x, p.y, Math.max(6, (8 + stats.elemental * 1.5) * (1 + stats.damagePct)));
      }
    }
    const cid = r2.character.id;
    if (cid !== 'rhino' && cid !== 'mosquito') return;
    for (const e of this.deps.enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS + 18, this.contactBuf).slice()) {
      if (!e.active || e.def.behavior === 'tree' || this.p2DashHitSet.has(e)) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > (p.radius + e.radius + 14) ** 2) continue;
      this.p2DashHitSet.add(e);
      const d = Math.hypot(dx, dy) || 1;
      if (cid === 'rhino') {
        const dmg = Math.max(10, Math.round((14 + Math.max(0, stats.armor) * 2.5 + stats.melee) * (1 + stats.damagePct)));
        this.deps.enemies.hit(e, dmg, false, dx / d, dy / d, 360);
      } else {
        const dmg = Math.max(6, Math.round((8 + r2.wave * 2.5) * (1 + stats.damagePct)));
        this.deps.enemies.hit(e, dmg, false, dx / d, dy / d, 90);
        this.healP2(1, 'lifesteal', e.x, e.y);
      }
    }
  }

  private onDashEndP2(): void {
    const p = this.player2;
    const r2 = this.run2;
    const cid = r2.character.id;
    if (cid === 'mantis') p.mantisCritTime = 1.5;
    else if (cid === 'tiger') p.hasteTime = Math.max(p.hasteTime, 0.9);
    else if (cid === 'stag') {
      const fxX = p.x + p.dashDirX * 36;
      const fxY = p.y + p.dashDirY * 36;
      const r = 92;
      const dmg = Math.max(8, Math.round((14 + r2.stats.melee * 1.4) * (1 + r2.stats.damagePct)));
      this.deps.fx.ring(fxX, fxY, r, 0x7ceeff);
      for (const e of this.deps.enemies.grid.query(fxX, fxY, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
        if (!e.active || e.def.behavior === 'tree') continue;
        const dx = e.x - fxX;
        const dy = e.y - fxY;
        if (dx * dx + dy * dy > (r + e.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.deps.enemies.hit(e, dmg, false, dx / d, dy / d, 240);
      }
    }
  }

  private drawCoopOverlays(p1: Player, p2: Player): void {
    const g = this.overlayG;
    g.clear();
    // P1 脚底金环，P2 脚底青环
    g.lineStyle(2.2, this.p1Downed ? 0xff5d57 : 0xffd44c, this.p1Downed ? 0.9 : 0.52);
    g.strokeCircle(p1.x, p1.y + 4, 22);
    g.lineStyle(2.2, this.p2Downed ? 0xff5d57 : 0x5cd8ff, this.p2Downed ? 0.9 : 0.6);
    g.strokeCircle(p2.x, p2.y + 4, 22);

    // 倒地救援圈 + 进度弧
    const drawReviveRing = (x: number, y: number, pct: number) => {
      g.fillStyle(0xff4a42, 0.14);
      g.fillCircle(x, y, REVIVE_RADIUS);
      g.lineStyle(2.5, 0xff6a62, 0.85);
      g.strokeCircle(x, y, REVIVE_RADIUS);
      if (pct > 0.01) {
        g.lineStyle(5, 0x74ea78, 0.96);
        g.beginPath();
        g.arc(x, y, REVIVE_RADIUS - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct, false);
        g.strokePath();
      }
    };
    if (this.p1Downed) drawReviveRing(p1.x, p1.y, this.p1Revive);
    if (this.p2Downed) drawReviveRing(p2.x, p2.y, this.p2Revive);

    this.p1Tag.setPosition(p1.x, p1.y - 26).setText(this.p1Downed ? 'P1 倒地' : 'P1');
    this.p2Tag.setPosition(p2.x, p2.y - 26).setText(this.p2Downed ? 'P2 倒地' : 'P2');
  }

  private syncHudState(): void {
    const r1 = this.deps.run1;
    const r2 = this.run2;
    if (this.p1Downed) r1.hp = 0;
    if (this.p2Downed) r2.hp = 0;
    r1.coopDowned = this.p1Downed;
    r1.coopRevivePct = this.p1Revive;
    r1.coopTeammate = {
      name: `P2 · ${r2.character.name}`,
      hp: this.p2Downed ? 0 : Math.max(0, Math.ceil(r2.hp)),
      maxHp: r2.maxHp,
      level: r2.level,
      downed: this.p2Downed,
      revivePct: this.p2Revive,
      x: this.player2.x,
      y: this.player2.y,
    };
  }

  private packPlayer(run: RunState, p: Player, weapons: WeaponSystem, downed: boolean, revivePct: number, moving: boolean): SnapPlayer {
    const dashRatio =
      p.dashCharges >= p.maxDashCharges
        ? 1
        : p.dashCd > 0
          ? Math.max(0, 1 - p.dashCd / Math.max(0.1, p.dashCdMax))
          : 1;
    return {
      x: Math.round(p.x),
      y: Math.round(p.y),
      rot: Math.round(p.view.rotation * 100) / 100,
      hp: downed ? 0 : Math.max(0, Math.ceil(run.hp)),
      maxHp: run.maxHp,
      shield: run.shield,
      downed,
      revivePct: Math.round(revivePct * 100) / 100,
      dashTime: Math.round(p.dashTime * 100) / 100,
      dashRatio: Math.round(dashRatio * 100) / 100,
      dashCharges: p.dashCharges,
      maxDashCharges: p.maxDashCharges,
      frenzyTime: Math.round(p.frenzyTime * 10) / 10,
      invuln: Math.round(p.invuln * 100) / 100,
      nectar: run.nectar,
      totalNectar: run.totalNectar,
      level: run.level,
      xp: Math.round(run.xp),
      xpNeeded: run.xpNeeded,
      pendingLevelUps: run.pendingLevelUps,
      chests: run.chests,
      kills: run.kills,
      moving,
      weaponSlots: run.weaponSlots,
      weapons: run.weapons.map((w) => ({ id: w.id, tier: w.tier, cursed: w.cursed, enchant: w.enchant })),
      aims: weapons.slotAims(),
    };
  }

  private sendSnapshot(p1Moving: boolean): void {
    const { run1, player1, weapons1, summons1, enemies, projectiles, shots, pickups, hazards, arena } = this.deps;
    const payload: CombatSnapshotPayload = {
      tick: ++this.snapTick,
      wave: run1.wave,
      endless: run1.endless,
      phase: run1.phase,
      waveTimeLeft: Number.isFinite(run1.waveTimeLeft) ? Math.round(run1.waveTimeLeft * 10) / 10 : -1,
      activeWeather: run1.activeWeather,
      arenaHint: run1.arenaHint,
      boss: run1.boss ? { ...run1.boss } : null,
      p1: this.packPlayer(run1, player1, weapons1, this.p1Downed, this.p1Revive, p1Moving),
      p2: this.packPlayer(this.run2, this.player2, this.weapons2, this.p2Downed, this.p2Revive, this.p2Moving),
      enemies: enemies.snapshot(),
      projs: projectiles.snapshot(),
      shots: shots.snapshot(),
      pickups: pickups.snapshot(),
      summons: [...summons1.snapshot(), ...this.summons2.snapshot()],
      devices: [...weapons1.snapshotDevices(), ...this.weapons2.snapshotDevices()],
      hazards: hazards.snapshot(),
      arena: arena.snapshot(),
      fx: this.fxQueue.splice(0, this.fxQueue.length),
    };
    coop.send({ type: 'snap', data: payload });
  }
}

export { WORLD_MARGIN, MAX_SCREEN_RANGE, HEAL_AMOUNT };
