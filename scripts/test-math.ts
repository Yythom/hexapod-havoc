import assert from 'node:assert/strict';
import { growthBonus, MAX_SCREEN_RANGE, rangeOverflowBonus, weaponDamage } from '../src/core/combat';
import { DAILY_MUTATORS, getDailyChallenge } from '../src/core/daily';
import { rollUpgrades, tierWeights } from '../src/core/progression';
import { RunState } from '../src/core/RunState';
import { exportSaveCode, importSaveCode, setSaveSandbox } from '../src/core/save';
import { addItem, rerollCost } from '../src/core/shop';
import { BASE_STATS, damageTakenMultiplier, dodgeChance, ZERO_STATS } from '../src/core/stats';
import { ENEMIES, enemyDamage, enemyHp } from '../src/data/enemies';
import { ITEMS, ZERO_MODS } from '../src/data/items';
import { waveDefFor } from '../src/data/waves';
import { WEAPONS } from '../src/data/weapons';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('Running Hexapod Havoc core math & balance invariant tests...');

test('甲壳减伤曲线：0~20 正常递减，20+ 软递减且最高减伤 68%，负甲壳最高 2 倍增伤', () => {
  assert.equal(damageTakenMultiplier(0), 1);
  assert.ok(Math.abs(damageTakenMultiplier(15) - 0.5) < 1e-6);
  const at20 = damageTakenMultiplier(20);
  const at35 = damageTakenMultiplier(35);
  const at80 = damageTakenMultiplier(80);
  assert.ok(at35 < at20 && at35 > 0.32);
  assert.equal(at80, 0.32);
  assert.equal(damageTakenMultiplier(-15), 2);
  assert.equal(damageTakenMultiplier(-99), 2);
});

test('闪避率始终钳制在 [0, 0.6]', () => {
  assert.equal(dodgeChance({ ...BASE_STATS, dodge: -0.2 }), 0);
  assert.equal(dodgeChance({ ...BASE_STATS, dodge: 0.45 }), 0.45);
  assert.equal(dodgeChance({ ...BASE_STATS, dodge: 1.5 }), 0.6);
});

test('负伤害% 拥有 0.2 保底，不会把伤害算成 0 或负数', () => {
  const pistol = WEAPONS.pistol;
  const d = weaponDamage(pistol, 0, { ...ZERO_STATS, damagePct: -2.5 }, ZERO_MODS);
  assert.ok(d > 0, `expected positive damage, got ${d}`);
});

test('远程武器溢出射程自动转化为增伤（上限 +25%），近战不吃溢出', () => {
  const sniper = WEAPONS['sniper-gun'] ?? WEAPONS.pistol;
  const zeroBonus = rangeOverflowBonus(sniper, { ...ZERO_STATS, range: -800 }, 0);
  assert.equal(zeroBonus, 0);
  const midBonus = rangeOverflowBonus(WEAPONS.pistol, { ...ZERO_STATS, range: MAX_SCREEN_RANGE }, 0);
  assert.ok(midBonus > 0 && midBonus <= 0.25);
  const capBonus = rangeOverflowBonus(sniper, { ...ZERO_STATS, range: 9999 }, 0);
  assert.equal(capBonus, 0.25);
  assert.equal(rangeOverflowBonus(WEAPONS.claw, { ...ZERO_STATS, range: 9999 }, 0), 0);
});

test('成长型武器拥有合理上限（ghost-axe ≤ +40 伤害，ghost-scepter ≤ +25 最大生命）', () => {
  const axe = WEAPONS['ghost-axe'];
  assert.equal(growthBonus(axe, { id: 'ghost-axe', tier: 0, kills: 99999 }), 40);

  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'ghost-scepter' });
  const baseHp = run.stats.maxHp;
  run.weapons[0].kills = 99999;
  run.recomputeStats();
  assert.equal(run.stats.maxHp - baseHp, 25);
});

test('商店刷新费随波次与连刷次数单调递增且后期步长放大', () => {
  assert.ok(rerollCost(1, 0) <= 3);
  assert.ok(rerollCost(20, 0) > rerollCost(5, 0));
  const stepW1 = rerollCost(1, 2) - rerollCost(1, 1);
  const stepW20 = rerollCost(20, 2) - rerollCost(20, 1);
  assert.ok(stepW20 > stepW1 * 4, `expected wave 20 reroll step (${stepW20}) >> wave 1 (${stepW1})`);
});

test('道具堆叠上限：传说唯一件不可叠加、非唯一传说上限 2、普通上限 4', () => {
  assert.equal(ITEMS.giantscarab.unique, true);
  assert.equal(ITEMS.glasswing.unique, true);
  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'slingshot' });
  for (let i = 0; i < 6; i++) addItem(run, 'royaljelly');
  assert.equal(run.itemCount('royaljelly'), 2);
  for (let i = 0; i < 6; i++) addItem(run, 'leaf');
  assert.equal(run.itemCount('leaf'), 4);
});

test('升级四选一严格过滤角色死属性（蚁后 / 蚊子 / 刺蛾 / 螳螂）', () => {
  const cases: { char: string; weapon: string; forbidden: string[] }[] = [
    { char: 'antqueen', weapon: '', forbidden: ['ranged', 'engineering', 'elemental', 'range'] },
    { char: 'mosquito', weapon: 'tranq-rifle', forbidden: ['regen'] },
    { char: 'caterpillar', weapon: 'spiky-shield', forbidden: ['dodge'] },
    { char: 'mantis', weapon: 'light-saber', forbidden: ['ranged', 'engineering'] },
  ];
  for (const tc of cases) {
    const run = new RunState({ character: tc.char, difficulty: 0, weapon: tc.weapon });
    for (let trial = 0; trial < 40; trial++) {
      const opts = rollUpgrades(10, 30, 4, run);
      assert.equal(opts.length, 4);
      for (const o of opts) {
        assert.ok(!tc.forbidden.includes(o.stat), `${tc.char} rolled forbidden stat: ${o.stat}`);
      }
    }
  }
});

test('幸运按品质阶梯拉高稀有与传说相对权重', () => {
  const low = tierWeights(14, 0);
  const high = tierWeights(14, 80);
  const ratioLow = low[3] / low[1];
  const ratioHigh = high[3] / high[1];
  assert.ok(ratioHigh > ratioLow * 1.4, `expected legendary/uncommon ratio to rise with luck (${ratioLow} -> ${ratioHigh})`);
});

test('怪物曲线平滑且包含双 Boss 与无尽 25/30 波里程碑 Boss', () => {
  const ant = ENEMIES.ant;
  assert.ok(enemyHp(ant, 20) > enemyHp(ant, 10) * 2.5);
  assert.ok(enemyHp(ant, 30) > enemyHp(ant, 20) * 8);
  assert.ok(enemyDamage(ant, 30) > enemyDamage(ant, 20) * 3);
  assert.ok(ENEMIES.mantis.boss && ENEMIES.goliath_boss.boss);
  assert.equal(waveDefFor(20).boss, 'boss_pool');
  assert.equal(waveDefFor(25).boss, 'goliath_boss');
  assert.equal(waveDefFor(30).boss, 'mantis');
  assert.equal(waveDefFor(21).boss, undefined);
});

test('每日挑战按日期确定性生成，且词条正确作用于 RunState（含 3 格打折商店）', () => {
  const a = getDailyChallenge('2026-11-23');
  const b = getDailyChallenge('2026-11-23');
  const c = getDailyChallenge('2026-11-24');
  assert.deepEqual(a, b);
  assert.equal(a.mutators.length, 2);
  assert.notEqual(a.mutators[0], a.mutators[1]);
  assert.ok(a.mutators.every((m) => !!DAILY_MUTATORS[m]));
  assert.notDeepEqual(a, c);

  const run = new RunState({ character: 'stag', difficulty: 1, weapon: 'slingshot', daily: '2026-11-23', mutators: ['discount', 'glass'] });
  assert.equal(run.shopOfferCount, 3);
  assert.ok(run.mods.pricePct <= -0.25);
  assert.ok(run.stats.damagePct >= 0.35);
});

test('存档码导出与导入校验（有效还原、非法串拒绝）', () => {
  setSaveSandbox(true);
  const code = exportSaveCode();
  assert.ok(code.startsWith('HH1:'));
  assert.equal(importSaveCode(code), true);
  assert.equal(importSaveCode('INVALID_CODE'), false);
  assert.equal(importSaveCode('HH1:not-valid-base64!!!'), false);
  setSaveSandbox(false);
});

console.log(`\nAll ${passed} invariant tests passed!`);
