/**
 * Representative sRGB colours averaged from the vanilla 26.3 block textures
 * (misode/mcmeta tag 26.3-assets). Averaging is reproducible with ImageMagick:
 *   convert texture.png -alpha off -resize 1x1! -format '%[hex:p{0,0}]' info:
 * The palette is intentionally fixed so mapping is deterministic across browsers.
 */
export interface Tone {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
}

export const PALETTE: readonly Tone[] = [
  { id: 'minecraft:white_concrete_powder', name: 'White concrete powder', hex: '#e2e4e4' },
  { id: 'minecraft:orange_concrete_powder', name: 'Orange concrete powder', hex: '#e38420' },
  { id: 'minecraft:magenta_concrete_powder', name: 'Magenta concrete powder', hex: '#c154b9' },
  { id: 'minecraft:light_blue_concrete_powder', name: 'Light blue concrete powder', hex: '#4ab5d5' },
  { id: 'minecraft:yellow_concrete_powder', name: 'Yellow concrete powder', hex: '#e9c737' },
  { id: 'minecraft:lime_concrete_powder', name: 'Lime concrete powder', hex: '#7ebd2a' },
  { id: 'minecraft:pink_concrete_powder', name: 'Pink concrete powder', hex: '#e59ab5' },
  { id: 'minecraft:gray_concrete_powder', name: 'Gray concrete powder', hex: '#4d5155' },
  { id: 'minecraft:light_gray_concrete_powder', name: 'Light gray concrete powder', hex: '#9b9b94' },
  { id: 'minecraft:cyan_concrete_powder', name: 'Cyan concrete powder', hex: '#25949d' },
  { id: 'minecraft:purple_concrete_powder', name: 'Purple concrete powder', hex: '#8438b2' },
  { id: 'minecraft:blue_concrete_powder', name: 'Blue concrete powder', hex: '#4649a7' },
  { id: 'minecraft:brown_concrete_powder', name: 'Brown concrete powder', hex: '#7e5536' },
  { id: 'minecraft:green_concrete_powder', name: 'Green concrete powder', hex: '#61772d' },
  { id: 'minecraft:red_concrete_powder', name: 'Red concrete powder', hex: '#a83633' },
  { id: 'minecraft:black_concrete_powder', name: 'Black concrete powder', hex: '#191b20' },
  { id: 'minecraft:sand', name: 'Sand', hex: '#dbcfa3' },
  { id: 'minecraft:red_sand', name: 'Red sand', hex: '#be6721' },
  { id: 'minecraft:gravel', name: 'Gravel', hex: '#84807f' },
];

export interface Oklab {
  readonly L: number;
  readonly a: number;
  readonly b: number;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function hexToOklab(hex: string): Oklab {
  const n = parseInt(hex.slice(1), 16);
  return rgbToOklab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function rgbToOklab(r: number, g: number, b: number): Oklab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export const PALETTE_OKLAB: readonly Oklab[] = PALETTE.map((t) => hexToOklab(t.hex));

/** Deterministic nearest-neighbour in OKLab. Ties resolve to the lower index. */
export function nearestTone(color: Oklab): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < PALETTE_OKLAB.length; i++) {
    const p = PALETTE_OKLAB[i]!;
    const dL = color.L - p.L;
    const da = color.a - p.a;
    const db = color.b - p.b;
    const dist = dL * dL + da * da + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
