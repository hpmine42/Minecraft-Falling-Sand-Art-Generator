import { describe, expect, it } from 'vitest';
import {
  WHITE,
  cloneDrawing,
  createDrawing,
  drawingToImageLike,
  floodFill,
  getPixel,
  hexToRgba,
  paintLine,
  resizeDrawingNearest,
} from '../src/lib/drawing';
import { imageToTones } from '../src/lib/image';
import { PALETTE } from '../src/lib/palette';
import { createDatapackZip } from '../src/lib/zip';
import { unzipSync, strFromU8 } from 'fflate';

const RED = hexToRgba('#a83633');
const BLUE = hexToRgba('#4649a7');

describe('drawing model', () => {
  it('creates a white square and clones independently', () => {
    const d = createDrawing(8);
    expect(d.data).toHaveLength(8 * 8 * 4);
    expect(getPixel(d, 0, 0)).toEqual(WHITE);
    const c = cloneDrawing(d);
    c.data[0] = 0;
    expect(getPixel(d, 0, 0)).toEqual(WHITE);
  });

  it('paints an inclusive line without touching the source', () => {
    const d = createDrawing(8);
    const next = paintLine(d, 1, 1, 4, 1, RED, 1);
    expect(getPixel(d, 1, 1)).toEqual(WHITE);
    for (let x = 1; x <= 4; x++) expect(getPixel(next, x, 1)).toEqual(RED);
    expect(getPixel(next, 0, 1)).toEqual(WHITE);
    expect(getPixel(next, 5, 1)).toEqual(WHITE);
  });

  it('paints a diagonal continuously', () => {
    const d = createDrawing(8);
    const next = paintLine(d, 0, 0, 7, 7, BLUE, 1);
    for (let i = 0; i < 8; i++) expect(getPixel(next, i, i)).toEqual(BLUE);
  });

  it('brush size stamps a square and clips at the edge', () => {
    const d = createDrawing(8);
    const next = paintLine(d, 0, 0, 0, 0, RED, 3);
    expect(getPixel(next, 0, 0)).toEqual(RED);
    expect(getPixel(next, 1, 1)).toEqual(RED);
    expect(getPixel(next, 2, 2)).toEqual(WHITE);
  });

  it('eraser paints white back over a stroke', () => {
    const d = paintLine(createDrawing(8), 0, 0, 7, 0, RED, 1);
    const erased = paintLine(d, 2, 0, 4, 0, WHITE, 1);
    expect(getPixel(erased, 3, 0)).toEqual(WHITE);
    expect(getPixel(erased, 1, 0)).toEqual(RED);
  });

  it('flood fills a bounded region only', () => {
    let d = createDrawing(8);
    d = paintLine(d, 3, 0, 3, 7, BLUE, 1);
    const filled = floodFill(d, 0, 0, RED);
    expect(getPixel(filled, 0, 0)).toEqual(RED);
    expect(getPixel(filled, 2, 7)).toEqual(RED);
    expect(getPixel(filled, 3, 4)).toEqual(BLUE);
    expect(getPixel(filled, 4, 0)).toEqual(WHITE);
  });

  it('flood fill with the same color is a no-op clone', () => {
    const d = createDrawing(4);
    const filled = floodFill(d, 1, 1, WHITE);
    expect(Array.from(filled.data)).toEqual(Array.from(d.data));
    expect(filled.data).not.toBe(d.data);
  });

  it('resizes nearest-neighbour and keeps hard edges', () => {
    const d = paintLine(createDrawing(4), 0, 0, 1, 1, RED, 1);
    const up = resizeDrawingNearest(d, 8);
    expect(up.size).toBe(8);
    expect(getPixel(up, 0, 0)).toEqual(RED);
    expect(getPixel(up, 3, 3)).toEqual(RED);
    expect(getPixel(up, 4, 4)).toEqual(WHITE);
    const down = resizeDrawingNearest(up, 4);
    expect(Array.from(down.data)).toEqual(Array.from(d.data));
  });

  it('exports an independent ImageLike for the existing pipeline', () => {
    const d = paintLine(createDrawing(8), 0, 0, 7, 7, RED, 1);
    const image = drawingToImageLike(d);
    expect(image.width).toBe(8);
    expect(image.height).toBe(8);
    image.data[0] = 0;
    expect(getPixel(d, 0, 0)).toEqual(RED);
  });
});

describe('drawing → datapack pipeline', () => {
  it('palette swatches map back to their own tone indices', () => {
    for (let i = 0; i < PALETTE.length; i++) {
      const d = createDrawing(4, hexToRgba(PALETTE[i]!.hex));
      const grid = imageToTones(drawingToImageLike(d), { x: 0, y: 0, size: 4 }, 4, false);
      expect(grid.tones.every((t) => t === i)).toBe(true);
    }
  });

  it('a drawn image produces a valid deterministic ZIP', () => {
    let d = createDrawing(48);
    d = paintLine(d, 4, 4, 43, 43, RED, 2);
    d = floodFill(d, 0, 0, BLUE);
    const grid = imageToTones(drawingToImageLike(d), { x: 0, y: 0, size: 48 }, 48, false);
    const options = { groundY: 64, corner: 'near-left', orientation: 'se', floorMode: 'none', targetVersion: '26.3' } as const;
    const zip = createDatapackZip(grid, options);
    const files = unzipSync(zip);
    expect(files['pack.mcmeta']).toBeDefined();
    const chunks = Object.keys(files).filter((p) => p.startsWith('data/fallingsand/function/place/se_'));
    const lines = chunks.flatMap((p) => strFromU8(files[p]!).split('\n').filter((l) => l.startsWith('setblock ')));
    expect(lines).toHaveLength(2 * 48 * 48);
    expect(lines.some((l) => l.includes('minecraft:red_concrete_powder'))).toBe(true);
    expect(lines.some((l) => l.includes('minecraft:blue_concrete_powder'))).toBe(true);
  });
});
