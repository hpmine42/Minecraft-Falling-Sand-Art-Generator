import { zipSync } from 'fflate';
import { datapackFiles } from './datapack';
import type { DatapackOptions, ToneGrid } from './types';

/**
 * fflate is chosen because it is tiny (a few KB gzipped), dependency-free, and
 * its synchronous zipSync is ample for the small text payloads we emit. Keeping
 * the whole ZIP in memory is simpler than streaming and stays well under a MB.
 */
export function createDatapackZip(grid: ToneGrid, options: DatapackOptions): Uint8Array {
  const files = datapackFiles(grid, options);
  // Fixed mtime makes the ZIP byte-deterministic for tests and caching.
  return zipSync(files, { level: 6, mtime: new Date('1980-01-01T00:00:00Z') });
}

export function datapackFilename(size: number): string {
  return `falling-sand-art-${size}x${size}.zip`;
}
