import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { DISPLAY_FONT, fontPx } from '../config';

export type ButtonShape = 'bevel' | 'slant' | 'notch';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  /** 主按钮（醒目琥珀金）还是次按钮（暗炭黑框，悬停反白） */
  primary?: boolean;
  /** 特殊风格：emerald（鲜绿，如免费刷新/可合成） */
  variant?: 'emerald';
  /** 按钮造型：bevel（非对称切角硬壳牌）、slant（斜切竞技徽条）、notch（八角按键帽） */
  shape?: ButtonShape;
  /** 可选左侧品质/天气竖条色 */
  accentColor?: number;
  /** 禁用：变灰、不能点 */
  disabled?: boolean;
  /** 文字后面跟一个小图标（贴图 key） */
  icon?: string;
  /** 文字前面跟一个小图标（贴图 key） */
  leftIcon?: string;
}

interface Palette {
  bg: number;
  lip: number;
  hoverBg: number;
  hoverLip: number;
  border: number;
  hoverBorder: number;
  text: string;
  hoverText: string;
  stripe: number;
}

export interface KeycapSpec {
  w: number;
  h: number;
  shape: ButtonShape;
  bg: number;
  lip: number;
  border: number;
  lipH: number;
  ox: number;
  oy: number;
  stripe?: number;
  stripeAlpha?: number;
  accentColor?: number;
  accentAlpha?: number;
  lightBevel?: boolean;
  cornerTicks?: boolean;
  wingSlashes?: boolean;
}

export type Pt = { x: number; y: number };

/** 构建四角可独立切角的多边形（替代呆板圆角矩形） */
export function chamferPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr = tl,
  br = tl,
  bl = tl,
): Pt[] {
  const maxC = Math.floor(Math.min(w, h) * 0.42);
  const c1 = Math.min(tl, maxC);
  const c2 = Math.min(tr, maxC);
  const c3 = Math.min(br, maxC);
  const c4 = Math.min(bl, maxC);
  return [
    { x: x + c1, y },
    { x: x + w - c2, y },
    { x: x + w, y: y + c2 },
    { x: x + w, y: y + h - c3 },
    { x: x + w - c3, y: y + h },
    { x: x + c4, y: y + h },
    { x, y: y + h - c4 },
    { x, y: y + c1 },
  ];
}

/** 构建带微倒角的平行四边形斜切徽条 */
export function slantPoints(x: number, y: number, w: number, h: number, skew: number): Pt[] {
  const s = Math.min(skew, Math.floor(w * 0.16));
  const half = s * 0.5;
  const micro = Math.min(3, Math.floor(h * 0.08));
  return [
    { x: x + half + micro, y },
    { x: x + w + half - micro, y },
    { x: x + w + half, y: y + micro },
    { x: x + w - half, y: y + h - micro },
    { x: x + w - half - micro, y: y + h },
    { x: x - half + micro, y: y + h },
    { x: x - half, y: y + h - micro },
    { x: x + half, y: y + micro },
  ];
}

function buildShapePoints(x: number, y: number, w: number, h: number, shape: ButtonShape): Pt[] {
  if (shape === 'slant') {
    const skew = Phaser.Math.Clamp(Math.round(h * 0.24), 8, 15);
    return slantPoints(x, y, w, h, skew);
  }
  if (shape === 'notch') {
    const c = Phaser.Math.Clamp(Math.round(Math.min(w, h) * 0.2), 5, 11);
    return chamferPoints(x, y, w, h, c, c, c, c);
  }
  // bevel：对称硬朗切角（与方正面板对齐，避免歪斜视觉错位）
  const c = Phaser.Math.Clamp(Math.round(Math.min(w, h) * 0.14), 5, 8);
  return chamferPoints(x, y, w, h, c, c, c, c);
}

export function tracePoly(g: Phaser.GameObjects.Graphics, pts: Pt[]): void {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
}

export function fillPoly(g: Phaser.GameObjects.Graphics, pts: Pt[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  tracePoly(g, pts);
  g.fillPath();
}

export function strokePoly(g: Phaser.GameObjects.Graphics, pts: Pt[], width: number, color: number, alpha = 1): void {
  g.lineStyle(width, color, alpha);
  tracePoly(g, pts);
  g.strokePath();
}

/** 缩小一圈用于内描边（向中心收 inset 像素） */
export function insetPoints(pts: Pt[], inset: number): Pt[] {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const sx = Math.abs(dx) > 1 ? Math.max(2, Math.abs(dx) - inset) * Math.sign(dx) : dx;
    const sy = Math.abs(dy) > 1 ? Math.max(2, Math.abs(dy) - inset) * Math.sign(dy) : dy;
    return { x: cx + sx, y: cy + sy };
  });
}

/**
 * 统一绘制带 3D 机械按压底边、硬黑投影与斜切角徽章细节的按键帽
 * 供主按钮、商店锁定键、战斗暂停键共用。
 */
export function drawKeycap(g: Phaser.GameObjects.Graphics, spec: KeycapSpec): void {
  const { w, h, shape, bg, lip, border, lipH, ox, oy } = spec;
  const x = -w / 2;
  const y = -h / 2;
  g.clear();

  // 1. 纯黑硬偏移漫画投影
  const shadowPts = buildShapePoints(x + 4, y + lipH + 4, w, h, shape);
  fillPoly(g, shadowPts, 0x050507, 0.94);

  // 2. 3D 实体底座厚度边（按下时顶面落入底座形成真实物理按键感）
  const basePts = buildShapePoints(x + ox, y + lipH, w, h, shape);
  fillPoly(g, basePts, lip, 1);
  strokePoly(g, basePts, 2.8, 0x050507, 1);

  // 3. 按钮主顶面
  const facePts = buildShapePoints(x + ox, y + oy, w, h, shape);
  fillPoly(g, facePts, bg, 1);

  // 4. 顶面左侧斜彩条（可选：用于天气难度/特殊标识）
  if (spec.accentColor !== undefined) {
    const stripeW = 8;
    if (shape === 'slant') {
      const skew = Phaser.Math.Clamp(Math.round(h * 0.24), 8, 15);
      const half = skew * 0.5;
      const sx0 = x + ox;
      fillPoly(
        g,
        [
          { x: sx0 + half + 3, y: y + oy + 2 },
          { x: sx0 + half + 3 + stripeW, y: y + oy + 2 },
          { x: sx0 - half + 3 + stripeW, y: y + oy + h - 2 },
          { x: sx0 - half + 3, y: y + oy + h - 2 },
        ],
        spec.accentColor,
        spec.accentAlpha ?? 0.95,
      );
    } else {
      g.fillStyle(spec.accentColor, spec.accentAlpha ?? 0.95);
      g.fillRect(x + ox + 5, y + oy + 8, 4, h - 16);
    }
  }

  // 5. 右翼动感斜纹 / 边角机械刻度（让大按钮告别空洞扁平感）
  if (spec.wingSlashes && w >= 150) {
    const sCol = spec.stripe ?? 0xffffff;
    const sAlpha = spec.stripeAlpha ?? 0.16;
    const slantOffset = shape === 'slant' ? 6 : 10;
    const rx = x + ox + w - (shape === 'slant' ? 18 : 22);
    const sy0 = y + oy + 6;
    const sy1 = y + oy + h - 6;
    for (let k = 0; k < 2; k++) {
      const kx = rx - k * 11;
      const kw = k === 0 ? 5 : 3;
      fillPoly(
        g,
        [
          { x: kx + slantOffset, y: sy0 },
          { x: kx + slantOffset + kw, y: sy0 },
          { x: kx, y: sy1 },
          { x: kx - kw, y: sy1 },
        ],
        sCol,
        sAlpha,
      );
    }
  }

  // 6. 上沿立体高光棱线（沿着顶面与左上斜角，模拟漫反射斜切倒角）
  if (spec.lightBevel !== false) {
    g.lineStyle(2, 0xffffff, 0.24);
    g.beginPath();
    g.moveTo(facePts[7].x + 2, facePts[7].y);
    g.lineTo(facePts[0].x, facePts[0].y + 2);
    g.lineTo(facePts[1].x, facePts[1].y + 2);
    g.strokePath();
  }

  // 7. 次按钮内角小折线卡扣（硬核机械铭牌细节）
  if (spec.cornerTicks && w >= 90) {
    g.lineStyle(2, border, 0.52);
    const p1 = facePts[1];
    const p5 = facePts[5];
    g.beginPath();
    g.moveTo(p1.x - 14, p1.y + 5);
    g.lineTo(p1.x - 2, p1.y + 5);
    g.lineTo(p1.x + 2, p1.y + 9);
    g.moveTo(p5.x + 14, p5.y - 5);
    g.lineTo(p5.x + 2, p5.y - 5);
    g.lineTo(p5.x - 2, p5.y - 9);
    g.strokePath();
  }

  // 8. 内高光/品质线框 + 最外层 3px 纯黑漫画墨边
  const inner = insetPoints(facePts, 2.2);
  strokePoly(g, inner, 1.8, border, 0.9);
  strokePoly(g, facePts, 3, 0x050507, 1);
}

/**
 * 立体雕塑风漫画按键：
 * 非对称切角 / 平行斜切 / 八角键帽 + 3D 机械按压底边 + 高对比悬停反白弹跳
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 240;
  const h = opts.height ?? 64;
  const primary = opts.primary ?? true;
  const disabled = opts.disabled ?? false;
  const shape: ButtonShape = opts.shape ?? 'bevel';
  const lipH = h >= 56 ? 5 : 4;

  const colors: Palette = disabled
    ? {
        bg: 0x1b1c22,
        lip: 0x0f1014,
        hoverBg: 0x1b1c22,
        hoverLip: 0x0f1014,
        border: 0x3a3e4a,
        hoverBorder: 0x3a3e4a,
        text: '#888d9c',
        hoverText: '#888d9c',
        stripe: 0xffffff,
      }
    : opts.variant === 'emerald'
      ? {
          bg: 0x329036,
          lip: 0x194e1c,
          hoverBg: 0x45b649,
          hoverLip: 0x216625,
          border: 0x7ef082,
          hoverBorder: 0xffffff,
          text: '#f5fff4',
          hoverText: '#ffffff',
          stripe: 0xd8ffda,
        }
      : primary
        ? {
            bg: 0xe39622,
            lip: 0x94540a,
            hoverBg: 0xf7b63a,
            hoverLip: 0xa8630e,
            border: 0xffe48a,
            hoverBorder: 0xffffff,
            text: '#140b03',
            hoverText: '#090501',
            stripe: 0xfff3c4,
          }
        : {
            bg: 0x252730,
            lip: 0x121318,
            hoverBg: 0xf0efe9,
            hoverLip: 0x8e8d87,
            border: 0x5c606e,
            hoverBorder: 0x050507,
            text: '#f2f1ec',
            hoverText: '#111216',
            stripe: 0xffffff,
          };

  const bg = scene.add.graphics();
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: DISPLAY_FONT,
      fontSize: fontPx(opts.fontSize ?? 26),
      fontStyle: 'bold',
      color: colors.text,
    })
    .setOrigin(0.5);
  const parts: Phaser.GameObjects.GameObject[] = [bg, text];

  const iconSize = Math.round(h * 0.46);
  const gap = 7;
  let leftImg: Phaser.GameObjects.Image | null = null;
  let rightImg: Phaser.GameObjects.Image | null = null;

  const extraW = (opts.leftIcon ? iconSize + gap : 0) + (opts.icon ? iconSize + gap : 0);
  const accentPad = opts.accentColor !== undefined ? 12 : 0;
  const room = w - 32 - extraW - accentPad;
  if (text.width > room && room > 10) text.setScale(room / text.width);

  const tw = text.displayWidth;
  const total = tw + extraW;
  const xShift = opts.accentColor !== undefined ? 5 : 0;
  let cursor = -total / 2 + xShift;

  if (opts.leftIcon) {
    leftImg = scene.add.image(cursor + iconSize / 2, 0, opts.leftIcon).setDisplaySize(iconSize, iconSize);
    if (disabled) leftImg.setAlpha(0.55);
    parts.push(leftImg);
    cursor += iconSize + gap;
  }

  text.x = cursor + tw / 2;
  cursor += tw + gap;

  if (opts.icon) {
    rightImg = scene.add.image(cursor + iconSize / 2, 0, opts.icon).setDisplaySize(iconSize, iconSize);
    if (disabled) rightImg.setAlpha(0.55);
    parts.push(rightImg);
  }

  const draw = (state: 'idle' | 'hover' | 'down') => {
    const isDown = state === 'down';
    const isHover = state === 'hover';
    const ox = isDown ? 0 : 0;
    const oy = isDown ? lipH - 1 : isHover ? -1 : 0;
    const active = isHover || isDown;

    drawKeycap(bg, {
      w,
      h,
      shape,
      bg: active ? colors.hoverBg : colors.bg,
      lip: active ? colors.hoverLip : colors.lip,
      border: isHover ? colors.hoverBorder : colors.border,
      lipH,
      ox,
      oy,
      stripe: colors.stripe,
      stripeAlpha: primary || opts.variant === 'emerald' ? 0.22 : 0.08,
      accentColor: opts.accentColor,
      accentAlpha: disabled ? 0.45 : 0.95,
      lightBevel: !disabled && !(!primary && !opts.variant && active),
      cornerTicks: !disabled && !primary && !opts.variant,
      wingSlashes: !disabled && shape === 'slant' && (primary || opts.variant === 'emerald'),
    });

    text.setColor(active ? colors.hoverText : colors.text);
    text.x = -total / 2 + xShift + (opts.leftIcon ? iconSize + gap : 0) + tw / 2 + ox;
    text.y = oy;
    if (leftImg) {
      leftImg.x = -total / 2 + xShift + iconSize / 2 + ox;
      leftImg.y = oy;
    }
    if (rightImg) {
      rightImg.x = -total / 2 + xShift + (opts.leftIcon ? iconSize + gap : 0) + tw + gap + iconSize / 2 + ox;
      rightImg.y = oy;
    }
  };
  draw('idle');

  const c = scene.add.container(x, y, parts).setSize(w, h + lipH);
  if (disabled) return c;

  c.setInteractive({ useHandCursor: true });
  let pressed = false;
  c.on('pointerover', () => {
    draw('hover');
    scene.tweens.killTweensOf(c);
    scene.tweens.add({ targets: c, scale: 1.035, duration: 75, ease: 'Quad.Out' });
  });
  c.on('pointerout', () => {
    pressed = false;
    draw('idle');
    scene.tweens.killTweensOf(c);
    scene.tweens.add({ targets: c, scale: 1, duration: 75, ease: 'Quad.Out' });
  });
  c.on('pointerdown', () => {
    pressed = true;
    draw('down');
    scene.tweens.killTweensOf(c);
    scene.tweens.add({ targets: c, scale: 0.99, duration: 45, ease: 'Quad.Out' });
    sfx.play('click');
  });
  c.on('pointerup', () => {
    if (!pressed) return;
    pressed = false;
    draw('hover');
    scene.tweens.killTweensOf(c);
    scene.tweens.add({ targets: c, scale: 1.035, duration: 75, ease: 'Quad.Out' });
    onClick();
  });
  return c;
}
