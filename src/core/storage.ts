import { createJSONStorage, type StateStorage } from 'zustand/middleware';

export interface CompatStorageOptions {
  /** 沙盒模式（模拟玩家/单测）时屏蔽读写，绝不污染真实浏览器存储 */
  isSandbox?: () => boolean;
  /** 若旧版本存的是未包裹 `{ state, version }` 的裸 JSON，可用此函数转换字段结构 */
  legacyWrap?: (raw: unknown) => Record<string, unknown>;
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * 兼容旧版裸 JSON 的 Zustand JSON Storage：
 * - Node 单测环境或隐私模式禁用存储时安全降级为空操作；
 * - 沙盒开启时完全隔离内存，不读写 localStorage；
 * - 首次读到旧版无 `{ state, version }` 外壳的存档时自动包装并无缝迁移。
 */
export function createCompatStorage<T>(options: CompatStorageOptions = {}) {
  const { isSandbox, legacyWrap } = options;
  const rawStorage: StateStorage = {
    getItem(name: string): string | null {
      if (isSandbox?.() || !hasLocalStorage()) return null;
      try {
        const raw = window.localStorage.getItem(name);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && 'state' in parsed) {
          return raw;
        }
        const wrapped = legacyWrap ? legacyWrap(parsed) : (parsed as Record<string, unknown>);
        return JSON.stringify({ state: wrapped, version: 0 });
      } catch {
        return null;
      }
    },
    setItem(name: string, value: string): void {
      if (isSandbox?.() || !hasLocalStorage()) return;
      try {
        window.localStorage.setItem(name, value);
      } catch {
        // 隐私模式或配额不足时忽略，仅在当前会话生效
      }
    },
    removeItem(name: string): void {
      if (isSandbox?.() || !hasLocalStorage()) return;
      try {
        window.localStorage.removeItem(name);
      } catch {
        // 忽略
      }
    },
  };
  return createJSONStorage<T>(() => rawStorage);
}

/** 多标签页同步：其他标签页修改同一 localStorage key 时自动 rehydrate，防止旧缓存覆盖新进度 */
export function syncOnStorageEvent(key: string, rehydrate: () => void, isSandbox?: () => boolean): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  window.addEventListener('storage', (e) => {
    if (e.key === key && !isSandbox?.()) {
      rehydrate();
    }
  });
}
