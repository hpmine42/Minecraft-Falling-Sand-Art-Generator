export type Size = 48 | 64 | 96;
export type Orientation = 'se' | 'sw' | 'nw' | 'ne';
export type Corner = 'near-left' | 'near-right' | 'far-left' | 'far-right';
export type FloorMode = 'none' | 'floor' | 'water';
export type Facing = 'east' | 'south' | 'west' | 'north';

export interface ToneGrid {
  readonly size: number;
  /** Row-major tone indices, length size * size. */
  readonly tones: Uint8Array;
}

export interface PlacementCommand {
  readonly kind: 'block' | 'torch';
  readonly s: number;
  readonly z: number;
  /** World offset from the anchor, which sits at ground Y under cell (0,0). */
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  /** Absolute Y, for tests and the height receipt. */
  readonly y: number;
  readonly tone: number | null;
  readonly facing: Facing | null;
  readonly block: string;
}

export interface CommandOptions {
  readonly groundY: number;
  readonly corner: Corner;
  readonly orientation: Orientation;
}

export interface DatapackOptions extends CommandOptions {
  readonly floorMode: FloorMode;
  readonly targetVersion: '26.3';
}

export interface ImageLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}
