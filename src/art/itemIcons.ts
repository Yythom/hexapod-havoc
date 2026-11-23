import { circle, fillEllipse, fillPoly, line, type DrawFn, type G } from './draw';

/** 40 件道具的图标：48×48 的空间里绘制，烘焙成 2 倍大小 */

function pebble(g: G, x: number, y: number, r: number, base = 0x8f8b7e): void {
  fillEllipse(g, 0x000000, x + 1.5, y + 2, r, r * 0.8, 0, 0.3);
  fillEllipse(g, 0x5f5c52, x, y, r, r * 0.8);
  fillEllipse(g, base, x - r * 0.1, y - r * 0.12, r * 0.8, r * 0.6);
  fillEllipse(g, 0xc9c4b2, x - r * 0.35, y - r * 0.3, r * 0.3, r * 0.2, 0, 0.8);
}

function shell(g: G, cx: number, cy: number, s: number, base: number, light: number): void {
  const p = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? cx + (v - 24) * s : cy + (v - 24) * s));
  fillPoly(g, 0x4a2208, p([10, 12, 24, 6, 38, 12, 37, 30, 24, 42, 11, 30]));
  fillPoly(g, base, p([12.5, 13.5, 24, 8.6, 35.5, 13.5, 34.6, 29, 24, 39, 13.4, 29]));
  fillPoly(g, light, p([14, 15, 24, 10.5, 30, 13, 16, 22]), 0.6);
}

function drop(g: G, x: number, y: number, r: number, outer: number, inner: number): void {
  circle(g, outer, x, y, r + 1.4);
  fillPoly(g, outer, [x, y - r * 2.1, x - r - 1.2, y - 0.2, x + r + 1.2, y - 0.2]);
  circle(g, inner, x, y, r);
  fillPoly(g, inner, [x, y - r * 1.8, x - r, y, x + r, y]);
  fillEllipse(g, 0xffffff, x - r * 0.4, y - r * 0.1, r * 0.25, r * 0.4, 0.2, 0.8);
}

export const ITEM_ICONS: Record<string, DrawFn> = {
  // ---------- 普通 ----------
  leaf: (g) => {
    fillEllipse(g, 0x2f5a1e, 25, 23, 19, 10, -0.75);
    fillEllipse(g, 0x6fbf45, 25, 23, 17, 8.4, -0.75);
    fillEllipse(g, 0x9be070, 21, 20, 8, 3, -0.75, 0.7);
    line(g, 1.6, 0x3f7a2a, [12.6, 34.6, 37.4, 11.4]);
    line(g, 2.4, 0x3f7a2a, [12.6, 34.6, 7, 41]);
  },
  dew: (g) => drop(g, 24, 29, 12.5, 0x1f5a8a, 0x6cc6f0),
  plate: (g) => {
    shell(g, 24, 24, 1, 0xe8832a, 0xffc074);
    line(g, 1.4, 0x9c4a10, [24, 9, 24, 39]);
  },
  whetstone: (g) => {
    fillEllipse(g, 0x3a3830, 22, 29, 17, 10, -0.35);
    fillEllipse(g, 0x8f8b7e, 22, 28, 15.5, 8.5, -0.35);
    fillEllipse(g, 0xb8b3a3, 18, 25, 7, 2.6, -0.35, 0.8);
    line(g, 2, 0xffe27a, [34, 11, 40, 5]);
    line(g, 2, 0xffe27a, [37, 17, 44, 15]);
    line(g, 2, 0xffe27a, [30, 9, 31, 3]);
  },
  pollen: (g) => {
    circle(g, 0xb88a10, 24, 24, 14);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      circle(g, 0xf2c230, 24 + Math.cos(a) * 12.5, 24 + Math.sin(a) * 12.5, 4);
    }
    circle(g, 0xffd84a, 24, 24, 11);
    for (const [x, y] of [[20, 21], [27, 26], [24, 31], [29, 19], [18, 28]]) circle(g, 0xc99a10, x, y, 1.6);
  },
  antenna: (g) => {
    for (const s of [1, -1]) {
      const x = (v: number) => 24 + (v - 24) * s;
      const pts = [x(21), 36, x(18), 26, x(13), 17, x(9), 10, x(7), 5];
      line(g, 2.4, 0x2e1406, pts);
      circle(g, 0x2e1406, x(7), 5, 3);
    }
    fillEllipse(g, 0x2e1406, 24, 40, 9, 6);
    fillEllipse(g, 0x8f4515, 24, 39.5, 7.5, 4.8);
  },
  clover: (g) => {
    line(g, 2.6, 0x3f7a2a, [24, 28, 27, 44]);
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 3;
      circle(g, 0x2f6a24, 24 + Math.cos(a) * 9, 26 + Math.sin(a) * 9, 9);
    }
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 3;
      circle(g, 0x5fae48, 24 + Math.cos(a) * 9, 26 + Math.sin(a) * 9, 7.6);
    }
  },
  wing: (g) => {
    fillEllipse(g, 0x7aa0b8, 24, 24, 20, 10, -0.6, 0.95);
    fillEllipse(g, 0xe2f2fa, 24, 24, 18.5, 8.6, -0.6, 0.9);
    line(g, 1.2, 0x7aa0b8, [9.5, 34, 38.5, 14]);
    line(g, 1, 0x7aa0b8, [18, 28, 21, 18]);
    line(g, 1, 0x7aa0b8, [26, 22, 33, 25]);
  },
  spikes: (g) => {
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 - 0.8 + k * 0.4;
      const tx = 24 + Math.cos(a) * 30;
      const ty = 40 + Math.sin(a) * 30;
      const px = -Math.sin(a) * 4.5;
      const py = Math.cos(a) * 4.5;
      fillPoly(g, 0x5a1a10, [24 + px, 40 + py, tx, ty, 24 - px, 40 - py]);
    }
    fillEllipse(g, 0x3a1206, 24, 41, 14, 5);
  },
  pebbles: (g) => {
    pebble(g, 16, 31, 9);
    pebble(g, 32, 33, 7);
    pebble(g, 25, 18, 6.5);
  },
  sourberry: (g) => {
    line(g, 2, 0x5a4a20, [24, 14, 27, 6]);
    fillEllipse(g, 0x3f8a2a, 31, 8, 6, 3, -0.4);
    circle(g, 0x2a5a10, 24, 28, 14);
    circle(g, 0xa8d838, 24, 28, 12.5);
    circle(g, 0xe0f8a0, 19, 23, 3.5, 0.8);
    for (const [x, y] of [[28, 32], [21, 33], [30, 25]]) circle(g, 0x7aa828, x, y, 1.5);
  },
  resin: (g) => {
    circle(g, 0x7a3a06, 26, 10, 5);
    fillEllipse(g, 0x7a3a06, 24, 27, 15, 16.5);
    circle(g, 0xd98a1a, 26, 10, 3.6);
    fillEllipse(g, 0xd98a1a, 24, 27, 13.5, 15);
    fillEllipse(g, 0xf2b54a, 22, 24, 8, 9, 0, 0.8);
  },
  honeydew: (g) => {
    fillEllipse(g, 0x2f6a1e, 18, 28, 12, 9);
    fillEllipse(g, 0x8ad85a, 18, 28, 10.5, 7.5);
    circle(g, 0x2f6a1e, 29, 27, 4.6);
    circle(g, 0x5aa03a, 29, 27, 3.6);
    circle(g, 0xc77d00, 37, 16, 7);
    circle(g, 0xffbd1f, 37, 16, 5.8);
    circle(g, 0xfff6c8, 35, 14, 2);
  },
  fluff: (g) => {
    line(g, 1.4, 0xd8d0b8, [24, 37, 24, 18]);
    fillEllipse(g, 0x6b4a2a, 24, 40, 2.5, 5);
    for (let k = 0; k <= 10; k++) {
      const a = -Math.PI + (k * Math.PI) / 10;
      const x = 24 + Math.cos(a) * 15;
      const y = 17 + Math.sin(a) * 13;
      line(g, 1.2, 0xf4f0e6, [24, 17, x, y]);
      circle(g, 0xffffff, x, y, 1.8);
    }
  },
  slime: (g) => {
    fillEllipse(g, 0x9ad8c0, 22, 38, 20, 5, 0, 0.6);
    fillEllipse(g, 0xc8b890, 17, 35, 11, 4.5);
    circle(g, 0x5a3412, 28, 24, 13);
    circle(g, 0xb87a3a, 28, 24, 11.5);
    g.lineStyle(2, 0x5a3412, 1);
    g.strokeCircle(29, 24, 7);
    g.strokeCircle(30, 24, 3.2);
  },
  spots: (g) => {
    fillEllipse(g, 0x1a0806, 24, 11, 8, 5);
    circle(g, 0x3a0a08, 24, 27, 15);
    circle(g, 0xd8302a, 24, 27, 13.5);
    line(g, 1.6, 0x3a0a08, [24, 13, 24, 41]);
    for (const [x, y, r] of [[18, 22, 3], [30, 22, 3], [17, 32, 2.6], [31, 32, 2.6]]) circle(g, 0x1a0806, x, y, r);
  },

  // ---------- 精良 ----------
  kneepad: (g) => {
    g.fillStyle(0x4a2208, 1);
    g.fillRoundedRect(10, 8, 28, 32, 10);
    g.fillStyle(0xb05a1a, 1);
    g.fillRoundedRect(12.5, 10.5, 23, 27, 8);
    circle(g, 0x4a2208, 24, 24, 7);
    circle(g, 0xe8832a, 24, 24, 5.6);
    line(g, 2, 0x4a2208, [12, 16, 36, 16]);
    line(g, 2, 0x4a2208, [12, 32, 36, 32]);
  },
  bumblefuzz: (g) => {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      circle(g, 0x2a1a06, 24 + Math.cos(a) * 14, 24 + Math.sin(a) * 14, 4.5);
    }
    circle(g, 0xf0c030, 24, 24, 14);
    fillEllipse(g, 0x2a1a06, 24, 24, 14, 4);
    circle(g, 0xfff0a0, 19, 18, 4, 0.7);
  },
  formic: (g) => {
    fillEllipse(g, 0x5a1010, 24, 27, 13, 15);
    fillEllipse(g, 0xc83a2a, 24, 27, 11.5, 13.5);
    fillEllipse(g, 0xff8a6a, 20, 22, 4, 6, 0, 0.7);
    g.fillStyle(0x5a1010, 1);
    g.fillRoundedRect(20, 6, 8, 8, 2);
    for (const [x, y] of [[33, 10], [37, 16], [12, 12]]) circle(g, 0xff6a4a, x, y, 2.2);
  },
  berserk: (g) => {
    g.fillStyle(0xe8dcc0, 1);
    g.fillRoundedRect(19, 26, 10, 16, 4);
    fillPoly(g, 0x5a0a0a, [6, 28, 12, 12, 24, 6, 36, 12, 42, 28]);
    fillPoly(g, 0xd82a1a, [8.5, 26.5, 13.5, 13.5, 24, 8.5, 34.5, 13.5, 39.5, 26.5]);
    for (const [x, y, r] of [[17, 17, 3], [28, 14, 2.6], [32, 22, 2.2], [21, 23, 2]]) circle(g, 0xfff0e0, x, y, r);
  },
  molt: (g) => {
    fillEllipse(g, 0x8a6a3a, 24, 26, 12, 16, 0, 0.7);
    fillEllipse(g, 0xe8d8a8, 24, 26, 10.5, 14.5, 0, 0.55);
    line(g, 1.4, 0x8a6a3a, [24, 12, 24, 40]);
    for (const y of [18, 25, 32]) line(g, 1, 0x8a6a3a, [15, y, 33, y], 0.8);
    line(g, 2, 0x5a3a1a, [20, 12, 16, 6]);
    line(g, 2, 0x5a3a1a, [28, 12, 32, 6]);
  },
  moss: (g) => {
    fillEllipse(g, 0x5a4a2a, 24, 34, 18, 7);
    for (let k = 0; k < 18; k++) {
      const x = 8 + k * 1.9;
      const h = 8 + ((k * 7) % 9);
      line(g, 2.2, k % 2 ? 0x4a8a2a : 0x6ab83a, [x, 34, x + 1, 34 - h]);
    }
    for (const [x, y] of [[14, 20], [26, 18], [35, 22]]) circle(g, 0x9ae070, x, y, 2);
  },
  glowdust: (g) => {
    circle(g, 0xf0ff80, 24, 24, 15, 0.18);
    circle(g, 0xf0ff80, 24, 24, 10, 0.3);
    for (const [x, y, r] of [[24, 24, 4], [16, 18, 2.4], [32, 17, 2], [30, 32, 2.6], [17, 31, 2], [24, 12, 1.6], [37, 25, 1.4]]) {
      circle(g, 0xfaffc0, x, y, r);
    }
  },
  honeycomb: (g) => {
    const hex = (cx: number, cy: number, r: number, color: number) => {
      const pts: number[] = [];
      for (let k = 0; k < 6; k++) pts.push(cx + Math.cos((k * Math.PI) / 3) * r, cy + Math.sin((k * Math.PI) / 3) * r);
      fillPoly(g, color, pts);
    };
    for (const [x, y] of [[17, 17], [31, 17], [24, 29], [10, 29], [38, 29], [17, 41], [31, 41]]) {
      hex(x, y, 8, 0x8a5a10);
      hex(x, y, 6.4, 0xf0b020);
    }
    circle(g, 0xfff0a0, 21, 26, 2.4, 0.8);
  },
  feather: (g) => {
    line(g, 2, 0x8a7a6a, [10, 42, 38, 6]);
    for (let k = 0; k < 9; k++) {
      const t = 0.15 + k * 0.09;
      const x = 10 + 28 * t;
      const y = 42 - 36 * t;
      line(g, 2.4, 0xd8d0c0, [x, y, x - 9 + k * 0.4, y - 6]);
      line(g, 2.4, 0xb8b0a0, [x, y, x + 6, y + 7 - k * 0.3]);
    }
  },
  treehole: (g) => {
    g.fillStyle(0x4a2e14, 1);
    g.fillRoundedRect(8, 6, 32, 38, 8);
    g.fillStyle(0x7a5030, 1);
    g.fillRoundedRect(10.5, 8.5, 27, 33, 6);
    fillEllipse(g, 0x1a0e04, 24, 26, 8, 10);
    circle(g, 0xffbd1f, 22, 30, 3);
    circle(g, 0xffbd1f, 27, 31, 2.6);
    line(g, 1.2, 0x4a2e14, [14, 12, 15, 20]);
    line(g, 1.2, 0x4a2e14, [33, 34, 34, 40]);
  },
  snailcard: (g) => {
    g.fillStyle(0x5a3412, 1);
    g.fillRoundedRect(4, 11, 40, 27, 5);
    g.fillStyle(0xf0d090, 1);
    g.fillRoundedRect(6, 13, 36, 23, 4);
    circle(g, 0x5a3412, 17, 24, 7);
    circle(g, 0xb87a3a, 17, 24, 5.6);
    g.lineStyle(1.4, 0x5a3412, 1);
    g.strokeCircle(17.5, 24, 2.6);
    line(g, 2, 0x8a6a3a, [27, 20, 38, 20]);
    line(g, 2, 0x8a6a3a, [27, 26, 36, 26]);
    line(g, 2, 0xd82a1a, [27, 31, 33, 31]);
  },
  dewcatcher: (g) => {
    fillPoly(g, 0x3f7a2a, [6, 14, 24, 38, 42, 14, 34, 18, 24, 30, 14, 18]);
    fillPoly(g, 0x6fbf45, [9, 16, 24, 35, 39, 16, 33, 19, 24, 28.5, 15, 19]);
    drop(g, 24, 20, 6, 0x1f5a8a, 0x6cc6f0);
  },

  // ---------- 稀有 ----------
  amber: (g) => {
    fillPoly(g, 0x6a3006, [24, 4, 40, 16, 36, 38, 12, 38, 8, 16]);
    fillPoly(g, 0xe0901a, [24, 7, 37, 17, 34, 35.5, 14, 35.5, 11, 17]);
    fillPoly(g, 0xffc860, [24, 8, 30, 13, 18, 22, 13, 17], 0.7);
    fillEllipse(g, 0x3a1a06, 25, 26, 4, 2.6, 0.4);
    line(g, 1, 0x3a1a06, [22, 25, 19, 23]);
    line(g, 1, 0x3a1a06, [27, 28, 30, 31]);
  },
  horncharm: (g) => {
    line(g, 1.6, 0xd9a441, [10, 6, 24, 16, 38, 6]);
    fillPoly(g, 0x3a1a06, [16, 44, 18, 26, 24, 14, 30, 26, 32, 44, 24, 38]);
    fillPoly(g, 0xe8c070, [18.5, 40, 20, 27, 24, 18, 28, 27, 29.5, 40, 24, 35.5]);
    circle(g, 0xfff0c0, 22, 26, 2, 0.8);
  },
  widowsilk: (g) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      line(g, 1, 0xe8e8f0, [24, 24, 24 + Math.cos(a) * 20, 24 + Math.sin(a) * 20]);
    }
    g.lineStyle(1, 0xd0d0e0, 1);
    for (const r of [6, 11, 16]) g.strokeCircle(24, 24, r);
    circle(g, 0x1a0a10, 24, 24, 6);
    fillPoly(g, 0xd82a2a, [24, 20.5, 26.5, 24, 24, 27.5, 21.5, 24]);
  },
  fairyring: (g) => {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const x = 24 + Math.cos(a) * 15;
      const y = 26 + Math.sin(a) * 11;
      g.fillStyle(0xe8dcc0, 1);
      g.fillRect(x - 1.2, y - 1, 2.4, 5);
      fillEllipse(g, 0xc83a2a, x, y - 1.5, 4.4, 3);
      circle(g, 0xfff0e0, x - 1.2, y - 2.4, 0.9);
    }
    circle(g, 0x9ae070, 24, 26, 3, 0.6);
  },
  stinkgland: (g) => {
    for (const [x, y, r] of [[14, 16, 7], [24, 11, 8], [34, 17, 7], [20, 22, 6], [30, 23, 6]]) circle(g, 0x9ad040, x, y, r, 0.45);
    fillEllipse(g, 0x3a2a10, 24, 34, 12, 9);
    fillEllipse(g, 0x8a6a2a, 24, 34, 10.5, 7.5);
    g.fillStyle(0x3a2a10, 1);
    g.fillRoundedRect(21, 22, 6, 6, 1.5);
  },
  elytra: (g) => {
    for (const s of [1, -1]) {
      const x = (v: number) => 24 + (v - 24) * s;
      fillPoly(g, 0x0a3a2a, [x(24), 6, x(38), 12, x(40), 30, x(30), 44, x(24), 42]);
      fillPoly(g, 0x2a9a6a, [x(25.5), 8.5, x(36.5), 13.5, x(38), 29.5, x(29.5), 41, x(25.5), 39.5]);
      fillPoly(g, 0x9af0c0, [x(27), 11, x(33), 13.5, x(29), 24], 0.6);
    }
  },
  antpact: (g) => {
    g.fillStyle(0x8a6a3a, 1);
    g.fillRoundedRect(8, 6, 32, 38, 3);
    g.fillStyle(0xf0e0b8, 1);
    g.fillRoundedRect(10, 8, 28, 34, 2);
    for (const y of [14, 19, 24]) line(g, 1.4, 0x8a7a5a, [14, y, 34, y]);
    fillEllipse(g, 0x3a1420, 20, 34, 3.4, 2.4);
    fillEllipse(g, 0x3a1420, 25, 34, 2, 1.8);
    circle(g, 0x3a1420, 29, 34, 2.2);
    circle(g, 0xc82a2a, 33, 36, 4);
  },
  sevenstar: (g) => {
    line(g, 1.6, 0xd9a441, [12, 4, 24, 14, 36, 4]);
    circle(g, 0xd9a441, 24, 28, 15);
    circle(g, 0xd8302a, 24, 28, 13);
    line(g, 1.4, 0x1a0806, [24, 15, 24, 41]);
    for (const [x, y] of [[24, 19], [17, 24], [31, 24], [16, 32], [32, 32], [20, 38], [28, 38]]) circle(g, 0x1a0806, x, y, 2.2);
  },

  // ---------- 传说 ----------
  royaljelly: (g) => {
    g.fillStyle(0x8a6a3a, 1);
    g.fillRoundedRect(12, 16, 24, 28, 6);
    g.fillStyle(0xfff4d0, 1);
    g.fillRoundedRect(14, 20, 20, 22, 5);
    fillEllipse(g, 0xffffff, 19, 26, 2.4, 6, 0, 0.7);
    for (const [x, y] of [[16, 10], [24, 6], [32, 10]]) fillPoly(g, 0xf0c040, [x - 4, 16, x, y, x + 4, 16]);
    g.fillStyle(0xf0c040, 1);
    g.fillRect(12, 14, 24, 4);
  },
  treering: (g) => {
    circle(g, 0x5a3412, 24, 24, 19);
    for (const [r, c] of [[17.5, 0xc89050], [14, 0xa87038], [10.5, 0xc89050], [7, 0xa87038], [3.5, 0xc89050]] as [number, number][]) {
      circle(g, c, 24 + (17.5 - r) * 0.12, 24, r);
    }
    line(g, 1.6, 0x5a3412, [24, 24, 40, 30]);
  },
  lightning: (g) => {
    line(g, 4, 0x3a2412, [10, 44, 18, 30, 14, 22, 22, 8]);
    line(g, 2.2, 0x7a5030, [10, 44, 18, 30, 14, 22, 22, 8]);
    fillPoly(g, 0xb8a020, [30, 4, 20, 24, 27, 24, 22, 44, 38, 18, 30, 18, 36, 4]);
    fillPoly(g, 0xfff060, [31, 6, 22.5, 22.5, 29.5, 22.5, 25, 39, 35.5, 19.5, 28, 19.5, 33.5, 6]);
  },
  seventhleg: (g) => {
    line(g, 6, 0x2e1406, [8, 40, 18, 22, 34, 14, 42, 6]);
    line(g, 3, 0x8a4a1a, [8, 40, 18, 22, 34, 14, 42, 6]);
    circle(g, 0x2e1406, 18, 22, 3.6);
    circle(g, 0x2e1406, 34, 14, 3);
    fillPoly(g, 0xf0c040, [36, 30, 40, 22, 44, 30, 40, 38]);
    line(g, 2, 0xf0c040, [30, 34, 26, 40]);
  },
};
