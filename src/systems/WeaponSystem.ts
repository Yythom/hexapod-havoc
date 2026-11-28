import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../config';
import { effectiveRange, MAX_SCREEN_RANGE, rollDamage, weaponDamage } from '../core/combat';
import { computeSlotBonus, type SlotBonus } from '../core/legSynergy';
import type { OwnedWeapon } from '../core/RunState';
import { attackInterval, type Stats } from '../core/stats';
import type { Mods } from '../data/items';
import { tierOf, WEAPONS, type WeaponDef } from '../data/weapons';
import { MAX_SLOTS } from '../entities/BeetleView';
import type { Player } from '../entities/Player';
import type { BashVariant, Effects } from './Effects';
import { MAX_ENEMY_RADIUS, SPAWN_POP, type Enemy, type EnemyManager } from './EnemyManager';
import type { Hazards } from './Hazards';
import type { HitResolver, HitSource } from './HitResolver';
import type { SnapSprite } from '../net/protocol';
import type { ProjectileManager } from './ProjectileManager';
import type { AphidGroup, MothGroup, Summons } from './Summons';

/** 近战一次刺击的最长时长（刺出 + 收回） */
const SWING_TIME = 0.24;
/** 横扫的时长 */
const SWEEP_TIME = 0.32;
/** 近战命中检测的采样间距，防止低帧率时漏判 */
const SWEEP_STEP = 12;
/** 中毒基础持续时间 */
export const POISON_DURATION = 3;
/** 蚁后工蚁用的虚拟槽位号 */
const WORKER_SLOT = 100;
/** 地雷：放下后多久才会被踩响、触发半径 */
const MINE_ARM = 0.5;
const MINE_TRIGGER = 14;
/** 炮台子弹 */
const TURRET_SHOT_SPEED = 680;

/** 武器每帧需要的玩家状态 */
export interface WeaponContext {
  stats: Stats;
  mods: Mods;
  /** 本帧伤害倍率（虎甲静止时 ×0.5） */
  damageMult: number;
  /** 当前生命比例（蜂蜜罐低血加攻速） */
  hpRatio: number;
  /** 当前空着的武器槽数量（Captain's Sword 这类武器吃空槽） */
  emptySlots: number;
  /** 玩家本帧是否在移动（Jousting Lance 站桩惩罚） */
  moving: boolean;
  /** 蚁后：工蚁数量和品质 */
  workers: number;
  workerTier: number;
  workerHp: number;
  /** 螳螂冲刺后近战必暴击 */
  mantisCrit?: boolean;
}

interface Slot {
  def: WeaponDef;
  tier: number;
  owned: OwnedWeapon;
  slotBonus: SlotBonus;
  src: HitSource;
  cd: number;
  /** 枪械 6 件套计数（每 4 次射击附加穿透弹） */
  gunShots: number;
  /** 炮台：距离下一次放置的时间 */
  placeCd: number;
  /** Railgun：距离下一次蓄力加伤的时间 */
  rampTimer: number;
  aim: number;
  /** 武器当前平滑渲染朝向（杜绝换目标或收招时瞬间 180° 瞬移乱甩） */
  visualAim: number;
  // 近战动作状态
  swing: number;
  swingTotal: number;
  reach: number;
  /** 本次出手锁定目标的真实距离，用于兵器刚好送到敌人身上（不打空气也不乱飞） */
  targetDist: number;
  /** 单武器命中“卡肉”微停顿计时（土豆兄弟式接触实感，不拖慢整局帧率） */
  hitPause: number;
  /** 土豆兄弟经典剑类交替模式（虫剑 / 王虫之剑 / 船长弯刀：横扫与直刺交替） */
  altThrust: boolean;
  /** 本次攻击对应的真实武器攻击范围上限（特效绝不越界） */
  maxRange: number;
  /** 本次挥击是否已触发过“命中目标时”的范围特效 */
  aoeFxFired: boolean;
  /** 横扫方向交替（1: 从 -arc 扫到 +arc，-1: 反向回扫，动作更连贯自然） */
  sweepDir: 1 | -1;
  lastExt: number;
  lastAng: number;
  damage: number;
  crit: boolean;
  hits: Enemy[];
}

/** 放在地上的机关：地雷、炮台。持续到本波结束。 */
interface Device {
  type: 'mine' | 'turret';
  slot: number;
  def: WeaponDef;
  tier: number;
  src: HitSource;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  age: number;
  cd: number;
}

/** 毒每层每秒伤害：1 + 毒素 × 0.2，再吃伤害% 和整体武器伤害修正 */
export function poisonPerStack(stats: Stats, mods?: Mods): number {
  return (1 + Math.max(0, stats.toxin) * 0.2) * Math.max(0.2, 1 + stats.damagePct) * Math.max(0, 1 + (mods?.weaponDamagePct ?? 0));
}

/**
 * 武器自动瞄准最近的敌人攻击：
 * 远程发射弹道、光束或链式闪电；近战从腿尖刺出或横扫；召唤类放蚜虫、飞蛾或蛛网；机关放地雷、炮台。
 */
export class WeaponSystem {
  /** 每次主动攻击（射击、近战出手）时调用，雷击残枝计数用 */
  onAttack: (() => void) | null = null;
  /** 放下一个机关时调用（白蚁解锁统计） */
  onDevicePlaced: (() => void) | null = null;
  /** 链式闪电命中点回调（供雨天水洼全域导电） */
  onLightningHit: ((x: number, y: number, damage: number) => void) | null = null;
  private slots: Slot[] = [];
  private devices: Device[] = [];
  private ctx!: WeaponContext;
  private readonly tip = new Phaser.Math.Vector2();
  private readonly buf: Enemy[] = [];
  private readonly workerSrc: HitSource = { def: WEAPONS.workers, owned: null, tier: 0 };

  constructor(
    private readonly player: Player,
    private readonly projectiles: ProjectileManager,
    private readonly enemies: EnemyManager,
    private readonly hazards: Hazards,
    private readonly summons: Summons,
    private readonly resolver: HitResolver,
    private readonly fx?: Effects,
  ) {}

  sync(owned: OwnedWeapon[], slotCount: number): void {
    const view = this.player.view;
    view.setSlotCount(slotCount);
    this.clearDevices();
    this.slots = owned.slice(0, slotCount).map((w, i) => {
      const def = WEAPONS[w.id];
      return {
        def,
        tier: w.tier,
        owned: w,
        slotBonus: computeSlotBonus(owned, i, slotCount),
        src: { def, owned: w, tier: w.tier },
        cd: 0.3 + i * 0.07,
        gunShots: 0,
        placeCd: 0.2 + i * 0.1,
        rampTimer: 5,
        aim: view.rotation + view.tipLocalAngle(i),
        visualAim: view.rotation + view.tipLocalAngle(i),
        swing: 0,
        swingTotal: SWING_TIME,
        reach: 0,
        targetDist: 0,
        hitPause: 0,
        altThrust: false,
        maxRange: 0,
        aoeFxFired: false,
        sweepDir: 1,
        lastExt: 0,
        lastAng: 0,
        damage: 0,
        crit: false,
        hits: [],
      };
    });
    for (let i = 0; i < MAX_SLOTS; i++) {
      const s = this.slots[i];
      const tether = s ? tetherKindOf(s.def) : null;
      const sizeBoost = !s
        ? 1
        : s.def.kind !== 'melee'
          ? 1.06
          : tether === 'pole'
            ? 1.38
            : tether
              ? 1.34
              : s.def.melee?.style === 'sweep' || s.def.melee?.style === 'bash'
                ? 1.46
                : 1.34;
      view.setWeapon(i, s ? s.def.icon : null, s?.tier ?? 0, false, sizeBoost);
      if (s?.def.id === 'circular-saw') {
        view.setWeaponSpin(i, 9);
      } else if (s?.def.kind === 'melee' && !tether) {
        // 手持近战武器以握柄/腕部为枢轴，出招时甲虫腿爪同步 IK 伸出握紧握柄，刀身完整触敌
        const compactGrip =
          s.def.id === 'spiky-shield' ||
          s.def.id === 'power-fist' ||
          s.def.id === 'cestus' ||
          s.def.id === 'fist' ||
          s.def.id === 'flaming-knuckles' ||
          s.def.id === 'hand' ||
          s.def.id === 'claw' ||
          s.def.id === 'scissors';
        view.setWeaponPivot(i, compactGrip ? 0.22 : 0.12);
      }
    }
  }

  /** 极限擦弹闪避：按比例缩减全部武器剩余冷却 */
  reduceCooldowns(ratio: number): void {
    const keep = Math.max(0, 1 - ratio);
    for (const s of this.slots) s.cd *= keep;
  }

  /** 白蚁冲刺：在指定位置放置一颗免费迷你爆破地雷 */
  placeFreeMine(x: number, y: number): void {
    const def = WEAPONS['landmines'] ?? WEAPONS['wrench'];
    if (!def) return;
    const sprite = this.player.view.scene.add.image(x, y, 'mine').setDepth(DEPTH.mound).setScale(0);
    this.devices.push({
      type: 'mine',
      slot: -1,
      def: { ...def, device: { type: 'mine', max: 9, radius: 78 } },
      tier: 1,
      src: { def, owned: null, tier: 1 },
      sprite,
      x,
      y,
      age: 0.25,
      cd: 0,
    });
    this.fx?.burst(x, y, 0xc8a464, 5, 90, 0.7);
    sfx.play('place');
    this.onDevicePlaced?.();
  }

  /** Blunderbuss：拾取花蜜时重置冷却 */
  resetPickupCooldowns(): void {
    for (const s of this.slots) if (s.def.special?.cooldownResetOnPickup) s.cd = 0;
  }

  /** 玩家受伤时清空 Railgun 的蓄力 */
  resetRamps(): void {
    for (const s of this.slots) if (s.owned) s.owned.ramp = 0;
  }

  /** War Hammer：攻击时重置炮台冷却 */
  private resetTurrets(): void {
    for (const d of this.devices) if (d.type === 'turret') d.cd = 0;
  }

  /** 波次结束：地上的机关全部消失 */
  clearDevices(): void {
    for (const d of this.devices) d.sprite.destroy();
    this.devices = [];
  }

  update(dt: number, ctx: WeaponContext): void {
    this.ctx = ctx;
    const { stats, mods } = ctx;
    const view = this.player.view;
    const aphidGroups: AphidGroup[] = [];
    const mothGroups: MothGroup[] = [];

    this.slots.forEach((s, i) => {
      s.cd = Math.max(0, s.cd - dt);
      const ramp = s.def.special?.rampingDamage;
      if (ramp && s.owned) {
        s.rampTimer -= dt;
        if (s.rampTimer <= 0) {
          s.rampTimer += 5;
          s.owned.ramp = (s.owned.ramp ?? 0) + ramp;
        }
      }
      const tip = view.tipWorld(i, this.tip);
      if (s.swing > 0) {
        this.updateSwing(s, i, tip.x, tip.y, dt, mods);
        return;
      }

      const summon = s.def.summon;
      if (summon?.type === 'aphid' || summon?.type === 'moth') {
        const count = (summon.counts?.[s.tier] ?? 2) + mods.summonCount;
        const damage = weaponDamage(s.def, s.tier, stats, mods, s.owned, ctx.damageMult) * (1 + mods.summonDamagePct);
        const t = tierOf(s.def, s.tier);
        const interval = attackInterval(t.cooldown, stats);
        const base = { slot: i, count, damage, crit: stats.critChance + t.critChance, critMultiplier: t.critMultiplier, knockback: t.knockback, interval };
        if (summon.type === 'aphid') aphidGroups.push({ ...base, texture: 'aphid' });
        else mothGroups.push({ ...base, src: s.src });
        this.idleAim(s, i, dt);
        return;
      }

      if (s.def.device) {
        this.updateDeviceSlot(s, i, dt);
        this.idleAim(s, i, dt);
        return;
      }

      const range = this.rangeOf(s.def, stats, s.tier, s.slotBonus);
      const target = this.enemies.nearest(tip.x, tip.y, range);
      const exactAim = target ? Math.atan2(target.y - tip.y, target.x - tip.x) : null;
      if (exactAim !== null) {
        // 平滑转向目标，防止左右两只怪等距时每帧 180° 疯狂来回抽搐
        s.aim = Phaser.Math.Angle.RotateTo(s.aim, exactAim, 16 * dt);
      } else {
        this.idleAim(s, i, dt);
      }

      let kick = 0;
      let recoilMag = 4.2;
      if (target && s.cd <= 0) {
        // 出手瞬间校准到真实目标角，确保命中精准但平时不抖动
        if (exactAim !== null) s.aim = exactAim;
        const interval = this.intervalOf(s);
        s.cd = interval;
        if (summon?.type === 'web') {
          this.placeWeb(s, target);
        } else if (s.def.melee) {
          const dist = Math.hypot(target.x - tip.x, target.y - tip.y);
          this.startSwing(s, dist, range, interval);
          // 刀刃 6 件套觉醒：挥击向前释放清晰的新月穿透剑气波（1:1 渲染真实斩击宽度）
          if (mods.bladeWave > 0 && s.def.classes.includes('Blade')) {
            this.projectiles.fire({
              texture: 'leafblade',
              x: tip.x,
              y: tip.y,
              angle: s.aim,
              speed: 580,
              maxDist: Math.min(MAX_SCREEN_RANGE, 260),
              damage: Math.max(2, Math.round(s.damage * 0.65)),
              crit: s.crit,
              radius: 22,
              knockback: 80,
              pierce: 4,
              spin: 0,
              explode: 0,
              poison: null,
              cloud: null,
              src: s.src,
              waveColor: s.crit ? 0xffe468 : 0x7eff78,
            });
          }
          this.onAttack?.();
          sfx.play('melee');
        } else if (s.def.beam) {
          this.fireBeam(s, tip.x, tip.y, target);
          this.onAttack?.();
          kick = 0.09;
          recoilMag = 3.2;
        } else if (s.def.chain) {
          this.fireChain(s, tip.x, tip.y, target);
          this.onAttack?.();
          kick = 0.11;
          recoilMag = 4.0;
        } else {
          this.fire(s, tip.x, tip.y, range, target);
          this.emitShotFx(s, tip.x, tip.y);
          this.onAttack?.();
          if (s.def.special?.turretResetOnAttack) this.resetTurrets();
          sfx.play(shotSound(s.def));
          const heavy = (s.def.projectile?.count ?? 1) >= 4 || (s.def.projectile?.explode ?? 0) > 0 || tierOf(s.def, s.tier).damage >= 16;
          kick = heavy ? 0.14 : 0.1;
          recoilMag = heavy ? 6.8 : 4.2;
        }
      }
      if (s.swing <= 0) {
        s.visualAim = Phaser.Math.Angle.RotateTo(s.visualAim, s.aim, 18 * dt);
        view.setWeaponAim(i, s.visualAim, kick, recoilMag);
      }
    });
    // 本帧武器姿态更新后立即刷新精灵、IK 伸展腿肢与连杆，视觉与命中判定 0 延迟对齐
    view.refreshWeapons();

    // 蚁后的工蚁：和蚜虫同一套逻辑
    if (ctx.workers > 0) {
      const def = this.workerSrc.def;
      aphidGroups.push({
        slot: WORKER_SLOT,
        texture: 'workerant',
        hp: ctx.workerHp,
        count: ctx.workers + mods.summonCount,
        damage: weaponDamage(def, ctx.workerTier, stats, mods, null, ctx.damageMult) * (1 + mods.summonDamagePct),
        crit: stats.critChance,
        critMultiplier: tierOf(def, ctx.workerTier).critMultiplier,
        knockback: tierOf(def, ctx.workerTier).knockback,
        interval: attackInterval(tierOf(def, ctx.workerTier).cooldown, stats),
      });
    }

    this.summons.update(dt, this.player.x, this.player.y, aphidGroups, mothGroups, this.enemies);
    this.updateDevices(dt);
  }

  private idleAim(s: Slot, i: number, dt: number): void {
    const view = this.player.view;
    s.aim = Phaser.Math.Angle.RotateTo(s.aim, view.rotation + view.tipLocalAngle(i), 6 * dt);
    s.visualAim = Phaser.Math.Angle.RotateTo(s.visualAim, s.aim, 14 * dt);
    view.setWeaponAim(i, s.visualAim);
  }

  private rangeOf(def: WeaponDef, stats: Stats, tier: number, slotBonus?: SlotBonus): number {
    return effectiveRange(def, stats, tier, slotBonus);
  }

  /** 攻击间隔：吃全局攻速 + 槽位位阶/相邻共鸣攻速 + 诅咒武器 +10% 攻速；蜂蜜罐低血再快 30% */
  private intervalOf(s: Slot): number {
    const extraAspd = s.slotBonus.attackSpeedPct + (s.owned.cursed ? 0.1 : 0);
    const effStats = extraAspd !== 0 ? { ...this.ctx.stats, attackSpeedPct: this.ctx.stats.attackSpeedPct + extraAspd } : this.ctx.stats;
    let interval = attackInterval(tierOf(s.def, s.tier).cooldown, effStats);
    if (s.def.lowHpHaste && this.ctx.hpRatio < 0.5) interval /= 1 + s.def.lowHpHaste;
    const growth = s.def.special?.growthAttackSpeed;
    if (growth && s.owned) interval /= 1 + Math.min(0.6, Math.floor((s.owned.kills ?? 0) / 12) * growth);
    return interval;
  }

  private roll(def: WeaponDef, tier: number, owned: OwnedWeapon | null, slotBonus?: SlotBonus | null) {
    const c = this.ctx;
    const copies = this.slots.filter((x) => x.def.id === def.id).length;
    const sp = def.special;
    const mult = c.damageMult * (sp?.stationaryPenalty && !c.moving ? 1 + sp.stationaryPenalty.damagePct : 1);
    const forceCrit = !!(c.mantisCrit && def.kind === 'melee');
    return rollDamage(def, tier, c.stats, c.mods, owned, mult, undefined, c.emptySlots, copies, slotBonus, forceCrit);
  }

  private fire(s: Slot, x: number, y: number, range: number, target: Enemy): void {
    const proj = s.def.projectile;
    if (!proj) return;
    const { stats, mods } = this.ctx;
    const tier = s.tier;
    const baseCount = proj.count ?? 1;
    let count = baseCount;
    let arc = proj.arc ?? 0;
    let pierce = proj.pierce;
    let explode = proj.explode ?? 0;
    const straight = !proj.lob && !proj.returning && !proj.roll;

    const ricochet = straight && mods.gunRicochet > 0 ? mods.gunRicochet : 0;
    pierce += ricochet;
    const bounce = proj.bounce
      ? { ...proj.bounce, times: proj.bounce.times + mods.bounces + ricochet }
      : ricochet > 0
        ? { times: ricochet, range: 140, falloff: 0.25 }
        : null;

    const poisonDuration = POISON_DURATION + mods.poisonDuration;
    const perStack = poisonPerStack(stats, mods);
    for (let k = 0; k < count; k++) {
      const { damage, crit } = this.roll(s.def, tier, s.owned, s.slotBonus);
      const offset = count > 1 ? -arc / 2 + (arc * k) / (count - 1) : 0;
      const lob = proj.lob;
      const solid = proj.returning || proj.roll;
      this.projectiles.fire({
        texture: proj.texture,
        x,
        y,
        angle: s.aim + offset + (Math.random() * 2 - 1) * proj.spread,
        speed: proj.speed,
        maxDist: lob ? Math.min(range, Math.hypot(target.x - x, target.y - y)) : Math.min(MAX_SCREEN_RANGE, solid ? range : range + 15),
        damage,
        crit,
        radius: proj.radius,
        knockback: tierOf(s.def, tier).knockback * (1 + s.slotBonus.knockbackPct),
        pierce,
        spin: proj.spin,
        explode: Math.round(explode * (1 + mods.explodeRadiusPct)),
        poison: proj.poison ? { stacks: proj.poison, perStack, duration: poisonDuration } : null,
        cloud: lob ? { radius: lob.cloudRadius, time: lob.cloudTime, damage: damage * 0.5, perStack, duration: poisonDuration } : null,
        src: s.src,
        trips: proj.returning ? 1 + mods.bounces : 0,
        bounce,
        grow: proj.roll?.grow ?? 0,
        fade: !!proj.fade,
        split: straight && mods.splitShots > 0,
      });
    }
    // 枪械 6 件套觉醒：每 4 次射击额外发射 1 枚高速穿透弹
    if (mods.gunVolley > 0 && s.def.classes.includes('Gun')) {
      s.gunShots++;
      if (s.gunShots >= 4) {
        s.gunShots = 0;
        const { damage, crit } = this.roll(s.def, tier, s.owned, s.slotBonus);
        this.projectiles.fire({
          texture: 'heavybullet',
          x,
          y,
          angle: s.aim,
          speed: Math.max(760, proj.speed * 1.15),
          maxDist: Math.min(MAX_SCREEN_RANGE, range + 35),
          damage: Math.max(2, Math.round(damage * 1.2)),
          crit,
          radius: 7,
          knockback: tierOf(s.def, tier).knockback * 1.2,
          pierce: 3,
          spin: 0,
          explode: 0,
          poison: null,
          cloud: null,
          src: s.src,
        });
      }
    }
  }

  /** 光束：直接结算到最近的怪（稀有/传说额外分叉照射旁边目标） */
  private fireBeam(s: Slot, x: number, y: number, target: Enemy): void {
    const extra = 0;
    const hit: Enemy[] = [];
    let cur: Enemy | null = target;
    for (let k = 0; k <= extra && cur; k++) {
      const { damage, crit } = this.roll(s.def, s.tier, s.owned);
      this.fx?.beam(x, y, cur.x, cur.y, crit ? 0xffe880 : 0xffb040, s.cd + 0.05, s.tier);
      const d = Math.hypot(cur.x - x, cur.y - y) || 1;
      this.resolver.hit(cur, k === 0 ? damage : Math.max(1, Math.round(damage * 0.7)), crit, (cur.x - x) / d, (cur.y - y) / d, tierOf(s.def, s.tier).knockback, s.src);
      hit.push(cur);
      cur = extra > 0 ? this.nearestExcept(cur.x, cur.y, 160, hit) : null;
    }
    sfx.play('beam');
  }

  /** 链式闪电：打中第一只后跳向附近最近、还没打过的怪 */
  private fireChain(s: Slot, x: number, y: number, target: Enemy): void {
    const spec = s.def.chain!;
    const mods = this.ctx.mods;
    const jumps = spec.jumps + mods.chainJumps;
    const falloff = mods.chainNoFalloff > 0 ? 0 : spec.falloff;
    const first = this.roll(s.def, s.tier, s.owned);
    let dmg = first.damage;
    const hit: Enemy[] = [];
    const pts = [x, y];
    let cur: Enemy | null = target;
    let fromX = x;
    let fromY = y;
    for (let j = 0; j <= jumps && cur; j++) {
      const cx = cur.x;
      const cy = cur.y;
      pts.push(cx, cy);
      hit.push(cur);
      const d = Math.hypot(cx - fromX, cy - fromY) || 1;
      const amount = Math.max(1, Math.round(dmg));
      this.resolver.hit(cur, amount, first.crit, (cx - fromX) / d, (cy - fromY) / d, tierOf(s.def, s.tier).knockback, s.src);
      if (j === 0) this.onLightningHit?.(cx, cy, amount);
      this.fx?.star(cx, cy, 15, 0x8ce2ff);
      this.fx?.streaks(cx, cy, Math.atan2(cy - fromY, cx - fromX), 0x8ce2ff, 3, 180, 0.7);
      // 避雷针：每跳一次有概率再劈一道落雷
      if (mods.chainBolt > 0 && Math.random() < mods.chainBolt) {
        this.fx?.bolt(cx, cy);
        sfx.play('lightning');
        if (cur.active) this.resolver.hit(cur, amount, false, 0, 0, 0, s.src);
      }
      dmg *= 1 - falloff;
      fromX = cx;
      fromY = cy;
      cur = this.nearestExcept(cx, cy, spec.range, hit);
    }
    this.fx?.zap(pts, s.tier);
    sfx.play('zap');
  }

  private nearestExcept(x: number, y: number, range: number, skip: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies.grid.query(x, y, range + MAX_ENEMY_RADIUS, this.buf)) {
      if (!e.active || e.age < SPAWN_POP || skip.includes(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < range + e.radius && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private placeWeb(s: Slot, target: Enemy): void {
    const { stats, mods, damageMult } = this.ctx;
    const spec = s.def.summon!;
    const dmg = weaponDamage(s.def, s.tier, stats, mods, s.owned, damageMult) * (1 + mods.summonDamagePct);
    this.hazards.addWeb(target.x, target.y, 56, spec.duration ?? 8, dmg * 0.5, spec.slow ?? 0.4, spec.max ?? 3);
  }

  // ---------- 机关 ----------

  /** 地雷每个间隔在脚下埋一颗；炮台每隔几秒放一座。超出上限时替换最早的那个。 */
  private updateDeviceSlot(s: Slot, i: number, dt: number): void {
    const spec = s.def.device!;
    if (spec.type === 'mine') {
      if (s.cd > 0) return;
      s.cd = tierOf(s.def, s.tier).cooldown;
    } else {
      s.placeCd -= dt;
      if (s.placeCd > 0) return;
      s.placeCd = spec.placeEvery ?? 5;
    }
    const max = spec.max + this.ctx.mods.deployCap;
    const mine = this.devices.filter((d) => d.slot === i);
    if (mine.length >= max) this.removeDevice(this.devices.indexOf(mine[0]));
    const p = this.player;
    const sprite = this.player.view.scene.add
      .image(p.x, p.y, spec.type === 'mine' ? 'mine' : 'turret')
      .setDepth(spec.type === 'mine' ? DEPTH.mound : DEPTH.player - 2)
      .setScale(0);
    this.devices.push({ type: spec.type, slot: i, def: s.def, tier: s.tier, src: s.src, sprite, x: p.x, y: p.y, age: 0, cd: 0.4 });
    this.fx?.burst(p.x, p.y, 0x9a7a4a, 5, 90, 0.7);
    sfx.play('place');
    this.onDevicePlaced?.();
  }

  private updateDevices(dt: number): void {
    const mods = this.ctx.mods;
    for (let i = this.devices.length - 1; i >= 0; i--) {
      const d = this.devices[i];
      d.age += dt;
      const pop = Math.min(1, d.age / 0.18);
      const base = Phaser.Math.Easing.Back.Out(pop) / SPRITE_RES;
      if (d.type === 'mine') {
        // 还没上膛时半透明，上膛后轻轻闪烁
        const armed = d.age >= MINE_ARM;
        d.sprite.setScale(base).setAlpha(armed ? 0.85 + 0.15 * Math.sin(d.age * 6) : 0.55);
        if (!armed) continue;
        if (this.mineTriggered(d)) {
          this.explodeMine(d, (d.def.device!.radius ?? 70) * (1 + mods.mineRadiusPct + mods.explodeRadiusPct));
          this.removeDevice(i);
        }
        continue;
      }
      d.sprite.setScale(base);
      d.cd -= dt;
      if (d.cd > 0) continue;
      const target = this.enemies.nearest(d.x, d.y, d.def.range);
      if (!target) continue;
      d.cd = tierOf(d.def, d.tier).cooldown / Math.max(0.2, 1 + mods.turretSpeedPct);
      const a = Math.atan2(target.y - d.y, target.x - d.x);
      d.sprite.setRotation(a);
      const { damage, crit } = this.roll(d.def, d.tier, null);
      const mx = d.x + Math.cos(a) * 14;
      const my = d.y + Math.sin(a) * 14;
      const prismRoll = mods.turretPrism > 0 ? Math.random() : 1;
      const isLaser = prismRoll < 0.18;
      const isFrost = prismRoll >= 0.18 && prismRoll < 0.35;
      this.projectiles.fire({
        texture: isLaser ? 'laserbolt' : isFrost ? 'frostshot' : 'turretshot',
        x: mx,
        y: my,
        angle: a,
        speed: isLaser ? 1020 : TURRET_SHOT_SPEED,
        maxDist: Math.min(MAX_SCREEN_RANGE, d.def.range + 40),
        damage,
        crit,
        radius: isLaser || isFrost ? 6 : 5,
        knockback: tierOf(d.def, d.tier).knockback,
        pierce: isLaser ? 2 : 0,
        spin: 0,
        explode: 0,
        poison: null,
        cloud: null,
        src: isFrost
          ? {
              def: { ...d.def, onHit: { ...d.def.onHit, freeze: 1 } },
              owned: null,
              tier: d.tier,
            }
          : d.src,
      });
      sfx.play(isLaser ? 'zap' : 'shoot');
    }
  }

  private mineTriggered(d: Device): boolean {
    for (const e of this.enemies.grid.query(d.x, d.y, MINE_TRIGGER + MAX_ENEMY_RADIUS, this.buf)) {
      if (!e.active || e.age < SPAWN_POP) continue;
      const rr = MINE_TRIGGER + e.radius;
      const dx = e.x - d.x;
      const dy = e.y - d.y;
      if (dx * dx + dy * dy <= rr * rr) return true;
    }
    return false;
  }

  private explodeMine(d: Device, r: number): void {
    const { damage, crit } = this.roll(d.def, d.tier, null);
    this.fx?.explosion(d.x, d.y, r, 0xff9840, d.tier);
    sfx.play('explode');
    for (const e of this.enemies.grid.query(d.x, d.y, r + MAX_ENEMY_RADIUS, this.buf).slice()) {
      const dx = e.x - d.x;
      const dy = e.y - d.y;
      const rr = r + e.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const dist = Math.hypot(dx, dy) || 1;
      this.resolver.hit(e, damage, crit, dx / dist, dy / dist, tierOf(d.def, d.tier).knockback, d.src);
    }
  }

  private removeDevice(i: number): void {
    if (i < 0) return;
    this.devices[i].sprite.destroy();
    this.devices.splice(i, 1);
  }

  // ---------- 近战 ----------

  private startSwing(s: Slot, dist: number, range: number, interval: number): void {
    const { damage, crit } = this.roll(s.def, s.tier, s.owned, s.slotBonus);
    const style = s.def.melee!.style;
    const isAltSword = s.def.id === 'sword' || s.def.id === 'excalibur' || s.def.id === 'captains-sword';
    if (isAltSword) s.altThrust = !s.altThrust;
    else s.altThrust = false;
    const sweep = style === 'sweep' && !s.altThrust;
    s.damage = damage;
    s.crit = crit;
    s.maxRange = range;
    s.targetDist = dist;
    s.hitPause = 0;
    s.aoeFxFired = false;
    s.sweepDir = s.sweepDir === 1 ? -1 : 1;
    s.reach = Math.min(MAX_SCREEN_RANGE, sweep || style === 'bash' ? range : Phaser.Math.Clamp(dist, 28, range));
    s.swingTotal = Math.min(sweep ? SWEEP_TIME : style === 'flurry' ? SWING_TIME * 0.65 : SWING_TIME, interval * 0.8);
    s.swing = s.swingTotal;
    s.lastExt = 0;
    const extraArc = sweep && !tetherKindOf(s.def) ? 0.28 : 0;
    s.lastAng = s.aim - ((s.def.melee!.arc ?? 0) + extraArc) * s.sweepDir;
    s.hits.length = 0;
  }

  /** 近战各形态的真实物理碰撞宽度：严格贴合刀身/锤头实际宽度，绝不出现“刀没碰到人却把旁边空气打死” */
  private meleeHitRadius(melee: NonNullable<WeaponDef['melee']>, tier: number): number {
    switch (melee.style) {
      case 'thrust':
      case 'flurry':
      case 'pierce':
        return Math.min(11, melee.hitRadius * 0.48 * (1 + 0.08 * tier));
      case 'snap':
        return Math.min(12, melee.hitRadius * 0.56 * (1 + 0.08 * tier));
      case 'charge':
        return Math.min(14, melee.hitRadius * 0.64 * (1 + 0.08 * tier));
      case 'bash':
        return Math.min(18, melee.hitRadius * 0.78 * (1 + 0.08 * tier));
      default:
        return Math.min(14, melee.hitRadius * 0.68 * (1 + 0.08 * tier));
    }
  }

  private emitShotFx(s: Slot, tx: number, ty: number): void {
    const fx = this.fx;
    if (!fx) return;
    const proj = s.def.projectile;
    // 单体远程射击不播枪口闪光/烟雾特效；仅枪械保留极简物理抛壳
    if (s.def.classes.includes('Gun') && !proj?.fade) {
      const ejectSide = Math.cos(s.aim) < 0 ? 1 : -1;
      fx.shellCasing(tx, ty, s.aim + ejectSide * (Math.PI * 0.56));
    }
  }

  private updateSwing(s: Slot, slot: number, tipX: number, tipY: number, dt: number, mods: Mods): void {
    const view = this.player.view;
    const melee = s.def.melee!;
    const kb = tierOf(s.def, s.tier).knockback * (1 + mods.meleeKnockbackPct + s.slotBonus.knockbackPct);
    // 单武器命中卡肉微停顿：让刀锋/锤头/拳面在敌人身上短暂停驻 25~40ms，打击确认感与土豆兄弟一致
    if (s.hitPause > 0) {
      s.hitPause = Math.max(0, s.hitPause - dt);
      return;
    }
    s.swing = Math.max(0, s.swing - dt);
    const t = 1 - s.swing / s.swingTotal;
    const hitR = this.meleeHitRadius(melee, s.tier);
    // 出招前极短回拉蓄力（连刺 flurry 保持极速不蓄力）
    const windup = melee.style === 'flurry' ? 0 : Math.min(0.13, 0.03 / Math.max(0.08, s.swingTotal));

    if (melee.style === 'sweep' && !s.altThrust) {
      const arc = melee.arc ?? 1;
      const dir = s.sweepDir;
      const tetherKind = tetherKindOf(s.def);
      const isSaw = s.def.id === 'circular-saw';
      const isPruner = s.def.id === 'pruner';
      if (isSaw) view.setWeaponSpin(slot, 38);

      if (tetherKind) {
        // 有绳/链/长柄/四节棍连结的横扫：视觉连杆长度 === 实际判定长度，1:1 实体触碰命中
        const isPole = tetherKind === 'pole';
        const headFwd = tetherKind === 'whip' || tetherKind === 'sections' ? 0 : view.weaponForwardWorld(slot);
        const maxVisExt = isPole
          ? Phaser.Math.Clamp(s.targetDist - headFwd * 0.55, 24, Math.max(28, s.reach - headFwd))
          : Phaser.Math.Clamp(s.targetDist, 38, Math.max(44, s.reach - headFwd * 0.35));
        if (t < windup) {
          const wk = t / windup;
          const ang = s.aim - (arc + 0.16 * wk) * dir;
          s.visualAim = ang;
          view.setWeaponAim(slot, ang, 0, 0, s.aim);
          view.setWeaponExtend(slot, isPole ? (maxVisExt * (0.75 - 0.12 * wk)) / view.scaleX : (-3 * wk) / view.scaleX);
          view.setWeaponMotion(slot, null);
          if (tetherKind === 'whip' || tetherKind === 'sections') {
            view.setWeaponTether(slot, { kind: tetherKind, st: 0, dir, ext: 14 / view.scaleX, localAngle: ang - view.rotation, arc });
          } else if (isPole) {
            view.setWeaponTether(slot, { kind: 'pole', st: 0, dir, ext: (maxVisExt * 0.75) / view.scaleX, localAngle: ang - view.rotation, arc });
          } else {
            view.setWeaponTether(slot, null);
          }
        } else {
          const st = (t - windup) / (1 - windup);
          const ang = s.aim + (-arc + 2 * arc * Phaser.Math.Easing.Sine.InOut(st)) * dir;
          const env = Math.min(1, st / 0.15, (1 - st) / 0.18);
          const visExt = isPole ? maxVisExt * (0.82 + 0.18 * Math.sin(st * Math.PI)) : maxVisExt * env;
          const tipDist = visExt + headFwd;
          s.visualAim = ang;
          view.setWeaponAim(slot, ang, 0, 0, s.aim);
          view.setWeaponExtend(slot, tetherKind === 'whip' || tetherKind === 'sections' ? 0 : visExt / view.scaleX);
          view.setWeaponTether(slot, {
            kind: tetherKind,
            st,
            dir,
            ext: visExt / view.scaleX,
            localAngle: ang - view.rotation,
            arc,
          });
          if (st < 0.85) {
            const steps = Math.max(1, Math.ceil(Math.abs(ang - s.lastAng) / 0.12));
            for (let k = 1; k <= steps; k++) {
              const a = s.lastAng + ((ang - s.lastAng) * k) / steps;
              for (const f of [0.55, 0.96]) {
                this.strikeAt(s, tipX, tipY, tipX + Math.cos(a) * tipDist * f, tipY + Math.sin(a) * tipDist * f, hitR, kb, a + Math.PI * 0.5 * dir, tipDist);
              }
            }
          }
          s.lastAng = ang;
        }
      } else {
        // 土豆兄弟式弧形横扫：蓄力拉刀 → 爆发扫过完整弧面直切敌人 → 平滑收刀归位，1:1 实体刀身判定
        const slashArc = arc + 0.28;
        const wind = Math.max(windup, 0.14);
        const baseFwd = view.weaponForwardWorld(slot);
        const maxSweepExt = Phaser.Math.Clamp(s.targetDist - baseFwd * 0.62, 16, isSaw ? 46 : 42);
        if (t < wind) {
          const wk = Phaser.Math.Easing.Quadratic.Out(t / wind);
          const ang = s.aim - (slashArc + 0.16 * wk) * dir;
          s.visualAim = ang;
          view.setWeaponAim(slot, ang, 0, 0, s.aim);
          view.setWeaponExtend(slot, (-4 * wk) / view.scaleX);
          view.setWeaponMotion(slot, { scaleX: 1 - 0.05 * wk, scaleY: 1 + 0.05 * wk });
        } else {
          const st = (t - wind) / (1 - wind);
          // 前 62% 爆发弧扫命中，后 38% 平滑收回稳态武器环
          const activePhase = Math.min(1, st / 0.62);
          const swingEase = Phaser.Math.Easing.Cubic.InOut(activePhase);
          const ang = s.aim + (-slashArc + 2 * slashArc * swingEase) * dir;
          let armExt: number;
          if (st < 0.62) {
            const k = st / 0.62;
            armExt = maxSweepExt * Math.sin(Math.min(1, k * 1.15) * (Math.PI * 0.5));
          } else {
            const rk = (st - 0.62) / 0.38;
            armExt = maxSweepExt * (1 - Phaser.Math.Easing.Quadratic.InOut(rk));
          }
          s.visualAim = ang;
          view.setWeaponAim(slot, ang, 0, 0, s.aim);
          view.setWeaponExtend(slot, armExt / view.scaleX);

          const peakVel = activePhase < 1 ? Math.sin(activePhase * Math.PI) : 0;
          const sxMult = isPruner ? 1 + 0.14 * peakVel : 1 + 0.18 * peakVel;
          if (isPruner) {
            const snap = Math.exp(-Math.pow((activePhase - 0.5) / 0.16, 2));
            view.setWeaponMotion(slot, { scaleX: sxMult, scaleY: 1 - 0.34 * snap });
          } else {
            view.setWeaponMotion(slot, { scaleX: sxMult, scaleY: 1 + 0.06 * peakVel });
          }

          // 仅在主动挥砍帧检测，且 1:1 严格对齐此刻肉眼可见的刀身位置
          if (st < 0.62) {
            const bladeFwd = view.weaponForwardWorld(slot, sxMult);
            const steps = Math.max(1, Math.ceil(Math.abs(ang - s.lastAng) / 0.12));
            for (let k = 1; k <= steps; k++) {
              const a = s.lastAng + ((ang - s.lastAng) * k) / steps;
              for (const d of [armExt + bladeFwd * 0.35, armExt + bladeFwd * 0.92]) {
                this.strikeAt(s, tipX, tipY, tipX + Math.cos(a) * d, tipY + Math.sin(a) * d, hitR, kb, a + Math.PI * 0.5 * dir, d);
              }
            }
          }
          s.lastAng = ang;
        }
      }
    } else if (melee.style === 'bash') {
      // 重锤高举狠砸 / 盾牌重撞：快出 → 砸地短停 → 稳收；判定与纯地裂 1:1 落在真实锤头砸点
      const isPushBash = s.def.id === 'spiky-shield' || s.def.id === 'power-fist' || s.def.id === 'cestus';
      const facingFlip = Math.cos(s.aim) < 0 ? -1 : 1;
      const baseFwd = view.weaponForwardWorld(slot);
      const maxArmExt = Phaser.Math.Clamp(s.targetDist - baseFwd * 0.62, 16, 42);
      s.visualAim = s.aim;
      view.setWeaponAim(slot, s.aim, 0, 0, s.aim);
      if (t < windup) {
        const wk = t / windup;
        view.setWeaponExtend(slot, (-5 * wk) / view.scaleX);
        if (isPushBash) {
          view.setWeaponMotion(slot, { scaleX: 1 - 0.1 * wk, scaleY: 1 + 0.1 * wk });
        } else {
          view.setWeaponMotion(slot, { liftY: -15 * wk, tilt: -0.86 * wk * facingFlip });
        }
      } else {
        const st = (t - windup) / (1 - windup);
        // 土豆兄弟三段节奏：0~0.38 猛砸到位 -> 0.38~0.52 砸实短停 -> 0.52~1.0 平稳收回
        let out: number;
        if (st < 0.38) out = Phaser.Math.Easing.Cubic.Out(st / 0.38);
        else if (st < 0.52) out = 1;
        else out = 1 - Phaser.Math.Easing.Quadratic.InOut((st - 0.52) / 0.48);
        const armExt = maxArmExt * out;
        let sxMult = 1;
        view.setWeaponExtend(slot, armExt / view.scaleX);
        if (isPushBash) {
          const punch = st < 0.52 ? out : 0;
          sxMult = 1 + 0.16 * punch;
          view.setWeaponMotion(slot, { scaleX: sxMult, scaleY: 1 - 0.12 * punch });
        } else if (st < 0.38) {
          const dk = Phaser.Math.Easing.Cubic.In(st / 0.38);
          const impact = st / 0.38 > 0.72 ? (st / 0.38 - 0.72) / 0.28 : 0;
          sxMult = 1 + 0.15 * impact;
          view.setWeaponMotion(slot, {
            liftY: Phaser.Math.Linear(-15, 4, dk),
            tilt: Phaser.Math.Linear(-0.86, 0.48, dk) * facingFlip,
            scaleX: sxMult,
            scaleY: 1 - 0.14 * impact,
          });
        } else if (st < 0.52) {
          sxMult = 1.12;
          view.setWeaponMotion(slot, { liftY: 4, tilt: 0.48 * facingFlip, scaleX: sxMult, scaleY: 0.88 });
        } else {
          const rk = (st - 0.52) / 0.48;
          const ease = Phaser.Math.Easing.Quadratic.Out(rk);
          view.setWeaponMotion(slot, {
            liftY: Phaser.Math.Linear(4, 0, ease),
            tilt: Phaser.Math.Linear(0.48, 0, ease) * facingFlip,
          });
        }
        // 仅在砸出与触地短停帧判定
        const headDist = armExt + view.weaponForwardWorld(slot, sxMult) * 0.85;
        if (st < 0.52 && headDist > s.lastExt) {
          const arc = melee.arc ?? 0.85;
          for (const aOff of [-arc * 0.45, 0, arc * 0.45]) {
            const a = s.aim + aOff;
            this.strikeAt(s, tipX, tipY, tipX + Math.cos(a) * headDist, tipY + Math.sin(a) * headDist, hitR, kb, a, headDist + hitR * 0.6);
          }
        }
        s.lastExt = Math.max(s.lastExt, headDist);
      }
    } else {
      const tetherKind = tetherKindOf(s.def);
      const isBite = s.def.id === 'claw' || s.def.id === 'scissors';
      const isBuzz = s.def.id === 'chainsaw' || s.def.id === 'drill';
      const isPunch = s.def.id === 'fist' || s.def.id === 'flaming-knuckles' || s.def.id === 'hand';
      const isDagger = s.def.id === 'knife' || s.def.id === 'thief-dagger' || s.def.id === 'sharp-tooth' || s.def.id === 'lightning-shiv' || s.def.id === 'ghost-flint';
      // 土豆兄弟式直线刺击（含剑类交替直刺）：干脆后拉 → 闪电直刺到敌人脸上 → 触肉短停 → 直线平稳收回
      const jabTilt = isDagger ? 0.16 * s.sweepDir : 0;
      const curAng = s.aim + jabTilt;
      s.visualAim = curAng;
      view.setWeaponAim(slot, curAng, 0, 0, s.aim);
      const baseFwd = view.weaponForwardWorld(slot);
      const maxHandExt = Phaser.Math.Clamp(s.targetDist - baseFwd * 0.55, 16, 44);
      const maxTetherExt =
        tetherKind === 'pole'
          ? Phaser.Math.Clamp(s.targetDist - baseFwd * 0.5, 26, Math.max(30, s.reach - baseFwd))
          : Phaser.Math.Clamp(s.targetDist - baseFwd * 0.45, 36, Math.max(40, s.reach - baseFwd * 0.45));
      if (t < windup) {
        const wk = t / windup;
        view.setWeaponExtend(slot, (-5.5 * wk) / view.scaleX);
        view.setWeaponMotion(slot, isBite ? { scaleX: 1 - 0.08 * wk, scaleY: 1 + 0.24 * wk } : null);
        if (tetherKind === 'pole') {
          view.setWeaponTether(slot, { kind: 'pole', st: 0, dir: 1, ext: (-5.5 * wk) / view.scaleX, localAngle: s.aim - view.rotation, arc: 0 });
        } else if (tetherKind) {
          view.setWeaponTether(slot, null);
        }
      } else {
        const st = windup > 0 ? (t - windup) / (1 - windup) : t;
        // 0~0.34 闪电刺出到位 -> 0.34~0.50 触肉短停 -> 0.50~1.0 平稳直线收回
        let out: number;
        if (st < 0.34) out = Phaser.Math.Easing.Cubic.Out(st / 0.34);
        else if (st < 0.5) out = 1;
        else out = 1 - Phaser.Math.Easing.Quadratic.InOut((st - 0.5) / 0.5);
        const visualExt = (tetherKind ? maxTetherExt : maxHandExt) * out;
        view.setWeaponExtend(slot, visualExt / view.scaleX);
        if (tetherKind) {
          view.setWeaponTether(slot, {
            kind: tetherKind,
            st,
            dir: 1,
            ext: visualExt / view.scaleX,
            localAngle: s.aim - view.rotation,
            arc: 0,
          });
        }
        let sxMult = 1;
        if (isBite) {
          const snap = Math.exp(-Math.pow((st - 0.38) / 0.12, 2));
          sxMult = 1 + 0.18 * snap;
          view.setWeaponMotion(slot, { scaleX: sxMult, scaleY: 1 - 0.42 * snap });
        } else if (isBuzz) {
          const buzz = out > 0.2 ? 2.1 * out : 0;
          sxMult = 1 + 0.1 * out;
          view.setWeaponMotion(slot, buzz > 0 ? { jitter: buzz, scaleX: sxMult, scaleY: 1 - 0.05 * out } : null);
        } else if (isPunch) {
          const jab = Math.exp(-Math.pow((st - 0.36) / 0.14, 2));
          sxMult = 1 + 0.2 * jab;
          view.setWeaponMotion(slot, { scaleX: sxMult, scaleY: 1 - 0.12 * jab });
        } else if (isDagger) {
          const flick = st < 0.5 ? out : 0;
          sxMult = 1 + 0.14 * flick;
          view.setWeaponMotion(slot, { scaleX: sxMult });
        } else {
          view.setWeaponMotion(slot, null);
        }
        // 仅在刺出与触肉短停帧判定，1:1 对齐兵器真实尖端
        const tipDist = visualExt + view.weaponForwardWorld(slot, sxMult) * 0.92;
        if (st < 0.5 && tipDist > s.lastExt) {
          const dx = Math.cos(s.aim);
          const dy = Math.sin(s.aim);
          const startD = Math.max(visualExt, s.lastExt);
          const steps = Math.max(1, Math.ceil((tipDist - startD) / SWEEP_STEP));
          for (let k = 1; k <= steps; k++) {
            const e = startD + ((tipDist - startD) * k) / steps;
            this.strikeAt(s, tipX, tipY, tipX + dx * e, tipY + dy * e, hitR, kb, s.aim, tipDist);
          }
        }
        s.lastExt = Math.max(s.lastExt, tipDist);
      }
    }
    if (s.swing <= 0) {
      view.setWeaponExtend(slot, 0);
      view.setWeaponTether(slot, null);
      view.setWeaponMotion(slot, null);
      if (s.def.id === 'circular-saw') view.setWeaponSpin(slot, 9);
    }
  }

  /** 联机快照：读取各武器槽当前瞄准角 */
  slotAims(): number[] {
    return this.slots.map((s) => Math.round(s.visualAim * 100) / 100);
  }

  /** 联机快照：导出当前已放置的炮台/地雷 */
  snapshotDevices(): SnapSprite[] {
    return this.devices.map((d) => [
      d.sprite.texture.key,
      Math.round(d.x),
      Math.round(d.y),
      Math.round(d.sprite.rotation * 100) / 100,
      Math.round(d.sprite.scaleX * 100) / 100,
    ]);
  }

  /** 武器头扫过 (px,py) 时，命中范围内还没被这一击打过的敌人 */
  private strikeAt(
    s: Slot,
    tipX: number,
    tipY: number,
    px: number,
    py: number,
    hitR: number,
    kb: number,
    _strikeAng: number,
    impactRange = s.maxRange,
  ): void {
    const melee = s.def.melee!;
    for (const en of this.enemies.grid.query(px, py, hitR + MAX_ENEMY_RADIUS, this.buf)) {
      if (!en.active || s.hits.includes(en)) continue;
      const rr = hitR + en.radius;
      const ox = en.x - px;
      const oy = en.y - py;
      if (ox * ox + oy * oy > rr * rr) continue;
      s.hits.push(en);
      // 土豆兄弟式首击微卡肉（仅停顿当前这把武器 26~42ms，让刀锋/锤头切肉停顿感极其清晰）
      if (s.hits.length === 1) {
        const heavy = melee.style === 'bash' || s.def.classes.includes('Heavy') || s.crit;
        s.hitPause = heavy ? 0.04 : 0.025;
      }
      // 仅范围砸击类（bash）在命中目标时留下地面裂缝，且半径严格贴合真实锤头砸点
      if (!s.aoeFxFired && melee.style === 'bash') {
        s.aoeFxFired = true;
        const enchant = s.owned?.enchant;
        const maxR = Math.min(s.maxRange, impactRange);
        this.fx?.bash(tipX, tipY, s.aim, melee.arc ?? 0.85, maxR, 0xf09c48, s.tier, bashVariantOf(s.def, enchant));
      }
      const d = Math.hypot(en.x - this.player.x, en.y - this.player.y) || 1;
      this.resolver.hit(en, s.damage, s.crit, (en.x - this.player.x) / d, (en.y - this.player.y) / d, kb, s.src);
    }
  }
}

function tetherKindOf(def: WeaponDef): 'whip' | 'chain' | 'sections' | 'pole' | 'scissor' | null {
  switch (def.id) {
    case 'whip':
      return 'whip';
    case 'flail':
    case 'anchor':
      return 'chain';
    case 'quarterstaff':
      return 'sections';
    case 'dex-troyer':
      return 'scissor';
    case 'spear':
    case 'jousting-lance':
    case 'trident':
    case 'hiking-pole':
    case 'scythe':
    case 'stick':
      return 'pole';
    default:
      return null;
  }
}

function bashVariantOf(def: WeaponDef, enchant: OwnedWeapon['enchant']): BashVariant {
  if (def.id === 'plasma-sledge') return 'plasma';
  if (def.id === 'power-fist' || def.classes.includes('Explosive') || enchant === 'ignite') return 'explosive';
  if (def.id === 'rock' || def.id === 'brick') return 'rock';
  return 'slam';
}

function shotSound(def: WeaponDef) {
  if (def.id === 'laser-gun') return 'zap' as const;
  if (def.kind === 'toxin') return 'spray' as const;
  if (def.classes.includes('Elemental') || def.onHit?.burn) return 'flame' as const;
  if ((def.projectile?.count ?? 1) >= 4) return 'shootHeavy' as const;
  return tierOf(def, 0).damage >= 14 ? ('shootHeavy' as const) : ('shoot' as const);
}
