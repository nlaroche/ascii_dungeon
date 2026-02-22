import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDungeon } from '../../src/lib/dungeon.js';

describe('generateDungeon', () => {
  let randomSpy;

  beforeEach(() => {
    let seed = 42;
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    });
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('returns grid with correct dimensions', () => {
    const d = generateDungeon({ width: 30, height: 20 });
    expect(d.width).toBe(30);
    expect(d.height).toBe(20);
    expect(d.grid.length).toBe(20);
    expect(d.grid[0].length).toBe(30);
  });

  it('uses default dimensions when no config given', () => {
    const d = generateDungeon();
    expect(d.width).toBe(20);
    expect(d.height).toBe(15);
  });

  it('generates requested number of rooms', () => {
    const d = generateDungeon({ roomCount: 3, width: 40, height: 30 });
    expect(d.rooms.length).toBe(3);
  });

  it('grid cells have correct structure', () => {
    const d = generateDungeon({ width: 10, height: 10, roomCount: 1 });
    const cell = d.grid[0][0];
    expect(cell).toHaveProperty('type');
    expect(cell).toHaveProperty('explored');
    expect(cell).toHaveProperty('seen');
    expect(cell).toHaveProperty('contents');
  });

  it('rooms carve floor tiles', () => {
    const d = generateDungeon({ width: 30, height: 20, roomCount: 2 });
    let floorCount = 0;
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        if (d.grid[y][x].type === 'floor') floorCount++;
      }
    }
    expect(floorCount).toBeGreaterThan(0);
  });

  it('corridors connect consecutive rooms', () => {
    const d = generateDungeon({ width: 40, height: 30, roomCount: 3 });
    for (let i = 1; i < d.rooms.length; i++) {
      const prev = d.rooms[i - 1];
      const curr = d.rooms[i];
      const prevCX = Math.floor(prev.x + prev.w / 2);
      const prevCY = Math.floor(prev.y + prev.h / 2);
      const currCX = Math.floor(curr.x + curr.w / 2);

      // Horizontal corridor at prevCenterY
      const startX = Math.min(prevCX, currCX);
      const endX = Math.max(prevCX, currCX);
      for (let x = startX; x <= endX; x++) {
        expect(d.grid[prevCY][x].type).toBe('floor');
      }
    }
  });

  it('all cells start unexplored and unseen', () => {
    const d = generateDungeon({ width: 10, height: 10, roomCount: 1 });
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        expect(d.grid[y][x].explored).toBe(false);
        expect(d.grid[y][x].seen).toBe(false);
      }
    }
  });

  it('enemy stats scale with player level', () => {
    let enemy = null;
    for (let attempt = 0; attempt < 20 && !enemy; attempt++) {
      randomSpy.mockRestore();
      let seed = 100 + attempt;
      randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
      });
      const d = generateDungeon({ width: 40, height: 30, roomCount: 5, playerLevel: 5 });
      for (let y = 0; y < d.height && !enemy; y++) {
        for (let x = 0; x < d.width && !enemy; x++) {
          if (d.grid[y][x].contents?.type === 'enemy') {
            enemy = d.grid[y][x].contents;
          }
        }
      }
    }
    if (enemy) {
      expect(enemy.hp).toBe(70);  // 20 + 5*10
      expect(enemy.attack).toBe(15);  // 5 + 5*2
    }
  });

  it('rooms stay within grid bounds', () => {
    const d = generateDungeon({ width: 20, height: 15, roomCount: 5 });
    for (const room of d.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(1);
      expect(room.y).toBeGreaterThanOrEqual(1);
      expect(room.x + room.w).toBeLessThan(d.width);
      expect(room.y + room.h).toBeLessThan(d.height);
    }
  });
});
