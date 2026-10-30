<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { PALETTE } from '../lib/palette';
import {
  WHITE,
  cloneDrawing,
  createDrawing,
  drawingToImageLike,
  floodFill,
  hexToRgba,
  paintLine,
  resizeDrawingNearest,
} from '../lib/drawing';
import type { Drawing } from '../lib/drawing';
import type { ImageLike } from '../lib/types';

const props = defineProps<{ size: number }>();
const emit = defineEmits<{ (e: 'change', image: ImageLike): void }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const drawing = shallowRef<Drawing>(createDrawing(props.size));
const undoStack = shallowRef<Drawing[]>([]);
const redoStack = shallowRef<Drawing[]>([]);
const tool = ref<'brush' | 'eraser' | 'fill'>('brush');
const color = ref(PALETTE[0]!.hex);
const brushSize = ref(1);
const showGrid = ref(true);
const painting = ref(false);
const last = ref<{ x: number; y: number } | null>(null);

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const activeColor = computed(() => (tool.value === 'eraser' ? '#ffffff' : color.value));

function pushHistory(): void {
  undoStack.value = [...undoStack.value.slice(-49), cloneDrawing(drawing.value)];
  redoStack.value = [];
}

function emitChange(): void {
  emit('change', drawingToImageLike(drawing.value));
}

function render(): void {
  const el = canvas.value;
  if (!el) return;
  const size = drawing.value.size;
  el.width = size;
  el.height = size;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(drawing.value.data), size, size), 0, 0);
  if (showGrid.value) {
    ctx.strokeStyle = 'rgba(13, 15, 18, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < size; i++) {
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, size);
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(size, i + 0.5);
    }
    ctx.stroke();
  }
}

function cellFromEvent(event: PointerEvent): { x: number; y: number } | null {
  const el = canvas.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const size = drawing.value.size;
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * size);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * size);
  return {
    x: Math.max(0, Math.min(size - 1, x)),
    y: Math.max(0, Math.min(size - 1, y)),
  };
}

function strokeTo(x: number, y: number): void {
  const from = last.value ?? { x, y };
  const rgba = tool.value === 'eraser' ? WHITE : hexToRgba(color.value);
  drawing.value = paintLine(drawing.value, from.x, from.y, x, y, rgba, brushSize.value);
  last.value = { x, y };
  render();
}

function onPointerDown(event: PointerEvent): void {
  const cell = cellFromEvent(event);
  if (!cell) return;
  event.preventDefault();
  canvas.value?.setPointerCapture(event.pointerId);
  pushHistory();
  if (tool.value === 'fill') {
    drawing.value = floodFill(drawing.value, cell.x, cell.y, hexToRgba(color.value));
    render();
    emitChange();
    if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId);
    return;
  }
  painting.value = true;
  last.value = null;
  strokeTo(cell.x, cell.y);
}

function onPointerMove(event: PointerEvent): void {
  if (!painting.value) return;
  const cell = cellFromEvent(event);
  if (!cell) return;
  event.preventDefault();
  strokeTo(cell.x, cell.y);
}

function onPointerUp(event: PointerEvent): void {
  if (!painting.value) return;
  event.preventDefault();
  painting.value = false;
  last.value = null;
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId);
  emitChange();
}

function undo(): void {
  const previous = undoStack.value.at(-1);
  if (!previous) return;
  undoStack.value = undoStack.value.slice(0, -1);
  redoStack.value = [...redoStack.value, cloneDrawing(drawing.value)];
  drawing.value = previous;
  render();
  emitChange();
}

function redo(): void {
  const next = redoStack.value.at(-1);
  if (!next) return;
  redoStack.value = redoStack.value.slice(0, -1);
  undoStack.value = [...undoStack.value, cloneDrawing(drawing.value)];
  drawing.value = next;
  render();
  emitChange();
}

function clear(): void {
  pushHistory();
  drawing.value = createDrawing(drawing.value.size);
  render();
  emitChange();
}

function selectPalette(hex: string): void {
  color.value = hex;
  tool.value = 'brush';
}

watch(
  () => props.size,
  (size) => {
    if (size === drawing.value.size) return;
    drawing.value = resizeDrawingNearest(drawing.value, size);
    undoStack.value = [];
    redoStack.value = [];
    render();
    emitChange();
  },
);
watch(showGrid, render);
onMounted(() => {
  render();
  emitChange();
});
</script>

<template>
  <div class="drawing">
    <div class="toolbar" role="toolbar" aria-label="Drawing tools">
      <button type="button" :class="{ active: tool === 'brush' }" :aria-pressed="tool === 'brush'" @click="tool = 'brush'">Brush</button>
      <button type="button" :class="{ active: tool === 'eraser' }" :aria-pressed="tool === 'eraser'" @click="tool = 'eraser'">Eraser</button>
      <button type="button" :class="{ active: tool === 'fill' }" :aria-pressed="tool === 'fill'" @click="tool = 'fill'">Fill</button>
      <button type="button" :disabled="!canUndo" @click="undo">Undo</button>
      <button type="button" :disabled="!canRedo" @click="redo">Redo</button>
      <button type="button" @click="clear">Clear</button>
    </div>

    <canvas
      ref="canvas"
      class="draw-canvas"
      aria-label="Drawing canvas"
      role="img"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    ></canvas>

    <div class="controls">
      <div>
        <label for="brush-size">Brush size: {{ brushSize }}</label>
        <input id="brush-size" v-model.number="brushSize" type="range" min="1" max="5" step="1" :disabled="tool === 'fill'" />
      </div>
      <div class="color-row">
        <label for="custom-color">Custom color</label>
        <input id="custom-color" v-model="color" type="color" @input="tool = 'brush'" />
        <span class="color-chip" :style="{ background: activeColor }" aria-hidden="true"></span>
      </div>
      <div class="switch-row">
        <label for="draw-grid">Show grid</label>
        <input id="draw-grid" v-model="showGrid" type="checkbox" role="switch" />
      </div>
    </div>

    <div class="palette" aria-label="Minecraft tone palette">
      <button
        v-for="tone in PALETTE"
        :key="tone.id"
        type="button"
        class="swatch"
        :class="{ active: color === tone.hex && tool !== 'eraser' }"
        :style="{ background: tone.hex }"
        :aria-label="tone.name"
        :aria-pressed="color === tone.hex && tool !== 'eraser'"
        :title="tone.name"
        @click="selectPalette(tone.hex)"
      ></button>
    </div>
    <p class="hint">Draw with the 19 Minecraft tones or a custom color. The eraser paints white. Your drawing is mapped through the same OKLab pipeline as a photo.</p>
  </div>
</template>

<style scoped>
.drawing { display: grid; gap: 14px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; }
.toolbar button.active { border-color: var(--text); color: var(--text); }
.draw-canvas {
  width: 100%;
  max-width: 480px;
  aspect-ratio: 1;
  margin: 0 auto;
  display: block;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
  image-rendering: pixelated;
  touch-action: none;
  cursor: crosshair;
}
.controls { display: grid; gap: 12px; grid-template-columns: 1fr; }
.color-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.color-row label { margin: 0; }
.color-row input[type="color"] {
  width: 56px;
  height: 44px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--plate-2);
  cursor: pointer;
}
.color-chip { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--line); }
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.switch-row label { margin: 0; }
.switch-row input { width: 44px; height: 44px; accent-color: var(--action); }
.palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 8px; }
.swatch {
  min-height: 44px;
  padding: 0;
  border-radius: 10px;
  border: 2px solid var(--line);
  cursor: pointer;
}
.swatch.active { border-color: var(--text); box-shadow: 0 0 0 2px var(--bg) inset; }
.hint { margin: 0; color: var(--muted); font-size: 0.82rem; }
@media (min-width: 720px) {
  .controls { grid-template-columns: repeat(3, 1fr); align-items: end; }
}
</style>
