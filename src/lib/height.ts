import type { Size } from './types';

export const BUILD_LIMIT = 319;
export const SIZES: readonly Size[] = [48, 64, 96];

export interface HeightCheck {
  readonly ok: boolean;
  readonly needed: number;
  readonly message: string;
}

/** needed = G + 2 + 2 * (size - 1) = G + 2 * size. Hard limit 319. */
export function checkHeight(size: number, groundY: number): HeightCheck {
  const needed = groundY + 2 + 2 * (size - 1);
  if (needed <= BUILD_LIMIT) {
    return { ok: true, needed, message: `Reaches Y = ${needed}. Build limit is ${BUILD_LIMIT}.` };
  }
  const lower = needed - BUILD_LIMIT;
  const fits = SIZES.filter((s) => groundY + 2 * s <= BUILD_LIMIT);
  const suggestion = fits.length > 0 ? ` or choose ${fits.at(-1)} × ${fits.at(-1)}` : '';
  return {
    ok: false,
    needed,
    message: `This ${size} × ${size} mosaic reaches Y = ${needed} and the build limit is ${BUILD_LIMIT} — stand ${lower} block${lower === 1 ? '' : 's'} lower${suggestion}.`,
  };
}

export function sizeWarning(size: number): string | null {
  if (size === 64) return '4,096 blocks and torches — the collapse spawns a lot of entities at once.';
  if (size === 96) return '9,216 blocks and torches — a very large collapse. Expect a brief entity spike; try 64 × 64 first if your world struggles.';
  return null;
}

/** Requested pacing: 48→8 ticks, 64→12, 96→24. Cap each chunk at 768 commands. */
export function chunkCommands<T>(commands: readonly T[], size: number): T[][] {
  const targetTicks = size === 48 ? 8 : size === 64 ? 12 : size === 96 ? 24 : 1;
  const perChunk = Math.min(768, Math.ceil(commands.length / targetTicks));
  const chunks: T[][] = [];
  for (let i = 0; i < commands.length; i += perChunk) chunks.push(commands.slice(i, i + perChunk));
  return chunks;
}
