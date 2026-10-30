import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { datapackFiles } from '../src/lib/datapack';
import { createDatapackZip } from '../src/lib/zip';
import { generateCommands } from '../src/lib/commands';
import type { DatapackOptions, ToneGrid } from '../src/lib/types';

const grid: ToneGrid = { size: 48, tones: new Uint8Array(48 * 48).fill(0) };
const options: DatapackOptions = { groundY: 64, corner: 'near-left', orientation: 'se', floorMode: 'water', targetVersion: '26.3' };

describe('datapack', () => {
  const files = datapackFiles(grid, options);
  const text = (path: string): string => strFromU8(files[path]!);

  it('uses modern pack.mcmeta format 121.0 and singular folders', () => {
    const meta = JSON.parse(text('pack.mcmeta'));
    expect(meta.pack.min_format).toEqual([121, 0]);
    expect(meta.pack.max_format).toBe(121);
    expect(meta.pack.pack_format).toBeUndefined();
    expect(files['data/fallingsand/function/build.mcfunction']).toBeDefined();
    expect(files['data/minecraft/tags/function/load.json']).toBeDefined();
    expect(files['data/minecraft/tags/function/tick.json']).toBeDefined();
    expect(Object.keys(files).some((p) => p.includes('/functions/'))).toBe(false);
  });

  it('active orientation emits exactly 2N setblock commands across its chunks', () => {
    const chunkFiles = Object.keys(files).filter((p) => p.startsWith('data/fallingsand/function/place/se_'));
    const lines = chunkFiles.flatMap((p) => text(p).split('\n').filter((l) => l.startsWith('setblock ')));
    expect(lines).toHaveLength(2 * 48 * 48);
    const expected = generateCommands(grid, options).map((c) => `setblock ${c.dx === 0 ? '~' : '~' + c.dx} ${c.dy === 0 ? '~' : '~' + c.dy} ${c.dz === 0 ? '~' : '~' + c.dz} ${c.block}`);
    expect(lines).toEqual(expected);
  });

  it('tick checks exactly one block while armed', () => {
    const tick = text('data/fallingsand/function/tick.mcfunction').split('\n').filter((l) => l && !l.startsWith('#'));
    expect(tick).toHaveLength(1);
    expect(tick[0]).toContain('unless block ~ ~1 ~ minecraft:torch');
    expect(tick[0]).toContain('matches 2');
  });

  it('cleanup is scoped to item entities inside the volume and disarms after 300 ticks', () => {
    const cleanup = text('data/fallingsand/function/cleanup.mcfunction');
    expect(cleanup).toContain('type=minecraft:item');
    expect(cleanup).toContain('dx=48');
    expect(cleanup).toContain('scoreboard players remove #fs_cleanup fs 10');
    expect(cleanup).toContain('matches ..0');
    expect(cleanup).not.toContain('@e[type=!player]');
    const collapse = text('data/fallingsand/function/collapse.mcfunction');
    expect(collapse).toContain('scoreboard players set #fs_cleanup fs 300');
    expect(collapse).toContain('schedule function fallingsand:cleanup 10t');
  });

  it('water only floods the landing layer and keeps the structure dry', () => {
    const water = text('data/fallingsand/function/water_se.mcfunction');
    const fills = water.split('\n').filter((l) => l.startsWith('fill '));
    expect(fills.length).toBeGreaterThan(0);
    for (const line of fills) {
      if (line.includes('minecraft:water')) expect(line).toContain('~1');
      else expect(line).toContain('minecraft:glass');
    }
    const floor = text('data/fallingsand/function/floor_se.mcfunction');
    expect(floor).not.toContain('minecraft:water');
  });

  it('reset slices fills under the 32768 block limit and disarms', () => {
    const resetSe = text('data/fallingsand/function/reset_se.mcfunction');
    for (const line of resetSe.split('\n').filter((l) => l.startsWith('fill '))) {
      const m = line.match(/fill ~(-?\d*) ~(\d+) ~(-?\d*) ~(-?\d*) ~(\d+) ~(-?\d*)/);
      if (m) {
        const x1 = Number(m[1] || 0), x2 = Number(m[4] || 0), z1 = Number(m[3] || 0), z2 = Number(m[6] || 0);
        const y1 = Number(m[2]), y2 = Number(m[5]);
        const volume = (Math.abs(x2 - x1) + 1) * (Math.abs(z2 - z1) + 1) * (y2 - y1 + 1);
        expect(volume).toBeLessThanOrEqual(32768);
      }
    }
    const resetMain = text('data/fallingsand/function/reset.mcfunction');
    expect(resetMain).toContain('scoreboard players set #fs_state fs 0');
    expect(resetMain).toContain('kill @e[tag=fs_anchor,limit=1]');
  });

  it('zip round-trips and is deterministic', () => {
    const zip = createDatapackZip(grid, options);
    const unzipped = unzipSync(zip);
    expect(Object.keys(unzipped).sort()).toEqual(Object.keys(files).sort());
    expect(strFromU8(unzipped['pack.mcmeta']!)).toBe(text('pack.mcmeta'));
    const zip2 = createDatapackZip(grid, options);
    expect(Array.from(zip)).toEqual(Array.from(zip2));
  });
});
