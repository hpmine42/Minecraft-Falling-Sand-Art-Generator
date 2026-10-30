import { describe, expect, it } from 'vitest';
import { generateCommands, renderCommand } from '../src/lib/commands';
import type { ToneGrid } from '../src/lib/types';

// Ground truth from the brief, handwritten. Cell (s, z) maps to ~s ~y ~z for
// the default south-east orientation. This list is never derived from code.
const EXPECTED_4X4 = [
  'setblock ~ ~1 ~ minecraft:torch',
  'setblock ~ ~2 ~ minecraft:white_concrete_powder',
  'setblock ~1 ~2 ~ minecraft:wall_torch[facing=east]',
  'setblock ~ ~2 ~1 minecraft:wall_torch[facing=south]',
  'setblock ~1 ~3 ~ minecraft:white_concrete_powder',
  'setblock ~ ~3 ~1 minecraft:white_concrete_powder',
  'setblock ~2 ~3 ~ minecraft:wall_torch[facing=east]',
  'setblock ~1 ~3 ~1 minecraft:wall_torch[facing=east]',
  'setblock ~ ~3 ~2 minecraft:wall_torch[facing=south]',
  'setblock ~2 ~4 ~ minecraft:white_concrete_powder',
  'setblock ~1 ~4 ~1 minecraft:white_concrete_powder',
  'setblock ~ ~4 ~2 minecraft:white_concrete_powder',
  'setblock ~3 ~4 ~ minecraft:wall_torch[facing=east]',
  'setblock ~2 ~4 ~1 minecraft:wall_torch[facing=east]',
  'setblock ~1 ~4 ~2 minecraft:wall_torch[facing=east]',
  'setblock ~ ~4 ~3 minecraft:wall_torch[facing=south]',
  'setblock ~3 ~5 ~ minecraft:white_concrete_powder',
  'setblock ~2 ~5 ~1 minecraft:white_concrete_powder',
  'setblock ~1 ~5 ~2 minecraft:white_concrete_powder',
  'setblock ~ ~5 ~3 minecraft:white_concrete_powder',
  'setblock ~3 ~5 ~1 minecraft:wall_torch[facing=east]',
  'setblock ~2 ~5 ~2 minecraft:wall_torch[facing=east]',
  'setblock ~1 ~5 ~3 minecraft:wall_torch[facing=east]',
  'setblock ~3 ~6 ~1 minecraft:white_concrete_powder',
  'setblock ~2 ~6 ~2 minecraft:white_concrete_powder',
  'setblock ~1 ~6 ~3 minecraft:white_concrete_powder',
  'setblock ~3 ~6 ~2 minecraft:wall_torch[facing=east]',
  'setblock ~2 ~6 ~3 minecraft:wall_torch[facing=east]',
  'setblock ~3 ~7 ~2 minecraft:white_concrete_powder',
  'setblock ~2 ~7 ~3 minecraft:white_concrete_powder',
  'setblock ~3 ~7 ~3 minecraft:wall_torch[facing=east]',
  'setblock ~3 ~8 ~3 minecraft:white_concrete_powder',
];

describe('4 x 4 acceptance fixture (ground truth)', () => {
  const grid: ToneGrid = { size: 4, tones: new Uint8Array(16).fill(0) };

  it('emits exactly the 32 fixture commands, in order', () => {
    const commands = generateCommands(grid, { groundY: 64, corner: 'near-left', orientation: 'se' });
    expect(commands).toHaveLength(32);
    expect(commands.map(renderCommand)).toEqual(EXPECTED_4X4);
  });

  it('has 16 blocks, 16 torches, one floor torch and 15 wall torches', () => {
    const commands = generateCommands(grid, { groundY: 64, corner: 'near-left', orientation: 'se' });
    expect(commands.filter((c) => c.kind === 'block')).toHaveLength(16);
    expect(commands.filter((c) => c.kind === 'torch')).toHaveLength(16);
    expect(commands.filter((c) => c.kind === 'torch' && c.facing == null)).toHaveLength(1);
    expect(commands.filter((c) => c.kind === 'torch' && c.facing != null)).toHaveLength(15);
  });

  it('rises exactly six blocks above the corner block', () => {
    const commands = generateCommands(grid, { groundY: 64, corner: 'near-left', orientation: 'se' });
    const blocks = commands.filter((c) => c.kind === 'block');
    expect(blocks[0]?.y).toBe(66);
    expect(blocks.at(-1)?.y).toBe(72);
    expect((blocks.at(-1)?.y ?? 0) - (blocks[0]?.y ?? 0)).toBe(6);
  });
});
