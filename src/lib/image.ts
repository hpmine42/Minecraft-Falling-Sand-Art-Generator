import { nearestTone, rgbToOklab, PALETTE_OKLAB } from './palette';
import type { CropRect, ImageLike, ToneGrid } from './types';

/** Largest centred square crop, clamped to the source bounds. */
export function centerCrop(width: number, height: number): CropRect {
  const size = Math.min(width, height);
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

/**
 * Area-average a square crop down to size x size. Transparent pixels are
 * composited over white so every output cell is filled. Pure: no canvas, no DOM.
 */
export function areaAverage(image: ImageLike, crop: CropRect, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const scale = crop.size / size;
  for (let oy = 0; oy < size; oy++) {
    const sy0 = crop.y + oy * scale;
    const sy1 = Math.min(crop.y + (oy + 1) * scale, image.height);
    for (let ox = 0; ox < size; ox++) {
      const sx0 = crop.x + ox * scale;
      const sx1 = Math.min(crop.x + (ox + 1) * scale, image.width);
      let r = 0, g = 0, b = 0, weight = 0;
      const iy0 = Math.floor(sy0), iy1 = Math.ceil(sy1);
      const ix0 = Math.floor(sx0), ix1 = Math.ceil(sx1);
      for (let iy = iy0; iy < iy1; iy++) {
        const wy = Math.min(iy + 1, sy1) - Math.max(iy, sy0);
        if (wy <= 0) continue;
        for (let ix = ix0; ix < ix1; ix++) {
          const wx = Math.min(ix + 1, sx1) - Math.max(ix, sx0);
          if (wx <= 0) continue;
          const w = wx * wy;
          const idx = (iy * image.width + ix) * 4;
          const a = (image.data[idx + 3] ?? 255) / 255;
          // Composite over white, then accumulate.
          r += ((image.data[idx] ?? 0) * a + 255 * (1 - a)) * w;
          g += ((image.data[idx + 1] ?? 0) * a + 255 * (1 - a)) * w;
          b += ((image.data[idx + 2] ?? 0) * a + 255 * (1 - a)) * w;
          weight += w;
        }
      }
      const o = (oy * size + ox) * 4;
      out[o] = Math.round(r / weight);
      out[o + 1] = Math.round(g / weight);
      out[o + 2] = Math.round(b / weight);
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Map averaged RGBA pixels to tone indices. Optional Floyd-Steinberg in OKLab. */
export function mapTones(rgba: Uint8ClampedArray, size: number, dither: boolean): ToneGrid {
  const tones = new Uint8Array(size * size);
  const errL = new Float64Array(size * size);
  const errA = new Float64Array(size * size);
  const errB = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const o = i * 4;
      const base = rgbToOklab(rgba[o] ?? 0, rgba[o + 1] ?? 0, rgba[o + 2] ?? 0);
      const color = dither
        ? { L: base.L + (errL[i] ?? 0), a: base.a + (errA[i] ?? 0), b: base.b + (errB[i] ?? 0) }
        : base;
      const tone = nearestTone(color);
      tones[i] = tone;
      if (dither) {
        const p = PALETTE_OKLAB[tone]!;
        const eL = color.L - p.L, eA = color.a - p.a, eB = color.b - p.b;
        const spread = (dx: number, dy: number, factor: number): void => {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= size || ny >= size) return;
          const j = ny * size + nx;
          errL[j] = (errL[j] ?? 0) + eL * factor;
          errA[j] = (errA[j] ?? 0) + eA * factor;
          errB[j] = (errB[j] ?? 0) + eB * factor;
        };
        spread(1, 0, 7 / 16);
        spread(-1, 1, 3 / 16);
        spread(0, 1, 5 / 16);
        spread(1, 1, 1 / 16);
      }
    }
  }
  return { size, tones };
}

export function imageToTones(image: ImageLike, crop: CropRect, size: number, dither: boolean): ToneGrid {
  return mapTones(areaAverage(image, crop, size), size, dither);
}
