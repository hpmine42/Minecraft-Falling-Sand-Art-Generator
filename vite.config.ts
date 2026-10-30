import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Hand-rolled PWA plugin: precache every emitted asset with paths relative to
 * the service worker, so GitHub Pages sub-path deployment works offline. The
 * service worker never calls fetch(); it serves the precache and falls back to
 * the cached shell. New builds get a new cache version and are picked up on the
 * next visit.
 */
function pwa(): Plugin {
  return {
    name: 'fallingsand-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const precache = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', ...assets.map((f) => `./${f}`)];
      const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      const source = template.replace('__CACHE_VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

const BASE = '/Minecraft-Falling-Sand-Art-Generator/';

/** Redirect the sandbox preview root to the Pages base path. */
function rootRedirect(): Plugin {
  const redirect = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.url === '/' || req.url === '') {
      res.writeHead(302, { Location: BASE });
      res.end();
      return;
    }
    next();
  };
  return {
    name: 'fallingsand-root-redirect',
    configureServer(server) { server.middlewares.use(redirect); },
    configurePreviewServer(server) { server.middlewares.use(redirect); },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [vue(), pwa(), rootRedirect()],
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
});
