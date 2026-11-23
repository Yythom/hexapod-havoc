import { critMultiplier } from '../core/combat';
import type { OwnedWeapon } from '../core/RunState';
import type { Mods } from '../data/items';
import type { WeaponDef } from '../data/weapons';
import { BURN_RATIO, type Enemy, type EnemyManager } from './EnemyManager';

/** 一次攻击来自哪把武器：命中效果、成长、击杀统计都靠它 */
export interface HitSource {
  def: WeaponDef;
  /** 玩家身上那把武器的存档对象（成长型武器记击杀数）；炮台等没有 */
  owned: OwnedWeapon | null;
}

/** 命中结算需要从战斗场景拿到的东西 */
export interface CombatHost {
  readonly mods: Mods;
  /** 武器命中回血（蜂蜜罐） */
  heal(n: number): void;
  /** 额外掉落花蜜（金龟子钳） */
  dropBonusNectar(x: number, y: number, n: number): void;
  /** 武器击杀了一只怪（近战击杀统计） */
  onWeaponKill(def: WeaponDef): void;
}

/**
 * 武器命中的统一结算：伤害 → 灼烧 / 冰冻 / 易伤 → 回血、额外花蜜、成长。
 * 所有武器（近战、子弹、光束、闪电、机关）都走这里，状态效果只写一遍。
 */
export class HitResolver {
  host!: CombatHost;

  constructor(private readonly enemies: EnemyManager) {}

  hit(e: Enemy, damage: number, crit: boolean, dirX: number, dirY: number, knockback: number, src: HitSource | null): boolean {
    if (!e.active) return false;
    if (!src) return this.enemies.hit(e, damage, crit, dirX, dirY, knockback);
    const mods = this.host.mods;
    // 霜花：攻击被冻住的怪必定暴击
    if (!crit && mods.frozenCrit > 0 && e.frozen > 0) {
      damage = Math.max(1, Math.round(damage * critMultiplier(src.def, mods)));
      crit = true;
    }
    const x = e.x;
    const y = e.y;
    const fx = src.def.onHit;
    const killed = this.enemies.hit(e, damage, crit, dirX, dirY, knockback);
    if (fx) {
      if (!killed) {
        if (fx.burn) this.enemies.applyBurn(e, damage * BURN_RATIO * (1 + mods.burnDamagePct));
        if (fx.freeze) this.enemies.applyFreeze(e, fx.freeze);
        if (fx.vulnerable) this.enemies.applyVulnerable(e);
      }
      if (fx.heal && Math.random() < fx.heal) this.host.heal(1);
      if (killed && fx.nectarOnKill && Math.random() < fx.nectarOnKill) this.host.dropBonusNectar(x, y, 1);
    }
    if (killed) {
      if (src.def.growth && src.owned) src.owned.kills = (src.owned.kills ?? 0) + 1;
      this.host.onWeaponKill(src.def);
    }
    return killed;
  }
}
