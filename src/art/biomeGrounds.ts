import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { BIOMES, type BiomeId } from '../data/biomes';
import { bake2D, cEllipse, cLine, cShellGrad, cSoftEllipse, type Ctx } from './draw';

/** 按需烘焙对应生态场地的 2000×1400 地面贴图（草坪复用启动已生成的 ground） */
export function ensureBiomeGround(scene: Phaser.Scene, biome: BiomeId): string {
  const key = BIOMES[biome].groundKey;
  if (scene.textures.exists(key)) return key;
  if (biome === 'pond') bakePondGround(scene, key);
  else if (biome === 'hollow') bakeHollowGround(scene, key);
  return key;
}

/** 青苔池塘：冷调湿润板岩 + 苍苔斑块 + 睡莲岸石（压低饱和度确保怪物与弹幕高对比） */
function bakePondGround(scene: Phaser.Scene, key: string): void {
  const W = WORLD_WIDTH;
  const H = WORLD_HEIGHT;
  bake2D(scene, key, W, H, (ctx) => {
    const rnd = new Phaser.Math.RandomDataGenerator(['hexapod-ground-pond-v1']);

    const baseGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 90, W * 0.5, H * 0.5, W * 0.66);
    baseGrad.addColorStop(0, '#27383a');
    baseGrad.addColorStop(0.55, '#1e2c30');
    baseGrad.addColorStop(1, '#141e22');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // 湿润青苔与浅水渍色块
    for (let i = 0; i < 82; i++) {
      const x = rnd.between(0, W);
      const y = rnd.between(0, H);
      const rx = rnd.between(100, 260);
      const ry = rnd.between(80, 195);
      const rot = rnd.rotation();
      const tone = rnd.pick([
        ['rgba(44, 82, 76, 0.25)', 'rgba(44, 82, 76, 0)'],
        ['rgba(26, 62, 82, 0.28)', 'rgba(26, 62, 82, 0)'],
        ['rgba(16, 26, 28, 0.36)', 'rgba(16, 26, 28, 0)'],
      ]);
      cSoftEllipse(ctx, x, y, rx, ry, tone[0], tone[1], rot);
    }

    // 湿滑青石板纹理与微粒
    for (let i = 0; i < 2200; i++) {
      const x = rnd.between(36, W - 36);
      const y = rnd.between(36, H - 36);
      const r = rnd.realInRange(0.7, 2.0);
      ctx.fillStyle = rnd.frac() < 0.42 ? 'rgba(165, 224, 232, 0.06)' : 'rgba(8, 12, 14, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 扁平溪石铺面轮廓
    for (let i = 0; i < 46; i++) {
      const x = rnd.between(90, W - 90);
      const y = rnd.between(90, H - 90);
      if (Math.hypot(x - W / 2, y - H / 2) < 140) continue;
      const rx = rnd.between(18, 38);
      const ry = rnd.between(12, 26);
      const rot = rnd.rotation();
      cEllipse(ctx, x + 2, y + 3, rx, ry, 'rgba(6, 10, 12, 0.32)', undefined, 0, rot);
      cEllipse(ctx, x, y, rx, ry, 'rgba(46, 64, 68, 0.34)', 'rgba(12, 18, 20, 0.55)', 1.6, rot);
      if (rnd.frac() < 0.45) {
        cEllipse(ctx, x - rx * 0.2, y - ry * 0.2, rx * 0.45, ry * 0.35, 'rgba(72, 118, 86, 0.28)', undefined, 0, rot);
      }
    }

    // 中心潮湿苔木桩
    drawBiomeStump(ctx, W / 2, H / 2, {
      bark: '#2c3430',
      woodHi: '#5a6a5e',
      woodMid: '#415048',
      woodDark: '#28332e',
      moss: 'rgba(64, 134, 96, 0.78)',
    });

    // 池边青苔与小水草
    for (let i = 0; i < 420; i++) {
      const x = rnd.between(54, W - 54);
      const y = rnd.between(54, H - 54);
      if (Math.hypot(x - W / 2, y - H / 2) < 104) continue;
      const h = rnd.between(6, 12);
      const lean = rnd.realInRange(-3, 3);
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = rnd.pick(['rgba(52, 98, 78, 0.72)', 'rgba(42, 82, 76, 0.74)', 'rgba(64, 112, 84, 0.65)']);
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.quadraticCurveTo(x - 5, y - h * 0.55, x - 4 + lean * 0.4, y - h * 0.85);
      ctx.moveTo(x + 1, y);
      ctx.quadraticCurveTo(x + 4, y - h * 0.5, x + 4 + lean, y - h);
      ctx.stroke();
    }

    // 贴地小睡莲叶装饰
    for (let i = 0; i < 24; i++) {
      const x = rnd.between(88, W - 88);
      const y = rnd.between(88, H - 88);
      if (Math.hypot(x - W / 2, y - H / 2) < 130) continue;
      const r = rnd.between(11, 18);
      const notch = rnd.rotation();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(notch);
      ctx.fillStyle = 'rgba(8, 14, 14, 0.4)';
      ctx.beginPath();
      ctx.arc(2, 3, r, 0.25, Math.PI * 2 - 0.25);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#335d48';
      ctx.strokeStyle = '#101c18';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0.25, Math.PI * 2 - 0.25);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawBiomePerimeter(ctx, W, H, rnd, ['#5c767c', '#3c5258', '#223034'], 'rgba(64, 128, 92, 0.72)');
  });
}

/** 枯叶树洞：深暖琥珀林地土 + 锈红秋叶 + 粗根树皮边墙 */
function bakeHollowGround(scene: Phaser.Scene, key: string): void {
  const W = WORLD_WIDTH;
  const H = WORLD_HEIGHT;
  bake2D(scene, key, W, H, (ctx) => {
    const rnd = new Phaser.Math.RandomDataGenerator(['hexapod-ground-hollow-v1']);

    const baseGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 90, W * 0.5, H * 0.5, W * 0.66);
    baseGrad.addColorStop(0, '#3b2e22');
    baseGrad.addColorStop(0.55, '#2d2219');
    baseGrad.addColorStop(1, '#1d1510');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // 暖褐腐殖土与落叶阴影斑块
    for (let i = 0; i < 80; i++) {
      const x = rnd.between(0, W);
      const y = rnd.between(0, H);
      const rx = rnd.between(105, 250);
      const ry = rnd.between(75, 185);
      const rot = rnd.rotation();
      const tone = rnd.pick([
        ['rgba(96, 62, 34, 0.22)', 'rgba(96, 62, 34, 0)'],
        ['rgba(110, 58, 28, 0.16)', 'rgba(110, 58, 28, 0)'],
        ['rgba(22, 14, 10, 0.36)', 'rgba(22, 14, 10, 0)'],
      ]);
      cSoftEllipse(ctx, x, y, rx, ry, tone[0], tone[1], rot);
    }

    // 粗木屑与林土颗粒
    for (let i = 0; i < 2300; i++) {
      const x = rnd.between(36, W - 36);
      const y = rnd.between(36, H - 36);
      const r = rnd.realInRange(0.7, 2.0);
      ctx.fillStyle = rnd.frac() < 0.42 ? 'rgba(232, 184, 128, 0.055)' : 'rgba(12, 8, 6, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 树洞地面干裂木纹与盘根
    for (let i = 0; i < 48; i++) {
      let cx = rnd.between(90, W - 90);
      let cy = rnd.between(90, H - 90);
      if (Math.hypot(cx - W / 2, cy - H / 2) < 140) continue;
      ctx.strokeStyle = 'rgba(18, 10, 6, 0.46)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let ang = rnd.rotation();
      const segs = rnd.between(3, 6);
      for (let s = 0; s < segs; s++) {
        ang += rnd.realInRange(-0.75, 0.75);
        cx += Math.cos(ang) * rnd.between(12, 26);
        cy += Math.sin(ang) * rnd.between(12, 26);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    drawBiomeStump(ctx, W / 2, H / 2, {
      bark: '#422614',
      woodHi: '#825b36',
      woodMid: '#634326',
      woodDark: '#422a16',
      moss: 'rgba(148, 86, 36, 0.72)',
    });

    // 散落暗秋枯叶（赭石/锈红/焦糖，低饱和不抢前景）
    for (let i = 0; i < 120; i++) {
      const x = rnd.between(70, W - 70);
      const y = rnd.between(70, H - 70);
      if (Math.hypot(x - W / 2, y - H / 2) < 112) continue;
      const rot = rnd.rotation();
      const len = rnd.between(9, 17);
      const col = rnd.pick(['#6b4222', '#7a3c20', '#5e4a24', '#724c28']);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(10, 6, 4, 0.36)';
      ctx.beginPath();
      ctx.moveTo(-len + 2, 3);
      ctx.quadraticCurveTo(2, -len * 0.5 + 3, len + 2, 3);
      ctx.quadraticCurveTo(2, len * 0.5 + 3, -len + 2, 3);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.strokeStyle = '#180e08';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(0, -len * 0.5, len, 0);
      ctx.quadraticCurveTo(0, len * 0.5, -len, 0);
      ctx.fill();
      ctx.stroke();
      cLine(ctx, [-len * 0.75, 0, len * 0.75, 0], '#2c180c', 1);
      ctx.restore();
    }

    drawBiomePerimeter(ctx, W, H, rnd, ['#6e4d32', '#4a3220', '#2b1c12'], 'rgba(142, 82, 34, 0.62)');
  });
}

function drawBiomeStump(
  ctx: Ctx,
  cx: number,
  cy: number,
  pal: { bark: string; woodHi: string; woodMid: string; woodDark: string; moss: string },
): void {
  cSoftEllipse(ctx, cx, cy, 132, 114, 'rgba(12, 12, 12, 0.52)', 'rgba(12, 12, 12, 0)');
  cEllipse(ctx, cx + 4, cy + 6, 80, 72, 'rgba(6, 6, 5, 0.52)');
  ctx.beginPath();
  const segs = 36;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const wobble = 1 + Math.sin(a * 5) * 0.035 + Math.cos(a * 7 + 1) * 0.02;
    const px = cx + Math.cos(a) * 76 * wobble;
    const py = cy + Math.sin(a) * 68 * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = pal.bark;
  ctx.fill();
  ctx.strokeStyle = '#0d0b08';
  ctx.lineWidth = 3.2;
  ctx.stroke();

  const woodGrad = cShellGrad(ctx, cx - 10, cy - 10, 74, pal.woodHi, pal.woodMid, pal.woodDark);
  cEllipse(ctx, cx, cy, 67, 60, woodGrad, '#17110a', 2.2);

  ctx.strokeStyle = 'rgba(20, 16, 12, 0.45)';
  for (const [rx, ry, lw] of [
    [55, 49, 1.5],
    [42, 37, 1.3],
    [29, 26, 1.2],
    [16, 14, 1.1],
  ]) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 1, rx, ry, 0.08, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const [ox, oy, rx, ry, rot] of [
    [-56, -34, 14, 7, -0.6],
    [54, 32, 15, 7, -0.5],
    [-22, 58, 13, 6, 0.2],
  ]) {
    cEllipse(ctx, cx + ox, cy + oy, rx, ry, pal.moss, '#141812', 1.2, rot);
  }
}

function drawBiomePerimeter(
  ctx: Ctx,
  W: number,
  H: number,
  rnd: Phaser.Math.RandomDataGenerator,
  stonePal: [string, string, string],
  mossCol: string,
): void {
  const edgeW = 88;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [0, 0, 0, edgeW, 0, 0, W, edgeW],
    [0, H, 0, H - edgeW, 0, H - edgeW, W, edgeW],
    [0, 0, edgeW, 0, 0, 0, edgeW, H],
    [W, 0, W - edgeW, 0, W - edgeW, 0, edgeW, H],
  ]) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(6, 7, 8, 0.86)');
    g.addColorStop(1, 'rgba(6, 7, 8, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }

  ctx.strokeStyle = 'rgba(12, 12, 12, 0.88)';
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = 'rgba(84, 78, 72, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(23, 23, W - 46, H - 46);

  const stone = (x: number, y: number, r: number) => {
    const rot = rnd.rotation();
    cEllipse(ctx, x + 3, y + 4, r * 1.06, r * 0.85, 'rgba(4, 4, 4, 0.58)', undefined, 0, rot);
    const sg = cShellGrad(ctx, x - r * 0.25, y - r * 0.28, r * 1.15, stonePal[0], stonePal[1], stonePal[2]);
    cEllipse(ctx, x, y, r, r * 0.8, sg, '#0b0b09', 2.4, rot);
    if (rnd.frac() < 0.45) {
      cEllipse(ctx, x + r * 0.26, y + r * 0.26, r * 0.42, r * 0.24, mossCol, undefined, 0, rot + 0.4);
    }
  };
  for (let x = -8; x < W + 24; x += rnd.between(30, 44)) {
    stone(x, rnd.between(6, 20), rnd.between(17, 26));
    stone(x, H - rnd.between(6, 20), rnd.between(17, 26));
  }
  for (let y = 20; y < H - 10; y += rnd.between(30, 44)) {
    stone(rnd.between(6, 20), y, rnd.between(17, 26));
    stone(W - rnd.between(6, 20), y, rnd.between(17, 26));
  }
}
