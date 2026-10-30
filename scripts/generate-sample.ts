import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { imageToTones } from '../src/lib/image';
import { PALETTE } from '../src/lib/palette';
import { createDatapackZip } from '../src/lib/zip';

// Reproducible sample receipt. Input: docs/sample-photo.jpg (NASA, public domain).
// Run: convert docs/sample-photo.jpg -resize 512x512^ -gravity center -extent 512x512 -depth 8 rgba:/tmp/sample.rgba
//      npx vite-node scripts/generate-sample.ts
const size = 48;
const data = new Uint8ClampedArray(readFileSync('/tmp/sample.rgba'));
const grid = imageToTones({ width: 512, height: 512, data }, { x: 0, y: 0, size: 512 }, size, false);
const rgb = Buffer.alloc(size * size * 3);
for (let i = 0; i < size * size; i++) {
  const hex = PALETTE[grid.tones[i]!]!.hex;
  const n = parseInt(hex.slice(1), 16);
  rgb[i * 3] = (n >> 16) & 255;
  rgb[i * 3 + 1] = (n >> 8) & 255;
  rgb[i * 3 + 2] = n & 255;
}
writeFileSync('/tmp/sample-mosaic.rgb', rgb);
execFileSync('convert', ['-size', `${size}x${size}`, '-depth', '8', 'rgb:/tmp/sample-mosaic.rgb', 'docs/sample-mosaic.png']);
const zip = createDatapackZip(grid, { groundY: 64, corner: 'near-left', orientation: 'se', floorMode: 'none', targetVersion: '26.3' });
writeFileSync('docs/sample-datapack.zip', zip);
console.log(`Wrote docs/sample-mosaic.png and docs/sample-datapack.zip (${zip.length} bytes)`);
