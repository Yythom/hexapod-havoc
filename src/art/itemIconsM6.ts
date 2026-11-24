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
  // 爆裂腺体：鼓胀橙红毒囊
  powdergland: (g) => {
    circle(g, 0x3a0c06, 24, 26, 15);
    circle(g, 0xe84824, 24, 26, 13);
    circle(g, 0xff9a3a, 21, 22, 7.5);
    circle(g, 0xffe484, 19, 20, 3);
    flame(g, 24, 14, 0.72);
  },
  // 复眼棱镜：六边蓝紫复眼晶体
  splitprism: (g) => {
    fillPoly(g, 0x1a1238, [24, 6, 40, 15, 40, 33, 24, 42, 8, 33, 8, 15]);
    fillPoly(g, 0x56c8ff, [24, 9, 37, 16.5, 24, 24, 11, 16.5]);
    fillPoly(g, 0xa868ff, [24, 24, 37, 16.5, 37, 31.5, 24, 39]);
    fillPoly(g, 0x7a96ff, [24, 24, 11, 16.5, 11, 31.5, 24, 39]);
    circle(g, 0xffffff, 24, 22, 3.2);
  },
  // 暴击火花：金色星芒火团
  critbolt: (g) => {
    fillPoly(g, 0x4a2804, [24, 4, 29, 18, 44, 24, 29, 30, 24, 44, 19, 30, 4, 24, 19, 18]);
    fillPoly(g, 0xffc828, [24, 7, 28, 19, 41, 24, 28, 29, 24, 41, 20, 29, 7, 24, 20, 19]);
    circle(g, 0xffffff, 24, 24, 4.2);
  },
  // 采蜜连弩：木质小弩 + 金蜜箭
  nectargun: (g) => {
    line(g, 3.2, 0x5a3412, [10, 34, 34, 12]);
    line(g, 3.4, 0x9a5c22, [12, 16, 32, 36]);
    line(g, 1.4, 0xffe4a0, [13, 17, 15, 33, 31, 35]);
    fillPoly(g, 0xffc828, [30, 10, 41, 7, 38, 18]);
  },
  // 嗜血狂颚：沾血红黑大颚
  bloodrage: (g) => {
    for (const s of [-1, 1]) {
      fillPoly(g, 0x260606, [24 + s * 14, 38, 24 + s * 16, 18, 24 + s * 5, 8, 24 + s * 8, 26]);
      fillPoly(g, 0xe02828, [24 + s * 12, 35, 24 + s * 13.5, 19, 24 + s * 6, 11, 24 + s * 8, 25]);
    }
    circle(g, 0xff8080, 24, 24, 3.5);
  },
  // 玻璃翼膜：透明青白薄翅
  glasswing: (g) => {
    fillEllipse(g, 0x204868, 17, 23, 11, 17, -0.35, 0.7);
    fillEllipse(g, 0x9ae8ff, 17, 23, 9, 15, -0.35, 0.65);
    fillEllipse(g, 0x204868, 31, 23, 11, 17, 0.35, 0.7);
    fillEllipse(g, 0x9ae8ff, 31, 23, 9, 15, 0.35, 0.65);
    line(g, 2, 0xffffff, [12, 14, 20, 22]);
    line(g, 2, 0xffffff, [36, 14, 28, 22]);
  },
  // 重甲壁垒：厚重青钢甲盾
  ironmantle: (g) => {
    fillPoly(g, 0x10141c, [9, 10, 39, 10, 36, 31, 24, 42, 12, 31]);
    fillPoly(g, 0x5c6e88, [12, 13, 36, 13, 33.5, 29.5, 24, 39, 14.5, 29.5]);
    line(g, 2.2, 0xb8d4f0, [16, 16, 32, 16]);
    circle(g, 0xffc848, 24, 25, 4);
  },
  // 引虫香囊：发光绿紫诱虫香包
  swarmlure: (g) => {
    fillEllipse(g, 0x2a1438, 24, 28, 13, 13);
    fillEllipse(g, 0x8e3cb0, 24, 28, 11, 11);
    fillPoly(g, 0xd8a840, [19, 16, 29, 16, 26, 11, 22, 11]);
    circle(g, 0xb8ff58, 20, 27, 2.4);
    circle(g, 0xb8ff58, 28, 29, 2.0);
    circle(g, 0xb8ff58, 24, 22, 1.8);
  },
  // 溢出蜂晶：金光六角蜜晶
  overhealcore: (g) => {
    fillPoly(g, 0x5a3204, [24, 6, 39, 15, 39, 33, 24, 42, 9, 33, 9, 15]);
    fillPoly(g, 0xffb824, [24, 9, 36, 16.5, 36, 31.5, 24, 39, 12, 31.5, 12, 16.5]);
    fillPoly(g, 0xfff4a8, [24, 13, 31, 18, 24, 24, 17, 18]);
  },
  // 独行甲刃：孤月弯刀
  lonewolf: (g) => {
    fillPoly(g, 0x18141c, [10, 38, 18, 22, 36, 8, 30, 28, 14, 40]);
    fillPoly(g, 0xd8e2f0, [12, 36, 20, 23, 34, 10, 28, 26]);
    line(g, 2.4, 0xff5a38, [10, 38, 16, 32]);
  },
  // 复合炮心：蓝金机械炮核
  turretprism: (g) => {
    circle(g, 0x1a2232, 24, 24, 15);
    circle(g, 0x3b6ca8, 24, 24, 12);
    circle(g, 0x74e8ff, 24, 24, 6.5);
    circle(g, 0xffffff, 22, 22, 2.5);
  },
  // 吸血毒牙：一对弯牙滴红珠
  vampfang: (g) => {
    for (const x of [16, 32]) {
      fillPoly(g, 0x20080a, [x - 5, 10, x + 5, 10, x, 34]);
      fillPoly(g, 0xf8f0e4, [x - 3, 12, x + 3, 12, x, 30]);
      circle(g, 0xe82038, x, 36, 3.2);
    }
  },
  // 跳弹翅鞘：带折线弹道的金翅
  ricochetwing: (g) => {
    fillEllipse(g, 0x3a2008, 22, 26, 14, 10, -0.4);
    fillEllipse(g, 0xe8a434, 22, 26, 12, 8, -0.4);
    line(g, 2.4, 0xfff088, [8, 36, 22, 16, 38, 26, 42, 10]);
  },
  // 丰收祭坛：金穗石台
  harvestaltar: (g) => {
    fillPoly(g, 0x2a241c, [10, 38, 38, 38, 34, 24, 14, 24]);
    fillPoly(g, 0x82786a, [12, 36, 36, 36, 33, 26, 15, 26]);
    for (const x of [18, 24, 30]) {
      line(g, 2.2, 0xf0b832, [x, 26, x, 10]);
      circle(g, 0xffe478, x, 11, 2.4);
    }
  },
  // 巨虫血清：紫金强化针管
  giantscarab: (g) => {
    fillPoly(g, 0x1c0e2c, [14, 34, 28, 12, 36, 20, 22, 42]);
    fillPoly(g, 0xb858f0, [16, 33, 28, 15, 33, 20, 21, 38]);
    line(g, 2.4, 0xd8e0e8, [32, 16, 40, 8]);
    circle(g, 0xffd44c, 24, 26, 3);
  },
  // 引力心核：磁力发光心核
  magnetheart: (g) => {
    circle(g, 0x1a1e38, 24, 24, 15);
    circle(g, 0x3a64c8, 24, 24, 12.5);
    circle(g, 0xff5a6a, 24, 24, 6.5);
    line(g, 1.8, 0x9ce8ff, [7, 24, 12, 24]);
    line(g, 1.8, 0x9ce8ff, [36, 24, 41, 24]);
  },
  // 幽灵蝉蜕：半透明幽蓝鬼火蝉壳
  weirdghost: (g) => {
    fillEllipse(g, 0x56d8ff, 24, 24, 17, 17, 0, 0.18);
    fillPoly(g, 0x162436, [13, 38, 12, 22, 18, 10, 30, 10, 36, 22, 35, 38, 29, 34, 24, 39, 19, 34]);
    fillPoly(g, 0xb8f0ff, [15, 35, 14, 22, 19, 12, 29, 12, 34, 22, 33, 35, 29, 32, 24, 36, 19, 32]);
    circle(g, 0x141c2c, 20, 21, 2.8);
    circle(g, 0x141c2c, 28, 21, 2.8);
    circle(g, 0xffffff, 19.3, 20.2, 1);
    circle(g, 0xffffff, 27.3, 20.2, 1);
  },
  // 存蜜猪猪罐：圆滚滚粉金存钱罐 + 顶部投币口
  piggybank: (g) => {
    fillEllipse(g, 0x000000, 24, 40, 15, 4, 0, 0.3);
    fillEllipse(g, 0x5c2434, 24, 27, 16, 12.5);
    fillEllipse(g, 0xf290a8, 24, 26, 14, 10.5);
    fillEllipse(g, 0xffbfd0, 20, 22, 7, 4, -0.2, 0.7);
    fillEllipse(g, 0xd86882, 36, 27, 5, 4);
    circle(g, 0x421622, 35, 26, 1.1);
    circle(g, 0x421622, 37.5, 26, 1.1);
    line(g, 3, 0x30141c, [19, 16, 28, 16]);
    circle(g, 0xffd44c, 24, 11, 4.5);
    circle(g, 0xfff3a8, 23, 10, 2);
  },
  // 诱饵甜果：钩在铁钩上的鲜红甜果
  bait: (g) => {
    line(g, 2.6, 0x9aa8b8, [24, 6, 24, 17]);
    line(g, 2.6, 0x9aa8b8, [24, 34, 28, 41, 35, 36]);
    circle(g, 0x4a1014, 23, 26, 11.5);
    circle(g, 0xe83842, 23, 26, 9.5);
    circle(g, 0xff8a7a, 19.5, 22.5, 3.2);
    fillPoly(g, 0x58c448, [23, 16, 30, 11, 29, 17]);
  },
  // 献血蜜腺：琥珀玻璃血袋 + 滴落猩红珠
  blooddonation: (g) => {
    fillPoly(g, 0x261016, [13, 12, 35, 12, 36, 36, 12, 36]);
    fillPoly(g, 0x4a1e28, [15, 14, 33, 14, 34, 34, 14, 34]);
    fillPoly(g, 0xdc2638, [15, 22, 33, 22, 34, 34, 14, 34]);
    line(g, 3, 0xffd0d8, [24, 19, 24, 29]);
    line(g, 3, 0xffd0d8, [19, 24, 29, 24]);
    line(g, 2.4, 0xc8d2dc, [24, 6, 24, 12]);
    circle(g, 0xff4658, 24, 41, 3.2);
  },
  // 孔雀尾羽：翠绿金蓝眼斑翎羽
  peacock: (g) => {
    line(g, 2.4, 0xc8a458, [24, 43, 24, 12]);
    fillEllipse(g, 0x165a44, 24, 20, 13, 15);
    fillEllipse(g, 0x28b882, 24, 19, 10, 12);
    fillEllipse(g, 0xf2c238, 24, 18, 6.8, 8);
    fillEllipse(g, 0x1e48b8, 24, 18, 4.4, 5.2);
    circle(g, 0x0b1026, 24, 19, 2.2);
    circle(g, 0x8ef2ff, 22.8, 17.5, 1.1);
  },
  // 力量三角：发光黄金黑墨符文三角
  powertriangle: (g) => {
    fillPoly(g, 0x261806, [24, 6, 42, 39, 6, 39]);
    fillPoly(g, 0xf0b228, [24, 10, 39, 37, 9, 37]);
    fillPoly(g, 0x2a1c08, [24, 18, 32, 33, 16, 33]);
    fillPoly(g, 0xfff09a, [24, 21, 29, 31, 19, 31]);
  },
  // 猎手战利品：黄金奖杯 + 暴击红星
  huntingtrophy: (g) => {
    fillPoly(g, 0x3a2408, [17, 40, 31, 40, 29, 35, 19, 35]);
    line(g, 4, 0xd89620, [24, 35, 24, 27]);
    fillPoly(g, 0x422806, [11, 10, 37, 10, 34, 26, 24, 30, 14, 26]);
    fillPoly(g, 0xf6c234, [13, 12, 35, 12, 32, 24, 24, 28, 16, 24]);
    circle(g, 0xff5a48, 24, 19, 3.6);
    circle(g, 0xfff6c0, 23, 18, 1.4);
  },
  // 复刻魔镜：紫金雕花椭圆镜面 + 斜光反射
  mirror: (g) => {
    fillEllipse(g, 0x3a2252, 24, 24, 14.5, 18);
    fillEllipse(g, 0xd8a840, 24, 24, 13, 16.5);
    fillEllipse(g, 0x5cc4f8, 24, 24, 9.8, 13.2);
    line(g, 3.2, 0xffffff, [18, 17, 25, 13]);
    line(g, 2.2, 0xdff8ff, [17, 25, 29, 18]);
    circle(g, 0xffe880, 24, 8, 2.4);
  },
  // 血色巨钳：猩红发光大螯钳
  bloodyhand: (g) => {
    fillPoly(g, 0x26060a, [12, 38, 10, 20, 18, 8, 23, 14, 18, 23, 24, 28, 30, 23, 25, 14, 30, 8, 38, 20, 36, 38]);
    fillPoly(g, 0xd81e34, [14, 36, 12, 21, 18, 11, 21, 16, 16, 24, 24, 30, 32, 24, 27, 16, 30, 11, 36, 21, 34, 36]);
    fillPoly(g, 0xff6e78, [16, 20, 19, 13, 20, 18]);
    fillPoly(g, 0xff6e78, [32, 20, 29, 13, 28, 18]);
    circle(g, 0xff2840, 24, 41, 2.6);
  },
  // 苦痛虫壳：荆棘缠绕的暗紫黑甲壳
  torture: (g) => {
    fillEllipse(g, 0x1c0c20, 24, 25, 15, 16);
    fillEllipse(g, 0x562458, 24, 25, 12.5, 13.5);
    line(g, 2.4, 0xd8a8d8, [12, 18, 36, 26]);
    line(g, 2.4, 0xd8a8d8, [12, 30, 36, 20]);
    for (const [x, y] of [[14, 15], [34, 17], [13, 33], [35, 31], [24, 10]]) {
      circle(g, 0xff4c58, x, y, 2.2);
    }
    circle(g, 0x62f078, 24, 25, 3.8);
  },
  // 炽翼靴：带火焰翼纹的冲刺铁靴
  dashflame: (g) => {
    fillPoly(g, 0x261006, [12, 36, 14, 18, 24, 16, 28, 28, 38, 30, 38, 38, 12, 38]);
    fillPoly(g, 0x8e3a18, [14, 35, 16, 20, 23, 18, 26, 29, 36, 31, 36, 36, 14, 36]);
    flame(g, 16, 19, 0.72);
    line(g, 2.2, 0xffd44c, [24, 24, 34, 15, 39, 19]);
  },
  // 双节跃足：弹力节肢机械足 + 闪光残影
  dashcharge: (g) => {
    line(g, 4.5, 0x162436, [11, 36, 20, 22, 32, 26, 39, 12]);
    line(g, 2.4, 0x5cd8ff, [11, 36, 20, 22, 32, 26, 39, 12]);
    line(g, 1.8, 0xc8f4ff, [7, 30, 15, 18, 26, 21]);
    circle(g, 0xffe468, 20, 22, 3.4);
    circle(g, 0xffe468, 32, 26, 3.4);
  },
  // 回旋羽翼：一对旋风斩羽翅
  dashvolley: (g) => {
    for (const s of [-1, 1]) {
      fillEllipse(g, 0x163828, 24 + s * 10, 24, 11, 6, s * -0.55);
      fillEllipse(g, 0x62e898, 24 + s * 10, 24, 9, 4.2, s * -0.55);
    }
    circle(g, 0xd8ffe8, 24, 24, 4.2);
    line(g, 1.8, 0xffffff, [12, 12, 24, 24, 36, 12]);
  },
};
