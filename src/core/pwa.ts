/**
 * PWA 运行时管理：
 * - 注册 Service Worker（支持离线缓存与静默更新）
 * - 捕获浏览器 beforeinstallprompt 事件，支持在主菜单 / 设置中一键安装到桌面或主屏幕
 * - 检测 standalone / fullscreen 独立窗口运行状态及 iOS Safari「添加到主屏幕」引导
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
/** 本次会话内已完成安装：只用于隐藏安装入口，不代表当前页面运行在独立窗口里 */
let installedFlag = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

/** 当前是否已处于 PWA 独立窗口模式（桌面/手机主屏幕启动） */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)').matches === true ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches === true
  );
}

/** 是否为支持「添加到主屏幕」但没有 beforeinstallprompt 的 iOS/iPadOS 浏览器 */
export function isIosManualInstall(): boolean {
  if (typeof window === 'undefined' || isStandalonePwa()) return false;
  const ua = window.navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  return isIOS;
}

/** 当前是否可以显示「安装应用」入口（捕获到了原生安装事件，或处于 iOS 浏览器） */
export function canInstallPwa(): boolean {
  if (installedFlag || isStandalonePwa()) return false;
  return deferredPrompt !== null || isIosManualInstall();
}

/** 是否有原生一键安装弹窗可用 */
export function hasNativeInstallPrompt(): boolean {
  return !installedFlag && !isStandalonePwa() && deferredPrompt !== null;
}

/** 订阅 PWA 安装状态变化 */
export function onPwaStateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 触发 PWA 安装流程：
 * - 支持 beforeinstallprompt 的浏览器（Chrome / Edge / Android）：直接弹出系统安装确认框
 * - iOS Safari：返回 'ios-guide'，由调用方给出「分享 -> 添加到主屏幕」提示
 */
export async function triggerPwaInstall(): Promise<'accepted' | 'dismissed' | 'ios-guide' | 'unavailable'> {
  if (installedFlag || isStandalonePwa()) return 'unavailable';
  if (deferredPrompt) {
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    notify();
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        installedFlag = true;
        notify();
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'dismissed';
    }
  }
  if (isIosManualInstall()) {
    return 'ios-guide';
  }
  return 'unavailable';
}

/** 初始化 PWA 事件监听并在生产环境下注册 Service Worker */
export function initPwa(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedFlag = true;
    notify();
  });

  // PWA 独立窗口模式下自动尝试锁定横屏（支持的移动设备生效，不支持的静默忽略）
  if (isStandalonePwa()) {
    const ori = (screen as Screen & { orientation?: { lock?: (mode: string) => Promise<void> } }).orientation;
    ori?.lock?.('landscape').catch(() => undefined);
  }

  // 仅在生产构建（非 Vite HMR 开发模式）注册 Service Worker，避免干扰本地开发热更新与平衡测试脚本
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .then((reg) => {
          // 检测到新版本 SW 等待激活时，通知其平滑接管缓存
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(() => undefined);
    });
  }
}
