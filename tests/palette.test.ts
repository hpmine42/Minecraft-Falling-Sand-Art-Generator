import { describe, expect, it } from 'vitest';
import { PALETTE, hexToOklab, nearestTone, rgbToOklab } from '../src/lib/palette';
import { imageToTones } from '../src/lib/image';
import registry from './fixtures/registry-26.3.json';

describe('palette', () => {
  it('has exactly 19 gravity tones and every block exists in 26.3', () => {
    expect(PALETTE).toHaveLength(19);
    for (const tone of PALETTE) {
      const short = tone.id.replace('minecraft:', '');
      expect(registry.block, tone.id).toContain(short);
    }
  });

  it('maps every tone index to a valid block', () => {
    for (let i = 0; i < PALETTE.length; i++) {
      expect(PALETTE[i]!.id).toMatch(/^minecraft:(?:[a-z_]+_concrete_powder|sand|red_sand|gravel)$/);
    }
  });

  it('is deterministic and maps each palette colour back to itself', () => {
    for (let i = 0; i < PALETTE.length; i++) {
      const lab = hexToOklab(PALETTE[i]!.hex);
      expect(nearestTone(lab)).toBe(i);
      expect(nearestTone(lab)).toBe(i);
    }
  });

  it('prefers OKLab perceptual matches over naive RGB for a skin tone', () => {
    // A warm mid skin tone should not collapse to gray gravel.
    const tone = nearestTone(rgbToOklab(198, 134, 102));
    const id = PALETTE[tone]!.id;
    expect(['minecraft:orange_concrete_powder', 'minecraft:red_sand', 'minecraft:brown_concrete_powder', 'minecraft:pink_concrete_powder']).toContain(id);
  });

  it('image pipeline is deterministic with and without dithering', () => {
    const size = 16;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = (i * 7) % 256;
      data[i * 4 + 1] = (i * 13) % 256;
      data[i * 4 + 2] = (i * 29) % 256;
      data[i * 4 + 3] = 255;
    }
    const image = { width: size, height: size, data };
    const crop = { x: 0, y: 0, size };
    const a = imageToTones(image, crop, 8, false);
    const b = imageToTones(image, crop, 8, false);
    expect(Array.from(a.tones)).toEqual(Array.from(b.tones));
    const c = imageToTones(image, crop, 8, true);
    const d = imageToTones(image, crop, 8, true);
    expect(Array.from(c.tones)).toEqual(Array.from(d.tones));
    expect(a.tones.every((t) => t >= 0 && t < 19)).toBe(true);
  });
});
