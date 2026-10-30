import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('boot fallback', () => {
  it('keeps a visible fallback outside the Vue mount point', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('id="boot-fallback"');
    expect(html).toContain('id="boot-reset"');
    expect(html.indexOf('id="app"')).toBeLessThan(html.indexOf('id="boot-fallback"'));
  });

  it('offers an offline cache reset and removes the fallback only after mount', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain("key.indexOf('fallingsand-') === 0");
    expect(html).toContain('navigator.serviceWorker.getRegistrations()');
    expect(html).toContain('registration.unregister()');
    expect(html).toContain('location.reload()');
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toContain("createApp(App).mount('#app');");
    expect(main).toContain("document.getElementById('boot-fallback')?.remove();");
  });
});
