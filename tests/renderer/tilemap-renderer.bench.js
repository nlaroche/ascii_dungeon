import { describe, bench, beforeAll } from 'vitest';
import { createMockDevice } from '../helpers/gpu-mock.js';
import {
  CELL_SIZE_BYTES,
  CELL_FLAGS,
  colorToU32,
  createTilemapRenderer,
} from '../../src/renderer/TilemapRenderer.js';

beforeAll(() => {
  globalThis.GPUBufferUsage = { STORAGE: 0x80, COPY_DST: 0x08, UNIFORM: 0x40, COPY_SRC: 0x04 };
  globalThis.GPUShaderStage = { VERTEX: 0x1, FRAGMENT: 0x2, COMPUTE: 0x4 };
  globalThis.GPUTextureUsage = { TEXTURE_BINDING: 0x04, COPY_DST: 0x02, RENDER_ATTACHMENT: 0x10 };
});

function makeRenderer(w = 80, h = 50) {
  const device = createMockDevice();
  const atlas = device.createTexture({
    size: [1024, 384],
    format: 'r8unorm',
    usage: 0x04,
  });
  return createTilemapRenderer(device, 'bgra8unorm', atlas, w, h);
}

describe('TilemapRenderer benchmarks', () => {
  const fg = colorToU32('#ff0000');
  const bg = colorToU32('#0000ff');

  bench('setTile single cell', () => {
    const r = makeRenderer(80, 50);
    r.setTile(10, 10, 65, fg, bg, 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED);
  }, { iterations: 1000 });

  bench('setTile fill 80x50 grid', () => {
    const r = makeRenderer(80, 50);
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 80; x++) {
        r.setTile(x, y, 65, fg, bg, 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED);
      }
    }
  }, { iterations: 1000 });

  bench('clearGrid 80x50', () => {
    const r = makeRenderer(80, 50);
    r.clearGrid();
  }, { iterations: 1000 });

  bench('colorToU32 conversion', () => {
    colorToU32('#ff0000');
  }, { iterations: 1000 });

  bench('setTile + clearGrid frame cycle', () => {
    const r = makeRenderer(80, 50);
    r.clearGrid();
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 80; x++) {
        r.setTile(x, y, 65, fg, bg, 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED);
      }
    }
  }, { iterations: 1000 });
});
