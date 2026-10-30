import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

type Handler = (event: any) => void;

function loadServiceWorker() {
  const template = readFileSync('src/sw-template.js', 'utf8')
    .replace('__CACHE_VERSION__', 'current')
    .replace('__PRECACHE__', JSON.stringify(['./', './index.html', './assets/app.js']));
  const listeners = new Map<string, Handler>();
  const store = new Map<string, Map<string, Response>>();
  const self = {
    addEventListener: (type: string, handler: Handler) => { listeners.set(type, handler); },
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
    location: { origin: 'https://example.com' },
  };
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const cache = store.get(name)!;
      return {
        addAll: async (paths: string[]) => { for (const path of paths) cache.set(path, new Response('cached')); },
        match: async (path: string) => cache.get(path),
      };
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (request: any) => {
      const key = typeof request === 'string' ? request : request.url;
      for (const cache of store.values()) {
        const hit = cache.get(key);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const context = vm.createContext({ self, caches, Response, URL, Promise });
  vm.runInContext(template, context);
  return { listeners, store };
}

function fetchEvent(url: string, mode: string, destination: string) {
  let response: Promise<Response> | undefined;
  const event = {
    request: { method: 'GET', url, mode, destination },
    respondWith: (promise: Promise<Response>) => { response = promise; },
  };
  return { event, response: () => response! };
}

describe('service worker deployment safety', () => {
  it('precache install succeeds and activation keeps the two previous caches', async () => {
    const { listeners, store } = loadServiceWorker();
    store.set('fallingsand-old-1', new Map());
    store.set('fallingsand-old-2', new Map());
    store.set('fallingsand-old-3', new Map());
    store.set('unrelated', new Map());

    let install: Promise<unknown> | undefined;
    listeners.get('install')!({ waitUntil: (promise: Promise<unknown>) => { install = promise; } });
    await install;
    expect(store.has('fallingsand-current')).toBe(true);

    let activate: Promise<unknown> | undefined;
    listeners.get('activate')!({ waitUntil: (promise: Promise<unknown>) => { activate = promise; } });
    await activate;
    expect(store.has('fallingsand-current')).toBe(true);
    expect(store.has('fallingsand-old-3')).toBe(true);
    expect(store.has('fallingsand-old-2')).toBe(true);
    expect(store.has('fallingsand-old-1')).toBe(false);
    expect(store.has('unrelated')).toBe(true);
  });

  it('serves the cached shell for navigation but never answers missing assets with HTML', async () => {
    const { listeners, store } = loadServiceWorker();
    let install: Promise<unknown> | undefined;
    listeners.get('install')!({ waitUntil: (promise: Promise<unknown>) => { install = promise; } });
    await install;
    store.get('fallingsand-current')!.set('./index.html', new Response('<html>shell</html>', { headers: { 'Content-Type': 'text/html' } }));

    const navigation = fetchEvent('https://example.com/', 'navigate', 'document');
    listeners.get('fetch')!(navigation.event);
    const shell = await navigation.response();
    expect(shell.status).toBe(200);
    expect(await shell.text()).toContain('shell');

    const missing = fetchEvent('https://example.com/assets/missing.js', 'cors', 'script');
    listeners.get('fetch')!(missing.event);
    const asset = await missing.response();
    expect(asset.status).toBe(404);
    expect(asset.headers.get('Content-Type')).toBe('text/plain');
    expect(await asset.text()).not.toContain('<html>');
  });
});
