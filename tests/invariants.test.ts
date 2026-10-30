import { describe, expect, it } from 'vitest';
import { generateCommands, renderCommand } from '../src/lib/commands';
import { PALETTE } from '../src/lib/palette';
import type { Orientation, ToneGrid } from '../src/lib/types';

const ORIENTATIONS: Orientation[] = ['se', 'sw', 'nw', 'ne'];
const OPPOSITE: Record<string, [number, number]> = {
  east: [-1, 0], west: [1, 0], south: [0, -1], north: [0, 1],
};

function grid(size: number): ToneGrid {
  const tones = new Uint8Array(size * size);
  for (let i = 0; i < tones.length; i++) tones[i] = i % PALETTE.length;
  return { size, tones };
}

describe('placement invariants', () => {
  for (const size of [4, 48, 64, 96]) {
    for (const orientation of ORIENTATIONS) {
      it(`${size}x${size} ${orientation}: every gravity block has its torch earlier`, () => {
        const commands = generateCommands(grid(size), { groundY: 64, corner: 'near-left', orientation });
        const torchSeen = new Set<string>();
        for (const c of commands) {
          const key = `${c.s},${c.z}`;
          if (c.kind === 'torch') torchSeen.add(key);
          else expect(torchSeen.has(key), `block ${key} before torch`).toBe(true);
        }
      });

      it(`${size}x${size} ${orientation}: every wall torch faces away from an earlier parent block`, () => {
        const commands = generateCommands(grid(size), { groundY: 64, corner: 'near-left', orientation });
        const blockAt = new Map<string, { dx: number; dy: number; dz: number }>();
        for (const c of commands) {
          if (c.kind === 'block') blockAt.set(`${c.s},${c.z}`, c);
          else if (c.facing) {
            const [ox, oz] = OPPOSITE[c.facing]!;
            const parent = c.s > 0 ? `${c.s - 1},${c.z}` : `${c.s},${c.z - 1}`;
            const p = blockAt.get(parent);
            expect(p, `parent ${parent} missing before torch ${c.s},${c.z}`).toBeDefined();
            expect(p!.dx).toBe(c.dx + ox);
            expect(p!.dz).toBe(c.dz + oz);
            expect(p!.dy).toBe(c.dy);
          }
        }
      });
    }
  }

  it('48x48 produces N blocks, N torches and 2N setblock commands', () => {
    const commands = generateCommands(grid(48), { groundY: 64, corner: 'near-left', orientation: 'se' });
    const n = 48 * 48;
    expect(commands).toHaveLength(2 * n);
    expect(commands.filter((c) => c.kind === 'block')).toHaveLength(n);
    expect(commands.filter((c) => c.kind === 'torch')).toHaveLength(n);
    expect(commands.every((c) => renderCommand(c).startsWith('setblock ~'))).toBe(true);
  });

  it('each cell owns a unique landing column', () => {
    const commands = generateCommands(grid(48), { groundY: 64, corner: 'near-left', orientation: 'se' });
    const columns = new Set(commands.filter((c) => c.kind === 'block').map((c) => `${c.dx},${c.dz}`));
    expect(columns.size).toBe(48 * 48);
  });
});
