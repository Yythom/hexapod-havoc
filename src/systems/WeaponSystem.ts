import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../config';
import { rollDamage, weaponDamage } from '../core/combat';
import type { OwnedWeapon } from '../core/RunState';
import { attackInterval, type Stats } from '../core/stats';
import type { Mods } from '../data/items';
import { TIERS, WEAPONS, type WeaponDef } from '../data/weapons';
import { MAX_SLOTS } from '../entities/BeetleView';
import type { Player } from '../entities/Player';
import type { Effects } from './Effects';
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
  /** 蚁后：工蚁数量和品质 */
  workers: number;
  workerTier: number;
  workerHp: number;
}

interface Slot {
  def: WeaponDef;
  tier: number;
  owned: OwnedWeapon;
  src: HitSource;
  cd: number;
  /** 炮台：距离下一次放置的时间 */
  placeCd: number;
  aim: number;
  // 近战动作状态
  swing: number;
  swingTotal: number;
  reach: number;
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
  return (1 + Math.max(0, stats.toxin) * 0.2) * (1 + stats.damagePct) * Math.max(0, 1 + (mods?.weaponDamagePct ?? 0));
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
  private slots: Slot[] = [];
  private devices: Device[] = [];
  private ctx!: WeaponContext;
  private readonly tip = new Phaser.Math.Vector2();
  private readonly buf: Enemy[] = [];
  private readonly workerSrc: HitSource = { def: WEAPONS.workers, owned: null };

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
        src: { def, owned: w },
        cd: 0.3 + i * 0.07,
        placeCd: 0.2 + i * 0.1,
        aim: view.rotation + view.tipLocalAngle(i),
        swing: 0,
        swingTotal: SWING_TIME,
        reach: 0,
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
    }
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
      const tip = view.tipWorld(i, this.tip);
      if (s.swing > 0) {
        this.updateSwing(s, i, tip.x, tip.y, dt, mods);
        return;
      }

      const summon = s.def.summon;
      if (summon?.type === 'aphid' || summon?.type === 'moth') {
        const count = (summon.counts?.[s.tier] ?? 2) + mods.summonCount;
        const damage = weaponDamage(s.def, s.tier, stats, mods, s.owned, ctx.damageMult) * (1 + mods.summonDamagePct);
        const interval = attackInterval(s.def.cooldown * TIERS[s.tier].cooldown, stats);
        const base = { slot: i, count, damage, crit: stats.critChance, critMultiplier: s.def.critMultiplier, knockback: s.def.knockback, interval };
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

      const range = this.rangeOf(s.def, stats);
      const target = this.enemies.nearest(tip.x, tip.y, range);
      if (target) s.aim = Math.atan2(target.y - tip.y, target.x - tip.x);
      else this.idleAim(s, i, dt);

      let kick = 0;
      if (target && s.cd <= 0) {
        const interval = this.intervalOf(s);
        s.cd = interval;
        if (summon?.type === 'web') {
          this.placeWeb(s, target);
        } else if (s.def.melee) {
          const dist = Math.hypot(target.x - tip.x, target.y - tip.y);
          this.startSwing(s, dist, range, interval);
          this.emitMeleeFx(s, tip.x, tip.y);
          this.onAttack?.();
          sfx.play('melee');
        } else if (s.def.beam) {
          this.fireBeam(s, tip.x, tip.y, target);
          this.onAttack?.();
        } else if (s.def.chain) {
          this.fireChain(s, tip.x, tip.y, target);
          this.onAttack?.();
          kick = 0.1;
        } else {
          this.fire(s, tip.x, tip.y, range, target);
          this.emitShotFx(s, tip.x, tip.y);
          this.onAttack?.();
          sfx.play(shotSound(s.def));
          kick = 0.1;
        }
      }
      view.setWeaponAim(i, s.aim, kick);
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
        critMultiplier: def.critMultiplier,
        knockback: def.knockback,
        interval: attackInterval(def.cooldown * TIERS[ctx.workerTier].cooldown, stats),
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

  private rangeOf(def: WeaponDef, stats: Stats): number {
    return def.range + (def.kind === 'melee' ? stats.range * 0.5 : def.summon || def.device ? 0 : stats.range);
  }

  /** 攻击间隔：吃攻速；蜂蜜罐低血时再快 30% */
  private intervalOf(s: Slot): number {
    let interval = attackInterval(s.def.cooldown * TIERS[s.tier].cooldown, this.ctx.stats);
    if (s.def.lowHpHaste && this.ctx.hpRatio < 0.5) interval /= 1 + s.def.lowHpHaste;
    return interval;
  }

  private roll(def: WeaponDef, tier: number, owned: OwnedWeapon | null) {
    const c = this.ctx;
    return rollDamage(def, tier, c.stats, c.mods, owned, c.damageMult);
  }

  private fire(s: Slot, x: number, y: number, range: number, target: Enemy): void {
    const proj = s.def.projectile;
    if (!proj) return;
    const { stats, mods } = this.ctx;
    const count = proj.count ?? 1;
    const arc = proj.arc ?? 0;
    const poisonDuration = POISON_DURATION + mods.poisonDuration;
    const perStack = poisonPerStack(stats, mods);
    for (let k = 0; k < count; k++) {
      const { damage, crit } = this.roll(s.def, s.tier, s.owned);
      const offset = count > 1 ? -arc / 2 + (arc * k) / (count - 1) : 0;
      const lob = proj.lob;
      const solid = proj.returning || proj.roll;
      this.projectiles.fire({
        texture: proj.texture,
        x,
        y,
        angle: s.aim + offset + (Math.random() * 2 - 1) * proj.spread,
        speed: proj.speed,
        maxDist: lob ? Math.min(range, Math.hypot(target.x - x, target.y - y)) : solid ? range : range + 60,
        damage,
        crit,
        radius: proj.radius,
        knockback: s.def.knockback,
        pierce: proj.pierce,
        spin: proj.spin,
        explode: proj.explode ?? 0,
        poison: proj.poison ? { stacks: proj.poison, perStack, duration: poisonDuration } : null,
        cloud: lob ? { radius: lob.cloudRadius, time: lob.cloudTime, damage: damage * 0.5, perStack, duration: poisonDuration } : null,
        src: s.src,
        trips: proj.returning ? 1 + mods.bounces : 0,
        bounce: proj.bounce ? { ...proj.bounce, times: proj.bounce.times + mods.bounces } : null,
        grow: proj.roll?.grow ?? 0,
        fade: !!proj.fade,
      });
    }
  }

  /** 光束：直接结算到最近的怪 */
  private fireBeam(s: Slot, x: number, y: number, target: Enemy): void {
    const { damage, crit } = this.roll(s.def, s.tier, s.owned);
    this.fx?.beam(x, y, target.x, target.y, crit ? 0xffe880 : 0xffb040, s.cd + 0.05);
    const d = Math.hypot(target.x - x, target.y - y) || 1;
    this.resolver.hit(target, damage, crit, (target.x - x) / d, (target.y - y) / d, s.def.knockback, s.src);
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
      this.resolver.hit(cur, amount, first.crit, (cx - fromX) / d, (cy - fromY) / d, s.def.knockback, s.src);
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
    this.fx?.zap(pts);
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
      s.cd = s.def.cooldown * TIERS[s.tier].cooldown;
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
          this.explodeMine(d, (d.def.device!.radius ?? 70) * (1 + mods.mineRadiusPct));
          this.removeDevice(i);
        }
        continue;
      }
      d.sprite.setScale(base);
      d.cd -= dt;
      if (d.cd > 0) continue;
      const target = this.enemies.nearest(d.x, d.y, d.def.range);
      if (!target) continue;
      d.cd = (d.def.cooldown * TIERS[d.tier].cooldown) / Math.max(0.2, 1 + mods.turretSpeedPct);
      const a = Math.atan2(target.y - d.y, target.x - d.x);
      d.sprite.setRotation(a);
      const { damage, crit } = this.roll(d.def, d.tier, null);
      const mx = d.x + Math.cos(a) * 14;
      const my = d.y + Math.sin(a) * 14;
      this.projectiles.fire({
        texture: 'turretshot',
        x: mx,
        y: my,
        angle: a,
        speed: TURRET_SHOT_SPEED,
        maxDist: d.def.range + 40,
        damage,
        crit,
        radius: 5,
        knockback: d.def.knockback,
        pierce: 0,
        spin: 0,
        explode: 0,
        poison: null,
        cloud: null,
        src: d.src,
      });
      this.fx?.spark(mx, my, 0xffd890, 2);
      sfx.play('shoot');
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
    this.fx?.ring(d.x, d.y, r, 0xffb050);
    this.fx?.burst(d.x, d.y, 0xb07a30, 12, 220, 1.1);
    sfx.play('explode');
    for (const e of this.enemies.grid.query(d.x, d.y, r + MAX_ENEMY_RADIUS, this.buf).slice()) {
      const dx = e.x - d.x;
      const dy = e.y - d.y;
      const rr = r + e.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const dist = Math.hypot(dx, dy) || 1;
      this.resolver.hit(e, damage, crit, dx / dist, dy / dist, d.def.knockback, d.src);
    }
  }

  private removeDevice(i: number): void {
    if (i < 0) return;
    this.devices[i].sprite.destroy();
    this.devices.splice(i, 1);
  }

  // ---------- 近战 ----------

  private startSwing(s: Slot, dist: number, range: number, interval: number): void {
    const { damage, crit } = this.roll(s.def, s.tier, s.owned);
    const style = s.def.melee!.style;
    const sweep = style === 'sweep';
    s.damage = damage;
    s.crit = crit;
    s.reach = sweep || style === 'bash' ? range : Phaser.Math.Clamp(dist, 28, range);
    s.swingTotal = Math.min(sweep ? SWEEP_TIME : style === 'flurry' ? SWING_TIME * 0.65 : SWING_TIME, interval * 0.8);
    s.swing = s.swingTotal;
    s.lastExt = 0;
    s.lastAng = s.aim - (s.def.melee!.arc ?? 0);
    s.hits.length = 0;
  }

  private emitMeleeFx(s: Slot, tx: number, ty: number): void {
    const fx = this.fx;
    if (!fx) return;
    const melee = s.def.melee!;
    const critCol = 0xffdf68;
    const dx = Math.cos(s.aim);
    const dy = Math.sin(s.aim);
    switch (melee.style) {
      case 'sweep': {
        const col = s.crit ? critCol : s.def.id === 'scarab' ? 0xffd848 : 0xa0ff58;
        fx.slash(tx, ty, s.reach * 0.85, s.aim, melee.arc ?? 1, col);
        if (s.def.id === 'scarab') fx.burst(tx + dx * s.reach * 0.6, ty + dy * s.reach * 0.6, 0xffdf58, 6, 150, 0.75);
        break;
      }
      case 'snap': {
        const col = s.crit ? critCol : s.def.id === 'scarred' ? 0xff5c38 : 0xffc858;
        fx.chomp(tx, ty, s.aim, s.reach * 0.88, col);
        if (s.def.id === 'scarred') fx.ring(tx + dx * s.reach * 0.5, ty + dy * s.reach * 0.5, 34, 0xff6e40);
        break;
      }
      case 'bash': {
        fx.bash(tx, ty, s.aim, melee.arc ?? 0.85, s.reach * 0.95, s.crit ? critCol : 0x72d8ff);
        break;
      }
      case 'charge': {
        const col = s.crit ? critCol : 0xffe49a;
        const ex = tx + dx * s.reach;
        const ey = ty + dy * s.reach;
        fx.sonicThrust(tx, ty, ex, ey, col, melee.hitRadius * 0.72, 2);
        break;
      }
      case 'flurry': {
        const col = s.crit ? critCol : 0xb8ff58;
        for (const off of [-0.18, -0.05, 0.06, 0.18]) {
          const a = s.aim + off;
          const r = s.reach * (Math.abs(off) < 0.08 ? 1.02 : 0.84);
          fx.thrust(tx, ty, tx + Math.cos(a) * r, ty + Math.sin(a) * r, col, 6.5);
        }
        fx.streaks(tx + dx * s.reach * 0.7, ty + dy * s.reach * 0.7, s.aim, col, 4, 210, 0.75);
        break;
      }
      case 'pierce': {
        const col = s.crit ? critCol : 0xeb68ff;
        const ex = tx + dx * s.reach;
        const ey = ty + dy * s.reach;
        fx.thrust(tx, ty, ex, ey, col, melee.hitRadius * 0.65);
        fx.star(ex, ey, 18, col, s.aim + Math.PI / 4);
        fx.streaks(ex, ey, s.aim, col, 4, 180, 0.8);
        break;
      }
      default: {
        fx.thrust(tx, ty, tx + dx * s.reach, ty + dy * s.reach, s.crit ? critCol : 0xffe4b8, melee.hitRadius * 0.45);
      }
    }
  }

  private emitShotFx(s: Slot, tx: number, ty: number): void {
    const fx = this.fx;
    if (!fx) return;
    const col = sparkColor(s.def);
    if (s.def.id === 'lasergun') {
      fx.muzzle(tx, ty, s.aim, 0x38f2ff, 26, 5);
      fx.ring(tx, ty, 14, 0x38f2ff);
    } else if (s.def.tags.includes('枪械')) {
      const heavy = (s.def.projectile?.count ?? 1) >= 4 || s.def.damage >= 16;
      fx.muzzle(tx, ty, s.aim, col, heavy ? 24 : 15, heavy ? 6 : 3);
    } else if (s.def.tags.includes('火焰')) {
      fx.muzzle(tx, ty, s.aim, 0xff7824, 20, 4);
    } else if (s.def.onHit?.freeze) {
      fx.muzzle(tx, ty, s.aim, 0x7ce8ff, 16, 4);
    } else {
      fx.spark(tx, ty, col, s.def.damage >= 18 ? 5 : 3);
    }
  }

  private updateSwing(s: Slot, slot: number, tipX: number, tipY: number, dt: number, mods: Mods): void {
    const view = this.player.view;
    const melee = s.def.melee!;
    const kb = s.def.knockback * (1 + mods.meleeKnockbackPct);
    s.swing = Math.max(0, s.swing - dt);
    const t = 1 - s.swing / s.swingTotal;
    const hitR = melee.hitRadius;

    if (melee.style === 'sweep') {
      // 扇形横扫：伸出去，从一侧扫到另一侧
      const arc = melee.arc ?? 1;
      const ang = s.aim - arc + 2 * arc * Phaser.Math.Easing.Sine.InOut(t);
      const ext = s.reach * Math.min(1, t / 0.15, (1 - t) / 0.15) * 0.85;
      view.setWeaponAim(slot, ang);
      view.setWeaponExtend(slot, ext / view.scaleX);
      const steps = Math.max(1, Math.ceil(Math.abs(ang - s.lastAng) / 0.12));
      for (let k = 1; k <= steps; k++) {
        const a = s.lastAng + ((ang - s.lastAng) * k) / steps;
        for (const f of [0.45, 1]) this.strikeAt(s, tipX + Math.cos(a) * ext * f, tipY + Math.sin(a) * ext * f, hitR, kb);
      }
      s.lastAng = ang;
    } else if (melee.style === 'bash') {
      // 盾击震荡波：短距猛推并在前方弧面震开敌人
      const out = t < SWING_OUT ? t / SWING_OUT : 1 - (t - SWING_OUT) / (1 - SWING_OUT);
      const ext = s.reach * 0.68 * Phaser.Math.Easing.Quadratic.Out(out);
      view.setWeaponExtend(slot, ext / view.scaleX);
      view.setWeaponAim(slot, s.aim);
      if (ext > s.lastExt) {
        const arc = melee.arc ?? 0.85;
        for (const aOff of [-arc * 0.6, 0, arc * 0.6]) {
          const a = s.aim + aOff;
          this.strikeAt(s, tipX + Math.cos(a) * ext, tipY + Math.sin(a) * ext, hitR, kb);
        }
      }
      s.lastExt = Math.max(s.lastExt, ext);
    } else {
      const out = t < SWING_OUT ? t / SWING_OUT : 1 - (t - SWING_OUT) / (1 - SWING_OUT);
      const ext = s.reach * Phaser.Math.Easing.Quadratic.Out(out);
      // 腿尖在本地坐标系里，刺出距离要换算到本地（菜单里甲虫会放大）
      view.setWeaponExtend(slot, ext / view.scaleX);
      view.setWeaponAim(slot, s.aim);
      if (ext > s.lastExt) {
        const dx = Math.cos(s.aim);
        const dy = Math.sin(s.aim);
        const steps = Math.max(1, Math.ceil((ext - s.lastExt) / SWEEP_STEP));
        for (let k = 1; k <= steps; k++) {
          const e = s.lastExt + ((ext - s.lastExt) * k) / steps;
          this.strikeAt(s, tipX + dx * e, tipY + dy * e, hitR, kb);
        }
      }
      s.lastExt = Math.max(s.lastExt, ext);
    }
    if (s.swing <= 0) view.setWeaponExtend(slot, 0);
  }

  /** 武器头扫过 (px,py) 时，命中范围内还没被这一击打过的敌人 */
  private strikeAt(s: Slot, px: number, py: number, hitR: number, kb: number): void {
    for (const en of this.enemies.grid.query(px, py, hitR + MAX_ENEMY_RADIUS, this.buf)) {
      if (!en.active || s.hits.includes(en)) continue;
      const rr = hitR + en.radius;
      const ox = en.x - px;
      const oy = en.y - py;
      if (ox * ox + oy * oy > rr * rr) continue;
      s.hits.push(en);
      const d = Math.hypot(en.x - this.player.x, en.y - this.player.y) || 1;
      this.resolver.hit(en, s.damage, s.crit, (en.x - this.player.x) / d, (en.y - this.player.y) / d, kb, s.src);
    }
  }
}

function sparkColor(def: WeaponDef): number {
  if (def.id === 'lasergun') return 0x6cf2ff;
  if (def.tags.includes('枪械')) return 0xffcf54;
  if (def.kind === 'toxin') return 0xb8ff58;
  if (def.tags.includes('火焰')) return 0xff8a30;
  if (def.onHit?.freeze) return 0xbfefff;
  if (def.tags.includes('蜂蜜')) return 0xffc040;
  return 0xffe6a0;
}

function shotSound(def: WeaponDef) {
  if (def.id === 'lasergun') return 'zap' as const;
  if (def.kind === 'toxin') return 'spray' as const;
  if (def.tags.includes('火焰')) return 'flame' as const;
  if ((def.projectile?.count ?? 1) >= 4) return 'shootHeavy' as const;
  return def.damage >= 14 ? ('shootHeavy' as const) : ('shoot' as const);
}
