import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * 纯 Node（零外部依赖）生成《六足战虫》PWA 图标（SVG + 192/512/180 PNG）。
 * 采用与游戏内一致的粗黑漫画墨线（#050507）+ 赛璐璐琥珀锹甲 + 树洞金环风格。
 */

const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#233319"/>
      <stop offset="65%" stop-color="#121a0d"/>
      <stop offset="100%" stop-color="#090c07"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <rect x="20" y="20" width="472" height="472" rx="92" fill="none" stroke="#ffd44c" stroke-width="10" stroke-opacity="0.38"/>
  <circle cx="256" cy="264" r="172" fill="#050507" fill-opacity="0.42"/>
  <circle cx="256" cy="256" r="168" fill="#1b2614" stroke="#050507" stroke-width="16"/>
  <circle cx="256" cy="256" r="154" fill="none" stroke="#5de862" stroke-width="5" stroke-opacity="0.35"/>

  <!-- 六条节肢甲虫腿（粗黑轮廓 + 琥珀高光） -->
  <g stroke="#050507" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M190 205 L118 164 L82 118"/>
    <path d="M322 205 L394 164 L430 118"/>
    <path d="M180 264 L98 258 L62 282"/>
    <path d="M332 264 L414 258 L450 282"/>
    <path d="M192 325 L118 362 L88 416"/>
    <path d="M320 325 L394 362 L424 416"/>
  </g>
  <g stroke="#c45c18" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M190 205 L118 164 L82 118"/>
    <path d="M322 205 L394 164 L430 118"/>
    <path d="M180 264 L98 258 L62 282"/>
    <path d="M332 264 L414 258 L450 282"/>
    <path d="M192 325 L118 362 L88 416"/>
    <path d="M320 325 L394 362 L424 416"/>
  </g>

  <!-- 锹甲威武大钳 -->
  <path d="M222 142 C188 86, 198 42, 244 62 C230 82, 226 106, 238 134 Z" fill="#eb8328" stroke="#050507" stroke-width="16" stroke-linejoin="round"/>
  <path d="M290 142 C324 86, 314 42, 268 62 C282 82, 286 106, 274 134 Z" fill="#eb8328" stroke="#050507" stroke-width="16" stroke-linejoin="round"/>

  <!-- 鞘翅（腹部甲壳） -->
  <ellipse cx="256" cy="306" rx="92" ry="108" fill="#eb8328" stroke="#050507" stroke-width="18"/>
  <path d="M174 286 C174 226, 224 202, 252 202 L252 382 C202 372, 174 334, 174 286 Z" fill="#ffd088" fill-opacity="0.35"/>
  <line x1="256" y1="198" x2="256" y2="412" stroke="#050507" stroke-width="14"/>
  <circle cx="216" cy="278" r="14" fill="#9b410c" stroke="#050507" stroke-width="6"/>
  <circle cx="296" cy="278" r="14" fill="#9b410c" stroke="#050507" stroke-width="6"/>
  <circle cx="222" cy="340" r="17" fill="#9b410c" stroke="#050507" stroke-width="6"/>
  <circle cx="290" cy="340" r="17" fill="#9b410c" stroke="#050507" stroke-width="6"/>

  <!-- 前胸背板 -->
  <ellipse cx="256" cy="196" rx="74" ry="44" fill="#944515" stroke="#050507" stroke-width="17"/>
  <ellipse cx="242" cy="186" rx="46" ry="20" fill="#d87c34" fill-opacity="0.55"/>

  <!-- 头部与漫画大白眼 -->
  <ellipse cx="256" cy="146" rx="52" ry="34" fill="#4d1f07" stroke="#050507" stroke-width="16"/>
  <circle cx="222" cy="138" r="18" fill="#ffffff" stroke="#050507" stroke-width="10"/>
  <circle cx="290" cy="138" r="18" fill="#ffffff" stroke="#050507" stroke-width="10"/>
  <circle cx="225" cy="135" r="7" fill="#050507"/>
  <circle cx="287" cy="135" r="7" fill="#050507"/>

  <!-- 腿尖金星光点（象征六足挂载武器） -->
  <circle cx="82" cy="118" r="12" fill="#ffd44c" stroke="#050507" stroke-width="7"/>
  <circle cx="430" cy="118" r="12" fill="#ffd44c" stroke="#050507" stroke-width="7"/>
  <circle cx="62" cy="282" r="12" fill="#5cd8ff" stroke="#050507" stroke-width="7"/>
  <circle cx="450" cy="282" r="12" fill="#5cd8ff" stroke="#050507" stroke-width="7"/>
  <circle cx="88" cy="416" r="12" fill="#72e884" stroke="#050507" stroke-width="7"/>
  <circle cx="424" cy="416" r="12" fill="#72e884" stroke="#050507" stroke-width="7"/>
</svg>
`;

// ---------- 极简 2D 软光栅 + PNG 编码器 ----------

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function hexToRgb(hex) {
  const v = typeof hex === 'number' ? hex : Number.parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function distToSegment(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const l2 = vx * vx + vy * vy;
  if (l2 === 0) return Math.hypot(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2));
  return Math.hypot(px - (x0 + t * vx), py - (y0 + t * vy));
}

function renderBeetleIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = size / 512;

  const blend = (idx, r, g, b, a) => {
    if (a <= 0) return;
    const ca = Math.min(1, a);
    const inv = 1 - ca;
    buf[idx] = Math.round(r * ca + buf[idx] * inv);
    buf[idx + 1] = Math.round(g * ca + buf[idx + 1] * inv);
    buf[idx + 2] = Math.round(b * ca + buf[idx + 2] * inv);
    buf[idx + 3] = Math.min(255, Math.round(255 * ca + buf[idx + 3] * inv));
  };

  // 在 512×512 归一化坐标下做抗锯齿 SDF 采样渲染
  const legs = [
    [190, 205, 118, 164, 82, 118, 0xffd44c],
    [322, 205, 394, 164, 430, 118, 0xffd44c],
    [180, 264, 98, 258, 62, 282, 0x5cd8ff],
    [332, 264, 414, 258, 450, 282, 0x5cd8ff],
    [192, 325, 118, 362, 88, 416, 0x72e884],
    [320, 325, 394, 362, 424, 416, 0x72e884],
  ];

  const spots = [
    [216, 278, 14],
    [296, 278, 14],
    [222, 340, 17],
    [290, 340, 17],
  ];

  const aa = 1 / scale;

  for (let py = 0; py < size; py++) {
    const y = (py + 0.5) / scale;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / scale;
      const idx = (py * size + px) * 4;

      // 1. 圆角底板
      if (!maskable) {
        const rx = Math.max(0, Math.abs(x - 256) - (256 - 96));
        const ry = Math.max(0, Math.abs(y - 256) - (256 - 96));
        const cornerDist = Math.hypot(rx, ry) - 96;
        if (cornerDist > aa) continue;
        const bgAlpha = cornerDist > -aa ? (aa - cornerDist) / (2 * aa) : 1;
        const rg = Math.min(1, Math.hypot(x - 256, y - 220) / 310);
        const br = Math.round(35 * (1 - rg) + 11 * rg);
        const bg = Math.round(52 * (1 - rg) + 16 * rg);
        const bb = Math.round(25 * (1 - rg) + 10 * rg);
        blend(idx, br, bg, bb, bgAlpha);
      } else {
        const rg = Math.min(1, Math.hypot(x - 256, y - 220) / 340);
        buf[idx] = Math.round(35 * (1 - rg) + 11 * rg);
        buf[idx + 1] = Math.round(52 * (1 - rg) + 16 * rg);
        buf[idx + 2] = Math.round(25 * (1 - rg) + 10 * rg);
        buf[idx + 3] = 255;
      }

      const fillSdf = (d, hex, alpha = 1) => {
        if (d >= aa) return;
        const cov = d <= -aa ? 1 : (aa - d) / (2 * aa);
        const [r, g, b] = hexToRgb(hex);
        blend(idx, r, g, b, cov * alpha);
      };

      // 2. 树洞外环
      const dRing = Math.hypot(x - 256, y - 256) - 172;
      fillSdf(dRing, 0x050507);
      fillSdf(dRing + 15, 0x1b2614);
      const dGoldRing = Math.abs(Math.hypot(x - 256, y - 256) - 148) - 2.5;
      fillSdf(dGoldRing, 0xffd44c, 0.35);

      // 3. 六条节肢腿
      for (const [x0, y0, x1, y1, x2, y2] of legs) {
        const dLeg = Math.min(distToSegment(x, y, x0, y0, x1, y1), distToSegment(x, y, x1, y1, x2, y2));
        fillSdf(dLeg - 13, 0x050507);
        fillSdf(dLeg - 5.8, 0xc45c18);
      }

      // 4. 大钳（左右对称弧形钳）
      for (const s of [-1, 1]) {
        const jx = 256 + s * 42;
        const jy = 104;
        const dOuter = Math.hypot((x - jx) * 1.15, (y - jy) * 0.82) - 42;
        const dInner = Math.hypot((x - (256 + s * 22)) * 1.1, (y - 98) * 0.9) - 28;
        const dJaw = Math.max(dOuter, -dInner);
        fillSdf(dJaw, 0x050507);
        fillSdf(dJaw + 7.5, 0xeb8328);
      }

      // 5. 鞘翅本体
      const dElytra = (Math.hypot((x - 256) / 92, (y - 306) / 108) - 1) * 96;
      fillSdf(dElytra, 0x050507);
      fillSdf(dElytra + 9, x < 256 ? 0xf39234 : 0xd9721e);

      // 鞘翅斑点 & 中缝
      if (dElytra + 9 < 0) {
        for (const [sx, sy, sr] of spots) {
          const dSpot = Math.hypot(x - sx, y - sy) - sr;
          fillSdf(dSpot, 0x050507);
          fillSdf(dSpot + 3.5, 0x8d3808);
        }
        fillSdf(Math.abs(x - 256) - 6.5, 0x050507);
      }

      // 6. 前胸背板
      const dPron = (Math.hypot((x - 256) / 74, (y - 196) / 44) - 1) * 56;
      fillSdf(dPron, 0x050507);
      fillSdf(dPron + 8.5, y < 194 ? 0xb4561c : 0x863a10);

      // 7. 头部 & 大白眼
      const dHead = (Math.hypot((x - 256) / 52, (y - 146) / 34) - 1) * 42;
      fillSdf(dHead, 0x050507);
      fillSdf(dHead + 8, 0x4d1f07);

      for (const s of [-1, 1]) {
        const ex = 256 + s * 34;
        const ey = 138;
        const dEye = Math.hypot(x - ex, y - ey) - 18;
        fillSdf(dEye, 0x050507);
        fillSdf(dEye + 5, 0xffffff);
        const dPupil = Math.hypot(x - (ex - s * 2), y - (ey - 2)) - 6.8;
        fillSdf(dPupil, 0x050507);
      }

      // 8. 六足末端武器光珠
      for (const [, , , , x2, y2, col] of legs) {
        const dTip = Math.hypot(x - x2, y - y2) - 13;
        fillSdf(dTip, 0x050507);
        fillSdf(dTip + 4.5, col);
      }
    }
  }

  return encodePng(size, size, buf);
}

const pubDir = path.resolve(process.cwd(), 'public');
const iconsDir = path.join(pubDir, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), SVG_ICON, 'utf8');
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), renderBeetleIcon(192, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), renderBeetleIcon(512, false));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), renderBeetleIcon(512, true));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), renderBeetleIcon(180, true));

console.log('Generated PWA icons in public/icons/');
