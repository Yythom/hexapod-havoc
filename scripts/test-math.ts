import assert from 'node:assert/strict';
import {
  applyGuestBuild,
  extractGuestBuild,
  generateRoomCode,
  isLocalRoomCode,
  normalizeRoomCode,
  REVIVE_TIME,
  stepReviveProgress,
} from '../src/net/protocol';
import { growthBonus, MAX_SCREEN_RANGE, rangeOverflowBonus, weaponCritChance, weaponDamage, weaponLifesteal } from '../src/core/combat';
import { CHALLENGES, CHALLENGE_ORDER } from '../src/core/challenges';
import { CONTRACTS, enchantCost, isContractWave, rollContracts } from '../src/core/contracts';
import { DAILY_MUTATORS, getDailyChallenge } from '../src/core/daily';
import { adjacentLinkPairs, computeSlotBonus } from '../src/core/legSynergy';
import { rollUpgrades, tierWeights } from '../src/core/progression';
import { RunState } from '../src/core/RunState';
import {
  clearActiveRun,
  codexMilestones,
  exportSaveCode,
  importSaveCode,
  loadActiveRun,
  recordChallengeCleared,
  recordEnemyKillsBatch,
  recordItemSeen,
  recordRun,
  recordWeaponSeen,
  saveActiveRun,
  setSaveSandbox,
  setShellSkin,
  toggleBanishItem,
  useSaveStore,
} from '../src/core/save';
import {
  CAMERA_ZOOM_STEPS,
  cameraZoomLabel,
  getSettings,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  nextCameraZoom,
  updateSettings,
  useSettingsStore,
} from '../src/core/settings';
import { compareSeedTarget, decodeSeedChallenge, encodeSeedChallenge, generateSeed, normalizeSeed } from '../src/core/seed';
import { addItem, buyOffer, CURSED_OFFER_CURSE, enchantWeapon, mergeWeapons, refreshOffers, rerollCost, rollChestItem, smeltItem } from '../src/core/shop';
import { BASE_STATS, damageTakenMultiplier, dodgeChance, ZERO_STATS } from '../src/core/stats';
import { BIOME_ORDER, BIOMES, resolveBiome } from '../src/data/biomes';
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

test('道具堆叠上限：传说唯一件不可叠加、精良/稀有/传说上限 2、普通上限 3', () => {
  assert.equal(ITEMS.giantscarab.unique, true);
  assert.equal(ITEMS.glasswing.unique, true);
  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'slingshot' });
  for (let i = 0; i < 6; i++) addItem(run, 'royaljelly');
  assert.equal(run.itemCount('royaljelly'), 2);
  for (let i = 0; i < 6; i++) addItem(run, 'leaf');
  assert.equal(run.itemCount('leaf'), 3);
  // 唯一道具：任何来源重复入手都只保留 1 件（防止锁定旧货架 + 宝箱重复叠同一件）
  addItem(run, 'giantscarab');
  addItem(run, 'giantscarab');
  assert.equal(run.itemCount('giantscarab'), 1);
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

test('波间抽卡状态持久化与还原（防刷新网页白嫖重抽升级卡/宝箱/商店刷新费）', () => {
  const run = new RunState({ character: 'ladybug', difficulty: 0, weapon: 'mandible' });
  run.wave = 4;
  run.pendingLevelUps = 1;
  run.chests = 1;
  run.pendingUpgrades = rollUpgrades(run.wave, run.stats.luck, 4, run);
  const chestItemId = Object.keys(ITEMS)[0];
  run.pendingChestItem = chestItemId;
  run.shopRerolls = 3;
  run.shopReady = true;
  refreshOffers(run);

  const saved = run.serialize();
  const restored = RunState.restore(saved);
  assert.deepEqual(restored.pendingUpgrades, run.pendingUpgrades);
  assert.equal(restored.pendingChestItem, chestItemId);
  assert.equal(restored.shopRerolls, 3);
  assert.equal(restored.shopReady, true);
  assert.deepEqual(restored.offers, run.offers);

  restored.resetIntermissionState();
  assert.equal(restored.pendingUpgrades.length, 0);
  assert.equal(restored.pendingChestItem, '');
  assert.equal(restored.shopRerolls, 0);
  assert.equal(restored.shopReady, false);
});

test('Zustand Store 响应式订阅、沙盒隔离与断点读写', () => {
  setSaveSandbox(true);
  let saveNotifies = 0;
  const unsubSave = useSaveStore.subscribe(() => saveNotifies++);
  recordRun('stag', 0, true);
  assert.equal(useSaveStore.getState().wins, 1);
  assert.equal(saveNotifies, 1);
  unsubSave();

  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'mandible' });
  run.wave = 5;
  saveActiveRun(run.serialize());
  assert.equal(loadActiveRun()?.wave, 5);
  clearActiveRun();
  assert.equal(loadActiveRun(), null);
  setSaveSandbox(false);

  let settingNotifies = 0;
  const unsubSet = useSettingsStore.subscribe(() => settingNotifies++);
  const prevVol = getSettings().volume;
  updateSettings({ volume: 2.5 });
  assert.equal(getSettings().volume, 1);
  assert.equal(settingNotifies, 1);
  updateSettings({ volume: prevVol });

  const prevZoom = getSettings().cameraZoom;
  assert.equal(prevZoom, 1);
  updateSettings({ cameraZoom: 0.5 });
  assert.equal(getSettings().cameraZoom, MIN_CAMERA_ZOOM);
  updateSettings({ cameraZoom: 3 });
  assert.equal(getSettings().cameraZoom, MAX_CAMERA_ZOOM);
  assert.equal(nextCameraZoom(1), CAMERA_ZOOM_STEPS[1].value);
  assert.equal(nextCameraZoom(MAX_CAMERA_ZOOM), MIN_CAMERA_ZOOM);
  assert.equal(cameraZoomLabel(1), CAMERA_ZOOM_STEPS[0].label);
  updateSettings({ cameraZoom: prevZoom });
  unsubSet();
});

test('土豆兄弟赌博道具机制与持久化（幽灵蝉蜕/诱饵/孔雀/复刻魔镜/血色巨钳/力量三角）', () => {
  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'mandible' });
  run.nectar = 500;
  addItem(run, 'weirdghost');
  addItem(run, 'bait');
  addItem(run, 'peacock');
  addItem(run, 'mirror');
  assert.equal(run.nextWaveOneHp, true);
  assert.equal(run.nextWaveBait, 1);
  assert.equal(run.nextWavePeacock, 1);
  assert.equal(run.mirrorCharges, 1);

  // 复刻魔镜：购买下一件非唯一道具时免费额外复制 1 份
  run.offers = [{ kind: 'item', id: 'whetstone', tier: 0, locked: false }];
  assert.equal(buyOffer(run, 0), true);
  assert.equal(run.itemCount('whetstone'), 2);
  assert.equal(run.mirrorCharges, 0);

  // 血色巨钳：每 1% 吸取额外 +2% 伤害
  const dmgBefore = run.stats.damagePct;
  addItem(run, 'bloodyhand');
  assert.ok(run.stats.lifesteal >= 0.1);
  assert.ok(run.stats.damagePct >= dmgBefore + 0.199);
  assert.equal(run.mods.selfDamagePerSec, 1);

  // 力量三角：本波受击累积减伤惩罚
  const dmgPreHit = run.stats.damagePct;
  run.waveDamagePenalty = 0.06;
  run.recomputeStats();
  assert.ok(Math.abs(run.stats.damagePct - (dmgPreHit - 0.06)) < 1e-6);

  // 断点序列化完整保留赌博标记（防刷新赖账）
  const restored = RunState.restore(run.serialize());
  assert.equal(restored.nextWaveOneHp, true);
  assert.equal(restored.nextWaveBait, 1);
  assert.equal(restored.nextWavePeacock, 1);
});

test('土豆兄弟特色辅助/压迫怪配置完整（狂化鸣蝉 Buffer / 绿露医虫 Healer / 疾影猎虫 Pursuer）', () => {
  for (const id of ['buffer', 'healer', 'pursuer']) {
    assert.ok(ENEMIES[id], `missing enemy ${id}`);
    assert.ok(enemyHp(ENEMIES[id], 12) > enemyHp(ENEMIES[id], 1));
  }
  const w7 = waveDefFor(7).rules.map((r) => r.enemy);
  const w9 = waveDefFor(9).rules.map((r) => r.enemy);
  const w11 = waveDefFor(11).rules.map((r) => r.enemy);
  const w22 = waveDefFor(22).rules.map((r) => r.enemy);
  assert.ok(w7.includes('pursuer'));
  assert.ok(w9.includes('healer'));
  assert.ok(w11.includes('buffer'));
  assert.ok(w22.includes('buffer') && w22.includes('healer') && w22.includes('pursuer'));
});

test('土豆兄弟全套特色机制怪配置与波次/三精英轮换完整（魔卵/镰刃/河豚/飞鳗/腐巢/紫蛞蝓/滚球/曜石甲像）', () => {
  const newIds = ['slasher_egg', 'slasher', 'puffer', 'lamprey', 'spawner', 'spitter', 'curse_slug', 'mummy', 'gargoyle_elite'];
  for (const id of newIds) {
    assert.ok(ENEMIES[id], `missing enemy ${id}`);
    assert.ok(enemyHp(ENEMIES[id], 15) > enemyHp(ENEMIES[id], 1));
  }
  // 关键特色字段校验
  assert.equal(ENEMIES.slasher_egg.knockbackResist, 1);
  assert.ok(ENEMIES.slasher.nectar[0] > ENEMIES.slasher_egg.nectar[1], 'hatched slasher should reward more nectar than egg');
  assert.deepEqual(ENEMIES.spawner.splitInto, { id: 'spitter', count: 3 });
  assert.ok((ENEMIES.mummy.knockbackResist ?? 0) < 0, 'mummy should have negative knockbackResist');
  assert.equal(ENEMIES.gargoyle_elite.elite, true);
  assert.equal(ENEMIES.gargoyle_elite.behavior, 'elite_gargoyle');

  // 波次编排校验
  assert.ok(waveDefFor(8).rules.some((r) => r.enemy === 'slasher_egg'));
  assert.ok(waveDefFor(10).rules.some((r) => r.enemy === 'puffer'));
  assert.ok(waveDefFor(11).rules.some((r) => r.enemy === 'curse_slug'));
  assert.ok(waveDefFor(12).rules.some((r) => r.enemy === 'mummy') && waveDefFor(12).rules.some((r) => r.enemy === 'slasher'));
  assert.ok(waveDefFor(13).rules.some((r) => r.enemy === 'spawner'));
  assert.ok(waveDefFor(14).rules.some((r) => r.enemy === 'lamprey'));
  assert.ok(waveDefFor(15).elites?.some((e) => e.enemy === 'gargoyle_elite'));

  // 无尽模式三精英轮换（soldier / hornet_elite / gargoyle_elite）
  const endlessElites = new Set([22, 24, 26].flatMap((w) => (waveDefFor(w).elites ?? []).map((e) => e.enemy)));
  assert.ok(endlessElites.has('soldier') && endlessElites.has('hornet_elite') && endlessElites.has('gargoyle_elite'));
});

test('六足位阶、相邻腿同系共鸣与武器换位', () => {
  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'pistol' });
  run.weapons = [
    { id: 'pistol', tier: 0 }, // 0: 前足 + Gun
    { id: 'smg', tier: 0 }, // 1: 前足 + Gun (与 0 相连)
    { id: 'claw', tier: 0 }, // 2: 中足 + Blade/Unarmed
    { id: 'spear', tier: 0 }, // 3: 中足 + Primitive
    { id: 'slingshot', tier: 0 }, // 4: 后足 + Primitive (与 3 相连)
  ];
  const links = adjacentLinkPairs(run.weapons);
  assert.equal(links.length, 2);
  const b0 = computeSlotBonus(run.weapons, 0, 6);
  const b2 = computeSlotBonus(run.weapons, 2, 6);
  const b4 = computeSlotBonus(run.weapons, 4, 6);
  assert.equal(b0.zone, 'front');
  assert.equal(b0.adjacentLinks, 1);
  assert.ok(b0.critChance >= 0.06 && b0.damagePct >= 0.1);
  assert.equal(b2.zone, 'mid');
  assert.equal(b2.adjacentLinks, 0);
  assert.equal(b4.zone, 'rear');
  assert.equal(b4.range, 20);
  assert.equal(b4.knockbackPct, 0.25);

  assert.equal(run.swapWeapons(0, 2), true);
  assert.equal(run.weapons[0].id, 'claw');
  assert.equal(run.weapons[2].id, 'pistol');
});

test('紫火诅咒商品强化、诅咒累加、合成继承与 IV 阶传说觉醒', () => {
  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'pistol' });
  run.nectar = 500;
  run.offers = [{ kind: 'weapon', id: 'pistol', tier: 0, locked: false, cursed: true }];
  const curseBefore = run.stats.curse;
  assert.equal(buyOffer(run, 0), true);
  assert.equal(run.stats.curse, curseBefore + CURSED_OFFER_CURSE);
  assert.equal(run.weapons[1].cursed, true);

  const normalDmg = weaponDamage(WEAPONS.pistol, 0, run.stats, run.mods, run.weapons[0]);
  const cursedDmg = weaponDamage(WEAPONS.pistol, 0, run.stats, run.mods, run.weapons[1]);
  assert.ok(cursedDmg > normalDmg * 1.24);

  // 合成时继承诅咒标记
  assert.equal(mergeWeapons(run, 0), true);
  assert.equal(run.weapons.length, 1);
  assert.equal(run.weapons[0].tier, 1);
  assert.equal(run.weapons[0].cursed, true);

  // IV 阶传说武器自带 +5% 暴击觉醒
  const critT0 = weaponCritChance(WEAPONS.pistol, 0, BASE_STATS);
  const critT3 = weaponCritChance(WEAPONS.pistol, 3, BASE_STATS);
  assert.ok(critT3 >= critT0 + 0.05);
});

test('蜗老板蜕壳台附魔、道具熔炼与禁用池 Banish 过滤', () => {
  const run = new RunState({ character: 'stag', difficulty: 0, weapon: 'pistol', banished: ['leaf', 'dew'] });
  run.wave = 5;
  run.nectar = 300;
  assert.ok(enchantCost(5) > 0);
  assert.equal(enchantWeapon(run, 0, 'vamp'), true);
  assert.equal(run.weapons[0].enchant, 'vamp');
  assert.equal(run.forgeUsed, true);
  assert.ok(weaponLifesteal(WEAPONS.pistol, 0, run.weapons[0]) >= 0.06);
  // 每波仅可用 1 次
  assert.equal(enchantWeapon(run, 0, 'ignite'), false);

  // 熔炼非唯一道具
  run.forgeUsed = false;
  addItem(run, 'whetstone');
  const smelt = smeltItem(run, 'whetstone');
  assert.ok(smelt && smelt.refund > 0);
  assert.equal(run.itemCount('whetstone'), 0);

  // 禁用池过滤
  for (let k = 0; k < 25; k++) {
    refreshOffers(run);
    for (const o of run.offers) {
      if (o?.kind === 'item') {
        assert.ok(o.id !== 'leaf' && o.id !== 'dew', `banished item ${o.id} appeared in shop`);
      }
    }
  }
});

test('后院赌约、主题挑战与图鉴里程碑持久化', () => {
  assert.equal(isContractWave(5), true);
  assert.equal(isContractWave(10), true);
  assert.equal(isContractWave(6), false);
  const [c1, c2] = rollContracts();
  assert.notEqual(c1, c2);
  assert.ok(CONTRACTS[c1] && CONTRACTS[c2]);

  assert.equal(CHALLENGE_ORDER.length, 6);
  const oneLeg = new RunState({
    character: CHALLENGES.one_leg.character,
    difficulty: CHALLENGES.one_leg.difficulty,
    weapon: CHALLENGES.one_leg.weapon,
    challenge: 'one_leg',
    mutators: CHALLENGES.one_leg.mutators,
  });
  assert.equal(oneLeg.weaponSlots, 1);
  assert.equal(oneLeg.maxWaves, 10);

  const glassSoul = new RunState({
    character: CHALLENGES.glass_soul.character,
    difficulty: CHALLENGES.glass_soul.difficulty,
    weapon: CHALLENGES.glass_soul.weapon,
    challenge: 'glass_soul',
    mutators: CHALLENGES.glass_soul.mutators,
  });
  assert.equal(glassSoul.maxHp, 1);

  setSaveSandbox(true);
  assert.equal(codexMilestones().banishCap, 0);
  for (let i = 0; i < 16; i++) recordItemSeen(`test_item_${i}`);
  recordWeaponSeen('pistol', 1);
  assert.equal(codexMilestones().banishCap, 1);
  assert.equal(toggleBanishItem('leaf'), true);
  assert.equal(toggleBanishItem('dew'), false); // 达到 1 格上限
  recordEnemyKillsBatch({ ant: 1600 });
  assert.equal(codexMilestones().banishCap, 2);
  assert.equal(recordChallengeCleared('one_leg'), true);
  assert.ok(codexMilestones().unlockedSkins.includes('neon'));
  assert.ok(codexMilestones().unlockedSkins.includes('cosmic'));
  setShellSkin('cosmic');
  assert.equal(useSaveStore.getState().shellSkin, 'cosmic');
  setSaveSandbox(false);
});

test('多生态场地属性偏置、规则配置与断点续玩保留', () => {
  assert.deepEqual(BIOME_ORDER, ['meadow', 'pond', 'hollow']);
  assert.equal(resolveBiome('unknown').id, 'meadow');

  const meadow = new RunState({ character: 'stag', difficulty: 0, weapon: 'pistol', biome: 'meadow' });
  const pond = new RunState({ character: 'stag', difficulty: 0, weapon: 'pistol', biome: 'pond' });
  const hollow = new RunState({ character: 'stag', difficulty: 0, weapon: 'pistol', biome: 'hollow' });

  assert.equal(pond.biome.slippery, true);
  assert.equal(pond.biome.extraPuddles, 4);
  assert.ok(pond.stats.speedPct >= meadow.stats.speedPct + 0.08 - 1e-6);
  assert.equal(pond.stats.elemental, meadow.stats.elemental + 1);

  assert.equal(hollow.biome.leafPiles, 5);
  assert.equal(hollow.biome.stumpCount, 2);
  assert.equal(hollow.stats.melee, meadow.stats.melee + 2);
  assert.ok(hollow.mods.burnDamagePct >= 0.2 - 1e-6);
  assert.ok(hollow.mods.burnSpreadPct >= 0.3 - 1e-6);

  const restored = RunState.restore(hollow.serialize());
  assert.equal(restored.biome.id, 'hollow');
  assert.equal(restored.seed, hollow.seed);
  assert.ok(BIOMES.pond.groundKey === 'ground-pond' && BIOMES.hollow.groundKey === 'ground-hollow');
});

test('种子分享挑战：确定性分流（商店/升级/宝箱/赌约一致）、挑战码编解码与战绩对比', () => {
  assert.equal(normalizeSeed('  bug-2026!@# '), 'BUG-2026');
  assert.equal(generateSeed().length, 8);

  // 同种子两局：商店、升级、宝箱、赌约完全一致
  const r1 = new RunState({ character: 'stag', difficulty: 2, weapon: 'pistol', biome: 'pond', seed: 'RACE2026' });
  const r2 = new RunState({ character: 'stag', difficulty: 2, weapon: 'pistol', biome: 'pond', seed: 'race2026' });
  const r3 = new RunState({ character: 'stag', difficulty: 2, weapon: 'pistol', biome: 'pond', seed: 'OTHER999' });
  r1.wave = r2.wave = r3.wave = 5;

  refreshOffers(r1, r1.rng('shop', 500));
  refreshOffers(r2, r2.rng('shop', 500));
  refreshOffers(r3, r3.rng('shop', 500));
  assert.deepEqual(r1.offers, r2.offers);

  const u1 = rollUpgrades(5, 10, 4, r1, r1.rng('level', 500));
  const u2 = rollUpgrades(5, 10, 4, r2, r2.rng('level', 500));
  assert.deepEqual(u1, u2);
  assert.equal(rollChestItem(r1, r1.rng('chest', 500)), rollChestItem(r2, r2.rng('chest', 500)));
  assert.deepEqual(rollContracts(r1.rng('contract', 5)), rollContracts(r2.rng('contract', 5)));

  // 挑战码编解码（支持周围附带聊天文字自动提取）
  const code = encodeSeedChallenge({
    seed: 'RACE2026',
    character: 'mantis',
    difficulty: 3,
    weapon: 'light-saber',
    biome: 'hollow',
    mutators: ['turbo', 'treasure'],
    target: { win: true, wave: 20, kills: 1520, nectar: 6400, level: 26, mvpId: 'light-saber', mvpTier: 3 },
  });
  assert.ok(code.startsWith('HHS1:'));
  const decoded = decodeSeedChallenge(`快来挑战我的六足战虫种子：${code} 看看能不能打过我！`);
  assert.ok(decoded);
  assert.equal(decoded!.seed, 'RACE2026');
  assert.equal(decoded!.character, 'mantis');
  assert.equal(decoded!.difficulty, 3);
  assert.equal(decoded!.biome, 'hollow');
  assert.deepEqual(decoded!.mutators, ['turbo', 'treasure']);
  assert.equal(decoded!.target?.kills, 1520);
  assert.equal(decoded!.target?.mvpId, 'light-saber');
  assert.equal(decodeSeedChallenge('HHS1:invalid!!!'), null);
  assert.equal(decodeSeedChallenge('random text'), null);

  // 战绩对比：通关 > 波次 > 击杀 > 花蜜
  const target = decoded!.target!;
  assert.equal(compareSeedTarget({ win: true, wave: 20, kills: 1600, nectar: 5000 }, target), 'beat');
  assert.equal(compareSeedTarget({ win: true, wave: 20, kills: 1520, nectar: 6400 }, target), 'tie');
  assert.equal(compareSeedTarget({ win: false, wave: 20, kills: 9999, nectar: 9999 }, target), 'behind');
});

test('双人联机协议：房间码编解码、倒地 2.5s 救援进度与客机构筑双向同步', () => {
  const code = generateRoomCode(false);
  assert.equal(code.length, 6);
  assert.equal(isLocalRoomCode(code), false);
  const localCode = generateRoomCode(true);
  assert.equal(isLocalRoomCode(localCode), true);
  assert.equal(normalizeRoomCode(`https://example.com/?coop=${code.toLowerCase()}`), code);
  assert.equal(normalizeRoomCode(`  ${localCode.toLowerCase()}  `), localCode);

  // 救援进度：在圈内 2.5s 充满，离开后衰减但不小于 0
  let p = 0;
  p = stepReviveProgress(p, true, REVIVE_TIME / 2);
  assert.ok(Math.abs(p - 0.5) < 1e-6);
  p = stepReviveProgress(p, false, 0.5);
  assert.ok(p < 0.5 && p > 0.2);
  p = stepReviveProgress(p, true, REVIVE_TIME);
  assert.equal(p, 1);
  assert.equal(stepReviveProgress(0, false, 1), 0);

  // 客机波间商店买完装备后提取快照并同步回房主 run2
  const guestRun = new RunState({ character: 'spider', difficulty: 2, weapon: 'slingshot', biome: 'pond', seed: 'COOP-TEST' });
  guestRun.nectar = 128;
  guestRun.totalNectar = 450;
  guestRun.level = 7;
  guestRun.bonus.damagePct = 0.25;
  guestRun.items.clover = 2;
  guestRun.weapons.push({ id: 'pistol', tier: 2, cursed: true, enchant: 'vamp' });
  guestRun.activeContract = 'elite_bounty';
  guestRun.recomputeStats();

  const hostShadow = new RunState({ character: 'spider', difficulty: 2, weapon: 'slingshot', biome: 'pond', seed: 'COOP-TEST' });
  applyGuestBuild(hostShadow, extractGuestBuild(guestRun));
  assert.equal(hostShadow.nectar, 128);
  assert.equal(hostShadow.level, 7);
  assert.equal(hostShadow.items.clover, 2);
  assert.equal(hostShadow.weapons.length, 2);
  assert.equal(hostShadow.weapons[1].cursed, true);
  assert.equal(hostShadow.weapons[1].enchant, 'vamp');
  assert.equal(hostShadow.activeContract, 'elite_bounty');
  assert.equal(hostShadow.stats.luck, guestRun.stats.luck);
});

console.log(`\nAll ${passed} invariant tests passed!`);
