import Phaser from 'phaser';
import { bake2D, cCircle, cEllipse, cSoftEllipse, type Ctx } from './draw';

/**
 * 顶级独立肉鸽美术纹理库：
 * 暗调炭黑噪点与版画排线肌理 + 斜向网点条纹 + 微距前景草叶剪影 + 战斗虫液地面痕迹。
 */
export function generateUIArt(scene: Phaser.Scene): void {
  grungeTile(scene);
  hatchBar(scene);
  macroGrass(scene);
  splatDecal(scene);
  sunRays(scene);
}

/** 1. 哑光炭黑噪点 + 极轻版画斜排线平铺纹理（128×128） */
function grungeTile(scene: Phaser.Scene): void {
  bake2D(scene, 'ui-grunge-tile', 128, 128, (ctx) => {
    const rnd = new Phaser.Math.RandomDataGenerator(['brotato-grunge-v2']);
    for (let i = 0; i < 480; i++) {
      const x = rnd.between(0, 127);
      const y = rnd.between(0, 127);
      const r = rnd.realInRange(0.5, 1.7);
      const light = rnd.frac() < 0.36;
      ctx.fillStyle = light ? 'rgba(255, 255, 246, 0.036)' : 'rgba(0, 0, 0, 0.11)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 45° 版画微细排线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1;
    for (let d = -128; d < 256; d += 8) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d - 128, 128);
      ctx.stroke();
    }
  });
}

/** 2. 45° 漫画斜纹底纹条（32×32），用于血条凹槽、卡片品质头带 */
function hatchBar(scene: Phaser.Scene): void {
  bake2D(scene, 'ui-hatch-bar', 32, 32, (ctx) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 3;
    for (let d = -32; d < 64; d += 8) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d - 32, 32);
      ctx.stroke();
    }
  });
}

/** 3. 微距前景巨型草叶/蒲公英剪影（营造 1cm 高度昆虫视角的纵深景深感） */
function drawMacroCorner(ctx: Ctx, flipX: boolean, flipY: boolean): void {
  ctx.save();
  if (flipX) {
    ctx.translate(220, 0);
    ctx.scale(-1, 1);
  }
  if (flipY) {
    ctx.translate(0, 170);
    ctx.scale(1, -1);
  }

  const blade = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w0: number, w1: number, col: string) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.quadraticCurveTo(cx + w1, cy + w0, x0 + w0, y0 + w0 * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // 后层半透微距巨草剪影
  blade(-14, -10, 88, 34, 198, 12, 26, 12, 'rgba(8, 10, 8, 0.68)');
  blade(-10, 16, 46, 86, 134, 146, 22, 10, 'rgba(8, 10, 8, 0.62)');
  blade(-6, -4, 72, 62, 162, 74, 24, 10, 'rgba(12, 14, 10, 0.78)');
  // 前层锐利黑墨草叶与细微边缘反光
  blade(-12, 6, 42, 48, 106, 98, 16, 6, '#070807');
  ctx.strokeStyle = 'rgba(130, 150, 96, 0.22)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.quadraticCurveTo(42, 48, 106, 98);
  ctx.stroke();

  ctx.restore();
}

function macroGrass(scene: Phaser.Scene): void {
  bake2D(scene, 'ui-macro-grass-tl', 220, 170, (ctx) => drawMacroCorner(ctx, false, false), 2);
  bake2D(scene, 'ui-macro-grass-br', 220, 170, (ctx) => drawMacroCorner(ctx, true, true), 2);
}

/** 4. 战斗虫液地面泼溅痕（48×48，白色绘制以便按怪物色系 tint） */
function splatDecal(scene: Phaser.Scene): void {
  bake2D(scene, 'ui-splat', 48, 48, (ctx) => {
    const rnd = new Phaser.Math.RandomDataGenerator(['splat-v1']);
    cEllipse(ctx, 24, 24, 12, 9, 'rgba(255, 255, 255, 0.85)', undefined, 0, 0.3);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rnd.realInRange(-0.2, 0.2);
      const d = rnd.realInRange(7, 17);
      const r = rnd.realInRange(2.2, 6.2);
      cCircle(ctx, 24 + Math.cos(a) * d, 24 + Math.sin(a) * d, r, 'rgba(255, 255, 255, 0.8)');
    }
  });
}

/** 5. 柔和放射光芒 */
function sunRays(scene: Phaser.Scene): void {
  bake2D(scene, 'ui-sunrays', 520, 520, (ctx) => {
    const cx = 260;
    const cy = 260;
    const rays = 12;
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2;
      const a1 = a0 + (Math.PI / rays) * 0.72;
      const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 250);
      g.addColorStop(0, 'rgba(255, 238, 175, 0.28)');
      g.addColorStop(0.55, 'rgba(255, 210, 90, 0.09)');
      g.addColorStop(1, 'rgba(255, 200, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 255, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    cSoftEllipse(ctx, cx, cy, 110, 110, 'rgba(255, 232, 150, 0.16)', 'rgba(255, 232, 150, 0)');
  });
}
