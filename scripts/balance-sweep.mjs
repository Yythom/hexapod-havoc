/**
 * 平衡回归扫描器：用无头 Chrome + 游戏内的 __bot 跑整局，输出 JSON。
 *
 * 用法：
 *   npm run test:balance                 # 13 角色 × 5 难度 × 1 局
 *   npm run test:balance -- --runs=3     # 每格 3 局
 *   npm run test:balance -- --diffs=0,4 --runs=5
 *   CHROME_PATH=/path/to/chrome npm run test:balance
 *
 * 说明：
 * - Vite 以 hmr:false 启动，扫描期间改源码不会刷新页面。
 * - 扫描器自己控制节奏（Node 侧逐 chunk 调用页面里的 __sweep.step()），不依赖 setTimeout/RAF，
 *   避免隐藏标签页被 Chrome 冻结。
 * - 每个场景用固定种子（角色 + 轮次）替换 Math.random，便于复现。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CHARS = ['stag', 'rhino', 'bombardier', 'ladybug', 'spider', 'mantis', 'antqueen', 'tiger', 'cicada', 'caterpillar', 'mosquito', 'dungbeetle', 'termite'];
const DIFF_NAMES = ['晴天', '阴天', '小雨', '暴雨', '雷暴'];

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function avg(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function r1(v) {
  return Math.round(v * 10) / 10;
}

/** 在页面里安装扫描器。Puppeteer 会把这个函数序列化后执行。 */
function installSweep(scenarios) {
  const seedBase = 20261124;
  const hash = (s) => [...s].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const sweep = {
    scenarios,
    results: [],
    idx: 0,
    current: null,
    errors: [],
    running: false,
    stepCount: 0,
    init() {
      this.results = [];
      this.idx = 0;
      this.current = null;
      this.errors = [];
      this.running = true;
      this.stepCount = 0;
      window.__game.loop.sleep();
    },
    seed(sc) {
      return seedBase + hash(sc.character) * 7919 + (sc.run || 1) * 131;
    },
    record(endedPhase) {
      const st = window.__bot.state();
      const w = this.current.waves;
      const last = w[w.length - 1] || {};
      this.results.push({
        character: this.current.sc.character,
        difficulty: this.current.sc.difficulty,
        run: this.current.sc.run || 1,
        weapon: this.current.sc.weapon || null,
        reached: last.w || 0,
        phase: endedPhase || last.phase || 'unknown',
        win: last.w === 20 && endedPhase === 'victory',
        bossTime: last.w === 20 ? last.time : null,
        waves: w.map((x) => ({
          w: x.w, kills: x.kills, income: x.income, harvest: x.harvest, minHp: x.minHp,
          maxHp: x.maxHp, maxEnemies: x.maxEnemies, level: x.level, time: x.time, phase: x.phase,
        })),
        finalStats: st.stats,
        finalWeapons: st.weapons,
        finalItems: st.items,
        ms: Math.round(performance.now() - this.current.startedAt),
      });
    },
    /** 跑一小段（最多 2 个 run(2) 块），返回进度。Node 侧循环调用。 */
    step() {
      if (!this.running) return { done: true, total: this.scenarios.length, finished: this.results.length, errors: this.errors.slice(-5) };
      this.stepCount++;
      try {
        if (!this.current) {
          if (this.idx >= this.scenarios.length) {
            this.running = false;
            return { done: true, total: this.scenarios.length, finished: this.results.length, errors: this.errors.slice(-5) };
          }
          const sc = this.scenarios[this.idx];
          Math.random = mulberry32(this.seed(sc));
          window.__bot.start('smart', {
            character: sc.character,
            difficulty: sc.difficulty,
            weapon: sc.weapon,
          }, { contracts: sc.contracts !== false, shop: sc.shop !== false });
          this.current = { sc, waves: [], startedAt: performance.now() };
        }

        let ended = false;
        let endedPhase = '';
        for (let k = 0; k < 2 && !ended; k++) {
          let logs = window.__bot.run(2);
          // 波间/cleanup 过渡：手动推进帧，避免频道/定时器被冻结
          for (let guard = 0; guard < 10 && logs.length === 0; guard++) {
            const ph = window.__bot.phase();
            if (ph === 'cleanup') {
              window.__bot.advance(240);
            } else if (ph === 'intermission') {
              try {
                const scn = window.__game.scene.getScene('Intermission');
                if (scn && scn.scene && scn.scene.isActive()) {
                  if (scn.page === 'chest') scn.takeChest();
                  else if (scn.page === 'level') {
                    const u = scn.run && scn.run.pendingUpgrades && scn.run.pendingUpgrades[0];
                    if (u) scn.chooseUpgrade(u);
                    else scn.finish();
                  } else if (scn.page === 'contract') scn.skipContract();
                  else scn.finish();
                }
              } catch (e) { /* ignore */ }
              window.__bot.advance(30);
            } else {
              break;
            }
            logs = window.__bot.run(2);
          }
          if (logs.length === 0) {
            const ph = window.__bot.phase();
            if (ph === 'dead' || ph === 'victory') {
              ended = true;
              endedPhase = ph;
            } else {
              this.errors.push(`stuck: ${this.current.sc.character} d${this.current.sc.difficulty} r${this.current.sc.run || 1} phase=${ph}`);
              ended = true;
              endedPhase = ph;
            }
            break;
          }
          this.current.waves.push(...logs);
          const last = logs[logs.length - 1];
          if (last.phase !== 'intermission' && last.phase !== 'combat') {
            ended = true;
            endedPhase = last.phase;
          }
          if (this.current.waves.length >= 20) {
            ended = true;
            endedPhase = last.phase;
          }
        }

        if (ended) {
          this.record(endedPhase);
          this.current = null;
          this.idx++;
        }
      } catch (e) {
        this.errors.push(`#${this.idx} ${e && e.stack ? e.stack : e}`);
        this.current = null;
        this.idx++;
      }
      return this.status();
    },
    status() {
      return {
        done: !this.running,
        total: this.scenarios.length,
        finished: this.results.length,
        errorCount: this.errors.length,
        current: this.current
          ? { c: this.current.sc.character, d: this.current.sc.difficulty, r: this.current.sc.run || 1, waves: this.current.waves.length }
          : null,
      };
    },
    dump() {
      return { results: this.results, errors: this.errors };
    },
  };
  window.__sweep = sweep;
  return { total: scenarios.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runs = Math.max(1, Number(args.runs) || 1);
  const diffs = (args.diffs ? String(args.diffs) : '0,1,2,3,4').split(',').map(Number).filter((d) => d >= 0 && d <= 4);
  const chars = args.chars ? String(args.chars).split(',') : CHARS;
  const port = Number(args.port) || 5210;
  const headless = args.headless !== '0';
  const out = args.out ? path.resolve(ROOT, args.out) : path.join(ROOT, 'reports', `balance-sweep-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`);
  const stopOnError = args['stop-on-error'] === 'true';

  const scenarios = [];
  // 难度优先排序：先拿到全角色的晴天，再拿雷暴，再补中间档
  for (const d of diffs) {
    for (const c of chars) {
      for (let r = 1; r <= runs; r++) scenarios.push({ character: c, difficulty: d, run: r });
    }
  }
  console.log(`[sweep] ${scenarios.length} 局 = ${chars.length} 角色 × ${diffs.length} 难度 × ${runs} 轮`);

  const server = await createServer({
    root: ROOT,
    server: { port, strictPort: true, hmr: false },
    logLevel: 'warn',
  });
  await server.listen();
  const url = `http://localhost:${port}/`;
  console.log(`[sweep] dev server ${url}`);

  const exe = chromePath();
  if (!exe) throw new Error('找不到 Chrome，请设置 CHROME_PATH');
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: headless ? true : false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--window-size=1280,800'],
  });

  let exitCode = 0;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1280, height: 800 });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__bot && window.__game', { timeout: 90000, polling: 250 });
    await page.evaluate(installSweep, scenarios);
    await page.evaluate(() => window.__sweep.init());
    console.log('[sweep] installed, start');

    let lastFinished = 0;
    let lastLog = Date.now();
    for (;;) {
      const st = await page.evaluate(() => window.__sweep.step());
      if (st.finished !== lastFinished) {
        lastFinished = st.finished;
        const cur = st.current ? `${st.current.c} d${st.current.d} r${st.current.r} w${st.current.waves}` : '—';
        console.log(`[${st.finished}/${st.total}] ${cur}${st.errorCount ? ` errors=${st.errorCount}` : ''}`);
        lastLog = Date.now();
        if (stopOnError && st.errorCount > 0) break;
      }
      if (st.done) break;
      // 防止长时间无进展
      if (Date.now() - lastLog > 10 * 60 * 1000) {
        console.log('[sweep] 10 分钟无进展，终止');
        exitCode = 2;
        break;
      }
    }

    const data = await page.evaluate(() => window.__sweep.dump());
    const payload = {
      generated: new Date().toISOString(),
      args: { runs, diffs, chars, headless },
      scenarios: scenarios.length,
      results: data.results,
      errors: data.errors,
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(payload, null, 1));
    console.log(`[sweep] 写入 ${out}`);

    // 摘要
    const rows = data.results.filter((r) => r.reached > 0);
    for (const d of diffs) {
      const rs = rows.filter((r) => r.difficulty === d);
      if (!rs.length) continue;
      const wins = rs.filter((r) => r.win).length;
      const items = avg(rs.map((r) => Object.values(r.finalItems || {}).reduce((a, b) => a + b, 0)));
      const curse = avg(rs.map((r) => (r.finalStats ? r.finalStats.curse : 0)));
      const level = avg(rs.map((r) => (r.waves.length ? r.waves[r.waves.length - 1].level : 0)));
      console.log(`[summary] ${DIFF_NAMES[d]}: ${wins}/${rs.length} 通关, 平均 ${r1(avg(rs.map((r) => r.reached)))} 波, 道具 ${r1(items)}, 诅咒 ${r1(curse)}, 等级 ${r1(level)}`);
    }
    console.log(`[sweep] 错误 ${data.errors.length} 条`);
    if (data.errors.length) console.log(data.errors.slice(0, 5).join('\n'));
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
