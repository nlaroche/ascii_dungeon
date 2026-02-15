import { describe, it, expect, beforeAll } from 'vitest';
import { createMockDevice } from '../helpers/gpu-mock.js';
import {
  CELL_SIZE_BYTES,
  CELL_FLAGS,
  LAYER_COUNT,
  LAYERS,
  colorToU32,
  createTilemapRenderer,
} from '../../src/renderer/TilemapRenderer.js';

// Mock WebGPU globals needed by createTilemapRenderer
beforeAll(() => {
  globalThis.GPUBufferUsage = { STORAGE: 0x80, COPY_DST: 0x08, UNIFORM: 0x40, COPY_SRC: 0x04 };
  globalThis.GPUShaderStage = { VERTEX: 0x1, FRAGMENT: 0x2, COMPUTE: 0x4 };
  globalThis.GPUTextureUsage = { TEXTURE_BINDING: 0x04, COPY_DST: 0x02, RENDER_ATTACHMENT: 0x10 };
});

describe('colorToU32', () => {
  it('converts #ff0000 to red with alpha', () => {
    expect(colorToU32('#ff0000')).toBe((0xff000000 | 0x000000ff) >>> 0);
  });

  it('converts 3-char hex #0f0 to green', () => {
    expect(colorToU32('#0f0')).toBe((0x00ff0000 | 0x000000ff) >>> 0);
  });

  it('converts #000000 to black with alpha 255', () => {
    expect(colorToU32('#000000')).toBe(0x000000ff);
  });

  it('converts #ffffff to white', () => {
    expect(colorToU32('#ffffff')).toBe(0xffffffff >>> 0);
  });

  it('works without # prefix', () => {
    expect(colorToU32('ff00ff')).toBe((0xff00ff00 | 0x000000ff) >>> 0);
  });
});

describe('CELL_SIZE_BYTES', () => {
  it('is 32 bytes', () => {
    expect(CELL_SIZE_BYTES).toBe(32);
  });
});

describe('CELL_FLAGS', () => {
  it('has correct bit values', () => {
    expect(CELL_FLAGS.VISIBLE).toBe(1);
    expect(CELL_FLAGS.EXPLORED).toBe(2);
    expect(CELL_FLAGS.HIGHLIGHTED).toBe(4);
  });
});

describe('LAYERS', () => {
  it('has 5 layers', () => {
    expect(LAYER_COUNT).toBe(5);
  });

  it('has correct layer indices', () => {
    expect(LAYERS.TERRAIN).toBe(0);
    expect(LAYERS.DECOR).toBe(1);
    expect(LAYERS.OBJECTS).toBe(2);
    expect(LAYERS.PLAYER).toBe(3);
    expect(LAYERS.EFFECTS).toBe(4);
  });
});

describe('createTilemapRenderer', () => {
  function makeRenderer(w = 10, h = 5) {
    const device = createMockDevice();
    const atlas = device.createTexture({
      size: [1024, 384],
      format: 'r8unorm',
      usage: 0x04,
    });
    return createTilemapRenderer(device, 'bgra8unorm', atlas, w, h);
  }

  it('creates correct buffer sizes with layers', () => {
    const r = makeRenderer(10, 5);
    expect(r.cellsPerLayer).toBe(50);
    expect(r.totalCells).toBe(50 * LAYER_COUNT);
    expect(r.cpuBuffer.byteLength).toBe(50 * LAYER_COUNT * CELL_SIZE_BYTES);
  });

  describe('setTile', () => {
    it('writes correct cell data to layer 0', () => {
      const r = makeRenderer(10, 5);
      const fg = colorToU32('#ff0000');
      const bg = colorToU32('#0000ff');
      r.setTile(0, 3, 2, 65, fg, bg, 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED);

      const index = 0 * 50 + 2 * 10 + 3; // layer 0
      const offset = index * CELL_SIZE_BYTES;
      expect(r.dataView.getUint32(offset + 0, true)).toBe(65); // glyph
      expect(r.dataView.getUint32(offset + 4, true)).toBe(fg); // fg
      expect(r.dataView.getUint32(offset + 8, true)).toBe(bg); // bg
      expect(r.dataView.getFloat32(offset + 12, true)).toBe(0.5); // depth
      expect(r.dataView.getFloat32(offset + 16, true)).toBe(1.0); // light default
      expect(r.dataView.getUint32(offset + 20, true)).toBe(3); // flags
      expect(r.dataView.getFloat32(offset + 24, true)).toBe(0); // offsetX default
      expect(r.dataView.getFloat32(offset + 28, true)).toBe(0); // offsetY default
    });

    it('writes to different layers at same (x,y)', () => {
      const r = makeRenderer(10, 5);
      const fg1 = colorToU32('#ff0000');
      const fg2 = colorToU32('#00ff00');

      r.setTile(LAYERS.TERRAIN, 5, 3, 35, fg1, 0, 0, 1); // '#' on terrain
      r.setTile(LAYERS.PLAYER, 5, 3, 64, fg2, 0, 0.5, 1); // '@' on player layer

      const terrainIdx = LAYERS.TERRAIN * 50 + 3 * 10 + 5;
      const playerIdx = LAYERS.PLAYER * 50 + 3 * 10 + 5;

      expect(r.dataView.getUint32(terrainIdx * CELL_SIZE_BYTES, true)).toBe(35);
      expect(r.dataView.getUint32(playerIdx * CELL_SIZE_BYTES, true)).toBe(64);
    });

    it('writes sub-cell offsets at byte offsets 24 and 28', () => {
      const r = makeRenderer(10, 5);
      const fg = colorToU32('#ff0000');
      const bg = colorToU32('#0000ff');
      r.setTile(0, 1, 1, 65, fg, bg, 0, 0, 1.0, 0.25, 0.75);

      const index = 0 * 50 + 1 * 10 + 1;
      const offset = index * CELL_SIZE_BYTES;
      expect(r.dataView.getFloat32(offset + 24, true)).toBeCloseTo(0.25);
      expect(r.dataView.getFloat32(offset + 28, true)).toBeCloseTo(0.75);
    });

    it('ignores out-of-bounds coordinates', () => {
      const r = makeRenderer(10, 5);
      r.setTile(0, 5, 2, 65, 0xffffffff, 0, 0, 1);
      r.setTile(0, -1, 0, 99, 0, 0, 0, 0);
      r.setTile(0, 10, 0, 99, 0, 0, 0, 0);
      r.setTile(0, 0, -1, 99, 0, 0, 0, 0);
      r.setTile(0, 0, 5, 99, 0, 0, 0, 0);
      // Original tile should be intact
      const index = 0 * 50 + 2 * 10 + 5;
      const offset = index * CELL_SIZE_BYTES;
      expect(r.dataView.getUint32(offset, true)).toBe(65);
    });

    it('ignores invalid layer index', () => {
      const r = makeRenderer(10, 5);
      r.setTile(0, 0, 0, 65, 0xffffffff, 0, 0, 1);
      r.setTile(-1, 0, 0, 99, 0, 0, 0, 0);
      r.setTile(5, 0, 0, 99, 0, 0, 0, 0);
      // Layer 0, (0,0) should still have glyph 65
      expect(r.dataView.getUint32(0, true)).toBe(65);
    });
  });

  describe('clearGrid', () => {
    it('zeros the entire buffer (all layers)', () => {
      const r = makeRenderer(10, 5);
      r.setTile(0, 0, 0, 65, 0xffffffff, 0xffffffff, 1.0, 7);
      r.setTile(4, 9, 4, 90, 0xffffffff, 0xffffffff, 1.0, 7);
      r.clearGrid();

      const bytes = new Uint8Array(r.cpuBuffer);
      const allZero = bytes.every(b => b === 0);
      expect(allZero).toBe(true);
    });
  });

  describe('clearLayer', () => {
    it('clears only the specified layer', () => {
      const r = makeRenderer(10, 5);
      r.setTile(LAYERS.TERRAIN, 5, 3, 35, 0xffffffff, 0, 0, 1);
      r.setTile(LAYERS.PLAYER, 5, 3, 64, 0xffffffff, 0, 0.5, 1);

      r.clearLayer(LAYERS.PLAYER);

      // Terrain still intact
      const terrainIdx = LAYERS.TERRAIN * 50 + 3 * 10 + 5;
      expect(r.dataView.getUint32(terrainIdx * CELL_SIZE_BYTES, true)).toBe(35);

      // Player layer cleared
      const playerIdx = LAYERS.PLAYER * 50 + 3 * 10 + 5;
      expect(r.dataView.getUint32(playerIdx * CELL_SIZE_BYTES, true)).toBe(0);
    });

    it('ignores invalid layer index', () => {
      const r = makeRenderer(10, 5);
      r.setTile(0, 0, 0, 65, 0xffffffff, 0, 0, 1);
      r.clearLayer(-1);
      r.clearLayer(5);
      // Should not crash, original data intact
      expect(r.dataView.getUint32(0, true)).toBe(65);
    });
  });
});
