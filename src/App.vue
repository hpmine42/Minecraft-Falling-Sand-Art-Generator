<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import CropEditor from './components/CropEditor.vue';
import MosaicPreview from './components/MosaicPreview.vue';
import StaircasePreview from './components/StaircasePreview.vue';
import { centerCrop, imageToTones } from './lib/image';
import { checkHeight, sizeWarning, SIZES } from './lib/height';
import { createDatapackZip, datapackFilename } from './lib/zip';
import type { Corner, CropRect, FloorMode, ImageLike, Size, ToneGrid } from './lib/types';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const image = shallowRef<ImageLike | null>(null);
const source = shallowRef<HTMLCanvasElement | null>(null);
const crop = ref<CropRect>({ x: 0, y: 0, size: 1 });
const size = ref<Size>(48);
const corner = ref<Corner>('near-left');
const groundY = ref(64);
const floorMode = ref<FloorMode>('none');
const dither = ref(false);
const targetVersion = ref<'26.3'>('26.3');
const dragOver = ref(false);
const busy = ref(false);
const status = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const installPrompt = ref<InstallPromptEvent | null>(null);
const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { online.value = true; });
  window.addEventListener('offline', () => { online.value = false; });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt.value = event as InstallPromptEvent;
  });
}

const grid = computed<ToneGrid | null>(() => {
  if (!image.value) return null;
  return imageToTones(image.value, crop.value, size.value, dither.value);
});
const height = computed(() => checkHeight(size.value, groundY.value));
const warning = computed(() => sizeWarning(size.value));
const blockCount = computed(() => size.value * size.value);
const canDownload = computed(() => grid.value !== null && height.value.ok && !busy.value);

async function loadFile(file: File): Promise<void> {
  status.value = '';
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const maxDim = 2048;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const heightPx = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.drawImage(img, 0, 0, width, heightPx);
    const data = ctx.getImageData(0, 0, width, heightPx);
    image.value = { width, height: heightPx, data: data.data };
    source.value = canvas;
    crop.value = centerCrop(width, heightPx);
  } catch {
    status.value = 'Could not read that image. Try a PNG, JPEG, WebP, or GIF.';
  } finally {
    URL.revokeObjectURL(url);
  }
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void loadFile(file);
  input.value = '';
}

function onDrop(event: DragEvent): void {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void loadFile(file);
}

async function download(): Promise<void> {
  if (!grid.value || !height.value.ok) return;
  busy.value = true;
  status.value = '';
  try {
    const zip = createDatapackZip(grid.value, {
      groundY: groundY.value,
      corner: corner.value,
      orientation: 'se',
      floorMode: floorMode.value,
      targetVersion: targetVersion.value,
    });
    const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = datapackFilename(size.value);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.value = `Downloaded ${datapackFilename(size.value)}.`;
  } catch {
    status.value = 'Could not assemble the ZIP. Try a smaller size.';
  } finally {
    busy.value = false;
  }
}

async function install(): Promise<void> {
  const prompt = installPrompt.value;
  if (prompt) {
    await prompt.prompt();
    installPrompt.value = null;
  }
}
</script>

<template>
  <main class="shell">
    <header class="hero">
      <div>
        <h1>Falling Sand Art</h1>
        <p class="tagline">Picture in. Datapack out. Break one torch and the whole staircase lands as pixel art.</p>
      </div>
      <div class="badges">
        <span class="badge">{{ online ? 'Online' : 'Offline' }}</span>
        <span class="badge">On-device</span>
        <button v-if="installPrompt" class="btn" type="button" @click="install">Install app</button>
      </div>
    </header>

    <section class="panel">
      <h2>1 · Choose a picture</h2>
      <div
        class="dropzone"
        :class="{ over: dragOver }"
        role="button"
        tabindex="0"
        aria-label="Choose or drop an image"
        @click="fileInput?.click()"
        @keydown.enter.prevent="fileInput?.click()"
        @keydown.space.prevent="fileInput?.click()"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <p v-if="!image">Drag &amp; drop a picture here, or tap to choose from your camera roll.</p>
        <p v-else>Picture loaded. Adjust the square crop below, or drop another picture to replace it.</p>
        <input ref="fileInput" type="file" accept="image/*" class="visually-hidden" @change="onPick" />
      </div>
      <CropEditor v-if="image && source" v-model:crop="crop" :image="image" :source="source" />
    </section>

    <section class="panel">
      <h2>2 · Settings</h2>
      <div class="settings">
        <fieldset class="size-field">
          <legend>Size</legend>
          <div class="segmented">
            <button
              v-for="s in SIZES"
              :key="s"
              type="button"
              :class="{ active: size === s }"
              :aria-pressed="size === s"
              @click="size = s"
            >{{ s }} × {{ s }}</button>
          </div>
        </fieldset>
        <div>
          <label for="corner">Start corner under you</label>
          <select id="corner" v-model="corner">
            <option value="near-left">Near corner (default)</option>
            <option value="near-right">Along the first axis</option>
            <option value="far-left">Along the second axis</option>
            <option value="far-right">Far corner</option>
          </select>
        </div>
        <div>
          <label for="ground-y">Ground Y (G)</label>
          <input id="ground-y" v-model.number="groundY" type="number" min="-64" max="319" step="1" />
          <p class="hint">The block you stand on. If F3 shows your feet at Y=65, enter 64.</p>
        </div>
        <div>
          <label for="floor">Landing floor</label>
          <select id="floor" v-model="floorMode">
            <option value="none">None (use existing ground)</option>
            <option value="floor">Floor</option>
            <option value="water">Floor + water</option>
          </select>
        </div>
        <div>
          <label for="version">Target version</label>
          <select id="version" v-model="targetVersion">
            <option value="26.3">Java Edition 26.3</option>
          </select>
        </div>
        <div class="switch-row">
          <label for="dither">Dithering (OKLab)</label>
          <input id="dither" v-model="dither" type="checkbox" role="switch" />
        </div>
      </div>
      <p class="height" :class="{ bad: !height.ok }">{{ height.message }}</p>
      <p v-if="warning" class="warning">{{ warning }}</p>
    </section>

    <section class="panel">
      <h2>3 · Preview</h2>
      <div class="previews">
        <figure>
          <MosaicPreview :grid="grid" />
          <figcaption>From above — the picture you get.</figcaption>
        </figure>
        <figure>
          <StaircasePreview :grid="grid" />
          <figcaption>Tilted — the staircase before it falls.</figcaption>
        </figure>
      </div>
    </section>

    <section class="panel">
      <h2>4 · Download</h2>
      <p class="counts">{{ blockCount.toLocaleString('en-US') }} blocks · {{ blockCount.toLocaleString('en-US') }} torches</p>
      <button class="primary download" type="button" :disabled="!canDownload" @click="download">
        {{ busy ? 'Assembling…' : 'Download datapack ZIP' }}
      </button>
      <p v-if="status" class="status" role="status">{{ status }}</p>
      <ol class="instructions">
        <li>Copy the ZIP into <code>&lt;world&gt;/datapacks/</code>, then run <code>/reload</code>.</li>
        <li>Stand on the ground block, look along the diagonal, and run <code>/function fallingsand:build</code>.</li>
        <li>Wait for the ready message, then break the lowest torch. The structure falls into pixel art.</li>
      </ol>
      <p class="privacy">Nothing leaves your device. No upload, no account, no analytics.</p>
    </section>

    <footer class="footer">
      <p>Minecraft Java Edition 26.3 · data pack format 121.0 · 19 gravity tones mapped in OKLab.</p>
    </footer>
  </main>
</template>

<style scoped>
.shell { max-width: 960px; margin: 0 auto; padding: 20px 16px 48px; display: grid; gap: 16px; }
.hero { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: space-between; }
.tagline { color: var(--muted); margin: 8px 0 0; max-width: 46ch; }
.badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.badge { font-size: 0.75rem; border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; color: var(--muted); }
.panel { background: var(--plate); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
.dropzone {
  border: 1px dashed var(--line);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
  color: var(--muted);
  cursor: pointer;
  min-height: 96px;
  display: grid;
  place-items: center;
  margin-bottom: 16px;
}
.dropzone.over { border-color: var(--action); color: var(--text); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.settings { display: grid; gap: 14px; grid-template-columns: 1fr; }
.size-field { border: 0; padding: 0; margin: 0; }
.size-field legend { font-size: 0.85rem; color: var(--muted); margin-bottom: 6px; padding: 0; }
.segmented { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.segmented button.active { border-color: var(--text); color: var(--text); }
.hint { font-size: 0.78rem; color: var(--muted); margin: 6px 0 0; }
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.switch-row label { margin: 0; }
.switch-row input { width: 44px; height: 44px; accent-color: var(--action); }
.height { margin: 14px 0 0; color: var(--ok); font-size: 0.9rem; }
.height.bad { color: var(--danger); }
.warning { margin: 10px 0 0; color: var(--muted); font-size: 0.9rem; }
.previews { display: grid; gap: 16px; grid-template-columns: 1fr; }
figure { margin: 0; }
figcaption { color: var(--muted); font-size: 0.82rem; margin-top: 8px; text-align: center; }
.counts { color: var(--muted); margin: 0 0 12px; }
.download { width: 100%; }
.status { margin: 12px 0 0; color: var(--ok); }
.instructions { margin: 16px 0 0; padding-left: 20px; color: var(--muted); display: grid; gap: 8px; }
.privacy { margin: 16px 0 0; font-size: 0.82rem; color: var(--muted); }
.footer { color: var(--muted); font-size: 0.78rem; text-align: center; }
@media (min-width: 720px) {
  .settings { grid-template-columns: repeat(2, 1fr); }
  .size-field { grid-column: 1 / -1; }
  .previews { grid-template-columns: 1fr 1fr; }
}
</style>
