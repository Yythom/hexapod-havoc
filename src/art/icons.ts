import Phaser from 'phaser';
import {
  SPRITE_RES,
  bake2D,
  bakeShadedItem,
  cCircle,
  cContactShadow,
  cEllipse,
  cLine,
  cPoly,
  cRoundRect,
  cShellGrad,
  cSoftEllipse,
  type Ctx,
  type Draw2D,
} from './draw';
import { ITEM_ICONS } from './itemIcons';
import { M6_ITEM_ICONS } from './itemIconsM6';
import { WEAPON_ICONS } from './weaponIcons';
import { M6_WEAPON_ICONS } from './weaponIconsM6';
import { GUN_WEAPON_ICONS } from './weaponIconsGuns';

export const TIER_ROMAN = ['I', 'II', 'III', 'IV'] as const;

/** 按武器品质返回对应的进化贴图 key（0 普通 / 1 精良 / 2 稀有 / 3 传说） */
export function weaponTex(icon: string, tier = 0, ui = false): string {
  const t = Math.max(0, Math.min(3, tier));
  const base = ui ? `${icon}@ui` : icon;
  return t === 0 ? base : `${base}-t${t}`;
}

interface TierLook {
  glow: string;
  blur: number;
  sheenA: string;
  sheenB: string;
  sheenAlpha: number;
  sparkColor: string;
  sparks: [number, number, number][];
}

const TIER_LOOK: Record<number, TierLook> = {
  1: {
    glow: 'rgba(92, 182, 255, 0.85)',
    blur: 2.2,
    sheenA: 'rgba(130, 212, 255, 0.36)',
    sheenB: 'rgba(32, 92, 180, 0.16)',
    sheenAlpha: 0.24,
    sparkColor: '#b8e8ff',
    sparks: [[20, 4.5, 1.8]],
  },
  2: {
    glow: 'rgba(196, 108, 255, 0.92)',
    blur: 3.0,
    sheenA: 'rgba(226, 150, 255, 0.44)',
    sheenB: 'rgba(98, 28, 168, 0.2)',
    sheenAlpha: 0.32,
    sparkColor: '#f2c8ff',
    sparks: [
      [19.5, 4.2, 2.2],
      [6, 15.8, 1.7],
    ],
  },
  3: {
    glow: 'rgba(255, 186, 48, 0.98)',
    blur: 3.8,
    sheenA: 'rgba(255, 240, 126, 0.56)',
    sheenB: 'rgba(214, 86, 12, 0.24)',
    sheenAlpha: 0.4,
    sparkColor: '#fff6b0',
    sparks: [
      [19.5, 4.0, 2.6],
      [5.5, 15.8, 2.0],
      [18.5, 16.0, 1.7],
    ],
  },
};

function drawSpark(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.28, y - r * 0.28);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.28, y + r * 0.28);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.28, y + r * 0.28);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.28, y - r * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function bakeWeaponVariant(scene: Phaser.Scene, texKey: string, draw: Draw2D, scale: number, tier: number, pad = 0): void {
  const w = 24 + pad * 2;
  const h = 20 + pad * 2;
  if (tier === 0) {
    bake2D(
      scene,
      texKey,
      w,
      h,
      (ctx) => {
        if (pad) ctx.translate(pad, pad);
        draw(ctx);
      },
      scale,
    );
    return;
  }

  const look = TIER_LOOK[tier];
  bake2D(
    scene,
    texKey,
    w,
    h,
    (ctx) => {
      const tw = Math.ceil(w * scale);
      const th = Math.ceil(h * scale);
      const off = document.createElement('canvas');
      off.width = tw;
      off.height = th;
      const octx = off.getContext('2d')!;
      octx.save();
      octx.scale(scale, scale);
      octx.lineCap = 'round';
      octx.lineJoin = 'round';
      if (pad) octx.translate(pad, pad);
      draw(octx);
      octx.restore();

      // 1. 锐利品阶外描边光环（土豆兄弟纯硬边漫画风，不用模糊阴影）
      const rim = document.createElement('canvas');
      rim.width = tw;
      rim.height = th;
      const rctx = rim.getContext('2d')!;
      rctx.drawImage(off, 0, 0);
      rctx.globalCompositeOperation = 'source-in';
      rctx.fillStyle = look.glow;
      rctx.fillRect(0, 0, tw, th);

      const d = Math.max(1, Math.round(scale * (0.45 + tier * 0.15)));
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (const [ox, oy] of [
        [-d / scale, 0],
        [d / scale, 0],
        [0, -d / scale],
        [0, d / scale],
      ]) {
        ctx.drawImage(rim, ox, oy, w, h);
      }
      ctx.restore();

      // 2. 武器本体叠加平涂赛璐璐金属高光釉面（source-atop）
      const lit = document.createElement('canvas');
      lit.width = tw;
      lit.height = th;
      const lctx = lit.getContext('2d')!;
      lctx.drawImage(off, 0, 0);
      lctx.globalCompositeOperation = 'source-atop';
      lctx.fillStyle = look.sheenA;
      lctx.fillRect(0, 0, tw, th * 0.48);

      // 硬边斜向刃光带
      lctx.fillStyle = `rgba(255, 255, 255, ${look.sheenAlpha})`;
      lctx.beginPath();
      lctx.moveTo(tw * 0.18, 0);
      lctx.lineTo(tw * 0.38, 0);
      lctx.lineTo(tw * 0.68, th);
      lctx.lineTo(tw * 0.48, th);
      lctx.closePath();
      lctx.fill();

      ctx.drawImage(lit, 0, 0, w, h);

      // 3. 高品质锻造星芒闪光
      for (const [sx, sy, sr] of look.sparks) {
        drawSpark(ctx, sx + pad, sy + pad, sr, look.sparkColor);
      }
    },
    scale,
  );
}

/** 武器/道具图标、宝箱、子弹、毒云、蛛网、回血物等小贴图 */

const drawChest: Draw2D = (ctx) => {
  cContactShadow(ctx, 14, 21.5, 13, 4.2, 0.36);
  // 宝箱柔和金光
  cSoftEllipse(ctx, 14, 13, 14, 11, 'rgba(255,212,84,0.22)', 'rgba(255,212,84,0)');
  // 箱身
  const bodyG = ctx.createLinearGradient(0, 8, 0, 22);
  bodyG.addColorStop(0, '#b27436');
  bodyG.addColorStop(1, '#683c18');
  cRoundRect(ctx, 2.2, 8, 23.6, 13.6, 3.2, bodyG, '#2d1506', 1.8);
  // 箱盖（鼓面高光）
  const lidG = ctx.createLinearGradient(0, 3, 0, 11);
  lidG.addColorStop(0, '#dca054');
  lidG.addColorStop(0.55, '#b67432');
  lidG.addColorStop(1, '#7a461a');
  cRoundRect(ctx, 1.6, 3.2, 24.8, 7.6, 3.4, lidG, '#2d1506', 1.8);
  cLine(ctx, [4.5, 5.2, 23.5, 5.2], 'rgba(255,236,192,0.55)', 1.2);
  // 黄金包边铁带
  const goldG = ctx.createLinearGradient(0, 3, 0, 21);
  goldG.addColorStop(0, '#fff098');
  goldG.addColorStop(0.5, '#f0b832');
  goldG.addColorStop(1, '#9e620c');
  cRoundRect(ctx, 6.8, 3.4, 2.8, 17.8, 1, goldG, '#422206', 0.9);
  cRoundRect(ctx, 18.4, 3.4, 2.8, 17.8, 1, goldG, '#422206', 0.9);
  // 中心金锁扣 + 红宝石
  cRoundRect(ctx, 11.4, 8.2, 5.2, 6.4, 1.6, goldG, '#3c1e06', 1.2);
  cCircle(ctx, 14, 11.4, 1.4, '#ff5442', '#4a0c0a', 0.6);
};

export function generateIcons(scene: Phaser.Scene): void {
  for (const [key, draw] of Object.entries({ ...WEAPON_ICONS, ...M6_WEAPON_ICONS, ...GUN_WEAPON_ICONS })) {
    for (let tier = 0; tier <= 3; tier++) {
      bakeWeaponVariant(scene, weaponTex(key, tier, false), draw, SPRITE_RES, tier, 0);
      bakeWeaponVariant(scene, weaponTex(key, tier, true), draw, 4, tier, 2);
    }
  }
  for (const [id, draw] of Object.entries({ ...ITEM_ICONS, ...M6_ITEM_ICONS })) bakeShadedItem(scene, `i-${id}`, 48, 48, draw, 2);
  bake2D(scene, 'chest', 28, 24, drawChest, SPRITE_RES);
  bake2D(scene, 'chest@ui', 28, 24, drawChest, 4);

  // ---------- 子弹（全部 2x 超采样） ----------
  bake2D(
    scene,
    'needle',
    18,
    6,
    (ctx) => {
      cLine(ctx, [1, 3, 14.5, 3], '#2c541e', 2.6);
      cLine(ctx, [1.5, 3, 14, 3], '#6eb446', 1.4);
      cLine(ctx, [12, 3, 17, 3], '#e0ffb0', 1.4);
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'acorn',
    18,
    18,
    (ctx) => {
      cContactShadow(ctx, 9, 10.5, 7, 6.5, 0.28);
      const nut = cShellGrad(ctx, 7.5, 9, 6.5, '#ffe0a2', '#c8823c', '#6c3a12');
      cEllipse(ctx, 9, 10.5, 5.6, 5.8, nut, '#361c08', 1.4);
      cPoly(ctx, [2.6, 7.6, 9, 3, 15.4, 7.6, 13.4, 9.4, 4.6, 9.4], '#4e2e10', '#241206', 1.3);
      cLine(ctx, [9, 3.2, 10.2, 0.8], '#361c08', 1.8);
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'fluffseed',
    14,
    14,
    (ctx) => {
      cSoftEllipse(ctx, 7, 7, 6.6, 6.6, 'rgba(255,255,248,0.5)', 'rgba(255,255,248,0)');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        cLine(ctx, [7, 7, 7 + Math.cos(a) * 5.6, 7 + Math.sin(a) * 5.6], '#ffffff', 1.1);
      }
      cCircle(ctx, 7, 7, 2.0, '#e6d496', '#6a5628', 0.8);
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'dewdrop',
    18,
    12,
    (ctx) => {
      cSoftEllipse(ctx, 11, 6, 7, 5.5, 'rgba(130,224,255,0.45)', 'rgba(130,224,255,0)');
      const g = cShellGrad(ctx, 10, 4.5, 6, '#ffffff', '#7ad8ff', '#1c629a');
      ctx.beginPath();
      ctx.moveTo(1, 6);
      ctx.quadraticCurveTo(8, 1, 11.8, 1.6);
      ctx.arc(11.8, 6, 4.4, -Math.PI / 2, Math.PI / 2);
      ctx.quadraticCurveTo(8, 11, 1, 6);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#15446e';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      cCircle(ctx, 12.6, 4.4, 1.3, '#ffffff');
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'acid',
    18,
    18,
    (ctx) => {
      cSoftEllipse(ctx, 9, 9, 8.6, 8.6, 'rgba(175,255,64,0.52)', 'rgba(175,255,64,0)');
      const g = cShellGrad(ctx, 7.6, 7.4, 5.5, '#f6ffc8', '#a6f038', '#468414');
      cCircle(ctx, 9, 9, 4.8, g, '#24460a', 1.2);
      cCircle(ctx, 7.3, 7.3, 1.3, '#ffffff');
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'sporeball',
    20,
    20,
    (ctx) => {
      cSoftEllipse(ctx, 10, 10, 9.6, 9.6, 'rgba(210,120,200,0.45)', 'rgba(210,120,200,0)');
      const g = cShellGrad(ctx, 8.5, 8, 6.8, '#f0a6dc', '#a44488', '#48123c');
      cCircle(ctx, 10, 10, 6, g, '#320c28', 1.4);
      for (const [x, y] of [[7.8, 7.8], [12.2, 8.8], [9.8, 12.6]]) cCircle(ctx, x, y, 1.3, '#fce2f6');
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'stinger',
    18,
    7,
    (ctx) => {
      cPoly(ctx, [0.8, 1.2, 11, 2, 17.4, 3.5, 11, 5, 0.8, 5.8], '#1c1206');
      cPoly(ctx, [1.8, 2.2, 6.8, 2.6, 6.8, 4.4, 1.8, 4.8], '#f8be24');
      cLine(ctx, [11.5, 3.5, 16.8, 3.5], '#c0ff60', 1.2);
    },
    SPRITE_RES,
  );
  // 跳蛛吐的丝弹（敌方，亮冰白带紫红警示环，战斗中极易躲避）
  bake2D(
    scene,
    'silk',
    20,
    20,
    (ctx) => {
      cSoftEllipse(ctx, 10, 10, 9.5, 9.5, 'rgba(255,140,160,0.38)', 'rgba(255,140,160,0)');
      const g = cShellGrad(ctx, 8.5, 8.5, 6.2, '#ffffff', '#e6e8fa', '#989ec0');
      cCircle(ctx, 10, 10, 5.8, g, '#665e8a', 1.4);
      cLine(ctx, [5.5, 7.6, 14.5, 12.2], '#8e8eb4', 1);
      cLine(ctx, [6, 13, 14, 6.8], '#8e8eb4', 1);
    },
    SPRITE_RES,
  );

  // ---------- 枪械弹道（纯平赛璐璐粗黑漫画轮廓） ----------
  bake2D(
    scene,
    'bullet',
    16,
    8,
    (ctx) => {
      cPoly(ctx, [1, 2.2, 10.5, 1.8, 15, 4, 10.5, 6.2, 1, 5.8], '#050507');
      cRoundRect(ctx, 2, 2.6, 8.2, 2.8, 1, '#f0a624');
      cPoly(ctx, [9.8, 2.4, 14.2, 4, 9.8, 5.6], '#fff29c');
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'pellet',
    11,
    11,
    (ctx) => {
      cCircle(ctx, 5.5, 5.5, 4.4, '#ff7828', '#050507', 1.6);
      cCircle(ctx, 4.6, 4.4, 1.8, '#ffe690');
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'heavybullet',
    22,
    10,
    (ctx) => {
      cPoly(ctx, [1, 2.4, 14.5, 1.8, 21, 5, 14.5, 8.2, 1, 7.6], '#050507');
      cRoundRect(ctx, 2, 3, 12.2, 4, 1.2, '#e27c24');
      cPoly(ctx, [13.8, 2.6, 19.8, 5, 13.8, 7.4], '#fff4ae');
      cLine(ctx, [3.2, 4.1, 13.2, 4.1], '#ffffff', 0.9);
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'laserbolt',
    24,
    9,
    (ctx) => {
      cRoundRect(ctx, 1, 1.6, 22, 5.8, 2.9, '#1ce0ff', '#050507', 1.4);
      cRoundRect(ctx, 3.2, 3.0, 17.6, 3.0, 1.5, '#ffffff');
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'rocketproj',
    24,
    14,
    (ctx) => {
      // 尾焰
      cPoly(ctx, [0.5, 7, 5.5, 3.8, 5.5, 10.2], '#ff8e24', '#050507', 1.2);
      // 弹翼
      cPoly(ctx, [5, 2.2, 10, 4.8, 10, 9.2, 5, 11.8], '#464d5a', '#050507', 1.2);
      // 弹体 + 红弹头
      cRoundRect(ctx, 6.2, 4.2, 10.2, 5.6, 1.6, '#b0b8c8', '#050507', 1.4);
      cPoly(ctx, [15.4, 4.0, 22.8, 7, 15.4, 10.0], '#e8382c', '#050507', 1.4);
      cLine(ctx, [7.8, 5.4, 15, 5.4], '#ffffff', 1.0);
    },
    SPRITE_RES,
  );

  // ---------- 区域 ----------
  bake2D(scene, 'cloud', 144, 144, (ctx) => {
    cSoftEllipse(ctx, 72, 72, 70, 70, 'rgba(154,226,56,0.32)', 'rgba(130,200,40,0)');
    for (const [x, y, r] of [
      [48, 54, 24],
      [92, 50, 26],
      [82, 92, 24],
      [46, 88, 20],
      [100, 82, 18],
      [72, 72, 28],
    ]) {
      cSoftEllipse(ctx, x, y, r, r, 'rgba(196,250,96,0.28)', 'rgba(160,230,60,0)');
    }
    // 外圈虚线毒气边界
    ctx.strokeStyle = 'rgba(176,245,86,0.32)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(72, 72, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  bake2D(scene, 'webzone', 144, 144, (ctx) => {
    cSoftEllipse(ctx, 72, 72, 68, 68, 'rgba(235,240,255,0.14)', 'rgba(235,240,255,0)');
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      cLine(ctx, [72, 72, 72 + Math.cos(a) * 66, 72 + Math.sin(a) * 66], 'rgba(244,246,255,0.78)', 1.6);
    }
    ctx.strokeStyle = 'rgba(236,240,255,0.72)';
    ctx.lineWidth = 1.3;
    for (const r of [14, 27, 40, 53, 65]) {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a0 = (k / 10) * Math.PI * 2;
        const a1 = ((k + 1) / 10) * Math.PI * 2;
        const am = (a0 + a1) / 2;
        const x0 = 72 + Math.cos(a0) * r;
        const y0 = 72 + Math.sin(a0) * r;
        const xm = 72 + Math.cos(am) * (r * 0.88);
        const ym = 72 + Math.sin(am) * (r * 0.88);
        const x1 = 72 + Math.cos(a1) * r;
        const y1 = 72 + Math.sin(a1) * r;
        if (k === 0) ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(xm, ym, x1, y1);
      }
      ctx.stroke();
    }
  });

  // ---------- 回血物（带柔和绿/粉光晕） ----------
  bake2D(
    scene,
    'fruit',
    24,
    24,
    (ctx) => {
      cSoftEllipse(ctx, 12, 14, 10.5, 10.5, 'rgba(130,255,140,0.34)', 'rgba(130,255,140,0)');
      cContactShadow(ctx, 12, 19.5, 8, 3.2, 0.3);
      cLine(ctx, [12, 7.5, 14, 2.5], '#4e3818', 1.8);
      cEllipse(ctx, 16.5, 4.2, 3.8, 1.8, '#58b438', '#265416', 1, -0.45);
      const fg = cShellGrad(ctx, 10, 11.5, 7.5, '#ff9aa6', '#ee3b4c', '#8c0e20');
      cCircle(ctx, 12, 14, 6.8, fg, '#4a0610', 1.5);
      cEllipse(ctx, 9.6, 11.5, 2.2, 1.3, 'rgba(255,255,255,0.72)', undefined, 0, -0.5);
    },
    SPRITE_RES,
  );
  bake2D(
    scene,
    'mushroom',
    24,
    24,
    (ctx) => {
      cSoftEllipse(ctx, 12, 13, 10.5, 10.5, 'rgba(130,255,140,0.32)', 'rgba(130,255,140,0)');
      cContactShadow(ctx, 12, 19.5, 7.5, 3, 0.3);
      cRoundRect(ctx, 9, 10.5, 6, 9, 2.4, '#f2e8cc', '#5a462a', 1.3);
      const cap = cShellGrad(ctx, 10, 6.5, 9, '#ff7a64', '#de2a1c', '#7a0a0a');
      ctx.beginPath();
      ctx.moveTo(2.4, 12.2);
      ctx.quadraticCurveTo(4, 2.5, 12, 2.5);
      ctx.quadraticCurveTo(20, 2.5, 21.6, 12.2);
      ctx.closePath();
      ctx.fillStyle = cap;
      ctx.fill();
      ctx.strokeStyle = '#4a0808';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (const [x, y, r] of [[8, 7.2, 1.4], [14.8, 6.6, 1.3], [11.6, 10, 1.2]]) cCircle(ctx, x, y, r, '#fff5e4');
    },
    SPRITE_RES,
  );
}
