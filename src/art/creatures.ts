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
}
