import Phaser from 'phaser';
import {
  SPRITE_RES,
  bake2D,
  cCelCircle,
  cCelEllipse,
  cCircle,
  cComicEye,
  cContactShadow,
  cEllipse,
  cLine,
  cPoly,
  type Ctx,
} from './draw';

/**
 * 100% 土豆兄弟（Brotato）卡通重墨画风怪物：
 * 粗黑统一轮廓（#050507）+ 纯平赛璐璐两段明暗（绝无模糊渐变）+ 超有表现力的 Q 版大眼睛。
 */

const OUT = '#050507';

function legs(ctx: Ctx, color: string, width: number, cy: number, pairs: number[][]): void {
  for (const p of pairs) {
    cLine(ctx, p, OUT, width + 1.6);
    cLine(ctx, p, color, Math.max(0.8, width - 0.3));
    const mir = p.map((v, i) => (i % 2 === 1 ? 2 * cy - v : v));
    cLine(ctx, mir, OUT, width + 1.6);
    cLine(ctx, mir, color, Math.max(0.8, width - 0.3));
  }
}

export function generateCreatures(scene: Phaser.Scene): void {
  // 蚊子 34×26
  bake2D(
    scene,
    'mosquito',
    34,
    26,
    (ctx) => {
      cContactShadow(ctx, 17, 14.5, 11, 7, 0.34);
      for (const s of [-1, 1]) {
        const wy = 13 + s * 6.4;
        cEllipse(ctx, 14.5, wy, 8.2, 3.6, 'rgba(225, 242, 255, 0.85)', OUT, 1.5, s * 0.38);
      }
      legs(ctx, '#6a4070', 1.2, 13, [
        [17.5, 12, 13, 5.5, 8.5, 3.2],
        [18.5, 12, 19.5, 4.5, 22.5, 1.5],
        [16.5, 12, 11, 8, 5, 7],
      ]);
      cCelEllipse(ctx, 10.5, 13, 8.0, 3.8, '#8a4890', '#4a2050', '#c47ecc', OUT, 2.2);
      for (const x of [6.5, 9.5, 12.5]) cLine(ctx, [x, 9.8, x, 16.2], OUT, 1.5);
      cCelCircle(ctx, 18.5, 13, 4.2, '#7c3e84', '#421a48', '#b872c0', OUT, 2.2);
      cCelCircle(ctx, 23.2, 13, 3.4, '#6a3272', '#38143e', '#a460ac', OUT, 2.2);
      cLine(ctx, [25.5, 13, 33, 13], OUT, 2.4);
      cLine(ctx, [26.5, 12.6, 32.2, 12.6], '#ffd0d0', 0.9);
      cComicEye(ctx, 24.4, 11.2, 1.8, '#ffdddd', '#cc1820', 0.35, OUT);
      cComicEye(ctx, 24.4, 14.8, 1.8, '#ffdddd', '#cc1820', -0.35, OUT);
    },
    SPRITE_RES,
  );

  // 黄蜂 40×32
  bake2D(
    scene,
    'wasp',
    40,
    32,
    (ctx) => {
      cContactShadow(ctx, 21, 17.5, 15, 10, 0.38);
      for (const s of [-1, 1]) {
        const wy = 16 + s * 8.2;
        cEllipse(ctx, 18, wy, 9.5, 4.2, 'rgba(232, 248, 255, 0.85)', OUT, 1.6, s * 0.45);
      }
      legs(ctx, '#664416', 1.5, 16, [
        [22, 17, 20, 22, 17, 26.5],
        [24, 17, 25.5, 22.5, 28, 26],
      ]);
      cPoly(ctx, [1.0, 16, 7.8, 13.2, 7.8, 18.8], '#181006', OUT, 1.8);
      cCelEllipse(ctx, 13, 16, 9.4, 7.0, '#f6bd20', '#b87608', '#ffe878', OUT, 2.5);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(13, 16, 8.6, 6.2, 0, 0, Math.PI * 2);
      ctx.clip();
      for (const x of [8.0, 12.4, 16.8]) cEllipse(ctx, x, 16, 1.8, 6.4, '#181006');
      ctx.restore();
      cEllipse(ctx, 13, 16, 9.4, 7.0, undefined, OUT, 2.5);
      cCelEllipse(ctx, 23.5, 16, 5.4, 4.8, '#6c4814', '#382206', '#a47428', OUT, 2.3);
      cCelCircle(ctx, 30.2, 16, 5.2, '#f6bd20', '#b87608', '#ffe878', OUT, 2.4);
      cLine(ctx, [33.5, 13.8, 37.2, 9.6], OUT, 1.8);
      cLine(ctx, [33.5, 18.2, 37.2, 22.4], OUT, 1.8);
      cComicEye(ctx, 31.6, 13.0, 2.3, '#ffffff', '#050507', 0.42, OUT);
      cComicEye(ctx, 31.6, 19.0, 2.3, '#ffffff', '#050507', -0.42, OUT);
    },
    SPRITE_RES,
  );

  // 跳蛛 38×36
  bake2D(
    scene,
    'spider',
    38,
    36,
    (ctx) => {
      cContactShadow(ctx, 19, 19.5, 15, 12, 0.42);
      legs(ctx, '#683856', 2.0, 18, [
        [23, 16, 27.5, 8.5, 34, 5.5],
        [22, 15, 23, 6.5, 25.5, 2],
        [20, 15, 16.5, 6.5, 12, 3.2],
        [19, 16, 12.5, 10.5, 6, 8.5],
      ]);
      cCelEllipse(ctx, 12.8, 18, 9.5, 8.2, '#6c3a5a', '#36182c', '#a2648c', OUT, 2.6);
      cPoly(ctx, [7.2, 18, 11.2, 14.8, 15.2, 18, 11.2, 21.2], '#ff3e3e', OUT, 1.5);
      cCelEllipse(ctx, 23.5, 18, 7.0, 6.5, '#562a46', '#281020', '#8c5278', OUT, 2.5);
      cComicEye(ctx, 28.0, 14.8, 2.7, '#ffffff', '#050507', 0.25, OUT);
      cComicEye(ctx, 28.0, 21.2, 2.7, '#ffffff', '#050507', -0.25, OUT);
      cComicEye(ctx, 25.2, 12.2, 1.5, '#ffe898', '#050507', 0, OUT);
      cComicEye(ctx, 25.2, 23.8, 1.5, '#ffe898', '#050507', 0, OUT);
    },
    SPRITE_RES,
  );

  // 黏菌 44×40（土豆兄弟果冻怪风格：纯平亮紫 + 厚黑边 + 呆萌大白眼）
  bake2D(
    scene,
    'slime',
    44,
    40,
    (ctx) => {
      cContactShadow(ctx, 23, 22.5, 17, 14, 0.42);
      const blobs: [number, number, number][] = [
        [22, 21, 13.5],
        [12, 14, 6.2],
        [27, 11, 7.2],
        [33, 23, 6.2],
        [14, 28, 6.2],
      ];
      for (const [x, y, r] of blobs) cCircle(ctx, x, y, r + 2.8, OUT);
      for (const [x, y, r] of blobs) cCircle(ctx, x, y, r, '#742894');
      for (const [x, y, r] of blobs) cCircle(ctx, x - 0.6, y - 1.2, r * 0.85, '#ad48d6');
      cEllipse(ctx, 16, 13.5, 5.2, 2.2, '#ecc2ff', undefined, 0, -0.35);
      cCircle(ctx, 11.2, 17.5, 1.8, '#ecc2ff');
      cComicEye(ctx, 28.5, 16.5, 3.0, '#ffffff', '#050507', 0, OUT);
      cComicEye(ctx, 28.5, 25.5, 3.0, '#ffffff', '#050507', 0, OUT);
    },
    SPRITE_RES,
  );

  // 气囊虫 38×38
  bake2D(
    scene,
    'gasbag',
    38,
    38,
    (ctx) => {
      cContactShadow(ctx, 19, 21, 15.5, 14, 0.42);
      legs(ctx, '#681c1c', 1.6, 19, [
        [24, 21, 26, 27, 24, 31],
        [20, 22, 19, 28, 16, 32],
      ]);
      cCelCircle(ctx, 17, 19, 13.4, '#e66c6c', '#982a30', '#ffc4bc', OUT, 2.8);
      cCircle(ctx, 17, 19, 5.4, '#ff9852', OUT, 1.5);
      cLine(ctx, [8, 14, 13, 19, 10, 25], '#6e161a', 1.8);
      cLine(ctx, [19, 8, 18, 14, 23, 17], '#6e161a', 1.8);
      cCelCircle(ctx, 30.5, 19, 5.0, '#b43c3c', '#6a1818', '#e87878', OUT, 2.4);
      cComicEye(ctx, 32.0, 16.6, 2.1, '#ffffff', '#050507', -0.25, OUT);
      cComicEye(ctx, 32.0, 21.4, 2.1, '#ffffff', '#050507', 0.25, OUT);
    },
    SPRITE_RES,
  );

  // 蚁后 52×38
  bake2D(
    scene,
    'queen',
    52,
    38,
    (ctx) => {
      cContactShadow(ctx, 25, 21, 21, 13, 0.42);
      legs(ctx, '#6a263e', 1.9, 19, [
        [30, 17, 34, 9, 38, 4.5],
        [28, 17, 28, 8.5, 25, 3.5],
        [26, 17, 21, 10, 16, 6.5],
      ]);
      cCelEllipse(ctx, 15, 19, 13.0, 9.8, '#a43a5e', '#581830', '#df7c9e', OUT, 2.8);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(15, 19, 12, 8.8, 0, 0, Math.PI * 2);
      ctx.clip();
      for (const x of [9, 14, 19]) cEllipse(ctx, x, 19, 1.6, 9.2, '#3a0c1c');
      ctx.restore();
      cEllipse(ctx, 15, 19, 13.0, 9.8, undefined, OUT, 2.8);
      cCircle(ctx, 27, 19, 2.6, '#4c1428', OUT, 1.8);
      cCelEllipse(ctx, 32, 19, 5.8, 4.8, '#8a2a4a', '#481024', '#c66084', OUT, 2.4);
      cCelCircle(ctx, 41, 19, 6.2, '#a43a5e', '#581830', '#df7c9e', OUT, 2.6);
      cPoly(ctx, [36.5, 14.5, 37.5, 9.0, 39.8, 12.2, 41.5, 8.0, 43.2, 12.2, 45.2, 9.2, 45.8, 14.5], '#ffd44c', OUT, 1.8);
      cLine(ctx, [45, 16, 48.5, 11.5], OUT, 1.8);
      cLine(ctx, [45, 22, 48.5, 26.5], OUT, 1.8);
      cComicEye(ctx, 43.2, 16.5, 2.2, '#ffffff', '#050507', 0.3, OUT);
      cComicEye(ctx, 43.2, 21.5, 2.2, '#ffffff', '#050507', -0.3, OUT);
    },
    SPRITE_RES,
  );

  // 兵蚁（精英）60×48
  bake2D(
    scene,
    'soldier',
    60,
    48,
    (ctx) => {
      cContactShadow(ctx, 29, 26, 24, 16, 0.44);
      legs(ctx, '#6e1c1c', 2.6, 24, [
        [33, 21, 38, 12, 42.5, 5.5],
        [31, 21, 31, 11, 28, 3.5],
        [29, 21, 23, 12, 17, 6.5],
      ]);
      cCelEllipse(ctx, 16, 24, 12.8, 10.6, '#b8322c', '#681212', '#ee6e64', OUT, 3.0);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(16, 24, 11.8, 9.6, 0, 0, Math.PI * 2);
      ctx.clip();
      for (const x of [11, 16, 21]) cEllipse(ctx, x, 24, 1.8, 9.8, '#4a0c0c');
      ctx.restore();
      cEllipse(ctx, 16, 24, 12.8, 10.6, undefined, OUT, 3.0);
      cCircle(ctx, 28, 24, 2.9, '#521212', OUT, 1.8);
      cCelEllipse(ctx, 33, 24, 6.6, 5.6, '#9a2420', '#500e0e', '#d45850', OUT, 2.6);
      cCelEllipse(ctx, 43, 24, 9.2, 9.0, '#c83c36', '#6e1414', '#f47e74', OUT, 3.0);
      cPoly(ctx, [48, 17.6, 58.6, 13.6, 55.4, 20.5, 49, 21.5], '#3a0e0e', OUT, 2.2);
      cPoly(ctx, [48, 30.4, 58.6, 34.4, 55.4, 27.5, 49, 26.5], '#3a0e0e', OUT, 2.2);
      cComicEye(ctx, 47.0, 19.8, 2.6, '#ffffff', '#050507', 0.4, OUT);
      cComicEye(ctx, 47.0, 28.2, 2.6, '#ffffff', '#050507', -0.4, OUT);
    },
    SPRITE_RES,
  );

  // 皇家胡蜂（远程弹幕精英）64×52
  bake2D(
    scene,
    'hornet_elite',
    64,
    52,
    (ctx) => {
      cContactShadow(ctx, 31, 29, 25, 16, 0.42);
      // 双层半透明利刃蜂翼
      cEllipse(ctx, 29, 13, 14, 6.2, 'rgba(220,244,255,0.58)', OUT, 2.0, -0.38);
      cEllipse(ctx, 29, 39, 14, 6.2, 'rgba(220,244,255,0.58)', OUT, 2.0, 0.38);
      // 发光毒针尾刺
      cPoly(ctx, [11, 23, 2, 26, 11, 29], '#ff5844', OUT, 2.2);
      // 金红条纹巨腹
      cCelEllipse(ctx, 20, 26, 13.5, 9.8, '#f0a828', '#8a4408', '#ffe478', OUT, 3.0);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(20, 26, 12.5, 8.8, 0, 0, Math.PI * 2);
      ctx.clip();
      for (const x of [13, 19, 25]) cEllipse(ctx, x, 26, 2.1, 9.5, '#2b1014');
      ctx.restore();
      cEllipse(ctx, 20, 26, 13.5, 9.8, undefined, OUT, 3.0);
      // 重甲赤红胸节
      cCelEllipse(ctx, 36, 26, 8.4, 7.6, '#c42e28', '#5e1014', '#f87868', OUT, 2.8);
      // 皇家头冠与复眼
      cCelCircle(ctx, 47, 26, 7.6, '#e89e24', '#86420a', '#ffe272', OUT, 2.8);
      cPoly(ctx, [43, 20, 45, 13.5, 48, 17.5, 51, 13, 52.5, 20], '#ffd84c', OUT, 1.8);
      cComicEye(ctx, 50.5, 22.4, 2.7, '#ff3838', '#050507', 0.35, OUT);
      cComicEye(ctx, 50.5, 29.6, 2.7, '#ff3838', '#050507', -0.35, OUT);
      // 触角
      cLine(ctx, [53, 22, 59, 17], OUT, 2.0);
      cLine(ctx, [53, 30, 59, 35], OUT, 2.0);
    },
    SPRITE_RES,
  );

  // 螳螂女王（Boss）104×88
  bake2D(
    scene,
    'mantis',
    104,
    88,
    (ctx) => {
      const DARK = '#050507';
      cContactShadow(ctx, 48, 47, 40, 24, 0.44);
      legs(ctx, '#4c8824', 2.8, 44, [
        [54, 48, 50, 64, 42, 79],
        [60, 48, 64, 64, 70, 79],
      ]);
      cCelEllipse(ctx, 32, 44, 27.5, 14.2, '#6eb43c', '#3c6e1c', '#b4ec7c', DARK, 3.4);
      cEllipse(ctx, 32, 36.8, 22.5, 6.0, '#b8f07c', DARK, 1.8, 0.05);
      cEllipse(ctx, 32, 51.2, 22.5, 6.0, '#8ed058', DARK, 1.8, -0.05);
      cLine(ctx, [9, 44, 56, 44], DARK, 2.4);
      cCelEllipse(ctx, 64, 44, 13.4, 6.6, '#7ec24a', '#447a20', '#c0f28a', DARK, 3.0);
      for (const s of [1, -1]) {
        const y = (v: number) => 44 + (v - 44) * s;
        cLine(ctx, [70, y(40), 84, y(25), 97.5, y(31)], DARK, 7.2);
        cLine(ctx, [70.5, y(40), 84, y(26), 96.5, y(31.5)], '#96dc5c', 3.8);
        for (const t of [0.28, 0.54, 0.8]) {
          const sx = 84 + 13 * t;
          const sy = 25 + 6 * t;
          cPoly(ctx, [sx - 1.8, y(sy + 1), sx, y(sy + 5.8), sx + 1.8, y(sy + 1)], '#f4fad4', DARK, 1.3);
        }
      }
      cPoly(ctx, [73.2, 33.8, 87.6, 44, 73.2, 54.2], '#84cc4e', DARK, 3.0);
      cComicEye(ctx, 76.2, 36.2, 4.8, '#f6ffa4', '#050507', 0.35, DARK);
      cComicEye(ctx, 76.2, 51.8, 4.8, '#f6ffa4', '#050507', -0.35, DARK);
      cPoly(ctx, [69.5, 38.5, 67, 40.5, 69.5, 42.2, 66, 44, 69.5, 45.8, 67, 47.5, 69.5, 49.5, 73, 48, 73, 40], '#ffd44c', DARK, 1.8);
      cCircle(ctx, 71, 44, 1.8, '#ff483c', DARK, 0.8);
    },
    SPRITE_RES,
  );

  // 蚜虫（召唤物）26×20
  bake2D(
    scene,
    'aphid',
    26,
    20,
    (ctx) => {
      cContactShadow(ctx, 13.5, 11, 10, 7, 0.34);
      legs(ctx, '#387e22', 1.2, 10, [
        [15, 11, 17, 15, 19, 17],
        [11, 11, 10, 15, 8, 17],
      ]);
      cCelEllipse(ctx, 11, 10, 8.6, 6.4, '#84d854', '#468824', '#d4ff9c', '#050507', 2.2);
      cCelCircle(ctx, 19, 10, 4.0, '#6ec042', '#38741c', '#b8f488', '#050507', 2.0);
      cComicEye(ctx, 20.4, 8.4, 1.5, '#ffffff', '#050507', 0, '#050507');
      cComicEye(ctx, 20.4, 11.6, 1.5, '#ffffff', '#050507', 0, '#050507');
    },
    SPRITE_RES,
  );

  // 蜜树桩（战场资源树，打掉必掉果子 + 概率宝箱）48×48
  bake2D(
    scene,
    'tree',
    48,
    48,
    (ctx) => {
      cContactShadow(ctx, 24, 32, 20, 13, 0.44);
      // 树根与粗木桩底座
      cCelCircle(ctx, 24, 27, 13.5, '#8a582c', '#4a2c12', '#c88c4e', OUT, 2.6);
      // 翠绿树冠三簇
      cCelCircle(ctx, 16, 20, 10.5, '#4da638', '#245c18', '#8ae068', OUT, 2.5);
      cCelCircle(ctx, 32, 20, 10.5, '#4da638', '#245c18', '#8ae068', OUT, 2.5);
      cCelCircle(ctx, 24, 16, 12.5, '#62c048', '#2d6e1e', '#a4f47c', OUT, 2.6);
      // 挂在树冠上的发光金蜜果
      for (const [fx, fy] of [
        [17, 19],
        [29, 15],
        [25, 25],
      ]) {
        cCircle(ctx, fx, fy, 3.6, '#ffcf38', OUT, 1.5);
        cCircle(ctx, fx - 0.9, fy - 0.9, 1.2, '#ffffff');
      }
    },
    SPRITE_RES,
  );

  // 黄金盗宝虫（限时逃跑，打掉掉宝箱和一堆花蜜）40×34
  bake2D(
    scene,
    'lootbug',
    40,
    34,
    (ctx) => {
      cContactShadow(ctx, 20, 19, 15, 11, 0.4);
      legs(ctx, '#8a5608', 1.6, 17, [
        [23, 18, 25, 25, 29, 28],
        [17, 18, 17, 26, 13, 29],
        [11, 17, 8, 24, 4, 26],
      ]);
      // 背上的鼓胀宝箱袋
      cCelEllipse(ctx, 13, 17, 10.5, 9.2, '#ffd038', '#b8700c', '#fff4a0', OUT, 2.5);
      cLine(ctx, [11, 9, 11, 25], '#7a3c06', 2.2);
      // 金甲头部与惊慌大眼
      cCelCircle(ctx, 27, 17, 7.2, '#f0a824', '#985608', '#ffe478', OUT, 2.4);
      cComicEye(ctx, 30, 13.5, 2.5, '#ffffff', '#050507', 0.2, OUT);
      cComicEye(ctx, 30, 20.5, 2.5, '#ffffff', '#050507', -0.2, OUT);
    },
    SPRITE_RES,
  );

  // 爆裂毒菇（可打爆的场景战术机关，爆开大范围清怪 + 掉琥珀露珠）44×44
  bake2D(
    scene,
    'boomshroom',
    44,
    44,
    (ctx) => {
      cContactShadow(ctx, 22, 33, 16, 9, 0.44);
      // 粗壮菌柄
      cCelEllipse(ctx, 22, 28, 7.5, 9.5, '#ebd8b8', '#987c5a', '#fff6e4', OUT, 2.5);
      // 膨胀赤紫发光伞盖
      cCelEllipse(ctx, 22, 18, 15.5, 11.5, '#b83268', '#5c1230', '#ff709a', OUT, 2.8);
      // 危险橙黄爆裂斑点
      for (const [sx, sy, sr] of [
        [14, 17, 3.2],
        [23, 12.5, 3.6],
        [30.5, 18, 2.9],
        [20, 21.5, 2.4],
      ]) {
        cCircle(ctx, sx, sy, sr, '#ffaa2b', OUT, 1.4);
        cCircle(ctx, sx - 0.8, sy - 0.8, sr * 0.35, '#fff6c2');
      }
    },
    SPRITE_RES,
  );

  // 露珠冰球（打爆释放大范围冰冻水浪 + 潮湿水洼）42×42
  bake2D(
    scene,
    'deworb',
    42,
    42,
    (ctx) => {
      cContactShadow(ctx, 21, 31, 15, 8, 0.38);
      cCelCircle(ctx, 21, 21, 14.5, '#5cc8f8', '#2268a0', '#c8f6ff', OUT, 2.6);
      cCircle(ctx, 16, 15, 4.2, '#ffffff');
      cCircle(ctx, 26, 25, 2.2, '#e0fbff');
      // 冰晶内芯星芒
      cLine(ctx, [21, 13, 21, 29], '#e8fbff', 1.8);
      cLine(ctx, [13, 21, 29, 21], '#e8fbff', 1.8);
    },
    SPRITE_RES,
  );

  // 泰坦兜虫（第二只最终 Boss / 无尽里程碑 Boss：重铠黑金独角巨兽）108×92
  bake2D(
    scene,
    'goliath_boss',
    108,
    92,
    (ctx) => {
      const DARK = '#050507';
      cContactShadow(ctx, 48, 48, 44, 28, 0.48);
      // 粗壮黑金重甲六足
      legs(ctx, '#4a301c', 3.8, 46, [
        [62, 54, 70, 72, 82, 82],
        [44, 56, 46, 76, 38, 86],
        [26, 54, 18, 72, 8, 80],
      ]);
      // 巨型黑金厚重鞘翅（双瓣+熔金裂纹）
      cCelEllipse(ctx, 34, 46, 29, 21, '#3b2b28', '#181010', '#7e5c4a', DARK, 3.8);
      cCelEllipse(ctx, 32, 36, 23, 8.8, '#543c32', '#261816', '#a87d5a', DARK, 2.4);
      cCelEllipse(ctx, 32, 56, 23, 8.8, '#46322a', '#201412', '#8e684c', DARK, 2.4);
      cLine(ctx, [7, 46, 59, 46], DARK, 3.2);
      // 鞘翅上的熔岩琥珀战纹
      for (const s of [1, -1]) {
        const y = (v: number) => 46 + (v - 46) * s;
        cPoly(ctx, [18, y(35), 29, y(32), 26, y(39), 15, y(40)], '#ffae2b', DARK, 1.5);
        cPoly(ctx, [36, y(33), 47, y(35), 42, y(41), 33, y(39)], '#ffd858', DARK, 1.4);
      }
      // 重装甲前胸背板（带皇家金冠尖刺）
      cCelEllipse(ctx, 64, 46, 15.5, 16.5, '#6a4020', '#2b160a', '#d4964c', DARK, 3.6);
      cPoly(ctx, [56, 35, 62, 29, 68, 35, 72, 46, 68, 57, 62, 63, 56, 57], '#ffd04c', DARK, 2.0);
      // 头部 + 霸气巨型分叉冲锋角
      cCelCircle(ctx, 79, 46, 10.5, '#2b1812', '#100806', '#6e4430', DARK, 3.2);
      // 主巨角（向前弯曲带金色尖刃）
      cPoly(ctx, [84, 42, 102, 34, 106, 46, 102, 58, 84, 50, 91, 46], '#f2b838', DARK, 3.0);
      cPoly(ctx, [86, 44, 100, 39, 96, 46, 100, 53, 86, 48], '#fff0a4', DARK, 1.4);
      // 两侧副角
      for (const s of [1, -1]) {
        const y = (v: number) => 46 + (v - 46) * s;
        cPoly(ctx, [74, y(36), 88, y(24), 84, y(35), 76, y(40)], '#d88c28', DARK, 2.4);
      }
      // 炽热红金怒眼
      cComicEye(ctx, 81, 38.5, 4.4, '#ff5436', '#fff29c', 0.3, DARK);
      cComicEye(ctx, 81, 53.5, 4.4, '#ff5436', '#fff29c', -0.3, DARK);
    },
    SPRITE_RES,
  );

  // 狂化鸣蝉（Buffer 强化辅助怪）42×36：赤红金纹发光声囊鸣蝉
  bake2D(
    scene,
    'buffer',
    42,
    36,
    (ctx) => {
      cContactShadow(ctx, 20, 20, 16, 11, 0.4);
      // 半透明红金振膜双翅
      for (const s of [-1, 1]) {
        cEllipse(ctx, 18, 18 + s * 9.2, 11, 4.6, 'rgba(255, 198, 156, 0.72)', OUT, 1.8, s * 0.42);
      }
      legs(ctx, '#7a1c1c', 1.6, 18, [
        [23, 19, 21, 25, 18, 29],
        [27, 19, 29, 25, 32, 28],
      ]);
      // 发光赤红鼓膜大腹（发出狂化声波的核心）
      cCelEllipse(ctx, 14, 18, 10.6, 8.2, '#e8343c', '#821018', '#ff9488', OUT, 2.6);
      cCircle(ctx, 13, 18, 4.4, '#ffd44c', OUT, 1.6);
      cCircle(ctx, 13, 18, 2.0, '#fff7c2');
      // 胸节 + 宽头红金怒眼
      cCelEllipse(ctx, 26, 18, 5.6, 6.2, '#b8222a', '#5e0e14', '#f26c68', OUT, 2.4);
      cCelCircle(ctx, 33, 18, 5.8, '#dc2c34', '#761018', '#ff8a80', OUT, 2.5);
      cComicEye(ctx, 35, 14.5, 2.4, '#fff29c', '#050507', 0.35, OUT);
      cComicEye(ctx, 35, 21.5, 2.4, '#fff29c', '#050507', -0.35, OUT);
    },
    SPRITE_RES,
  );

  // 绿露医虫（Healer 治疗辅助怪）38×34：圆润翠绿医疗甲虫 + 发光绿十字背甲
  bake2D(
    scene,
    'healer',
    38,
    34,
    (ctx) => {
      cContactShadow(ctx, 19, 19, 15, 12, 0.4);
      legs(ctx, '#1e6e42', 1.7, 17, [
        [22, 16, 25, 9, 29, 5.5],
        [18, 16, 18, 8.5, 16, 4.5],
        [14, 17, 10, 11, 6, 9],
      ]);
      cCelEllipse(ctx, 16, 17, 11.4, 9.6, '#38c870', '#166e3a', '#9af4b6', OUT, 2.6);
      // 背甲白色医疗十字标识
      cLine(ctx, [16, 11.2, 16, 22.8], OUT, 5.2);
      cLine(ctx, [10.2, 17, 21.8, 17], OUT, 5.2);
      cLine(ctx, [16, 11.8, 16, 22.2], '#f4fff6', 3.0);
      cLine(ctx, [10.8, 17, 21.2, 17], '#f4fff6', 3.0);
      cCelCircle(ctx, 29.2, 17, 5.6, '#2cb060', '#125a30', '#86eaa4', OUT, 2.4);
      cComicEye(ctx, 31.2, 14.4, 2.2, '#ffffff', '#050507', 0.25, OUT);
      cComicEye(ctx, 31.2, 19.6, 2.2, '#ffffff', '#050507', -0.25, OUT);
    },
    SPRITE_RES,
  );

  // 疾影猎虫（Pursuer 越追越快）40×30：暗紫炽橙修长疾行虎虫
  bake2D(
    scene,
    'pursuer',
    40,
    30,
    (ctx) => {
      cContactShadow(ctx, 19, 17, 15, 9, 0.4);
      legs(ctx, '#4c2058', 1.6, 15, [
        [24, 15, 29, 7, 35, 4],
        [19, 15, 19, 6.5, 15, 3.5],
        [14, 15, 9, 8.5, 4, 6.5],
      ]);
      cCelEllipse(ctx, 14, 15, 10.6, 6.2, '#5a2678', '#2a0e3c', '#9a58c4', OUT, 2.5);
      // 炽橙速度疾风纹
      cPoly(ctx, [9, 15, 16, 11.2, 19, 15, 16, 18.8], '#ff8828', OUT, 1.4);
      cCelEllipse(ctx, 25, 15, 5.2, 4.8, '#461a60', '#200a30', '#8446aa', OUT, 2.3);
      cCelCircle(ctx, 31.6, 15, 5.0, '#6a2e8c', '#321048', '#b06cd6', OUT, 2.4);
      // 向前突出的橘红猎牙
      cPoly(ctx, [35, 12.2, 39.6, 10.2, 36.8, 14.2], '#ff6828', OUT, 1.4);
      cPoly(ctx, [35, 17.8, 39.6, 19.8, 36.8, 15.8], '#ff6828', OUT, 1.4);
      cComicEye(ctx, 33.2, 12.4, 2.1, '#ffe478', '#cc1820', 0.4, OUT);
      cComicEye(ctx, 33.2, 17.6, 2.1, '#ffe478', '#cc1820', -0.4, OUT);
    },
    SPRITE_RES,
  );

  // 镰斩魔卵（Slasher Egg：5 秒内不打爆会孵化镰刃螳虫）38×42
  bake2D(
    scene,
    'slasher_egg',
    38,
    42,
    (ctx) => {
      cContactShadow(ctx, 19, 32, 14, 7.5, 0.45);
      // 黏液卵托
      cEllipse(ctx, 19, 31, 13.5, 5.2, '#5a1e2e', OUT, 2.2);
      // 脉动暗红虫卵壳
      cCelEllipse(ctx, 19, 20, 12.2, 15.2, '#b82e48', '#5c1022', '#ff809a', OUT, 2.8);
      // 裂纹与内部发光橙黄镰纹
      cLine(ctx, [12, 16, 17, 21, 14, 27], '#1a060c', 2.0);
      cLine(ctx, [25, 13, 21, 19, 26, 24], '#1a060c', 2.0);
      cCircle(ctx, 19, 19, 4.2, '#ffae2b', OUT, 1.4);
      cCircle(ctx, 18.2, 18, 1.7, '#fff6c2');
    },
    SPRITE_RES,
  );

  // 镰刃螳虫（Slasher：中距地面 V 字斩击）48×42
  bake2D(
    scene,
    'slasher',
    48,
    42,
    (ctx) => {
      cContactShadow(ctx, 22, 23, 18, 12, 0.42);
      legs(ctx, '#6e1828', 1.8, 21, [
        [24, 21, 21, 29, 16, 35],
        [18, 21, 13, 28, 7, 32],
      ]);
      // 猩红双镰前肢
      for (const s of [-1, 1]) {
        const y = (v: number) => 21 + (v - 21) * s;
        cPoly(ctx, [28, y(16), 39, y(5), 46.5, y(12), 36, y(18)], '#ff4054', OUT, 2.4);
        cPoly(ctx, [32, y(15), 40, y(8.5), 43.5, y(12), 36, y(16.5)], '#ffd8c8');
      }
      // 甲壳躯干
      cCelEllipse(ctx, 15, 21, 11.4, 7.6, '#961e34', '#4a0c18', '#e65c74', OUT, 2.6);
      cCelEllipse(ctx, 27, 21, 6.2, 6.0, '#b82840', '#5a101e', '#f4788c', OUT, 2.4);
      // 锐利三角头与黄眼
      cPoly(ctx, [29, 14.5, 40, 21, 29, 27.5], '#c82e46', OUT, 2.4);
      cComicEye(ctx, 32.8, 17.5, 2.4, '#ffe878', '#050507', 0.4, OUT);
      cComicEye(ctx, 32.8, 24.5, 2.4, '#ffe878', '#050507', -0.4, OUT);
    },
    SPRITE_RES,
  );

  // 棘球毒虫（Puffer：亡语 8 向炸弹幕，近战劈死可截断）42×42
  bake2D(
    scene,
    'puffer',
    42,
    42,
    (ctx) => {
      cContactShadow(ctx, 21, 24, 16, 13, 0.42);
      // 8 根外放尖刺
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        cPoly(
          ctx,
          [21 + c * 11 - s * 3.2, 21 + s * 11 + c * 3.2, 21 + c * 19.5, 21 + s * 19.5, 21 + c * 11 + s * 3.2, 21 + s * 11 - c * 3.2],
          '#ff6896',
          OUT,
          2.0,
        );
      }
      // 鼓胀紫红毒囊圆体
      cCelCircle(ctx, 21, 21, 12.6, '#c8346e', '#681238', '#ff8cb8', OUT, 2.8);
      cCircle(ctx, 16, 17, 2.6, '#ffde66', OUT, 1.2);
      cCircle(ctx, 16, 25, 2.2, '#ffde66', OUT, 1.2);
      cComicEye(ctx, 26.5, 16.6, 2.8, '#ffffff', '#050507', 0.2, OUT);
      cComicEye(ctx, 26.5, 25.4, 2.8, '#ffffff', '#050507', -0.2, OUT);
    },
    SPRITE_RES,
  );

  // 噬蜜飞鳗（Lamprey：诱饵甜果专属突袭怪，冲锋并向两侧甩弹）46×34
  bake2D(
    scene,
    'lamprey',
    46,
    34,
    (ctx) => {
      cContactShadow(ctx, 22, 19, 18, 10, 0.4);
      // 侧翼毒腺鳍
      for (const s of [-1, 1]) {
        cPoly(ctx, [18, 17 + s * 5, 25, 17 + s * 14.5, 31, 17 + s * 6], '#ff4c6e', OUT, 2.0);
      }
      // 蜿蜒鳗尾 + 躯干
      cCelEllipse(ctx, 10, 17, 7.6, 4.6, '#52266e', '#260e38', '#985cb8', OUT, 2.3);
      cCelEllipse(ctx, 21, 17, 9.6, 6.8, '#6e2e8c', '#36124a', '#b66ed8', OUT, 2.6);
      // 锯齿圆口噬咬头
      cCelCircle(ctx, 33.5, 17, 7.2, '#e63a52', '#7a1224', '#ff8a98', OUT, 2.6);
      cPoly(ctx, [39, 13.5, 44.5, 15.5, 39.5, 17, 44.5, 18.5, 39, 20.5], '#fff4c8', OUT, 1.5);
      cComicEye(ctx, 32.5, 13.0, 2.2, '#ffe868', '#050507', 0.38, OUT);
      cComicEye(ctx, 32.5, 21.0, 2.2, '#ffe868', '#050507', -0.38, OUT);
    },
    SPRITE_RES,
  );

  // 腐巢母虫（Spawner：慢速臃肿，死后炸出 3 只吐酸幼虫）52×44
  bake2D(
    scene,
    'spawner',
    52,
    44,
    (ctx) => {
      cContactShadow(ctx, 24, 25, 20, 14, 0.44);
      legs(ctx, '#465a24', 2.0, 22, [
        [30, 22, 34, 31, 39, 36],
        [22, 22, 21, 32, 16, 37],
        [14, 22, 10, 30, 5, 33],
      ]);
      // 背满发光毒卵囊的巨腹
      cCelEllipse(ctx, 18, 22, 14.5, 12.2, '#5c7a2e', '#2c4012', '#9cc656', OUT, 2.8);
      for (const [ox, oy, or] of [
        [12, 16, 4.4],
        [20, 14, 4.0],
        [14, 27, 4.2],
        [22, 27, 3.8],
      ]) {
        cCelCircle(ctx, ox, oy, or, '#d458d8', '#6e1e74', '#ffafff', OUT, 1.8);
      }
      cCelCircle(ctx, 37.5, 22, 7.2, '#6a8a36', '#344a16', '#aad466', OUT, 2.6);
      cComicEye(ctx, 40.5, 18.8, 2.4, '#f8ff9c', '#050507', 0.25, OUT);
      cComicEye(ctx, 40.5, 25.2, 2.4, '#f8ff9c', '#050507', -0.25, OUT);
    },
    SPRITE_RES,
  );

  // 吐酸幼虫（Spitter：腐巢爆出的游走散射弹幕小怪）30×24
  bake2D(
    scene,
    'spitter',
    30,
    24,
    (ctx) => {
      cContactShadow(ctx, 15, 14, 11, 7, 0.36);
      legs(ctx, '#5a1e64', 1.4, 12, [
        [17, 12, 19, 18, 22, 20],
        [12, 12, 10, 18, 7, 20],
      ]);
      cCelEllipse(ctx, 11, 12, 7.6, 5.8, '#c84ad4', '#681a72', '#ffa6ff', OUT, 2.2);
      cCelCircle(ctx, 21.5, 12, 5.0, '#9c36a8', '#4e1458', '#e68ef0', OUT, 2.2);
      cCircle(ctx, 26.8, 12, 2.2, '#ff3e7e', OUT, 1.2);
      cComicEye(ctx, 22.8, 9.6, 1.8, '#ffffff', '#050507', 0.2, OUT);
      cComicEye(ctx, 22.8, 14.4, 1.8, '#ffffff', '#050507', -0.2, OUT);
    },
    SPRITE_RES,
  );

  // 厄运紫蛞蝓（Curse Slug / Sea Pig：击杀永久 +1 诅咒与额外花蜜）44×32
  bake2D(
    scene,
    'curse_slug',
    44,
    32,
    (ctx) => {
      cContactShadow(ctx, 22, 19, 17, 10, 0.4);
      // 发光紫雾触须与背鳍
      for (const s of [-1, 1]) {
        cLine(ctx, [33, 16 + s * 4, 40.5, 16 + s * 9.5], OUT, 3.2);
        cLine(ctx, [33, 16 + s * 4, 40.5, 16 + s * 9.5], '#e078ff', 1.6);
        cCircle(ctx, 40.5, 16 + s * 9.5, 2.3, '#f6c8ff', OUT, 1.2);
      }
      // 软萌半透明深紫肉体
      cCelEllipse(ctx, 18, 16, 14.8, 9.2, '#8b32d8', '#3e106e', '#d998ff', OUT, 2.6);
      cCelCircle(ctx, 31, 16, 6.8, '#9e42ec', '#4a147c', '#e6b2ff', OUT, 2.5);
      // 背部神秘诅咒符文眼
      cPoly(ctx, [12, 16, 17.5, 11.8, 23, 16, 17.5, 20.2], '#24083c', OUT, 1.4);
      cCircle(ctx, 17.5, 16, 2.4, '#ff48b8');
      cComicEye(ctx, 34, 13.2, 2.2, '#ffe8ff', '#2a0846', 0, OUT);
      cComicEye(ctx, 34, 18.8, 2.2, '#ffe8ff', '#2a0846', 0, OUT);
    },
    SPRITE_RES,
  );

  // 滚球毛虫（Mummy：负击退抗性，超吃击退像台球一样弹射）42×40
  bake2D(
    scene,
    'mummy',
    42,
    40,
    (ctx) => {
      cContactShadow(ctx, 21, 23, 16, 13, 0.42);
      // 绷带绒毛滚球躯体
      cCelCircle(ctx, 21, 20, 14.6, '#d8c498', '#7e6844', '#fff6dc', OUT, 2.8);
      // 交叉绷带缠绕纹
      cLine(ctx, [9, 14, 33, 19], '#6e5838', 2.4);
      cLine(ctx, [10, 26, 32, 21], '#6e5838', 2.4);
      cLine(ctx, [16, 7, 22, 33], '#6e5838', 2.0);
      // 绷带缝隙里瞪圆的荧光青眼
      cEllipse(ctx, 27, 20, 4.6, 8.2, '#1c120a', OUT, 1.8);
      cComicEye(ctx, 27.4, 16.4, 2.4, '#8effe8', '#050507', 0.2, OUT);
      cComicEye(ctx, 27.4, 23.6, 2.4, '#8effe8', '#050507', -0.2, OUT);
    },
    SPRITE_RES,
  );

  // 曜石甲像（Gargoyle Elite：三阶段血量突变精英）68×58
  bake2D(
    scene,
    'gargoyle_elite',
    68,
    58,
    (ctx) => {
      cContactShadow(ctx, 33, 33, 27, 18, 0.48);
      // 展开的双层黑曜石蝠翼
      for (const s of [-1, 1]) {
        const y = (v: number) => 29 + (v - 29) * s;
        cPoly(ctx, [26, y(22), 14, y(5), 34, y(9), 42, y(19)], '#4c465e', OUT, 2.8);
        cPoly(ctx, [27, y(20), 19, y(9), 33, y(12), 38, y(19)], '#7c7498');
      }
      // 重石甲躯干 + 发光熔紫裂纹核心
      cCelEllipse(ctx, 25, 29, 15.5, 12.6, '#58526a', '#262234', '#9a92b4', OUT, 3.2);
      cPoly(ctx, [19, 29, 25, 22, 31, 29, 25, 36], '#ff3e7e', OUT, 1.8);
      cCircle(ctx, 25, 29, 3.2, '#ffe89c');
      // 犄角石雕头部
      cCelCircle(ctx, 44, 29, 10.2, '#625c76', '#2a263a', '#a69ec2', OUT, 3.0);
      for (const s of [-1, 1]) {
        const y = (v: number) => 29 + (v - 29) * s;
        cPoly(ctx, [46, y(21), 62, y(13), 55, y(24)], '#3a344c', OUT, 2.4);
      }
      // 炽热紫红怒眼
      cComicEye(ctx, 48.5, 24.4, 3.1, '#ff4874', '#fff29c', 0.38, OUT);
      cComicEye(ctx, 48.5, 33.6, 3.1, '#ff4874', '#fff29c', -0.38, OUT);
    },
    SPRITE_RES,
  );
}
