<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { PALETTE } from '../lib/palette';
import type { ToneGrid } from '../lib/types';

const props = defineProps<{ grid: ToneGrid | null }>();
const canvas = ref<HTMLCanvasElement | null>(null);

function draw(): void {
  const el = canvas.value;
  if (!el) return;
  const grid = props.grid;
  const size = grid?.size ?? 48;
  el.width = size;
  el.height = size;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const tone = grid?.tones[i] ?? 7;
    const hex = PALETTE[tone]?.hex ?? '#4d5155';
    const n = parseInt(hex.slice(1), 16);
    image.data[i * 4] = (n >> 16) & 255;
    image.data[i * 4 + 1] = (n >> 8) & 255;
    image.data[i * 4 + 2] = n & 255;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}
onMounted(draw);
watch(() => props.grid, draw, { deep: true });
</script>

<template>
  <canvas ref="canvas" class="mosaic" aria-label="Mosaic preview from above" role="img"></canvas>
</template>

<style scoped>
.mosaic {
  width: 100%;
  aspect-ratio: 1;
  image-rendering: pixelated;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--plate-2);
  display: block;
}
</style>
