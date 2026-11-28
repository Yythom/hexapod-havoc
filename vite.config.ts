import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * 构建完成时向 dist/sw.js 注入本次构建的唯一缓存版本号与核心预缓存资源列表，
 * 让 PWA 安装后无需额外第三方依赖即可支持完整离线游玩与平滑版本更新。
 */
function pwaSwPlugin(): Plugin {
  return {
    name: 'hexapod-pwa-sw',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(process.cwd(), 'dist');
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const precache: string[] = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icons/icon.svg',
        './icons/icon-192.png',
        './icons/icon-512.png',
        './icons/icon-maskable-512.png',
        './icons/apple-touch-icon.png',
      ];

      const assetsDir = path.join(outDir, 'assets');
      const hash = crypto.createHash('sha256');
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir).sort();
        for (const f of files) {
          hash.update(f);
          // 预缓存所有入口 JS/CSS 与常用标题字库切片（.woff2），避免首屏抽帧阻塞
          if (/\.(?:js|css)$/i.test(f) || (/\.(?:woff2)$/i.test(f) && /lilita-one|zcool-kuaile/i.test(f))) {
            precache.push(`./assets/${f}`);
          }
        }
      }
      const version = hash.digest('hex').slice(0, 10) || Date.now().toString(36);
      const raw = fs.readFileSync(swPath, 'utf8');
      const injected = raw
        .replace('__PWA_CACHE_VERSION__', version)
        .replace(/\/\* __PWA_PRECACHE_LIST__ \*\/ \[[\s\S]*?\]/, JSON.stringify(precache, null, 2));
      fs.writeFileSync(swPath, injected, 'utf8');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [pwaSwPlugin()],
  build: {
    target: ['es2020', 'safari14'],
    cssTarget: ['safari14'],
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
