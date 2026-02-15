import { bench, describe } from 'vitest';
import { generateSDF } from '../../src/renderer/SDFAtlas.js';

describe('SDF generation performance', () => {
  // Create a realistic glyph-like binary grid (circle inside 128x128)
  const size = 128;
  const grid = new Uint8Array(size * size);
  const center = size / 2;
  const radius = size * 0.35;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center, dy = y - center;
      if (dx * dx + dy * dy < radius * radius) {
        grid[y * size + x] = 1;
      }
    }
  }

  bench('generateSDF 128x128 single glyph', () => {
    generateSDF(grid, size, size, 32);
  }, { time: 1000 });

  // Simulate full atlas generation (96 glyphs)
  bench('generateSDF 128x128 x96 (full atlas)', () => {
    for (let i = 0; i < 96; i++) {
      generateSDF(grid, size, size, 32);
    }
  }, { time: 3000, iterations: 3 });
});
