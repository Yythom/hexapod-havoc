import { CHARACTER_ORDER, CHARACTERS, type UnlockRule } from '../data/characters';
import type { RunState } from './RunState';
import { unlockCharacter } from './save';

function met(rule: UnlockRule, run: RunState): boolean {
  switch (rule.kind) {
    case 'toxinDamage':
      return run.toxinDamage >= rule.amount;
    case 'holdNectar':
      return run.nectar >= rule.amount;
    case 'weaponsHeld':
      return run.weapons.length >= rule.amount;
    case 'meleeKills':
      return run.meleeKills >= rule.amount;
    case 'summons':
      return run.maxSummons >= rule.amount;
    case 'speed':
      return run.stats.speedPct >= rule.amount - 1e-6;
    case 'win':
      return run.won;
    case 'armor':
      return run.stats.armor >= rule.amount;
    case 'lifesteal':
      return run.lifestealHealed >= rule.amount;
    case 'totalNectar':
      return run.totalNectar >= rule.amount;
    case 'devices':
      return run.devicesPlaced >= rule.amount;
  }
}

/** 检查这一局是否达成了某个角色的解锁条件，返回新解锁的角色 id（已写入存档） */
export function checkUnlocks(run: RunState): string[] {
  const out: string[] = [];
  for (const id of CHARACTER_ORDER) {
    const rule = CHARACTERS[id].unlock;
    if (!rule) continue;
    if (met(rule, run) && unlockCharacter(id)) out.push(id);
  }
  return out;
}
