import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { MAX_ENEMY_RADIUS, SPAWN_POP, type Enemy, type EnemyManager } from './EnemyManager';
import type { Effects } from './Effects';
import type { HitResolver, HitSource } from './HitResolver';

/** 一组蚜虫（来自同一把蚜虫牧群），蚁后的工蚁也走这套 */
export interface AphidGroup {
  slot: number;
  /** 贴图：aphid / workerant */
  texture: string;
  /** 每只的生命（蚜虫 10，蚁后的工蚁随波次成长） */
  hp?: number;
  count: number;
  damage: number;
  crit: number;
  critMultiplier: number;
  knockback: number;
  /** 攻击间隔（吃攻速） */
  interval: number;
}

/** 一组绕身飞蛾（来自同一把绕身飞蛾） */
export interface MothGroup {
  slot: number;
  count: number;
  damage: number;
  crit: number;
  critMultiplier: number;
  knockback: number;
  /** 每只飞蛾两次造成伤害的间隔 */
  interval: number;
  src: HitSource;
}

interface Moth {
  sprite: Phaser.GameObjects.Image;
  slot: number;
  x: number;
  y: number;
  flap: number;
  /** 最近碰过的怪：同一只怪要隔一个间隔才会再被这只飞蛾伤害 */
  recent: { e: Enemy; t: number }[];
}

interface Aphid {
  sprite: Phaser.GameObjects.Image;
  slot: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cd: number;
  invuln: number;
  respawn: number;
  alive: boolean;
  heading: number;
  orbit: number;
}

const APHID_HP = 10;
const APHID_SPEED = 210;
const APHID_RADIUS = 8;
const RESPAWN_TIME = 5;
const SEEK_RANGE = 420;
/** 飞蛾：绕身半径、角速度、碰撞半径 */
const MOTH_ORBIT = 70;
const MOTH_SPIN = 3;
const MOTH_RADIUS = 12;

/** 召唤物：蚜虫（工蚁）小兵自动追敌，阵亡 5 秒后在玩家身边重生；飞蛾绕身旋转、不会死 */
export class Summons {
  private list: Aphid[] = [];
  private moths: Moth[] = [];
  private mothAngle = 0;
  private readonly buf: Enemy[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: Effects,
    private readonly resolver: HitResolver,
  ) {}

  /** 现在活着的召唤物数量（蚁后解锁条件） */
  get aliveCount(): number {
    let n = this.moths.length;
    for (const a of this.list) if (a.alive) n++;
    return n;
  }

  update(dt: number, px: number, py: number, groups: AphidGroup[], mothGroups: MothGroup[], enemies: EnemyManager): void {
    this.updateMoths(dt, px, py, mothGroups, enemies);
    this.sync(groups, px, py);
    const groupOf = new Map(groups.map((g) => [g.slot, g]));
    for (const a of this.list) {
      const g = groupOf.get(a.slot)!;
      a.maxHp = g.hp ?? APHID_HP;
      if (!a.alive) {
        a.respawn -= dt;
        if (a.respawn <= 0) this.revive(a, px, py);
        continue;
      }
      a.cd = Math.max(0, a.cd - dt);
      a.invuln = Math.max(0, a.invuln - dt);

      const target = this.target(a, px, py, enemies);
      let tx: number;
      let ty: number;
      if (target) {
        tx = target.x;
        ty = target.y;
      } else {
        a.orbit += dt * 1.6;
        tx = px + Math.cos(a.orbit) * 48;
        ty = py + Math.sin(a.orbit) * 48;
      }
      const dx = tx - a.x;
      const dy = ty - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = target ? APHID_RADIUS + target.radius : 4;
      if (d > reach) {
        const step = Math.min(d - reach, APHID_SPEED * dt);
        a.x = Phaser.Math.Clamp(a.x + (dx / d) * step, 20, WORLD_WIDTH - 20);
        a.y = Phaser.Math.Clamp(a.y + (dy / d) * step, 20, WORLD_HEIGHT - 20);
      }
      if (target && d <= reach + 2 && a.cd <= 0) {
        const crit = Math.random() < g.crit;
        const dmg = Math.max(1, Math.round(g.damage * (crit ? g.critMultiplier : 1)));
        enemies.hit(target, dmg, crit, dx / d, dy / d, g.knockback);
        a.cd = g.interval;
      }
      a.heading = Phaser.Math.Angle.RotateTo(a.heading, Math.atan2(dy, dx), 10 * dt);

      // 被怪碰到会掉血
      if (a.invuln <= 0) {
        for (const e of enemies.grid.query(a.x, a.y, APHID_RADIUS + MAX_ENEMY_RADIUS, this.buf)) {
          if (e.age < SPAWN_POP || e.frozen > 0) continue;
          const ex = e.x - a.x;
          const ey = e.y - a.y;
          const rr = APHID_RADIUS + e.radius;
          if (ex * ex + ey * ey > rr * rr) continue;
          a.hp -= e.damage;
          a.invuln = 0.6;
          if (a.hp <= 0) this.kill(a);
          break;
        }
      }
      a.sprite.setPosition(a.x, a.y).setRotation(a.heading + Math.sin(a.orbit * 8) * 0.1);
      a.sprite.setAlpha(a.invuln > 0 && Math.floor(a.invuln * 16) % 2 === 0 ? 0.5 : 1);
    }
  }

  clear(): void {
    for (const a of this.list) a.sprite.destroy();
    this.list = [];
    for (const m of this.moths) m.sprite.destroy();
    this.moths = [];
  }

  /** 飞蛾均匀排在一圈上绕身旋转，碰到怪就造成伤害（每只有自己的间隔） */
  private updateMoths(dt: number, px: number, py: number, groups: MothGroup[], enemies: EnemyManager): void {
    const want: MothGroup[] = [];
    for (const g of groups) for (let k = 0; k < g.count; k++) want.push(g);
    while (this.moths.length > want.length) this.moths.pop()!.sprite.destroy();
    while (this.moths.length < want.length) {
      this.moths.push({
        sprite: this.scene.add.image(px, py, 'moth').setDepth(DEPTH.player + 1).setScale(1 / SPRITE_RES),
        slot: -1,
        x: px,
        y: py,
        flap: Math.random() * 6,
        recent: [],
      });
    }
    if (want.length === 0) return;
    this.mothAngle += dt * MOTH_SPIN;
    const n = this.moths.length;
    this.moths.forEach((m, k) => {
      const g = want[k];
      m.slot = g.slot;
      m.flap += dt * 18;
      for (let r = m.recent.length - 1; r >= 0; r--) {
        m.recent[r].t -= dt;
        if (m.recent[r].t <= 0 || !m.recent[r].e.active) m.recent.splice(r, 1);
      }
      const a = this.mothAngle + (k / n) * Math.PI * 2;
      m.x = px + Math.cos(a) * MOTH_ORBIT;
      m.y = py + Math.sin(a) * MOTH_ORBIT;
      m.sprite
        .setPosition(m.x, m.y)
        .setRotation(a + Math.PI / 2)
        .setScale((1 + Math.sin(m.flap) * 0.12) / SPRITE_RES, 1 / SPRITE_RES);
      for (const e of enemies.grid.query(m.x, m.y, MOTH_RADIUS + MAX_ENEMY_RADIUS, this.buf)) {
        if (!e.active || e.age < SPAWN_POP || m.recent.some((h) => h.e === e)) continue;
        const ex = e.x - m.x;
        const ey = e.y - m.y;
        const rr = MOTH_RADIUS + e.radius;
        if (ex * ex + ey * ey > rr * rr) continue;
        const crit = Math.random() < g.crit;
        const dmg = Math.max(1, Math.round(g.damage * (crit ? g.critMultiplier : 1)));
        const d = Math.hypot(e.x - px, e.y - py) || 1;
        m.recent.push({ e, t: g.interval });
        this.resolver.hit(e, dmg, crit, (e.x - px) / d, (e.y - py) / d, g.knockback, g.src);
      }
    });
  }

  /** 每组的蚜虫数量和设定一致：多了删掉，少了补上 */
  private sync(groups: AphidGroup[], px: number, py: number): void {
    const texOf = new Map(groups.map((g) => [g.slot, g.texture]));
    const want = new Map(groups.map((g) => [g.slot, g.count]));
    const have = new Map<number, number>();
    this.list = this.list.filter((a) => {
      const n = have.get(a.slot) ?? 0;
      if (n >= (want.get(a.slot) ?? 0)) {
        a.sprite.destroy();
        return false;
      }
      have.set(a.slot, n + 1);
      return true;
    });
    for (const g of groups) {
      for (let n = have.get(g.slot) ?? 0; n < g.count; n++) {
        const a: Aphid = {
          sprite: this.scene.add.image(px, py, texOf.get(g.slot) ?? 'aphid').setDepth(DEPTH.player - 1).setScale(1 / SPRITE_RES),
          slot: g.slot,
          x: px,
          y: py,
          hp: g.hp ?? APHID_HP,
          maxHp: g.hp ?? APHID_HP,
          cd: 0,
          invuln: 0,
          respawn: 0,
          alive: true,
          heading: 0,
          orbit: Math.random() * Math.PI * 2,
        };
        this.revive(a, px, py);
        this.list.push(a);
      }
    }
  }

  private target(a: Aphid, px: number, py: number, enemies: EnemyManager): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of enemies.active) {
      if (e.age < SPAWN_POP) continue;
      const fromPlayer = Math.hypot(e.x - px, e.y - py);
      if (fromPlayer > SEEK_RANGE) continue;
      const d = Math.hypot(e.x - a.x, e.y - a.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private kill(a: Aphid): void {
    a.alive = false;
    a.respawn = RESPAWN_TIME;
    a.sprite.setVisible(false);
    this.fx.burst(a.x, a.y, 0x8ad85a, 8, 120, 0.8);
  }

  private revive(a: Aphid, px: number, py: number): void {
    const ang = Math.random() * Math.PI * 2;
    a.x = px + Math.cos(ang) * 30;
    a.y = py + Math.sin(ang) * 30;
    a.hp = a.maxHp;
    a.alive = true;
    a.invuln = 1;
    a.sprite.setPosition(a.x, a.y).setVisible(true);
  }
}
