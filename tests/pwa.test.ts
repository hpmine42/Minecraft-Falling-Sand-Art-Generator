import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('PWA / GitHub Pages paths', () => {
  it('vite base matches the repository name', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain("const BASE = '/Minecraft-Falling-Sand-Art-Generator/'");
    expect(config).toContain('base: BASE');
  });

  it('manifest uses relative start_url and scope', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(manifest.start_url).toBe('.');
    expect(manifest.scope).toBe('.');
    for (const icon of manifest.icons) expect(icon.src.startsWith('/')).toBe(false);
  });

  it('service worker precache paths are relative and it never calls fetch', () => {
    const template = readFileSync('src/sw-template.js', 'utf8');
    expect(template).toContain('__PRECACHE__');
    const code = template.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain('`./${f}`');
    expect(config).toContain("'./index.html'");
  });
});
