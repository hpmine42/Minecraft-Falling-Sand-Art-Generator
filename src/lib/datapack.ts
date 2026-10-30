import { chunkCommands } from './height';
import { cornerCell, generateCommands, orientationAxes, renderCommand } from './commands';
import type { Corner, DatapackOptions, Orientation, PlacementCommand, ToneGrid } from './types';

const encoder = new TextEncoder();
const ORIENTATIONS: readonly Orientation[] = ['se', 'sw', 'nw', 'ne'];

function rel(n: number): string {
  return n === 0 ? '~' : `~${n}`;
}

function fn(name: string, lines: readonly string[]): [string, Uint8Array] {
  const body = lines.length > 0 ? lines.join('\n') + '\n' : '# intentionally empty\n';
  return [`data/fallingsand/function/${name}.mcfunction`, encoder.encode(body)];
}

function bounds(orientation: Orientation, size: number) {
  const a = orientationAxes(orientation);
  const xs = [0, (size - 1) * a.s[0], (size - 1) * a.z[0], (size - 1) * (a.s[0] + a.z[0])];
  const zs = [0, (size - 1) * a.s[1], (size - 1) * a.z[1], (size - 1) * (a.s[1] + a.z[1])];
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function anchorSelector(orientation?: Orientation): string {
  return orientation ? `@e[tag=fs_anchor,tag=fs_${orientation},limit=1]` : '@e[tag=fs_anchor,limit=1]';
}

function atAnchor(orientation: Orientation, command: string): string {
  return `execute at ${anchorSelector(orientation)} run ${command}`;
}

function cornerOffset(corner: Corner, size: number, orientation: Orientation): [number, number] {
  const [cs, cz] = cornerCell(corner, size);
  const a = orientationAxes(orientation);
  return [-(cs * a.s[0] + cz * a.z[0]), -(cs * a.s[1] + cz * a.z[1])];
}

function waterLines(orientation: Orientation, size: number, mode: DatapackOptions['floorMode']): string[] {
  if (mode !== 'water') return ['# Water is disabled for this pack.'];
  const b = bounds(orientation, size);
  const lines: string[] = [
    '# Contain the landing water with a dry glass rim one block outside the footprint.',
    `fill ${rel(b.minX - 1)} ~1 ${rel(b.minZ - 1)} ${rel(b.maxX + 1)} ~1 ${rel(b.minZ - 1)} minecraft:glass`,
    `fill ${rel(b.minX - 1)} ~1 ${rel(b.maxZ + 1)} ${rel(b.maxX + 1)} ~1 ${rel(b.maxZ + 1)} minecraft:glass`,
    `fill ${rel(b.minX - 1)} ~1 ${rel(b.minZ)} ${rel(b.minX - 1)} ~1 ${rel(b.maxZ)} minecraft:glass`,
    `fill ${rel(b.maxX + 1)} ~1 ${rel(b.minZ)} ${rel(b.maxX + 1)} ~1 ${rel(b.maxZ)} minecraft:glass`,
    '# Flood only the landing layer. The standing staircase is above this layer.',
    `fill ${rel(b.minX)} ~1 ${rel(b.minZ)} ${rel(b.maxX)} ~1 ${rel(b.maxZ)} minecraft:water`,
  ];
  return lines;
}

function resetLines(orientation: Orientation, size: number, mode: DatapackOptions['floorMode']): string[] {
  const b = bounds(orientation, size);
  const top = 2 * size;
  // /fill is limited to 32768 blocks per command; slice the volume vertically.
  const maxH = Math.max(1, Math.floor(32768 / (size * size)));
  const lines: string[] = [];
  for (let y = 1; y <= top; y += maxH) {
    const y2 = Math.min(top, y + maxH - 1);
    lines.push(`fill ${rel(b.minX)} ~${y} ${rel(b.minZ)} ${rel(b.maxX)} ~${y2} ${rel(b.maxZ)} minecraft:air`);
  }
  if (mode === 'water') {
    lines.push(
      `fill ${rel(b.minX - 1)} ~1 ${rel(b.minZ - 1)} ${rel(b.maxX + 1)} ~1 ${rel(b.minZ - 1)} minecraft:air`,
      `fill ${rel(b.minX - 1)} ~1 ${rel(b.maxZ + 1)} ${rel(b.maxX + 1)} ~1 ${rel(b.maxZ + 1)} minecraft:air`,
      `fill ${rel(b.minX - 1)} ~1 ${rel(b.minZ)} ${rel(b.minX - 1)} ~1 ${rel(b.maxZ)} minecraft:air`,
      `fill ${rel(b.maxX + 1)} ~1 ${rel(b.minZ)} ${rel(b.maxX + 1)} ~1 ${rel(b.maxZ)} minecraft:air`,
    );
  }
  return lines;
}

function cleanupKill(orientation: Orientation, size: number): string {
  const b = bounds(orientation, size);
  const dy = 2 * size;
  // Delete dropped torch items only, inside the build + landing volume. Never world-wide.
  return atAnchor(orientation, `positioned ${rel(b.minX)} ~1 ${rel(b.minZ)} run kill @e[type=minecraft:item,nbt={Item:{id:"minecraft:torch"}},dx=${size},dy=${dy},dz=${size}]`);
}

function verifyLines(commands: readonly PlacementCommand[]): string[] {
  return commands
    .filter((c) => c.kind === 'torch')
    .map((c) => `execute if block ${rel(c.dx)} ${rel(c.dy)} ${rel(c.dz)} #fallingsand:torches run scoreboard players add #fs_verify fs 1`);
}

export function datapackFiles(grid: ToneGrid, options: DatapackOptions): Record<string, Uint8Array> {
  const size = grid.size;
  const files: Record<string, Uint8Array> = {};
  const add = ([path, bytes]: [string, Uint8Array]): void => { files[path] = bytes; };
  const n = size * size;
  const chunksByOrientation = new Map<Orientation, PlacementCommand[][]>();
  for (const o of ORIENTATIONS) {
    const commands = generateCommands(grid, { groundY: options.groundY, corner: options.corner, orientation: o });
    chunksByOrientation.set(o, chunkCommands(commands, size));
  }
  const chunkCount = chunksByOrientation.get('se')!.length;

  const meta = {
    pack: {
      description: `Falling sand art ${size}x${size} - Minecraft 26.3`,
      min_format: [121, 0],
      max_format: 121,
    },
  };
  files['pack.mcmeta'] = encoder.encode(JSON.stringify(meta, null, 2) + '\n');
  files['data/minecraft/tags/function/load.json'] = encoder.encode(JSON.stringify({ values: ['fallingsand:load'] }, null, 2) + '\n');
  files['data/minecraft/tags/function/tick.json'] = encoder.encode(JSON.stringify({ values: ['fallingsand:tick'] }, null, 2) + '\n');
  files['data/fallingsand/tags/block/torches.json'] = encoder.encode(JSON.stringify({ values: ['minecraft:torch', 'minecraft:wall_torch'] }, null, 2) + '\n');

  add(fn('load', [
    'scoreboard objectives add fs dummy',
    'execute unless score #fs_state fs matches 0.. run scoreboard players set #fs_state fs 0',
  ]));

  const buildEntry: string[] = [
    '# Run as a player standing on the ground block G. The anchor is placed at G.',
    `execute if entity ${anchorSelector()} run return run tellraw @s {"text":"A falling-sand build is already anchored. Run /function fallingsand:reset first.","color":"red"}`,
    'scoreboard players set #fs_state fs 1',
    'execute at @s align xyz run summon minecraft:marker ~ ~-1 ~ {Tags:["fs_anchor"]}',
    '# Snap the look direction to the nearest diagonal so every placement can use ~ coordinates.',
    'execute if entity @s[y_rotation=-90..0] run tag @e[tag=fs_anchor,limit=1,sort=nearest] add fs_se',
    'execute if entity @s[y_rotation=0.0001..90] run tag @e[tag=fs_anchor,limit=1,sort=nearest] add fs_sw',
    'execute if entity @s[y_rotation=90.0001..180] run tag @e[tag=fs_anchor,limit=1,sort=nearest] add fs_nw',
    'execute if entity @s[y_rotation=-180..-90.0001] run tag @e[tag=fs_anchor,limit=1,sort=nearest] add fs_ne',
  ];
  for (const o of ORIENTATIONS) {
    const [dx, dz] = cornerOffset(options.corner, size, o);
    const b = bounds(o, size);
    buildEntry.push(`execute as ${anchorSelector(o)} at @s run tp @s ${rel(dx)} ~ ${rel(dz)}`);
    buildEntry.push(`execute at ${anchorSelector(o)} run forceload add ${rel(b.minX - 1)} ${rel(b.minZ - 1)} ${rel(b.maxX + 1)} ${rel(b.maxZ + 1)}`);
  }
  buildEntry.push(
    'function fallingsand:floor',
    `schedule function fallingsand:build_01 1t`,
    `tellraw @s {"text":"Building ${size}x${size} falling-sand art over ${chunkCount} ticks. Do not break the root torch until the ready message.","color":"gold"}`,
  );
  add(fn('build', buildEntry));

  for (let i = 1; i <= chunkCount; i++) {
    const pad = String(i).padStart(2, '0');
    const lines: string[] = [];
    for (const o of ORIENTATIONS) lines.push(atAnchor(o, `function fallingsand:place/${o}_${pad}`));
    if (i < chunkCount) lines.push(`schedule function fallingsand:build_${String(i + 1).padStart(2, '0')} 1t`);
    else lines.push(
      `execute if entity ${anchorSelector()} run scoreboard players set #fs_state fs 2`,
      'tellraw @a {"text":"Falling-sand art ready. Break the lowest torch at the anchor to collapse it.","color":"green"}',
    );
    add(fn(`build_${pad}`, lines));
    for (const o of ORIENTATIONS) {
      const chunk = chunksByOrientation.get(o)![i - 1]!;
      add(fn(`place/${o}_${pad}`, chunk.map(renderCommand)));
    }
  }

  const floorLines: string[] = ['# Landing floor dispatch. The anchor is at ground Y under cell (0,0).'];
  for (const o of ORIENTATIONS) floorLines.push(atAnchor(o, `function fallingsand:floor_${o}`));
  add(fn('floor', floorLines));
  for (const o of ORIENTATIONS) {
    const b = bounds(o, size);
    const lines = options.floorMode === 'none'
      ? ['# No floor requested. The existing ground is used.']
      : [`fill ${rel(b.minX)} ~ ${rel(b.minZ)} ${rel(b.maxX)} ~ ${rel(b.maxZ)} minecraft:stone`];
    if (options.floorMode === 'water') lines.push('# Water is added at collapse time so the standing root torch stays dry.');
    add(fn(`floor_${o}`, lines));
    add(fn(`water_${o}`, waterLines(o, size, options.floorMode)));
    add(fn(`reset_${o}`, resetLines(o, size, options.floorMode)));
    add(fn(`verify_${o}`, verifyLines(generateCommands(grid, { groundY: options.groundY, corner: options.corner, orientation: o }))));
  }

  add(fn('tick', [
    '# While armed, this is exactly one block check per tick. Idle worlds only test the score.',
    `execute if score #fs_state fs matches 2 at ${anchorSelector()} unless block ~ ~1 ~ minecraft:torch run function fallingsand:collapse`,
  ]));

  add(fn('collapse', [
    'scoreboard players set #fs_state fs 3',
    'scoreboard players set #fs_cleanup fs 300',
    'function fallingsand:water',
    'schedule function fallingsand:cleanup 10t',
    'tellraw @a {"text":"Root torch gone. Collapsing; dropped torch items are deleted inside the build volume every 10 ticks for 300 ticks.","color":"gold"}',
  ]));

  const waterDispatch = ['# Flood the landing layer only in the water floor mode.'];
  for (const o of ORIENTATIONS) waterDispatch.push(atAnchor(o, `function fallingsand:water_${o}`));
  add(fn('water', waterDispatch));

  add(fn('cleanup', [
    '# Kill dropped torch items inside the build + landing volume only. Never the whole world.',
    ...ORIENTATIONS.map((o) => cleanupKill(o, size)),
    'scoreboard players remove #fs_cleanup fs 10',
    'execute if score #fs_cleanup fs matches 1.. run schedule function fallingsand:cleanup 10t',
    ...ORIENTATIONS.map((o) => {
      const b = bounds(o, size);
      return `execute if score #fs_cleanup fs matches ..0 at ${anchorSelector(o)} run forceload remove ${rel(b.minX - 1)} ${rel(b.minZ - 1)} ${rel(b.maxX + 1)} ${rel(b.maxZ + 1)}`;
    }),
    'execute if score #fs_cleanup fs matches ..0 run scoreboard players set #fs_state fs 0',
    'execute if score #fs_cleanup fs matches ..0 run tellraw @a {"text":"Falling-sand cleanup finished. The pack is disarmed; reset removes the build.","color":"green"}',
  ]));

  const resetSchedule = ['schedule clear fallingsand:cleanup'];
  for (let i = 1; i <= chunkCount; i++) resetSchedule.push(`schedule clear fallingsand:build_${String(i).padStart(2, '0')}`);
  add(fn('reset', [
    'scoreboard players set #fs_state fs 0',
    'scoreboard players set #fs_cleanup fs 0',
    ...resetSchedule,
    'function fallingsand:reset_volume',
    ...ORIENTATIONS.map((o) => {
      const b = bounds(o, size);
      return `execute at ${anchorSelector(o)} run forceload remove ${rel(b.minX - 1)} ${rel(b.minZ - 1)} ${rel(b.maxX + 1)} ${rel(b.maxZ + 1)}`;
    }),
    `kill ${anchorSelector()}`,
    'tellraw @s {"text":"Falling-sand build cleared and disarmed.","color":"green"}',
  ]));
  const resetDispatch = ['# Clear the build + landing volume for the active orientation.'];
  for (const o of ORIENTATIONS) resetDispatch.push(atAnchor(o, `function fallingsand:reset_${o}`));
  add(fn('reset_volume', resetDispatch));

  add(fn('verify', [
    'scoreboard players set #fs_verify fs 0',
    `execute if entity ${anchorSelector()} run function fallingsand:verify_count`,
    `tellraw @s [{"text":"Torches in the build: "},{"score":{"name":"#fs_verify","objective":"fs"}},{"text":"/${n}"}]`,
  ]));
  const verifyDispatch = ['# Count expected torch positions for the active orientation.'];
  for (const o of ORIENTATIONS) verifyDispatch.push(atAnchor(o, `function fallingsand:verify_${o}`));
  add(fn('verify_count', verifyDispatch));

  const readme = [
    `Minecraft Falling Sand Art - ${size} x ${size}`,
    'Target: Minecraft Java Edition 26.3 (data pack format 121.0).',
    '',
    '1. Copy this ZIP into <world>/datapacks/ (do not unzip it).',
    '2. In game: /reload',
    '3. Stand on the ground block G, look along the desired diagonal, then: /function fallingsand:build',
    '4. Wait for the ready message, then break the lowest torch at the anchor.',
    '',
    `The build places ${n} gravity blocks and ${n} torches over ${chunkCount} ticks.`,
    `Height: needed = G + 2 + 2 * (${size} - 1) = G + ${2 * size}. Hard limit Y=319.`,
    `Floor mode: ${options.floorMode}. Start corner: ${options.corner}.`,
    options.floorMode === 'water'
      ? 'Water is added to the landing layer the tick the root torch disappears, so the standing structure stays dry. A dry glass rim contains the water.'
      : 'No landing water is used.',
    '',
    '/function fallingsand:verify  - counts torches at the expected positions.',
    '/function fallingsand:reset   - clears the build + landing volume and disarms.',
    '',
    'The pack stores four look-direction variants so every setblock can use ~ coordinates.',
    'Exactly one variant is scheduled, so the world receives 2N setblock commands.',
    'Cleanup kills only dropped torch items (minecraft:torch) inside the build + landing volume every 10 ticks for 300 ticks.',
  ];
  files['README.txt'] = encoder.encode(readme.join('\n') + '\n');
  return files;
}
