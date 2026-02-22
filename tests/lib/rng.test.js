import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/lib/rng.js';

describe('rng', () => {
  it('should produce deterministic values from same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('should produce different values from different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    // At least one of the first 5 values should differ
    let allSame = true;
    for (let i = 0; i < 5; i++) {
      if (a() !== b()) allSame = false;
    }
    expect(allSame).toBe(false);
  });

  it('should return values in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int should return values in [0, max)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const v = rng.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('range should return values in [min, max)', () => {
    const rng = createRng(55);
    for (let i = 0; i < 200; i++) {
      const v = rng.range(5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(15);
    }
  });

  it('float should return values in [min, max)', () => {
    const rng = createRng(77);
    for (let i = 0; i < 200; i++) {
      const v = rng.float(2.0, 5.0);
      expect(v).toBeGreaterThanOrEqual(2.0);
      expect(v).toBeLessThan(5.0);
    }
  });

  it('pick should return elements from array', () => {
    const rng = createRng(10);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('shuffle should be deterministic', () => {
    const a = createRng(42);
    const b = createRng(42);
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];
    a.shuffle(arr1);
    b.shuffle(arr2);
    expect(arr1).toEqual(arr2);
  });

  it('shuffle should actually permute', () => {
    const rng = createRng(42);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const original = [...arr];
    rng.shuffle(arr);
    // Extremely unlikely to remain identical with 10 elements
    expect(arr).not.toEqual(original);
    // But should contain same elements
    expect(arr.sort()).toEqual(original.sort());
  });
});
