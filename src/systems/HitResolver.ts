import { critMultiplier, weaponLifesteal } from '../core/combat';
import type { OwnedWeapon } from '../core/RunState';
import type { Mods } from '../data/items';
import type { WeaponDef } from '../data/weapons';
import type { Effects } from './Effects';
import { BURN_RATIO, type Enemy, type EnemyManager } from './EnemyManager';

/** 一次攻击来自哪把武器：命中效果、成长、击杀统计都靠它 */
export interface HitSource {
  def: WeaponDef;
  /** 玩家身上那把武器的存档对象（成长型武器记击杀数）；炮台等没有 */
  owned: OwnedWeapon | null;
  /** 当前品质（0~3），用于读取每品质数值 */
  tier: number;
}

/** 命中结算需要从战斗场景拿到的东西 */
export interface CombatHost {
  readonly mods: Mods;
  /** 当前生命比例（Sharp Tooth 这类武器用） */
  readonly hpRatio: number;
  /** 武器命中回血 / 吸取（传入受击敌人坐标以生成吸血光丝） */
  heal(n: number, fromX?: number, fromY?: number, kind?: 'lifesteal' | 'other'): void;
  /** 额外掉落花蜜（金龟子钳） */
  dropBonusNectar(x: number, y: number, n: number): void;
  /** 武器击杀了一只怪（近战击杀统计） */
  onWeaponKill(def: WeaponDef): void;
  /** 暴击触发额外火花弹（暴击火花道具） */
  onCritSpark?(x: number, y: number, count: number): void;
  /** 极短微顿帧反馈（重击/爆炸/精英击杀） */
  onHitstop?(sec: number): void;
  /** 火焰/灼烧命中坐标回调（用于枯叶树洞引燃干叶堆） */
  onFireHit?(x: number, y: number, dps: number): void;
  /** 命中时向周围发射弹片（Cacti Club / Sniper Gun / Thunder Sword） */
  burst?(x: number, y: number, count: number, damage: number, texture: string, radius: number, speed: number, src: HitSource): void;
}

/**
 * 武器命中的统一结算：伤害 → 灼烧 / 冰冻 / 减速 / 易伤 → 回血、额外花蜜、成长。
 * 所有武器（近战、子弹、光束、闪电、机关）都走这里，状态效果只写一遍。
 */
export class HitResolver {
  host!: CombatHost;

  private readonly aoeBuf: Enemy[] = [];

  constructor(
    private readonly enemies: EnemyManager,
    private readonly fx?: Effects,
  ) {}

  hit(e: Enemy, damage: number, crit: boolean, dirX: number, dirY: number, knockback: number, src: HitSource | null): boolean {
    if (!e.active) return false;
    if (!src) return this.enemies.hit(e, damage, crit, dirX, dirY, knockback);
    const mods = this.host.mods;
    const def = src.def;
    const special = def.special;

    // 霜花：攻击被冻住的怪必定暴击；Spoon：攻击被灼烧的怪必定暴击
    if (!crit && mods.frozenCrit > 0 && e.frozen > 0) {
      damage = Math.max(1, Math.round(damage * critMultiplier(def, mods, src.tier)));
      crit = true;
    }
    if (!crit && special?.critVsBurning && e.burnTime > 0) {
      damage = Math.max(1, Math.round(damage * critMultiplier(def, mods, src.tier)));
      crit = true;
    }

    // 条件增伤：Trident / Sickle
    const hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    if (special?.damageVsHighHp && hpRatio >= 0.8) damage *= 1 + special.damageVsHighHp;
    if (special?.damageVsLowHp && hpRatio <= 0.3) damage *= 1 + special.damageVsLowHp;

    // 潮湿增伤：雨天/露珠水洼中的敌人吃冰/电/元素伤害 +25%
    const enchant = src.owned?.enchant;
    const isElementalHit =
      def.classes.includes('Elemental') || !!def.chain || !!def.onHit?.freeze || enchant === 'frost';
    if (e.wetTime > 0 && isElementalHit) {
      damage = Math.max(1, Math.round(damage * 1.25));
    }

    // 处决：Vorpal Sword；IV 阶传说武器自带 15% 低血处决觉醒
    if (special?.executeChance && !e.def.boss && !e.def.elite && Math.random() < special.executeChance) {
      damage = Math.max(damage, e.hp + 1);
      crit = true;
    } else if (src.tier >= 3 && !e.def.boss && !e.def.elite && hpRatio <= 0.15) {
      damage = Math.max(damage, e.hp + 1);
      crit = true;
    }

    const x = e.x;
    const y = e.y;
    const fx = def.onHit;
    const dealt = Math.max(0, Math.round(damage));
    if (src.owned) {
      src.owned.waveDamage = (src.owned.waveDamage ?? 0) + dealt;
      src.owned.totalDamage = (src.owned.totalDamage ?? 0) + dealt;
    }
    const killed = this.enemies.hit(e, damage, crit, dirX, dirY, knockback, 'normal', def.kind === 'melee');
    if (killed && (e.def.elite || e.def.boss)) {
      this.host.onHitstop?.(e.def.boss ? 0.07 : 0.042);
    }
    if (crit) {
      // 暴击数字本身已足够醒目，仅在远程暴击时补一记小巧轻闪，不再满屏放星光
      if (def.kind !== 'melee') {
        const hitAng = Math.hypot(dirX, dirY) > 0.01 ? Math.atan2(dirY, dirX) : Math.random() * Math.PI;
        this.fx?.hitSlash(x, y, hitAng, 0xffe468, 0.88);
      }
      if (mods.critNova > 0) {
        const nr = 58;
        const ndmg = Math.max(1, Math.round(damage * 0.5));
        this.fx?.ring(x, y, nr, 0xc8ff68);
        for (const o of this.enemies.grid.query(x, y, nr + 40, this.aoeBuf).slice()) {
          if (!o.active || o === e) continue;
          const dx = o.x - x;
          const dy = o.y - y;
          const rr = nr + o.radius;
          if (dx * dx + dy * dy > rr * rr) continue;
          const d = Math.hypot(dx, dy) || 1;
          this.enemies.hit(o, ndmg, false, dx / d, dy / d, 90);
        }
      }
      if (mods.critSpark > 0) this.host.onCritSpark?.(x, y, mods.critSpark);
    }
    if (fx) {
      if (!killed) {
        if (fx.burn) {
          const burnDps = damage * BURN_RATIO * (1 + mods.burnDamagePct);
          this.enemies.applyBurn(e, burnDps);
          this.host.onFireHit?.(x, y, burnDps);
          this.fx?.burst(x, y, 0xff7828, 2, 95, 0.6);
        }
        if (fx.freeze) {
          this.enemies.applyFreeze(e, fx.freeze);
        }
        if (fx.vulnerable) {
          this.enemies.applyVulnerable(e);
        }
        if (fx.poison) {
          this.enemies.applyPoison(e, fx.poison, 1, 3 + this.host.mods.poisonDuration);
          this.fx?.poisonBubbles(x, y, 2);
        }
        if (fx.slow) {
          this.enemies.applySlow(e, 2, Math.max(0.2, 1 - fx.slow));
        }
        if (fx.burst && this.host.burst) {
          this.host.burst(x, y, fx.burst.count, Math.max(1, Math.round(damage * fx.burst.damage)), fx.burst.texture, fx.burst.radius, fx.burst.speed, src);
        }
      }
      if (special?.explodeChance && Math.random() < special.explodeChance) {
        const r = (special.explodeRadius ?? 60) * (1 + this.host.mods.explodeRadiusPct);
        const ed = Math.max(1, Math.round(damage * 0.6));
        this.fx?.explosion(x, y, r, 0xff8c30, src.tier);
        this.host.onHitstop?.(0.022);
        for (const o of this.enemies.grid.query(x, y, r + 40, this.aoeBuf).slice()) {
          if (!o.active || o === e) continue;
          const dx = o.x - x;
          const dy = o.y - y;
          const rr = r + o.radius;
          if (dx * dx + dy * dy > rr * rr) continue;
          const d = Math.hypot(dx, dy) || 1;
          this.enemies.hit(o, ed, false, dx / d, dy / d, 60);
        }
      }
      if (fx.heal && Math.random() < fx.heal) this.host.heal(1, x, y, 'other');
      if (killed && fx.nectarOnKill && Math.random() < fx.nectarOnKill) this.host.dropBonusNectar(x, y, 1);
    }

    // 蜗老板武器附魔效果（炽焰 / 寒霜 / 贪婪）
    if (enchant === 'ignite') {
      const burnDps = damage * BURN_RATIO * 1.2 * (1 + mods.burnDamagePct);
      if (!killed) this.enemies.applyBurn(e, burnDps);
      this.host.onFireHit?.(x, y, burnDps);
      this.fx?.burst(x, y, 0xff7828, 3, 100, 0.65);
    }
    if (!killed && enchant === 'frost') {
      this.enemies.applyFreeze(e, 1);
      this.enemies.applySlow(e, 1.5, 0.8);
    }
    if (killed && enchant === 'greed' && Math.random() < 0.22) {
      this.host.dropBonusNectar(x, y, 1);
    }

    // 元素 6 件套觉醒：冰火/雷火交汇触发元素爆裂
    if (mods.elementalBurst > 0) {
      const hasBurn = e.burnTime > 0 || !!fx?.burn || enchant === 'ignite';
      const hasIceOrZap = e.ice > 0 || e.frozen > 0 || !!fx?.freeze || !!def.chain || enchant === 'frost';
      if (hasBurn && hasIceOrZap) {
        const er = 72;
        const edmg = Math.max(4, Math.round(damage * 0.55));
        this.fx?.ring(x, y, er, 0x8ceeff);
        this.fx?.explosion(x, y, er * 0.85, 0xff8a38, 1);
        for (const o of this.enemies.grid.query(x, y, er + 40, this.aoeBuf).slice()) {
          if (!o.active || o === e) continue;
          const dx = o.x - x;
          const dy = o.y - y;
          if (dx * dx + dy * dy > (er + o.radius) ** 2) continue;
          const d = Math.hypot(dx, dy) || 1;
          this.enemies.hit(o, edmg, false, dx / d, dy / d, 80, 'burn');
        }
      }
    }

    // 武器自带吸取（含嗜血附魔）：每次命中按几率回 1 血
    let ls = weaponLifesteal(def, src.tier, src.owned);
    if (special?.lifestealPerMissingHp) ls += special.lifestealPerMissingHp * (1 - Math.max(0, Math.min(1, this.host.hpRatio))) * 10;
    if (ls > 0 && Math.random() < ls) this.host.heal(1, x, y, 'lifesteal');
    // Brick：命中时概率掉花蜜（原作会碎武器，这里只保留掉落）
    if (special?.breakChance && Math.random() < special.breakChance) this.host.dropBonusNectar(x, y, 1);
    // Drill / Thief Dagger：暴击击杀额外掉花蜜
    if (killed && crit && special?.materialOnCritKill && Math.random() < special.materialOnCritKill) {
      this.host.dropBonusNectar(x, y, 1);
    }
    if (killed && special?.healOnKill) this.host.heal(special.healOnKill, x, y, 'other');

    if (killed) {
      if ((def.growth || def.special?.growthMaxHp || def.special?.growthAttackSpeed) && src.owned) {
        src.owned.kills = (src.owned.kills ?? 0) + 1;
      }
      this.host.onWeaponKill(def);
    }
    return killed;
  }
}
