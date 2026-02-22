// ── UI Animation Tweens ──
// Tween objects that update per frame. Uses existing easing library.

import { easeOutQuint, clamp } from './easing.js';

// ── Fade ──

/**
 * Create a fade animation (opacity tween).
 * @param {number} duration Seconds
 * @param {number} [from=0] Start alpha
 * @param {number} [to=1] End alpha
 * @param {Function} [easing] Easing function
 * @returns {object} Fade state
 */
export function createFade(duration, from = 0, to = 1, easing = easeOutQuint) {
  return { elapsed: 0, duration, from, to, easing };
}

/**
 * Update a fade tween.
 * @param {object} anim Fade state
 * @param {number} dt Delta time in seconds
 * @returns {{ alpha: number, done: boolean }}
 */
export function updateFade(anim, dt) {
  anim.elapsed += dt;
  const t = clamp(anim.elapsed / anim.duration, 0, 1);
  const eased = anim.easing(t);
  const alpha = anim.from + (anim.to - anim.from) * eased;
  return { alpha, done: t >= 1 };
}

// ── Slide ──

/**
 * Create a slide animation (position tween).
 * @param {number} duration Seconds
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {Function} [easing]
 * @returns {object} Slide state
 */
export function createSlide(duration, fromX, fromY, toX, toY, easing = easeOutQuint) {
  return { elapsed: 0, duration, fromX, fromY, toX, toY, easing };
}

/**
 * Update a slide tween.
 * @param {object} anim Slide state
 * @param {number} dt Delta time in seconds
 * @returns {{ x: number, y: number, done: boolean }}
 */
export function updateSlide(anim, dt) {
  anim.elapsed += dt;
  const t = clamp(anim.elapsed / anim.duration, 0, 1);
  const eased = anim.easing(t);
  const x = anim.fromX + (anim.toX - anim.fromX) * eased;
  const y = anim.fromY + (anim.toY - anim.fromY) * eased;
  return { x, y, done: t >= 1 };
}

// ── Pulse ──

/**
 * Create a never-ending pulse animation.
 * @param {number} freq Frequency in Hz
 * @param {number} [amp=1] Amplitude (0 to amp)
 * @returns {object} Pulse state
 */
export function createPulse(freq, amp = 1) {
  return { elapsed: 0, freq, amp };
}

/**
 * Update a pulse tween.
 * @param {object} anim Pulse state
 * @param {number} dt Delta time in seconds
 * @returns {{ value: number, done: boolean }}
 */
export function updatePulse(anim, dt) {
  anim.elapsed += dt;
  const value = (Math.sin(anim.elapsed * anim.freq * Math.PI * 2) * 0.5 + 0.5) * anim.amp;
  return { value, done: false };
}

// ── Typewriter ──

/**
 * Create a typewriter animation that reveals text over time.
 * @param {string} text Full text to reveal
 * @param {number} charsPerSec Characters revealed per second
 * @returns {object} Typewriter state
 */
export function createTypewriter(text, charsPerSec) {
  return { elapsed: 0, text, charsPerSec };
}

/**
 * Update a typewriter tween.
 * @param {object} anim Typewriter state
 * @param {number} dt Delta time in seconds
 * @returns {{ visibleText: string, done: boolean }}
 */
export function updateTypewriter(anim, dt) {
  anim.elapsed += dt;
  const count = Math.floor(anim.elapsed * anim.charsPerSec);
  const visible = Math.min(count, anim.text.length);
  return {
    visibleText: anim.text.slice(0, visible),
    done: visible >= anim.text.length,
  };
}
