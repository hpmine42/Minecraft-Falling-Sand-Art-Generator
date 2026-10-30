<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { CropRect, ImageLike } from '../lib/types';
import { centerCrop } from '../lib/image';

const props = defineProps<{ image: ImageLike; source: HTMLCanvasElement }>();
const crop = defineModel<CropRect>('crop', { required: true });
const canvas = ref<HTMLCanvasElement | null>(null);
const minDim = computed(() => Math.min(props.image.width, props.image.height));
const zoom = ref(1);
const panX = ref(0.5);
const panY = ref(0.5);

function apply(): void {
  const size = Math.max(1, Math.round(minDim.value / zoom.value));
  const cx = panX.value * props.image.width;
  const cy = panY.value * props.image.height;
  let x = Math.round(cx - size / 2);
  let y = Math.round(cy - size / 2);
  x = Math.max(0, Math.min(props.image.width - size, x));
  y = Math.max(0, Math.min(props.image.height - size, y));
  crop.value = { x, y, size };
}

function draw(): void {
  const el = canvas.value;
  if (!el) return;
  el.width = 320;
  el.height = 320;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  const c = crop.value;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(props.source, c.x, c.y, c.size, c.size, 0, 0, 320, 320);
}

watch([zoom, panX, panY], apply);
watch(
  () => props.image,
  () => {
    zoom.value = 1;
    const c = centerCrop(props.image.width, props.image.height);
    panX.value = (c.x + c.size / 2) / props.image.width;
    panY.value = (c.y + c.size / 2) / props.image.height;
    crop.value = c;
    draw();
  },
  { immediate: true },
);
watch(crop, draw, { deep: true });
onMounted(draw);
</script>

<template>
  <div class="crop">
    <canvas ref="canvas" class="crop-canvas" aria-label="Square crop preview" role="img"></canvas>
    <div class="sliders">
      <div>
        <label for="crop-zoom">Zoom</label>
        <input id="crop-zoom" v-model.number="zoom" type="range" min="1" max="4" step="0.05" />
      </div>
      <div>
        <label for="crop-x">Horizontal position</label>
        <input id="crop-x" v-model.number="panX" type="range" min="0" max="1" step="0.01" />
      </div>
      <div>
        <label for="crop-y">Vertical position</label>
        <input id="crop-y" v-model.number="panY" type="range" min="0" max="1" step="0.01" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.crop { display: grid; gap: 12px; }
.crop-canvas {
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--plate-2);
  display: block;
  margin: 0 auto;
}
.sliders { display: grid; gap: 8px; }
</style>
