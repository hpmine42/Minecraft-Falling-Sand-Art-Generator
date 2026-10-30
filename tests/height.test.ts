import { describe, expect, it } from 'vitest';
import { checkHeight, chunkCommands } from '../src/lib/height';

describe('height validator', () => {
  it('rejects 128x128 at Y=64 with the real numbers', () => {
    const r = checkHeight(128, 64);
    expect(r.ok).toBe(false);
    expect(r.needed).toBe(320);
    expect(r.message).toContain('128 × 128');
    expect(r.message).toContain('Y = 320');
    expect(r.message).toContain('319');
    expect(r.message).toContain('96 × 96');
  });

  it('accepts 96x96 at Y=64', () => {
    const r = checkHeight(96, 64);
    expect(r.ok).toBe(true);
    expect(r.needed).toBe(256);
  });

  it('accepts the exact limit and rejects one above', () => {
    expect(checkHeight(96, 127).ok).toBe(true);
    expect(checkHeight(96, 127).needed).toBe(319);
    expect(checkHeight(96, 128).ok).toBe(false);
  });
});

describe('chunk pacing', () => {
  it('matches the requested tick counts and caps chunks at 768', () => {
    for (const [size, ticks] of [[48, 8], [64, 12], [96, 24]] as const) {
      const commands = new Array(2 * size * size).fill(0);
      const chunks = chunkCommands(commands, size);
      expect(chunks).toHaveLength(ticks);
      expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(768);
      expect(chunks.flat()).toHaveLength(commands.length);
    }
  });
});
