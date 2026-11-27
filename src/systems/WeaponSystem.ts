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
import type { ProjectileManager } from './ProjectileManager';
import type { AphidGroup, MothGroup, Summons } from './Summons';

/** 近战一次刺击的最长时长（刺出 + 收回） */
const SWING_TIME = 0.24;
/** 横扫的时长 */
const SWEEP_TIME = 0.32;
/** 刺出阶段占整个动作的比例 */
const SWING_OUT = 0.45;
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
  /** 手瞄 / 鼠标集火目标世界坐标（未启用时为 null） */
  aimPoint?: { x: number; y: number } | null;
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
  // 近战动作状态
  swing: number;
  swingTotal: number;
  reach: number;
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
        swing: 0,
        swingTotal: SWING_TIME,
        reach: 0,
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
      view.setWeapon(i, s ? s.def.icon : null, s?.tier ?? 0);
      if (s?.def.id === 'circular-saw') view.setWeaponSpin(i, 9);
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
      const aimPt = ctx.aimPoint;
      const target = aimPt ? this.nearestToFocus(tip.x, tip.y, range, aimPt.x, aimPt.y) : this.enemies.nearest(tip.x, tip.y, range);
      if (aimPt) {
        s.aim = Math.atan2(aimPt.y - tip.y, aimPt.x - tip.x);
      } else if (target) {
        s.aim = Math.atan2(target.y - tip.y, target.x - tip.x);
      } else {
        this.idleAim(s, i, dt);
      }

      let kick = 0;
      let recoilMag = 6;
      const canManualFire = !!aimPt && !summon && !s.def.beam && !s.def.chain && (!!target || this.enemies.count > 0);
      if ((target || canManualFire) && s.cd <= 0) {
        const interval = this.intervalOf(s);
        s.cd = interval;
        if (summon?.type === 'web') {
          if (target) this.placeWeb(s, target);
        } else if (s.def.melee) {
          const dist = target ? Math.hypot(target.x - tip.x, target.y - tip.y) : range * 0.85;
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
          if (target) {
            this.fireBeam(s, tip.x, tip.y, target);
            this.onAttack?.();
            kick = 0.09;
            recoilMag = 3.5;
          }
        } else if (s.def.chain) {
          if (target) {
            this.fireChain(s, tip.x, tip.y, target);
            this.onAttack?.();
            kick = 0.12;
            recoilMag = 4.8;
          }
        } else {
          const lobTarget = target ?? (aimPt ? ({ x: aimPt.x, y: aimPt.y } as Enemy) : null);
          if (lobTarget) {
            this.fire(s, tip.x, tip.y, range, lobTarget);
            this.emitShotFx(s, tip.x, tip.y);
            this.onAttack?.();
            if (s.def.special?.turretResetOnAttack) this.resetTurrets();
            sfx.play(shotSound(s.def));
            const heavy = (s.def.projectile?.count ?? 1) >= 4 || (s.def.projectile?.explode ?? 0) > 0 || tierOf(s.def, s.tier).damage >= 16;
            kick = heavy ? 0.16 : 0.11;
            recoilMag = heavy ? 9.2 : 5.6;
          }
        }
      }
      view.setWeaponAim(i, s.aim, kick, recoilMag);
    });

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
    view.setWeaponAim(i, s.aim);
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

  /** 手瞄/鼠标集火：在武器射程内优先找离鼠标准星最近的怪 */
  private nearestToFocus(tx: number, ty: number, range: number, fx: number, fy: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies.active) {
      if (e.age < SPAWN_POP * 0.5) continue;
      const reach = range + e.radius;
      const dx = e.x - tx;
      const dy = e.y - ty;
      if (dx * dx + dy * dy > reach * reach) continue;
      const fd = Math.hypot(e.x - fx, e.y - fy);
      if (fd < bd) {
        bd = fd;
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
    const sweep = style === 'sweep';
    s.damage = damage;
    s.crit = crit;
    s.maxRange = range;
    s.aoeFxFired = false;
    if (sweep) s.sweepDir = s.sweepDir === 1 ? -1 : 1;
    s.reach = Math.min(MAX_SCREEN_RANGE, (sweep || style === 'bash' ? range : Phaser.Math.Clamp(dist, 28, range)) * (1 + 0.06 * s.tier));
    s.swingTotal = Math.min(sweep ? SWEEP_TIME : style === 'flurry' ? SWING_TIME * 0.65 : SWING_TIME, interval * 0.8);
    s.swing = s.swingTotal;
    s.lastExt = 0;
    s.lastAng = s.aim - (s.def.melee!.arc ?? 0) * s.sweepDir;
    s.hits.length = 0;
  }

  /** 近战各形态的真实命中半径：直刺/连刺/夹击严格收窄，避免“细针特效却扫死旁边一大片” */
  private meleeHitRadius(melee: NonNullable<WeaponDef['melee']>, tier: number): number {
    switch (melee.style) {
      case 'thrust':
      case 'flurry':
      case 'pierce':
        return melee.hitRadius * 0.56 * (1 + 0.1 * tier);
      case 'snap':
        return melee.hitRadius * 0.65 * (1 + 0.1 * tier);
      case 'charge':
        return melee.hitRadius * 0.72 * (1 + 0.1 * tier);
      default:
        return melee.hitRadius * 0.9 * (1 + 0.12 * tier);
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
    s.swing = Math.max(0, s.swing - dt);
    const t = 1 - s.swing / s.swingTotal;
    const hitR = this.meleeHitRadius(melee, s.tier);
    // 出招前极短（约 0.03s）回拉蓄力再猛刺/猛挥，增强打击重量感（连刺 flurry 保持极速不蓄力）
    const windup = melee.style === 'flurry' ? 0 : Math.min(0.13, 0.03 / Math.max(0.08, s.swingTotal));

    if (melee.style === 'sweep') {
      // 扇形横扫：不画刀光特效，靠武器实体左右往复蓄力挥扫运动直接表达范围
      // 虫鞭走实时软鞭行波、流星锤/锚带铁链、四节棍走四节连杆、长柄镰刀带长杆、圆锯高速自转
      const arc = melee.arc ?? 1;
      const dir = s.sweepDir;
      const tetherKind = tetherKindOf(s.def);
      const isSaw = s.def.id === 'circular-saw';
      const isPruner = s.def.id === 'pruner';
      if (isSaw) view.setWeaponSpin(slot, 36);
      if (t < windup) {
        const wk = t / windup;
        const ang = s.aim - (arc + 0.18 * wk) * dir;
        view.setWeaponAim(slot, ang);
        view.setWeaponExtend(slot, (-4.5 * wk) / view.scaleX);
        view.setWeaponMotion(slot, null);
        if (tetherKind === 'whip' || tetherKind === 'sections') {
          view.setWeaponTether(slot, { kind: tetherKind, st: 0, dir, ext: 14 / view.scaleX, localAngle: ang - view.rotation, arc });
        } else if (tetherKind) {
          view.setWeaponTether(slot, null);
        }
      } else {
        const st = (t - windup) / (1 - windup);
        const ang = s.aim + (-arc + 2 * arc * Phaser.Math.Easing.Sine.InOut(st)) * dir;
        const ext = s.reach * Math.min(1, st / 0.14, (1 - st) / 0.15) * 0.85;
        view.setWeaponAim(slot, ang);
        // 虫鞭与四节棍由物理连杆直接画在容器里，手柄不离身；其他武器沿弧挥出
        view.setWeaponExtend(slot, tetherKind === 'whip' || tetherKind === 'sections' ? 0 : ext / view.scaleX);
        if (tetherKind) {
          view.setWeaponTether(slot, {
            kind: tetherKind,
            st,
            dir,
            ext: ext / view.scaleX,
            localAngle: ang - view.rotation,
            arc,
          });
        }
        // 修枝剪横扫中段补一记干脆剪合挤压
        if (isPruner) {
          const snap = Math.exp(-Math.pow((st - 0.5) / 0.14, 2));
          view.setWeaponMotion(slot, snap > 0.05 ? { scaleX: 1 + 0.18 * snap, scaleY: 1 - 0.34 * snap } : null);
        }
        const steps = Math.max(1, Math.ceil(Math.abs(ang - s.lastAng) / 0.12));
        for (let k = 1; k <= steps; k++) {
          const a = s.lastAng + ((ang - s.lastAng) * k) / steps;
          for (const f of [0.52, 1]) this.strikeAt(s, tipX, tipY, tipX + Math.cos(a) * ext * f, tipY + Math.sin(a) * ext * f, hitR, kb, a + Math.PI * 0.5 * dir);
        }
        s.lastAng = ang;
      }
    } else if (melee.style === 'bash') {
      // 重锤/滚石/砖块/撬棍走“高举蓄力 -> 猛力下砸”立体砸地运动；盾牌/拳套走正前方蓄力重推/直轰
      const isPushBash = s.def.id === 'spiky-shield' || s.def.id === 'power-fist' || s.def.id === 'cestus';
      const facingFlip = Math.cos(s.aim) < 0 ? -1 : 1;
      view.setWeaponAim(slot, s.aim);
      if (t < windup) {
        const wk = t / windup;
        view.setWeaponExtend(slot, (-6 * wk) / view.scaleX);
        if (isPushBash) {
          view.setWeaponMotion(slot, { scaleX: 1 - 0.12 * wk, scaleY: 1 + 0.1 * wk });
        } else {
          // 抬锤蓄力：世界向上高举 + 向后仰倾，地面影子留在下方
          view.setWeaponMotion(slot, { liftY: -16 * wk, tilt: -0.82 * wk * facingFlip });
        }
      } else {
        const st = (t - windup) / (1 - windup);
        const out = st < SWING_OUT ? st / SWING_OUT : 1 - (st - SWING_OUT) / (1 - SWING_OUT);
        const ext = s.reach * 0.72 * Phaser.Math.Easing.Quadratic.Out(out);
        view.setWeaponExtend(slot, ext / view.scaleX);
        if (isPushBash) {
          const punch = Math.sin(Math.min(1, st / SWING_OUT) * Math.PI);
          view.setWeaponMotion(slot, { scaleX: 1 + 0.22 * punch, scaleY: 1 - 0.14 * punch });
        } else if (st < SWING_OUT) {
          // 加速下砸：从高处俯冲压向地面
          const dk = Phaser.Math.Easing.Cubic.In(st / SWING_OUT);
          const impact = st / SWING_OUT > 0.8 ? (st / SWING_OUT - 0.8) / 0.2 : 0;
          view.setWeaponMotion(slot, {
            liftY: Phaser.Math.Linear(-16, 4, dk),
            tilt: Phaser.Math.Linear(-0.82, 0.44, dk) * facingFlip,
            scaleX: 1 + 0.18 * impact,
            scaleY: 1 - 0.18 * impact,
          });
        } else {
          // 砸中地面后的短暂停顿回抬
          const rk = (st - SWING_OUT) / (1 - SWING_OUT);
          const ease = Phaser.Math.Easing.Quadratic.Out(rk);
          view.setWeaponMotion(slot, {
            liftY: Phaser.Math.Linear(4, 0, ease),
            tilt: Phaser.Math.Linear(0.44, 0, ease) * facingFlip,
          });
        }
        if (ext > s.lastExt) {
          const arc = melee.arc ?? 0.85;
          for (const aOff of [-arc * 0.6, 0, arc * 0.6]) {
            const a = s.aim + aOff;
            this.strikeAt(s, tipX, tipY, tipX + Math.cos(a) * ext, tipY + Math.sin(a) * ext, hitR, kb, a);
          }
        }
        s.lastExt = Math.max(s.lastExt, ext);
      }
    } else {
      const tetherKind = tetherKindOf(s.def);
      const isBite = s.def.id === 'claw' || s.def.id === 'scissors';
      const isBuzz = s.def.id === 'chainsaw' || s.def.id === 'drill';
      const isPunch = s.def.id === 'fist' || s.def.id === 'flaming-knuckles' || s.def.id === 'hand';
      view.setWeaponAim(slot, s.aim);
      if (t < windup) {
        const wk = t / windup;
        view.setWeaponExtend(slot, (-6.5 * wk) / view.scaleX);
        view.setWeaponMotion(slot, isBite ? { scaleX: 1 - 0.1 * wk, scaleY: 1 + 0.22 * wk } : null);
        if (tetherKind) view.setWeaponTether(slot, null);
      } else {
        const st = windup > 0 ? (t - windup) / (1 - windup) : t;
        const out = st < SWING_OUT ? st / SWING_OUT : 1 - (st - SWING_OUT) / (1 - SWING_OUT);
        const ext = s.reach * Phaser.Math.Easing.Quadratic.Out(out);
        // 腿尖在本地坐标系里，刺出距离要换算到本地（菜单里甲虫会放大）
        view.setWeaponExtend(slot, ext / view.scaleX);
        if (tetherKind) {
          view.setWeaponTether(slot, {
            kind: tetherKind,
            st,
            dir: 1,
            ext: ext / view.scaleX,
            localAngle: s.aim - view.rotation,
            arc: 0,
          });
        }
        if (isBite) {
          // 大颚/双刃剪：伸到最远点时利落“咔嚓”咬合压扁再弹回
          const snap = Math.exp(-Math.pow((st - SWING_OUT) / 0.13, 2));
          view.setWeaponMotion(slot, { scaleX: 1 + 0.22 * snap, scaleY: 1 - 0.42 * snap });
        } else if (isBuzz) {
          // 锯齿颚/钻角：伸出切割/钻进时带高频机械抖动
          const buzz = out > 0.15 ? 2.4 * out : 0;
          view.setWeaponMotion(slot, buzz > 0 ? { jitter: buzz, scaleX: 1 + 0.08 * out, scaleY: 1 - 0.05 * out } : null);
        } else if (isPunch) {
          // 拳击系：直拳出拳拉伸感
          const jab = Math.exp(-Math.pow((st - SWING_OUT * 0.88) / 0.16, 2));
          view.setWeaponMotion(slot, { scaleX: 1 + 0.22 * jab, scaleY: 1 - 0.14 * jab });
        } else {
          view.setWeaponMotion(slot, null);
        }
        if (ext > s.lastExt) {
          const dx = Math.cos(s.aim);
          const dy = Math.sin(s.aim);
          const steps = Math.max(1, Math.ceil((ext - s.lastExt) / SWEEP_STEP));
          for (let k = 1; k <= steps; k++) {
            const e = s.lastExt + ((ext - s.lastExt) * k) / steps;
            this.strikeAt(s, tipX, tipY, tipX + dx * e, tipY + dy * e, hitR, kb, s.aim);
          }
        }
        s.lastExt = Math.max(s.lastExt, ext);
      }
    }
    if (s.swing <= 0) {
      view.setWeaponExtend(slot, 0);
      view.setWeaponTether(slot, null);
      view.setWeaponMotion(slot, null);
      if (s.def.id === 'circular-saw') view.setWeaponSpin(slot, 9);
    }
  }

  /** 武器头扫过 (px,py) 时，命中范围内还没被这一击打过的敌人 */
  private strikeAt(s: Slot, tipX: number, tipY: number, px: number, py: number, hitR: number, kb: number, _strikeAng: number): void {
    const melee = s.def.melee!;
    for (const en of this.enemies.grid.query(px, py, hitR + MAX_ENEMY_RADIUS, this.buf)) {
      if (!en.active || s.hits.includes(en)) continue;
      const rr = hitR + en.radius;
      const ox = en.x - px;
      const oy = en.y - py;
      if (ox * ox + oy * oy > rr * rr) continue;
      s.hits.push(en);
      // 仅范围砸击类（bash）在命中目标时留下地面裂缝（横扫与单体近战均不加多余光效）
      if (!s.aoeFxFired && melee.style === 'bash') {
        s.aoeFxFired = true;
        const enchant = s.owned?.enchant;
        const maxR = Math.min(s.maxRange, s.reach * 0.72 + hitR * 0.85);
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
