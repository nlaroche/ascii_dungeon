import { describe, it, expect } from 'vitest';
import {
  generateSDF,
  getUV,
  ATLAS_COLS,
  ATLAS_ROWS,
  ATLAS_WIDTH,
  ATLAS_HEIGHT,
} from '../../src/renderer/SDFAtlas.js';

describe('generateSDF', () => {
  it('returns Float32Array of correct length', () => {
    const grid = new Uint8Array(100); // 10x10 all zeros
    const sdf = generateSDF(grid, 10, 10);
    expect(sdf).toBeInstanceOf(Float32Array);
    expect(sdf.length).toBe(100);
  });

  it('all values are in 0-1 range', () => {
    // Create a 20x20 grid with a filled 10x10 square in the center
    const w = 20, h = 20;
    const grid = new Uint8Array(w * h);
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        grid[y * w + x] = 1;
      }
    }
    const sdf = generateSDF(grid, w, h, 16);
    for (let i = 0; i < sdf.length; i++) {
      expect(sdf[i]).toBeGreaterThanOrEqual(0);
      expect(sdf[i]).toBeLessThanOrEqual(1);
    }
  });

  it('center of filled region has value < 0.5 (inside)', () => {
    const w = 30, h = 30;
    const grid = new Uint8Array(w * h);
    for (let y = 5; y < 25; y++) {
      for (let x = 5; x < 25; x++) {
        grid[y * w + x] = 1;
      }
    }
    const sdf = generateSDF(grid, w, h, 32);
    const centerIdx = 15 * w + 15;
    expect(sdf[centerIdx]).toBeLessThan(0.5);
  });

  it('far outside region has value > 0.5', () => {
    const w = 30, h = 30;
    const grid = new Uint8Array(w * h);
    for (let y = 12; y < 18; y++) {
      for (let x = 12; x < 18; x++) {
        grid[y * w + x] = 1;
      }
    }
    const sdf = generateSDF(grid, w, h, 32);
    // Corner should be far outside
    expect(sdf[0]).toBeGreaterThan(0.5);
  });

  it('edge pixels are approximately 0.5', () => {
    const w = 40, h = 40;
    const grid = new Uint8Array(w * h);
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        grid[y * w + x] = 1;
      }
    }
    const sdf = generateSDF(grid, w, h, 32);
    // Just inside the edge (10, 20) and just outside (9, 20)
    const insideEdge = sdf[20 * w + 10];
    const outsideEdge = sdf[20 * w + 9];
    expect(insideEdge).toBeLessThan(0.52);
    expect(insideEdge).toBeGreaterThan(0.45);
    expect(outsideEdge).toBeGreaterThan(0.48);
    expect(outsideEdge).toBeLessThan(0.55);
  });

  it('all-empty grid gives all values >= 0.5', () => {
    const grid = new Uint8Array(25); // 5x5 all zeros
    const sdf = generateSDF(grid, 5, 5, 8);
    for (let i = 0; i < sdf.length; i++) {
      expect(sdf[i]).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('all-filled grid gives all values <= 0.5', () => {
    const grid = new Uint8Array(25).fill(1); // 5x5 all ones
    const sdf = generateSDF(grid, 5, 5, 8);
    for (let i = 0; i < sdf.length; i++) {
      expect(sdf[i]).toBeLessThanOrEqual(0.5);
    }
  });

  it('distance increases away from the edge', () => {
    const w = 40, h = 40;
    const grid = new Uint8Array(w * h);
    for (let y = 15; y < 25; y++) {
      for (let x = 15; x < 25; x++) {
        grid[y * w + x] = 1;
      }
    }
    const sdf = generateSDF(grid, w, h, 32);
    // Moving away from edge outside: values should increase
    const atEdge = sdf[20 * w + 14]; // just outside
    const far = sdf[20 * w + 5]; // far outside
    expect(far).toBeGreaterThan(atEdge);
  });

  it('handles small spread values', () => {
    const w = 20, h = 20;
    const grid = new Uint8Array(w * h);
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        grid[y * w + x] = 1;
      }
    }
    const sdf = generateSDF(grid, w, h, 4);
    // With small spread, values should saturate quickly
    const farOutside = sdf[0];
    expect(farOutside).toBe(1); // should clamp to 1
  });
});

describe('getUV', () => {
  it('returns correct UVs for space (32)', () => {
    const uv = getUV(32);
    expect(uv.u0).toBeCloseTo(0);
    expect(uv.v0).toBeCloseTo(0);
    expect(uv.u1).toBeCloseTo(1 / ATLAS_COLS);
    expect(uv.v1).toBeCloseTo(1 / ATLAS_ROWS);
  });

  it('returns correct UVs for A (65)', () => {
    const uv = getUV(65);
    const idx = 65 - 32; // 33
    const col = idx % ATLAS_COLS; // 33 % 16 = 1
    const row = Math.floor(idx / ATLAS_COLS); // 33 / 16 = 2
    expect(uv.u0).toBeCloseTo(col / ATLAS_COLS);
    expect(uv.v0).toBeCloseTo(row / ATLAS_ROWS);
  });

  it('returns correct UVs for tilde (126)', () => {
    const uv = getUV(126);
    const idx = 126 - 32; // 94
    const col = idx % ATLAS_COLS; // 94 % 16 = 14
    const row = Math.floor(idx / ATLAS_COLS); // 94 / 16 = 5
    expect(uv.u0).toBeCloseTo(col / ATLAS_COLS);
    expect(uv.v0).toBeCloseTo(row / ATLAS_ROWS);
    expect(uv.u1).toBeCloseTo((col + 1) / ATLAS_COLS);
    expect(uv.v1).toBeCloseTo((row + 1) / ATLAS_ROWS);
  });

  it('throws for charCode < 32', () => {
    expect(() => getUV(31)).toThrow();
    expect(() => getUV(0)).toThrow();
  });

  it('throws for charCode > 126', () => {
    expect(() => getUV(127)).toThrow();
    expect(() => getUV(200)).toThrow();
  });

  it('UVs are within 0-1 range for all valid codes', () => {
    for (let code = 32; code <= 126; code++) {
      const uv = getUV(code);
      expect(uv.u0).toBeGreaterThanOrEqual(0);
      expect(uv.v0).toBeGreaterThanOrEqual(0);
      expect(uv.u1).toBeLessThanOrEqual(1);
      expect(uv.v1).toBeLessThanOrEqual(1);
      expect(uv.u1).toBeGreaterThan(uv.u0);
      expect(uv.v1).toBeGreaterThan(uv.v0);
    }
  });
});

describe('atlas constants', () => {
  it('atlas dimensions are 1024x384', () => {
    expect(ATLAS_WIDTH).toBe(1024);
    expect(ATLAS_HEIGHT).toBe(384);
  });

  it('fits 96 characters (32-126)', () => {
    expect(ATLAS_COLS * ATLAS_ROWS).toBe(96);
  });
});
