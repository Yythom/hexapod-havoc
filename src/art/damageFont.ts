import Phaser from 'phaser';
import { NUM_FONT } from '../config';

/**
 * 伤害数字用的位图字体：启动时把 0-9、+、- 画进一张贴图。
 * 之后每个数字只是拼贴图，不用像普通文字那样每次重画、重新上传贴图，战斗中数字很多时省很多。
 * 字形是白色描深色边，用 tint 上色。
 */
export const DAMAGE_FONT = 'dmgfont';
/** 字形绘制的字号，显示时按需要缩放 */
export const DAMAGE_FONT_SIZE = 48;

const GLYPHS = '0123456789+-';
const STROKE = 8;
const PAD = 4;

export function ensureDamageFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(DAMAGE_FONT)) return;
  const font = `bold ${DAMAGE_FONT_SIZE}px ${NUM_FONT}`;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const widths = [...GLYPHS].map((ch) => Math.ceil(measure.measureText(ch).width));
  const cellH = DAMAGE_FONT_SIZE + PAD * 2 + STROKE;
  const cells = widths.map((w) => w + PAD * 2 + STROKE);
  const texW = cells.reduce((a, b) => a + b, 0);

  const tex = scene.textures.createCanvas(DAMAGE_FONT, texW, cellH)!;
  const ctx = tex.getContext();
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';

  // Phaser 运行时会读 xAdvance（字距），但类型定义里漏了，这里补上
  type Glyph = Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };
  const chars: Record<number, Glyph> = {};
  let x = 0;
  [...GLYPHS].forEach((ch, i) => {
    const cw = cells[i];
    const ox = x + PAD + STROKE / 2;
    const oy = PAD + STROKE / 2;
    // 微投影 + 深墨描边 + 顶部暖亮垂直渐变（用 tint 染色时依然保留立体明暗）
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 2;
    ctx.lineWidth = STROKE;
    ctx.strokeStyle = '#180c04';
    ctx.strokeText(ch, ox, oy);
    ctx.restore();

    const grad = ctx.createLinearGradient(0, oy, 0, oy + DAMAGE_FONT_SIZE);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#f6efd8');
    grad.addColorStop(1, '#cfbfa0');
    ctx.fillStyle = grad;
    ctx.fillText(ch, ox, oy);
    chars[ch.charCodeAt(0)] = {
      x,
      y: 0,
      width: cw,
      height: cellH,
      centerX: Math.floor(cw / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: 0,
      yOffset: 0,
      // 字距比格子窄，描边互相重叠，看起来是一整串
      xAdvance: widths[i] + 2,
      data: {},
      kerning: {},
      u0: x / texW,
      v0: 0,
      u1: (x + cw) / texW,
      v1: 1,
    };
    x += cw;
  });
  tex.refresh();

  scene.cache.bitmapFont.add(DAMAGE_FONT, {
    data: { font: DAMAGE_FONT, size: DAMAGE_FONT_SIZE, lineHeight: cellH, retroFont: false, chars },
    texture: DAMAGE_FONT,
    frame: null,
  });
}
