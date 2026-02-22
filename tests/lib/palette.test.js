import { describe, it, expect } from 'vitest';
import { PALETTE, COLORS, nearest } from '../../src/lib/palette.js';

describe('PALETTE', () => {
  it('has exactly 29 colors', () => {
    expect(PALETTE).toHaveLength(29);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true);
  });

  it('contains only valid hex strings', () => {
    for (const hex of PALETTE) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has no duplicate colors', () => {
    const unique = new Set(PALETTE);
    expect(unique.size).toBe(PALETTE.length);
  });
});

describe('COLORS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(COLORS)).toBe(true);
  });

  it('all values are from the CC-29 palette', () => {
    const paletteSet = new Set(PALETTE);
    for (const [key, hex] of Object.entries(COLORS)) {
      expect(paletteSet.has(hex), `COLORS.${key} = ${hex} not in palette`).toBe(true);
    }
  });

  it('has expected semantic keys', () => {
    const required = [
      'bg', 'fg', 'accent', 'player', 'goblin', 'skeleton', 'torch', 'treasure',
      'wallFg', 'wallBg', 'floorFg', 'floorBg', 'damage', 'heal', 'flash',
      'combat', 'defense', 'vitality', 'exploration', 'fortune', 'arcane',
      'black',
    ];
    for (const key of required) {
      expect(COLORS).toHaveProperty(key);
    }
  });
});

describe('nearest()', () => {
  it('returns exact match with distance 0 for palette colors', () => {
    for (const hex of PALETTE) {
      const result = nearest(hex);
      expect(result.hex).toBe(hex);
      expect(result.distance).toBe(0);
    }
  });

  it('finds closest color for non-palette hex', () => {
    const result = nearest('#ff0000');
    expect(result.hex).toBe('#b45252'); // rust red is closest to pure red
    expect(result.distance).toBeGreaterThan(0);
  });

  it('finds closest color for white', () => {
    const result = nearest('#ffffff');
    expect(result.hex).toBe('#f2f0e5'); // cream
  });

  it('finds closest color for pure black', () => {
    const result = nearest('#000000');
    expect(result.hex).toBe('#212123'); // near-black
  });
});
