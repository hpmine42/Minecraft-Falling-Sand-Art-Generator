import { PALETTE } from './palette';
import type { CommandOptions, Facing, Orientation, PlacementCommand, ToneGrid } from './types';

const AXES: Record<Orientation, { s: [number, number]; z: [number, number]; sFace: Facing; zFace: Facing }> = {
  se: { s: [1, 0], z: [0, 1], sFace: 'east', zFace: 'south' },
  sw: { s: [-1, 0], z: [0, 1], sFace: 'west', zFace: 'south' },
  nw: { s: [-1, 0], z: [0, -1], sFace: 'west', zFace: 'north' },
  ne: { s: [1, 0], z: [0, -1], sFace: 'east', zFace: 'north' },
};

export function orientationAxes(orientation: Orientation) {
  return AXES[orientation];
}

function rel(n: number): string {
  return n === 0 ? '~' : `~${n}`;
}

export function renderCommand(c: PlacementCommand): string {
  return `setblock ${rel(c.dx)} ${rel(c.dy)} ${rel(c.dz)} ${c.block}`;
}

/**
 * Bottom-to-top diagonal order. The root torch is first; then for each diagonal
 * d we place the blocks of d, followed by the torches of d+1. A torch always
 * appears before the block it holds, and its parent block appears before it.
 */
export function generateCommands(grid: ToneGrid, options: CommandOptions): PlacementCommand[] {
  const { size, tones } = grid;
  const { groundY, orientation } = options;
  const axes = AXES[orientation];
  const commands: PlacementCommand[] = [];
  const world = (s: number, z: number): [number, number] => [
    s * axes.s[0] + z * axes.z[0],
    s * axes.s[1] + z * axes.z[1],
  ];
  const pushBlock = (s: number, z: number): void => {
    const tone = tones[z * size + s] ?? 0;
    const [dx, dz] = world(s, z);
    const dy = 2 + s + z;
    commands.push({ kind: 'block', s, z, dx, dy, dz, y: groundY + dy, tone, facing: null, block: PALETTE[tone]!.id });
  };
  const pushTorch = (s: number, z: number): void => {
    const [dx, dz] = world(s, z);
    const dy = 1 + s + z;
    const root = s === 0 && z === 0;
    const facing = root ? null : s > 0 ? axes.sFace : axes.zFace;
    const block = root ? 'minecraft:torch' : `minecraft:wall_torch[facing=${facing}]`;
    commands.push({ kind: 'torch', s, z, dx, dy, dz, y: groundY + dy, tone: null, facing, block });
  };
  pushTorch(0, 0);
  const maxD = 2 * (size - 1);
  for (let d = 0; d <= maxD; d++) {
    const sMin = Math.max(0, d - (size - 1));
    const sMax = Math.min(size - 1, d);
    for (let s = sMax; s >= sMin; s--) pushBlock(s, d - s);
    if (d + 1 <= maxD) {
      const tMin = Math.max(0, d + 1 - (size - 1));
      const tMax = Math.min(size - 1, d + 1);
      for (let s = tMax; s >= tMin; s--) pushTorch(s, d + 1 - s);
    }
  }
  return commands;
}

/** Corner offset in local (s,z) cells that should sit under the player. */
export function cornerCell(corner: CommandOptions['corner'], size: number): [number, number] {
  switch (corner) {
    case 'near-left': return [0, 0];
    case 'near-right': return [size - 1, 0];
    case 'far-left': return [0, size - 1];
    case 'far-right': return [size - 1, size - 1];
  }
}
