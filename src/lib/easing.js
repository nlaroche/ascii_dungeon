/**
 * Easing functions — consolidates all easing math in one place.
 * All functions take t in [0, 1] and return a value in [0, 1].
 *
 * @example
 * import { easeOutQuint, lerp } from './easing.js';
 * const smoothT = easeOutQuint(0.5);
 * const value = lerp(0, 100, smoothT);
 */

/** Linear (identity). */
export function linear(t) { return t; }

/** Quadratic ease in. */
export function easeInQuad(t) { return t * t; }

/** Quadratic ease out. */
export function easeOutQuad(t) { return t * (2 - t); }

/** Quadratic ease in-out. */
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/** Cubic ease in. */
export function easeInCubic(t) { return t * t * t; }

/** Cubic ease out. */
export function easeOutCubic(t) { return (--t) * t * t + 1; }

/** Cubic ease in-out. */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

/** Quintic ease out — used for movement tweens. */
export function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }

/** Quintic ease in. */
export function easeInQuint(t) { return t * t * t * t * t; }

/** Smooth step (Hermite interpolation). */
export function smoothStep(t) { return t * t * (3 - 2 * t); }

/** Smoother step (Ken Perlin's improved version). */
export function smootherStep(t) { return t * t * t * (t * (6 * t - 15) + 10); }

/** Elastic ease out — springy overshoot. */
export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

/** Bounce ease out. */
export function easeOutBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

/**
 * Linear interpolation between two values.
 * @param {number} a Start value
 * @param {number} b End value
 * @param {number} t Interpolation factor (0–1)
 * @returns {number}
 */
export function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
