import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, FONT_FAMILY, MAX_ENEMIES, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { sfx } from '../audio/sfx';
import { AFFIX_LABEL, type DifficultyDef, type EliteAffix } from '../data/difficulty';
import { ENEMIES, enemyDamage, enemyHp, enemySkillDamage, type EnemyDef } from '../data/enemies';
import type { Mods } from '../data/items';
import type { Effects } from './Effects';
import { shake } from '../ui/camera';
import { SpatialGrid } from './SpatialGrid';
import type { Telegraphs } from './Telegraphs';

/** 出生时从地里钻出来的时长，期间不动、不造成伤害 */
export const SPAWN_POP = 0.2;
/** 网格查询时要覆盖到的最大怪物半径 */
export const MAX_ENEMY_RADIUS = 40;
const SEPARATION = 140;
const KNOCKBACK_DECAY = 9;
const EDGE = 24;
const POISON_MAX_STACKS = 10;
/** 护盾词条：护盾吃掉 60% 伤害，总量为 40% 最大生命 */
const SHIELD_SHARE = 0.6;
const SHIELD_AMOUNT = 0.4;
/** 再生词条：每秒回复 3% 最大生命 */
const REGEN_RATE = 0.03;

// 状态效果（DESIGN.md 15.2）
/** 灼烧：持续 3 秒，每 0.5 秒结算一次；死亡时传给半径 60 内最近的怪 */
export const BURN_DURATION = 3;
export const BURN_RATIO = 0.3;
const BURN_TICK = 0.5;
const BURN_SPREAD = 60;
/** 冰冻：叠满 3 层冻住 1 秒（精英 0.4 秒，Boss 改为减速 30%），解冻后 2 秒内不能再冻 */
const ICE_STACKS = 3;
const ICE_DECAY = 4;
/** 每层冰减速 15% */
const ICE_SLOW = 0.15;
const FREEZE_TIME = 1;
const FREEZE_TIME_ELITE = 0.4;
const FREEZE_IMMUNE = 2;
const BOSS_ICE_SLOW = 0.7;
/** 易伤：受到的伤害 +15%，持续 3 秒 */
const VULN_BASE = 0.15;
const VULN_TIME = 3;

/** 雷暴 Boss 第三阶段的落雷 */
interface Strike {
  x: number;
  y: number;
  r: number;
  t: number;
  damage: number;
}

/** 怪物需要从战斗场景拿到的东西 */
export interface EnemyHost {
  readonly px: number;
  readonly py: number;
  readonly pr: number;
  readonly wave: number;
  readonly difficulty: DifficultyDef;
  /** 玩家当前的规则加成（易伤、灼烧、冰冻相关） */
  readonly mods: Mods;
  /** 对玩家造成伤害（走闪避、甲壳、无敌时间） */
  hurtPlayer(damage: number): void;
  shoot(x: number, y: number, angle: number, speed: number, damage: number): void;
}

export type HitKind = 'normal' | 'poison' | 'burn';

export class Enemy {
  readonly sprite: Phaser.GameObjects.Image;
  def!: EnemyDef;
  index = -1;
  hp = 0;
  maxHp = 0;
  damage = 0;
  skillDamage = 0;
  speed = 0;
  radius = 10;
  baseScale = 1;
  x = 0;
  y = 0;
  /** 击退速度 */
  kx = 0;
  ky = 0;
  heading = 0;
  age = 0;
  flash = 0;
  wobble = 0;
  active = false;
  /** 行为状态机 */
  state = 0;
  timer = 0;
  timer2 = 0;
  count = 0;
  dirX = 0;
  dirY = 0;
  tx = 0;
  ty = 0;
  sx = 0;
  sy = 0;
  enraged = false;
  /** 雷暴难度下 Boss 第三阶段 */
  storm = false;
  timer3 = 0;
  /** 精英词条（暴雨及以上） */
  affix: EliteAffix | null = null;
  shieldHp = 0;
  label: Phaser.GameObjects.Text | null = null;
  // 状态
  poison = 0;
  poisonTime = 0;
  poisonTick = 0;
  poisonPer = 0;
  slowTime = 0;
  slowMult = 1;
  burnTime = 0;
  burnDps = 0;
  burnTick = 0;
  /** 灼烧伤害的小数部分，攒够 1 点再结算 */
  burnAcc = 0;
  ice = 0;
  iceTime = 0;
  /** 冻住的剩余时间；大于 0 时不移动、不攻击 */
  frozen = 0;
  freezeImmune = 0;
  vulnTime = 0;

  constructor(scene: Phaser.Scene, texture: string) {
    this.sprite = scene.add.image(0, 0, texture).setDepth(DEPTH.enemy).setVisible(false);
  }
}

export class EnemyManager {
  readonly active: Enemy[] = [];
  readonly grid = new SpatialGrid<Enemy>(WORLD_WIDTH, WORLD_HEIGHT, 48);
  host!: EnemyHost;
  onKilled: ((e: Enemy) => void) | null = null;
  /** 玩家的攻击命中敌人时（吸取、黑寡妇丝等效果用） */
  onDamaged: ((e: Enemy, damage: number, crit: boolean) => void) | null = null;
  /** 毒造成伤害时（统计毒素伤害，解锁屁步甲用） */
  onPoisonDamage: ((damage: number) => void) | null = null;
  private readonly pool: Enemy[] = [];
  private readonly buf: Enemy[] = [];
  private readonly strikes: Strike[] = [];
  /** 冻住的怪身上的冰壳 */
  private readonly iceG: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: Effects,
    private readonly tel: Telegraphs,
  ) {
    this.iceG = scene.add.graphics().setDepth(DEPTH.enemy + 3);
  }

  get count(): number {
    return this.active.length;
  }

  spawn(def: EnemyDef, x: number, y: number, wave: number): Enemy {
    const e = this.pool.pop() ?? new Enemy(this.scene, def.texture);
    const mult = this.host.difficulty.mult;
    e.def = def;
    e.maxHp = e.hp = enemyHp(def, wave) * mult;
    e.damage = enemyDamage(def, wave) * mult;
    e.skillDamage = enemySkillDamage(def, wave) * mult;
    e.speed = def.speed * (def.boss || def.elite ? 1 : Phaser.Math.FloatBetween(0.92, 1.08));
    e.storm = false;
    e.timer3 = 0;
    e.affix = null;
    e.shieldHp = 0;
    if (def.elite && this.host.difficulty.eliteAffix) this.giveAffix(e);
    if (def.boss) sfx.play('bossRoar');
    e.radius = def.radius;
    e.baseScale = (def.scale ?? 1) / SPRITE_RES;
    e.x = x;
    e.y = y;
    e.kx = e.ky = 0;
    e.age = 0;
    e.flash = 0;
    e.wobble = Math.random() * Math.PI * 2;
    e.heading = Math.random() * Math.PI * 2;
    e.state = 0;
    e.timer = def.behavior === 'ranged' ? 1 + Math.random() * 1.5 : def.behavior === 'elite' ? 2 : def.behavior === 'summoner' ? 2.5 : 1.2;
    e.timer2 = 0;
    e.count = 0;
    e.enraged = false;
    e.poison = e.poisonTime = e.poisonTick = 0;
    e.slowTime = 0;
    e.slowMult = 1;
    e.burnTime = e.burnDps = e.burnTick = e.burnAcc = 0;
    e.ice = e.iceTime = e.frozen = e.freezeImmune = 0;
    e.vulnTime = 0;
    e.active = true;
    e.sprite
      .setTexture(def.texture)
      .setPosition(x, y)
      .setRotation(e.heading)
      .setScale(0)
      .setAlpha(1)
      .clearTint()
      .setDepth(def.boss ? DEPTH.enemy + 2 : def.elite ? DEPTH.enemy + 1 : DEPTH.enemy)
      .setVisible(true);
    e.index = this.active.length;
    this.active.push(e);
    return e;
  }

  /** 怪物自己生出来的怪（蚁后产卵、黏菌分裂、Boss 召唤），不需要土堆预警 */
  spawnChild(id: string, x: number, y: number): Enemy | null {
    if (this.active.length >= MAX_ENEMIES) return null;
    const cx = Phaser.Math.Clamp(x, EDGE, WORLD_WIDTH - EDGE);
    const cy = Phaser.Math.Clamp(y, EDGE, WORLD_HEIGHT - EDGE);
    return this.spawn(ENEMIES[id], cx, cy, this.host.wave);
  }

  update(dt: number): void {
    this.updateStrikes(dt);
    this.iceG.clear();
    const grid = this.grid;
    grid.clear();
    for (const e of this.active) grid.insert(e);

    const decay = Math.exp(-KNOCKBACK_DECAY * dt);
    // 倒序遍历：中途死亡的怪会被末尾的怪替换，末尾的已经更新过了
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.age += dt;
      this.updateStatus(e, dt);
      if (!e.active) continue;

      const frozen = e.frozen > 0;
      const [vx0, vy0] = e.age >= SPAWN_POP && !frozen ? this.behave(e, dt) : [0, 0];
      if (!e.active) continue;
      const slow = (e.slowTime > 0 ? e.slowMult : 1) * (1 - ICE_SLOW * e.ice);
      let vx = vx0 * slow;
      let vy = vy0 * slow;

      // 互相推开，避免叠成一坨（Boss 和蜜树不被推）
      if (!e.def.boss && e.def.behavior !== 'tree') {
        let sx = 0;
        let sy = 0;
        for (const o of grid.query(e.x, e.y, e.radius + MAX_ENEMY_RADIUS, this.buf)) {
          if (o === e) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const min = e.radius + o.radius;
          const od2 = ox * ox + oy * oy;
          if (od2 >= min * min) continue;
          if (od2 < 0.0001) {
            sx += Math.random() - 0.5;
            sy += Math.random() - 0.5;
            continue;
          }
          const od = Math.sqrt(od2);
          const push = (min - od) / min;
          sx += (ox / od) * push;
          sy += (oy / od) * push;
        }
        vx += sx * SEPARATION;
        vy += sy * SEPARATION;
      }
      vx += e.kx;
      vy += e.ky;
      e.kx *= decay;
      e.ky *= decay;

      e.x = Phaser.Math.Clamp(e.x + vx * dt, EDGE, WORLD_WIDTH - EDGE);
      e.y = Phaser.Math.Clamp(e.y + vy * dt, EDGE, WORLD_HEIGHT - EDGE);
      if (!frozen && e.def.behavior !== 'tree') {
        const face = Math.hypot(vx0, vy0) > 1 ? Math.atan2(vy0, vx0) : Math.atan2(this.host.py - e.y, this.host.px - e.x);
        e.heading = Phaser.Math.Angle.RotateTo(e.heading, face, (e.def.boss ? 3 : 8) * dt);
      }
      this.draw(e, dt);
    }
  }

  /** 造成伤害，返回是否击杀 */
  hit(e: Enemy, damage: number, crit: boolean, dirX: number, dirY: number, knockback: number, kind: HitKind = 'normal'): boolean {
    if (!e.active) return false;
    // 易伤、余烬：受到的伤害增加
    const mods = this.host.mods;
    let amp = 1;
    if (e.vulnTime > 0) amp += VULN_BASE + mods.vulnerablePct;
    if (e.burnTime > 0) amp += mods.burnVulnPct;
    if (amp !== 1) damage = Math.max(1, Math.round(damage * amp));
    if (e.shieldHp > 0) {
      const absorbed = Math.min(e.shieldHp, damage * SHIELD_SHARE);
      e.shieldHp -= absorbed;
      e.hp -= damage - absorbed;
      if (e.shieldHp <= 0) this.fx.number(e.x, e.y - e.radius - 24, '护盾破碎', 'shield');
    } else {
      e.hp -= damage;
    }
    if (kind === 'normal') {
      e.flash = 0.07;
      const resist = e.def.knockbackResist ?? 0;
      e.kx += dirX * knockback * (1 - resist);
      e.ky += dirY * knockback * (1 - resist);
      this.fx.number(e.x, e.y - e.radius - 6, damage, crit ? 'crit' : 'normal');
      sfx.play('hit');
      this.onDamaged?.(e, damage, crit);
    } else if (kind === 'poison') {
      this.fx.number(e.x, e.y - e.radius - 6, damage, 'poison');
      this.onPoisonDamage?.(damage);
    } else {
      this.fx.number(e.x, e.y - e.radius - 6, damage, 'burn');
    }
    if (e.hp > 0) return false;
    this.die(e, true);
    return true;
  }

  applyPoison(e: Enemy, stacks: number, perStack: number, duration: number): void {
    if (!e.active) return;
    e.poison = Math.min(POISON_MAX_STACKS, e.poison + stacks);
    e.poisonPer = Math.max(e.poisonPer, perStack);
    e.poisonTime = duration;
  }

  /** 点燃：不叠层，再次点燃时刷新时间并取较高的伤害 */
  applyBurn(e: Enemy, dps: number): void {
    if (!e.active || dps <= 0) return;
    if (e.burnTime <= 0) {
      e.burnDps = dps;
      e.burnTick = 0;
    } else {
      e.burnDps = Math.max(e.burnDps, dps);
    }
    e.burnTime = BURN_DURATION;
  }

  /** 叠冰：叠满冻住；冻住期间和解冻后的免疫期内不叠 */
  applyFreeze(e: Enemy, stacks: number): void {
    if (!e.active || e.frozen > 0 || e.freezeImmune > 0) return;
    e.ice += stacks;
    e.iceTime = ICE_DECAY;
    if (e.ice < ICE_STACKS) return;
    e.ice = 0;
    e.iceTime = 0;
    if (e.def.boss) {
      this.applySlow(e, 1.5, BOSS_ICE_SLOW);
      return;
    }
    const k = e.def.elite ? FREEZE_TIME_ELITE / FREEZE_TIME : 1;
    e.frozen = (FREEZE_TIME + this.host.mods.freezeDuration) * k;
    e.kx = e.ky = 0;
    this.fx.burst(e.x, e.y, 0xd8f4ff, 7, 110, 0.75);
    sfx.play('freeze');
  }

  applyVulnerable(e: Enemy): void {
    if (!e.active) return;
    e.vulnTime = VULN_TIME;
  }

  applySlow(e: Enemy, time: number, mult: number): void {
    e.slowTime = Math.max(e.slowTime, time);
    e.slowMult = Math.min(e.slowTime > 0 ? e.slowMult : 1, mult);
  }

  /** 最近的、在 maxDist 范围内的敌人 */
  nearest(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD2 = Infinity;
    for (const e of this.active) {
      if (e.age < SPAWN_POP * 0.5) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      const reach = maxDist + e.radius;
      if (d2 < bestD2 && d2 <= reach * reach) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  /** 波次结束：所有敌人消散，不掉落 */
  clearAll(): void {
    this.strikes.length = 0;
    this.iceG.clear();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      this.fx.burst(e.x, e.y, 0x7a6a5a, 5, 90, 0.8);
      this.release(e);
    }
  }

  // ---------- 内部 ----------

  private die(e: Enemy, drops: boolean): void {
    const isTree = e.def.behavior === 'tree';
    const isLoot = e.def.behavior === 'lootbug';
    const big = e.def.boss ? 4 : e.def.elite || isLoot ? 2 : 1;
    sfx.play(big > 1 ? 'killBig' : 'kill');
    if (isTree) {
      this.fx.burst(e.x, e.y, 0x62c048, 9, 140, 0.9);
      this.fx.burst(e.x, e.y, 0x8a582c, 6, 110, 0.8);
    } else {
      this.fx.burst(e.x, e.y, isLoot ? 0xffd038 : 0x4a2030, 7 * big, 150 * Math.sqrt(big), 0.9 * big);
      this.fx.burst(e.x, e.y, isLoot ? 0xffffff : 0xb0d060, 4 * big, 110, 0.6 * big);
    }
    this.release(e);
    if (!drops) return;
    if (e.burnTime > 0) {
      this.spreadBurn(e);
      if (this.host.mods.burnExplode > 0 && !isTree) this.explodeBurn(e);
    }
    const split = e.def.splitInto;
    if (split) {
      for (let k = 0; k < split.count; k++) {
        const a = (k / split.count) * Math.PI * 2 + Math.random();
        this.spawnChild(split.id, e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12);
      }
    }
    this.onKilled?.(e);
  }

  /** 火焰 6 件套：灼烧怪死后火焰爆炸 */
  private explodeBurn(src: Enemy): void {
    const r = 74;
    const dmg = Math.max(8, Math.round(src.burnDps * 1.8 * (1 + this.host.mods.burnDamagePct)));
    this.fx.ring(src.x, src.y, r, 0xff7028);
    this.fx.burst(src.x, src.y, 0xff9a3a, 10, 190, 1);
    for (const o of this.grid.query(src.x, src.y, r + MAX_ENEMY_RADIUS, this.buf).slice()) {
      if (!o.active || o === src) continue;
      const dx = o.x - src.x;
      const dy = o.y - src.y;
      const rr = r + o.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.hit(o, dmg, false, dx / (Math.hypot(dx, dy) || 1), dy / (Math.hypot(dx, dy) || 1), 110, 'burn');
    }
  }

  /** 被灼烧的怪死亡时，火焰传给附近最近的一只怪 */
  private spreadBurn(e: Enemy): void {
    const r = BURN_SPREAD * (1 + this.host.mods.burnSpreadPct);
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const o of this.grid.query(e.x, e.y, r + MAX_ENEMY_RADIUS, this.buf)) {
      if (!o.active || o === e) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y) - o.radius;
      if (d < r && d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) return;
    this.applyBurn(best, e.burnDps);
    this.fx.burst(best.x, best.y, 0xffa040, 5, 90, 0.7);
  }

  private giveAffix(e: Enemy): void {
    const affix = Phaser.Utils.Array.GetRandom<EliteAffix>(['rage', 'shield', 'regen']);
    e.affix = affix;
    if (affix === 'rage') {
      e.speed *= 1.35;
      e.damage *= 1.25;
      e.skillDamage *= 1.25;
    } else if (affix === 'shield') {
      e.shieldHp = e.maxHp * SHIELD_AMOUNT;
    }
    const info = AFFIX_LABEL[affix];
    e.label = this.scene.add
      .text(e.x, e.y, info.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: 'bold',
        color: info.color,
        stroke: '#120c05',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.text - 1);
  }

  /** 雷暴落雷：预警结束时劈下，玩家在圈里就受伤 */
  private updateStrikes(dt: number): void {
    const h = this.host;
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.strikes.splice(i, 1);
      this.fx.bolt(s.x, s.y);
      sfx.play('lightning');
      this.fx.ring(s.x, s.y, s.r, 0xfff4a0);
      const dx = h.px - s.x;
      const dy = h.py - s.y;
      const rr = s.r + h.pr;
      if (dx * dx + dy * dy < rr * rr) h.hurtPlayer(s.damage);
    }
  }

  private updateStatus(e: Enemy, dt: number): void {
    if (e.affix === 'regen' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * REGEN_RATE * dt);
    if (e.slowTime > 0) e.slowTime -= dt;
    if (e.frozen > 0) {
      e.frozen -= dt;
      if (e.frozen <= 0) {
        e.frozen = 0;
        e.freezeImmune = FREEZE_IMMUNE;
      }
    } else if (e.freezeImmune > 0) {
      e.freezeImmune -= dt;
    }
    if (e.iceTime > 0) {
      e.iceTime -= dt;
      if (e.iceTime <= 0) e.ice = 0;
    }
    if (e.vulnTime > 0) e.vulnTime -= dt;
    if (e.burnTime > 0) {
      e.burnTime -= dt;
      e.burnTick += dt;
      if (e.burnTick >= BURN_TICK) {
        e.burnTick -= BURN_TICK;
        e.burnAcc += e.burnDps * BURN_TICK;
        const dmg = Math.floor(e.burnAcc);
        if (dmg >= 1) {
          e.burnAcc -= dmg;
          this.fx.burst(e.x, e.y - e.radius * 0.3, 0xff9a3a, 2, 70, 0.6);
          if (this.hit(e, dmg, false, 0, 0, 0, 'burn')) return;
        }
      }
      if (e.burnTime <= 0) {
        e.burnTime = 0;
        e.burnDps = 0;
        e.burnAcc = 0;
      }
    }
    if (e.poison > 0) {
      e.poisonTime -= dt;
      e.poisonTick += dt;
      if (e.poisonTick >= 1) {
        e.poisonTick -= 1;
        const dmg = Math.round(e.poison * e.poisonPer);
        if (dmg >= 1) this.hit(e, dmg, false, 0, 0, 0, 'poison');
      }
      if (e.poisonTime <= 0) {
        e.poison = 0;
        e.poisonTick = 0;
        e.poisonPer = 0;
      }
    }
  }

  private draw(e: Enemy, dt: number): void {
    const s = e.sprite;
    s.setPosition(e.x, e.y);
    const isTree = e.def.behavior === 'tree';
    const wob = e.frozen > 0 || isTree ? 0 : e.def.boss ? 0.03 : 0.14;
    s.setRotation(isTree ? 0 : e.heading + Math.sin(e.age * 16 + e.wobble) * wob);
    let scale = e.baseScale;
    if (e.age < SPAWN_POP) scale *= Phaser.Math.Easing.Back.Out(e.age / SPAWN_POP);
    if (e.def.behavior === 'bomber' && e.state === 1) scale *= 1 + (1 - e.timer) * 0.6;
    if (e.def.behavior === 'boss' && e.state === 21) scale *= 1 + Math.sin((1 - e.timer / 0.35) * Math.PI) * 0.25;
    s.setScale(scale);
    if (e.flash > 0) {
      e.flash -= dt;
      s.setTintFill(0xffffff);
    } else if (e.frozen > 0) {
      s.setTint(0x8fdcff);
    } else if (e.burnTime > 0) {
      s.setTint(0xffa060);
    } else if (e.poison > 0) {
      s.setTint(0xb8ff90);
    } else if (e.vulnTime > 0) {
      s.setTint(0xffb4c8);
    } else if (e.slowTime > 0 || e.ice > 0) {
      s.setTint(0xc0d8ff);
    } else if (e.def.behavior === 'charger' && e.state === 1) {
      s.setTint(0xff9a8a);
    } else if (e.affix && (e.affix !== 'shield' || e.shieldHp > 0)) {
      s.setTint(AFFIX_LABEL[e.affix].tint);
    } else {
      s.clearTint();
    }
    e.label?.setPosition(e.x, e.y - e.radius - 16);
    if (e.frozen > 0) this.drawIce(e);
    if (e.def.behavior === 'lootbug' || (isTree && e.hp < e.maxHp)) {
      const g = this.iceG;
      const bw = 28;
      const bh = 4;
      const bx = e.x - bw / 2;
      const by = e.y - e.radius - 10;
      g.fillStyle(0x050507, 0.85);
      g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle(isTree ? 0x62d858 : 0xffd038, 1);
      g.fillRect(bx, by, Math.max(2, bw * Math.max(0, e.hp / e.maxHp)), bh);
    }
  }

  /** 冻住时罩一层半透明冰壳，边上几根冰棱 */
  private drawIce(e: Enemy): void {
    const g = this.iceG;
    const r = e.radius + 5;
    const a = Math.min(1, e.frozen / 0.2);
    g.fillStyle(0xc8f0ff, 0.32 * a);
    g.fillCircle(e.x, e.y, r);
    g.lineStyle(1.6, 0xeafaff, 0.85 * a);
    g.strokeCircle(e.x, e.y, r);
    for (let k = 0; k < 5; k++) {
      const ang = e.wobble + (k / 5) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      g.fillStyle(0xeafaff, 0.8 * a);
      g.fillTriangle(e.x + c * (r - 2) - s * 2.5, e.y + s * (r - 2) + c * 2.5, e.x + c * (r - 2) + s * 2.5, e.y + s * (r - 2) - c * 2.5, e.x + c * (r + 5), e.y + s * (r + 5));
    }
  }

  /** 各种怪的行为，返回期望速度 */
  private behave(e: Enemy, dt: number): [number, number] {
    const h = this.host;
    const dx = h.px - e.x;
    const dy = h.py - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const ang = Math.atan2(dy, dx);

    switch (e.def.behavior) {
      case 'chase':
        return [ux * e.speed, uy * e.speed];

      case 'swarm': {
        // 走弧线绕着接近
        const a = ang + Math.sin(e.age * 3 + e.wobble) * 0.7;
        return [Math.cos(a) * e.speed, Math.sin(a) * e.speed];
      }

      case 'charger': {
        e.timer -= dt;
        if (e.state === 0) {
          if (e.timer <= 0 && d < 300) {
            e.state = 1;
            e.timer = 0.6;
            e.dirX = ux;
            e.dirY = uy;
            this.tel.line(e.x, e.y, ang, 230, 26, 0.6);
          }
          return [ux * e.speed, uy * e.speed];
        }
        if (e.state === 1) {
          if (e.timer <= 0) {
            e.state = 2;
            e.timer = 0.5;
          }
          return [0, 0];
        }
        if (e.timer <= 0) {
          e.state = 0;
          e.timer = 1.6;
        }
        const ds = e.def.dashSpeed ?? 400;
        return [e.dirX * ds, e.dirY * ds];
      }

      case 'ranged': {
        e.timer -= dt;
        if (e.timer <= 0 && d < 460) {
          h.shoot(e.x, e.y, ang, 260, e.skillDamage);
          sfx.play('spit');
          e.timer = 2.5;
          e.flash = 0.06;
        }
        if (d < 200) return [-ux * e.speed, -uy * e.speed];
        if (d > 300) return [ux * e.speed, uy * e.speed];
        const side = Math.sin(e.wobble) > 0 ? 1 : -1;
        return [-uy * side * e.speed * 0.5, ux * side * e.speed * 0.5];
      }

      case 'bomber': {
        if (e.state === 0) {
          if (d < 70) {
            e.state = 1;
            e.timer = 1;
            this.tel.circle(e.x, e.y, 90, 1);
          }
          return [ux * e.speed, uy * e.speed];
        }
        e.timer -= dt;
        if (e.timer <= 0) {
          // 自爆：不掉落
          const rr = 90 + h.pr;
          const px = h.px - e.x;
          const py = h.py - e.y;
          if (px * px + py * py < rr * rr) h.hurtPlayer(e.skillDamage);
          this.fx.ring(e.x, e.y, 90, 0xff9a6a);
          sfx.play('explode');
          this.fx.burst(e.x, e.y, 0xd89898, 18, 260, 1.2);
          this.die(e, false);
        }
        return [0, 0];
      }

      case 'summoner': {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 4;
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2;
            this.spawnChild('ant', e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26);
          }
        }
        if (d < 380) return [-ux * e.speed, -uy * e.speed];
        const side = Math.sin(e.wobble) > 0 ? 1 : -1;
        return [-uy * side * e.speed * 0.7, ux * side * e.speed * 0.7];
      }

      case 'elite':
        return this.behaveElite(e, dt, ux, uy, ang, d);

      case 'boss':
        return this.behaveBoss(e, dt, ux, uy, ang, d);

      case 'tree':
        return [0, 0];

      case 'lootbug': {
        // 限时逃跑：远离玩家并稍微避开地图边缘，11 秒没打死就钻回地下
        if (e.age > 11) {
          this.fx.burst(e.x, e.y, 0xffd038, 8, 120, 0.8);
          this.release(e);
          return [0, 0];
        }
        if (Math.random() < dt * 12) this.fx.burst(e.x, e.y, 0xffe478, 1, 45, 0.55);
        let fx = -ux;
        let fy = -uy;
        if (e.x < 180) fx += 0.9;
        else if (e.x > WORLD_WIDTH - 180) fx -= 0.9;
        if (e.y < 180) fy += 0.9;
        else if (e.y > WORLD_HEIGHT - 180) fy -= 0.9;
        const fl = Math.hypot(fx, fy) || 1;
        return [(fx / fl) * e.speed, (fy / fl) * e.speed];
      }
    }
  }

  /** 兵蚁：追一会儿 → 三连冲锋 → 地面震击 */
  private behaveElite(e: Enemy, dt: number, ux: number, uy: number, ang: number, d: number): [number, number] {
    const h = this.host;
    e.timer -= dt;
    switch (e.state) {
      case 0:
        if (e.timer <= 0) {
          e.state = 1;
          e.count = 3;
          e.timer = 0.5;
          e.dirX = ux;
          e.dirY = uy;
          this.tel.line(e.x, e.y, ang, 240, 44, 0.5);
            sfx.play('warn');
        }
        return [ux * e.speed, uy * e.speed];
      case 1:
        if (e.timer <= 0) {
          e.state = 2;
          e.timer = 0.4;
        }
        return [0, 0];
      case 2: {
        if (e.timer <= 0) {
          e.count--;
          if (e.count > 0) {
            e.state = 1;
            e.timer = 0.45;
            e.dirX = ux;
            e.dirY = uy;
            this.tel.line(e.x, e.y, ang, 240, 44, 0.45);
            sfx.play('warn');
          } else {
            e.state = 3;
            e.timer = 1;
            this.tel.circle(e.x, e.y, 130, 1);
            sfx.play('warn');
          }
        }
        const ds = e.def.dashSpeed ?? 480;
        return [e.dirX * ds, e.dirY * ds];
      }
      default:
        if (e.timer <= 0) {
          if (d < 130 + h.pr) h.hurtPlayer(e.skillDamage);
          this.fx.ring(e.x, e.y, 130, 0xffb070);
          this.fx.burst(e.x, e.y, 0x7a5a3a, 20, 260, 1.2);
          shake(this.scene, 140, 0.006);
          sfx.play('explode');
          e.state = 0;
          e.timer = 2.5;
        }
        return [0, 0];
    }
  }

  /** 螳螂女王：扇形斩、跳跃砸地；半血以下狂暴，召唤若虫、连斩、变快 */
  private behaveBoss(e: Enemy, dt: number, ux: number, uy: number, ang: number, d: number): [number, number] {
    const h = this.host;
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true;
      e.timer2 = 0;
      this.fx.number(e.x, e.y - 60, '狂暴！', 'crit');
    }
    // 雷暴难度：30% 血以下全场落雷
    if (h.difficulty.bossPhase3 && e.hp < e.maxHp * 0.3) {
      if (!e.storm) {
        e.storm = true;
        e.timer3 = 0.5;
        this.fx.number(e.x, e.y - 60, '雷暴！', 'crit');
      }
      e.timer3 -= dt;
      if (e.timer3 <= 0) {
        e.timer3 = 1.3;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2;
          const r = k === 0 ? 0 : 80 + Math.random() * 160;
          const x = Phaser.Math.Clamp(h.px + Math.cos(a) * r, 40, WORLD_WIDTH - 40);
          const y = Phaser.Math.Clamp(h.py + Math.sin(a) * r, 40, WORLD_HEIGHT - 40);
          this.strikes.push({ x, y, r: 70, t: 0.9, damage: e.skillDamage * 0.6 });
          this.tel.circle(x, y, 70, 0.9);
        }
      }
    }
    if (e.enraged) {
      e.timer2 -= dt;
      if (e.timer2 <= 0) {
        e.timer2 = 8;
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          this.spawnChild('nymph', e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50);
        }
      }
    }
    const spd = e.speed * (e.enraged ? 1.3 : 1);
    e.timer -= dt;
    switch (e.state) {
      case 0:
        if (e.timer <= 0) {
          if (d < 240 || Math.random() < 0.3) {
            e.state = 10;
            e.count = e.enraged ? 2 : 1;
            e.timer = 0.7;
            e.tx = ang;
            this.tel.fan(e.x, e.y, 190, ang, 0.95, 0.7);
            sfx.play('warn');
          } else {
            e.state = 20;
            e.timer = 0.9;
            e.tx = h.px;
            e.ty = h.py;
            this.tel.circle(h.px, h.py, 120, 0.9);
            sfx.play('warn');
          }
          return [0, 0];
        }
        return [ux * spd, uy * spd];
      case 10:
        if (e.timer <= 0) {
          // 扇形斩
          const diff = Math.abs(Phaser.Math.Angle.Wrap(ang - e.tx));
          if (d < 190 + h.pr && diff < 0.95) h.hurtPlayer(e.skillDamage);
          this.fx.ring(e.x + Math.cos(e.tx) * 90, e.y + Math.sin(e.tx) * 90, 70, 0xe8f0c0);
          e.count--;
          if (e.count > 0) {
            e.timer = 0.45;
            e.tx = ang;
            this.tel.fan(e.x, e.y, 190, ang, 0.95, 0.45);
            sfx.play('warn');
          } else {
            e.state = 0;
            e.timer = e.enraged ? 1 : 1.6;
          }
        }
        return [0, 0];
      case 20:
        if (e.timer <= 0) {
          e.state = 21;
          e.timer = 0.35;
          e.sx = e.x;
          e.sy = e.y;
        }
        return [0, 0];
      default: {
        // 跳跃中：直接插值到落点
        const k = 1 - Math.max(0, e.timer) / 0.35;
        e.x = Phaser.Math.Linear(e.sx, e.tx, k);
        e.y = Phaser.Math.Linear(e.sy, e.ty, k);
        if (e.timer <= 0) {
          const px = h.px - e.x;
          const py = h.py - e.y;
          const rr = 120 + h.pr;
          if (px * px + py * py < rr * rr) h.hurtPlayer(e.skillDamage);
          this.fx.ring(e.x, e.y, 120, 0xffb070);
          this.fx.burst(e.x, e.y, 0x6a5a3a, 26, 300, 1.4);
          shake(this.scene, 200, 0.01);
          sfx.play('explode');
          e.state = 0;
          e.timer = e.enraged ? 0.8 : 1.2;
        }
        return [0, 0];
      }
    }
  }

  private release(e: Enemy): void {
    if (!e.active) return;
    const last = this.active.pop()!;
    if (last !== e) {
      this.active[e.index] = last;
      last.index = e.index;
    }
    e.index = -1;
    e.active = false;
    e.sprite.setVisible(false);
    e.label?.destroy();
    e.label = null;
    this.pool.push(e);
  }
}
