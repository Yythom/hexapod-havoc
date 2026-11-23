import Phaser from 'phaser';
import { generateM6Art } from './m6Art';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import {
  SPRITE_RES,
  bake2D,
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
import { generateCreatures } from './creatures';
import { generateIcons } from './icons';
import { generateUIArt } from './uiArt';

/**
 * 所有贴图都在启动时用 Canvas 2D 代码绘制，不依赖外部素材。
 * 角色类贴图统一朝右（+x）绘制，运行时再旋转。
 */

export function generateTextures(scene: Phaser.Scene): void {
  beetles(scene);
  ant(scene);
  generateCreatures(scene);
  generateIcons(scene);
  seed(scene);
  nectar(scene);
  mound(scene);
  shadow(scene);
  dot(scene);
  uiBadges(scene);
  ground(scene);
  generateM6Art(scene);
  generateUIArt(scene);
}

/** 甲虫角色的外壳配色和特征（非甲虫角色的身体在 m6Art.ts） */
interface ShellStyle {
  out: string;
  hi: string;
  mid: string;
  dark: string;
  rim: string;
  spot: string;
  spots: [number, number, number][];
  pronHi: string;
  pronMid: string;
  pronDark: string;
  headHi: string;
  headDark: string;
  eye: string;
  round?: boolean;
  jaw: 'small' | 'big' | 'none';
  horn?: boolean;
}

const SHELLS: Record<string, ShellStyle> = {
  // 锹甲：琥珀橙棕光泽 + 一对威武大钳
  'beetle-stag': {
    out: '#2d1205',
    hi: '#ffd088',
    mid: '#eb8328',
    dark: '#9b410c',
    rim: '#ffe4b0',
    spot: '#7a3309',
    spots: [[17, 20.5, 2.3], [30, 19.2, 1.9], [17, 31.5, 2.3], [30, 32.8, 1.9]],
    pronHi: '#d87c34',
    pronMid: '#944515',
    pronDark: '#4d1f07',
    headHi: '#5a2b10',
    headDark: '#260f04',
    eye: '#fff1b8',
    jaw: 'big',
  },
  // 独角仙：深红褐漆面甲壳 + 霸气分叉独角
  'beetle-rhino': {
    out: '#180904',
    hi: '#d49562',
    mid: '#7a3a1a',
    dark: '#381508',
    rim: '#e8b688',
    spot: '#2c1106',
    spots: [],
    pronHi: '#a45d34',
    pronMid: '#582810',
    pronDark: '#281006',
    headHi: '#482210',
    headDark: '#1b0b04',
    eye: '#ffe4a0',
    jaw: 'none',
    horn: true,
  },
  // 屁步甲：深靛蓝金属鞘翅 + 金斑 + 亮橙前胸
  'beetle-bombardier': {
    out: '#0a1026',
    hi: '#88a4f2',
    mid: '#2d4292',
    dark: '#131d4c',
    rim: '#b0c8ff',
    spot: '#f6c844',
    spots: [[16, 19.5, 2.7], [28.5, 18.5, 2.2], [16, 32.5, 2.7], [28.5, 33.5, 2.2], [38, 21, 1.7], [38, 31, 1.7]],
    pronHi: '#ffc270',
    pronMid: '#e67d1e',
    pronDark: '#8c3d08',
    headHi: '#e07a24',
    headDark: '#7a2f08',
    eye: '#fff5b0',
    jaw: 'small',
  },
  // 瓢虫：圆润亮红釉面外壳 + 七颗黑星
  'beetle-ladybug': {
    out: '#2b0605',
    hi: '#ff9c8a',
    mid: '#e63329',
    dark: '#8d1410',
    rim: '#ffc4b8',
    spot: '#1a0706',
    spots: [[16, 18, 3.2], [30, 17, 2.8], [16, 34, 3.2], [30, 35, 2.8], [38, 26, 3.4], [22, 26, 2.2], [9.5, 26, 2.4]],
    pronHi: '#42201c',
    pronMid: '#1e0b0a',
    pronDark: '#100404',
    headHi: '#3a1a16',
    headDark: '#140504',
    eye: '#fff0c0',
    jaw: 'small',
    round: true,
  },
  // 虎甲：金属绿光泽 + 奶油色斑 + 一对长镰状大颚
  'beetle-tiger': {
    out: '#0a2414',
    hi: '#b8ffc8',
    mid: '#2f9a5a',
    dark: '#0f4a28',
    rim: '#d8ffe0',
    spot: '#f4ecc8',
    spots: [[14, 19.5, 1.8], [26, 18.2, 1.6], [36, 20, 1.4], [14, 32.5, 1.8], [26, 33.8, 1.6], [36, 32, 1.4]],
    pronHi: '#9ae8b8',
    pronMid: '#2a8a6a',
    pronDark: '#0c3a2a',
    headHi: '#4ab88a',
    headDark: '#0c3a26',
    eye: '#fff4c0',
    jaw: 'big',
  },
  // 蜣螂：漆黑带蓝紫光泽的圆壳
  'beetle-dung': {
    out: '#08080c',
    hi: '#9a9ac8',
    mid: '#2e2e44',
    dark: '#0e0e18',
    rim: '#c0c0e8',
    spot: '#1a1a26',
    spots: [],
    pronHi: '#6a6a90',
    pronMid: '#24243a',
    pronDark: '#0c0c14',
    headHi: '#4a4a68',
    headDark: '#101018',
    eye: '#e8dcb0',
    jaw: 'small',
    round: true,
  },
};

function drawShell(ctx: Ctx, st: ShellStyle): void {
  const INK = '#050507';
  // 土豆兄弟风：更圆润敦实的 Q 版甲壳轮廓 + 纯平赛璐璐色块 + 粗黑漫画墨线 + 大漫画眼
  const rx = 21.5;
  const ry = st.round ? 19.8 : 18.0;

  const traceElytra = () => {
    ctx.beginPath();
    if (st.round) {
      ctx.ellipse(26, 26, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(45.5, 26 - ry * 0.72);
      ctx.bezierCurveTo(38, 26 - ry * 1.06, 17, 26 - ry * 1.08, 6.5, 26 - ry * 0.52);
      ctx.quadraticCurveTo(3.5, 26, 6.5, 26 + ry * 0.52);
      ctx.bezierCurveTo(17, 26 + ry * 1.08, 38, 26 + ry * 1.06, 45.5, 26 + ry * 0.72);
      ctx.quadraticCurveTo(48, 26, 45.5, 26 - ry * 0.72);
      ctx.closePath();
    }
  };

  // 1. 纯平赛璐璐鞘翅本体
  cCelShape(
    ctx,
    traceElytra,
    st.mid,
    st.dark,
    st.hi,
    INK,
    3.2,
    { x: 26 - rx, y: 26 - ry, w: rx * 2, h: ry * 2 },
  );

  // 斑点与鞘翅中缝（硬黑描边）
  ctx.save();
  traceElytra();
  ctx.clip();
  for (const [x, y, r] of st.spots) {
    cCircle(ctx, x, y, r + 0.4, st.spot, INK, 1.3);
  }
  cLine(ctx, [5, 26, 47, 26], INK, 2.6);
  ctx.restore();

  // 小盾片
  cPoly(ctx, [42.5, 26, 48.2, 22, 48.2, 30], st.pronDark, INK, 1.8);

  // 2. 前胸背板（厚实圆滚胸甲）
  cCelEllipse(ctx, 46.8, 26, 8.8, 11.4, st.pronMid, st.pronDark, st.pronHi, INK, 3.0);
  if (st.round) {
    cEllipse(ctx, 46.8, 19.2, 3.2, 2.4, '#f7eedc', INK, 1.1);
    cEllipse(ctx, 46.8, 32.8, 3.2, 2.4, '#f7eedc', INK, 1.1);
  }

  // 3. 粗黑触角
  for (const s of [1, -1]) {
    const y = (v: number) => 26 + (v - 26) * s;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(56, y(21.5));
    ctx.quadraticCurveTo(59.8, y(16.8), 62.5, y(14.5));
    ctx.stroke();
    cCircle(ctx, 62.5, y(14.5), 1.6, st.pronHi, INK, 1.2);
  }

  // 4. 头部（敦实漫画头）
  cCelEllipse(ctx, 54.4, 26, 6.2, 7.6, st.headHi, st.headDark, st.pronHi, INK, 2.8);

  // 5. 大颚 / 独角（纯平色块 + 粗黑线）
  if (st.jaw === 'big') {
    for (const s of [1, -1]) {
      const y = (v: number) => 26 + (v - 26) * s;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(57, y(22.4));
      ctx.bezierCurveTo(60.6, y(16.0), 64.6, y(17.8), 62.6, y(24.4));
      ctx.stroke();
      cPoly(ctx, [60, y(20.0), 62.2, y(22.6), 59.2, y(22.2)], INK);
      ctx.strokeStyle = st.mid;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(57.2, y(22.2));
      ctx.bezierCurveTo(60.5, y(16.8), 63.8, y(18.2), 62.3, y(23.5));
      ctx.stroke();
    }
  } else if (st.jaw === 'small') {
    cPoly(ctx, [57.8, 22.4, 63.6, 21.0, 59.6, 25.4], st.headDark, INK, 1.6);
    cPoly(ctx, [57.8, 29.6, 63.6, 31.0, 59.6, 26.6], st.headDark, INK, 1.6);
  }
  if (st.horn) {
    cPoly(ctx, [49.2, 22.2, 61.5, 24.4, 63.8, 21.6, 62.4, 26, 63.8, 30.4, 61.5, 27.6, 49.2, 29.8], st.pronMid, INK, 2.6);
    cLine(ctx, [51.5, 24.6, 60.5, 25.4], st.hi, 1.5);
  }

  // 6. 土豆兄弟灵魂大漫画眼（粗黑眼眶 + 鲜明眼白 + 黑瞳 + 性格斜眉）
  const brow = st.jaw === 'big' || st.horn ? 0.35 : 0;
  cComicEye(ctx, 56.0, 21.4, 3.0, '#ffffff', '#050507', brow, INK);
  cComicEye(ctx, 56.0, 30.6, 3.0, '#ffffff', '#050507', -brow, INK);
}

/** 主角甲虫外壳（不含腿，腿在 BeetleView 里实时画）。64×52，中心 (32,26)，2倍超采样。 */
function beetles(scene: Phaser.Scene): void {
  for (const [key, style] of Object.entries(SHELLS)) {
    bake2D(scene, key, 64, 52, (ctx) => drawShell(ctx, style), SPRITE_RES);
  }
}

/** 工蚁（土豆兄弟纯平赛璐璐风：呆萌凶狠大眼睛 + 粗黑墨边）。36×28，中心 (18,14)。 */
function ant(scene: Phaser.Scene): void {
  bake2D(
    scene,
    'ant',
    36,
    28,
    (ctx) => {
      const OUT = '#050507';
      cContactShadow(ctx, 19, 15.5, 13.5, 8.5, 0.42);
      const legPairs = [
        [20, 12.5, 23, 7, 26.8, 3.8],
        [18, 12.5, 18, 6.2, 15.5, 2.5],
        [16, 12.5, 11.2, 7, 6.5, 5],
      ];
      for (const p of legPairs) {
        cLine(ctx, p, OUT, 2.4);
        cLine(
          ctx,
          p.map((v, i) => (i % 2 === 1 ? 28 - v : v)),
          OUT,
          2.4,
        );
      }
      // 敦实水滴腹
      cCelEllipse(ctx, 9.2, 14, 7.6, 6.5, '#8c2848', '#481024', '#d86284', OUT, 2.4);
      cCircle(ctx, 16.5, 14, 2.1, '#58182e', OUT, 1.5);
      cCelEllipse(ctx, 20, 14, 4.4, 3.6, '#7a203e', '#400e20', '#c05070', OUT, 2.2);
      // 漫画大脑袋
      cCelEllipse(ctx, 25.8, 14, 5.4, 5.2, '#9a2e52', '#4c1228', '#e06e92', OUT, 2.4);
      // 触角 & 大颚
      cLine(ctx, [28.5, 11, 31.2, 7.6, 34, 8.4], OUT, 1.8);
      cLine(ctx, [28.5, 17, 31.2, 20.4, 34, 19.6], OUT, 1.8);
      cPoly(ctx, [29.4, 12.0, 33.4, 11.4, 30.4, 13.9], '#3a101e', OUT, 1.2);
      cPoly(ctx, [29.4, 16.0, 33.4, 16.6, 30.4, 14.1], '#3a101e', OUT, 1.2);
      // 土豆风凶萌大白眼
      cComicEye(ctx, 27.2, 11.8, 2.1, '#ffffff', '#050507', 0.35, OUT);
      cComicEye(ctx, 27.2, 16.2, 2.1, '#ffffff', '#050507', -0.35, OUT);
    },
    SPRITE_RES,
  );
}

/** 弹弓发射的种子。16×12 @ 2x。 */
function seed(scene: Phaser.Scene): void {
  bake2D(
    scene,
    'seed',
    16,
    12,
    (ctx) => {
      const grad = cShellGrad(ctx, 7.5, 5, 7, '#fff2c8', '#dfa854', '#7a4b16');
      cEllipse(ctx, 8, 6, 6.4, 4.2, grad, '#3c2108', 1.4);
      cLine(ctx, [3.5, 6, 12.5, 6], 'rgba(90,48,14,0.45)', 0.9);
      cSoftEllipse(ctx, 6.5, 4.6, 2.6, 1.1, 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)');
    },
    SPRITE_RES,
  );
}

/** 花蜜：发光金黄蜜滴/琥珀晶粒，和子弹清晰区分。24×24 @ 2x。 */
function nectar(scene: Phaser.Scene): void {
  bake2D(
    scene,
    'nectar',
    24,
    24,
    (ctx) => {
      // 外层暖光晕
      cSoftEllipse(ctx, 12, 12, 11.5, 11.5, 'rgba(255,214,68,0.46)', 'rgba(255,190,20,0)');
      // 水滴形花蜜主体
      const dropGrad = ctx.createRadialGradient(10.2, 10.5, 1, 12, 13, 7.5);
      dropGrad.addColorStop(0, '#fff9cc');
      dropGrad.addColorStop(0.45, '#ffca2c');
      dropGrad.addColorStop(1, '#c96f00');
      ctx.beginPath();
      ctx.moveTo(12, 4.5);
      ctx.bezierCurveTo(17.5, 10.2, 18.2, 16.8, 12, 18.8);
      ctx.bezierCurveTo(5.8, 16.8, 6.5, 10.2, 12, 4.5);
      ctx.closePath();
      ctx.fillStyle = dropGrad;
      ctx.fill();
      ctx.strokeStyle = '#6e3600';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // 内高光 + 十字微星芒
      cEllipse(ctx, 10.3, 12.2, 1.5, 2.3, 'rgba(255,255,255,0.85)', undefined, 0, -0.25);
      cCircle(ctx, 13.8, 15.2, 0.9, 'rgba(255,248,190,0.75)');
    },
    SPRITE_RES,
  );
}

/** 刷怪预警：隆起的裂土堆 + 脉冲感红色预警圈。44×30 @ 2x。 */
function mound(scene: Phaser.Scene): void {
  bake2D(
    scene,
    'mound',
    44,
    30,
    (ctx) => {
      // 预警外发光环
      cSoftEllipse(ctx, 22, 15, 21, 13.5, 'rgba(255,80,60,0.22)', 'rgba(255,80,60,0)');
      ctx.strokeStyle = 'rgba(255, 92, 74, 0.92)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(22, 15, 19.5, 11.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 阴影
      cContactShadow(ctx, 22, 17, 15.5, 7.5, 0.38);
      // 翻起土堆
      const dirtGrad = cShellGrad(ctx, 21, 12.5, 14, '#9e7548', '#6b4928', '#3c2613');
      cEllipse(ctx, 22, 14.5, 14, 7.4, dirtGrad, '#2b1a0c', 1.4);
      // 土块裂纹
      cLine(ctx, [16, 14, 19.5, 12.2, 18.5, 10.2], '#2d1a0c', 1.3);
      cLine(ctx, [23, 15, 26.5, 12.5, 29, 13.5], '#2d1a0c', 1.2);
      // 散落小土粒
      for (const [x, y, r] of [
        [10, 17, 1.8],
        [33.5, 16.5, 1.6],
        [27, 20.5, 1.4],
        [14.5, 19.8, 1.3],
      ]) {
        cCircle(ctx, x, y, r, '#7d5935', '#341f0e', 0.8);
      }
    },
    SPRITE_RES,
  );
}

/** 柔边圆形投影，供玩家甲虫使用 */
function shadow(scene: Phaser.Scene): void {
  bake2D(
    scene,
    'shadow',
    68,
    50,
    (ctx) => {
      cSoftEllipse(ctx, 34, 25, 31, 21, 'rgba(8, 14, 5, 0.42)', 'rgba(8, 14, 5, 0)');
    },
    SPRITE_RES,
  );
}

/** 粒子与特效贴图：发光圆点、四角星芒、速度线火花 */
function dot(scene: Phaser.Scene): void {
  bake2D(scene, 'dot', 14, 14, (ctx) => {
    const g = ctx.createRadialGradient(7, 7, 1, 7, 7, 7);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 14, 14);
  });
  bake2D(scene, 'fx-flare', 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 15 : 3.2;
      const x = 16 + Math.cos(a) * r;
      const y = 16 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  });
  bake2D(scene, 'fx-streak', 24, 10, (ctx) => {
    const g = ctx.createLinearGradient(0, 5, 24, 5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(14, 1.5);
    ctx.lineTo(24, 5);
    ctx.lineTo(14, 8.5);
    ctx.closePath();
    ctx.fill();
  });
}

/** UI 专用矢量徽章贴图（蜗老板头像、天气难度图标、心形、护盾、锁、齿轮、皇冠） */
function uiBadges(scene: Phaser.Scene): void {
  // 蜗老板头像（商店标题旁）64×64 @ 2x
  bake2D(
    scene,
    'snail-merchant',
    64,
    64,
    (ctx) => {
      // 柔和树洞暖光圆底
      const bg = cShellGrad(ctx, 32, 30, 30, '#543c22', '#2f2012', '#1b1209');
      cCircle(ctx, 32, 32, 29, bg, '#d9a441', 2.6);
      // 蜗牛身体
      const body = ctx.createLinearGradient(12, 38, 52, 50);
      body.addColorStop(0, '#c8a974');
      body.addColorStop(1, '#e8cfa0');
      cEllipse(ctx, 34, 46, 19, 7, body, '#4a2e12', 1.8);
      // 头部 + 眼柄
      cEllipse(ctx, 47, 42, 7.5, 6.5, '#e8cfa0', '#4a2e12', 1.8);
      cLine(ctx, [46, 36.5, 44, 27], '#4a2e12', 2.4);
      cLine(ctx, [50.5, 37, 53.5, 28], '#4a2e12', 2.4);
      cLine(ctx, [46, 36.5, 44, 27], '#e8cfa0', 1.2);
      cLine(ctx, [50.5, 37, 53.5, 28], '#e8cfa0', 1.2);
      cCircle(ctx, 44, 26, 3.2, '#fff8e8', '#3a220c', 1.4);
      cCircle(ctx, 53.5, 27, 3.2, '#fff8e8', '#3a220c', 1.4);
      cCircle(ctx, 44.5, 26, 1.3, '#221208');
      cCircle(ctx, 54, 27, 1.3, '#221208');
      // 微笑
      ctx.strokeStyle = '#5a3414';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(49, 43.2, 2.8, 0.15, Math.PI - 0.2);
      ctx.stroke();
      // 螺旋蜗牛壳
      const sh = cShellGrad(ctx, 24, 30, 17, '#f2b85c', '#ba6f28', '#68350e');
      cCircle(ctx, 27, 34, 15.5, sh, '#3c1c06', 2.2);
      ctx.strokeStyle = '#52280a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 0; t < 18; t++) {
        const a = t * 0.55;
        const r = 1.2 + t * 0.68;
        const px = 27.5 + Math.cos(a) * r;
        const py = 34.5 + Math.sin(a) * r;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // 小金领结（老板范儿）
      cPoly(ctx, [41, 46, 37, 43.5, 37, 48.5], '#e04238', '#3c120e', 1);
      cPoly(ctx, [41, 46, 45, 43.5, 45, 48.5], '#e04238', '#3c120e', 1);
      cCircle(ctx, 41, 46, 1.5, '#ffd24a');
    },
    SPRITE_RES,
  );

  // 天气难度图标（晴天 / 阴天 / 小雨 / 暴雨 / 雷暴）
  // 0: 晴天
  bake2D(
    scene,
    'weather-0',
    32,
    32,
    (ctx) => {
      cSoftEllipse(ctx, 16, 16, 14, 14, 'rgba(255,210,70,0.35)', 'rgba(255,210,70,0)');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        cLine(ctx, [16 + Math.cos(a) * 9.5, 16 + Math.sin(a) * 9.5, 16 + Math.cos(a) * 13.5, 16 + Math.sin(a) * 13.5], '#ffd44a', 2.4);
      }
      const g = cShellGrad(ctx, 14, 14, 7.5, '#fff5b8', '#ffca38', '#e28416');
      cCircle(ctx, 16, 16, 7, g, '#7a3c06', 1.4);
    },
    SPRITE_RES,
  );
  // 1: 阴天
  bake2D(
    scene,
    'weather-1',
    32,
    32,
    (ctx) => {
      const drawCloud = (ox: number, oy: number, s: number, top: string, bot: string) => {
        const g = ctx.createLinearGradient(ox, oy - 7 * s, ox, oy + 7 * s);
        g.addColorStop(0, top);
        g.addColorStop(1, bot);
        ctx.fillStyle = g;
        ctx.strokeStyle = '#384654';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ox - 5 * s, oy + 2 * s, 5 * s, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(ox - 1 * s, oy - 3 * s, 6 * s, Math.PI, Math.PI * 2);
        ctx.arc(ox + 6 * s, oy + 1 * s, 5.2 * s, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };
      drawCloud(19, 13, 0.85, '#b8c4d0', '#8696a6');
      drawCloud(14, 19, 1.0, '#eef4fa', '#b6c4d2');
    },
    SPRITE_RES,
  );
  // 2: 小雨
  bake2D(
    scene,
    'weather-2',
    32,
    32,
    (ctx) => {
      const g = ctx.createLinearGradient(16, 6, 16, 20);
      g.addColorStop(0, '#dce8f4');
      g.addColorStop(1, '#98afc4');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#314458';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(10, 15, 5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(15, 11, 6.2, Math.PI, Math.PI * 2);
      ctx.arc(22, 14.5, 5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (const [x, y] of [[11, 22], [16.5, 24], [22, 22]]) {
        cLine(ctx, [x, y, x - 1.5, y + 4.5], '#6cc6ff', 2.2);
      }
    },
    SPRITE_RES,
  );
  // 3: 暴雨
  bake2D(
    scene,
    'weather-3',
    32,
    32,
    (ctx) => {
      const g = ctx.createLinearGradient(16, 5, 16, 19);
      g.addColorStop(0, '#96aac0');
      g.addColorStop(1, '#50647a');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#243240';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(9.5, 14, 5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(15, 10, 6.4, Math.PI, Math.PI * 2);
      ctx.arc(22.5, 13.5, 5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (const [x, y] of [[9.5, 20.5], [14.5, 21], [19.5, 20.5], [24, 21]]) {
        cLine(ctx, [x, y, x - 2.6, y + 7], '#58b4ff', 2.2);
      }
    },
    SPRITE_RES,
  );
  // 4: 雷暴
  bake2D(
    scene,
    'weather-4',
    32,
    32,
    (ctx) => {
      cSoftEllipse(ctx, 16, 22, 11, 9, 'rgba(255,220,70,0.32)', 'rgba(255,220,70,0)');
      const g = ctx.createLinearGradient(16, 4, 16, 18);
      g.addColorStop(0, '#787898');
      g.addColorStop(1, '#3a3854');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#1b182c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(9.5, 13.5, 5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(15, 9.5, 6.4, Math.PI, Math.PI * 2);
      ctx.arc(22.5, 13, 5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      cPoly(ctx, [17.5, 13.5, 12.2, 22, 16.5, 22, 13.5, 29.5, 21.8, 19.5, 17.4, 19.5, 20.4, 13.5], '#ffe858', '#6a4406', 1.2);
    },
    SPRITE_RES,
  );

  // 通用 UI 小图标 28×28 @ 2x
  bake2D(
    scene,
    'ui-heart',
    28,
    28,
    (ctx) => {
      const g = cShellGrad(ctx, 11, 10, 12, '#ff9a8a', '#e83e36', '#8a1414');
      ctx.beginPath();
      ctx.moveTo(14, 24);
      ctx.bezierCurveTo(3, 17, 2.5, 8, 8.5, 5.5);
      ctx.bezierCurveTo(11.8, 4.2, 14, 7.2, 14, 9);
      ctx.bezierCurveTo(14, 7.2, 16.2, 4.2, 19.5, 5.5);
      ctx.bezierCurveTo(25.5, 8, 25, 17, 14, 24);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#3a0a0a';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      cEllipse(ctx, 9.2, 9.5, 2.2, 1.3, 'rgba(255,255,255,0.65)', undefined, 0, -0.5);
    },
    SPRITE_RES,
  );

  bake2D(
    scene,
    'ui-shield',
    28,
    28,
    (ctx) => {
      const g = ctx.createLinearGradient(14, 4, 14, 25);
      g.addColorStop(0, '#c8f0ff');
      g.addColorStop(0.5, '#5cb8f0');
      g.addColorStop(1, '#23649e');
      ctx.beginPath();
      ctx.moveTo(14, 3.5);
      ctx.lineTo(23, 7.2);
      ctx.quadraticCurveTo(23.5, 18, 14, 24.5);
      ctx.quadraticCurveTo(4.5, 18, 5, 7.2);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#123254';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      cLine(ctx, [14, 6.2, 14, 21.5], 'rgba(255,255,255,0.45)', 1.2);
    },
    SPRITE_RES,
  );

  bake2D(
    scene,
    'ui-lock',
    28,
    28,
    (ctx) => {
      ctx.strokeStyle = '#c8b692';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(14, 11.5, 5.5, Math.PI, 0);
      ctx.stroke();
      const g = ctx.createLinearGradient(7, 12, 7, 24);
      g.addColorStop(0, '#e6c88a');
      g.addColorStop(1, '#9a7438');
      cRoundRect(ctx, 6.5, 12, 15, 12, 3, g, '#3a240e', 1.6);
      cCircle(ctx, 14, 17, 1.8, '#3a240e');
      cLine(ctx, [14, 17.5, 14, 20.8], '#3a240e', 1.8);
    },
    SPRITE_RES,
  );

  bake2D(
    scene,
    'ui-gear',
    28,
    28,
    (ctx) => {
      ctx.save();
      ctx.translate(14, 14);
      ctx.fillStyle = '#f3e6c8';
      ctx.strokeStyle = '#3a2816';
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 8; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI) / 4);
        cRoundRect(ctx, -2.4, -10.8, 4.8, 4.2, 1.2, '#f3e6c8', '#3a2816', 1.2);
        ctx.restore();
      }
      cCircle(ctx, 0, 0, 7.6, '#f3e6c8', '#3a2816', 1.5);
      cCircle(ctx, 0, 0, 3.2, '#3b3326', '#3a2816', 1.2);
      ctx.restore();
    },
    SPRITE_RES,
  );

  bake2D(
    scene,
    'ui-crown',
    28,
    28,
    (ctx) => {
      const g = ctx.createLinearGradient(14, 6, 14, 22);
      g.addColorStop(0, '#fff098');
      g.addColorStop(0.55, '#f0b832');
      g.addColorStop(1, '#b87010');
      cPoly(ctx, [4, 21, 5.5, 9.5, 10.5, 15, 14, 7, 17.5, 15, 22.5, 9.5, 24, 21], g, '#4a2606', 1.6);
      cRoundRect(ctx, 4, 20.5, 20, 3.2, 1.4, '#d99824', '#4a2606', 1.2);
      cCircle(ctx, 14, 17, 1.6, '#ff5a4a');
    },
    SPRITE_RES,
  );
}

/** 战场地面：参照土豆兄弟的暗调哑光泥土与暮色苔藓竞技场，压低地面饱和度让战虫、怪物、花蜜与弹幕一眼炸出高对比。 */
function ground(scene: Phaser.Scene): void {
  const W = WORLD_WIDTH;
  const H = WORLD_HEIGHT;
  bake2D(scene, 'ground', W, H, (ctx) => {
    const rnd = new Phaser.Math.RandomDataGenerator(['hexapod-ground-brotato-v3']);

    // 1. 基底：深沉暗褐苔土渐变（中央微暖泥土 → 外围冷暗森林腐殖土）
    const baseGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 90, W * 0.5, H * 0.5, W * 0.66);
    baseGrad.addColorStop(0, '#34362c');
    baseGrad.addColorStop(0.55, '#272922');
    baseGrad.addColorStop(1, '#1a1c17');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. 大面积柔边干涸泥土与深苔色斑块（低饱和、哑光粗糙感）
    for (let i = 0; i < 75; i++) {
      const x = rnd.between(0, W);
      const y = rnd.between(0, H);
      const rx = rnd.between(100, 250);
      const ry = rnd.between(75, 190);
      const rot = rnd.rotation();
      const tone = rnd.pick([
        ['rgba(58, 60, 44, 0.24)', 'rgba(58, 60, 44, 0)'],
        ['rgba(22, 23, 18, 0.34)', 'rgba(22, 23, 18, 0)'],
        ['rgba(66, 56, 40, 0.2)', 'rgba(66, 56, 40, 0)'],
      ]);
      cSoftEllipse(ctx, x, y, rx, ry, tone[0], tone[1], rot);
    }

    // 3. 粗糙碎石砂砾颗粒（让地面像有磨砂/干土肌理，不再像纯色塑料）
    for (let i = 0; i < 2400; i++) {
      const x = rnd.between(36, W - 36);
      const y = rnd.between(36, H - 36);
      const r = rnd.realInRange(0.7, 2.0);
      ctx.fillStyle = rnd.frac() < 0.4 ? 'rgba(210, 200, 175, 0.055)' : 'rgba(10, 10, 8, 0.18)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. 手绘黑色墨线龟裂土纹（土豆兄弟经典地面细节）
    for (let i = 0; i < 42; i++) {
      let cx = rnd.between(90, W - 90);
      let cy = rnd.between(90, H - 90);
      if (Math.hypot(cx - W / 2, cy - H / 2) < 140) continue;
      ctx.strokeStyle = 'rgba(12, 12, 10, 0.42)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let ang = rnd.rotation();
      const segs = rnd.between(3, 6);
      for (let s = 0; s < segs; s++) {
        ang += rnd.realInRange(-0.85, 0.85);
        cx += Math.cos(ang) * rnd.between(10, 22);
        cy += Math.sin(ang) * rnd.between(10, 22);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // 5. 中心地标：风化黑墨描边老树桩
    drawCenterStump(ctx, W / 2, H / 2);

    // 6. 低调暗绿小草簇（黑墨描边轮廓感，不抢怪物与子弹）
    for (let i = 0; i < 520; i++) {
      const x = rnd.between(54, W - 54);
      const y = rnd.between(54, H - 54);
      if (Math.hypot(x - W / 2, y - H / 2) < 102) continue;
      const h = rnd.between(6, 11);
      const lean = rnd.realInRange(-3, 3);
      cEllipse(ctx, x, y + 1, 5, 2, 'rgba(8, 10, 6, 0.35)');
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = rnd.pick(['rgba(48, 62, 34, 0.72)', 'rgba(62, 76, 42, 0.65)', 'rgba(38, 48, 28, 0.78)']);
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y);
      ctx.quadraticCurveTo(x - 5, y - h * 0.55, x - 4.5 + lean * 0.4, y - h * 0.85);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h - 1);
      ctx.moveTo(x + 2.5, y);
      ctx.quadraticCurveTo(x + 5, y - h * 0.5, x + 5 + lean * 0.3, y - h * 0.78);
      ctx.stroke();
    }

    // 7. 暗调干枯落叶（黑墨细轮廓）
    for (let i = 0; i < 36; i++) {
      const x = rnd.between(76, W - 76);
      const y = rnd.between(76, H - 76);
      if (Math.hypot(x - W / 2, y - H / 2) < 115) continue;
      const rot = rnd.rotation();
      const len = rnd.between(10, 17);
      const col = rnd.pick(['#584c30', '#4f4028', '#48522d', '#5c462c']);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(8, 8, 6, 0.38)';
      ctx.beginPath();
      ctx.moveTo(-len + 2, 3);
      ctx.quadraticCurveTo(2, -len * 0.5 + 3, len + 2, 3);
      ctx.quadraticCurveTo(2, len * 0.5 + 3, -len + 2, 3);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.strokeStyle = '#12120e';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(0, -len * 0.5, len, 0);
      ctx.quadraticCurveTo(0, len * 0.5, -len, 0);
      ctx.fill();
      ctx.stroke();
      cLine(ctx, [-len * 0.8, 0, len * 0.8, 0], '#261e12', 1);
      ctx.restore();
    }

    // 8. 硬朗黑墨描边碎石块
    for (let i = 0; i < 95; i++) {
      const x = rnd.between(70, W - 70);
      const y = rnd.between(70, H - 70);
      if (Math.hypot(x - W / 2, y - H / 2) < 105) continue;
      const r = rnd.between(3, 7);
      const rot = rnd.rotation();
      cEllipse(ctx, x + 2, y + 2.5, r, r * 0.72, 'rgba(5, 5, 4, 0.45)', undefined, 0, rot);
      const sg = cShellGrad(ctx, x - 1, y - 1, r, '#6a6a60', '#484842', '#2b2b26');
      cEllipse(ctx, x, y, r, r * 0.72, sg, '#11110e', 1.3, rot);
    }

    // 9. 场地边界暗角 + 粗墨硬朗大围石
    drawPerimeter(ctx, W, H, rnd);
  });
}

function drawCenterStump(ctx: Ctx, cx: number, cy: number): void {
  cSoftEllipse(ctx, cx, cy, 132, 114, 'rgba(18, 16, 12, 0.52)', 'rgba(18, 16, 12, 0)');
  const roots = [0.2, 1.45, 2.7, 3.9, 5.15];
  for (const a of roots) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const rg = ctx.createLinearGradient(50, 0, 124, 0);
    rg.addColorStop(0, 'rgba(62, 46, 28, 0.88)');
    rg.addColorStop(0.7, 'rgba(48, 36, 22, 0.45)');
    rg.addColorStop(1, 'rgba(38, 28, 18, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(46, -15);
    ctx.quadraticCurveTo(86, -9, 122, -3);
    ctx.quadraticCurveTo(122, 3, 118, 5);
    ctx.quadraticCurveTo(84, 11, 46, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 硬朗投影
  cEllipse(ctx, cx + 4, cy + 6, 80, 72, 'rgba(6, 6, 5, 0.5)');

  // 树皮外圈（深黑墨线轮廓）
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
  ctx.fillStyle = '#3b2b1a';
  ctx.fill();
  ctx.strokeStyle = '#0d0b08';
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // 风化木质切面
  const woodGrad = cShellGrad(ctx, cx - 10, cy - 10, 74, '#6d583c', '#57462f', '#3d3020');
  cEllipse(ctx, cx, cy, 67, 60, woodGrad, '#17110a', 2.2);

  // 年轮与裂纹
  ctx.strokeStyle = 'rgba(24, 18, 12, 0.45)';
  for (const [rx, ry, lw] of [
    [56, 50, 1.5],
    [45, 40, 1.3],
    [34, 30, 1.2],
    [22, 19.5, 1.1],
    [11, 9.8, 1.1],
  ]) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 1, rx, ry, 0.08, 0, Math.PI * 2);
    ctx.stroke();
  }
  cLine(ctx, [cx + 4, cy, cx + 52, cy + 30], '#16100a', 2.0);
  cLine(ctx, [cx - 3, cy - 2, cx - 44, cy - 24], '#16100a', 1.6);
  cLine(ctx, [cx + 2, cy + 3, cx - 18, cy + 46], '#16100a', 1.5);

  for (const [ox, oy, rx, ry, rot] of [
    [-56, -34, 14, 7, -0.6],
    [54, 32, 15, 7, -0.5],
    [-22, 58, 13, 6, 0.2],
  ]) {
    cEllipse(ctx, cx + ox, cy + oy, rx, ry, 'rgba(64, 88, 42, 0.72)', '#182210', 1.2, rot);
  }
}

function drawPerimeter(ctx: Ctx, W: number, H: number, rnd: Phaser.Math.RandomDataGenerator): void {
  const edgeW = 88;
  const topG = ctx.createLinearGradient(0, 0, 0, edgeW);
  topG.addColorStop(0, 'rgba(8, 9, 8, 0.85)');
  topG.addColorStop(1, 'rgba(8, 9, 8, 0)');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, W, edgeW);

  const botG = ctx.createLinearGradient(0, H, 0, H - edgeW);
  botG.addColorStop(0, 'rgba(8, 9, 8, 0.85)');
  botG.addColorStop(1, 'rgba(8, 9, 8, 0)');
  ctx.fillStyle = botG;
  ctx.fillRect(0, H - edgeW, W, edgeW);

  const leftG = ctx.createLinearGradient(0, 0, edgeW, 0);
  leftG.addColorStop(0, 'rgba(8, 9, 8, 0.85)');
  leftG.addColorStop(1, 'rgba(8, 9, 8, 0)');
  ctx.fillStyle = leftG;
  ctx.fillRect(0, 0, edgeW, H);

  const rightG = ctx.createLinearGradient(W, 0, W - edgeW, 0);
  rightG.addColorStop(0, 'rgba(8, 9, 8, 0.85)');
  rightG.addColorStop(1, 'rgba(8, 9, 8, 0)');
  ctx.fillStyle = rightG;
  ctx.fillRect(W - edgeW, 0, edgeW, H);

  // 黑墨围栏木桩边界线
  ctx.strokeStyle = 'rgba(14, 14, 12, 0.88)';
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = 'rgba(72, 64, 52, 0.65)';
  ctx.lineWidth = 2;
  ctx.strokeRect(23, 23, W - 46, H - 46);

  // 重墨描边暗石围墙
  const stone = (x: number, y: number, r: number) => {
    const rot = rnd.rotation();
    cEllipse(ctx, x + 3, y + 4, r * 1.06, r * 0.85, 'rgba(4, 4, 4, 0.58)', undefined, 0, rot);
    const sg = cShellGrad(ctx, x - r * 0.25, y - r * 0.28, r * 1.15, '#666862', '#42443e', '#262724');
    cEllipse(ctx, x, y, r, r * 0.8, sg, '#0b0b09', 2.4, rot);
    if (rnd.frac() < 0.4) {
      cEllipse(ctx, x + r * 0.26, y + r * 0.26, r * 0.4, r * 0.24, 'rgba(64, 86, 42, 0.72)', undefined, 0, rot + 0.4);
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
