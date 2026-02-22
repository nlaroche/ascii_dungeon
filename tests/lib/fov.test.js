import { describe, it, expect } from 'vitest';
import { castFOV, hasLineOfSight } from '../../src/lib/fov.js';

describe('fov', () => {
  const W = 20, H = 15;

  /** Create a simple dungeon: 0=floor, 1=wall border */
  function createOpenMap() {
    const grid = [];
    for (let y = 0; y < H; y++) {
      grid[y] = new Uint8Array(W);
      for (let x = 0; x < W; x++) {
        grid[y][x] = (x === 0 || x === W - 1 || y === 0 || y === H - 1) ? 1 : 0;
      }
    }
    return grid;
  }

  describe('castFOV', () => {
    it('should always include the center cell', () => {
      const grid = createOpenMap();
      const visible = castFOV(10, 7, 5, W, H, (x, y) => grid[y][x] === 1);
      expect(visible.has((7 << 8) | 10)).toBe(true);
    });

    it('should see nearby open cells', () => {
      const grid = createOpenMap();
      const visible = castFOV(10, 7, 8, W, H, (x, y) => grid[y][x] === 1);
      // Adjacent cells should be visible
      expect(visible.has((7 << 8) | 11)).toBe(true);
      expect(visible.has((6 << 8) | 10)).toBe(true);
    });

    it('should not see behind walls', () => {
      const grid = createOpenMap();
      // Place a wall at (10, 5)
      grid[5][10] = 1;
      const visible = castFOV(10, 7, 8, W, H, (x, y) => grid[y][x] === 1);
      // Cell directly behind the wall should not be visible
      // (10, 4) is behind (10, 5) from (10, 7) perspective
      expect(visible.has((4 << 8) | 10)).toBe(false);
    });

    it('should see walls themselves (but not past them)', () => {
      const grid = createOpenMap();
      grid[5][10] = 1;
      const visible = castFOV(10, 7, 8, W, H, (x, y) => grid[y][x] === 1);
      // The wall cell itself should be visible
      expect(visible.has((5 << 8) | 10)).toBe(true);
    });

    it('should not see beyond radius', () => {
      const grid = createOpenMap();
      const visible = castFOV(10, 7, 3, W, H, (x, y) => grid[y][x] === 1);
      // (10, 2) is distance 5 from (10, 7) — beyond radius 3
      expect(visible.has((2 << 8) | 10)).toBe(false);
    });

    it('should handle corner position', () => {
      const grid = createOpenMap();
      const visible = castFOV(1, 1, 5, W, H, (x, y) => grid[y][x] === 1);
      expect(visible.has((1 << 8) | 1)).toBe(true);
      expect(visible.size).toBeGreaterThan(1);
    });
  });

  describe('hasLineOfSight', () => {
    it('should see through open space', () => {
      const grid = createOpenMap();
      expect(hasLineOfSight(5, 5, 10, 5, (x, y) => grid[y][x] === 1)).toBe(true);
    });

    it('should not see through walls', () => {
      const grid = createOpenMap();
      grid[5][7] = 1;
      expect(hasLineOfSight(5, 5, 10, 5, (x, y) => grid[y][x] === 1)).toBe(false);
    });

    it('should skip source wall when skipSourceWall is true', () => {
      const grid = createOpenMap();
      // Source is at wall (5, 5)
      grid[5][5] = 1;
      // Normally blocked
      expect(hasLineOfSight(5, 5, 10, 5, (x, y) => grid[y][x] === 1, false)).toBe(true);
      // Source is adjacent to wall
      grid[5][6] = 1;
      expect(hasLineOfSight(5, 5, 10, 5, (x, y) => grid[y][x] === 1, true)).toBe(true);
    });

    it('should handle same point', () => {
      const grid = createOpenMap();
      expect(hasLineOfSight(5, 5, 5, 5, (x, y) => grid[y][x] === 1)).toBe(true);
    });
  });
});
