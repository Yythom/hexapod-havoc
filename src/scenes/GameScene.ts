import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { CAMERA_ZOOM, DEPTH, RENDER_SCALE, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { bus, EVT, listen } from '../core/bus';
import { touchMove } from '../core/input';
import { RunState, type RunSetup } from '../core/RunState';
import { loadSave, recordRun } from '../core/save';
import { checkUnlocks } from '../core/unlocks';
import { damageTakenMultiplier, dodgeChance, moveSpeed, pickupRange, regenPerSecond } from '../core/stats';
import { WAVES } from '../data/waves';
import { Player } from '../entities/Player';
import { shake } from '../ui/camera';
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
  wave: number;
  level: number;
  kills: number;
  nectar: number;
  character: string;
  difficulty: number;
  /** 这局通关后解锁了下一档难度 */
  newDifficulty: boolean;
  /** 这局解锁的新角色 */
  unlocked: string[];
}

/** 波次结束后，等花蜜飞回来的时间 */
const CLEANUP_TIME = 0.9;
/** 受伤后的无敌时间 */
const INVULN_TIME = 0.5;
/** 普通怪掉宝箱的基础概率；幸运每 1 点相对提高 1%（最多 ×3），总概率不超过 1.2% */
const CHEST_CHANCE = 0.004;
const CHEST_CHANCE_MAX = 0.012;
/** 普通怪掉果实（回 3 血）的概率 */
const FRUIT_CHANCE = 0.02;
const HEAL_AMOUNT = 3;
/** 采蜜每过一波自动成长的比例 */
const HARVEST_GROWTH = 0.05;
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
  slime: 0x7a329a,
  minislime: 0x7a329a,
  gasbag: 0x8e2824,
  mantis: 0x467824,
};

export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private player!: Player;
  private fx!: Effects;
  private tel!: Telegraphs;
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
  /** 蘑菇圈计时、雷击残枝攻击计数 */
  private fairyTimer = 0;
  private attackCount = 0;
  /** 虎甲：静止了多久 */
  private idleTime = 0;
  /** 蜂巢药剂本波已经回复了多久 */
  private potionTime = 0;
  /** 本局新解锁的角色 */
  private unlocked: string[] = [];
  private readonly contactBuf: Enemy[] = [];
  private readonly touching: Enemy[] = [];

  constructor() {
    super('Game');
  }

  /** data：角色选择界面传来的开局设置；重新开始时不传，沿用上一局的设置 */
  create(data?: Partial<RunSetup>): void {
    const last = loadSave().last;
    const setup: RunSetup = data?.character
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
    touchMove.x = touchMove.y = 0;
    this.run = new RunState(setup);
    this.registry.set('run', this.run);

    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(DEPTH.ground);
    this.fx = new Effects(this);
    this.tel = new Telegraphs(this);
    this.enemies = new EnemyManager(this, this.fx, this.tel);
    this.resolver = new HitResolver(this.enemies);
    this.shots = new EnemyShots(this);
    this.hazards = new Hazards(this);
    this.summons = new Summons(this, this.fx, this.resolver);
    this.projectiles = new ProjectileManager(this, this.fx, this.hazards, this.resolver);
    this.pickups = new PickupManager(this);
    this.spawner = new SpawnSystem(this, this.enemies, this.fx);
    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, this.run.character.shell);
    this.weapons = new WeaponSystem(this.player, this.projectiles, this.enemies, this.hazards, this.summons, this.resolver, this.fx);

    const scene = this;
    const host: EnemyHost = {
      get px() {
        return scene.player.x;
      },
      get py() {
        return scene.player.y;
      },
      get pr() {
        return scene.player.radius;
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
      hurtPlayer: (d) => this.damagePlayer(d),
      shoot: (x, y, a, sp, d) => this.shots.fire(x, y, a, sp, d),
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
      heal: (n) => this.heal(n),
      dropBonusNectar: (x, y, n) => this.pickups.dropNectar(x, y, n),
      onWeaponKill: (def) => {
        if (def.kind === 'melee') this.run.meleeKills++;
      },
    };

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setZoom(CAMERA_ZOOM * RENDER_SCALE);
    cam.startFollow(this.player.view, false, 0.12, 0.12);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as MoveKeys;
    listen(this, EVT.NEXT_WAVE, () => this.startWave(this.run.wave + 1));

    this.startWave(1);
    this.scene.launch('UI');
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const run = this.run;

    if (run.phase === 'dead' || run.phase === 'victory') {
      this.enemies.update(dt);
      this.tel.update(dt);
      this.fx.update(dt);
      return;
    }
    if (run.phase === 'intermission') return;

    const stats = run.stats;
    const [ix, iy] = this.readInput();
    this.idleTime = Math.hypot(ix, iy) > 0.05 ? 0 : this.idleTime + dt;
    this.player.update(dt, ix, iy, moveSpeed(stats), run.shield > 0);
    this.enemies.update(dt);
    this.projectiles.update(dt, this.enemies, this.player.x, this.player.y);
    this.hazards.update(dt, this.enemies);
    this.tel.update(dt);

    if (run.phase === 'combat') {
      this.elapsed += dt;
      this.spawner.update(dt, this.elapsed, this.player.x, this.player.y);
      this.weapons.update(dt, {
        stats,
        mods: run.mods,
        damageMult: this.damageMult(),
        hpRatio: run.hp / run.maxHp,
        workers: run.workerCount,
        workerTier: run.workerTier,
        workerHp: 10 + 3 * (run.wave - 1),
      });
      run.maxSummons = Math.max(run.maxSummons, this.summons.aliveCount);
      this.shots.update(dt, this.player.x, this.player.y, this.player.radius, (d) => {
        if (this.damagePlayer(d)) this.player.slowTime = SILK_SLOW_TIME;
      });
      run.hp = Math.min(run.maxHp, run.hp + regenPerSecond(stats) * (1 + run.mods.healingPct) * dt);
      this.checkContact();
      this.updateItemTimers(dt);
      this.trackBoss();
      this.checkUnlocks();
    }

    const touch = run.character.perks.touchPickup;
    this.pickups.update(dt, this.player, touch ? this.player.radius + TOUCH_PICKUP : pickupRange(stats), run.phase === 'cleanup');
    if (this.pickups.gotNectar > 0) {
      // 蜣螂：亲自捡到的花蜜按倍率算，小数部分按概率进位（波次结束自动收走的不算）
      const mult = touch && run.phase === 'combat' ? touch.mult : 1;
      const raw = this.pickups.gotNectar * mult;
      this.addNectar(Math.floor(raw) + (Math.random() < raw - Math.floor(raw) ? 1 : 0));
      sfx.play('nectar');
    }
    if (this.pickups.gotChests > 0) this.addChests(this.pickups.gotChests);
    if (this.pickups.gotHeals > 0 && run.phase === 'combat') this.heal(HEAL_AMOUNT * this.pickups.gotHeals);
    this.fx.update(dt);

    if (run.phase === 'combat') {
      const duration = WAVES[run.wave - 1].duration;
      run.waveTimeLeft = duration === null ? Infinity : Math.max(0, duration - this.elapsed);
      if (run.hp <= 0) this.die();
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
    if (x !== 0 || y !== 0) {
      const l = Math.hypot(x, y);
      return [x / l, y / l];
    }
    return [touchMove.x, touchMove.y];
  }

  /** 本帧的伤害倍率：虎甲静止太久时减半 */
  private damageMult(): number {
    const idle = this.run.character.perks.idlePenalty;
    return idle && this.idleTime > idle.delay ? idle.mult : 1;
  }

  private startWave(n: number): void {
    const run = this.run;
    run.wave = n;
    run.phase = 'combat';
    // 古树年轮：每波开始最大生命永久 +2
    if (run.itemCount('treering') > 0) run.bonus.maxHp += 2;
    // 蝉：熬过前几波后，每波开始永久成长
    const bloom = run.character.perks.lateBloom;
    if (bloom && n > bloom.waves) {
      run.bonus.maxHp += bloom.maxHp;
      run.bonus.damagePct += bloom.damagePct;
    }
    run.recomputeStats();
    run.hp = run.maxHp;
    run.shield = run.itemCount('horncharm') > 0 ? 1 : 0;
    run.waveNectar = 0;
    run.waveHarvest = 0;
    run.waveInterest = 0;
    run.boss = null;
    const def = WAVES[n - 1];
    run.waveTimeLeft = def.duration ?? Infinity;
    this.elapsed = 0;
    this.fairyTimer = 0;
    this.potionTime = 0;
    this.idleTime = 0;
    this.bossEnemy = null;
    this.bossDown = false;
    this.player.invuln = 0;
    this.player.slowTime = 0;
    this.player.hasteTime = 0;
    this.weapons.sync(run.weapons, run.weaponSlots);
    this.spawner.startWave(def, n, run.difficulty);
    bus.emit(EVT.WAVE_START, n);
    sfx.play('waveStart');
  }

  private checkContact(): void {
    const p = this.player;
    if (p.invuln > 0) return;
    let dmg = 0;
    const touching = this.touching;
    touching.length = 0;
    for (const e of this.enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS, this.contactBuf)) {
      if (e.age < SPAWN_POP + 0.1 || e.frozen > 0) continue;
      const rr = p.radius + e.radius * 0.9;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy <= rr * rr) {
        dmg = Math.max(dmg, e.damage);
        touching.push(e);
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
    if (run.phase !== 'combat' || p.invuln > 0) return false;
    p.invuln = INVULN_TIME;
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
    const dmg = Math.max(1, Math.round(raw * damageTakenMultiplier(run.stats.armor)));
    run.hp -= dmg;
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
    return true;
  }

  /** 回血：吃治疗效果加成；蚊子只能靠吸取回血 */
  private heal(n: number, kind: 'lifesteal' | 'other' = 'other'): void {
    const run = this.run;
    if (kind === 'other' && run.character.perks.lifestealOnly) return;
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + n * (1 + run.mods.healingPct));
    const gained = run.hp - before;
    if (gained > 0) {
      if (kind === 'lifesteal') run.lifestealHealed += gained;
      this.fx.number(this.player.x, this.player.y - 28, `+${Math.max(1, Math.round(gained))}`, 'heal');
      if (n >= 2) sfx.play('heal');
    }
  }

  private onEnemyKilled(e: Enemy): void {
    const run = this.run;
    run.kills++;
    const def = e.def;
    this.fx.splat(e.x, e.y, SPLAT_COLOR[def.id] ?? 0x4a2028, e.radius);
    const [min, max] = def.nectar;
    this.pickups.dropNectar(e.x, e.y, Phaser.Math.Between(min, max));
    if (def.elite) {
      this.pickups.dropChest(e.x, e.y);
    } else if (!def.boss) {
      const luck = Phaser.Math.Clamp(run.stats.luck, 0, 200);
      const chance = Math.min(CHEST_CHANCE_MAX, CHEST_CHANCE * (1 + luck / 100) * (1 + run.mods.chestBonus));
      if (Math.random() < chance) this.pickups.dropChest(e.x, e.y);
      else if (Math.random() < FRUIT_CHANCE) this.pickups.dropHeal(e.x, e.y, 'fruit');
    }
    // 战利品袋：击杀时概率多掉 1 颗花蜜
    if (run.mods.killNectar > 0 && Math.random() < run.mods.killNectar) this.pickups.dropNectar(e.x, e.y, 1);
    // 蜂巢碎片：击杀时概率回血
    const comb = run.itemCount('honeycomb');
    if (comb > 0 && Math.random() < 0.05 * comb) this.heal(2);
    if (def.boss) this.onBossKilled();
  }

  private onEnemyDamaged(e: Enemy, crit: boolean): void {
    const run = this.run;
    if (run.phase !== 'combat') return;
    if (run.hp < run.maxHp && Math.random() < run.stats.lifesteal) this.heal(1, 'lifesteal');
    // 黑寡妇丝：暴击时叠毒
    const silk = run.itemCount('widowsilk');
    if (crit && silk > 0) {
      this.enemies.applyPoison(e, 2 * silk, poisonPerStack(run.stats, run.mods), POISON_DURATION + run.mods.poisonDuration);
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
    const potion = run.itemCount('honeypotion');
    if (potion > 0 && this.potionTime < POTION_TIME && run.hp < run.maxHp * POTION_THRESHOLD && !run.character.perks.lifestealOnly) {
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

  private trackBoss(): void {
    const run = this.run;
    if (!this.bossEnemy) {
      this.bossEnemy = this.enemies.active.find((e) => e.def.boss) ?? null;
      if (!this.bossEnemy) return;
    }
    const b = this.bossEnemy;
    run.boss = { name: b.def.name, hp: Math.max(0, b.hp), maxHp: b.maxHp };
  }

  private onBossKilled(): void {
    const run = this.run;
    if (run.boss) run.boss.hp = 0;
    shake(this, 400, 0.012);
    this.bossDown = true;
  }

  /** 花蜜同时是经验和货币 */
  private addNectar(n: number): void {
    const run = this.run;
    run.nectar += n;
    run.waveNectar += n;
    run.totalNectar += n;
    if (run.addXp(n) > 0) {
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
    run.phase = 'cleanup';
    run.waveTimeLeft = 0;
    this.phaseTimer = CLEANUP_TIME;
    this.spawner.clear();
    this.enemies.clearAll();
    this.projectiles.clear();
    this.shots.clear();
    this.hazards.clear();
    this.summons.clear();
    this.weapons.clearDevices();
    this.tel.clear();
    bus.emit(EVT.WAVE_CLEAR, run.wave);
    sfx.play('waveClear');
  }

  private finishWave(): void {
    const run = this.run;
    const left = this.pickups.collectAll();
    if (left.nectar > 0) this.addNectar(left.nectar);
    if (left.chests > 0) run.chests += left.chests;

    // 采蜜：每波结束直接给花蜜，然后采蜜值自动成长
    const harvest = Math.max(0, Math.round(run.stats.harvest));
    run.waveHarvest = harvest;
    if (harvest > 0) this.addNectar(harvest);
    if (run.stats.harvest > 0) {
      run.bonus.harvest += run.stats.harvest * HARVEST_GROWTH;
      run.recomputeStats();
    }
    // 利息：存蜜树洞（每 20 给 1，最多 10）、瓢虫的被动（每 25 给 1，最多 8）
    let interest = 0;
    if (run.itemCount('treehole') > 0) interest += Math.min(10, Math.floor(run.nectar / 20));
    const perk = run.character.perks.interest;
    if (perk) interest += Math.min(perk.max, Math.floor(run.nectar / perk.per));
    run.waveInterest = interest;
    run.nectar += interest;
    if (run.wave >= WAVES.length) run.won = true;
    this.checkUnlocks();

    if (run.wave >= WAVES.length) {
      run.phase = 'victory';
      bus.emit(EVT.VICTORY);
      sfx.play('victory');
      this.time.delayedCall(1400, () => this.toResult(true));
      return;
    }
    run.phase = 'intermission';
    bus.emit(EVT.INTERMISSION);
    this.scene.launch('Intermission');
  }

  private die(): void {
    const run = this.run;
    const p = this.player;
    run.phase = 'dead';
    run.hp = 0;
    this.spawner.clear();
    this.projectiles.clear();
    this.shots.clear();
    this.summons.clear();
    this.weapons.clearDevices();
    this.fx.burst(p.x, p.y, 0xe8832a, 36, 280, 1.5);
    this.fx.burst(p.x, p.y, 0x4a2208, 18, 200, 1.2);
    p.view.setVisible(false);
    shake(this, 260, 0.012);
    sfx.play('death');
    bus.emit(EVT.PLAYER_DEAD);
    this.time.delayedCall(1600, () => this.toResult(false));
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
    const newDifficulty = recordRun(character, difficulty, win);
    const data: ResultData = {
      win,
      wave: run.wave,
      level: run.level,
      kills: run.kills,
      nectar: run.totalNectar,
      character,
      difficulty,
      newDifficulty,
      unlocked: this.unlocked,
    };
    this.scene.stop('UI');
    this.scene.start('Result', data);
  }
}
