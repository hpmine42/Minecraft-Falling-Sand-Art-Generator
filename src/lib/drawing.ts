import type { ImageLike } from './types';

/** A square RGBA drawing. Pure data: no canvas, no DOM. */
export interface Drawing {
  readonly size: number;
  readonly data: Uint8ClampedArray;
}

export type RgbaColor = readonly [number, number, number, number];

export const WHITE: RgbaColor = [255, 255, 255, 255];

export function createDrawing(size: number, background: RgbaColor = WHITE): Drawing {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = background[0];
    data[i * 4 + 1] = background[1];
    data[i * 4 + 2] = background[2];
    data[i * 4 + 3] = background[3];
  }
  return { size, data };
}

export function cloneDrawing(drawing: Drawing): Drawing {
  return { size: drawing.size, data: new Uint8ClampedArray(drawing.data) };
}

export function getPixel(drawing: Drawing, x: number, y: number): RgbaColor {
  const i = (y * drawing.size + x) * 4;
  return [
    drawing.data[i] ?? 0,
    drawing.data[i + 1] ?? 0,
    drawing.data[i + 2] ?? 0,
    drawing.data[i + 3] ?? 0,
  ];
}

function sameColor(a: RgbaColor, b: RgbaColor): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function stamp(data: Uint8ClampedArray, size: number, x: number, y: number, color: RgbaColor, brush: number): void {
  const width = Math.max(1, Math.floor(brush));
  const start = -Math.floor((width - 1) / 2);
  for (let dy = 0; dy < width; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const px = x + start + dx;
      const py = y + start + dy;
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      const i = (py * size + px) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
}

/** Inclusive Bresenham line with a square brush. Returns a new drawing. */
export function paintLine(
  drawing: Drawing,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RgbaColor,
  brush = 1,
): Drawing {
  const next = cloneDrawing(drawing);
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    stamp(next.data, next.size, x, y, color, brush);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return next;
}

/** 4-neighbour flood fill. Returns a new drawing. */
export function floodFill(drawing: Drawing, x: number, y: number, color: RgbaColor): Drawing {
  const next = cloneDrawing(drawing);
  const size = next.size;
  if (x < 0 || y < 0 || x >= size || y >= size) return next;
  const target = getPixel(next, x, y);
  if (sameColor(target, color)) return next;
  const stack: Array<[number, number]> = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= size || cy >= size) continue;
    if (!sameColor(getPixel(next, cx, cy), target)) continue;
    stamp(next.data, size, cx, cy, color, 1);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

/** Nearest-neighbour resize so hard pixel-art edges stay hard. */
export function resizeDrawingNearest(drawing: Drawing, newSize: number): Drawing {
  if (newSize === drawing.size) return cloneDrawing(drawing);
  const next = createDrawing(newSize);
  for (let y = 0; y < newSize; y++) {
    const sy = Math.min(drawing.size - 1, Math.floor((y * drawing.size) / newSize));
    for (let x = 0; x < newSize; x++) {
      const sx = Math.min(drawing.size - 1, Math.floor((x * drawing.size) / newSize));
      const from = (sy * drawing.size + sx) * 4;
      const to = (y * newSize + x) * 4;
      next.data[to] = drawing.data[from] ?? 0;
      next.data[to + 1] = drawing.data[from + 1] ?? 0;
      next.data[to + 2] = drawing.data[from + 2] ?? 0;
      next.data[to + 3] = drawing.data[from + 3] ?? 0;
    }
  }
  return next;
}

export function drawingToImageLike(drawing: Drawing): ImageLike {
  return {
    width: drawing.size,
    height: drawing.size,
    data: new Uint8ClampedArray(drawing.data),
  };
}

export function hexToRgba(hex: string): RgbaColor {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
