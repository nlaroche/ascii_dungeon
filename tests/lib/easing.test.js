import { describe, it, expect } from 'vitest';
import {
  linear, easeInQuad, easeOutQuad, easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeOutQuint, easeInQuint,
  smoothStep, smootherStep,
  easeOutElastic, easeOutBounce,
  lerp, clamp,
} from '../../src/lib/easing.js';

describe('easing', () => {
  // All easing functions should satisfy: f(0)=0, f(1)=1
  const easings = [
    ['linear', linear],
    ['easeInQuad', easeInQuad],
    ['easeOutQuad', easeOutQuad],
    ['easeInOutQuad', easeInOutQuad],
    ['easeInCubic', easeInCubic],
    ['easeOutCubic', easeOutCubic],
    ['easeInOutCubic', easeInOutCubic],
    ['easeOutQuint', easeOutQuint],
    ['easeInQuint', easeInQuint],
    ['smoothStep', smoothStep],
    ['smootherStep', smootherStep],
    ['easeOutElastic', easeOutElastic],
    ['easeOutBounce', easeOutBounce],
  ];

  for (const [name, fn] of easings) {
    it(`${name} should map 0→0 and 1→1`, () => {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    });
  }

  it('easeOutQuad should decelerate (midpoint > 0.5)', () => {
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });

  it('easeInQuad should accelerate (midpoint < 0.5)', () => {
    expect(easeInQuad(0.5)).toBeLessThan(0.5);
  });

  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 1)).toBe(100);
      expect(lerp(0, 100, 0.5)).toBe(50);
    });

    it('should work with negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('should clamp values to range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});
