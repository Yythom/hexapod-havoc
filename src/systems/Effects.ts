import Phaser from 'phaser';
import { DAMAGE_FONT, DAMAGE_FONT_SIZE, ensureDamageFont } from '../art/damageFont';
import { DEPTH, FONT_FAMILY, IS_COARSE_POINTER } from '../config';

export type NumberKind = 'normal' | 'crit' | 'player' | 'dodge' | 'heal' | 'level' | 'poison' | 'shield' | 'burn';

/** 纯数字用位图文字（便宜），带汉字的少数提示（闪避、升级！）用普通文字 */
type FloatObject = Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text;

interface FloatText {
  obj: FloatObject;
  bitmap: boolean;
  life: number;
  vx: number;
  vy: number;
  /** 本条数字的基础缩放（位图字体按字号换算） */
  baseScale: number;
}

const NUMERIC = /^[+-]?\d+$/;

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  streak: boolean;
}

const MAX_TEXTS = 80;
/** 手机上伤害数字放大一点 */
const NUMBER_BOOST = IS_COARSE_POINTER ? 1.2 : 1;
const MAX_PARTICLES = 480;
const TEXT_LIFE = 0.68;

const NUMBER_STYLE: Record<NumberKind, { color: number; size: number; scale: number }> = {
  normal: { color: 0xffffff, size: 20, scale: 1 },
  crit: { color: 0xffd23f, size: 27, scale: 1.38 },
  player: { color: 0xff5a4a, size: 24, scale: 1.22 },
  dodge: { color: 0xcfe8ff, size: 18, scale: 1 },
  heal: { color: 0x7dff8a, size: 20, scale: 1 },
  level: { color: 0xffe27a, size: 26, scale: 1.22 },
  poison: { color: 0xa8f060, size: 16, scale: 1 },
  shield: { color: 0x9fd8ff, size: 20, scale: 1.1 },
  burn: { color: 0xffa040, size: 16, scale: 1 },
};

interface Ring {
  x: number;
  y: number;
  r: number;
  color: number;
  t: number;
}

interface Bolt {
  pts: number[];
  t: number;
}

interface Slash {
  x: number;
  y: number;
  r: number;
  a0: number;
  a1: number;
  color: number;
  t: number;
  total: number;
}

interface Thrust {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  width: number;
  t: number;
  total: number;
}

interface Beam {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  t: number;
  total: number;
}

interface Zap {
  pts: number[];
  t: number;
}

interface Chomp {
  x: number;
  y: number;
  ang: number;
  r: number;
  color: number;
  t: number;
  total: number;
}

interface BashWave {
  x: number;
  y: number;
  ang: number;
  arc: number;
  r: number;
  color: number;
  t: number;
  total: number;
}

interface StarBurst {
  x: number;
  y: number;
  r: number;
  rot: number;
  color: number;
  t: number;
  total: number;
}

interface SonicThrust {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  width: number;
  rings: number;
  t: number;
  total: number;
}

interface Splat {
  img: Phaser.GameObjects.Image;
  life: number;
  maxLife: number;
  baseAlpha: number;
}

const RING_TIME = 0.32;
const BOLT_TIME = 0.2;
const ZAP_TIME = 0.18;
const MAX_SPLATS = 85;
const SPLAT_LIFE = 5.5;

/** 伤害数字、粒子、近战刀光、地面虫液战痕、闪光等一次性特效，全部走对象池 */
export class Effects {
  private readonly texts: FloatText[] = [];
  private readonly freeBitmaps: FloatText[] = [];
  private readonly freeTexts: FloatText[] = [];
  private readonly particles: Particle[] = [];
  private readonly freeParticles: Particle[] = [];
  private readonly splats: Splat[] = [];
  private readonly freeSplats: Phaser.GameObjects.Image[] = [];
  private readonly rings: Ring[] = [];
  private readonly bolts: Bolt[] = [];
  private readonly slashes: Slash[] = [];
  private readonly thrusts: Thrust[] = [];
  private readonly beams: Beam[] = [];
  private readonly zaps: Zap[] = [];
  private readonly chomps: Chomp[] = [];
  private readonly bashes: BashWave[] = [];
  private readonly stars: StarBurst[] = [];
  private readonly sonics: SonicThrust[] = [];
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly glowG: Phaser.GameObjects.Graphics;
  private stagger = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.effect);
    this.glowG = scene.add.graphics().setDepth(DEPTH.effect + 1).setBlendMode(Phaser.BlendModes.ADD);
    ensureDamageFont(scene);
  }

  /** 扩散的圆环（爆炸、震击） */
  ring(x: number, y: number, r: number, color = 0xffffff): void {
    this.rings.push({ x, y, r, color, t: 0 });
    if (r >= 45) this.star(x, y, r * 0.42, color);
  }

  /** 近战扇形横扫刀光（尖端收窄的漫画新月刃光 + 拖尾火花） */
  slash(x: number, y: number, r: number, angle: number, arc: number, color = 0xfff0c0): void {
    this.slashes.push({ x, y, r, a0: angle - arc, a1: angle + arc, color, t: 0, total: 0.24 });
    for (const f of [-0.5, 0, 0.5]) {
      const a = angle + arc * f;
      this.streaks(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, a, color, 2, 170, 0.75);
    }
  }

  /** 近战直刺锋芒拖尾 */
  thrust(x0: number, y0: number, x1: number, y1: number, color = 0xfff0c0, width = 7): void {
    this.thrusts.push({ x0, y0, x1, y1, color, width, t: 0, total: 0.17 });
  }

  /** 带破风冲击环的重型突刺（犄角 / 枪械） */
  sonicThrust(x0: number, y0: number, x1: number, y1: number, color = 0xffe49a, width = 12, rings = 2): void {
    this.sonics.push({ x0, y0, x1, y1, color, width, rings, t: 0, total: 0.22 });
    const ang = Math.atan2(y1 - y0, x1 - x0);
    this.star(x1, y1, width * 1.4, color, ang);
    this.streaks(x1, y1, ang, color, 5, 210, 0.9);
  }

  /** 大颚钳合撕咬特效：双弯月钳刃向中心咬合 + 中心爆星 */
  chomp(x: number, y: number, ang: number, r: number, color = 0xffc858): void {
    this.chomps.push({ x, y, ang, r, color, t: 0, total: 0.22 });
    const bx = x + Math.cos(ang) * r * 0.55;
    const by = y + Math.sin(ang) * r * 0.55;
    this.star(bx, by, 18, color, ang);
    this.streaks(bx, by, ang, color, 4, 165, 0.8);
  }

  /** 甲壳盾猛击震荡扇形波 */
  bash(x: number, y: number, ang: number, arc: number, r: number, color = 0x72d8ff): void {
    this.bashes.push({ x, y, ang, arc, r, color, t: 0, total: 0.26 });
    const hx = x + Math.cos(ang) * r * 0.55;
    const hy = y + Math.sin(ang) * r * 0.55;
    this.star(hx, hy, 20, color, ang);
    this.streaks(hx, hy, ang, color, 6, 200, 0.95);
  }

  /** 四芒爆闪星光（暴击、破甲、枪口、冲击点） */
  star(x: number, y: number, r = 16, color = 0xffe878, rot = Math.random() * Math.PI): void {
    this.stars.push({ x, y, r, rot, color, t: 0, total: 0.18 });
  }

  /** 定向速度线火花粒子 */
  streaks(x: number, y: number, ang: number, color: number, count: number, speed = 180, size = 0.8): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const a = ang + (Math.random() - 0.5) * 1.1;
      const v = speed * (0.45 + Math.random() * 0.65);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.16 + Math.random() * 0.16;
      p.size = size * (0.7 + Math.random() * 0.5);
      p.streak = true;
      p.img
        .setTexture('fx-streak')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setPosition(x, y)
        .setRotation(a)
        .setTint(color)
        .setAlpha(1)
        .setScale(p.size)
        .setVisible(true);
    }
  }

  /** 枪械/元素发射口定向光束与星芒火花 */
  muzzle(x: number, y: number, ang: number, color = 0xffe498, len = 20, count = 4): void {
    this.thrust(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, color, 9);
    this.star(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, len * 0.55, color, ang);
    this.streaks(x, y, ang, color, count, 190, 0.78);
  }

  /** 持续照射的光束（每次结算画一段，连起来像一直亮着） */
  beam(x0: number, y0: number, x1: number, y1: number, color = 0xffd060, total = 0.22): void {
    this.beams.push({ x0, y0, x1, y1, color, t: 0, total });
  }

  /** 链式闪电：依次连接各个命中点，每段带随机折线 */
  zap(points: number[]): void {
    const pts: number[] = [points[0], points[1]];
    for (let i = 2; i < points.length; i += 2) {
      const ax = points[i - 2];
      const ay = points[i - 1];
      const bx = points[i];
      const by = points[i + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const segs = Math.max(2, Math.round(len / 28));
      for (let k = 1; k < segs; k++) {
        const t = k / segs;
        const off = (Math.random() - 0.5) * Math.min(26, len * 0.3);
        pts.push(ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off);
      }
      pts.push(bx, by);
    }
    this.zaps.push({ pts, t: 0 });
  }

  /** 枪口/命中轻闪火花 */
  spark(x: number, y: number, color = 0xffe498, count = 4): void {
    this.burst(x, y, color, count, 120, 0.55);
  }

  /** 从天而降的闪电 */
  bolt(x: number, y: number): void {
    const pts: number[] = [];
    const top = y - 260;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(x + (k === 0 || k === 6 ? 0 : (Math.random() - 0.5) * 38), Phaser.Math.Linear(top, y, t));
    }
    this.bolts.push({ pts, t: 0 });
  }

  number(x: number, y: number, value: number | string, kind: NumberKind = 'normal'): void {
    const label = String(value);
    const bitmap = NUMERIC.test(label);
    const ft = this.acquire(bitmap);
    const st = NUMBER_STYLE[kind];
    const size = st.size * NUMBER_BOOST;
    if (bitmap) {
      const b = ft.obj as Phaser.GameObjects.BitmapText;
      b.setText(label).setTint(st.color);
      ft.baseScale = st.scale * (size / DAMAGE_FONT_SIZE);
    } else {
      const t = ft.obj as Phaser.GameObjects.Text;
      t.setText(label).setColor(`#${st.color.toString(16).padStart(6, '0')}`).setFontSize(Math.round(size));
      ft.baseScale = st.scale;
    }
    // 交替错开位置和微弱横飘，避免连击数字完全重叠
    this.stagger = (this.stagger + 1) % 5;
    const spread = (this.stagger - 2) * 8 + Phaser.Math.Between(-3, 3);
    const oy = (this.stagger % 2) * -6;
    ft.obj.setPosition(x + spread, y + oy).setAlpha(1).setScale(ft.baseScale).setVisible(true);
    ft.life = TEXT_LIFE;
    ft.vx = spread * 1.6;
    ft.vy = kind === 'crit' ? -96 : -80;
  }

  /** 击杀敌人后在地面留下缓慢渗入泥土的虫液痕迹 */
  splat(x: number, y: number, color: number, radius = 12): void {
    let img: Phaser.GameObjects.Image;
    if (this.freeSplats.length > 0) {
      img = this.freeSplats.pop()!;
    } else if (this.splats.length >= MAX_SPLATS) {
      const oldest = this.splats.shift()!;
      img = oldest.img;
    } else {
      img = this.scene.add.image(x, y, 'ui-splat').setDepth(DEPTH.ground + 1);
    }
    const scale = Phaser.Math.Clamp(radius / 16, 0.55, 1.55);
    const baseAlpha = 0.52;
    img
      .setPosition(x, y)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(scale * Phaser.Math.FloatBetween(0.9, 1.15), scale * Phaser.Math.FloatBetween(0.75, 1.05))
      .setTint(color)
      .setAlpha(baseAlpha)
      .setVisible(true);
    this.splats.push({ img, life: SPLAT_LIFE, maxLife: SPLAT_LIFE, baseAlpha });
  }

  burst(x: number, y: number, color: number, count: number, speed = 160, size = 1, glow = true): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.25 + Math.random() * 0.28;
      p.size = size * 0.68 * (0.6 + Math.random() * 0.6);
      p.streak = false;
      p.img
        .setTexture(glow && i % 3 === 0 ? 'fx-flare' : 'dot')
        .setBlendMode(glow ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
        .setPosition(x, y)
        .setRotation(a)
        .setTint(color)
        .setAlpha(1)
        .setScale(p.size)
        .setVisible(true);
    }
  }

  update(dt: number): void {
    this.updateShapes(dt);
    const dragTxt = Math.exp(-4 * dt);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const ft = this.texts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.release(i);
        continue;
      }
      ft.vx *= dragTxt;
      ft.vy *= dragTxt;
      ft.obj.x += ft.vx * dt;
      ft.obj.y += ft.vy * dt;
      const t = 1 - ft.life / TEXT_LIFE;
      ft.obj.setScale(ft.baseScale * (t < 0.14 ? 1 + (0.14 - t) * 3.2 : 1));
      ft.obj.setAlpha(Math.min(1, ft.life / 0.24));
    }

    const drag = Math.exp(-5 * dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        this.freeParticles.push(p);
        continue;
      }
      p.vx *= drag;
      p.vy *= drag;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      const k = p.life / p.maxLife;
      if (p.streak) {
        p.img.setScale(p.size * (0.6 + 0.6 * k), p.size * (0.35 + 0.65 * k));
      } else {
        p.img.setScale(p.size * (0.35 + 0.65 * k));
      }
      p.img.setAlpha(k);
    }

    for (let i = this.splats.length - 1; i >= 0; i--) {
      const sp = this.splats[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.img.setVisible(false);
        this.freeSplats.push(sp.img);
        this.splats[i] = this.splats[this.splats.length - 1];
        this.splats.pop();
        continue;
      }
      if (sp.life < 2) sp.img.setAlpha(sp.baseAlpha * (sp.life / 2));
    }
  }

  private fillCrescent(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number,
    thickness: number,
    a0: number,
    a1: number,
    color: number,
    alpha: number,
    segs = 18,
  ): void {
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const a = a0 + (a1 - a0) * t;
      const bulge = Math.sin(t * Math.PI);
      const rad = r + thickness * 0.35 * bulge;
      pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
    for (let k = segs; k >= 0; k--) {
      const t = k / segs;
      const a = a0 + (a1 - a0) * t;
      const bulge = Math.sin(t * Math.PI);
      const rad = r - thickness * 0.72 * bulge;
      pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  }

  private fillLance(
    g: Phaser.GameObjects.Graphics,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    halfW: number,
    color: number,
    alpha: number,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy * halfW;
    const ny = ux * halfW;
    const mx = x0 + dx * 0.34;
    const my = y0 + dy * 0.34;
    g.fillStyle(color, alpha);
    g.fillPoints(
      [
        { x: x0, y: y0 },
        { x: mx + nx, y: my + ny },
        { x: x1, y: y1 },
        { x: mx - nx, y: my - ny },
      ],
      true,
    );
  }

  private fillStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rOuter: number, rInner: number, rot: number, color: number, alpha: number): void {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      const r = i % 2 === 0 ? rOuter : rInner;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  }

  private updateShapes(dt: number): void {
    const g = this.g;
    const glow = this.glowG;
    g.clear();
    glow.clear();

    // 扇形横扫刀光（尖端收窄的漫画新月刃光 + 加法光晕）
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.t += dt;
      if (s.t >= s.total) {
        this.slashes.splice(i, 1);
        continue;
      }
      const k = s.t / s.total;
      const a = 1 - k;
      const head = s.a0 + (s.a1 - s.a0) * Math.min(1, k * 2.2);
      const tail = s.a0 + (s.a1 - s.a0) * Math.max(0, (k - 0.18) * 1.15);
      const rad = s.r * (0.86 + 0.18 * Phaser.Math.Easing.Quadratic.Out(k));
      const thick = 22 * a + 4;
      this.fillCrescent(glow, s.x, s.y, rad, thick * 1.45, tail, head, s.color, 0.55 * a);
      this.fillCrescent(g, s.x, s.y, rad, thick * 0.85, tail, head, s.color, 0.85 * a);
      this.fillCrescent(glow, s.x, s.y, rad + 2, thick * 0.42, tail + 0.08, head, 0xffffff, 0.95 * a);
    }

    // 锋芒矛形直刺
    for (let i = this.thrusts.length - 1; i >= 0; i--) {
      const tr = this.thrusts[i];
      tr.t += dt;
      if (tr.t >= tr.total) {
        this.thrusts.splice(i, 1);
        continue;
      }
      const a = 1 - tr.t / tr.total;
      const hw = (tr.width * 0.72 + 1.5) * a;
      this.fillLance(glow, tr.x0, tr.y0, tr.x1, tr.y1, hw * 1.65, tr.color, 0.52 * a);
      this.fillLance(g, tr.x0, tr.y0, tr.x1, tr.y1, hw, tr.color, 0.85 * a);
      this.fillLance(glow, tr.x0, tr.y0, tr.x1, tr.y1, hw * 0.45, 0xffffff, 0.95 * a);
    }

    // 破风冲击锥刺
    for (let i = this.sonics.length - 1; i >= 0; i--) {
      const sn = this.sonics[i];
      sn.t += dt;
      if (sn.t >= sn.total) {
        this.sonics.splice(i, 1);
        continue;
      }
      const k = sn.t / sn.total;
      const a = 1 - k;
      const hw = (sn.width * 0.75 + 2) * a;
      this.fillLance(glow, sn.x0, sn.y0, sn.x1, sn.y1, hw * 1.6, sn.color, 0.55 * a);
      this.fillLance(g, sn.x0, sn.y0, sn.x1, sn.y1, hw, sn.color, 0.9 * a);
      this.fillLance(glow, sn.x0, sn.y0, sn.x1, sn.y1, hw * 0.42, 0xffffff, 0.95 * a);
      const ang = Math.atan2(sn.y1 - sn.y0, sn.x1 - sn.x0);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      for (let r = 1; r <= sn.rings; r++) {
        const frac = 0.35 + (r / (sn.rings + 1)) * 0.55;
        const cx = Phaser.Math.Linear(sn.x0, sn.x1, frac);
        const cy = Phaser.Math.Linear(sn.y0, sn.y1, frac);
        const span = (12 + r * 6) * (0.45 + 0.8 * k);
        const back = 10 * (0.5 + 0.5 * k);
        const tx = cx - Math.cos(ang) * back;
        const ty = cy - Math.sin(ang) * back;
        glow.lineStyle(4 * a + 1, sn.color, 0.65 * a);
        glow.beginPath();
        glow.moveTo(tx + nx * span, ty + ny * span);
        glow.lineTo(cx, cy);
        glow.lineTo(tx - nx * span, ty - ny * span);
        glow.strokePath();
        g.lineStyle(1.8 * a + 0.6, 0xffffff, 0.85 * a);
        g.beginPath();
        g.moveTo(tx + nx * span * 0.8, ty + ny * span * 0.8);
        g.lineTo(cx, cy);
        g.lineTo(tx - nx * span * 0.8, ty - ny * span * 0.8);
        g.strokePath();
      }
    }

    // 光束
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      if (b.t >= b.total) {
        this.beams.splice(i, 1);
        continue;
      }
      const a = 1 - b.t / b.total;
      glow.lineStyle(12, b.color, a * 0.45);
      glow.beginPath();
      glow.moveTo(b.x0, b.y0);
      glow.lineTo(b.x1, b.y1);
      glow.strokePath();
      g.lineStyle(4.5, b.color, a * 0.85);
      g.beginPath();
      g.moveTo(b.x0, b.y0);
      g.lineTo(b.x1, b.y1);
      g.strokePath();
      glow.lineStyle(2, 0xffffff, a * 0.98);
      glow.beginPath();
      glow.moveTo(b.x0, b.y0);
      glow.lineTo(b.x1, b.y1);
      glow.strokePath();
      this.fillStar(glow, b.x1, b.y1, 13 * a, 3.5 * a, b.t * 14, b.color, 0.75 * a);
      this.fillStar(glow, b.x1, b.y1, 8 * a, 2 * a, b.t * 14, 0xffffff, 0.95 * a);
    }

    // 链式闪电
    for (let i = this.zaps.length - 1; i >= 0; i--) {
      const z = this.zaps[i];
      z.t += dt;
      if (z.t >= ZAP_TIME) {
        this.zaps.splice(i, 1);
        continue;
      }
      const a = 1 - z.t / ZAP_TIME;
      glow.lineStyle(10, 0x4ca8ff, a * 0.55);
      glow.beginPath();
      glow.moveTo(z.pts[0], z.pts[1]);
      for (let k = 2; k < z.pts.length; k += 2) glow.lineTo(z.pts[k], z.pts[k + 1]);
      glow.strokePath();
      g.lineStyle(4, 0x9ce0ff, a * 0.9);
      g.beginPath();
      g.moveTo(z.pts[0], z.pts[1]);
      for (let k = 2; k < z.pts.length; k += 2) g.lineTo(z.pts[k], z.pts[k + 1]);
      g.strokePath();
      glow.lineStyle(1.8, 0xffffff, a);
      glow.beginPath();
      glow.moveTo(z.pts[0], z.pts[1]);
      for (let k = 2; k < z.pts.length; k += 2) glow.lineTo(z.pts[k], z.pts[k + 1]);
      glow.strokePath();
    }

    // 扩散冲击波环
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= RING_TIME) {
        this.rings.splice(i, 1);
        continue;
      }
      const k = r.t / RING_TIME;
      const rad = r.r * (0.34 + 0.66 * Phaser.Math.Easing.Quadratic.Out(k));
      glow.lineStyle(10 * (1 - k) + 2, r.color, 0.55 * (1 - k));
      glow.strokeCircle(r.x, r.y, rad);
      g.lineStyle(4.5 * (1 - k) + 1.2, r.color, 0.92 * (1 - k));
      g.strokeCircle(r.x, r.y, rad);
      glow.lineStyle(2, 0xffffff, 0.72 * (1 - k));
      glow.strokeCircle(r.x, r.y, rad * 0.92);
      g.fillStyle(r.color, 0.14 * (1 - k));
      g.fillCircle(r.x, r.y, rad);
    }

    // 钳颚撕咬双新月刃
    for (let i = this.chomps.length - 1; i >= 0; i--) {
      const c = this.chomps[i];
      c.t += dt;
      if (c.t >= c.total) {
        this.chomps.splice(i, 1);
        continue;
      }
      const k = c.t / c.total;
      const a = 1 - k;
      const clamp = 0.65 * (1 - Phaser.Math.Easing.Cubic.Out(Math.min(1, k * 1.45)));
      const rad = c.r * (0.48 + 0.28 * k);
      for (const side of [-1, 1]) {
        const jawA = c.ang + side * (clamp + 0.06);
        const startA = jawA - side * 0.56;
        const a0 = Math.min(startA, jawA);
        const a1 = Math.max(startA, jawA);
        this.fillCrescent(glow, c.x, c.y, rad, 16 * a, a0, a1, c.color, 0.58 * a, 12);
        this.fillCrescent(g, c.x, c.y, rad, 10 * a, a0, a1, c.color, 0.9 * a, 12);
        this.fillCrescent(glow, c.x, c.y, rad + 1, 4.5 * a, a0, a1, 0xffffff, 0.95 * a, 12);
      }
    }

    // 盾击扇形震荡波（尖锐收尾新月波 + 二重音波）
    for (let i = this.bashes.length - 1; i >= 0; i--) {
      const b = this.bashes[i];
      b.t += dt;
      if (b.t >= b.total) {
        this.bashes.splice(i, 1);
        continue;
      }
      const k = b.t / b.total;
      const a = 1 - k;
      const ease = Phaser.Math.Easing.Quadratic.Out(k);
      const rOuter = b.r * (0.34 + 0.72 * ease);
      const rInner = rOuter * 0.62;
      const a0 = b.ang - b.arc;
      const a1 = b.ang + b.arc;
      this.fillCrescent(glow, b.x, b.y, rOuter, 22 * a + 3, a0, a1, b.color, 0.6 * a, 18);
      this.fillCrescent(g, b.x, b.y, rOuter, 13 * a + 2, a0, a1, b.color, 0.88 * a, 18);
      this.fillCrescent(glow, b.x, b.y, rOuter + 2, 5.5 * a, a0 + 0.1, a1 - 0.1, 0xffffff, 0.95 * a, 16);
      this.fillCrescent(glow, b.x, b.y, rInner, 9 * a, a0 + 0.18, a1 - 0.18, b.color, 0.48 * a, 12);
    }

    // 四芒爆闪星光
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      st.t += dt;
      if (st.t >= st.total) {
        this.stars.splice(i, 1);
        continue;
      }
      const k = st.t / st.total;
      const a = 1 - k;
      const pop = k < 0.25 ? 0.55 + (k / 0.25) * 0.65 : 1.2 - (k - 0.25) * 0.4;
      const rad = st.r * pop;
      this.fillStar(glow, st.x, st.y, rad * 1.25, rad * 0.24, st.rot, st.color, 0.65 * a);
      this.fillStar(g, st.x, st.y, rad, rad * 0.2, st.rot, st.color, 0.9 * a);
      this.fillStar(glow, st.x, st.y, rad * 0.68, rad * 0.12, st.rot, 0xffffff, 0.98 * a);
    }

    // 闪电
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      if (b.t >= BOLT_TIME) {
        this.bolts.splice(i, 1);
        continue;
      }
      const a = 1 - b.t / BOLT_TIME;
      glow.lineStyle(14, 0xffe050, a * 0.55);
      glow.beginPath();
      glow.moveTo(b.pts[0], b.pts[1]);
      for (let k = 2; k < b.pts.length; k += 2) glow.lineTo(b.pts[k], b.pts[k + 1]);
      glow.strokePath();
      g.lineStyle(6, 0xfff498, a * 0.9);
      g.beginPath();
      g.moveTo(b.pts[0], b.pts[1]);
      for (let k = 2; k < b.pts.length; k += 2) g.lineTo(b.pts[k], b.pts[k + 1]);
      g.strokePath();
      glow.lineStyle(2.5, 0xffffff, a);
      glow.beginPath();
      glow.moveTo(b.pts[0], b.pts[1]);
      for (let k = 2; k < b.pts.length; k += 2) glow.lineTo(b.pts[k], b.pts[k + 1]);
      glow.strokePath();
      const lx = b.pts[b.pts.length - 2];
      const ly = b.pts[b.pts.length - 1];
      this.fillStar(glow, lx, ly, 24 * a, 5 * a, b.t * 10, 0xffe468, 0.85 * a);
    }
  }

  private release(i: number): void {
    const ft = this.texts[i];
    ft.obj.setVisible(false);
    this.texts[i] = this.texts[this.texts.length - 1];
    this.texts.pop();
    (ft.bitmap ? this.freeBitmaps : this.freeTexts).push(ft);
  }

  private acquire(bitmap: boolean): FloatText {
    let ft = (bitmap ? this.freeBitmaps : this.freeTexts).pop();
    if (!ft && this.texts.length >= MAX_TEXTS) {
      // 池满了就把最早的那条收回来再用
      const oldest = this.texts.findIndex((f) => f.bitmap === bitmap);
      if (oldest >= 0) {
        this.release(oldest);
        ft = (bitmap ? this.freeBitmaps : this.freeTexts).pop();
      }
    }
    if (!ft) {
      const obj = bitmap
        ? this.scene.add.bitmapText(0, 0, DAMAGE_FONT, '', DAMAGE_FONT_SIZE).setOrigin(0.5).setDepth(DEPTH.text)
        : this.scene.add
            .text(0, 0, '', {
              fontFamily: FONT_FAMILY,
              fontSize: '20px',
              fontStyle: 'bold',
              color: '#ffffff',
              stroke: '#1a1208',
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(DEPTH.text);
      ft = { obj, bitmap, life: 0, vx: 0, vy: 0, baseScale: 1 };
    }
    this.texts.push(ft);
    return ft;
  }

  private acquireParticle(): Particle | null {
    let p = this.freeParticles.pop();
    if (!p) {
      if (this.particles.length >= MAX_PARTICLES) return null;
      const img = this.scene.add.image(0, 0, 'dot').setDepth(DEPTH.effect);
      p = { img, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, streak: false };
    }
    this.particles.push(p);
    return p;
  }
}
