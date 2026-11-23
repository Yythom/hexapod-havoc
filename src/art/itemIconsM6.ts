import { circle, fillEllipse, fillPoly, line, type DrawFn, type G } from './draw';

/** M6 新增的 15 件道具图标：48×48 的空间里绘制，规格同 itemIcons.ts */

function flame(g: G, x: number, y: number, s: number): void {
  fillPoly(g, 0xc8401a, [x, y - 16 * s, x + 9 * s, y - 2 * s, x + 7 * s, y + 7 * s, x, y + 10 * s, x - 7 * s, y + 7 * s, x - 9 * s, y - 2 * s]);
  fillPoly(g, 0xf08a28, [x, y - 11 * s, x + 6 * s, y, x + 4.5 * s, y + 6 * s, x, y + 8 * s, x - 4.5 * s, y + 6 * s, x - 6 * s, y]);
  fillPoly(g, 0xffe070, [x, y - 4 * s, x + 3 * s, y + 3 * s, x, y + 6.5 * s, x - 3 * s, y + 3 * s]);
}

function crystal(g: G, x: number, y: number, len: number, ang: number, color: number): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const p = (a: number, b: number) => [x + a * c - b * s, y + a * s + b * c];
  fillPoly(g, 0x1e5a8a, [...p(0, -3.6), ...p(len, 0), ...p(0, 3.6), ...p(-2, 0)]);
  fillPoly(g, color, [...p(0.8, -2.4), ...p(len - 2, 0), ...p(0.8, 2.4)]);
}

export const M6_ITEM_ICONS: Record<string, DrawFn> = {
  // 火绒：一团干草绒上冒出小火苗
  tinder: (g) => {
    fillEllipse(g, 0x6a4a1e, 24, 35, 16, 7);
    fillEllipse(g, 0xc8a050, 24, 33, 14, 5.5);
    for (const [x0, y0, x1, y1] of [[12, 33, 20, 30], [18, 36, 28, 31], [26, 35, 35, 32], [14, 31, 24, 29]]) line(g, 1.4, 0x8a6a2a, [x0, y0, x1, y1]);
    flame(g, 24, 24, 0.9);
  },
  // 余烬：烧红的炭块
  ember: (g) => {
    fillEllipse(g, 0x000000, 25, 32, 15, 7, 0, 0.3);
    fillPoly(g, 0x2a1408, [10, 30, 16, 19, 30, 16, 39, 24, 36, 34, 20, 36]);
    fillPoly(g, 0xc83a14, [15, 28, 19, 22, 29, 20, 34, 25, 31, 31, 20, 32]);
    fillPoly(g, 0xff9a3a, [20, 26, 25, 23, 30, 26, 26, 29]);
    circle(g, 0xffe070, 25, 26, 2);
    for (const [x, y] of [[14, 12], [30, 9], [36, 14]]) circle(g, 0xff9a3a, x, y, 1.6);
  },
  // 冰晶：放射状的冰晶簇
  icecrystal: (g) => {
    fillEllipse(g, 0x9ae0ff, 24, 24, 18, 18, 0, 0.15);
    for (const a of [-1.57, -0.5, 0.6, 1.7, 2.7, 3.8]) crystal(g, 24, 26, 15, a, 0xbfefff);
    circle(g, 0xffffff, 24, 26, 3.4);
  },
  // 霜花：六瓣冰花
  frostflower: (g) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      line(g, 3.4, 0x3a8ac8, [24, 24, 24 + Math.cos(a) * 17, 24 + Math.sin(a) * 17]);
      line(g, 1.6, 0xdff6ff, [24, 24, 24 + Math.cos(a) * 16, 24 + Math.sin(a) * 16]);
      for (const t of [9, 13]) {
        const bx = 24 + Math.cos(a) * t;
        const by = 24 + Math.sin(a) * t;
        for (const d of [-0.7, 0.7]) line(g, 1.4, 0xbfefff, [bx, by, bx + Math.cos(a + d) * 4.5, by + Math.sin(a + d) * 4.5]);
      }
    }
    circle(g, 0x9ae0ff, 24, 24, 4.4);
    circle(g, 0xffffff, 23, 23, 1.8);
  },
  // 铜线：绕成圈的铜丝
  copperwire: (g) => {
    for (let k = 0; k < 5; k++) {
      const x = 12 + k * 6;
      fillEllipse(g, 0x6a3a12, x, 24, 5, 12, 0.25);
      fillEllipse(g, 0x1c150d, x, 24, 3, 9.6, 0.25);
    }
    for (let k = 0; k < 5; k++) line(g, 1.2, 0xf0a868, [9 + k * 6, 14, 12 + k * 6, 13]);
    line(g, 2.6, 0xc87a34, [6, 34, 2, 40]);
    line(g, 2.6, 0xc87a34, [42, 14, 46, 8]);
    line(g, 1.6, 0xfff0a0, [44, 9, 47, 5]);
  },
  // 避雷针：细铁杆顶着一道闪电
  lightningrod: (g) => {
    line(g, 3.2, 0x3a3a4a, [24, 44, 24, 16]);
    line(g, 1.4, 0xa8a8c0, [23, 44, 23, 17]);
    fillPoly(g, 0x6a6a80, [20, 18, 24, 10, 28, 18]);
    fillEllipse(g, 0x5a4a3a, 24, 44, 10, 3);
    fillPoly(g, 0xffe468, [30, 2, 22, 14, 27, 14, 20, 26, 33, 11, 28, 11, 35, 2]);
    fillPoly(g, 0xffffff, [30, 4, 25, 12, 28, 12, 25, 19]);
  },
  // 蚁丘图纸：卷起一角的设计图
  blueprint: (g) => {
    fillPoly(g, 0x1a3a6a, [7, 9, 41, 7, 42, 39, 8, 41]);
    fillPoly(g, 0x3a6ab8, [9, 11, 39, 9.5, 40, 37, 10, 39]);
    for (let k = 0; k < 4; k++) line(g, 0.8, 0x6a9ad8, [10, 16 + k * 6, 39, 15 + k * 6]);
    // 图上画着一个蚁丘
    fillPoly(g, 0xdff0ff, [14, 32, 24, 16, 34, 32]);
    fillPoly(g, 0x3a6ab8, [17, 30, 24, 20, 31, 30]);
    circle(g, 0xdff0ff, 24, 27, 2.4);
    fillPoly(g, 0xb8d8f8, [32, 39, 40, 37, 39, 31]);
  },
  // 齿轮
  gear: (g) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const p = (r: number, w: number) => [24 + c * r - s * w, 24 + s * r + c * w];
      fillPoly(g, 0x5a4a32, [...p(12, -4), ...p(19, -3), ...p(19, 3), ...p(12, 4)]);
    }
    circle(g, 0x5a4a32, 24, 24, 15);
    circle(g, 0xb8955a, 24, 24, 13);
    circle(g, 0xe0c080, 21, 21, 5, 0.6);
    circle(g, 0x3a2e1e, 24, 24, 5);
    circle(g, 0x1c150d, 24, 24, 3);
  },
  // 弹簧
  spring: (g) => {
    fillEllipse(g, 0x000000, 25, 42, 12, 3, 0, 0.3);
    for (let k = 0; k < 6; k++) {
      const y = 38 - k * 5.4;
      fillEllipse(g, 0x5a6a7a, 24, y, 11, 3.2);
      fillEllipse(g, 0x1c150d, 24, y - 0.6, 8.6, 1.8);
      line(g, 1.2, 0xd8e4f0, [15, y - 1.4, 22, y - 2.8]);
    }
    fillEllipse(g, 0x9aaabb, 24, 8, 11, 3.2);
    fillEllipse(g, 0x5a6a7a, 24, 8, 7, 1.6);
  },
  // 工蚁队长：戴着小头盔的工蚁
  antcaptain: (g) => {
    fillEllipse(g, 0x000000, 24, 40, 15, 4, 0, 0.3);
    for (const [x0, x1] of [[17, 12], [24, 24], [30, 36]]) {
      line(g, 2, 0x4a2a08, [x0, 30, x1, 40]);
    }
    fillEllipse(g, 0x6a3e0c, 13, 30, 8, 7);
    fillEllipse(g, 0xc88a30, 12, 29, 6.6, 5.6);
    fillEllipse(g, 0xc88a30, 24, 30, 5, 4.2);
    circle(g, 0x6a3e0c, 33, 26, 7.4);
    circle(g, 0xd89a40, 33, 26, 6);
    // 头盔
    fillPoly(g, 0x3a6a3a, [25, 22, 27, 14, 33, 11, 39, 14, 41, 22]);
    fillPoly(g, 0x6aaa5a, [28, 20, 29, 15, 33, 13, 37, 15, 38, 20]);
    line(g, 2, 0x2a4a2a, [24, 22, 42, 22]);
    circle(g, 0x140a02, 36, 26, 1.4);
    line(g, 1.4, 0x3a2006, [38, 24, 44, 18]);
  },
  // 蜂蜡：一块六边形蜡块
  beeswax: (g) => {
    fillPoly(g, 0x8a6a14, [24, 7, 39, 15.5, 39, 32.5, 24, 41, 9, 32.5, 9, 15.5]);
    fillPoly(g, 0xf0d060, [24, 10, 36.5, 17, 36.5, 31, 24, 38, 11.5, 31, 11.5, 17]);
    fillPoly(g, 0xfff0a8, [24, 10, 36.5, 17, 24, 24, 11.5, 17]);
    line(g, 1, 0xc8a030, [24, 24, 24, 38]);
    line(g, 1, 0xc8a030, [24, 24, 36.5, 17]);
    line(g, 1, 0xc8a030, [24, 24, 11.5, 17]);
  },
  // 蜂巢药剂：装着蜂蜜的小药瓶
  honeypotion: (g) => {
    fillEllipse(g, 0x000000, 25, 43, 12, 3, 0, 0.3);
    fillPoly(g, 0x2a1a08, [19, 8, 29, 8, 29, 16, 37, 26, 37, 40, 11, 40, 11, 26, 19, 16]);
    fillPoly(g, 0xd8e8e8, [20.5, 9.5, 27.5, 9.5, 27.5, 17, 35.5, 27, 35.5, 38.5, 12.5, 38.5, 12.5, 27, 20.5, 17]);
    fillPoly(g, 0xf0a820, [13, 28, 35, 28, 35, 38, 13, 38]);
    fillPoly(g, 0xffd860, [13, 28, 35, 28, 33, 31, 15, 31]);
    fillPoly(g, 0x8a5a20, [18, 4, 30, 4, 30, 9, 18, 9]);
    // 瓶身上的小蜂巢标记
    fillPoly(g, 0xfff0a8, [24, 30.5, 27, 32.2, 27, 35.6, 24, 37.3, 21, 35.6, 21, 32.2]);
    line(g, 1.4, 0xffffff, [15, 20, 15, 26], 0.6);
  },
  // 破甲钳：一把夹碎甲片的钳子
  armorclamp: (g) => {
    fillPoly(g, 0x4a2208, [8, 30, 20, 24, 30, 30, 20, 38]);
    fillPoly(g, 0xe8832a, [10, 30, 20, 25.5, 28, 30, 20, 36]);
    line(g, 1.2, 0x4a2208, [17, 27, 22, 33]);
    line(g, 1.2, 0x4a2208, [21, 26.5, 18, 31]);
    for (const s of [1, -1]) {
      const y = (v: number) => 24 + (v - 24) * s;
      line(g, 5, 0x3a3a4a, [40, y(32), 30, y(26), 22, y(24)]);
      line(g, 2, 0x9aa0b8, [39, y(31), 30, y(25.5), 23, y(23.6)]);
    }
    circle(g, 0x2a2a38, 31, 24, 3.4);
    circle(g, 0xb8bed4, 30.4, 23.4, 1.2);
  },
  // 战利品袋：鼓鼓的布袋，口子露出花蜜
  lootbag: (g) => {
    fillEllipse(g, 0x000000, 25, 42, 14, 3.4, 0, 0.3);
    fillEllipse(g, 0x5a3a18, 24, 30, 15, 12);
    fillEllipse(g, 0xa8783a, 23, 29, 13, 10.4);
    fillEllipse(g, 0xd8a860, 19, 25, 5, 3, -0.4, 0.6);
    fillPoly(g, 0x5a3a18, [17, 19, 31, 19, 28, 14, 20, 14]);
    line(g, 2.4, 0xc83a2a, [17, 19, 31, 19]);
    for (const [x, y] of [[20, 11], [26, 9], [30, 12]]) {
      circle(g, 0x8a5a08, x, y, 3.6);
      circle(g, 0xffc83a, x, y, 2.8);
      circle(g, 0xfff4b0, x - 0.8, y - 0.8, 0.9);
    }
  },
  // 旋风叶：绕成漩涡的叶子
  whirlleaf: (g) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const x = 24 + Math.cos(a) * 9;
      const y = 24 + Math.sin(a) * 9;
      fillEllipse(g, 0x2a5a1e, x, y, 11, 5, a + 1.2);
      fillEllipse(g, 0x7ac84a, x, y, 9.6, 3.8, a + 1.2);
      line(g, 1, 0x3f7a2a, [x - Math.cos(a + 1.2) * 8, y - Math.sin(a + 1.2) * 8, x + Math.cos(a + 1.2) * 8, y + Math.sin(a + 1.2) * 8]);
    }
    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * Math.PI * 2 + 0.6;
      const pts: number[] = [];
      for (let t = 0; t <= 6; t++) {
        const a = a0 + t * 0.22;
        const r = 18 + t * 0.6;
        pts.push(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
      }
      line(g, 1.6, 0xdff0ff, pts, 0.8);
    }
    circle(g, 0x9ad070, 24, 24, 3);
  },
};
