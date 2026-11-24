/**
 * 读取 balance-sweep 的 JSON，打印难度/角色汇总。
 *   node scripts/balance-summary.mjs reports/balance-sweep-tuned.json
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/balance-summary.mjs <sweep.json>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = (data.results || []).filter((r) => r && r.reached > 0 && (r.phase === 'dead' || r.phase === 'victory'));
const isWin = (r) => r.phase === 'victory';
const DIFF = ['晴天', '阴天', '小雨', '暴雨', '雷暴'];
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (v) => Math.round(v * 10) / 10;
const items = (r) => Object.values(r.finalItems || {}).reduce((a, b) => a + b, 0);
const level = (r) => (r.waves && r.waves.length ? r.waves[r.waves.length - 1].level : 0);
const st = (r, k) => (r.finalStats ? r.finalStats[k] ?? 0 : 0);

console.log(`# ${file}`);
console.log(`有效 ${rows.length} / ${data.results.length} 局，错误 ${(data.errors || []).length} 条\n`);

console.log('| 难度 | 局数 | 通关 | 通关率 | 平均到达 | 道具 | 诅咒 | 等级 | 生命 | 甲壳 | 移速 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (let d = 0; d < 5; d++) {
  const rs = rows.filter((r) => r.difficulty === d);
  if (!rs.length) continue;
  const wins = rs.filter(isWin).length;
  console.log(`| ${DIFF[d]} | ${rs.length} | ${wins} | ${Math.round((wins / rs.length) * 100)}% | ${r1(avg(rs.map((r) => r.reached)))} | ${r1(avg(rs.map(items)))} | ${r1(avg(rs.map((r) => st(r, 'curse'))))} | ${r1(avg(rs.map(level)))} | ${r1(avg(rs.map((r) => st(r, 'maxHp'))))} | ${r1(avg(rs.map((r) => st(r, 'armor'))))} | ${r1(avg(rs.map((r) => st(r, 'speedPct'))) * 100)}% |`);
}

console.log('\n| 角色 | 晴天 | 阴天 | 小雨 | 暴雨 | 雷暴 | 均值 | 通关 |');
console.log('|---|---|---|---|---|---|---|---|');
const chars = [...new Set(rows.map((r) => r.character))];
const charRows = chars.map((c) => {
  const rs = rows.filter((r) => r.character === c);
  const cells = [0, 1, 2, 3, 4].map((d) => {
    const xs = rs.filter((r) => r.difficulty === d);
    if (!xs.length) return '—';
    const best = Math.max(...xs.map((r) => r.reached));
    const anyWin = xs.some(isWin);
    return anyWin ? `**${best} ✅**` : String(best);
  });
  return { c, cells, avg: r1(avg(rs.map((r) => r.reached))), wins: rs.filter(isWin).length };
}).sort((a, b) => b.avg - a.avg);
for (const x of charRows) console.log(`| ${x.c} | ${x.cells.join(' | ')} | ${x.avg} | ${x.wins} |`);

const bosses = rows.filter((r) => isWin(r) && r.bossTime != null).map((r) => r.bossTime);
if (bosses.length) {
  bosses.sort((a, b) => a - b);
  console.log(`\nBoss 用时：${bosses.join('s, ')}s（中位 ${bosses[Math.floor(bosses.length / 2)]}s）`);
}
const errs = data.errors || [];
if (errs.length) {
  console.log(`\n错误 ${errs.length} 条（前 5）：`);
  for (const e of errs.slice(0, 5)) console.log(`- ${e}`);
}
