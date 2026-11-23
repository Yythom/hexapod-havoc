import Phaser from 'phaser';
import { IS_COARSE_POINTER } from '../config';

/** 贴图绘制用的小工具：支持 Phaser Graphics 和更细腻的 Canvas 2D（渐变、阴影、贝塞尔曲线） */

export type G = Phaser.GameObjects.Graphics;
export type DrawFn = (g: G) => void;
export type Ctx = CanvasRenderingContext2D;
export type Draw2D = (ctx: Ctx) => void;

/** 世界内精灵贴图的超采样倍率（桌面端 3x 适配 2K/4K 大屏，移动端 2x 兼顾内存与帧率） */
export const SPRITE_RES = IS_COARSE_POINTER ? 2 : 3;

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0, seg = 24): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push(new Phaser.Math.Vector2(cx + x * c - y * s, cy + x * s + y * c));
  }
  return pts;
}

export function fillEllipse(g: G, color: number, cx: number, cy: number, rx: number, ry: number, rot = 0, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints(ellipse(cx, cy, rx, ry, rot), true);
}

export function fillPoly(g: G, color: number, flat: number[], alpha = 1): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new Phaser.Math.Vector2(flat[i], flat[i + 1]));
  g.fillStyle(color, alpha);
  g.fillPoints(pts, true);
}

export function line(g: G, width: number, color: number, pts: number[], alpha = 1): void {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.strokePath();
}

export function circle(g: G, color: number, x: number, y: number, r: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
}

/** 把 Phaser Graphics 绘制结果烘焙成贴图。scale > 1 时按倍数放大绘制，给界面用的大图更清晰。 */
export function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: DrawFn, scale = 1): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  if (scale !== 1) g.scaleCanvas(scale, scale);
  draw(g);
  g.generateTexture(key, Math.ceil(w * scale), Math.ceil(h * scale));
  g.destroy();
}

/** 把 Canvas 2D 绘制结果烘焙成贴图，支持平滑渐变、柔边阴影与抗锯齿曲线 */
export function bake2D(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw2D, scale = 1): void {
  if (scene.textures.exists(key)) return;
  const tw = Math.ceil(w * scale);
  const th = Math.ceil(h * scale);
  const tex = scene.textures.createCanvas(key, tw, th);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  ctx.restore();
  tex.refresh();
}

/**
 * 将原本用 Phaser.Graphics 写就的道具图标通过 Canvas 2D 代理绘制，
 * 并统一叠加手绘深色外描边、接触阴影与斜上方暖阳高光，让整套道具贴图质感统一。
 */
export function bakeShadedItem(scene: Phaser.Scene, key: string, w: number, h: number, draw: DrawFn, scale = 2): void {
  if (scene.textures.exists(key)) return;
  const tw = Math.ceil(w * scale);
  const th = Math.ceil(h * scale);

  // 先在离屏 Canvas 上按逻辑坐标绘制
  const off = document.createElement('canvas');
  off.width = tw;
  off.height = th;
  const octx = off.getContext('2d')!;
  octx.save();
  octx.scale(scale, scale);
  octx.lineCap = 'round';
  octx.lineJoin = 'round';

  let fillStyleStr = '#ffffff';
  let strokeStyleStr = '#000000';
  let strokeWidth = 1;
  let pathOpen = false;

  const proxy = {
    fillStyle(color: number, alpha = 1) {
      fillStyleStr = rgba(color, alpha);
      return proxy;
    },
    lineStyle(width: number, color: number, alpha = 1) {
      strokeWidth = width;
      strokeStyleStr = rgba(color, alpha);
      return proxy;
    },
    fillCircle(x: number, y: number, r: number) {
      octx.beginPath();
      octx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      octx.fillStyle = fillStyleStr;
      octx.fill();
      return proxy;
    },
    strokeCircle(x: number, y: number, r: number) {
      octx.beginPath();
      octx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      octx.strokeStyle = strokeStyleStr;
      octx.lineWidth = strokeWidth;
      octx.stroke();
      return proxy;
    },
    fillPoints(pts: Phaser.Math.Vector2[], closeShape = true) {
      if (!pts.length) return proxy;
      octx.beginPath();
      octx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) octx.lineTo(pts[i].x, pts[i].y);
      if (closeShape) octx.closePath();
      octx.fillStyle = fillStyleStr;
      octx.fill();
      return proxy;
    },
    fillRoundedRect(x: number, y: number, rw: number, rh: number, r: number) {
      cRoundRect(octx, x, y, rw, rh, r, fillStyleStr);
      return proxy;
    },
    fillRect(x: number, y: number, rw: number, rh: number) {
      octx.fillStyle = fillStyleStr;
      octx.fillRect(x, y, rw, rh);
      return proxy;
    },
    beginPath() {
      octx.beginPath();
      pathOpen = true;
      return proxy;
    },
    moveTo(x: number, y: number) {
      if (!pathOpen) octx.beginPath();
      octx.moveTo(x, y);
      return proxy;
    },
    lineTo(x: number, y: number) {
      octx.lineTo(x, y);
      return proxy;
    },
    strokePath() {
      octx.strokeStyle = strokeStyleStr;
      octx.lineWidth = strokeWidth;
      octx.stroke();
      pathOpen = false;
      return proxy;
    },
  } as unknown as G;

  draw(proxy);
  octx.restore();

  // 生成带暗墨轮廓层的剪影用于外描边
  const outlineCanvas = document.createElement('canvas');
  outlineCanvas.width = tw;
  outlineCanvas.height = th;
  const ol = outlineCanvas.getContext('2d')!;
  ol.drawImage(off, 0, 0);
  ol.globalCompositeOperation = 'source-in';
  ol.fillStyle = '#1d1006';
  ol.fillRect(0, 0, tw, th);

  const tex = scene.textures.createCanvas(key, tw, th);
  if (!tex) return;
  const ctx = tex.getContext();

  // 1. 底部柔和投影
  ctx.save();
  ctx.shadowColor = 'rgba(10, 6, 2, 0.45)';
  ctx.shadowBlur = 3 * scale;
  ctx.shadowOffsetY = 1.6 * scale;
  ctx.drawImage(off, 0, 0);
  ctx.restore();

  // 2. 1px 外墨边（增强小图标在深色格子里的轮廓感）
  const d = Math.max(1, Math.round(scale * 0.65));
  ctx.save();
  ctx.globalAlpha = 0.72;
  for (const [ox, oy] of [
    [-d, 0],
    [d, 0],
    [0, -d],
    [0, d],
  ]) {
    ctx.drawImage(outlineCanvas, ox, oy);
  }
  ctx.restore();

  // 3. 主图 + 斜向暖光立体釉面（source-atop）
  const lit = document.createElement('canvas');
  lit.width = tw;
  lit.height = th;
  const lctx = lit.getContext('2d')!;
  lctx.drawImage(off, 0, 0);
  lctx.globalCompositeOperation = 'source-atop';
  const glaze = lctx.createLinearGradient(0, 0, tw, th);
  glaze.addColorStop(0, 'rgba(255, 246, 214, 0.24)');
  glaze.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  glaze.addColorStop(1, 'rgba(24, 10, 4, 0.22)');
  lctx.fillStyle = glaze;
  lctx.fillRect(0, 0, tw, th);

  ctx.drawImage(lit, 0, 0);
  tex.refresh();
}

// ---------- Canvas 2D 绘图辅助 ----------

export function rgba(hex: number, a = 1): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

export function cEllipse(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 0,
  rot = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function cCircle(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 0,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function cPoly(
  ctx: Ctx,
  pts: number[],
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 0,
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function cLine(ctx: Ctx, pts: number[], stroke: string, lineWidth: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function cRoundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 0,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** 柔边径向渐变（椭圆缩放），用于接触阴影、光晕、立体高光 */
export function cSoftEllipse(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  innerColor: string,
  outerColor: string,
  rot = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (rot !== 0) ctx.rotate(rot);
  ctx.scale(rx, ry);
  const grad = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 立体球形/甲壳渐变 */
export function cShellGrad(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  hi: string,
  mid: string,
  dark: string,
): CanvasGradient {
  const g = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.32, r * 0.08, cx, cy, r);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  return g;
}

/** 接触环境光遮蔽阴影（居中，旋转任意角度都自然贴地） */
export function cContactShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.32): void {
  cSoftEllipse(ctx, cx, cy, rx, ry, `rgba(10, 16, 6, ${alpha})`, 'rgba(10, 16, 6, 0)');
}

/**
 * 土豆兄弟风格纯平赛璐璐（Flat Cel-Shaded）填充路径：
 * 无模糊渐变，只有：纯色基底 + 下方硬切暗影带 + 上方硬切高光片 + 粗黑漫画墨线轮廓。
 */
export function cCelShape(
  ctx: Ctx,
  trace: () => void,
  base: string,
  shadow: string,
  hi: string,
  ink = '#050507',
  inkWidth = 2.8,
  bounds: { x: number; y: number; w: number; h: number },
): void {
  ctx.save();
  trace();
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();

  // 下方硬切暗影带
  ctx.fillStyle = shadow;
  ctx.fillRect(bounds.x - 2, bounds.y + bounds.h * 0.56, bounds.w + 4, bounds.h * 0.52);

  // 上方硬切高光条
  ctx.fillStyle = hi;
  ctx.beginPath();
  ctx.ellipse(
    bounds.x + bounds.w * 0.44,
    bounds.y + bounds.h * 0.24,
    Math.max(1, bounds.w * 0.32),
    Math.max(1, bounds.h * 0.14),
    -0.08,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  if (inkWidth > 0) {
    trace();
    ctx.strokeStyle = ink;
    ctx.lineWidth = inkWidth;
    ctx.stroke();
  }
}

export function cCelEllipse(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  base: string,
  shadow: string,
  hi: string,
  ink = '#050507',
  inkWidth = 2.8,
): void {
  cCelShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(0.2, rx), Math.max(0.2, ry), 0, 0, Math.PI * 2);
    },
    base,
    shadow,
    hi,
    ink,
    inkWidth,
    { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 },
  );
}

export function cCelCircle(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  base: string,
  shadow: string,
  hi: string,
  ink = '#050507',
  inkWidth = 2.8,
): void {
  cCelEllipse(ctx, cx, cy, r, r, base, shadow, hi, ink, inkWidth);
}

/** 土豆兄弟风格大漫画眼（粗黑眼眶 + 白眼白 + 偏移黑瞳 + 反光点 + 可选愤怒斜眉） */
export function cComicEye(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  sclera = '#ffffff',
  pupil = '#070709',
  browAngle = 0,
  ink = '#050507',
): void {
  cCircle(ctx, cx, cy, r, sclera, ink, Math.max(1.2, r * 0.48));
  cCircle(ctx, cx + r * 0.22, cy, Math.max(0.7, r * 0.46), pupil);
  cCircle(ctx, cx - r * 0.12, cy - r * 0.28, Math.max(0.4, r * 0.22), '#ffffff');
  if (browAngle !== 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(browAngle);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.4, r * 0.55);
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, -r * 0.78);
    ctx.lineTo(r * 1.05, -r * 0.78);
    ctx.stroke();
    ctx.restore();
  }
}
