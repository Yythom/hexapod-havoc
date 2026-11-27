import Phaser from 'phaser';
import { ensureBiomeGround } from '../art/biomeGrounds';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
import { CAMERA_ZOOM, DEPTH, IS_COARSE_POINTER, RENDER_SCALE, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import { bus, EVT, listen } from '../core/bus';
import { MAX_SCREEN_RANGE } from '../core/combat';
import type { DailyMutatorId } from '../core/daily';
import { touchMove } from '../core/input';
import { RunState, type RunSetup, type SavedRun } from '../core/RunState';
import {
  clearActiveRun,
  loadSave,
  recordChallengeCleared,
  recordDailyResult,
  recordEndlessWave,
  recordEnemyKillsBatch,
  recordRun,
  recordWeaponSeen,
  saveActiveRun,
} from '../core/save';
import type { SeedChallengeTarget } from '../core/seed';
import { activeSets } from '../core/sets';
import { getSettings, useSettingsStore } from '../core/settings';
import { weaponPool } from '../core/shop';
import { checkUnlocks } from '../core/unlocks';
import { damageTakenMultiplier, dodgeChance, moveSpeed, pickupRange, regenPerSecond } from '../core/stats';
import type { BiomeId } from '../data/biomes';
import { ENEMIES } from '../data/enemies';
import { waveDefFor, WAVES } from '../data/waves';
import { WEAPONS, type WeaponClass } from '../data/weapons';
import { Player } from '../entities/Player';
import { coop } from '../net/coop';
import { CoopHostController } from '../net/coopHost';
import type { CoopResultPlayer } from '../net/protocol';
import { shake } from '../ui/camera';
import { BackyardArena } from '../systems/BackyardArena';
import { Effects } from '../systems/Effects';
import { EnemyManager, MAX_ENEMY_RADIUS, SPAWN_POP, type Enemy, type EnemyHost } from '../systems/EnemyManager';
import { EnemyShots } from '../systems/EnemyShots';
import { Hazards } from '../systems/Hazards';
import { HitResolver } from '../systems/HitResolver';
import { PickupManager } from '../systems/PickupManager';
import { ProjectileManager } from '../systems/ProjectileManager';
import { SpawnSystem } from '../systems/SpawnSystem';
import { Summons } from '../systems/Summons';
import { Telegraphs } from '../systems/Telegraphs';
import { POISON_DURATION, poisonPerStack, WeaponSystem } from '../systems/WeaponSystem';

type MoveKeys = Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;

export interface ResultData {
  win: boolean;
  endless?: boolean;
  wave: number;
  level: number;
  kills: number;
  nectar: number;
  character: string;
  difficulty: number;
  weapon: string;
  biome: BiomeId;
  seed: string;
  mutators?: DailyMutatorId[];
  seedTarget?: SeedChallengeTarget;
  /** 这局通关后解锁了下一档难度 */
  newDifficulty: boolean;
  /** 这局无尽模式是否刷新最高波次纪录 */
  newEndlessRecord?: boolean;
  /** 每日挑战日期（存在则表示每日挑战局） */
  daily?: string;
  /** 是否刷新当日每日挑战最佳 */
  newDailyBest?: boolean;
  /** 主题挑战 id（存在则表示主题挑战局） */
  challenge?: string;
  /** 是否首次通关该挑战 */
  newChallengeCleared?: boolean;
  /** 本局目标波次 */
  maxWaves?: number;
  /** 这局解锁的新角色 */
  unlocked: string[];
  /** 最终构筑武器（含累计输出，用于结算页展示与 MVP 标记） */
  weapons?: { id: string; tier: number; totalDamage: number }[];
  /** 最终激活的套装羁绊 */
  sets?: { cls: WeaponClass; count: number }[];
  /** 双人联机队友战绩（存在则渲染双人结算栏与返回大厅按钮） */
  coopPartner?: CoopResultPlayer & { roleLabel: string };
}

/** 波次结束后，等花蜜飞回来的时间 */
const CLEANUP_TIME = 0.9;
/** 受伤后的无敌时间 */
const INVULN_TIME = 0.5;
/** 普通怪掉宝箱的基础概率；幸运每 1 点相对提高 1%（最多 ×3），总概率不超过 0.42% */
const CHEST_CHANCE = 0.0015;
const CHEST_CHANCE_MAX = 0.0042;
/** 普通怪掉果实（回 3 血）的概率 */
const FRUIT_CHANCE = 0.02;
const HEAL_AMOUNT = 3;
/** 采蜜每过一波自动成长的比例 */
const HARVEST_GROWTH = 0.03;
/** 跳蛛丝弹的减速 */
const SILK_SLOW_TIME = 1.5;
/** 蜣螂：要碰到才能捡起花蜜 */
const TOUCH_PICKUP = 10;
/** 蜂巢药剂：低于 30% 生命时每秒回 2，每波最多 10 秒 */
const POTION_THRESHOLD = 0.3;
const POTION_RATE = 2;
const POTION_TIME = 10;

const SPLAT_COLOR: Record<string, number> = {
  ant: 0x5e182e,
  queen: 0x5e182e,
  mosquito: 0x481c4c,
  spider: 0x421c46,
  wasp: 0x7c5412,
  hornet_elite: 0x8a4814,
  gargoyle_elite: 0x4e3c68,
  slime: 0x7a329a,
  minislime: 0x7a329a,
  gasbag: 0x8e2824,
  pursuer: 0x5c2478,
  healer: 0x268a4c,
  buffer: 0xa82028,
  slasher_egg: 0x8a1e36,
  slasher: 0xa21e38,
  puffer: 0x9c2858,
  lamprey: 0x6c246e,
  spawner: 0x567028,
  spitter: 0x9e38a8,
  curse_slug: 0x7828be,
  mummy: 0x8a7450,
  mantis: 0x467824,
  goliath_boss: 0x6a4424,
};

/** 5 档天气难度对应的地面色调氛围（晴天通透 / 阴天清冷 / 小雨润暗 / 暴雨深湿 / 雷暴暗夜） */
const GROUND_WEATHER_TINT = [0xffffff, 0xe8eff5, 0xd8e5ec, 0xbfcbd8, 0xa8b4cc];

export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private groundImg!: Phaser.GameObjects.Image;
  private player!: Player;
  private fx!: Effects;
  private tel!: Telegraphs;
  private arena!: BackyardArena;
  private enemies!: EnemyManager;
  private shots!: EnemyShots;
  private projectiles!: ProjectileManager;
  private hazards!: Hazards;
  private summons!: Summons;
  private pickups!: PickupManager;
  private spawner!: SpawnSystem;
  private weapons!: WeaponSystem;
  private resolver!: HitResolver;
  private keys!: MoveKeys;
  private elapsed = 0;
  private phaseTimer = 0;
  private bossEnemy: Enemy | null = null;
  /** Boss 被击杀：等本帧各系统更新完再结束波次，避免在遍历怪物时清空列表 */
  private bossDown = false;
  /** Boss 狂暴：60 秒后伤害按秒提升，防止低 DPS 构筑无限拖 Boss 战 */
  private bossBaseDamage = 0;
  private bossBaseSkill = 0;
  private bossEnraged = false;
  /** 蘑菇圈计时、雷击残枝攻击计数 */
  private fairyTimer = 0;
  private attackCount = 0;
  /** 虎甲：静止了多久 */
  private idleTime = 0;
  /** Scythe 这类武器每秒自伤的小数累积 */
  private selfDamageAcc = 0;
  /** 蜂巢药剂本波已经回复了多久 */
  private potionTime = 0;
  /** 吸取速率桶：限制每秒最多靠吸取回复 10 HP（蚊子 13 HP/s），防止高频/穿透武器变永动机 */
  private lifestealBudget = 10;
  private ramCd = 0;
  private overhealCd = 0;
  private nectarShotCount = 0;
  private corpseDepth = 0;
  /** 独角仙/蚊子冲刺沿途已命中的怪（避免单次冲刺每帧重复判定） */
  private dashHitSet = new Set<Enemy>();
  /** 炽翼靴冲刺火迹冷却 */
  private dashFlameAcc = 0;
  /** 纯血玻璃挑战：每 12 秒再生 1 层护盾计时 */
  private glassShieldTimer = 12;
  private moving = false;
  /** 极短微顿帧（重击/爆炸/精英Boss击杀） */
  private hitstop = 0;
  /** 极短时间窗口连破计数（清屏爽感反馈） */
  private recentKills: number[] = [];
  private streakCd = 0;
  /** 手柄按键沿触发状态（冲刺 / 暂停） */
  private padDashDown = false;
  private padPauseDown = false;
  /** 手瞄 / 鼠标集火准星图形 */
  private reticle!: Phaser.GameObjects.Graphics;
  /** 靠近战场四边时的边界预警线 */
  private boundaryG!: Phaser.GameObjects.Graphics;
  private readonly aimWorld = new Phaser.Math.Vector2();
  /** 本波按怪种统计的击杀数（波末批量刷入图鉴） */
  private waveKillsById: Record<string, number> = {};
  /** 本局新解锁的角色 */
  private unlocked: string[] = [];
  private coopHost: CoopHostController | null = null;
  private enemyTarget: 1 | 2 = 1;
  private readonly contactBuf: Enemy[] = [];
  private readonly touching: Enemy[] = [];

  constructor() {
    super('Game');
  }

  /** data：角色选择界面传来的开局设置；或 resume 断点存档；重新开始时不传，沿用上一局的设置 */
  create(data?: Partial<RunSetup> & { resume?: SavedRun }): void {
    const resume = data?.resume;
    const last = loadSave().last;
    const setup: RunSetup = resume
      ? resume.setup
      : data?.character
        ? (data as RunSetup)
        : ((this.registry.get('setup') as RunSetup | undefined) ?? { character: last.character, difficulty: last.difficulty, weapon: last.weapon });
    this.registry.set('setup', setup);

    // 场景实例在重开时会复用，字段要在这里重置
    this.elapsed = 0;
    this.unlocked = [];
    this.phaseTimer = 0;
    this.bossEnemy = null;
    this.bossDown = false;
    this.fairyTimer = 0;
    this.attackCount = 0;
    this.idleTime = 0;
    this.potionTime = 0;
    this.lifestealBudget = 10;
    this.ramCd = 0;
    this.overhealCd = 0;
    this.nectarShotCount = 0;
    this.corpseDepth = 0;
    this.dashHitSet.clear();
    this.dashFlameAcc = 0;
    this.glassShieldTimer = 12;
    this.moving = false;
    this.hitstop = 0;
    this.recentKills = [];
    this.streakCd = 0;
    this.padDashDown = false;
    this.padPauseDown = false;
    this.waveKillsById = {};
    this.coopHost?.destroy();
    this.coopHost = null;
    this.enemyTarget = 1;
    touchMove.x = touchMove.y = 0;
    touchMove.active = false;
    touchMove.keyboardActive = false;
    if (resume) {
      this.run = RunState.restore(resume);
    } else {
      clearActiveRun();
      this.run = new RunState(setup);
    }
    this.registry.set('run', this.run);

    const groundTint = GROUND_WEATHER_TINT[this.run.activeWeather] ?? 0xffffff;
    const groundKey = ensureBiomeGround(this, this.run.biome.id);
    this.groundImg = this.add.image(0, 0, groundKey).setOrigin(0).setDepth(DEPTH.ground).setTint(groundTint);
    this.fx = new Effects(this);
    this.tel = new Telegraphs(this);
    this.arena = new BackyardArena(this, this.fx, this.tel);
    this.enemies = new EnemyManager(this, this.fx, this.tel);
    this.resolver = new HitResolver(this.enemies, this.fx);
    this.shots = new EnemyShots(this);
    this.hazards = new Hazards(this);
    this.summons = new Summons(this, this.fx, this.resolver);
    this.projectiles = new ProjectileManager(this, this.fx, this.hazards, this.resolver);
    this.pickups = new PickupManager(this);
    this.spawner = new SpawnSystem(this, this.enemies, this.fx);
    const skin = this.run.setup.shellSkin ?? loadSave().shellSkin;
    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, this.run.character.shell, skin);
    this.weapons = new WeaponSystem(this.player, this.projectiles, this.enemies, this.hazards, this.summons, this.resolver, this.fx);
    this.reticle = this.add.graphics().setDepth(DEPTH.text - 2);
    this.boundaryG = this.add.graphics().setDepth(DEPTH.ground + 2);

    this.spawner.onEvent = (title, color) => bus.emit(EVT.WAVE_EVENT, title, color);
    this.spawner.onBloom = () => this.arena.spawnBloom(this.player.x, this.player.y);
    this.projectiles.onExplode = (r) => this.triggerHitstop(r >= 80 ? 0.032 : 0.022);
    this.weapons.onLightningHit = (x, y, dmg) => this.arena.conductLightning(x, y, dmg, this.enemies);

    if (coop.isHost && coop.match) {
      this.coopHost = new CoopHostController({
        scene: this,
        run1: this.run,
        player1: this.player,
        weapons1: this.weapons,
        summons1: this.summons,
        enemies: this.enemies,
        projectiles: this.projectiles,
        shots: this.shots,
        hazards: this.hazards,
        pickups: this.pickups,
        arena: this.arena,
        fx: this.fx,
        match: coop.match,
        onBothDowned: () => this.die(),
        onRemotePause: (paused) => {
          const ui = this.scene.get('UI') as unknown as { applyRemotePause?: (p: boolean) => void };
          ui?.applyRemotePause?.(paused);
        },
        onBothReady: () => {
          if (this.scene.isActive('Intermission')) this.scene.stop('Intermission');
          this.startWave(this.run.wave + 1);
        },
        onStartEndless: () => bus.emit(EVT.CONTINUE_ENDLESS),
        onFinishRun: () => bus.emit(EVT.FINISH_RUN),
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.coopHost?.destroy();
        this.coopHost = null;
      });
    }

    const scene = this;
    this.arena.host = {
      get px() {
        return scene.player.x;
      },
      get py() {
        return scene.player.y;
      },
      get pr() {
        return scene.player.radius;
      },
      get p1Alive() {
        return !scene.coopHost?.p1Downed;
      },
      get p2() {
        const ch = scene.coopHost;
        return ch ? { x: ch.player2.x, y: ch.player2.y, r: ch.player2.radius, alive: !ch.p2Downed } : undefined;
      },
      get wave() {
        return scene.run.wave;
      },
      hurtPlayer: (d) => this.damagePlayer(d),
      hurtPlayer2: (d) => this.coopHost?.damagePlayer2(d),
      onBloomComplete: (bx, by) => this.onBloomComplete(bx, by),
      onArenaHint: (text) => {
        scene.run.arenaHint = text;
      },
    };
    const host: EnemyHost = {
      get px() {
        return scene.enemyTarget === 2 && scene.coopHost ? scene.coopHost.player2.x : scene.player.x;
      },
      get py() {
        return scene.enemyTarget === 2 && scene.coopHost ? scene.coopHost.player2.y : scene.player.y;
      },
      get pr() {
        return scene.enemyTarget === 2 && scene.coopHost ? scene.coopHost.player2.radius : scene.player.radius;
      },
      get wave() {
        return scene.run.wave;
      },
      get difficulty() {
        return scene.run.difficulty;
      },
      get mods() {
        return scene.run.mods;
      },
      get curse() {
        return scene.run.stats.curse + (scene.coopHost ? scene.coopHost.run2.stats.curse : 0);
      },
      get enemySpeedMult() {
        return scene.run.hasMutator('turbo') ? 1.15 : 1;
      },
      get boomParty() {
        return scene.run.hasMutator('boom_party');
      },
      get coopHpMult() {
        return scene.coopHost ? 1.45 : 1;
      },
      get coopBossHpMult() {
        return scene.coopHost ? 1.65 : 1;
      },
      selectTarget: (x, y) => {
        scene.enemyTarget = scene.coopHost ? scene.coopHost.nearestLivingTarget(x, y) : 1;
      },
      hurtPlayersInCircle: (cx, cy, radius, damage) => {
        if (!scene.coopHost?.p1Downed) {
          const dx = scene.player.x - cx;
          const dy = scene.player.y - cy;
          if (dx * dx + dy * dy < (radius + scene.player.radius) ** 2) scene.damagePlayer(damage);
        }
        if (scene.coopHost && !scene.coopHost.p2Downed) {
          const p2 = scene.coopHost.player2;
          const dx = p2.x - cx;
          const dy = p2.y - cy;
          if (dx * dx + dy * dy < (radius + p2.radius) ** 2) scene.coopHost.damagePlayer2(damage);
        }
      },
      hurtPlayersInSegment: (x0, y0, x1, y1, halfW, damage) => {
        const vx = x1 - x0;
        const vy = y1 - y0;
        const len2 = vx * vx + vy * vy || 1;
        const check = (px: number, py: number, pr: number, hurt: () => void) => {
          const proj = Phaser.Math.Clamp(((px - x0) * vx + (py - y0) * vy) / len2, 0, 1);
          const cx = x0 + vx * proj;
          const cy = y0 + vy * proj;
          const hitR = halfW + pr * 0.85;
          if ((px - cx) ** 2 + (py - cy) ** 2 <= hitR * hitR) hurt();
        };
        if (!scene.coopHost?.p1Downed) check(scene.player.x, scene.player.y, scene.player.radius, () => scene.damagePlayer(damage));
        if (scene.coopHost && !scene.coopHost.p2Downed) {
          const p2 = scene.coopHost.player2;
          check(p2.x, p2.y, p2.radius, () => scene.coopHost!.damagePlayer2(damage));
        }
      },
      onLightningStrike: (x, y, dmg) => this.arena.conductLightning(x, y, dmg, this.enemies),
      hurtPlayer: (d) => {
        if (scene.enemyTarget === 2 && scene.coopHost) scene.coopHost.damagePlayer2(d);
        else scene.damagePlayer(d);
      },
      shoot: (x, y, a, sp, d, kind) => this.shots.fire(x, y, a, sp, d, kind),
    };
    this.enemies.host = host;
    this.enemies.onKilled = (e) => this.onEnemyKilled(e);
    this.enemies.onDamaged = (e, _dmg, crit) => this.onEnemyDamaged(e, crit);
    this.enemies.onPoisonDamage = (d) => {
      this.run.toxinDamage += d;
    };
    this.weapons.onAttack = () => this.onPlayerAttack();
    this.weapons.onDevicePlaced = () => {
      this.run.devicesPlaced++;
    };
    this.resolver.host = {
      get mods() {
        return scene.run.mods;
      },
      get hpRatio() {
        return scene.run.hp / Math.max(1, scene.run.maxHp);
      },
      heal: (n, fx, fy, kind) => this.heal(n, kind ?? 'other', fx, fy),
      dropBonusNectar: (x, y, n) => this.pickups.dropNectar(x, y, n),
      onWeaponKill: (def) => {
        if (def.kind === 'melee') this.run.meleeKills++;
      },
      onCritSpark: (x, y, count) => this.fireSeekingSparks(x, y, count, 10 + 0.5 * this.run.stats.ranged),
      onHitstop: (sec) => this.triggerHitstop(sec),
      onFireHit: (x, y, dps) => {
        this.arena.igniteAt(x, y, dps);
      },
      burst: (x, y, count, damage, texture, radius, speed, src) => {
        const bCol = texture === 'laserbolt' ? 0x4ef4ff : 0xd8ff78;
        this.fx.star(x, y, 16, bCol);
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + Math.random() * 0.3;
          this.fx.tracer(x, y, x + Math.cos(a) * 26, y + Math.sin(a) * 26, bCol, 2.2, 0.1);
          this.projectiles.fire({
            texture,
            x,
            y,
            angle: a,
            speed,
            maxDist: 260,
            damage,
            crit: false,
            radius,
            knockback: 40,
            pierce: 0,
            spin: 0,
            explode: 0,
            poison: null,
            cloud: null,
            src,
          });
        }
      },
    };

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const applyCameraZoom = (zoomMult: number) => {
      cam.setZoom(CAMERA_ZOOM * zoomMult * RENDER_SCALE);
    };
    applyCameraZoom(getSettings().cameraZoom);
    const unsubSettings = useSettingsStore.subscribe((next, prev) => {
      if (next.cameraZoom !== prev.cameraZoom) {
        applyCameraZoom(next.cameraZoom);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubSettings);
    cam.startFollow(this.player.view, false, 0.12, 0.12);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as MoveKeys;
    const onDashKey = () => this.performDash();
    this.input.keyboard!.on('keydown-SPACE', onDashKey);
    this.input.keyboard!.on('keydown-SHIFT', onDashKey);
    listen(this, EVT.DASH_TRIGGER, onDashKey);
    listen(this, EVT.NEXT_WAVE, () => this.startWave(this.run.wave + 1));
    listen(this, EVT.CONTINUE_ENDLESS, () => {
      this.run.endless = true;
      this.run.phase = 'intermission';
      if (!this.coopHost) saveActiveRun(this.run.serialize());
      else this.coopHost.onWaveEnterIntermission(0, 0);
      bus.emit(EVT.INTERMISSION);
      bgm.setMode('shop');
      this.scene.launch('Intermission');
    });
    listen(this, EVT.FINISH_RUN, () => this.toResult(true));

    this.scene.launch('UI');
    if (resume) {
      this.weapons.sync(this.run.weapons, this.run.weaponSlots);
      this.run.phase = 'intermission';
      bgm.setMode('shop');
      this.scene.launch('Intermission');
    } else {
      this.startWave(1);
    }
  }

  private triggerHitstop(sec: number): void {
    this.hitstop = Math.max(this.hitstop, Math.min(0.075, sec));
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const run = this.run;

    if (run.phase === 'dead' || run.phase === 'victory') {
      this.reticle.clear();
      this.enemies.update(dt);
      this.tel.update(dt);
      this.fx.update(dt);
      if (run.phase === 'dead') this.coopHost?.tickDeadSnapshot(dt);
      return;
    }
    if (run.phase === 'intermission') {
      this.reticle.clear();
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      this.fx.update(dt * 0.25);
      return;
    }

    const stats = run.stats;
    const p1Downed = !!this.coopHost?.p1Downed;
    this.pollGamepadActions();
    const [rawIx, rawIy] = this.readInput();
    const ix = p1Downed ? 0 : rawIx;
    const iy = p1Downed ? 0 : rawIy;
    this.moving = !p1Downed && Math.hypot(ix, iy) > 0.1;
    this.idleTime = p1Downed || Math.hypot(ix, iy) > 0.05 ? 0 : this.idleTime + dt;
    this.ramCd = Math.max(0, this.ramCd - dt);
    this.overhealCd = Math.max(0, this.overhealCd - dt);
    this.player.syncDashConfig(run.maxDashCharges, stats.speedPct, run.mods.dashCooldownPct);
    const [windX, windY] = run.phase === 'combat' ? this.arena.windVector : [0, 0];
    const dashEnded = p1Downed
      ? false
      : this.player.update(
          dt,
          ix,
          iy,
          moveSpeed(stats),
          run.shield > 0,
          windX,
          windY,
          !!run.biome.slippery,
          this.arena.obstacles,
        );
    run.dashCharges = this.player.dashCharges;
    run.dashRatio =
      this.player.dashCharges >= this.player.maxDashCharges
        ? 1
        : this.player.dashCd > 0
          ? Math.max(0, 1 - this.player.dashCd / Math.max(0.1, this.player.dashCdMax))
          : 1;
    run.frenzyTime = this.player.frenzyTime;
    if (!p1Downed && this.player.dashTime > 0) {
      if (Math.random() < dt * 45) {
        this.fx.streaks(this.player.x, this.player.y, this.player.view.rotation + Math.PI, 0xb8f4ff, 1, 130, 0.72);
      }
      if (run.phase === 'combat') this.updateDashActive(dt);
    } else if (!p1Downed && this.player.frenzyTime > 0 && Math.random() < dt * 18) {
      this.fx.burst(this.player.x, this.player.y, 0xffd44c, 1, 65, 0.6);
    }
    if (dashEnded && run.phase === 'combat') this.onDashEnd();
    this.drawBoundaryWarning();
    this.enemies.update(dt);
    this.projectiles.aftershockEnabled = run.mods.explosiveAftershock > 0;
    this.projectiles.update(dt, this.enemies, this.player.x, this.player.y);
    this.hazards.update(dt, this.enemies);
    if (run.phase === 'combat') this.arena.update(dt, this.enemies);
    this.tel.update(dt);

    if (run.phase === 'combat') {
      this.elapsed += dt;
      this.streakCd = Math.max(0, this.streakCd - dt);
      const lsCap = run.character.perks.lifestealOnly ? 13 : 10;
      this.lifestealBudget = Math.min(lsCap, this.lifestealBudget + lsCap * dt);
      const spawnAnchor = p1Downed && this.coopHost && !this.coopHost.p2Downed ? this.coopHost.player2 : this.player;
      this.spawner.update(dt, this.elapsed, spawnAnchor.x, spawnAnchor.y);
      if (!p1Downed) {
        const missingTenths = Math.floor(Math.max(0, 1 - run.hp / run.maxHp) * 10);
        const frenzyAspd = this.player.frenzyTime > 0 ? 0.25 : 0;
        const combatStats =
          (run.mods.bloodRage > 0 && missingTenths > 0) || frenzyAspd > 0
            ? {
                ...stats,
                damagePct: stats.damagePct + (run.mods.bloodRage > 0 ? missingTenths * 0.08 * run.mods.bloodRage : 0),
                attackSpeedPct: stats.attackSpeedPct + (run.mods.bloodRage > 0 ? missingTenths * 0.06 * run.mods.bloodRage : 0) + frenzyAspd,
              }
            : stats;
        // 手瞄 / 按住鼠标左键集火（桌面端）
        const aimPoint = this.resolveManualAim();
        this.weapons.update(dt, {
          stats: combatStats,
          mods: run.mods,
          damageMult: this.damageMult(),
          hpRatio: run.hp / run.maxHp,
          emptySlots: Math.max(0, run.weaponSlots - run.weapons.length),
          moving: this.moving,
          workers: run.workerCount,
          workerTier: run.workerTier,
          workerHp: Math.round((12 + 4 * (run.wave - 1)) * (1 + Math.max(0, stats.armor) * 0.04)),
          aimPoint,
          mantisCrit: this.player.mantisCritTime > 0,
        });
        const selfDps = run.weapons.reduce((a, w) => a + (WEAPONS[w.id]?.special?.selfDamagePerSec ?? 0), 0) + run.mods.selfDamagePerSec;
        if (selfDps > 0 && run.phase === 'combat') {
          this.selfDamageAcc += selfDps * dt;
          const n = Math.floor(this.selfDamageAcc);
          if (n > 0) {
            this.selfDamageAcc -= n;
            run.hp -= n;
            this.fx.number(this.player.x, this.player.y - 26, n, 'player');
            if (run.hp <= 0 && !this.coopHost?.onPlayer1Fatal()) this.die();
          }
        }
        run.maxSummons = Math.max(run.maxSummons, this.summons.aliveCount);
        if (!run.waveNoHeal) {
          if (run.mods.torture > 0) {
            run.hp = Math.min(run.maxHp, run.hp + 5 * dt);
          } else {
            run.hp = Math.min(run.maxHp, run.hp + regenPerSecond(stats) * (1 + run.mods.healingPct) * dt);
          }
        }
        this.checkContact();
        this.updateItemTimers(dt);
      } else {
        this.reticle.clear();
      }
      const ch = this.coopHost;
      this.shots.update(
        dt,
        this.player.x,
        this.player.y,
        p1Downed ? 0 : this.player.radius,
        (d, kind) => {
          if (this.damagePlayer(d) && kind === 'silk') this.player.slowTime = SILK_SLOW_TIME;
        },
        this.arena.obstacles,
        (bx, by) => this.fx.burst(bx, by, 0xc89862, 4, 85, 0.7),
        ch
          ? {
              x: ch.player2.x,
              y: ch.player2.y,
              r: ch.player2.radius,
              alive: !ch.p2Downed,
              onHit: (d, kind) => {
                if (ch.damagePlayer2(d) && kind === 'silk') ch.player2.slowTime = SILK_SLOW_TIME;
              },
            }
          : undefined,
      );
      this.trackBoss();
      this.updateOffscreenMarkers();
      this.checkUnlocks();
    } else {
      this.reticle.clear();
      run.offscreenMarkers.length = 0;
    }

    const touch = run.character.perks.touchPickup;
    if (this.coopHost) {
      const ch = this.coopHost;
      const got = this.pickups.updateCoop(
        dt,
        { x: this.player.x, y: this.player.y, radius: this.player.radius, alive: !ch.p1Downed },
        touch ? this.player.radius + TOUCH_PICKUP : pickupRange(stats),
        run.mods.magnetSpeed > 0,
        { x: ch.player2.x, y: ch.player2.y, radius: ch.player2.radius, alive: !ch.p2Downed },
        ch.getP2PickupRange(),
        ch.run2.mods.magnetSpeed > 0,
        run.phase === 'cleanup',
      );
      if (got.nectar1 > 0) {
        const touchMult = touch && run.phase === 'combat' ? touch.mult : 1;
        const raw = got.nectar1 * touchMult * (run.phase === 'combat' ? run.waveNectarMult : 1);
        this.addNectar(Math.floor(raw) + (Math.random() < raw - Math.floor(raw) ? 1 : 0));
        sfx.play('nectar');
      }
      if (got.chests1 > 0) this.addChests(got.chests1);
      if (got.heals1 > 0 && run.phase === 'combat') this.heal(HEAL_AMOUNT * got.heals1);
      if (got.frenzy1 > 0 && run.phase === 'combat') {
        this.player.frenzyTime = 4;
        this.fx.ring(this.player.x, this.player.y, 44, 0xffd44c);
        this.fx.number(this.player.x, this.player.y - 36, '琥珀狂热！', 'level');
        sfx.play('frenzy');
      }
      if (got.nectar2 > 0) {
        const touch2 = ch.run2.character.perks.touchPickup;
        const mult2 = (touch2 && run.phase === 'combat' ? touch2.mult : 1) * (run.phase === 'combat' ? ch.run2.waveNectarMult : 1);
        const raw2 = got.nectar2 * mult2;
        ch.addNectarP2(Math.floor(raw2) + (Math.random() < raw2 - Math.floor(raw2) ? 1 : 0));
        ch.pushSfx('nectar');
      }
      if (got.chests2 > 0) ch.addChestsP2(got.chests2);
      if (got.heals2 > 0 && run.phase === 'combat') ch.healP2(HEAL_AMOUNT * got.heals2);
      if (got.frenzy2 > 0 && run.phase === 'combat') ch.giveFrenzyP2(4);
      ch.update(dt, windX, windY, this.moving);
    } else {
      this.pickups.update(
        dt,
        this.player,
        touch ? this.player.radius + TOUCH_PICKUP : pickupRange(stats),
        run.phase === 'cleanup',
        run.mods.magnetSpeed > 0,
      );
      if (this.pickups.gotNectar > 0) {
        const touchMult = touch && run.phase === 'combat' ? touch.mult : 1;
        const mult = touchMult * (run.phase === 'combat' ? run.waveNectarMult : 1);
        const raw = this.pickups.gotNectar * mult;
        this.addNectar(Math.floor(raw) + (Math.random() < raw - Math.floor(raw) ? 1 : 0));
        sfx.play('nectar');
        if (run.mods.nectarShot > 0 && run.phase === 'combat') {
          this.nectarShotCount += this.pickups.gotNectar;
          while (this.nectarShotCount >= 3) {
            this.nectarShotCount -= 3;
            this.fireSeekingSparks(this.player.x, this.player.y, 1, 12 + 0.8 * stats.harvest);
          }
        }
      }
      if (this.pickups.gotChests > 0) this.addChests(this.pickups.gotChests);
      if (this.pickups.gotHeals > 0 && run.phase === 'combat') this.heal(HEAL_AMOUNT * this.pickups.gotHeals);
      if (this.pickups.gotFrenzy > 0 && run.phase === 'combat') {
        this.player.frenzyTime = 4;
        this.fx.ring(this.player.x, this.player.y, 44, 0xffd44c);
        this.fx.number(this.player.x, this.player.y - 36, '琥珀狂热！', 'level');
        sfx.play('frenzy');
      }
    }
    this.fx.update(dt);

    if (run.phase === 'combat') {
      const def = this.currentWaveDef(run.wave);
      const duration = def.duration;
      run.waveTimeLeft = duration === null ? Infinity : Math.max(0, duration - this.elapsed);
      if (run.hp <= 0 && !this.coopHost?.onPlayer1Fatal()) this.die();
      else if (run.waveTimeLeft <= 0 || this.bossDown) this.endWave();
    } else if (run.phase === 'cleanup') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0 && (this.pickups.count === 0 || this.phaseTimer < -1.5)) this.finishWave();
    }
  }

  private readInput(): [number, number] {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1;
    if (k.D.isDown || k.RIGHT.isDown) x += 1;
    if (k.W.isDown || k.UP.isDown) y -= 1;
    if (k.S.isDown || k.DOWN.isDown) y += 1;
    touchMove.keyboardActive = x !== 0 || y !== 0;
    if (touchMove.keyboardActive) {
      const l = Math.hypot(x, y);
      return [x / l, y / l];
    }
    const pad = this.input.gamepad?.pad1;
    if (pad) {
      let gx = pad.leftStick.x;
      let gy = pad.leftStick.y;
      if (Math.hypot(gx, gy) < 0.18) {
        gx = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
        gy = (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
      }
      const gl = Math.hypot(gx, gy);
      if (gl > 0.18) return gl > 1 ? [gx / gl, gy / gl] : [gx, gy];
    }
    return [touchMove.x, touchMove.y];
  }

  /** 原生手柄快捷按键：A / RB 触发冲刺，Start 触发暂停 */
  private pollGamepadActions(): void {
    const pad = this.input.gamepad?.pad1;
    if (!pad) {
      this.padDashDown = false;
      this.padPauseDown = false;
      return;
    }
    const dashNow = !!(pad.A || pad.R1 || pad.buttons[0]?.pressed || pad.buttons[5]?.pressed);
    if (dashNow && !this.padDashDown) this.performDash();
    this.padDashDown = dashNow;

    const pauseNow = !!(pad.buttons[9]?.pressed);
    if (pauseNow && !this.padPauseDown) {
      const ui = this.scene.get('UI') as unknown as { togglePause?: () => void };
      ui?.togglePause?.();
    }
    this.padPauseDown = pauseNow;
  }

  /** 本帧的伤害倍率：虎甲静止太久时减半 */
  private damageMult(): number {
    const idle = this.run.character.perks.idlePenalty;
    return idle && this.idleTime > idle.delay ? idle.mult : 1;
  }

  /** 获取本波配置：主题挑战的最后一波（第 10 波）自动升级为 Boss 决战波 */
  private currentWaveDef(n: number) {
    if (this.run.setup.challenge && n === this.run.maxWaves && !this.run.endless) {
      return { ...WAVES[WAVES.length - 1], duration: null, boss: 'boss_pool' as const };
    }
    return waveDefFor(n);
  }

  private startWave(n: number): void {
    const run = this.run;
    run.wave = n;
    if (n > run.maxWaves) run.endless = true;
    run.resetIntermissionState();
    // 开战瞬间清除波间断点存档：禁止通过刷新网页或中途退回菜单重打本波
    clearActiveRun();
    run.phase = 'combat';
    run.waveDamagePenalty = 0;
    run.waveContractDamagePct = 0;
    run.waveNoHeal = false;
    run.waveNectarMult = 1;
    const contract = run.activeContract;
    const peacockStacks = run.nextWavePeacock;
    run.nextWavePeacock = 0;
    run.waveXpMult = (1 + peacockStacks) * (contract === 'swarm_harvest' ? 1.55 : 1);
    run.waveEnemyDamageMult = (1 + peacockStacks * 0.5) * (contract === 'glass_frenzy' ? 1.35 : 1);
    if (contract === 'no_heal_vow') run.waveNoHeal = true;
    if (contract === 'swarm_harvest') run.waveNectarMult = 1.55;
    if (contract === 'glass_frenzy') run.waveContractDamagePct = 0.4;

    const waveRng = run.rng('wave', n);
    const arenaRng = run.rng('arena', n);
    // 百变武器词条：第 2 波起每波开局所有武器随机重铸为同品阶新武器（继承诅咒与附魔）
    let chaosReforged = false;
    if (run.hasMutator('chaos') && n > 1 && run.weapons.length > 0) {
      for (const ow of run.weapons) {
        const pool = weaponPool(run, ow.tier);
        if (pool.length > 0) {
          const pick = pool[Math.floor(waveRng() * pool.length)];
          ow.id = pick.id;
        }
      }
      chaosReforged = true;
    }

    // 无尽模式每 5 波自动轮换后院天气
    run.activeWeather = run.endless ? (run.setup.difficulty + Math.floor((n - 21) / 5) + 1) % 5 : run.setup.difficulty;
    this.groundImg.setTint(GROUND_WEATHER_TINT[run.activeWeather] ?? 0xffffff);

    // 古树年轮：每波开始最大生命永久 +2
    if (run.itemCount('treering') > 0) run.bonus.maxHp += 2;
    // 蝉：熬过前几波后，每波开始永久成长
    const bloom = run.character.perks.lateBloom;
    if (bloom && n > bloom.waves) {
      run.bonus.maxHp += bloom.maxHp;
      run.bonus.damagePct += bloom.damagePct;
    }
    run.recomputeStats();
    const oneHpStart = run.nextWaveOneHp;
    run.nextWaveOneHp = false;
    run.hp = oneHpStart ? 1 : run.maxHp;
    // 存蜜猪猪罐（Piggy Bank）：第 20 波前，每波开始按未花花蜜 +20% 派息
    let piggyBonus = 0;
    if (n > 1 && n <= WAVES.length && run.itemCount('piggybank') > 0 && run.nectar > 0) {
      piggyBonus = Math.floor(run.nectar * 0.2);
      if (piggyBonus > 0) {
        run.nectar += piggyBonus;
        run.totalNectar += piggyBonus;
      }
    }
    const baitWaves = run.nextWaveBait;
    run.nextWaveBait = 0;
    this.selfDamageAcc = 0;
    this.glassShieldTimer = 12;
    run.shield =
      (run.itemCount('horncharm') > 0 ? 1 : 0) +
      (run.hasMutator('vamp') ? 1 : 0) +
      (run.hasMutator('glass_soul') ? 2 : 0);
    run.waveNectar = 0;
    run.waveKills = 0;
    run.waveHarvest = 0;
    run.waveInterest = 0;
    run.boss = null;
    run.arenaHint = '';
    this.recentKills.length = 0;
    this.streakCd = 0;
    const def = this.currentWaveDef(n);
    run.waveTimeLeft = def.duration ?? Infinity;
    this.elapsed = 0;
    this.fairyTimer = 0;
    this.potionTime = 0;
    this.lifestealBudget = run.character.perks.lifestealOnly ? 13 : 10;
    this.idleTime = 0;
    this.bossEnemy = null;
    this.bossDown = false;
    this.player.invuln = 0;
    this.player.slowTime = 0;
    this.player.hasteTime = 0;
    this.player.frenzyTime = 0;
    this.player.mantisCritTime = 0;
    this.player.dashTime = 0;
    this.player.dashCd = 0;
    this.player.resetMotion();
    this.player.syncDashConfig(run.maxDashCharges, run.stats.speedPct, run.mods.dashCooldownPct);
    this.player.dashCharges = this.player.maxDashCharges;
    this.waveKillsById = {};
    for (const w of run.weapons) {
      w.ramp = 0;
      w.waveDamage = 0;
      recordWeaponSeen(w.id, w.tier);
    }
    this.weapons.sync(run.weapons, run.weaponSlots);
    this.arena.startWave(run.activeWeather, run.biome, arenaRng);
    const spawnBonus = run.mods.spawnRatePct + (contract === 'swarm_harvest' ? 0.4 : 0) + (this.coopHost ? 0.35 : 0);
    this.coopHost?.startWave(n);
    this.spawner.startWave(def, n, run.difficulty, spawnBonus, run.hasMutator('treasure'), {
      boomParty: run.hasMutator('boom_party'),
      extraElite: contract === 'elite_bounty',
      dewIntervalMult: run.biome.dewIntervalMult,
      rng: waveRng,
    });
    // 诱饵甜果（Bait）：开局立刻空降专属突袭怪——噬蜜飞鳗（冲锋并向两侧甩弹幕）
    if (baitWaves > 0) {
      const count = baitWaves * 3;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.35;
        const dist = Phaser.Math.Between(270, 360);
        const bx = Phaser.Math.Clamp(this.player.x + Math.cos(ang) * dist, WORLD_MARGIN + 24, WORLD_WIDTH - WORLD_MARGIN - 24);
        const by = Phaser.Math.Clamp(this.player.y + Math.sin(ang) * dist, WORLD_MARGIN + 24, WORLD_HEIGHT - WORLD_MARGIN - 24);
        this.enemies.spawn(ENEMIES.lamprey, bx, by, n);
      }
    }
    const intense = !!def.boss || (def.elites && def.elites.length > 0) || run.endless;
    bgm.setMode(intense ? 'boss' : 'combat');
    bus.emit(EVT.WAVE_START, n);
    if (chaosReforged) bus.emit(EVT.WAVE_EVENT, '🎲 百变虫军：武器已随机重铸！', '#7ce8ff');
    if (contract === 'elite_bounty') bus.emit(EVT.WAVE_EVENT, '⚔ 猎王悬赏生效：额外精英空降！', '#ffd44c');
    else if (contract === 'no_heal_vow') bus.emit(EVT.WAVE_EVENT, '🩸 断愈死斗生效：本波禁止一切回血！', '#ff7a84');
    else if (contract === 'swarm_harvest') bus.emit(EVT.WAVE_EVENT, '✿ 狂潮收割生效：虫群暴增 · 收益 +55%！', '#78ec74');
    else if (contract === 'glass_frenzy') bus.emit(EVT.WAVE_EVENT, '⚡ 薄壳狂袭生效：伤 +40% · 受击 +35%！', '#7ce8ff');
    if (piggyBonus > 0) bus.emit(EVT.WAVE_EVENT, `存蜜猪猪罐派息 +${piggyBonus} 花蜜！`, '#ffd44c');
    if (oneHpStart) bus.emit(EVT.WAVE_EVENT, '幽灵蝉蜕：本波 1 血开局！', '#78e6ff');
    if (baitWaves > 0) bus.emit(EVT.WAVE_EVENT, `诱饵甜果：${baitWaves * 3} 只噬蜜飞鳗突袭！`, '#ff6a5a');
    if (peacockStacks > 0) {
      bus.emit(EVT.WAVE_EVENT, `孔雀尾羽：经验 +${peacockStacks * 100}% · 敌伤 +${peacockStacks * 50}%`, '#ffb258');
    }
    sfx.play('waveStart');
  }

  private checkContact(): void {
    const p = this.player;
    const run = this.run;
    const canRam = (this.moving || p.dashTime > 0) && run.mods.ramDamage > 0 && this.ramCd <= 0;
    if (p.invuln > 0 && !canRam) return;
    let dmg = 0;
    const touching = this.touching;
    touching.length = 0;
    const ramHits: Enemy[] = [];
    for (const e of this.enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS + 8, this.contactBuf)) {
      if (e.age < SPAWN_POP + 0.1 || e.frozen > 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (canRam && dx * dx + dy * dy <= (p.radius + e.radius + 8) ** 2) ramHits.push(e);
      if (e.damage <= 0 || p.invuln > 0) continue;
      const rr = p.radius + e.radius * 0.9;
      if (dx * dx + dy * dy <= rr * rr) {
        dmg = Math.max(dmg, e.damage);
        touching.push(e);
      }
    }
    if (canRam && ramHits.length > 0) {
      this.ramCd = 0.35;
      const rdmg = Math.max(1, Math.round((15 + 2 * run.stats.armor) * run.mods.ramDamage * (1 + run.stats.damagePct)));
      this.fx.ring(p.x, p.y, p.radius + 32, 0x72d8ff);
      for (const e of ramHits) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        this.enemies.hit(e, rdmg, false, (e.x - p.x) / d, (e.y - p.y) / d, 260);
      }
    }
    if (dmg <= 0) return;
    this.damagePlayer(dmg);
    // 刺蛾幼虫：被碰到时反弹伤害给碰到自己的怪
    const thorns = this.run.character.perks.thorns;
    if (thorns) {
      const stats = this.run.stats;
      const back = Math.max(1, Math.round((thorns.base + Math.max(0, stats.armor)) * (1 + stats.damagePct)));
      for (const e of touching.slice()) {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        this.enemies.hit(e, back, false, (e.x - p.x) / d, (e.y - p.y) / d, 240);
      }
      this.fx.ring(p.x, p.y, 34, 0xd8f06a);
    }
  }

  /** 对玩家造成伤害，返回是否真的受伤（无敌、闪避、护盾都算没受伤） */
  private damagePlayer(raw: number): boolean {
    const run = this.run;
    const p = this.player;
    if (run.phase !== 'combat' || p.invuln > 0 || this.coopHost?.p1Downed) return false;
    p.invuln = INVULN_TIME;
    this.weapons?.resetRamps();
    if (Math.random() < dodgeChance(run.stats)) {
      this.fx.number(p.x, p.y - 28, '闪避', 'dodge');
      sfx.play('dodge');
      return false;
    }
    if (run.shield > 0) {
      run.shield--;
      this.fx.number(p.x, p.y - 28, '护盾', 'shield');
      this.fx.ring(p.x, p.y, 40, 0x9fd8ff);
      sfx.play('shield');
      return false;
    }
    const dmg = Math.max(1, Math.round(raw * run.waveEnemyDamageMult * damageTakenMultiplier(run.stats.armor)));
    run.hp = Math.max(0, run.hp - dmg);
    // 力量三角（Triangle of Power）：每次受伤本波伤害 −2%
    if (run.mods.trianglePenalty > 0) {
      run.waveDamagePenalty += 0.02 * run.mods.trianglePenalty;
      run.recomputeStats();
    }
    this.fx.number(p.x, p.y - 28, dmg, 'player');
    shake(this, 90, 0.004);
    sfx.play('hurt');
    bus.emit(EVT.PLAYER_HIT);
    // 鸟羽毛：受伤后加速
    if (run.itemCount('feather') > 0) p.hasteTime = 1;
    // 屁步甲：受伤时向身后喷一团毒雾
    if (run.character.perks.hurtCloud) {
      const back = p.view.rotation + Math.PI;
      const stats = run.stats;
      this.hazards.addCloud(
        p.x + Math.cos(back) * 34,
        p.y + Math.sin(back) * 34,
        70,
        2.5,
        2 + stats.toxin,
        poisonPerStack(stats, run.mods),
        POISON_DURATION + run.mods.poisonDuration,
      );
    }
    // 臭腺：受伤时喷毒雾
    const stink = run.itemCount('stinkgland');
    if (stink > 0) {
      const stats = run.stats;
      this.hazards.addCloud(p.x, p.y, 80 + 10 * stink, 2, (2 + stats.toxin) * stink, poisonPerStack(stats, run.mods), POISON_DURATION + run.mods.poisonDuration);
    }
    // 联机下立刻结算倒地/全灭，避免同帧内 P2 状态判断出现竞争
    if (run.hp <= 0 && this.coopHost) {
      if (!this.coopHost.onPlayer1Fatal()) this.die();
    }
    return true;
  }

  /** 回血：吃治疗效果加成；蚊子只能靠吸取回血；吸取受全局速率桶限制防高频永动；传入来源坐标时发射吸取光丝 */
  private heal(n: number, kind: 'lifesteal' | 'other' = 'other', fromX?: number, fromY?: number): void {
    const run = this.run;
    if (this.coopHost?.p1Downed || run.phase !== 'combat' || run.mods.torture > 0 || run.waveNoHeal) return;
    if (kind === 'other' && run.character.perks.lifestealOnly) return;
    let effectiveN = n;
    if (kind === 'lifesteal') {
      if (this.lifestealBudget < 1) return;
      effectiveN = Math.min(n, Math.floor(this.lifestealBudget));
      this.lifestealBudget -= effectiveN;
    }
    const before = run.hp;
    const amount = effectiveN * (1 + run.mods.healingPct);
    run.hp = Math.min(run.maxHp, run.hp + amount);
    const gained = run.hp - before;
    if (gained > 0) {
      if (kind === 'lifesteal') {
        run.lifestealHealed += gained;
        if (run.mods.vampBite > 0) this.triggerVampBite();
      }
      if (fromX !== undefined && fromY !== undefined) {
        this.fx.tether(fromX, fromY, () => this.player, kind === 'lifesteal' ? 0xff4d6d : 0x5cff8a);
      }
      this.fx.number(this.player.x, this.player.y - 28, `+${Math.max(1, Math.round(gained))}`, 'heal');
      if (n >= 2) sfx.play('heal');
    }
    if (run.mods.overhealShock > 0 && before + amount >= run.maxHp && this.overhealCd <= 0) {
      this.triggerOverhealShock();
    }
  }

  private triggerOverhealShock(): void {
    this.overhealCd = 0.25;
    const run = this.run;
    const p = this.player;
    const r = 110;
    const dmg = Math.max(1, Math.round((18 + 2 * run.stats.regen) * (1 + run.stats.damagePct)));
    this.fx.ring(p.x, p.y, r, 0xffd44c);
    this.fx.burst(p.x, p.y, 0xffe478, 8, 180, 0.9);
    for (const e of this.enemies.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
      if (!e.active) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > (r + e.radius) ** 2) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.enemies.hit(e, dmg, false, dx / d, dy / d, 180);
    }
  }

  private triggerVampBite(): void {
    const t = this.enemies.nearest(this.player.x, this.player.y, 260);
    if (!t) return;
    const dmg = Math.max(1, Math.round(10 * (1 + this.run.stats.damagePct)));
    this.fx.beam(this.player.x, this.player.y, t.x, t.y, 0xff3858, 0.14);
    this.enemies.hit(t, dmg, false, 0, 0, 60);
  }

  private fireSeekingSparks(x: number, y: number, count: number, baseDamage: number): void {
    const dmg = Math.max(1, Math.round(baseDamage * (1 + this.run.stats.damagePct)));
    for (let k = 0; k < count; k++) {
      const target = this.enemies.nearest(x, y, MAX_SCREEN_RANGE);
      const ang = target ? Math.atan2(target.y - y, target.x - x) + (k - (count - 1) / 2) * 0.22 : Math.random() * Math.PI * 2;
      this.projectiles.fire({
        texture: 'sparkbolt',
        x,
        y,
        angle: ang,
        speed: 780,
        maxDist: MAX_SCREEN_RANGE,
        damage: dmg,
        crit: false,
        radius: 6,
        knockback: 80,
        pierce: 0,
        spin: 0,
        explode: 0,
        poison: null,
        cloud: null,
        src: null,
      });
    }
  }

  private onEnemyKilled(e: Enemy): void {
    const run = this.run;
    const def = e.def;
    if (def.id === 'tree') {
      this.pickups.dropHeal(e.x, e.y, 'fruit');
      const [min, max] = def.nectar;
      this.pickups.dropNectar(e.x, e.y, Phaser.Math.Between(min, max));
      const chestChance = Math.min(0.35, 0.15 * (1 + Math.max(0, run.stats.luck) / 150) * (1 + run.mods.chestBonus) * (1 + Math.max(0, run.stats.curse) * 0.02));
      if (Math.random() < chestChance) this.pickups.dropChest(e.x, e.y);
      else if (Math.random() < 0.14) this.pickups.dropFrenzy(e.x, e.y);
      return;
    }
    if (def.id === 'boomshroom') {
      // 爆裂毒菇被打爆：战术范围爆破 + 叠 2 层毒（对 Boss 伤害折减 60%）+ 45% 掉琥珀狂热露珠
      const r = 120;
      const baseDmg = Math.max(14, Math.round((16 + 5.5 * run.wave) * (1 + run.stats.damagePct)));
      this.fx.explosion(e.x, e.y, r, 0xff5a38, 2);
      this.fx.poisonBubbles(e.x, e.y, 5);
      this.triggerHitstop(0.03);
      shake(this, 120, 0.006);
      sfx.play('explode');
      const perStack = poisonPerStack(run.stats, run.mods);
      for (const o of this.enemies.grid.query(e.x, e.y, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
        if (!o.active || o === e) continue;
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        if (dx * dx + dy * dy > (r + o.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        const dmg = o.def.boss ? Math.max(10, Math.round(baseDmg * 0.4)) : baseDmg;
        this.enemies.applyPoison(o, 2, perStack, POISON_DURATION + run.mods.poisonDuration);
        this.enemies.hit(o, dmg, false, dx / d, dy / d, 180);
      }
      if (Math.random() < 0.45) this.pickups.dropFrenzy(e.x, e.y);
      return;
    }
    if (def.id === 'deworb') {
      // 露珠冰球被打爆：范围冰冻水浪（全冻住）+ 临时 7 秒潮湿水洼 + 掉落少量花蜜
      const r = 140;
      this.fx.ring(e.x, e.y, r, 0x7ce8ff);
      this.fx.iceShatter(e.x, e.y, 44, 12);
      this.arena.addTempPuddle(e.x, e.y, 112, 7);
      sfx.play('freeze');
      for (const o of this.enemies.grid.query(e.x, e.y, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
        if (!o.active || o === e || o.def.behavior === 'tree') continue;
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        if (dx * dx + dy * dy > (r + o.radius) ** 2) continue;
        this.enemies.applyFreeze(o, 3);
        o.wetTime = Math.max(o.wetTime, 3.5);
      }
      this.pickups.dropNectar(e.x, e.y, 3);
      return;
    }
    this.waveKillsById[def.id] = (this.waveKillsById[def.id] ?? 0) + 1;
    if (def.id === 'lootbug') {
      run.kills++;
    run.waveKills++;
    // 0.65 秒内连续击杀 ≥ 8 只敌人时触发连破反馈
    this.recentKills.push(this.elapsed);
    while (this.recentKills.length > 0 && this.elapsed - this.recentKills[0] > 0.65) this.recentKills.shift();
    if (this.recentKills.length >= 8 && this.streakCd <= 0) {
      bus.emit(EVT.KILL_STREAK, this.recentKills.length);
      this.streakCd = 2.6;
      this.recentKills.length = 0;
    }
      this.pickups.dropChest(e.x, e.y);
      this.pickups.dropHeal(e.x, e.y, 'fruit');
      const [min, max] = def.nectar;
      this.pickups.dropNectar(e.x, e.y, Phaser.Math.Between(min, max));
      this.fx.ring(e.x, e.y, 64, 0xffd038);
      this.fx.number(e.x, e.y - 26, '宝藏到手！', 'level');
      return;
    }

    run.kills++;
    run.waveKills++;
    // 0.65 秒内连续击杀 ≥ 8 只敌人时触发连破反馈
    this.recentKills.push(this.elapsed);
    while (this.recentKills.length > 0 && this.elapsed - this.recentKills[0] > 0.65) this.recentKills.shift();
    if (this.recentKills.length >= 8 && this.streakCd <= 0) {
      bus.emit(EVT.KILL_STREAK, this.recentKills.length);
      this.streakCd = 2.6;
      this.recentKills.length = 0;
    }
    this.fx.splat(e.x, e.y, SPLAT_COLOR[def.id] ?? 0x4a2028, e.radius);
    const [min, max] = def.nectar;
    const baseNectar = Phaser.Math.Between(min, max);
    this.pickups.dropNectar(e.x, e.y, baseNectar);
    // 紫火诅咒变异怪：额外双倍花蜜 + 海军 6 件套附加掉蜜 + 6% 概率直爆宝箱
    if (e.cursed) {
      this.pickups.dropNectar(e.x, e.y, Math.max(2, baseNectar) + run.mods.curseBonusNectar);
      this.fx.ring(e.x, e.y, 34, 0xc058ff);
      this.fx.burst(e.x, e.y, 0xe08cff, 5, 120, 0.75);
      if (Math.random() < 0.06) this.pickups.dropChest(e.x, e.y);
    }
    // 厄运紫蛞蝓（Sea Pig）：击杀永久为玩家 +1 诅咒，撬动高风险紫光怪刷钱生态
    if (def.id === 'curse_slug') {
      run.bonus.curse += 1;
      run.recomputeStats();
      this.fx.ring(e.x, e.y, 52, 0xc854ff);
      this.fx.number(e.x, e.y - 24, '诅咒 +1！', 'crit');
      if (Math.random() < 0.25) this.pickups.dropChest(e.x, e.y);
    }
    // 气囊虫提前打爆（膨胀期或爆裂派对词条）：连锁炸伤周围敌人！
    if (def.id === 'gasbag' && (e.state === 1 || run.hasMutator('boom_party')) && this.corpseDepth < 2) {
      this.corpseDepth++;
      const r = run.hasMutator('boom_party') ? 128 : 96;
      const bdmg = Math.max(12, Math.round(e.maxHp * (run.hasMutator('boom_party') ? 2.6 : 1.1)));
      this.fx.explosion(e.x, e.y, r, 0xff7858, 1);
      sfx.play('explode');
      for (const o of this.enemies.grid.query(e.x, e.y, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
        if (!o.active || o === e || o.def.behavior === 'tree') continue;
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        if (dx * dx + dy * dy > (r + o.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.enemies.hit(o, o.def.boss ? Math.round(bdmg * 0.35) : bdmg, false, dx / d, dy / d, 190);
      }
      this.corpseDepth--;
    }
    if (run.stats.curse > 0) {
      // 每点诅咒每杀额外 0.04 蜜（原 0.16，过度雪球）
      const cRaw = run.stats.curse * 0.04;
      const cExtra = Math.floor(cRaw) + (Math.random() < cRaw - Math.floor(cRaw) ? 1 : 0);
      if (cExtra > 0) this.pickups.dropNectar(e.x, e.y, cExtra);
    }
    if (def.elite) {
      this.pickups.dropChest(e.x, e.y);
    } else if (!def.boss) {
      const luck = Phaser.Math.Clamp(run.stats.luck, 0, 200);
      const chance = Math.min(CHEST_CHANCE_MAX * (1 + Math.max(0, run.stats.curse) * 0.02), CHEST_CHANCE * (1 + luck / 100) * (1 + run.mods.chestBonus) * (1 + Math.max(0, run.stats.curse) * 0.02));
      if (Math.random() < chance) this.pickups.dropChest(e.x, e.y);
      else if (Math.random() < FRUIT_CHANCE) this.pickups.dropHeal(e.x, e.y, 'fruit');
    }
    // 战利品袋：击杀时概率多掉 1 颗花蜜
    if (run.mods.killNectar > 0 && Math.random() < run.mods.killNectar) this.pickups.dropNectar(e.x, e.y, 1);
    // 猎手战利品（Hunting Trophy）：暴击击杀时 33% 概率直接获得 1 花蜜（叠加最高 100%）
    if (e.lastHitCrit && run.mods.critKillNectar > 0 && Math.random() < Math.min(1, run.mods.critKillNectar)) {
      this.addNectar(1);
      this.fx.burst(e.x, e.y, 0xffd44c, 4, 110, 0.75);
    }
    // 蜂巢碎片：击杀时概率回血
    const comb = run.itemCount('honeycomb');
    if (comb > 0 && Math.random() < 0.08 * comb) this.heal(2);
    // 腺体 6 件套：带毒敌人死后留下毒云
    if (run.mods.poisonNova > 0 && e.poison > 0) {
      this.hazards.addCloud(e.x, e.y, 62, 2.5, 2 + run.stats.toxin, poisonPerStack(run.stats, run.mods), POISON_DURATION + run.mods.poisonDuration);
    }
    // 爆裂腺体：击杀引发尸爆（限制连环深度防死循环）
    if (run.mods.corpseExplode > 0 && !def.boss && this.corpseDepth < 2) {
      this.corpseDepth++;
      const r = 75;
      const edmg = Math.max(1, Math.round((15 + 0.5 * run.maxHp) * run.mods.corpseExplode * (1 + run.stats.damagePct)));
      this.fx.explosion(e.x, e.y, r, 0xff6e38, 1);
      for (const o of this.enemies.grid.query(e.x, e.y, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
        if (!o.active) continue;
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        if (dx * dx + dy * dy > (r + o.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.enemies.hit(o, edmg, false, dx / d, dy / d, 140);
      }
      this.corpseDepth--;
    }
    if (def.boss) this.onBossKilled(e);
  }

  private onEnemyDamaged(e: Enemy, crit: boolean): void {
    const run = this.run;
    if (run.phase !== 'combat') return;
    if (run.hp < run.maxHp && Math.random() < run.stats.lifesteal) this.heal(1, 'lifesteal', e.x, e.y);
    // 黑寡妇丝：暴击时叠毒
    const silk = run.itemCount('widowsilk');
    if (crit && silk > 0) {
      this.enemies.applyPoison(e, 2 * silk, poisonPerStack(run.stats, run.mods), POISON_DURATION + run.mods.poisonDuration);
      this.fx.poisonBubbles(e.x, e.y, 2);
    }
  }

  /** 雷击残枝：每攻击 8 次，劈附近 3 个敌人 */
  private onPlayerAttack(): void {
    const run = this.run;
    if (run.itemCount('lightning') === 0) return;
    this.attackCount++;
    if (this.attackCount % 8 !== 0) return;
    const p = this.player;
    const near = this.enemies.active.filter((e) => e.age > SPAWN_POP && Math.hypot(e.x - p.x, e.y - p.y) < 450);
    Phaser.Utils.Array.Shuffle(near);
    const dmg = Math.round(30 * (1 + run.stats.damagePct));
    if (near.length > 0) sfx.play('lightning');
    for (const e of near.slice(0, 3)) {
      this.fx.bolt(e.x, e.y);
      this.enemies.hit(e, dmg, false, 0, 0, 0);
    }
  }

  /** 蘑菇圈：每 10 秒在脚下长一朵蘑菇；蜂巢药剂：低血时持续回血 */
  private updateItemTimers(dt: number): void {
    const run = this.run;
    // 纯血玻璃挑战：每 12 秒自动再生 1 层护盾（上限 3 层）
    if (run.hasMutator('glass_soul')) {
      this.glassShieldTimer -= dt;
      if (this.glassShieldTimer <= 0) {
        this.glassShieldTimer = 12;
        if (run.shield < 3) {
          run.shield++;
          this.fx.ring(this.player.x, this.player.y, 38, 0x9fd8ff);
          this.fx.number(this.player.x, this.player.y - 32, '+1 护盾', 'shield');
          sfx.play('shield');
        }
      }
    }
    const potion = run.itemCount('honeypotion');
    if (potion > 0 && run.mods.torture === 0 && !run.waveNoHeal && this.potionTime < POTION_TIME && run.hp < run.maxHp * POTION_THRESHOLD && !run.character.perks.lifestealOnly) {
      this.potionTime += dt;
      run.hp = Math.min(run.maxHp, run.hp + POTION_RATE * potion * (1 + run.mods.healingPct) * dt);
      if (Math.random() < dt * 4) this.fx.burst(this.player.x, this.player.y, 0xffd060, 2, 60, 0.6);
    }
    if (run.itemCount('fairyring') === 0) return;
    this.fairyTimer += dt;
    if (this.fairyTimer >= 10) {
      this.fairyTimer -= 10;
      const a = Math.random() * Math.PI * 2;
      this.pickups.dropHeal(this.player.x + Math.cos(a) * 50, this.player.y + Math.sin(a) * 50, 'mushroom');
    }
  }

  private performDash(): void {
    const run = this.run;
    if (run.phase !== 'combat' || this.scene.isPaused('Game') || this.coopHost?.p1Downed) return;
    const [ix, iy] = this.readInput();
    if (!this.player.tryDash(ix, iy, run.stats.speedPct, run.mods.dashCooldownPct, run.maxDashCharges)) return;
    this.dashHitSet.clear();
    this.dashFlameAcc = 0;
    const p = this.player;
    const ang = Math.atan2(p.dashDirY, p.dashDirX);
    const back = ang + Math.PI;
    this.fx.ring(p.x, p.y, 26, 0xb8f4ff);
    this.fx.streaks(p.x, p.y, back, 0xe8fbff, 7, 210, 0.88);
    sfx.play('dash');

    // 起手极限擦弹判定
    this.checkDashGraze();

    // 炽翼靴：起点留火迹
    if (run.mods.dashFlame > 0) {
      this.arena.addFlamePatch(p.x, p.y, Math.max(6, (8 + run.stats.elemental * 1.5) * (1 + run.stats.damagePct)));
    }

    // 13 角色专属冲刺起手特效
    const cid = run.character.id;
    const stats = run.stats;
    if (cid === 'bombardier') {
      this.hazards.addCloud(p.x, p.y, 72, 2.8, 3 + stats.toxin, poisonPerStack(stats, run.mods), POISON_DURATION + run.mods.poisonDuration);
    } else if (cid === 'ladybug') {
      this.pickups.pullNectarInRadius(p.x, p.y, 290);
      this.fx.ring(p.x, p.y, 120, 0xffd44c);
    } else if (cid === 'spider') {
      this.hazards.addWeb(p.x, p.y, 72, 3.8, Math.max(2, 3 + stats.toxin * 0.5), 0.45, 4);
    } else if (cid === 'antqueen') {
      const r = 125;
      this.fx.ring(p.x, p.y, r, 0xffe478);
      for (const e of this.enemies.grid.query(p.x, p.y, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
        if (!e.active || e.def.behavior === 'tree') continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy > (r + e.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.enemies.hit(e, Math.max(4, Math.round((8 + stats.melee) * (1 + stats.damagePct))), false, dx / d, dy / d, 300);
      }
      p.frenzyTime = Math.max(p.frenzyTime, 1.2);
    } else if (cid === 'cicada') {
      this.arena.addDecoy(p.x, p.y, Math.max(18, Math.round((24 + run.wave * 6) * (1 + stats.damagePct))));
    } else if (cid === 'caterpillar') {
      const dmg = Math.max(6, Math.round((8 + Math.max(0, stats.armor) * 2) * (1 + stats.damagePct)));
      for (let k = 0; k < 6; k++) {
        const a = ang + (k / 6) * Math.PI * 2;
        this.projectiles.fire({
          texture: 'stinger',
          x: p.x,
          y: p.y,
          angle: a,
          speed: 620,
          maxDist: 230,
          damage: dmg,
          crit: false,
          radius: 6,
          knockback: 110,
          pierce: 1,
          spin: 0,
          explode: 0,
          poison: null,
          cloud: null,
          src: null,
        });
      }
    } else if (cid === 'dungbeetle') {
      const dmg = Math.max(10, Math.round((14 + stats.melee + run.wave * 3) * (1 + stats.damagePct)));
      this.projectiles.fire({
        texture: 'dungball',
        x: p.x + p.dashDirX * 16,
        y: p.y + p.dashDirY * 16,
        angle: ang,
        speed: 420,
        maxDist: 280,
        damage: dmg,
        crit: false,
        radius: 11,
        knockback: 220,
        pierce: 99,
        spin: 10,
        explode: 0,
        poison: null,
        cloud: null,
        src: null,
        grow: 1.0,
      });
    } else if (cid === 'termite') {
      this.weapons.placeFreeMine(p.x, p.y);
    }
  }

  /** 冲刺过程中逐帧检测：极限擦弹闪避 + 独角仙霸体撞击 + 蚊子穿刺吸血 + 炽翼靴火迹 */
  private updateDashActive(dt: number): void {
    const p = this.player;
    const run = this.run;
    const stats = run.stats;
    if (!p.dashGrazed) this.checkDashGraze();

    if (run.mods.dashFlame > 0) {
      this.dashFlameAcc += dt;
      if (this.dashFlameAcc >= 0.065) {
        this.dashFlameAcc = 0;
        this.arena.addFlamePatch(p.x, p.y, Math.max(6, (8 + stats.elemental * 1.5) * (1 + stats.damagePct)));
      }
    }

    const cid = run.character.id;
    if (cid !== 'rhino' && cid !== 'mosquito') return;
    for (const e of this.enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS + 18, this.contactBuf).slice()) {
      if (!e.active || e.def.behavior === 'tree' || this.dashHitSet.has(e)) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = p.radius + e.radius + 14;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.dashHitSet.add(e);
      const d = Math.hypot(dx, dy) || 1;
      if (cid === 'rhino') {
        const dmg = Math.max(10, Math.round((14 + Math.max(0, stats.armor) * 2.5 + stats.melee) * (1 + stats.damagePct)));
        this.enemies.hit(e, dmg, false, dx / d, dy / d, 360);
        this.fx.ring(e.x, e.y, 30, 0xffc868);
      } else {
        const dmg = Math.max(6, Math.round((8 + run.wave * 2.5) * (1 + stats.damagePct)));
        this.enemies.hit(e, dmg, false, dx / d, dy / d, 90);
        this.heal(1, 'lifesteal', e.x, e.y);
      }
    }
  }

  /** 冲刺收尾特效：锹甲钳击震波、屁步甲尾毒云、螳螂必暴窗口、虎甲疾风、回旋羽翼齐射 */
  private onDashEnd(): void {
    const p = this.player;
    const run = this.run;
    const stats = run.stats;
    const cid = run.character.id;
    if (cid === 'stag') {
      const fxX = p.x + p.dashDirX * 36;
      const fxY = p.y + p.dashDirY * 36;
      const r = 92;
      const dmg = Math.max(8, Math.round((14 + stats.melee * 1.4) * (1 + stats.damagePct)));
      this.fx.ring(fxX, fxY, r, 0xffc858);
      for (const e of this.enemies.grid.query(fxX, fxY, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
        if (!e.active || e.def.behavior === 'tree') continue;
        const dx = e.x - fxX;
        const dy = e.y - fxY;
        if (dx * dx + dy * dy > (r + e.radius) ** 2) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.enemies.hit(e, dmg, false, dx / d, dy / d, 240);
      }
    } else if (cid === 'bombardier') {
      this.hazards.addCloud(p.x, p.y, 70, 2.8, 3 + stats.toxin, poisonPerStack(stats, run.mods), POISON_DURATION + run.mods.poisonDuration);
    } else if (cid === 'mantis') {
      p.mantisCritTime = 1.5;
      this.fx.number(p.x, p.y - 34, '必暴！', 'crit');
    } else if (cid === 'tiger') {
      p.hasteTime = Math.max(p.hasteTime, 0.9);
    }
    if (run.mods.dashVolley > 0) {
      const count = 4 + run.mods.dashVolley * 2;
      this.fireSeekingSparks(p.x, p.y, count, 12 + stats.ranged * 0.6 + stats.melee * 0.6);
    }
  }

  /** 极限擦弹闪避：冲刺掠过敌弹、冲锋怪或近身怪时触发高光奖励 */
  private checkDashGraze(): void {
    const p = this.player;
    let danger = false;
    const shotR2 = (p.radius + 38) ** 2;
    for (const s of this.shots.shots) {
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (dx * dx + dy * dy <= shotR2) {
        danger = true;
        break;
      }
    }
    if (!danger) {
      for (const e of this.enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS + 34, this.contactBuf)) {
        if (!e.active || e.damage <= 0 || e.age < SPAWN_POP) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = p.radius + e.radius + 30;
        if (dx * dx + dy * dy <= rr * rr) {
          danger = true;
          break;
        }
      }
    }
    if (!danger) return;
    p.dashGrazed = true;
    p.frenzyTime = Math.max(p.frenzyTime, 1.8);
    this.weapons.reduceCooldowns(0.5);
    this.pickups.dropNectar(p.x, p.y, 2);
    this.triggerHitstop(0.026);
    this.fx.ring(p.x, p.y, 56, 0x7ce8ff);
    this.fx.number(p.x, p.y - 38, '极限闪避！', 'level');
    sfx.play('frenzy');
  }

  /** 金露花抢点盛开：全屏震退虫群 + 掉落免费宝箱、花蜜与琥珀狂热 */
  private onBloomComplete(bx: number, by: number): void {
    const r = 240;
    this.fx.ring(bx, by, r, 0xffd84c);
    this.fx.explosion(bx, by, 130, 0xffe478, 2);
    shake(this, 160, 0.008);
    sfx.play('chest');
    for (const e of this.enemies.grid.query(bx, by, r + MAX_ENEMY_RADIUS, this.contactBuf).slice()) {
      if (!e.active || e.def.behavior === 'tree') continue;
      const dx = e.x - bx;
      const dy = e.y - by;
      if (dx * dx + dy * dy > (r + e.radius) ** 2) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.enemies.hit(e, Math.max(10, Math.round((18 + this.run.wave * 4) * (1 + this.run.stats.damagePct))), false, dx / d, dy / d, 380);
    }
    this.pickups.dropChest(bx, by);
    this.pickups.dropNectar(bx, by, 10);
    this.pickups.dropFrenzy(bx + 18, by);
    bus.emit(EVT.WAVE_EVENT, '★ 金露花盛开！免费宝箱 + 10 花蜜！', '#ffd44c');
  }

  /** 靠近战场四边 115px 内时浮现漫画虚线边界预警，防止走位风筝卡墙 */
  private drawBoundaryWarning(): void {
    const g = this.boundaryG;
    g.clear();
    if (this.run.phase !== 'combat') return;
    const p = this.player;
    const warnDist = 115;
    const m = WORLD_MARGIN - 8;
    const pulse = 0.72 + 0.28 * Math.sin(this.elapsed * 9);
    const drawEdge = (x0: number, y0: number, x1: number, y1: number, dist: number) => {
      if (dist >= warnDist) return;
      const a = Math.pow(1 - dist / warnDist, 1.4) * 0.85 * pulse;
      const segs = 14;
      g.lineStyle(4, 0x160608, a * 0.8);
      for (let i = 0; i < segs; i += 2) {
        const t0 = i / segs;
        const t1 = (i + 1.15) / segs;
        g.beginPath();
        g.moveTo(Phaser.Math.Linear(x0, x1, t0), Phaser.Math.Linear(y0, y1, t0));
        g.lineTo(Phaser.Math.Linear(x0, x1, Math.min(1, t1)), Phaser.Math.Linear(y0, y1, Math.min(1, t1)));
        g.strokePath();
      }
      g.lineStyle(2.2, 0xff5a48, a);
      for (let i = 0; i < segs; i += 2) {
        const t0 = i / segs;
        const t1 = (i + 1.15) / segs;
        g.beginPath();
        g.moveTo(Phaser.Math.Linear(x0, x1, t0), Phaser.Math.Linear(y0, y1, t0));
        g.lineTo(Phaser.Math.Linear(x0, x1, Math.min(1, t1)), Phaser.Math.Linear(y0, y1, Math.min(1, t1)));
        g.strokePath();
      }
    };
    const span = 210;
    drawEdge(m, Math.max(m, p.y - span), m, Math.min(WORLD_HEIGHT - m, p.y + span), p.x - m);
    drawEdge(WORLD_WIDTH - m, Math.max(m, p.y - span), WORLD_WIDTH - m, Math.min(WORLD_HEIGHT - m, p.y + span), WORLD_WIDTH - m - p.x);
    drawEdge(Math.max(m, p.x - span), m, Math.min(WORLD_WIDTH - m, p.x + span), m, p.y - m);
    drawEdge(Math.max(m, p.x - span), WORLD_HEIGHT - m, Math.min(WORLD_WIDTH - m, p.x + span), WORLD_HEIGHT - m, WORLD_HEIGHT - m - p.y);
  }

  private resolveManualAim(): { x: number; y: number } | null {
    const g = this.reticle;
    g.clear();
    if (IS_COARSE_POINTER || touchMove.active) return null;
    const ptr = this.input.activePointer;
    if (ptr.wasTouch) return null;
    const active = getSettings().manualAim || ptr.leftButtonDown();
    if (!active || (ptr.x === 0 && ptr.y === 0)) return null;
    this.cameras.main.getWorldPoint(ptr.x, ptr.y, this.aimWorld);
    const ax = Phaser.Math.Clamp(this.aimWorld.x, 12, WORLD_WIDTH - 12);
    const ay = Phaser.Math.Clamp(this.aimWorld.y, 12, WORLD_HEIGHT - 12);
    // 漫画风黑墨外轮廓准星（清晰不挡视线）
    g.lineStyle(3.4, 0x050507, 0.85);
    g.strokeCircle(ax, ay, 11);
    g.lineStyle(1.8, 0xffd44c, 0.95);
    g.strokeCircle(ax, ay, 11);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      g.lineStyle(3.2, 0x050507, 0.85);
      g.beginPath();
      g.moveTo(ax + dx * 6, ay + dy * 6);
      g.lineTo(ax + dx * 15, ay + dy * 15);
      g.strokePath();
      g.lineStyle(1.6, 0xfff8dc, 0.95);
      g.beginPath();
      g.moveTo(ax + dx * 6, ay + dy * 6);
      g.lineTo(ax + dx * 15, ay + dy * 15);
      g.strokePath();
    }
    return { x: ax, y: ay };
  }

  /** 统计屏幕外的高价值目标（宝藏虫、精英、Boss、掉落宝箱），供 HUD 边缘方向指示箭头使用 */
  private updateOffscreenMarkers(): void {
    const markers = this.run.offscreenMarkers;
    markers.length = 0;
    const view = this.cameras.main.worldView;
    const pad = 16;
    const isOff = (x: number, y: number) => x < view.left + pad || x > view.right - pad || y < view.top + pad || y > view.bottom - pad;
    for (const e of this.enemies.active) {
      if (!e.active) continue;
      if (e.def.boss) {
        if (isOff(e.x, e.y)) markers.push({ x: e.x, y: e.y, kind: 'boss' });
      } else if (e.def.elite) {
        if (isOff(e.x, e.y)) markers.push({ x: e.x, y: e.y, kind: 'elite' });
      } else if (e.def.behavior === 'lootbug') {
        if (isOff(e.x, e.y)) markers.push({ x: e.x, y: e.y, kind: 'lootbug' });
      }
    }
    this.pickups.forEachChest((x, y) => {
      if (isOff(x, y)) markers.push({ x, y, kind: 'chest' });
    });
    const bloom = this.arena.activeBloom;
    if (bloom && isOff(bloom.x, bloom.y)) {
      markers.push({ x: bloom.x, y: bloom.y, kind: 'bloom' });
    }
    if (this.coopHost) {
      const p2 = this.coopHost.player2;
      if (isOff(p2.x, p2.y)) {
        markers.push({ x: p2.x, y: p2.y, kind: this.coopHost.p2Downed ? 'ally_down' : 'ally' });
      }
    }
  }

  private trackBoss(): void {
    const run = this.run;
    if (!this.bossEnemy) {
      this.bossEnemy = this.enemies.active.find((e) => e.def.boss) ?? null;
      if (!this.bossEnemy) return;
      // 10 波短局主题挑战的最终 Boss 按第 10 波构筑强度适当缩减血量
      if (run.setup.challenge && !run.endless && run.wave <= 10) {
        this.bossEnemy.maxHp = Math.round(this.bossEnemy.maxHp * 0.44);
        this.bossEnemy.hp = this.bossEnemy.maxHp;
      }
      this.bossBaseDamage = this.bossEnemy.damage;
      this.bossBaseSkill = this.bossEnemy.skillDamage;
      this.bossEnraged = false;
    }
    const b = this.bossEnemy;
    // 最终 Boss 没有时间限制：60 秒后进入狂暴，伤害每秒 +3%，把僵局变成失败
    if (this.currentWaveDef(run.wave).duration === null && run.phase === 'combat') {
      const over = this.elapsed - 60;
      if (over > 0) {
        if (!this.bossEnraged) {
          this.bossEnraged = true;
          bus.emit(EVT.WAVE_EVENT, '☠ 巢穴之主狂暴：Boss 伤害持续提升！', '#ff6a5a');
        }
        const k = 1 + over * 0.03;
        b.damage = this.bossBaseDamage * k;
        b.skillDamage = this.bossBaseSkill * k;
      }
    }
    run.boss = { name: b.def.name, hp: Math.max(0, b.hp), maxHp: b.maxHp };
  }

  private onBossKilled(e: Enemy): void {
    const run = this.run;
    if (run.boss) run.boss.hp = 0;
    shake(this, 400, 0.012);
    if (this.currentWaveDef(run.wave).duration === null) {
      this.bossDown = true;
    } else {
      // 无尽模式里程碑 Boss：斩落掉落双宝箱 + 大量花蜜，波次继续计时
      this.bossEnemy = null;
      run.boss = null;
      this.pickups.dropChest(e.x - 18, e.y);
      this.pickups.dropChest(e.x + 18, e.y);
      this.pickups.dropNectar(e.x, e.y, 20);
      bus.emit(EVT.WAVE_EVENT, `★ 斩落${e.def.name}！双宝箱掉落！`, '#ffd44c');
    }
  }

  /** 花蜜同时是经验和货币 */
  private addNectar(n: number): void {
    this.weapons?.resetPickupCooldowns();
    const run = this.run;
    run.nectar += n;
    run.waveNectar += n;
    run.totalNectar += n;
    // 约 1.54 花蜜 = 1 经验：把 20 波的等级压回 35~50 级，避免 70+ 次属性升级
    const xpGain = n * 0.65 * (1 + run.mods.xpGainPct) * run.waveXpMult;
    if (run.addXp(xpGain) > 0) {
      this.fx.number(this.player.x, this.player.y - 44, '升级！', 'level');
      sfx.play('levelUp');
      bus.emit(EVT.LEVEL_UP, run.level);
    }
  }

  private addChests(n: number): void {
    this.run.chests += n;
    this.fx.number(this.player.x, this.player.y - 44, '宝箱！', 'level');
    sfx.play('chest');
  }

  private endWave(): void {
    const run = this.run;
    recordEnemyKillsBatch(this.waveKillsById);
    this.waveKillsById = {};
    run.phase = 'cleanup';
    run.waveTimeLeft = 0;
    this.phaseTimer = CLEANUP_TIME;
    this.spawner.clear();
    this.enemies.clearAll();
    this.projectiles.clear();
    this.shots.clear();
    this.hazards.clear();
    this.arena.clear();
    this.summons.clear();
    this.weapons.clearDevices();
    this.tel.clear();
    run.arenaHint = '';
    bus.emit(EVT.WAVE_CLEAR, run.wave);
    sfx.play('waveClear');
    this.coopHost?.onWaveEndCleanup();
  }

  private finishWave(): void {
    const run = this.run;
    const left = this.pickups.collectAll();
    let p2LeftNectar = 0;
    let p2LeftChests = 0;
    if (this.coopHost) {
      const p1N = Math.ceil(left.nectar / 2);
      p2LeftNectar = left.nectar - p1N;
      const p1C = Math.ceil(left.chests / 2);
      p2LeftChests = left.chests - p1C;
      if (p1N > 0) this.addNectar(p1N);
      if (p1C > 0) run.chests += p1C;
    } else {
      if (left.nectar > 0) this.addNectar(left.nectar);
      if (left.chests > 0) run.chests += left.chests;
    }

    // 兑现本波已完成的里程碑后院赌约奖励
    const doneContract = run.activeContract;
    run.activeContract = null;
    run.waveContractDamagePct = 0;
    run.waveNoHeal = false;
    run.waveNectarMult = 1;
    if (doneContract === 'elite_bounty') {
      run.chests += 1;
      run.nectar += 45;
      run.totalNectar += 45;
    } else if (doneContract === 'no_heal_vow') {
      run.bonus.maxHp += 10;
      run.bonus.armor += 3;
      run.recomputeStats();
    } else if (doneContract === 'swarm_harvest') {
      run.bonus.harvest += 10;
      run.recomputeStats();
    } else if (doneContract === 'glass_frenzy') {
      run.chests += 1;
    }

    // 采蜜：1~20 波每波自动成长；21+ 无尽模式每波衰减 20% 防无限经济滚雪球
    const harvest = Math.max(0, Math.round(run.stats.harvest));
    run.waveHarvest = harvest;
    if (harvest > 0) this.addNectar(harvest);
    if (run.endless) {
      if (run.stats.harvest > 0) {
        run.bonus.harvest -= Math.ceil(run.stats.harvest * 0.2);
        run.recomputeStats();
      }
    } else if (run.stats.harvest > 0 || run.mods.waveHarvest > 0) {
      run.bonus.harvest += Math.max(0, run.stats.harvest) * HARVEST_GROWTH + run.mods.waveHarvest;
      run.recomputeStats();
    }
    // 利息：存蜜树洞（每 20 给 1，最多 10）、瓢虫的被动（每 20 给 1，最多 10）
    let interest = 0;
    if (run.itemCount('treehole') > 0) interest += Math.min(10, Math.floor(run.nectar / 20));
    const perk = run.character.perks.interest;
    if (perk) interest += Math.min(perk.max, Math.floor(run.nectar / perk.per));
    run.waveInterest = interest;
    run.nectar += interest;
    if (run.wave >= run.maxWaves && !run.endless) {
      run.won = true;
      if (!run.victoryRecorded) {
        if (!run.setup.challenge) {
          run.newDifficultyUnlocked = recordRun(run.setup.character, run.setup.difficulty, true);
        }
        run.victoryRecorded = true;
      }
      this.checkUnlocks();
      run.phase = 'victory';
      bgm.setMode('shop');
      bus.emit(EVT.VICTORY);
      sfx.play('victory');
      clearActiveRun();
      if (run.setup.challenge) {
        this.time.delayedCall(1200, () => this.toResult(true));
      } else {
        this.coopHost?.notifyVictoryChoice();
        this.time.delayedCall(950, () => bus.emit(EVT.VICTORY_CHOICE));
      }
      return;
    }
    this.checkUnlocks();
    run.phase = 'intermission';
    bgm.setMode('shop');
    if (this.coopHost) {
      this.coopHost.onWaveEnterIntermission(p2LeftNectar, p2LeftChests);
    } else {
      saveActiveRun(run.serialize());
    }
    bus.emit(EVT.INTERMISSION);
    this.scene.launch('Intermission');
  }

  private die(): void {
    const run = this.run;
    if (run.phase === 'dead') return;
    this.hitstop = 0;
    recordEnemyKillsBatch(this.waveKillsById);
    this.waveKillsById = {};
    const p = this.player;
    run.phase = 'dead';
    run.hp = 0;
    clearActiveRun();
    this.spawner.clear();
    this.projectiles.clear();
    this.shots.clear();
    this.arena.clear();
    this.summons.clear();
    this.weapons.clearDevices();
    this.coopHost?.onBothDownedSync();
    this.fx.burst(p.x, p.y, 0xe8832a, 36, 280, 1.5);
    this.fx.burst(p.x, p.y, 0x4a2208, 18, 200, 1.2);
    p.view.setVisible(false);
    shake(this, 260, 0.012);
    sfx.play('death');
    bus.emit(EVT.PLAYER_DEAD);
    if (this.scene.isPaused('Game')) this.scene.resume('Game');
    this.time.delayedCall(1600, () => this.toResult(run.won));
  }

  /** 单局解锁条件：达成就立刻写存档，并在屏幕上提示 */
  private checkUnlocks(): void {
    for (const id of checkUnlocks(this.run)) {
      this.unlocked.push(id);
      bus.emit(EVT.UNLOCK, id);
      sfx.play('unlock');
    }
  }

  private toResult(win: boolean): void {
    const run = this.run;
    const { character, difficulty } = run.setup;
    clearActiveRun();
    bgm.setMode('menu');
    const newDifficulty = run.setup.challenge ? false : run.victoryRecorded ? run.newDifficultyUnlocked : recordRun(character, difficulty, win);
    const newEndlessRecord = run.endless ? recordEndlessWave(character, run.wave) : false;
    const newDailyBest = run.setup.daily ? recordDailyResult(run.setup.daily, run.wave, win) : false;
    const newChallengeCleared = run.setup.challenge && win ? recordChallengeCleared(run.setup.challenge) : false;
    const coopRes = this.coopHost ? this.coopHost.sendMatchResult(win) : null;
    const data: ResultData = {
      win,
      endless: run.endless,
      wave: run.wave,
      level: run.level,
      kills: run.kills,
      nectar: run.totalNectar,
      character,
      difficulty,
      weapon: run.setup.weapon,
      biome: run.biome.id,
      seed: run.seed,
      mutators: run.setup.mutators,
      seedTarget: run.setup.seedTarget,
      newDifficulty,
      newEndlessRecord,
      daily: run.setup.daily,
      newDailyBest,
      challenge: run.setup.challenge,
      newChallengeCleared,
      maxWaves: run.maxWaves,
      unlocked: this.unlocked,
      weapons: run.weapons.map((w) => ({ id: w.id, tier: w.tier, totalDamage: w.totalDamage ?? 0 })),
      sets: activeSets(run.weapons).map((s) => ({ cls: s.cls, count: s.count })),
      coopPartner: coopRes ? { roleLabel: 'P2 · 队友', ...coopRes.guest } : undefined,
    };
    this.scene.stop('UI');
    this.scene.start('Result', data);
  }
}
