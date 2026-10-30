import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const FORBIDDEN = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /navigator\.sendBeacon/,
  /new\s+WebSocket/,
  /new\s+EventSource/,
  /https?:\/\/[^\s"')]+/,
];

describe('no-network guard', () => {
  it('application source contains no network calls or external URLs', () => {
    const files = walk('src').filter((p) => /\.(ts|vue|js|css)$/.test(p));
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
      }
    }
    const html = readFileSync('index.html', 'utf8');
    if (/https?:\/\//.test(html)) offenders.push('index.html: external URL');
    expect(offenders).toEqual([]);
  });
});
