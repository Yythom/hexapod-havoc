/** 玩家设置：音效音量、震屏开关。和进度存档分开存。 */
export interface Settings {
  /** 0 表示关闭 */
  volume: number;
  shake: boolean;
}

export const VOLUME_STEPS = [
  { value: 0, label: '关' },
  { value: 0.35, label: '小' },
  { value: 0.7, label: '中' },
  { value: 1, label: '大' },
];

const KEY = 'hexapod-havoc-settings-v1';
let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  const s: Settings = { volume: 0.7, shake: true };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      if (typeof parsed.volume === 'number') s.volume = Math.min(1, Math.max(0, parsed.volume));
      if (typeof parsed.shake === 'boolean') s.shake = parsed.shake;
    }
  } catch {
    // 读不到就用默认设置
  }
  cache = s;
  return s;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = Object.assign(getSettings(), patch);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 写不进去就只在本次会话生效
  }
  return s;
}

export function volumeLabel(v: number): string {
  let best = VOLUME_STEPS[0];
  for (const step of VOLUME_STEPS) if (Math.abs(step.value - v) < Math.abs(best.value - v)) best = step;
  return best.label;
}

/** 下一档音量（循环） */
export function nextVolume(v: number): number {
  const i = VOLUME_STEPS.findIndex((s) => s.label === volumeLabel(v));
  return VOLUME_STEPS[(i + 1) % VOLUME_STEPS.length].value;
}
