import Phaser from 'phaser';
import { bake2D, type Ctx } from './draw';

/**
 * 高质感程序化战斗特效贴图库（256×256 Canvas 2D 烘焙）：
 * 相比 Phaser.Graphics 纯色多边形，具备：
 * - 沿挥砍方向的平滑透明度衰减与笔触拉丝（dry-brush motion smear）
 * - 体积感多段色彩梯度（灼白核心 -> 高饱和中层 -> 深色暗影/炭黑边缘）
 * - 立体地裂倒角、晶格六边形护盾、分叉高频电弧、体积火球与柔边烟云
 * 所有贴图内容严格收在半径 122/128（95.3%）以内，运行时按 displaySize = 2*r 即可保证 100% 不越界。
 */

const TEX_SIZE = 256;

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 沿圆弧绘制逐段渐变+渐细的笔触刀光条带（真正有首尾虚实与光泽感，不再是死板纯色香蕉） */
function drawTaperedArcRibbon(
  ctx: Ctx,
  cx: number,
  cy: number,
  baseR: number,
  aStart: number,
  aEnd: number,
  maxWidth: number,
  colorAt: (u: number) => string,
  radialShift?: (u: number) => number,
  widthProfile?: (u: number) => number,
  segs = 48,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < segs; i++) {
    const u0 = i / segs;
    const u1 = (i + 1) / segs;
    const um = (u0 + u1) * 0.5;
    const wFrac = widthProfile ? widthProfile(um) : Math.pow(Math.sin(um * Math.PI), 0.75) * (0.25 + 0.75 * Math.pow(um, 0.55));
    const w = Math.max(0.5, maxWidth * wFrac);
    const r0 = baseR + (radialShift ? radialShift(u0) : 0);
    const r1 = baseR + (radialShift ? radialShift(u1) : 0);
    const th0 = aStart + (aEnd - aStart) * u0;
    const th1 = aStart + (aEnd - aStart) * u1;
    ctx.strokeStyle = colorAt(um);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(th0) * r0, cy + Math.sin(th0) * r0);
    ctx.lineTo(cx + Math.cos(th1) * r1, cy + Math.sin(th1) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

/** 绘制带发光与锐利核心的锯齿闪电折线 */
function drawLightningArc(
  ctx: Ctx,
  pts: [number, number][],
  glowCol: string,
  coreCol: string,
  width: number,
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = glowCol;
  ctx.shadowBlur = width * 3.2;
  ctx.strokeStyle = glowCol;
  ctx.lineWidth = width * 2.1;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.shadowBlur = width * 1.2;
  ctx.strokeStyle = coreCol;
  ctx.lineWidth = width * 0.85;
  ctx.stroke();
  ctx.restore();
}

/** 1. 通用锋刃横扫（中性高反差灰度笔触：支持运行时 setTint 染成任意武器颜色，同时保留金属光泽与尾迹虚实） */
export function drawSlashBlade(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46; // 117.7px，留出安全边绝不超界
  const a0 = -1.18;
  const a1 = 1.08;

  // 柔焦暗影底托（低透明暗墨让刀光贴在地面上更有空间层次）
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.84,
    a0,
    a1,
    size * 0.17,
    (u) => `rgba(12, 16, 22, ${0.42 * Math.sin(u * Math.PI) * (0.3 + 0.7 * u)})`,
    undefined,
    undefined,
    40,
  );

  // 主体气浪宽带（从透明烟尾 -> 饱满中段 -> 锐利前沿，可被 setTint 着色）
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.86,
    a0,
    a1,
    size * 0.145,
    (u) => {
      const a = Math.pow(u, 0.85) * Math.pow(Math.sin(u * Math.PI), 0.55) * 0.86;
      const lum = Math.round(185 + 70 * u);
      return `rgba(${lum}, ${lum}, ${lum}, ${a.toFixed(3)})`;
    },
    (u) => -size * 0.015 * (1 - u),
    undefined,
    52,
  );

  // 内部 4 条干画笔拉丝速度纹（营造高速劈砍的空气撕裂质感）
  const grooves = [
    { dr: -0.055, w: 0.014, a: 0.42, s: 0.08, e: 0.94 },
    { dr: -0.022, w: 0.018, a: 0.62, s: 0.16, e: 0.97 },
    { dr: 0.012, w: 0.012, a: 0.5, s: 0.28, e: 0.98 },
    { dr: -0.082, w: 0.008, a: 0.28, s: 0.12, e: 0.84 },
  ];
  for (const gr of grooves) {
    drawTaperedArcRibbon(
      ctx,
      cx,
      cy,
      R * (0.88 + gr.dr),
      a0 + (a1 - a0) * gr.s,
      a0 + (a1 - a0) * gr.e,
      size * gr.w,
      (u) => `rgba(255, 255, 255, ${(gr.a * Math.pow(u, 0.7) * Math.sin(u * Math.PI)).toFixed(3)})`,
      undefined,
      undefined,
      36,
    );
  }

  // 最外缘锋刃刀锋高光（紧贴外弧的锋利金属反光脊）
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.85)';
  ctx.shadowBlur = 6;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.955,
    a0 + 0.32,
    a1 + 0.02,
    size * 0.024,
    (u) => `rgba(255, 255, 255, ${(0.96 * Math.pow(u, 0.55) * Math.pow(Math.sin(u * Math.PI), 0.4)).toFixed(3)})`,
    undefined,
    (u) => Math.sin(u * Math.PI) * (0.4 + 0.6 * u),
    44,
  );
  ctx.restore();
}

/** 2. 烈焰火舌横扫（体积感火浪：焦烟底 -> 炽红中段 -> 卷曲有机火舌 -> 灼白火芯） */
export function drawSlashFire(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.455;
  const a0 = -1.16;
  const a1 = 1.08;
  const rng = makeRng(1024);

  // 焦炭暗红烟底
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.82,
    a0,
    a1,
    size * 0.2,
    (u) => `rgba(48, 12, 6, ${(0.55 * Math.pow(u, 0.6) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    40,
  );

  // 深橙红主焰体
  ctx.save();
  ctx.shadowColor = 'rgba(255, 82, 16, 0.7)';
  ctx.shadowBlur = 10;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.85,
    a0 + 0.06,
    a1,
    size * 0.145,
    (u) => {
      const a = Math.pow(u, 0.7) * Math.pow(Math.sin(u * Math.PI), 0.5) * 0.92;
      const g = Math.round(58 + 115 * u);
      return `rgba(255, ${g}, 18, ${a.toFixed(3)})`;
    },
    undefined,
    undefined,
    48,
  );
  ctx.restore();

  // 有机弯曲火舌（用柔和贝塞尔水滴火苗代替生硬三角形，全部严格收在 R 以内）
  for (let i = 0; i < 11; i++) {
    const u = 0.18 + (i / 10) * 0.76;
    const th = a0 + (a1 - a0) * u;
    const env = Math.sin(u * Math.PI);
    const baseR = R * (0.83 + (rng() - 0.5) * 0.06);
    const tipR = Math.min(size * 0.472, baseR + size * (0.045 + rng() * 0.048) * env);
    const bx = cx + Math.cos(th) * baseR;
    const by = cy + Math.sin(th) * baseR;
    const curl = -0.14 - rng() * 0.12; // 顺挥砍反方向拖曳卷曲
    const tx = cx + Math.cos(th + curl) * tipR;
    const ty = cy + Math.sin(th + curl) * tipR;
    const mx = (bx + tx) * 0.5 + Math.cos(th + 1.1) * (5 + rng() * 5);
    const my = (by + ty) * 0.5 + Math.sin(th + 1.1) * (5 + rng() * 5);
    const grad = ctx.createLinearGradient(bx, by, tx, ty);
    grad.addColorStop(0, `rgba(255, 224, 96, ${(0.88 * env).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(255, 112, 24, ${(0.82 * env).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(180, 30, 8, 0)');
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = (7 + rng() * 5) * env;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.stroke();
    ctx.restore();
  }

  // 灼热明黄-白芯锋刃
  ctx.save();
  ctx.shadowColor = 'rgba(255, 210, 80, 0.9)';
  ctx.shadowBlur = 7;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.91,
    a0 + 0.3,
    a1,
    size * 0.042,
    (u) => `rgba(255, 248, 200, ${(0.95 * Math.pow(u, 0.6) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    40,
  );
  ctx.restore();

  // 零星漂浮火星（严格在 R 内）
  for (let i = 0; i < 12; i++) {
    const u = 0.1 + rng() * 0.85;
    const th = a0 + (a1 - a0) * u;
    const rr = R * (0.68 + rng() * 0.28);
    const px = cx + Math.cos(th) * rr;
    const py = cy + Math.sin(th) * rr;
    const rad = 1.2 + rng() * 2.1;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,244,170,0.92)' : 'rgba(255,140,40,0.85)';
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 3. 雷电 / 等离子光刃横扫（深蓝电晕 + 霓虹青等离子带 + 多条高能分叉电弧） */
export function drawSlashElectric(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.455;
  const a0 = -1.16;
  const a1 = 1.08;
  const rng = makeRng(2048);

  // 深靛蓝外电晕
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.87,
    a0,
    a1,
    size * 0.17,
    (u) => `rgba(18, 92, 210, ${(0.48 * Math.pow(u, 0.6) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    44,
  );

  // 霓虹青等离子刀带
  ctx.save();
  ctx.shadowColor = 'rgba(40, 235, 255, 0.9)';
  ctx.shadowBlur = 10;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.89,
    a0 + 0.12,
    a1,
    size * 0.088,
    (u) => `rgba(68, 240, 255, ${(0.88 * Math.pow(u, 0.65) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    46,
  );
  ctx.restore();

  // 主分叉电弧 + 次级电须（严格钳制在 R*0.98 内）
  for (let strand = 0; strand < 2; strand++) {
    const pts: [number, number][] = [];
    const segs = 18;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const th = a0 + 0.14 + (a1 - a0 - 0.14) * u;
      const jit = i === 0 || i === segs ? 0 : (rng() - 0.5) * size * (strand === 0 ? 0.085 : 0.065) * Math.sin(u * Math.PI);
      const rr = Math.min(size * 0.468, R * (strand === 0 ? 0.9 : 0.83) + jit);
      pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
    }
    drawLightningArc(ctx, pts, 'rgba(56, 216, 255, 0.9)', '#ffffff', strand === 0 ? 2.4 : 1.5);

    // 侧向电须分支
    for (let b = 4; b < pts.length - 3; b += 4) {
      const [bx, by] = pts[b];
      const baseA = Math.atan2(by - cy, bx - cx);
      const side = rng() < 0.5 ? -1 : 1;
      const b1x = bx + Math.cos(baseA + side * 0.6) * 10;
      const b1y = by + Math.sin(baseA + side * 0.6) * 10;
      const b2x = b1x + Math.cos(baseA + side * 0.3) * 8;
      const b2y = b1y + Math.sin(baseA + side * 0.3) * 8;
      // 钳制到半径内
      const clampPt = (x: number, y: number): [number, number] => {
        const d = Math.hypot(x - cx, y - cy);
        const maxD = size * 0.468;
        return d > maxD ? [cx + ((x - cx) / d) * maxD, cy + ((y - cy) / d) * maxD] : [x, y];
      };
      drawLightningArc(ctx, [[bx, by], clampPt(b1x, b1y), clampPt(b2x, b2y)], 'rgba(80, 228, 255, 0.85)', '#eaffff', 1.2);
    }
  }
}

/** 4. 虚灵双影横扫（烟雾紫黑幽影 + 荧光青绿灵刃 + 飘散魂火微粒） */
export function drawSlashEthereal(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.455;
  const a0 = -1.2;
  const a1 = 1.06;
  const rng = makeRng(3072);

  // 幽暗紫烟雾宽尾
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.82,
    a0,
    a1 - 0.06,
    size * 0.21,
    (u) => `rgba(38, 18, 62, ${(0.56 * Math.pow(u, 0.55) * Math.sin(u * Math.PI)).toFixed(3)})`,
    (u) => Math.sin(u * Math.PI * 3) * 3.5,
    undefined,
    46,
  );

  // 内侧错位紫罗兰鬼影弧
  ctx.save();
  ctx.shadowColor = 'rgba(182, 92, 255, 0.8)';
  ctx.shadowBlur = 10;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.74,
    a0 - 0.04,
    a1 - 0.16,
    size * 0.072,
    (u) => `rgba(186, 108, 255, ${(0.76 * Math.pow(u, 0.7) * Math.sin(u * Math.PI)).toFixed(3)})`,
    (u) => Math.cos(u * Math.PI * 3.5) * 4,
    undefined,
    44,
  );
  ctx.restore();

  // 外侧幽青灵刃主弧
  ctx.save();
  ctx.shadowColor = 'rgba(72, 245, 200, 0.85)';
  ctx.shadowBlur = 9;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.9,
    a0 + 0.16,
    a1,
    size * 0.095,
    (u) => `rgba(74, 242, 200, ${(0.88 * Math.pow(u, 0.65) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    48,
  );
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.94,
    a0 + 0.32,
    a1,
    size * 0.025,
    (u) => `rgba(225, 255, 248, ${(0.95 * Math.pow(u, 0.6) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    40,
  );
  ctx.restore();

  // 飘散灵火小光珠
  for (let i = 0; i < 14; i++) {
    const u = 0.08 + rng() * 0.84;
    const th = a0 + (a1 - a0) * u;
    const rr = R * (0.62 + rng() * 0.32);
    const px = cx + Math.cos(th) * rr;
    const py = cy + Math.sin(th) * rr;
    const rad = 1.6 + rng() * 2.8;
    const g = ctx.createRadialGradient(px, py, 0.3, px, py, rad * 1.8);
    g.addColorStop(0, 'rgba(230,255,248,0.95)');
    g.addColorStop(0.5, i % 2 === 0 ? 'rgba(84,242,200,0.65)' : 'rgba(186,108,255,0.65)');
    g.addColorStop(1, 'rgba(84,242,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rad * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 5. 圆锯金属磨花横扫（冷钢残影 + 炽热切屑锯齿轨迹 + 金属火花束） */
export function drawSlashSaw(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.455;
  const a0 = -1.14;
  const a1 = 1.06;
  const rng = makeRng(4096);

  // 冷钢深灰动势残影
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.85,
    a0,
    a1,
    size * 0.14,
    (u) => `rgba(32, 38, 48, ${(0.62 * Math.pow(u, 0.6) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    44,
  );
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.86,
    a0 + 0.08,
    a1,
    size * 0.105,
    (u) => `rgba(186, 202, 220, ${(0.76 * Math.pow(u, 0.7) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    44,
  );

  // 炽热橙金锯齿锋缘（高频细密金属磨刃质感）
  ctx.save();
  ctx.shadowColor = 'rgba(255, 150, 36, 0.85)';
  ctx.shadowBlur = 7;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.935,
    a0 + 0.18,
    a1,
    size * 0.038,
    (u) => `rgba(255, 178, 58, ${(0.92 * Math.pow(u, 0.6) * Math.sin(u * Math.PI)).toFixed(3)})`,
    (u) => Math.sin(u * Math.PI * 22) * 3.8 * Math.sin(u * Math.PI),
    undefined,
    72,
  );
  ctx.restore();

  // 切线方向飞溅的细长白热砂轮火花（全部限制在 R 内）
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const u = 0.25 + rng() * 0.7;
    const th = a0 + (a1 - a0) * u;
    const rr = R * (0.76 + rng() * 0.18);
    const sx = cx + Math.cos(th) * rr;
    const sy = cy + Math.sin(th) * rr;
    const tanA = th + Math.PI * 0.42 + (rng() - 0.5) * 0.35;
    const len = 7 + rng() * 11;
    let ex = sx + Math.cos(tanA) * len;
    let ey = sy + Math.sin(tanA) * len;
    const d = Math.hypot(ex - cx, ey - cy);
    if (d > size * 0.468) {
      ex = cx + ((ex - cx) / d) * size * 0.468;
      ey = cy + ((ey - cy) / d) * size * 0.468;
    }
    const g = ctx.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0, 'rgba(255, 250, 210, 0.96)');
    g.addColorStop(0.5, 'rgba(255, 162, 42, 0.88)');
    g.addColorStop(1, 'rgba(255, 96, 18, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** 6. 重型风压劈砍（粗砺宽幅中性灰度笔触，支持 setTint 着色，强调厚重动量与气压纹） */
export function drawSlashHeavy(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46;
  const a0 = -1.14;
  const a1 = 1.04;

  // 厚重暗墨风压底影
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.81,
    a0,
    a1,
    size * 0.24,
    (u) => `rgba(14, 12, 10, ${(0.54 * Math.pow(u, 0.55) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    44,
  );

  // 宽幅粗砺主扫带
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.83,
    a0 + 0.04,
    a1,
    size * 0.195,
    (u) => {
      const a = Math.pow(u, 0.72) * Math.pow(Math.sin(u * Math.PI), 0.5) * 0.88;
      const lum = Math.round(170 + 80 * u);
      return `rgba(${lum}, ${lum}, ${lum}, ${a.toFixed(3)})`;
    },
    undefined,
    undefined,
    48,
  );

  // 多道深浅交替的动能撕裂纹
  for (let i = 0; i < 5; i++) {
    const dr = -0.09 + i * 0.042;
    drawTaperedArcRibbon(
      ctx,
      cx,
      cy,
      R * (0.86 + dr),
      a0 + 0.14 + i * 0.04,
      a1 - 0.02,
      size * (i % 2 === 0 ? 0.015 : 0.01),
      (u) =>
        i % 2 === 0
          ? `rgba(255,255,255,${(0.55 * Math.pow(u, 0.7) * Math.sin(u * Math.PI)).toFixed(3)})`
          : `rgba(18,14,10,${(0.32 * Math.sin(u * Math.PI)).toFixed(3)})`,
      undefined,
      undefined,
      36,
    );
  }

  // 外侧冲击压缩前沿脊
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.96,
    a0 + 0.35,
    a1 + 0.02,
    size * 0.022,
    (u) => `rgba(255, 255, 255, ${(0.86 * Math.pow(u, 0.5) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    38,
  );
}

/** 7. 王虫之剑 / IV 阶圣光金弧（琥珀神辉 + 二重金刃 + 星芒高光） */
export function drawSlashHoly(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.458;
  const a0 = -1.18;
  const a1 = 1.08;

  // 暖琥珀外辉光
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.85,
    a0,
    a1,
    size * 0.2,
    (u) => `rgba(235, 138, 20, ${(0.44 * Math.pow(u, 0.6) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    46,
  );

  // 内层金紫错位辉弧
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.74,
    a0 + 0.04,
    a1 - 0.14,
    size * 0.068,
    (u) => `rgba(255, 152, 224, ${(0.62 * Math.pow(u, 0.7) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    42,
  );

  // 主体鎏金圣刃
  ctx.save();
  ctx.shadowColor = 'rgba(255, 214, 72, 0.9)';
  ctx.shadowBlur = 9;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.88,
    a0 + 0.1,
    a1,
    size * 0.11,
    (u) => `rgba(255, 216, 78, ${(0.92 * Math.pow(u, 0.65) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    48,
  );
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.945,
    a0 + 0.28,
    a1 + 0.02,
    size * 0.03,
    (u) => `rgba(255, 253, 232, ${(0.98 * Math.pow(u, 0.55) * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    undefined,
    42,
  );
  ctx.restore();

  // 刀脊 3 枚精致菱形圣光星点
  for (const [u, sr] of [
    [0.45, 7],
    [0.72, 10],
    [0.88, 6],
  ]) {
    const th = a0 + (a1 - a0) * u;
    const sx = cx + Math.cos(th) * R * 0.91;
    const sy = cy + Math.sin(th) * R * 0.91;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(th);
    ctx.fillStyle = 'rgba(255, 253, 226, 0.96)';
    ctx.beginPath();
    ctx.moveTo(0, -sr);
    ctx.lineTo(sr * 0.24, -sr * 0.24);
    ctx.lineTo(sr * 1.1, 0);
    ctx.lineTo(sr * 0.24, sr * 0.24);
    ctx.lineTo(0, sr);
    ctx.lineTo(-sr * 0.24, sr * 0.24);
    ctx.lineTo(-sr * 1.1, 0);
    ctx.lineTo(-sr * 0.24, -sr * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** 8. 虫鞭 S 形波浪抽打（从中心向右延伸到 R，前端音爆尖闪，绝不超界） */
export function drawSlashWhip(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxReach = size * 0.455;
  const segs = 40;
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const x = cx + maxReach * u;
    const y = cy + Math.sin(u * Math.PI * 2.35) * (1 - u * 0.82) * size * 0.088;
    pts.push([x, y]);
  }

  // 柔和动态残影
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < segs; i++) {
    const u = i / segs;
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    ctx.strokeStyle = `rgba(180, 92, 24, ${(0.34 * Math.sin(u * Math.PI)).toFixed(3)})`;
    ctx.lineWidth = (1 - u * 0.65) * 14;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 4);
    ctx.lineTo(x1, y1 + 4);
    ctx.stroke();
  }
  // 深皮革描边 + 琥珀高光主鞭身（根粗梢细）
  for (let i = 0; i < segs; i++) {
    const u = i / segs;
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const w = Math.max(1.6, (1 - u * 0.72) * 8.5);
    ctx.strokeStyle = 'rgba(28, 14, 6, 0.85)';
    ctx.lineWidth = w + 3.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    const g = ctx.createLinearGradient(x0, y0 - w, x0, y0 + w);
    g.addColorStop(0, '#fff2b8');
    g.addColorStop(0.5, '#f29c38');
    g.addColorStop(1, '#8a4412');
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  // 鞭梢音爆小涟漪与尖闪（中心在 maxReach - 10，最大半径 10，绝不超 maxReach）
  const [tx, ty] = pts[pts.length - 1];
  const gTip = ctx.createRadialGradient(tx - 2, ty, 1, tx - 2, ty, 11);
  gTip.addColorStop(0, 'rgba(255,255,230,1)');
  gTip.addColorStop(0.45, 'rgba(255,212,96,0.75)');
  gTip.addColorStop(1, 'rgba(255,160,40,0)');
  ctx.fillStyle = gTip;
  ctx.beginPath();
  ctx.arc(tx - 2, ty, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 9. 重锤砸地裂纹（纯地面物理开裂：凹陷土坑阴影 + 主裂纹与分叉细裂 + 自然泥土倒角，无发光环） */
export function drawBashSlam(ctx: Ctx, size = TEX_SIZE, lipColor = 'rgba(148, 126, 98, 0.42)'): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.465;
  const rng = makeRng(5120);

  // 1) 柔和的地面砸坑暗影（纯阴影层次，不带亮环）
  const pit = ctx.createRadialGradient(cx, cy, R * 0.06, cx, cy, R * 0.72);
  pit.addColorStop(0, 'rgba(14, 10, 7, 0.68)');
  pit.addColorStop(0.45, 'rgba(24, 18, 12, 0.38)');
  pit.addColorStop(1, 'rgba(24, 18, 12, 0)');
  ctx.fillStyle = pit;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
  ctx.fill();

  // 2) 主裂纹 + 二级分叉细裂（模拟真实地面受冲击开裂的碎裂感）
  const fissures = 8;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < fissures; i++) {
    const baseA = (i / fissures) * Math.PI * 2 + (rng() - 0.5) * 0.28;
    const len = R * (0.64 + rng() * 0.3);
    const pts: [number, number][] = [[cx, cy]];
    const segs = 4;
    for (let s = 1; s <= segs; s++) {
      const u = s / segs;
      const a = baseA + (rng() - 0.5) * 0.24;
      pts.push([cx + Math.cos(a) * len * u, cy + Math.sin(a) * len * u]);
    }

    // 自然受光土唇倒角（左上轻微受光边缘，非发光效果）
    ctx.strokeStyle = lipColor;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    pts.forEach(([x, y], idx) => (idx ? ctx.lineTo(x + 1.5, y + 1.5) : ctx.moveTo(x + 1.5, y + 1.5)));
    ctx.stroke();

    // 主裂缝深黑沟槽（中心宽、末端收尖）
    for (let s = 0; s < pts.length - 1; s++) {
      const w = (1 - s / pts.length) * 5.2 + 1.1;
      ctx.strokeStyle = 'rgba(12, 8, 5, 0.94)';
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[s][0], pts[s][1]);
      ctx.lineTo(pts[s + 1][0], pts[s + 1][1]);
      ctx.stroke();
    }

    // 中段分叉出的细小支裂纹
    const branchIdx = 1 + Math.floor(rng() * 2);
    const [bx, by] = pts[branchIdx];
    const side = rng() < 0.5 ? 1 : -1;
    const ba = baseA + side * (0.45 + rng() * 0.35);
    const bLen = R * (0.18 + rng() * 0.16);
    let ex = bx + Math.cos(ba) * bLen;
    let ey = by + Math.sin(ba) * bLen;
    const d = Math.hypot(ex - cx, ey - cy);
    if (d > R * 0.95) {
      ex = cx + ((ex - cx) / d) * R * 0.95;
      ey = cy + ((ey - cy) / d) * R * 0.95;
    }
    const mx = (bx + ex) * 0.5 + (rng() - 0.5) * 6;
    const my = (by + ey) * 0.5 + (rng() - 0.5) * 6;
    ctx.strokeStyle = lipColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(bx + 1, by + 1);
    ctx.lineTo(mx + 1, my + 1);
    ctx.lineTo(ex + 1, ey + 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(12, 8, 5, 0.86)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(mx, my);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // 中心砸击碎坑核心
  ctx.fillStyle = 'rgba(10, 7, 5, 0.85)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.13, R * 0.1, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 10. 滚石 / 碎岩砖砸击（纯地裂 + 立体多面体碎岩块，无发光环） */
export function drawBashRock(ctx: Ctx, size = TEX_SIZE): void {
  drawBashSlam(ctx, size, 'rgba(168, 138, 102, 0.48)');
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.45;
  const rng = makeRng(6144);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const dist = R * (0.42 + rng() * 0.34);
    const rx = cx + Math.cos(a) * dist;
    const ry = cy + Math.sin(a) * dist;
    const sz = 6.5 + rng() * 5.5;
    const rot = rng() * Math.PI * 2;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(rot);
    // 接触投影
    ctx.fillStyle = 'rgba(14, 9, 6, 0.45)';
    ctx.beginPath();
    ctx.ellipse(2, 4, sz * 0.95, sz * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 岩块多边形主体（明暗渐变）
    const rockGrad = ctx.createLinearGradient(-sz, -sz, sz, sz);
    rockGrad.addColorStop(0, '#e8be8a');
    rockGrad.addColorStop(0.5, '#a86e3e');
    rockGrad.addColorStop(1, '#523016');
    ctx.fillStyle = rockGrad;
    ctx.strokeStyle = '#1b0f08';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.8, -sz * 0.3);
    ctx.lineTo(-sz * 0.1, -sz * 0.85);
    ctx.lineTo(sz * 0.85, -sz * 0.25);
    ctx.lineTo(sz * 0.55, sz * 0.72);
    ctx.lineTo(-sz * 0.65, sz * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 顶部受光棱面
    ctx.fillStyle = 'rgba(255, 232, 194, 0.42)';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.6, -sz * 0.22);
    ctx.lineTo(-sz * 0.1, -sz * 0.72);
    ctx.lineTo(sz * 0.55, -sz * 0.2);
    ctx.lineTo(0, sz * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** 11. 甲壳盾棱面能量推墙（半透明晶体蓝六边形蜂巢护盾弧 + 镜面高光棱脊） */
export function drawBashShield(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.465;
  const a0 = -0.88;
  const a1 = 0.88;
  const thick = size * 0.145;
  const segs = 5;

  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const th = a0 + ((a1 - a0) * i) / segs;
    outer.push([cx + Math.cos(th) * R, cy + Math.sin(th) * R]);
    inner.push([cx + Math.cos(th) * (R - thick), cy + Math.sin(th) * (R - thick)]);
  }
  const poly = [...outer, ...inner.slice().reverse()];

  ctx.save();
  // 构建护盾剪裁路径
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();

  // 晶蓝径向渐变盾体
  const grad = ctx.createRadialGradient(cx, cy, R - thick, cx, cy, R);
  grad.addColorStop(0, 'rgba(32, 130, 225, 0.08)');
  grad.addColorStop(0.55, 'rgba(66, 192, 255, 0.52)');
  grad.addColorStop(0.88, 'rgba(162, 238, 255, 0.84)');
  grad.addColorStop(1, 'rgba(235, 252, 255, 0.96)');
  ctx.fillStyle = grad;
  ctx.fill();

  // 内部蜂巢晶格纹理
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(200, 245, 255, 0.35)';
  ctx.lineWidth = 1.4;
  const step = 14;
  for (let y = cy - R; y <= cy + R; y += step * 0.86) {
    for (let x = cx; x <= cx + R; x += step) {
      const ox = Math.round(y / step) % 2 ? step * 0.5 : 0;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ha = (k / 6) * Math.PI * 2;
        const hx = x + ox + Math.cos(ha) * 6.5;
        const hy = y + Math.sin(ha) * 6.5;
        k ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  // 棱面切分线
  ctx.strokeStyle = 'rgba(220, 250, 255, 0.55)';
  ctx.lineWidth = 1.6;
  for (let i = 1; i < segs; i++) {
    ctx.beginPath();
    ctx.moveTo(inner[i][0], inner[i][1]);
    ctx.lineTo(outer[i][0], outer[i][1]);
    ctx.stroke();
  }
  ctx.restore();

  // 外棱硬朗高光描边
  ctx.strokeStyle = 'rgba(14, 34, 58, 0.82)';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();

  ctx.shadowColor = 'rgba(110, 230, 255, 0.95)';
  ctx.shadowBlur = 9;
  ctx.strokeStyle = '#e6fbff';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.restore();
}

/** 12. 等离子锤电裂（焦黑地裂 + 缝隙内跃动的电流细弧，去掉整片光圈） */
export function drawBashPlasma(ctx: Ctx, size = TEX_SIZE): void {
  drawBashSlam(ctx, size, 'rgba(92, 168, 204, 0.42)');
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46;
  const rng = makeRng(5120);

  // 仅在裂缝内部贴着缝隙窜出电弧，不画多余外圈光环
  for (let i = 0; i < 8; i++) {
    const baseA = (i / 8) * Math.PI * 2 + (rng() - 0.5) * 0.28;
    const len = R * (0.64 + rng() * 0.3);
    const pts: [number, number][] = [[cx, cy]];
    for (let s = 1; s <= 4; s++) {
      const u = s / 4;
      const a = baseA + (rng() - 0.5) * 0.24;
      pts.push([cx + Math.cos(a) * len * u, cy + Math.sin(a) * len * u]);
    }
    // 消耗与 drawBashSlam 相同的分支随机数，保持坐标完全对齐
    rng();
    rng();
    rng();
    rng();
    rng();
    rng();
    drawLightningArc(ctx, pts, 'rgba(42, 212, 255, 0.85)', '#e8fdff', 1.4);
  }
}

/** 13. 烈焰爆拳地裂（焦黑地裂 + 缝底暗红余烬细线，无多余光圈） */
export function drawBashExplosive(ctx: Ctx, size = TEX_SIZE): void {
  drawBashSlam(ctx, size, 'rgba(186, 102, 58, 0.46)');
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46;
  const rng = makeRng(5120);

  // 裂缝沟底透出的炽热熔岩缝，克制不糊
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 8; i++) {
    const baseA = (i / 8) * Math.PI * 2 + (rng() - 0.5) * 0.28;
    const len = R * (0.64 + rng() * 0.3);
    const pts: [number, number][] = [[cx, cy]];
    for (let s = 1; s <= 4; s++) {
      const u = s / 4;
      const a = baseA + (rng() - 0.5) * 0.24;
      pts.push([cx + Math.cos(a) * len * u, cy + Math.sin(a) * len * u]);
    }
    rng();
    rng();
    rng();
    rng();
    rng();
    rng();
    ctx.strokeStyle = 'rgba(255, 118, 28, 0.85)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    pts.forEach(([x, y], idx) => (idx ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 224, 128, 0.9)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.restore();
}

/** 14. 爆炸阶段一：灼白热核闪球 + 放射爆裂芒（严格 <= R） */
export function drawExplosionCore(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.465;

  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.32, 'rgba(255, 246, 186, 0.95)');
  g.addColorStop(0.62, 'rgba(255, 152, 42, 0.62)');
  g.addColorStop(0.88, 'rgba(255, 86, 20, 0.16)');
  g.addColorStop(1, 'rgba(255, 60, 12, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // 锐利冲击放射锋刺（严格收在 R*0.92 内）
  ctx.save();
  ctx.fillStyle = 'rgba(255, 254, 232, 0.92)';
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? R * (i % 4 === 0 ? 0.88 : 0.66) : R * 0.22;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 15. 爆炸阶段二：体积感翻涌火球（立体受光火云 + 暗红背影 + 灼白内缝，彻底告别 6 个单色圆！） */
export function drawExplosionFire(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.465;
  const rng = makeRng(8192);

  // 底层深棕烟火轮廓与热浪外晕
  const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  halo.addColorStop(0, 'rgba(255, 128, 28, 0.72)');
  halo.addColorStop(0.68, 'rgba(186, 48, 14, 0.42)');
  halo.addColorStop(0.92, 'rgba(64, 24, 16, 0.18)');
  halo.addColorStop(1, 'rgba(40, 16, 12, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // 多层交错体积云团：由外向内逐层提亮，每朵云团自身带立体径向光照梯度
  const lobes: { x: number; y: number; r: number; heat: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const dist = R * (0.34 + rng() * 0.24);
    const lr = R * (0.22 + rng() * 0.14);
    const maxD = Math.max(0, R * 0.94 - lr);
    const d = Math.min(dist, maxD);
    lobes.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: lr, heat: 0.25 + rng() * 0.4 });
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const d = R * (0.14 + rng() * 0.16);
    lobes.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: R * (0.24 + rng() * 0.1), heat: 0.7 + rng() * 0.25 });
  }
  lobes.push({ x: cx, y: cy, r: R * 0.34, heat: 1 });

  // 按热度从低到高叠画，自然形成外暗焦烟、中橙红火卷、内灼白高温核的 3D 体积层次
  lobes.sort((a, b) => a.heat - b.heat);
  for (const lb of lobes) {
    // 光源偏中心，让每个火球云团的向心面灼亮、离心面呈焦暗红
    const toCenterX = (cx - lb.x) * 0.25;
    const toCenterY = (cy - lb.y) * 0.25;
    const g = ctx.createRadialGradient(
      lb.x + toCenterX,
      lb.y + toCenterY,
      lb.r * 0.08,
      lb.x,
      lb.y,
      lb.r,
    );
    if (lb.heat > 0.85) {
      g.addColorStop(0, 'rgba(255, 255, 232, 0.98)');
      g.addColorStop(0.45, 'rgba(255, 224, 98, 0.94)');
      g.addColorStop(0.82, 'rgba(255, 118, 24, 0.72)');
      g.addColorStop(1, 'rgba(210, 48, 12, 0)');
    } else if (lb.heat > 0.5) {
      g.addColorStop(0, 'rgba(255, 228, 108, 0.92)');
      g.addColorStop(0.5, 'rgba(255, 116, 26, 0.88)');
      g.addColorStop(0.85, 'rgba(168, 36, 14, 0.65)');
      g.addColorStop(1, 'rgba(72, 22, 16, 0)');
    } else {
      g.addColorStop(0, 'rgba(240, 108, 28, 0.84)');
      g.addColorStop(0.52, 'rgba(136, 40, 22, 0.78)');
      g.addColorStop(0.84, 'rgba(54, 34, 30, 0.68)');
      g.addColorStop(1, 'rgba(32, 24, 24, 0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lb.x, lb.y, lb.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 爆炸外缘锐利热压冲击圈（精准标示真实伤害边界）
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 200, 96, 0.78)';
  ctx.lineWidth = 2.8;
  ctx.shadowColor = 'rgba(255, 112, 24, 0.85)';
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 16. 爆炸阶段三：柔边翻滚黑灰烟云 + 余烬暗红微光（严格 <= R） */
export function drawExplosionSmoke(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46;
  const rng = makeRng(9216);

  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const lr = R * (0.24 + rng() * 0.14);
    const d = Math.min(R * (0.28 + rng() * 0.26), R * 0.94 - lr);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const g = ctx.createRadialGradient(x - lr * 0.2, y - lr * 0.2, lr * 0.1, x, y, lr);
    g.addColorStop(0, 'rgba(92, 82, 78, 0.72)');
    g.addColorStop(0.58, 'rgba(46, 40, 40, 0.62)');
    g.addColorStop(1, 'rgba(24, 20, 22, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  // 中心余烬暗红微光
  const ember = ctx.createRadialGradient(cx, cy, 2, cx, cy, R * 0.45);
  ember.addColorStop(0, 'rgba(255, 130, 42, 0.52)');
  ember.addColorStop(1, 'rgba(180, 42, 12, 0)');
  ctx.fillStyle = ember;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** 17. 能量冲击波环（中性发光羽化环，支持 setTint 着色，替代干瘪 2px 单环） */
export function drawNovaRing(ctx: Ctx, size = TEX_SIZE): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.465;

  const g = ctx.createRadialGradient(cx, cy, R * 0.52, cx, cy, R);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.84, 'rgba(255,255,255,0.68)');
  g.addColorStop(0.93, 'rgba(255,255,255,0.96)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // 内侧第二道细涟漪
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
  ctx.stroke();
}

/** 18. 刀刃 6 件套新月剑气波（高光梯度弧刃 + 空气拖尾，支持 setTint） */
export function drawBladeWaveTex(ctx: Ctx, size = 128): void {
  const cx = size * 0.36;
  const cy = size * 0.5;
  const R = size * 0.48;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.88,
    -1.08,
    1.08,
    size * 0.26,
    (u) => `rgba(12, 22, 16, ${(0.5 * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    (u) => Math.sin(u * Math.PI),
    36,
  );
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 7;
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.9,
    -1.04,
    1.04,
    size * 0.19,
    (u) => `rgba(230, 255, 230, ${(0.92 * Math.pow(Math.sin(u * Math.PI), 0.7)).toFixed(3)})`,
    undefined,
    (u) => Math.sin(u * Math.PI),
    40,
  );
  drawTaperedArcRibbon(
    ctx,
    cx,
    cy,
    R * 0.97,
    -0.92,
    0.92,
    size * 0.065,
    (u) => `rgba(255, 255, 255, ${(0.98 * Math.sin(u * Math.PI)).toFixed(3)})`,
    undefined,
    (u) => Math.sin(u * Math.PI),
    36,
  );
  ctx.restore();
}

export function generateVfxTextures(scene: Phaser.Scene): void {
  bake2D(scene, 'fx-slash-blade', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashBlade(ctx, TEX_SIZE));
  bake2D(scene, 'fx-slash-fire', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashFire(ctx, TEX_SIZE));
  bake2D(scene, 'fx-slash-electric', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashElectric(ctx, TEX_SIZE));
  bake2D(scene, 'fx-slash-ethereal', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashEthereal(ctx, TEX_SIZE));
  bake2D(scene, 'fx-slash-saw', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashSaw(ctx, TEX_SIZE));
  bake2D(scene, 'fx-slash-heavy', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashHeavy(ctx, TEX_SIZE));
  bake2D(scene, 'fx-slash-holy', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashHoly(ctx, TEX_SIZE));
  bake2D(scene, 'fx-slash-whip', TEX_SIZE, TEX_SIZE, (ctx) => drawSlashWhip(ctx, TEX_SIZE));

  bake2D(scene, 'fx-bash-slam', TEX_SIZE, TEX_SIZE, (ctx) => drawBashSlam(ctx, TEX_SIZE));
  bake2D(scene, 'fx-bash-rock', TEX_SIZE, TEX_SIZE, (ctx) => drawBashRock(ctx, TEX_SIZE));
  bake2D(scene, 'fx-bash-shield', TEX_SIZE, TEX_SIZE, (ctx) => drawBashShield(ctx, TEX_SIZE));
  bake2D(scene, 'fx-bash-plasma', TEX_SIZE, TEX_SIZE, (ctx) => drawBashPlasma(ctx, TEX_SIZE));
  bake2D(scene, 'fx-bash-explosive', TEX_SIZE, TEX_SIZE, (ctx) => drawBashExplosive(ctx, TEX_SIZE));

  bake2D(scene, 'fx-exp-core', TEX_SIZE, TEX_SIZE, (ctx) => drawExplosionCore(ctx, TEX_SIZE));
  bake2D(scene, 'fx-exp-fire', TEX_SIZE, TEX_SIZE, (ctx) => drawExplosionFire(ctx, TEX_SIZE));
  bake2D(scene, 'fx-exp-smoke', TEX_SIZE, TEX_SIZE, (ctx) => drawExplosionSmoke(ctx, TEX_SIZE));
  bake2D(scene, 'fx-nova-ring', TEX_SIZE, TEX_SIZE, (ctx) => drawNovaRing(ctx, TEX_SIZE));
  bake2D(scene, 'fx-blade-wave', 128, 128, (ctx) => drawBladeWaveTex(ctx, 128));
}
