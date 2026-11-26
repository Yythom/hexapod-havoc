/* eslint-disable no-restricted-globals */
/**
 * 《六足战虫》PWA 离线缓存 Service Worker：
 * - 构建时由 vite.config.ts 自动注入版本号与核心构建产物（index.html、JS、CSS、图标、manifest）
 * - 带内容哈希的静态资源（/assets/*，含按需加载的字体切片 .woff2/.woff）采用 Cache-First 并自动写入缓存
 * - 页面导航（mode === 'navigate'，含 ?challenge=HHS1:... 分享挑战链接）采用 Network-First，断网回退缓存的 index.html
 */

const CACHE_VERSION = '__PWA_CACHE_VERSION__';
const CACHE_NAME = `hexapod-havoc-${CACHE_VERSION}`;

const PRECACHE_URLS = /* __PWA_PRECACHE_LIST__ */ [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('hexapod-havoc-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1. 页面导航请求（支持离线打开或带 ?challenge= 参数启动）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(req, { ignoreSearch: true })) ||
            (await cache.match('./index.html')) ||
            (await cache.match('./'))
          );
        }),
    );
    return;
  }

  // 2. 带内容哈希的构建产物（/assets/*）与图标：Cache-First + 动态落盘（覆盖按需加载的字体切片）
  const isImmutableAsset =
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/icons/') ||
    /\.(?:woff2?|ttf|png|svg|webp|js|css)$/i.test(url.pathname);

  if (isImmutableAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Vite 产物带 crossorigin，请求会携带 Origin；部分服务器响应含 Vary: Origin，
        // 不忽略 Vary 会导致预缓存条目（无 Origin）匹配失败，离线时资源全部加载失败
        const cached = await cache.match(req, { ignoreVary: true });
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            cache.put(req, res.clone()).catch(() => undefined);
          }
          return res;
        } catch (err) {
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  // 3. 其它同源请求（如 manifest.webmanifest）：Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req, { ignoreVary: true });
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            cache.put(req, res.clone()).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    }),
  );
});
