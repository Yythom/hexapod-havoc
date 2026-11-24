import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, FONT_FAMILY, MAX_ENEMIES, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { sfx } from '../audio/sfx';
import { AFFIX_LABEL, type DifficultyDef, type EliteAffix } from '../data/difficulty';
import { ENEMIES, enemyDamage, enemyHp, enemySkillDamage, type EnemyDef } from '../data/enemies';
import type { Mods } from '../data/items';
import type { Effects } from './Effects';
import type { EnemyShotKind } from './EnemyShots';
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

/** 地面延迟斩击（镰刃螳虫 V 字斩 / 曜石甲像 X 斩） */
interface GroundSlash {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
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
  /** Brotato 的诅咒：提高敌人生命/伤害 */
  readonly curse: number;
  /** 每日挑战等特殊词条给怪物的移速倍率 */
  readonly enemySpeedMult?: number;
  /** 爆裂派对：气囊虫自爆/被击杀对周围敌群造成强力连锁伤害 */
  readonly boomParty?: boolean;
  /** 落雷劈中水洼导电回调 */
  onLightningStrike?(x: number, y: number, damage: number): void;
  /** 对玩家造成伤害（走闪避、甲壳、无敌时间） */
  hurtPlayer(damage: number): void;
  shoot(x: number, y: number, angle: number, speed: number, damage: number, kind?: EnemyShotKind): void;
}

export type HitKind = 'normal' | 'poison' | 'burn';

export class Enemy {
  readonly sprite: Phaser.GameObjects.Image;
  def!: EnemyDef;
  index = -1;
  hp = 0;
  /** 最后一次命中是否为暴击（猎手战利品暴击击杀判定用） */
  lastHitCrit = false;
  /** 最后一次命中是否为近战武器（棘球毒虫亡语近战截断判定用） */
  lastHitMelee = false;
  /** 多阶段精英的当前血量阶段（曜石甲像 0→1→2） */
  phase = 0;
  maxHp = 0;
  damage = 0;
  skillDamage = 0;
  speed = 0;
  baseSpeed = 0;
  /** 是否受到狂化鸣蝉（Buffer）强化：血量/移速/伤害提升且全身泛红光环 */
  buffed = false;
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
  /** 受击挤压弹跳（Squash & Stretch） */
  squash = 0;
  squashAmp = 0;
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
  /** 踩进雨天/露珠水洼后的潮湿剩余时间（受冰/电/元素伤 +25%，移速 -10%） */
  wetTime = 0;
  /** 紫火诅咒变异怪（血厚、微强、击杀双倍花蜜 + 额外宝箱率） */
  cursed = false;

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
  private readonly supportBuf: Enemy[] = [];
  private readonly strikes: Strike[] = [];
  private readonly slashes: GroundSlash[] = [];
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
    const curseMult = 1 + Math.max(0, this.host.curse) * 0.01;
    e.maxHp = e.hp = enemyHp(def, wave) * mult * curseMult;
    e.lastHitCrit = false;
    e.lastHitMelee = false;
    e.phase = 0;
    e.damage = enemyDamage(def, wave) * mult * curseMult;
    e.skillDamage = enemySkillDamage(def, wave) * mult * curseMult;
    e.speed = def.speed * (def.boss || def.elite ? 1 : Phaser.Math.FloatBetween(0.92, 1.08)) * (this.host.enemySpeedMult ?? 1);
    e.baseSpeed = e.speed;
    e.buffed = false;
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
    e.squash = 0;
    e.squashAmp = 0;
    e.wobble = Math.random() * Math.PI * 2;
    e.heading = Math.random() * Math.PI * 2;
    e.state = 0;
    e.timer =
      def.behavior === 'egg'
        ? 5.0
        : def.behavior === 'ranged'
          ? 1 + Math.random() * 1.5
          : def.behavior === 'slasher'
            ? 1.4 + Math.random() * 0.7
            : def.behavior === 'lamprey'
              ? 0.8 + Math.random() * 0.4
              : def.behavior === 'spitter'
                ? 1.1 + Math.random() * 0.8
                : def.behavior === 'elite' || def.behavior === 'elite_gargoyle'
                  ? 1.8
                  : def.behavior === 'summoner'
                    ? 2.5
                    : 1.2;
    e.timer2 = 0;
    e.count = 0;
    e.enraged = false;
    e.poison = e.poisonTime = e.poisonTick = 0;
    e.slowTime = 0;
    e.slowMult = 1;
    e.burnTime = e.burnDps = e.burnTick = e.burnAcc = 0;
    e.ice = e.iceTime = e.frozen = e.freezeImmune = 0;
    e.vulnTime = 0;
    e.wetTime = 0;
    e.cursed = false;
    if (
      this.host.curse > 0 &&
      !def.boss &&
      def.behavior !== 'tree' &&
      def.behavior !== 'lootbug' &&
      def.behavior !== 'egg' &&
      def.behavior !== 'curse_slug' &&
      Math.random() < Math.min(0.45, 0.06 + this.host.curse * 0.025)
    ) {
      e.cursed = true;
      e.maxHp = e.hp = e.maxHp * 2.0;
      e.speed *= 1.15;
      e.baseSpeed = e.speed;
      e.damage *= 1.25;
      e.skillDamage *= 1.25;
      e.baseScale *= 1.14;
    }
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
    this.updateSlashes(dt);
    this.iceG.clear();
    const grid = this.grid;
    grid.clear();
    for (const e of this.active) grid.insert(e);

    const decay = Math.exp(-KNOCKBACK_DECAY * dt);
    // 用快照遍历，避免毒/烧/自爆触发尸爆或毒菇连锁击杀多只怪时，swap-pop 导致倒序下标越界崩溃
    for (const e of this.active.slice()) {
      if (!e.active) continue;
      e.age += dt;
      this.updateStatus(e, dt);
      if (!e.active) continue;

      const frozen = e.frozen > 0;
      const [vx0, vy0] = e.age >= SPAWN_POP && !frozen ? this.behave(e, dt) : [0, 0];
      if (!e.active) continue;
      const slow = (e.slowTime > 0 ? e.slowMult : 1) * (1 - ICE_SLOW * e.ice) * (e.wetTime > 0 ? 0.9 : 1);
      let vx = vx0 * slow;
      let vy = vy0 * slow;

      // 互相推开，避免叠成一坨（Boss、蜜树和魔卵不被推）
      if (!e.def.boss && e.def.behavior !== 'tree' && e.def.behavior !== 'egg') {
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

      const nx = e.x + vx * dt;
      const ny = e.y + vy * dt;
      if (e.def.behavior === 'mummy') {
        if (nx <= EDGE || nx >= WORLD_WIDTH - EDGE) e.kx = -e.kx * 0.85;
        if (ny <= EDGE || ny >= WORLD_HEIGHT - EDGE) e.ky = -e.ky * 0.85;
      }
      e.x = Phaser.Math.Clamp(nx, EDGE, WORLD_WIDTH - EDGE);
      e.y = Phaser.Math.Clamp(ny, EDGE, WORLD_HEIGHT - EDGE);
      if (!frozen && e.def.behavior !== 'tree' && e.def.behavior !== 'egg') {
        const face = Math.hypot(vx0, vy0) > 1 ? Math.atan2(vy0, vx0) : Math.atan2(this.host.py - e.y, this.host.px - e.x);
        e.heading = Phaser.Math.Angle.RotateTo(e.heading, face, (e.def.boss ? 3 : 8) * dt);
      }
      this.draw(e, dt);
    }
  }

  /** 造成伤害，返回是否击杀 */
  hit(e: Enemy, damage: number, crit: boolean, dirX: number, dirY: number, knockback: number, kind: HitKind = 'normal', melee = false): boolean {
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
      e.lastHitCrit = crit;
      e.lastHitMelee = melee;
      e.flash = 0.07;
      // 受击挤压弹跳：暴击/精英/Boss/重击更 Q 弹，增强打击实感
      const amp = crit ? 0.3 : e.def.elite || e.def.boss ? 0.22 : knockback >= 110 ? 0.18 : 0.12;
      e.squash = 0.16;
      e.squashAmp = Math.max(e.squashAmp, amp);
      const resist = e.def.knockbackResist ?? 0;
      let kxDir = dirX;
      let kyDir = dirY;
      if (e.def.behavior === 'mummy' && knockback > 20) {
        // 滚球毛虫（Mummy）：高击退会带轻微台球斜弹角并飙出尘花
        const jitter = (Math.random() - 0.5) * 0.65;
        const c = Math.cos(jitter);
        const sn = Math.sin(jitter);
        kxDir = dirX * c - dirY * sn;
        kyDir = dirX * sn + dirY * c;
        this.fx.burst(e.x, e.y, 0xead8a8, 3, 120, 0.65);
      }
      const kbScale = 1 - resist;
      e.kx += kxDir * knockback * kbScale;
      e.ky += kyDir * knockback * kbScale;
      const kLen = Math.hypot(e.kx, e.ky);
      if (kLen > 780) {
        e.kx = (e.kx / kLen) * 780;
        e.ky = (e.ky / kLen) * 780;
      }
      this.fx.number(e.x, e.y - e.radius - 6, damage, crit ? 'crit' : 'normal');
      sfx.play(crit ? 'crit' : 'hit');
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
    this.fx.iceShatter(e.x, e.y, e.radius * 0.9, 5);
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
    this.slashes.length = 0;
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
    const wasFrozen = e.frozen > 0;
    const big = e.def.boss ? 4 : e.def.elite || isLoot ? 2 : 1;
    sfx.play(big > 1 ? 'killBig' : 'kill');
    if (wasFrozen) {
      // 冻住的敌人被击杀时炸出锐利冰碴
      this.fx.iceShatter(e.x, e.y, e.radius * 1.25, 9 * Math.min(2, big));
      this.fx.ring(e.x, e.y, e.radius + 18, 0x9ceeff);
    } else if (isTree) {
      if (e.def.id !== 'boomshroom') {
        this.fx.burst(e.x, e.y, 0x62c048, 9, 140, 0.9);
        this.fx.burst(e.x, e.y, 0x8a582c, 6, 110, 0.8);
      }
    } else {
      this.fx.burst(e.x, e.y, isLoot ? 0xffd038 : 0x4a2030, 7 * big, 150 * Math.sqrt(big), 0.9 * big);
      this.fx.burst(e.x, e.y, isLoot ? 0xffffff : 0xb0d060, 4 * big, 110, 0.6 * big);
    }
    if (e.def.elite || e.def.boss) {
      this.fx.hitSlash(e.x, e.y, Math.random() * Math.PI, 0xffe468, e.def.boss ? 1.85 : 1.45);
    }
    this.release(e);
    if (!drops) return;
    if (e.burnTime > 0) {
      this.spreadBurn(e);
      if (this.host.mods.burnExplode > 0 && !isTree) this.explodeBurn(e);
    }
    if (e.def.behavior === 'puffer') {
      // 棘球毒虫（原版河豚）：远程/毒烧击杀 8 向爆出慢速弹幕，近战劈死精准截断不爆！
      if (e.lastHitMelee) {
        this.fx.ring(e.x, e.y, e.radius + 16, 0x78f4d8);
      } else {
        const baseA = Math.random() * Math.PI * 2;
        for (let k = 0; k < 8; k++) {
          const a = baseA + (k / 8) * Math.PI * 2;
          this.host.shoot(e.x, e.y, a, 155, e.skillDamage, 'orb');
        }
        this.fx.ring(e.x, e.y, 48, 0xff3878);
        sfx.play('spit');
      }
    }
    const split = e.def.splitInto;
    if (split) {
      if (e.def.id === 'spawner') this.fx.ring(e.x, e.y, 44, 0xd458d8);
      for (let k = 0; k < split.count; k++) {
        const a = (k / split.count) * Math.PI * 2 + Math.random();
        this.spawnChild(split.id, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
      }
    }
    this.onKilled?.(e);
  }

  /** 火焰 6 件套：灼烧怪死后火焰爆炸 */
  private explodeBurn(src: Enemy): void {
    const r = 74;
    const dmg = Math.max(8, Math.round(src.burnDps * 1.8 * (1 + this.host.mods.burnDamagePct)));
    this.fx.explosion(src.x, src.y, r, 0xff6e28, 1);
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

  /** 登记一条延迟劈落的地面斩击带（同步创建红色地面预警带） */
  private queueGroundSlash(x: number, y: number, angle: number, length: number, width: number, delay: number, damage: number): void {
    this.slashes.push({ x, y, angle, length, width, t: delay, damage });
    this.tel.line(x, y, angle, length, width, delay);
  }

  /** 地面斩击结算：计时归零时沿线爆发猩红刀光，玩家踩在斩击带内即受伤 */
  private updateSlashes(dt: number): void {
    const h = this.host;
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.slashes.splice(i, 1);
      const c = Math.cos(s.angle);
      const sn = Math.sin(s.angle);
      const x1 = s.x + c * s.length;
      const y1 = s.y + sn * s.length;
      const mx = (s.x + x1) * 0.5;
      const my = (s.y + y1) * 0.5;
      this.fx.hitSlash(mx, my, s.angle, 0xff3b58, Math.max(1.2, s.length / 115));
      this.fx.burst(s.x, s.y, 0xff5468, 4, 110, 0.7);
      this.fx.burst(x1, y1, 0xff5468, 4, 110, 0.7);
      sfx.play('spit');
      // 点到线段最近距离判定
      const vx = x1 - s.x;
      const vy = y1 - s.y;
      const len2 = vx * vx + vy * vy || 1;
      const proj = Phaser.Math.Clamp(((h.px - s.x) * vx + (h.py - s.y) * vy) / len2, 0, 1);
      const cx = s.x + vx * proj;
      const cy = s.y + vy * proj;
      const hitR = s.width * 0.5 + h.pr * 0.85;
      if ((h.px - cx) ** 2 + (h.py - cy) ** 2 <= hitR * hitR) {
        h.hurtPlayer(s.damage);
      }
    }
  }

  /** 雷暴落雷：预警结束时劈下，玩家在圈里就受伤，同时可引怪借天雷劈杀 */
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
      const enemyStrikeDmg = Math.max(12, Math.round(s.damage * 4.2));
      for (const e of this.grid.query(s.x, s.y, s.r + MAX_ENEMY_RADIUS, this.buf).slice()) {
        if (!e.active || e.def.behavior === 'tree') continue;
        const ex = e.x - s.x;
        const ey = e.y - s.y;
        if (ex * ex + ey * ey > (s.r + e.radius) ** 2) continue;
        const d = Math.hypot(ex, ey) || 1;
        this.hit(e, e.def.boss ? Math.round(enemyStrikeDmg * 0.4) : enemyStrikeDmg, false, ex / d, ey / d, 180);
      }
      h.onLightningStrike?.(s.x, s.y, enemyStrikeDmg);
    }
  }

  private updateStatus(e: Enemy, dt: number): void {
    if (e.affix === 'regen' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * REGEN_RATE * dt);
    if (e.slowTime > 0) e.slowTime -= dt;
    if (e.wetTime > 0) e.wetTime = Math.max(0, e.wetTime - dt);
    if (e.frozen > 0) {
      e.frozen -= dt;
      if (e.frozen <= 0) {
        e.frozen = 0;
        e.freezeImmune = FREEZE_IMMUNE;
        // 解除冰冻时炸出几片锐利冰碴
        this.fx.iceShatter(e.x, e.y, e.radius, 5);
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
        if (dmg >= 1) {
          this.fx.poisonBubbles(e.x, e.y, 1);
          this.hit(e, dmg, false, 0, 0, 0, 'poison');
        }
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
    const isEgg = e.def.behavior === 'egg';
    const wob = e.frozen > 0 || isTree ? 0 : e.def.boss ? 0.03 : 0.14;
    if (isEgg) {
      const urgency = Phaser.Math.Clamp(1 - e.timer / 5, 0, 1);
      s.setRotation(Math.sin(e.age * (12 + urgency * 28) + e.wobble) * (0.04 + urgency * 0.14));
    } else {
      s.setRotation(isTree ? 0 : e.heading + Math.sin(e.age * 16 + e.wobble) * wob);
    }
    let scale = e.baseScale;
    if (e.age < SPAWN_POP) scale *= Phaser.Math.Easing.Back.Out(e.age / SPAWN_POP);
    if (e.buffed) scale *= 1.16;
    if (isEgg) {
      const urgency = Phaser.Math.Clamp(1 - e.timer / 5, 0, 1);
      scale *= 1 + urgency * 0.18 + Math.sin(e.age * (8 + urgency * 18)) * 0.06;
    }
    if (e.def.behavior === 'bomber' && e.state === 1) scale *= 1 + (1 - e.timer) * 0.6;
    if (e.def.behavior === 'boss' && e.state === 21) scale *= 1 + Math.sin((1 - e.timer / 0.35) * Math.PI) * 0.25;
    if (e.squash > 0) {
      e.squash = Math.max(0, e.squash - dt);
      const k = e.squash / 0.16;
      const sq = Math.sin((1 - k) * Math.PI * 2.2) * e.squashAmp * k;
      s.setScale(scale * (1 + sq), scale * (1 - sq * 0.72));
      if (e.squash <= 0) e.squashAmp = 0;
    } else {
      s.setScale(scale);
    }
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
    } else if ((e.def.behavior === 'charger' || e.def.behavior === 'lamprey') && e.state === 1) {
      s.setTint(0xff9a8a);
    } else if (e.buffed) {
      s.setTint(0xff7878);
    } else if (e.def.behavior === 'elite_gargoyle' && e.phase >= 2) {
      s.setTint(0xff8ca8);
    } else if (e.affix && (e.affix !== 'shield' || e.shieldHp > 0)) {
      s.setTint(AFFIX_LABEL[e.affix].tint);
    } else if (e.cursed) {
      s.setTint(0xd08cff);
    } else {
      s.clearTint();
    }
    e.label?.setPosition(e.x, e.y - e.radius - 16);
    if (e.buffed) {
      // 土豆兄弟经典 Buffer 特征：被强化的敌人周身带醒目赤红轮廓圈
      const g = this.iceG;
      g.lineStyle(2.4, 0xff3b44, 0.85);
      g.strokeCircle(e.x, e.y, e.radius * 1.18 + 3);
    }
    if (e.cursed) {
      const g = this.iceG;
      g.lineStyle(2.4, 0xc058ff, 0.86);
      g.strokeCircle(e.x, e.y, e.radius + (e.buffed ? 8 : 4) + Math.sin(e.age * 8) * 1.4);
      if (Math.random() < dt * 7) this.fx.burst(e.x, e.y, 0xc854ff, 1, 48, 0.52);
    }
    if (isEgg) {
      // 魔卵 5 秒孵化倒计时圆弧环
      const g = this.iceG;
      const prog = Phaser.Math.Clamp(1 - e.timer / 5, 0, 1);
      const r = e.radius + 7;
      g.lineStyle(3.2, 0x050507, 0.72);
      g.strokeCircle(e.x, e.y, r);
      g.lineStyle(2.4, prog > 0.65 ? 0xff3b48 : 0xffc848, 0.96);
      g.beginPath();
      g.arc(e.x, e.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog, false);
      g.strokePath();
    }
    if (e.def.behavior === 'curse_slug') {
      const g = this.iceG;
      const pulse = 0.7 + 0.3 * Math.sin(e.age * 6 + e.wobble);
      g.lineStyle(2.0, 0xb65cff, 0.78 * pulse);
      g.strokeCircle(e.x, e.y, e.radius + 5);
    }
    if (e.def.behavior === 'elite_gargoyle' && e.phase > 0) {
      const g = this.iceG;
      g.lineStyle(2.6, e.phase >= 2 ? 0xff3858 : 0xd058ff, 0.86);
      g.strokeCircle(e.x, e.y, e.radius + 6);
    }
    if (e.wetTime > 0) {
      const g = this.iceG;
      g.lineStyle(1.4, 0x62d8ff, 0.65);
      g.strokeCircle(e.x, e.y, e.radius + 2);
    }
    if (e.frozen > 0) this.drawIce(e);
    if (e.def.behavior === 'lootbug' || isEgg || (isTree && e.hp < e.maxHp)) {
      const g = this.iceG;
      const bw = 28;
      const bh = 4;
      const bx = e.x - bw / 2;
      const by = e.y - e.radius - 10;
      g.fillStyle(0x050507, 0.85);
      g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle(isEgg ? 0xff6a78 : e.def.id === 'boomshroom' ? 0xff6288 : e.def.id === 'deworb' ? 0x62e2ff : isTree ? 0x62d858 : 0xffd038, 1);
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
          // 自爆：对玩家与周围敌人同样有冲击（爆裂派对下友伤翻 3 倍）
          const r = 90;
          const rr = r + h.pr;
          const px = h.px - e.x;
          const py = h.py - e.y;
          if (px * px + py * py < rr * rr) h.hurtPlayer(e.skillDamage);
          const splashDmg = Math.max(8, Math.round(e.maxHp * (h.boomParty ? 2.4 : 0.65)));
          for (const o of this.grid.query(e.x, e.y, r + MAX_ENEMY_RADIUS, this.buf).slice()) {
            if (!o.active || o === e || o.def.behavior === 'tree') continue;
            const ox = o.x - e.x;
            const oy = o.y - e.y;
            if (ox * ox + oy * oy > (r + o.radius) ** 2) continue;
            const od = Math.hypot(ox, oy) || 1;
            this.hit(o, o.def.boss ? Math.round(splashDmg * 0.35) : splashDmg, false, ox / od, oy / od, 160);
          }
          this.fx.explosion(e.x, e.y, r, 0xff7858, 1);
          sfx.play('explode');
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

      case 'pursuer': {
        // 疾影猎虫（Pursuer）：存活越久越快，最高叠到基础移速 2.4 倍，逼迫优先击杀
        e.speed = Math.min(e.baseSpeed * 2.4, e.speed + 14 * dt);
        if (e.speed > e.baseSpeed * 1.45 && Math.random() < dt * 10) {
          this.fx.burst(e.x, e.y, 0xff7a34, 1, 55, 0.55);
        }
        return [ux * e.speed, uy * e.speed];
      }

      case 'buffer': {
        // 狂化鸣蝉（Buffer）：远离玩家躲在虫群后方，周期给周围友军挂上狂化 Buff（血+100%/速+45%/伤+25%）
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 2.6;
          const R = 225;
          const near = this.grid.query(e.x, e.y, R, this.supportBuf);
          let applied = 0;
          for (const ally of near) {
            if (!ally.active || ally === e || ally.buffed) continue;
            if (
              ally.def.boss ||
              ally.def.behavior === 'tree' ||
              ally.def.behavior === 'lootbug' ||
              ally.def.behavior === 'buffer' ||
              ally.def.behavior === 'egg' ||
              ally.def.behavior === 'curse_slug'
            ) {
              continue;
            }
            if ((ally.x - e.x) ** 2 + (ally.y - e.y) ** 2 > R * R) continue;
            ally.buffed = true;
            ally.maxHp *= 2;
            ally.hp *= 2;
            ally.speed *= 1.45;
            ally.baseSpeed *= 1.45;
            ally.damage *= 1.25;
            ally.skillDamage *= 1.25;
            ally.flash = 0.08;
            applied++;
            if (applied >= 6) break;
          }
          if (applied > 0) {
            this.fx.ring(e.x, e.y, R, 0xff4048);
            this.fx.burst(e.x, e.y, 0xff5a50, 8, 120, 0.85);
            e.flash = 0.08;
          }
        }
        if (d < 360) return [-ux * e.speed, -uy * e.speed];
        const side = Math.sin(e.wobble) > 0 ? 1 : -1;
        return [-uy * side * e.speed * 0.72, ux * side * e.speed * 0.72];
      }

      case 'healer': {
        // 绿露医虫（Healer）：贴近受伤虫群，周期释放翠绿治疗波为周围友军回血
        e.timer -= dt;
        const R = 215;
        if (e.timer <= 0) {
          e.timer = 2.5;
          const healBase = Math.round((32 + 14 * h.wave) * h.difficulty.mult);
          const near = this.grid.query(e.x, e.y, R, this.supportBuf);
          let healed = 0;
          for (const ally of near) {
            if (!ally.active || ally === e || ally.hp >= ally.maxHp) continue;
            if (ally.def.behavior === 'tree' || ally.def.behavior === 'lootbug') continue;
            if ((ally.x - e.x) ** 2 + (ally.y - e.y) ** 2 > R * R) continue;
            const amount = ally.def.boss ? Math.round(healBase * 0.5) : healBase;
            ally.hp = Math.min(ally.maxHp, ally.hp + amount);
            this.fx.burst(ally.x, ally.y - ally.radius * 0.4, 0x5de878, 3, 65, 0.65);
            healed++;
          }
          if (healed > 0) {
            this.fx.ring(e.x, e.y, R, 0x5de878);
            e.flash = 0.08;
          }
        }
        // 优先靠近附近血量最低的友军，同时保持与玩家的安全距离
        let target: Enemy | null = null;
        let bestRatio = 0.99;
        for (const ally of this.grid.query(e.x, e.y, 340, this.supportBuf)) {
          if (!ally.active || ally === e || ally.def.behavior === 'tree' || ally.def.behavior === 'lootbug') continue;
          const ratio = ally.hp / Math.max(1, ally.maxHp);
          if (ratio < bestRatio) {
            bestRatio = ratio;
            target = ally;
          }
        }
        if (d < 210) return [-ux * e.speed, -uy * e.speed];
        if (target) {
          const tx = target.x - e.x;
          const ty = target.y - e.y;
          const td = Math.hypot(tx, ty) || 1;
          if (td > 75) return [(tx / td) * e.speed, (ty / td) * e.speed];
        }
        const side = Math.sin(e.wobble) > 0 ? 1 : -1;
        return [-uy * side * e.speed * 0.65, ux * side * e.speed * 0.65];
      }

      case 'egg': {
        // 镰斩魔卵：原地 5 秒倒计时，打不爆就破壳孵出高回报的镰刃螳虫
        e.timer -= dt;
        if (e.timer <= 0) {
          const ex = e.x;
          const ey = e.y;
          this.fx.ring(ex, ey, 44, 0xff5a68);
          this.fx.burst(ex, ey, 0xffa858, 12, 160, 0.9);
          sfx.play('warn');
          this.die(e, false);
          this.spawnChild('slasher', ex, ey);
        }
        return [0, 0];
      }

      case 'slasher': {
        // 镰刃螳虫：中距游走，在玩家脚下两侧画 V 字形地面红带预警斩击，专克原地站桩
        e.timer -= dt;
        if (e.timer <= 0 && d < 460) {
          e.timer = 2.65;
          const halfLen = 100;
          const len = halfLen * 2;
          const spread = 0.66; // ±38° 交叉 V/X 斩封走位
          for (const sign of [-1, 1]) {
            const a = ang + sign * spread;
            const sx = h.px - Math.cos(a) * halfLen;
            const sy = h.py - Math.sin(a) * halfLen;
            this.queueGroundSlash(sx, sy, a, len, 28, 0.8, e.skillDamage);
          }
          e.flash = 0.08;
          sfx.play('warn');
        }
        if (d < 150) return [-ux * e.speed, -uy * e.speed];
        if (d > 275) return [ux * e.speed, uy * e.speed];
        const side = Math.sin(e.wobble) > 0 ? 1 : -1;
        return [-uy * side * e.speed * 0.68, ux * side * e.speed * 0.68];
      }

      case 'puffer': {
        // 棘球毒虫：摇摆追击，非近战击杀在 die() 中 8 向爆弹幕
        const a = ang + Math.sin(e.age * 2.4 + e.wobble) * 0.35;
        return [Math.cos(a) * e.speed, Math.sin(a) * e.speed];
      }

      case 'lamprey': {
        // 噬蜜飞鳗（诱饵甜果专属突袭怪）：冲锋并在冲刺途中向左右两侧甩出弹幕
        e.timer -= dt;
        if (e.state === 0) {
          if (e.timer <= 0 && d < 360) {
            e.state = 1;
            e.timer = 0.48;
            e.dirX = ux;
            e.dirY = uy;
            this.tel.line(e.x, e.y, ang, 230, 26, 0.48);
            sfx.play('warn');
          }
          return [ux * e.speed, uy * e.speed];
        }
        if (e.state === 1) {
          if (e.timer <= 0) {
            e.state = 2;
            e.timer = 0.56;
            e.timer2 = 0.12;
          }
          return [0, 0];
        }
        e.timer2 -= dt;
        if (e.timer2 <= 0) {
          e.timer2 = 0.17;
          const dashAng = Math.atan2(e.dirY, e.dirX);
          h.shoot(e.x, e.y, dashAng + Math.PI / 2, 165, e.skillDamage, 'orb');
          h.shoot(e.x, e.y, dashAng - Math.PI / 2, 165, e.skillDamage, 'orb');
          sfx.play('spit');
        }
        if (e.timer <= 0) {
          e.state = 0;
          e.timer = 1.45;
        }
        const ds = e.def.dashSpeed ?? 390;
        return [e.dirX * ds, e.dirY * ds];
      }

      case 'spitter': {
        // 吐酸幼虫（腐巢母虫亡语爆出）：游走散射弹幕小怪
        e.timer -= dt;
        if (e.timer <= 0 && d < 440) {
          e.timer = 2.2;
          const jitter = (Math.random() - 0.5) * 0.32;
          h.shoot(e.x, e.y, ang + jitter, 210, e.skillDamage, 'orb');
          e.flash = 0.06;
          sfx.play('spit');
        }
        const a = ang + Math.sin(e.age * 2.6 + e.wobble) * 1.1;
        if (d < 165) return [-ux * e.speed, -uy * e.speed];
        if (d > 310) return [ux * e.speed, uy * e.speed];
        return [Math.cos(a) * e.speed * 0.85, Math.sin(a) * e.speed * 0.85];
      }

      case 'curse_slug': {
        // 厄运紫蛞蝓（Sea Pig）：温顺游走并轻度避开玩家，击杀永久 +1 诅咒与额外花蜜
        let fx = Math.cos(e.age * 0.9 + e.wobble) * 0.7;
        let fy = Math.sin(e.age * 0.9 + e.wobble) * 0.7;
        if (d < 175) {
          fx -= ux * 1.1;
          fy -= uy * 1.1;
        }
        if (e.x < 160) fx += 0.9;
        else if (e.x > WORLD_WIDTH - 160) fx -= 0.9;
        if (e.y < 160) fy += 0.9;
        else if (e.y > WORLD_HEIGHT - 160) fy -= 0.9;
        const fl = Math.hypot(fx, fy) || 1;
        return [(fx / fl) * e.speed, (fy / fl) * e.speed];
      }

      case 'mummy':
        // 滚球毛虫（Mummy）：稳步滚向玩家，超高负击退抗性带来台球弹射机制
        return [ux * e.speed, uy * e.speed];

      case 'elite':
        return this.behaveElite(e, dt, ux, uy, ang, d);

      case 'elite_hornet':
        return this.behaveHornetElite(e, dt, ux, uy, ang, d);

      case 'elite_gargoyle':
        return this.behaveGargoyleElite(e, dt, ux, uy, ang, d);

      case 'boss':
        return this.behaveBoss(e, dt, ux, uy, ang, d);

      case 'boss_goliath':
        return this.behaveGoliathBoss(e, dt, ux, uy, ang, d);

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

  /** 皇家胡蜂（远程弹幕精英）：中距环绕 → 预警 5 发扇形毒针 / 8 发环形弹幕 → 侧向闪避换位 */
  private behaveHornetElite(e: Enemy, dt: number, ux: number, uy: number, ang: number, d: number): [number, number] {
    const h = this.host;
    e.timer -= dt;
    switch (e.state) {
      case 0: {
        // 中距离侧飞拉扯，冷却到就蓄力放弹幕
        if (e.timer <= 0) {
          e.state = 1;
          e.timer = 0.68;
          e.tx = ang;
          e.count++;
          if (e.count % 2 === 0) {
            this.tel.circle(e.x, e.y, 70, 0.68);
          } else {
            this.tel.fan(e.x, e.y, 200, ang, 0.56, 0.68);
          }
          sfx.play('warn');
          return [0, 0];
        }
        const side = Math.sin(e.wobble + e.count) >= 0 ? 1 : -1;
        if (d < 170) return [-ux * e.speed, -uy * e.speed];
        if (d > 290) return [ux * e.speed, uy * e.speed];
        return [-uy * side * e.speed * 0.9, ux * side * e.speed * 0.9];
      }
      case 1: {
        // 蓄力结束发射弹幕，随后切入侧向短冲锋换位
        if (e.timer <= 0) {
          if (e.count % 2 === 0) {
            // 8 方向环形赤红毒针弹幕
            for (let k = 0; k < 8; k++) {
              const a = e.tx + (k / 8) * Math.PI * 2;
              h.shoot(e.x, e.y, a, 225, e.skillDamage, 'stinger');
            }
            this.fx.ring(e.x, e.y, 58, 0xffc848);
          } else {
            // 5 发扇形赤红毒针齐射（略宽夹角，便于走位穿插或冲刺躲避）
            for (let k = -2; k <= 2; k++) {
              h.shoot(e.x, e.y, e.tx + k * 0.24, 265, e.skillDamage, 'stinger');
            }
            this.fx.muzzle(e.x, e.y, e.tx, 0xffd04c, 22, 5, 2);
          }
          sfx.play('spit');
          e.state = 2;
          e.timer = 0.32;
          const side = e.count % 2 === 0 ? 1 : -1;
          const dashAng = ang + side * 1.25;
          e.dirX = Math.cos(dashAng);
          e.dirY = Math.sin(dashAng);
        }
        return [0, 0];
      }
      default: {
        if (e.timer <= 0) {
          e.state = 0;
          e.timer = 2.2;
        }
        const ds = e.def.dashSpeed ?? 420;
        return [e.dirX * ds, e.dirY * ds];
      }
    }
  }

  /** 曜石甲像（三阶段血量突变精英）：100%→60% 游走慢环弹 → 60%→30% 追击12向弹+X斩 → <30% 狂暴密集扇形雨+16向环弹 */
  private behaveGargoyleElite(e: Enemy, dt: number, ux: number, uy: number, ang: number, d: number): [number, number] {
    const h = this.host;
    const hpRatio = e.hp / Math.max(1, e.maxHp);
    if (e.phase === 0 && hpRatio <= 0.6) {
      e.phase = 1;
      e.speed = e.baseSpeed * 1.25;
      this.fx.number(e.x, e.y - 46, '石甲裂变！', 'crit');
      this.fx.ring(e.x, e.y, 110, 0xd058ff);
      shake(this.scene, 140, 0.006);
      sfx.play('warn');
    }
    if (e.phase < 2 && hpRatio <= 0.3) {
      e.phase = 2;
      e.speed = e.baseSpeed * 1.45;
      this.fx.number(e.x, e.y - 46, '残血狂乱！', 'crit');
      this.fx.ring(e.x, e.y, 130, 0xff3858);
      shake(this.scene, 180, 0.008);
      sfx.play('bossRoar');
    }

    e.timer -= dt;
    switch (e.state) {
      case 0: {
        if (e.timer <= 0) {
          e.count++;
          e.tx = ang;
          if (e.phase === 0) {
            // 阶段 1：蓄力 8 向慢速环形弹幕
            e.state = 1;
            e.timer = 0.65;
            this.tel.circle(e.x, e.y, 76, 0.65);
          } else if (e.phase === 1) {
            // 阶段 2：交替 12 向环形弹幕 & 玩家脚下 X 形地面交叉斩击
            e.state = 1;
            e.timer = 0.62;
            if (e.count % 2 === 0) {
              this.tel.circle(e.x, e.y, 84, 0.62);
            } else {
              const halfLen = 110;
              for (const offset of [Math.PI / 4, -Math.PI / 4]) {
                const a = ang + offset;
                this.queueGroundSlash(h.px - Math.cos(a) * halfLen, h.py - Math.sin(a) * halfLen, a, halfLen * 2, 30, 0.78, e.skillDamage * 1.15);
              }
            }
          } else {
            // 阶段 3（<30%）：狂暴交替 7 发密集扇形二连射 & 16 向环形弹幕雨
            e.state = 1;
            e.timer = 0.52;
            if (e.count % 2 === 0) {
              this.tel.circle(e.x, e.y, 92, 0.52);
            } else {
              this.tel.fan(e.x, e.y, 220, ang, 0.68, 0.52);
            }
          }
          sfx.play('warn');
          return [0, 0];
        }
        if (e.phase === 0) {
          const side = Math.sin(e.wobble + e.count) >= 0 ? 1 : -1;
          if (d < 165) return [-ux * e.speed, -uy * e.speed];
          if (d > 270) return [ux * e.speed, uy * e.speed];
          return [-uy * side * e.speed * 0.85, ux * side * e.speed * 0.85];
        }
        return [ux * e.speed, uy * e.speed];
      }
      case 1: {
        if (e.timer <= 0) {
          if (e.phase === 0) {
            for (let k = 0; k < 8; k++) {
              h.shoot(e.x, e.y, e.tx + (k / 8) * Math.PI * 2, 185, e.skillDamage, 'orb');
            }
            this.fx.ring(e.x, e.y, 64, 0xd888ff);
            sfx.play('spit');
            e.state = 0;
            e.timer = 2.1;
          } else if (e.phase === 1) {
            if (e.count % 2 === 0) {
              for (let k = 0; k < 12; k++) {
                h.shoot(e.x, e.y, e.tx + (k / 12) * Math.PI * 2, 205, e.skillDamage, 'orb');
              }
              this.fx.ring(e.x, e.y, 74, 0xd058ff);
              sfx.play('spit');
            }
            e.state = 0;
            e.timer = 1.75;
          } else {
            if (e.count % 2 === 0) {
              for (let k = 0; k < 16; k++) {
                h.shoot(e.x, e.y, e.tx + (k / 16) * Math.PI * 2, 215, e.skillDamage, 'orb');
              }
              this.fx.ring(e.x, e.y, 82, 0xff3858);
              sfx.play('spit');
              e.state = 0;
              e.timer = 1.45;
            } else {
              for (let k = -3; k <= 3; k++) {
                h.shoot(e.x, e.y, e.tx + k * 0.2, 275, e.skillDamage, 'stinger');
              }
              sfx.play('spit');
              e.state = 2;
              e.timer = 0.28;
            }
          }
        }
        return [0, 0];
      }
      default: {
        // 阶段 3 扇形散弹雨第二连发
        if (e.timer <= 0) {
          for (let k = -3; k <= 3; k++) {
            h.shoot(e.x, e.y, ang + k * 0.22 + 0.08, 255, e.skillDamage, 'orb');
          }
          sfx.play('spit');
          e.state = 0;
          e.timer = 1.35;
        }
        return [ux * e.speed * 0.45, uy * e.speed * 0.45];
      }
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

  /** 泰坦兜虫（第二只 Boss）：重角崩冲 + 落岩震击 + 碎角弹幕；半血狂暴二连冲、落岩加密并召唤黄蜂 */
  private behaveGoliathBoss(e: Enemy, dt: number, ux: number, uy: number, ang: number, d: number): [number, number] {
    const h = this.host;
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true;
      e.timer2 = 0;
      this.fx.number(e.x, e.y - 64, '重铠狂暴！', 'crit');
      this.fx.ring(e.x, e.y, 130, 0xffae2b);
      shake(this.scene, 200, 0.008);
    }
    if (h.difficulty.bossPhase3 && e.hp < e.maxHp * 0.3) {
      if (!e.storm) {
        e.storm = true;
        e.timer3 = 0.6;
        this.fx.number(e.x, e.y - 64, '雷暴！', 'crit');
      }
      e.timer3 -= dt;
      if (e.timer3 <= 0) {
        e.timer3 = 1.45;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2;
          const r = k === 0 ? 0 : 85 + Math.random() * 155;
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
        e.timer2 = 9.5;
        for (let k = 0; k < 2; k++) {
          const a = ang + (k === 0 ? 1.1 : -1.1);
          this.spawnChild('wasp', e.x + Math.cos(a) * 58, e.y + Math.sin(a) * 58);
        }
      }
    }
    const spd = e.speed * (e.enraged ? 1.28 : 1);
    e.timer -= dt;
    switch (e.state) {
      case 0: {
        if (e.timer <= 0) {
          if (d > 170 || Math.random() < 0.55) {
            // 重角崩冲
            e.state = 10;
            e.count = e.enraged ? 2 : 1;
            e.timer = 0.78;
            e.dirX = ux;
            e.dirY = uy;
            this.tel.line(e.x, e.y, ang, 340, 62, 0.78);
            sfx.play('warn');
          } else {
            // 震地落岩
            e.state = 20;
            e.timer = 0.85;
            this.tel.circle(e.x, e.y, 140, 0.85);
            sfx.play('warn');
          }
          return [0, 0];
        }
        return [ux * spd, uy * spd];
      }
      case 10: {
        if (e.timer <= 0) {
          e.state = 11;
          e.timer = 0.62;
          sfx.play('bossRoar');
        }
        return [0, 0];
      }
      case 11: {
        if (e.timer <= 0) {
          // 冲锋刹车：震波 + 8 向碎角毒针
          if (d < 130 + h.pr) h.hurtPlayer(e.skillDamage * 0.9);
          this.fx.ring(e.x, e.y, 130, 0xffb848);
          this.fx.burst(e.x, e.y, 0x7c5424, 20, 260, 1.3);
          shake(this.scene, 150, 0.007);
          sfx.play('explode');
          const shots = e.enraged ? 10 : 8;
          for (let k = 0; k < shots; k++) {
            const a = ang + (k / shots) * Math.PI * 2;
            h.shoot(e.x, e.y, a, 230, e.skillDamage * 0.55, 'stinger');
          }
          e.count--;
          if (e.count > 0) {
            e.state = 10;
            e.timer = 0.58;
            e.dirX = ux;
            e.dirY = uy;
            this.tel.line(e.x, e.y, ang, 340, 62, 0.58);
            sfx.play('warn');
          } else {
            e.state = 0;
            e.timer = e.enraged ? 1.05 : 1.55;
          }
          return [0, 0];
        }
        const ds = (e.def.dashSpeed ?? 500) * (e.enraged ? 1.12 : 1);
        return [e.dirX * ds, e.dirY * ds];
      }
      default: {
        // 震地落岩：近身大震波 + 玩家周围落岩预警圈
        if (e.timer <= 0) {
          if (d < 140 + h.pr) h.hurtPlayer(e.skillDamage);
          this.fx.ring(e.x, e.y, 140, 0xffa838);
          this.fx.burst(e.x, e.y, 0x6a4a24, 24, 290, 1.4);
          shake(this.scene, 200, 0.009);
          sfx.play('explode');
          const rocks = e.enraged ? 6 : 4;
          for (let k = 0; k < rocks; k++) {
            const a = (k / rocks) * Math.PI * 2 + Math.random() * 0.4;
            const r = k === 0 ? 18 : 95 + Math.random() * 130;
            const x = Phaser.Math.Clamp(h.px + Math.cos(a) * r, 48, WORLD_WIDTH - 48);
            const y = Phaser.Math.Clamp(h.py + Math.sin(a) * r, 48, WORLD_HEIGHT - 48);
            this.strikes.push({ x, y, r: 72, t: 0.88, damage: e.skillDamage * 0.72 });
            this.tel.circle(x, y, 72, 0.88);
          }
          e.state = 0;
          e.timer = e.enraged ? 1.15 : 1.65;
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
