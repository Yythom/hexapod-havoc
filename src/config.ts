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
 * 高清渲染倍率：画布按设备像素密度放大，文字和线条更清晰。
 * 手机最多 1.5 倍（兼顾性能），电脑最多 2 倍。所有场景的镜头都按这个倍率放大，
 * 所以布局坐标仍然是 1280×720 的逻辑坐标。
 */
export const RENDER_SCALE = (() => {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const k = Math.min(IS_COARSE_POINTER ? 1.5 : 2, Math.max(1, dpr));
  return Math.round(k * 4) / 4;
})();

/** 手机上屏幕小，HUD 整体放大、其他界面的文字放大 */
export const HUD_SCALE = IS_COARSE_POINTER ? 1.3 : 1;
export const FONT_BOOST = IS_COARSE_POINTER ? 1.25 : 1;

/** 按设备放大后的字号（像素字符串） */
export function fontPx(size: number): string {
  return `${Math.round(size * FONT_BOOST)}px`;
}

/** 战斗镜头缩放：放大一点让角色和怪物更容易看清 */
export const CAMERA_ZOOM = 1.2;

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
