/** 画面逻辑分辨率（16:9，按 FIT 缩放到屏幕） */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** 战场大小 */
export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 1400;
/** 玩家离地图边缘的最小距离（边缘是一圈石头） */
export const WORLD_MARGIN = 56;

export const FONT_FAMILY =
  '"Lilita One", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
export const DISPLAY_FONT =
  '"Lilita One", "ZCOOL KuaiLe", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const NUM_FONT =
  '"Lilita One", "ZCOOL KuaiLe", "DIN Alternate", "Impact", sans-serif';

/** 触屏为主的设备（手机、平板） */
export const IS_COARSE_POINTER =
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

/**
 * 高清渲染倍率：按显示器物理分辨率与 DPR 自动匹配（桌面端至少 2 倍 2560×1440，
 * 4K / 大屏最高升至 3 倍 3840×2160；移动端最高 1.75 倍兼顾性能）。
 * 所有场景镜头同步按此倍率缩放，布局仍保持 1280×720 逻辑坐标。
 */
export const RENDER_SCALE = (() => {
  if (typeof window === 'undefined') return 2;
  const dpr = window.devicePixelRatio || 1;
  const vw = Math.max(window.innerWidth || 0, window.screen?.availWidth || 0, GAME_WIDTH);
  const vh = Math.max(window.innerHeight || 0, window.screen?.availHeight || 0, GAME_HEIGHT);
  const fitScale = Math.min(vw / GAME_WIDTH, vh / GAME_HEIGHT);
  const physicalScale = dpr * fitScale;
  const minScale = IS_COARSE_POINTER ? 1 : 2;
  const maxScale = IS_COARSE_POINTER ? 1.75 : 3;
  const k = Math.min(maxScale, Math.max(minScale, physicalScale));
  return Math.round(k * 4) / 4;
})();

/** 手机上屏幕小，HUD 整体放大、其他界面的文字放大 */
export const HUD_SCALE = IS_COARSE_POINTER ? 1.3 : 1;
export const FONT_BOOST = IS_COARSE_POINTER ? 1.25 : 1;

/** 按设备放大后的字号（像素字符串） */
export function fontPx(size: number): string {
  return `${Math.round(size * FONT_BOOST)}px`;
}

/** 战斗镜头缩放：视野更开阔，方便观察周围弹幕与走位 */
export const CAMERA_ZOOM = 1.05;

/** 同屏怪物上限 */
export const MAX_ENEMIES = IS_COARSE_POINTER ? 150 : 250;

export const DEPTH = {
  ground: 0,
  nectar: 5,
  mound: 6,
  enemy: 10,
  player: 20,
  projectile: 30,
  effect: 40,
  text: 50,
} as const;
