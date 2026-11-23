import Phaser from 'phaser';
import {
  SPRITE_RES,
  bake2D,
  cCelCircle,
  cCelEllipse,
  cCelShape,
  cCircle,
  cComicEye,
  cContactShadow,
  cEllipse,
  cLine,
  cPoly,
  cRoundRect,
  cShellGrad,
  cSoftEllipse,
  type Ctx,
} from './draw';

/**
 * M6 新增的贴图：非甲虫角色的身体、新弹体、机关、飞蛾、工蚁。
 * 角色身体和甲虫外壳同规格：64×52，中心 (32,26)，朝右，腿在 BeetleView 里实时画。
 */
export function generateM6Art(scene: Phaser.Scene): void {
  const bodies: Record<string, (ctx: Ctx) => void> = {
    'bug-spider': spider,
    'bug-mantis': mantis,
    'bug-antqueen': antQueen,
    'bug-cicada': cicada,
    'bug-caterpillar': caterpillar,
    'bug-mosquito': mosquito,
    'bug-termite': termite,
  };
  for (const [key, draw] of Object.entries(bodies)) bake2D(scene, key, 64, 52, draw, SPRITE_RES);
  projectiles(scene);
  devices(scene);
  allies(scene);
}

/** 上下对称的点：s = 1 原样，s = -1 关于 y = cy 镜像 */
function mirror(cy: number, s: number) {
  return (v: number) => cy + (v - cy) * s;
}

// ---------- 角色身体 ----------

/** 蜘蛛：土豆兄弟风重墨粗轮廓 + 纯平赛璐璐 + 大漫画眼 */
function spider(ctx: Ctx): void {
  const out = '#050507';
  cCelEllipse(ctx, 21, 26, 14.5, 12.6, '#623854', '#301628', '#9c668a', out, 3.0);
  cLine(ctx, [12, 26, 30, 26], '#f2dec0', 2.8);
  cLine(ctx, [21, 18, 21, 34], '#f2dec0', 2.8);
  for (const [x, y] of [[14, 20], [28, 20], [14, 32], [28, 32], [10, 26]]) cCircle(ctx, x, y, 1.7, '#f2dec0', out, 0.9);
  cCircle(ctx, 34.5, 26, 2.8, '#361c2c', out, 1.8);
  cCelEllipse(ctx, 42, 26, 9.8, 8.8, '#58304a', '#281020', '#905c7e', out, 2.8);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    cEllipse(ctx, 52, y(23.8), 3.0, 2.2, '#422438', out, 1.8);
    cPoly(ctx, [53.5, y(22.6), 57.8, y(24.4), 53.8, y(25)], '#eee0c8', out, 1.2);
    cLine(ctx, [48, y(20.5), 52, y(17.5), 56.5, y(17.8)], out, 2.6);
  }
  cComicEye(ctx, 49.0, 23.0, 2.7, '#ffffff', '#050507', 0.25, out);
  cComicEye(ctx, 49.0, 29.0, 2.7, '#ffffff', '#050507', -0.25, out);
  cComicEye(ctx, 46.2, 20.0, 1.5, '#ffe8a0', '#050507', 0, out);
  cComicEye(ctx, 46.2, 32.0, 1.5, '#ffe8a0', '#050507', 0, out);
}

/** 螳螂：重墨纯平赛璐璐风 + 巨大怒眼 */
function mantis(ctx: Ctx): void {
  const out = '#050507';
  cCelEllipse(ctx, 18, 26, 15.2, 8.2, '#62a434', '#325c16', '#a8e46e', out, 3.0);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    cEllipse(ctx, 18, y(23.5), 13.5, 3.2, '#96da5a', out, 1.8, -0.05 * s);
  }
  cCelShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(30, 22.2, 19, 7.6, 3.8);
    },
    '#74b840',
    '#3c6e1c',
    '#b8ec7e',
    out,
    2.6,
    { x: 30, y: 22.2, w: 19, h: 7.6 },
  );
  cPoly(ctx, [48.2, 18.8, 58.2, 24.6, 58.2, 27.4, 48.2, 33.2, 46.8, 26], '#7ec648', out, 2.8);
  cComicEye(ctx, 50.2, 20.0, 3.6, '#f8ffc8', '#050507', 0.35, out);
  cComicEye(ctx, 50.2, 32.0, 3.6, '#f8ffc8', '#050507', -0.35, out);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    cLine(ctx, [55, y(24.6), 59, y(19), 63, y(16.5)], out, 1.6);
  }
}

/** 蚁后：重墨纯平赛璐璐风 */
function antQueen(ctx: Ctx): void {
  const out = '#050507';
  cCelEllipse(ctx, 17, 26, 15.8, 12.8, '#a84824', '#581e0a', '#e88a5e', out, 3.0);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(17, 26, 14.8, 11.8, 0, 0, Math.PI * 2);
  ctx.clip();
  for (const x of [7, 13, 19, 25]) cLine(ctx, [x, 12, x + 1.5, 40], '#3a1006', 2.6);
  ctx.restore();
  cEllipse(ctx, 17, 26, 15.8, 12.8, undefined, out, 3.0);
  cCircle(ctx, 33.6, 26, 2.9, '#6a2a12', out, 1.8);
  cCelEllipse(ctx, 41, 26, 7.4, 6.2, '#9c3e1c', '#501808', '#dc7e54', out, 2.6);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    cEllipse(ctx, 39.5, y(21.4), 2.6, 1.2, '#f0dec0', out, 1.0);
  }
  cCelEllipse(ctx, 52, 26, 6.4, 7.2, '#8e3618', '#481406', '#cc6c44', out, 2.8);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    cPoly(ctx, [56.5, y(23), 62.0, y(23.8), 58.2, y(25.6)], '#48180a', out, 1.5);
    cLine(ctx, [55.2, y(21.2), 57.5, y(15.8), 62.5, y(14.5)], out, 1.8);
  }
  cComicEye(ctx, 53.6, 21.4, 2.2, '#ffffff', '#050507', 0.25, out);
  cComicEye(ctx, 53.6, 30.6, 2.2, '#ffffff', '#050507', -0.25, out);
}

/** 蝉：宽脑袋、大红眼、透明翅膀 */
function cicada(ctx: Ctx): void {
  const out = '#050507';
  cCelEllipse(ctx, 26, 26, 17, 9.6, '#504220', '#241c0c', '#88743e', out, 2.8);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    cEllipse(ctx, 22, y(21.5), 19, 5.2, 'rgba(220, 240, 232, 0.72)', out, 1.6, -0.1 * s);
  }
  cCelEllipse(ctx, 45.5, 26, 6.4, 9.8, '#6e8034', '#384416', '#a8bc5c', out, 2.8);
  cCelEllipse(ctx, 53.2, 26, 4.6, 9.4, '#5e702a', '#2c3610', '#96aa4e', out, 2.6);
  cComicEye(ctx, 53.2, 16.8, 3.5, '#ff5030', '#050507', 0, out);
  cComicEye(ctx, 53.2, 35.2, 3.5, '#ff5030', '#050507', 0, out);
}

/** 刺蛾幼虫：鲜绿胖墩墩、两排亮橙毒刺 + 漫画眼 */
function caterpillar(ctx: Ctx): void {
  const out = '#050507';
  cCelShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(5, 15, 50, 22, 11);
    },
    '#7ad028',
    '#3e7810',
    '#c8f868',
    out,
    3.0,
    { x: 5, y: 15, w: 50, h: 22 },
  );
  for (let x = 13; x <= 49; x += 6) cLine(ctx, [x, 17, x, 35], 'rgba(10,20,4,0.45)', 1.4);
  cCelEllipse(ctx, 28, 26, 9.2, 5.4, '#7a3e4e', '#401a24', '#b87688', out, 2.0);
  cEllipse(ctx, 28, 26, 4.6, 2.2, '#e8f0a0', out, 1.0);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    for (let x = 9; x <= 51; x += 7) {
      for (const [dx, dy] of [
        [-2.4, -5.4],
        [0, -6.6],
        [2.4, -5.4],
      ]) {
        cLine(ctx, [x, y(16.8), x + dx, y(16.8 + dy)], out, 2.0);
        cCircle(ctx, x + dx, y(16.8 + dy), 1.0, '#ffe058');
      }
      cCircle(ctx, x, y(16.6), 2.1, '#f0a820', out, 1.2);
    }
  }
  cCelCircle(ctx, 57.5, 26, 5.0, '#629020', '#2c460a', '#9ed048', out, 2.6);
  cComicEye(ctx, 59.0, 23.0, 2.0, '#ffffff', '#050507', 0.25, out);
  cComicEye(ctx, 59.0, 29.0, 2.0, '#ffffff', '#050507', -0.25, out);
}

/** 蚊子：细长条纹腹 + 驼背胸 + 长口器 + 大漫画眼 */
function mosquito(ctx: Ctx): void {
  const out = '#050507';
  for (const s of [1, -1]) {
    cEllipse(ctx, 27, mirror(26, s)(20.5), 15, 3.6, 'rgba(220,234,244,0.72)', out, 1.4, -0.14 * s);
  }
  cCelEllipse(ctx, 19, 26, 14.5, 4.2, '#5a4a3c', '#282018', '#907c68', out, 2.4);
  for (let x = 9; x <= 29; x += 4) cLine(ctx, [x, 22.5, x, 29.5], '#ece2d0', 1.6);
  cCelEllipse(ctx, 37.5, 26, 6.8, 5.8, '#665444', '#2c221a', '#9c8672', out, 2.6);
  cCelCircle(ctx, 45.6, 26, 4.2, '#524234', '#221a12', '#86705e', out, 2.4);
  cLine(ctx, [49, 26, 63, 26], out, 2.4);
  cLine(ctx, [49, 25.6, 62, 25.6], '#8e7c6c', 0.9);
  cComicEye(ctx, 46.8, 23.4, 2.2, '#ffffff', '#050507', 0.35, out);
  cComicEye(ctx, 46.8, 28.6, 2.2, '#ffffff', '#050507', -0.35, out);
}

/** 白蚁：米白肉呼呼大肚子 + 橙褐大脑袋 + 凶猛大颚 */
function termite(ctx: Ctx): void {
  const out = '#050507';
  cCelEllipse(ctx, 20, 26, 15.2, 11.4, '#ead09e', '#a88a58', '#fff6dc', out, 2.8);
  for (let x = 10; x <= 30; x += 5) cLine(ctx, [x, 16, x, 36], 'rgba(100,72,36,0.35)', 1.5);
  cCelEllipse(ctx, 39.5, 26, 5.8, 6.6, '#dec08a', '#9a7a48', '#fff0cc', out, 2.4);
  cCelEllipse(ctx, 50.5, 26, 7.6, 7.2, '#cc7630', '#7c3e10', '#f4a868', out, 2.8);
  for (const s of [1, -1]) {
    const y = mirror(26, s);
    ctx.strokeStyle = out;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(56, y(23.5));
    ctx.quadraticCurveTo(61, y(22), 62.5, y(25.4));
    ctx.stroke();
  }
  cComicEye(ctx, 52.8, 22.6, 2.2, '#ffffff', '#050507', 0.3, out);
  cComicEye(ctx, 52.8, 29.4, 2.2, '#ffffff', '#050507', -0.3, out);
}

// ---------- 弹体 ----------

function projectiles(scene: Phaser.Scene): void {
  // 回旋叶刃：带锯齿边的叶片
  bake2D(
    scene,
    'leafblade',
    24,
    16,
    (ctx) => {
      cPoly(ctx, [1.5, 8, 6, 3, 12, 1.5, 18, 3, 22.5, 8, 18, 13, 12, 14.5, 6, 13], cShellGrad(ctx, 10, 6, 11, '#d8ff9a', '#6ac03a', '#2a6a16'), '#1e4a10', 1.4);
      cLine(ctx, [2.5, 8, 21.5, 8], '#2a6a16', 1.2);
      for (const x of [7, 12, 17]) {
        cLine(ctx, [x, 8, x - 2.5, 4.5], 'rgba(30,80,16,0.7)', 0.8);
        cLine(ctx, [x, 8, x - 2.5, 11.5], 'rgba(30,80,16,0.7)', 0.8);
      }
      cSoftEllipse(ctx, 10, 5.4, 6, 1.6, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
    },
    SPRITE_RES,
  );
  // 粪球：土褐色带草屑
  bake2D(
    scene,
    'dungball',
    26,
    26,
    (ctx) => {
      cCircle(ctx, 13, 13, 11, cShellGrad(ctx, 11, 10, 11, '#b8905a', '#6a4a24', '#2e1e0c'), '#1e1208', 1.6);
      for (const [x, y, r] of [[9, 9, 2.2], [16, 8, 1.8], [7, 15, 1.6], [15, 16, 2.4], [12, 12, 1.4], [19, 13, 1.5]]) {
        cCircle(ctx, x, y, r, 'rgba(60,40,18,0.5)');
      }
      cLine(ctx, [6, 11, 10, 9], '#d8c070', 0.9);
      cLine(ctx, [15, 19, 19, 17.5], '#d8c070', 0.9);
      cLine(ctx, [17, 6, 19.5, 9], '#c0a860', 0.8);
      cSoftEllipse(ctx, 10, 8.5, 4.5, 2.6, 'rgba(255,240,210,0.4)', 'rgba(255,240,210,0)');
    },
    SPRITE_RES,
  );
  // 弹跳石子：高对比亮灰金石片
  bake2D(
    scene,
    'pebble',
    16,
    16,
    (ctx) => {
      cSoftEllipse(ctx, 8, 8, 7.2, 6.2, 'rgba(255,236,180,0.38)', 'rgba(255,236,180,0)');
      cEllipse(ctx, 8, 8, 6.0, 5.0, cShellGrad(ctx, 6.8, 6.2, 6.4, '#fffdf4', '#b8b4a4', '#585246'), '#050507', 1.6);
      cSoftEllipse(ctx, 6.4, 6.0, 2.8, 1.4, 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)');
    },
    SPRITE_RES,
  );
  // 喷火：柔边火团
  bake2D(
    scene,
    'flame',
    26,
    26,
    (ctx) => {
      cSoftEllipse(ctx, 13, 13, 12.5, 12.5, 'rgba(255,120,30,0.75)', 'rgba(255,60,10,0)');
      cSoftEllipse(ctx, 14, 13, 8, 7, 'rgba(255,200,80,0.95)', 'rgba(255,140,40,0)');
      cSoftEllipse(ctx, 15, 13, 4, 3.4, 'rgba(255,250,210,1)', 'rgba(255,220,120,0)');
    },
    SPRITE_RES,
  );
  // 霜露弹：高饱和冰蓝尖晶
  bake2D(
    scene,
    'frostshot',
    20,
    12,
    (ctx) => {
      cSoftEllipse(ctx, 10, 6, 9.2, 5.4, 'rgba(64,208,255,0.6)', 'rgba(64,208,255,0)');
      cPoly(ctx, [1.8, 6, 7.8, 2, 18.2, 6, 7.8, 10], cShellGrad(ctx, 9, 4.2, 8.6, '#ffffff', '#44d0ff', '#1064b8'), '#07284a', 1.4);
      cLine(ctx, [3.6, 6, 16.5, 6], 'rgba(255,255,255,0.92)', 1.1);
    },
    SPRITE_RES,
  );
  // 蜂蜜罐：琥珀色蜜团
  bake2D(
    scene,
    'honeyblob',
    16,
    16,
    (ctx) => {
      cSoftEllipse(ctx, 8, 8, 7.8, 7.8, 'rgba(255,200,60,0.52)', 'rgba(255,200,60,0)');
      cCircle(ctx, 8, 8, 5.5, cShellGrad(ctx, 6.8, 6.6, 5.6, '#fff4a8', '#ffb818', '#a05804'), '#321a02', 1.5);
      cSoftEllipse(ctx, 6.4, 6.2, 2.2, 1.4, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    },
    SPRITE_RES,
  );
  // 炮台子弹：高对比炽橙土丸
  bake2D(
    scene,
    'turretshot',
    14,
    10,
    (ctx) => {
      cSoftEllipse(ctx, 7, 5, 6.4, 4.4, 'rgba(255,188,68,0.45)', 'rgba(255,188,68,0)');
      cEllipse(ctx, 7, 5, 5.2, 3.4, cShellGrad(ctx, 5.8, 3.8, 5.0, '#fff2b0', '#f0a236', '#8a480c'), '#050507', 1.4);
    },
    SPRITE_RES,
  );
}

// ---------- 机关 ----------

function devices(scene: Phaser.Scene): void {
  // 种子地雷：埋在土里的种荚，顶上一点红光
  bake2D(
    scene,
    'mine',
    28,
    28,
    (ctx) => {
      cEllipse(ctx, 14, 15.5, 12.5, 9.5, 'rgba(70,46,22,0.75)');
      cEllipse(ctx, 14, 14, 8.5, 7, cShellGrad(ctx, 12, 12, 8.5, '#d8a868', '#8a5a28', '#3a2208'), '#2a1806', 1.5);
      for (const a of [0, 1.05, 2.1, 3.15, 4.2, 5.25]) {
        cLine(ctx, [14 + Math.cos(a) * 3, 14 + Math.sin(a) * 2.5, 14 + Math.cos(a) * 7.5, 14 + Math.sin(a) * 6], 'rgba(60,34,10,0.55)', 1);
      }
      cSoftEllipse(ctx, 14, 13.5, 4.5, 4.5, 'rgba(255,90,60,0.6)', 'rgba(255,90,60,0)');
      cCircle(ctx, 14, 13.5, 1.8, '#ff6a48', '#6a1808', 0.8);
      cCircle(ctx, 13.5, 13, 0.6, '#ffffff');
    },
    SPRITE_RES,
  );
  // 蚁丘炮台：俯视的小土丘，炮管朝右（会转向目标）
  bake2D(
    scene,
    'turret',
    36,
    36,
    (ctx) => {
      cContactShadow(ctx, 18, 19.5, 15, 13, 0.32);
      cCircle(ctx, 18, 18, 12.5, cShellGrad(ctx, 15, 14, 13, '#d8a868', '#9a6a34', '#4a2c10'), '#2a1806', 1.8);
      for (const [x, y, r] of [[13, 13, 1.4], [22, 12, 1.2], [12, 22, 1.3], [21, 24, 1.5], [16, 18, 1]]) cCircle(ctx, x, y, r, 'rgba(70,44,18,0.55)');
      // 炮管
      cRoundRect(ctx, 18, 14.6, 16, 6.8, 2.6, cShellGrad(ctx, 26, 16, 8, '#a8886a', '#5a4a3a', '#2a2018'), '#1a120a', 1.4);
      cLine(ctx, [20, 16.4, 32, 16.4], 'rgba(255,240,210,0.45)', 1);
      // 洞口
      cCircle(ctx, 18, 18, 4.6, '#2a1608', '#1a0c04', 1);
      cCircle(ctx, 19.5, 17.5, 1.3, '#d8a050');
    },
    SPRITE_RES,
  );
}

// ---------- 友方小虫 ----------

function allies(scene: Phaser.Scene): void {
  // 飞蛾：朝右，四片带眼斑的翅膀张开
  bake2D(
    scene,
    'moth',
    24,
    22,
    (ctx) => {
      for (const s of [1, -1]) {
        const y = mirror(11, s);
        cEllipse(ctx, 14, y(5), 5.6, 4.8, cShellGrad(ctx, 13, y(4), 5.6, '#fff4dc', '#e0c8a0', '#9a7c52'), '#5a4428', 1, -0.5 * s);
        cEllipse(ctx, 8.5, y(6.2), 4.2, 3.6, cShellGrad(ctx, 8, y(5.5), 4.2, '#f8e8c8', '#d0b488', '#8a6a40'), '#5a4428', 1, 0.4 * s);
        cCircle(ctx, 14.5, y(4.6), 1.5, '#6a4a8a');
        cCircle(ctx, 14.5, y(4.6), 0.6, '#f8f0ff');
      }
      cEllipse(ctx, 12, 11, 6.5, 2.2, '#8a6a40', '#3a2810', 1);
      cCircle(ctx, 18.6, 11, 1.9, '#6a4a28', '#3a2810', 0.8);
      cLine(ctx, [19.5, 10, 23, 7], '#3a2810', 0.8);
      cLine(ctx, [19.5, 12, 23, 15], '#3a2810', 0.8);
    },
    SPRITE_RES,
  );
  // 工蚁：金褐色、朝右（蚁后的随从）
  bake2D(
    scene,
    'workerant',
    28,
    22,
    (ctx) => {
      cContactShadow(ctx, 14, 12, 12, 7, 0.26);
      for (const [rx, kx, ky, tx, ty] of [
        [16, 19, 16, 22, 19],
        [13.5, 14, 17, 12, 20],
        [11.5, 8, 16, 4, 19],
      ]) {
        cLine(ctx, [rx, 12, kx, ky, tx, ty], '#4a2a08', 1.3);
        cLine(ctx, [rx, 10, kx, 22 - ky, tx, 22 - ty], '#4a2a08', 1.3);
      }
      cEllipse(ctx, 6.5, 11, 5.6, 4.6, cShellGrad(ctx, 5.5, 9.5, 5.6, '#ffd890', '#c88a30', '#6a3e0c'), '#3a2006', 1.3);
      cCircle(ctx, 11.6, 11, 1.4, '#8a5a1a', '#3a2006', 0.8);
      cEllipse(ctx, 15, 11, 3.2, 2.6, cShellGrad(ctx, 14.5, 10, 3.2, '#ffd890', '#c88a30', '#6a3e0c'), '#3a2006', 1.1);
      cCircle(ctx, 20.5, 11, 3.4, cShellGrad(ctx, 20, 10, 3.4, '#ffd890', '#c88a30', '#6a3e0c'), '#3a2006', 1.2);
      cLine(ctx, [22.5, 9, 24.5, 5.5, 27, 5], '#3a2006', 0.9);
      cLine(ctx, [22.5, 13, 24.5, 16.5, 27, 17], '#3a2006', 0.9);
      cPoly(ctx, [23.4, 9.6, 26, 10.4, 23.8, 11], '#3a2006');
      cPoly(ctx, [23.4, 12.4, 26, 11.6, 23.8, 11], '#3a2006');
      cCircle(ctx, 21.6, 9.6, 0.7, '#140a02');
      cCircle(ctx, 21.6, 12.4, 0.7, '#140a02');
      cSoftEllipse(ctx, 5.5, 9, 3, 1.4, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
    },
    SPRITE_RES,
  );
}
