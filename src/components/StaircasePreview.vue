<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { PALETTE } from '../lib/palette';
import type { ToneGrid } from '../lib/types';

const props = defineProps<{ grid: ToneGrid | null }>();
const canvas = ref<HTMLCanvasElement | null>(null);

function shade(hex: string, factor: string | number): string {
  const f = Number(factor);
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

function draw(): void {
  const el = canvas.value;
  if (!el) return;
  const grid = props.grid;
  const size = grid?.size ?? 48;
  const W = 640;
  const H = 480;
  el.width = W;
  el.height = H;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#15181d';
  ctx.fillRect(0, 0, W, H);
  const tileW = Math.min(18, (W * 0.9) / size);
  const tileH = tileW / 2;
  const blockH = tileH * 1.15;
  const cells: Array<{ s: number; z: number; tone: number }> = [];
  for (let z = 0; z < size; z++) {
    for (let s = 0; s < size; s++) {
      cells.push({ s, z, tone: grid?.tones[z * size + s] ?? 7 });
    }
  }
  cells.sort((a, b) => (a.s + a.z) - (b.s + b.z) || a.s - b.s);
  const project = (s: number, z: number, h: number): [number, number] => {
    const x = ((s - z) * tileW) / 2;
    const y = ((s + z) * tileH) / 2 - h * blockH;
    return [x, y];
  };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    const h = c.s + c.z;
    const [x, y] = project(c.s, c.z, h);
    minX = Math.min(minX, x - tileW / 2);
    maxX = Math.max(maxX, x + tileW / 2);
    minY = Math.min(minY, y - blockH);
    maxY = Math.max(maxY, y + tileH);
  }
  const ox = (W - (maxX - minX)) / 2 - minX;
  const oy = (H - (maxY - minY)) / 2 - minY;
  for (const c of cells) {
    const h = c.s + c.z;
    const [px, py] = project(c.s, c.z, h);
    const x = px + ox;
    const y = py + oy;
    const hex = PALETTE[c.tone]?.hex ?? '#4d5155';
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.moveTo(x, y - tileH / 2);
    ctx.lineTo(x + tileW / 2, y);
    ctx.lineTo(x, y + tileH / 2);
    ctx.lineTo(x - tileW / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(hex, 0.7);
    ctx.beginPath();
    ctx.moveTo(x - tileW / 2, y);
    ctx.lineTo(x, y + tileH / 2);
    ctx.lineTo(x, y + tileH / 2 + blockH);
    ctx.lineTo(x - tileW / 2, y + blockH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(hex, 0.5);
    ctx.beginPath();
    ctx.moveTo(x + tileW / 2, y);
    ctx.lineTo(x, y + tileH / 2);
    ctx.lineTo(x, y + tileH / 2 + blockH);
    ctx.lineTo(x + tileW / 2, y + blockH);
    ctx.closePath();
    ctx.fill();
  }
  const [rx, ry] = project(0, 0, 0);
  ctx.fillStyle = '#e8eaed';
  ctx.fillRect(rx + ox - 2, ry + oy - 14, 4, 14);
}
onMounted(draw);
watch(() => props.grid, draw, { deep: true });
</script>

<template>
  <canvas ref="canvas" class="staircase" aria-label="Tilted staircase preview" role="img"></canvas>
</template>

<style scoped>
.staircase {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--plate-2);
  display: block;
}
</style>
