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
}

const MAX_TEXTS = 80;
/** 手机上伤害数字放大一点 */
const NUMBER_BOOST = IS_COARSE_POINTER ? 1.2 : 1;
const MAX_PARTICLES = 420;
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
  private readonly g: Phaser.GameObjects.Graphics;
  private stagger = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.effect);
    ensureDamageFont(scene);
  }

  /** 扩散的圆环（爆炸、震击） */
  ring(x: number, y: number, r: number, color = 0xffffff): void {
    this.rings.push({ x, y, r, color, t: 0 });
  }

  /** 近战扇形横扫刀光 */
  slash(x: number, y: number, r: number, angle: number, arc: number, color = 0xfff0c0): void {
    this.slashes.push({ x, y, r, a0: angle - arc, a1: angle + arc, color, t: 0, total: 0.22 });
  }

  /** 近战直刺锋芒拖尾 */
  thrust(x0: number, y0: number, x1: number, y1: number, color = 0xfff0c0, width = 7): void {
    this.thrusts.push({ x0, y0, x1, y1, color, width, t: 0, total: 0.16 });
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

  burst(x: number, y: number, color: number, count: number, speed = 160, size = 1): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.28 + Math.random() * 0.3;
      p.size = size * 0.65 * (0.6 + Math.random() * 0.6);
      p.img.setPosition(x, y).setTint(color).setAlpha(1).setScale(p.size).setVisible(true);
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
      p.img.setScale(p.size * (0.35 + 0.65 * k));
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

  private updateShapes(dt: number): void {
    const g = this.g;
    g.clear();

    // 扇形横扫刀光
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.t += dt;
      if (s.t >= s.total) {
        this.slashes.splice(i, 1);
        continue;
      }
      const k = s.t / s.total;
      const a = 1 - k;
      // 外弧主刃光
      g.lineStyle(12 * a + 2, s.color, 0.55 * a);
      g.beginPath();
      g.arc(s.x, s.y, s.r * (0.82 + 0.14 * k), s.a0, s.a1, false);
      g.strokePath();
      // 内锐白锋芒
      g.lineStyle(4 * a + 1, 0xffffff, 0.8 * a);
      g.beginPath();
      g.arc(s.x, s.y, s.r * (0.86 + 0.14 * k), s.a0 + 0.1, s.a1 - 0.1, false);
      g.strokePath();
    }

    // 直刺锋芒拖尾
    for (let i = this.thrusts.length - 1; i >= 0; i--) {
      const tr = this.thrusts[i];
      tr.t += dt;
      if (tr.t >= tr.total) {
        this.thrusts.splice(i, 1);
        continue;
      }
      const a = 1 - tr.t / tr.total;
      g.lineStyle(tr.width * a + 1, tr.color, 0.55 * a);
      g.beginPath();
      g.moveTo(tr.x0, tr.y0);
      g.lineTo(tr.x1, tr.y1);
      g.strokePath();
      g.lineStyle(Math.max(1.5, tr.width * 0.38 * a), 0xffffff, 0.85 * a);
      g.beginPath();
      g.moveTo(tr.x0, tr.y0);
      g.lineTo(tr.x1, tr.y1);
      g.strokePath();
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
      for (const [w, c, mul] of [
        [9, b.color, 0.25],
        [4.5, b.color, 0.7],
        [1.8, 0xffffff, 0.95],
      ] as [number, number, number][]) {
        g.lineStyle(w, c, a * mul);
        g.beginPath();
        g.moveTo(b.x0, b.y0);
        g.lineTo(b.x1, b.y1);
        g.strokePath();
      }
      g.fillStyle(b.color, 0.45 * a);
      g.fillCircle(b.x1, b.y1, 9);
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
      for (const [w, c, mul] of [
        [8, 0x7ab8ff, 0.3],
        [4, 0xb8e0ff, 0.85],
        [1.6, 0xffffff, 1],
      ] as [number, number, number][]) {
        g.lineStyle(w, c, a * mul);
        g.beginPath();
        g.moveTo(z.pts[0], z.pts[1]);
        for (let k = 2; k < z.pts.length; k += 2) g.lineTo(z.pts[k], z.pts[k + 1]);
        g.strokePath();
      }
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
      const rad = r.r * (0.36 + 0.64 * Phaser.Math.Easing.Quadratic.Out(k));
      g.lineStyle(6 * (1 - k) + 1.5, r.color, 1 - k);
      g.strokeCircle(r.x, r.y, rad);
      g.lineStyle(2, 0xffffff, 0.5 * (1 - k));
      g.strokeCircle(r.x, r.y, rad * 0.92);
      g.fillStyle(r.color, 0.18 * (1 - k));
      g.fillCircle(r.x, r.y, rad);
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
      for (const [w, c, mul] of [
        [11, 0xffe468, 0.35],
        [6, 0xfff4a0, 0.85],
        [2.5, 0xffffff, 1],
      ] as [number, number, number][]) {
        g.lineStyle(w, c, a * mul);
        g.beginPath();
        g.moveTo(b.pts[0], b.pts[1]);
        for (let k = 2; k < b.pts.length; k += 2) g.lineTo(b.pts[k], b.pts[k + 1]);
        g.strokePath();
      }
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
      p = { img, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1 };
    }
    this.particles.push(p);
    return p;
  }
}
