import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { createCompatStorage, syncOnStorageEvent } from './storage';

export type DamageNumberMode = 'all' | 'crit' | 'off';

/** 玩家设置：音效音量、背景音乐、震屏、隐藏武器、伤害数字分级、瞄准模式、视角缩放。和进度存档分开存。 */
export interface Settings {
  /** 0 表示关闭 */
  volume: number;
  bgm: boolean;
  shake: boolean;
  hideWeapons: boolean;
  damageNumbers: DamageNumberMode;
  manualAim: boolean;
  /** 战斗视角缩放倍率（1 = 默认/最大视野，只能向上拉近放大） */
  cameraZoom: number;
}

export interface SettingsStoreState extends Settings {
  update: (patch: Partial<Settings>) => Settings;
  reset: () => void;
}

export const VOLUME_STEPS = [
  { value: 0, label: '关' },
  { value: 0.35, label: '小' },
  { value: 0.7, label: '中' },
  { value: 1, label: '大' },
];

const DAMAGE_NUMBER_MODES: { value: DamageNumberMode; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'crit', label: '仅暴击' },
  { value: 'off', label: '关闭' },
];

export const CAMERA_ZOOM_STEPS = [
  { value: 1, label: '100%（最大视野）' },
  { value: 1.15, label: '115%（较近）' },
  { value: 1.3, label: '130%（近景）' },
  { value: 1.45, label: '145%（特写）' },
];

export const MIN_CAMERA_ZOOM = CAMERA_ZOOM_STEPS[0].value;
export const MAX_CAMERA_ZOOM = CAMERA_ZOOM_STEPS[CAMERA_ZOOM_STEPS.length - 1].value;

const KEY = 'hexapod-havoc-settings-v1';

const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  bgm: true,
  shake: true,
  hideWeapons: false,
  damageNumbers: 'all',
  manualAim: false,
  cameraZoom: 1,
};

function sanitizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  if (typeof raw.volume === 'number' && Number.isFinite(raw.volume)) s.volume = Math.min(1, Math.max(0, raw.volume));
  if (typeof raw.bgm === 'boolean') s.bgm = raw.bgm;
  if (typeof raw.shake === 'boolean') s.shake = raw.shake;
  if (typeof raw.hideWeapons === 'boolean') s.hideWeapons = raw.hideWeapons;
  if (raw.damageNumbers === 'all' || raw.damageNumbers === 'crit' || raw.damageNumbers === 'off') {
    s.damageNumbers = raw.damageNumbers;
  }
  if (typeof raw.manualAim === 'boolean') s.manualAim = raw.manualAim;
  if (typeof raw.cameraZoom === 'number' && Number.isFinite(raw.cameraZoom)) {
    s.cameraZoom = Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, raw.cameraZoom));
  }
  return s;
}

function pickSettings(s: SettingsStoreState): Settings {
  return {
    volume: s.volume,
    bgm: s.bgm,
    shake: s.shake,
    hideWeapons: s.hideWeapons,
    damageNumbers: s.damageNumbers,
    manualAim: s.manualAim,
    cameraZoom: s.cameraZoom,
  };
}

/** 全局设置 Zustand Store（自动持久化、旧版裸 JSON 兼容迁移、多标签页自动同步） */
export const useSettingsStore = createStore<SettingsStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => {
        const next = sanitizeSettings({ ...pickSettings(get()), ...patch });
        set(next);
        return next;
      },
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: KEY,
      version: 1,
      storage: createCompatStorage<Settings>(),
      partialize: (state) => pickSettings(state),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSettings(persisted as Partial<Settings> | undefined),
      }),
    },
  ),
);

syncOnStorageEvent(KEY, () => {
  void useSettingsStore.persist.rehydrate();
});

export function getSettings(): Settings {
  return pickSettings(useSettingsStore.getState());
}

export function updateSettings(patch: Partial<Settings>): Settings {
  return useSettingsStore.getState().update(patch);
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

export function damageNumbersLabel(m: DamageNumberMode): string {
  return DAMAGE_NUMBER_MODES.find((x) => x.value === m)?.label ?? '全部';
}

export function nextDamageNumbers(m: DamageNumberMode): DamageNumberMode {
  const i = DAMAGE_NUMBER_MODES.findIndex((x) => x.value === m);
  return DAMAGE_NUMBER_MODES[(i + 1) % DAMAGE_NUMBER_MODES.length].value;
}

export function cameraZoomLabel(z: number): string {
  let best = CAMERA_ZOOM_STEPS[0];
  for (const step of CAMERA_ZOOM_STEPS) {
    if (Math.abs(step.value - z) < Math.abs(best.value - z)) best = step;
  }
  return best.label;
}

/** 下一档视角缩放（循环） */
export function nextCameraZoom(z: number): number {
  const i = CAMERA_ZOOM_STEPS.findIndex((s) => s.label === cameraZoomLabel(z));
  return CAMERA_ZOOM_STEPS[(i + 1) % CAMERA_ZOOM_STEPS.length].value;
}
