// ── Shared Juice Rendering ──
// Particle and float-text rendering loops used by CombatSim, JuiceLab, and other tabs.

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';

/**
 * Render juice particles onto the grid.
 *
 * @param {object} renderer Renderer instance
 * @param {Array} particles Particle array from juiceState
 * @param {number} gridW Grid width
 * @param {number} gridH Grid height
 * @param {object} [opts]
 * @param {string} [opts.bg='#00000000'] Background color for particles
 */
export function drawParticles(renderer, particles, gridW, gridH, opts = {}) {
  const bg = opts.bg || '#00000000';
  for (const p of particles) {
    const px = Math.floor(p.x);
    const py = Math.floor(p.y);
    if (px < 1 || px >= gridW - 1 || py < 1 || py >= gridH - 1) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    renderer.setCell(
      px, py, p.char, p.color, bg, 0, CELL_FLAGS.VISIBLE,
      alpha, p.x - px, p.y - py, LAYERS.EFFECTS
    );
  }
}

/**
 * Render floating text (damage numbers, etc.) onto the grid.
 *
 * @param {object} renderer Renderer instance
 * @param {Array} floatTexts Float text array from juiceState
 * @param {number} gridW Grid width
 * @param {number} gridH Grid height
 * @param {object} [opts]
 * @param {string} [opts.bg] Default background color (overridden by per-text outline settings)
 */
/**
 * Linearly interpolate between two hex colors.
 * @param {string} c1 Start hex color (#rrggbb)
 * @param {string} c2 End hex color (#rrggbb)
 * @param {number} t Interpolation factor (0 = c1, 1 = c2)
 * @returns {string} Interpolated hex color
 */
function lerpColor(c1, c2, t) {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * Render floating text (damage numbers, etc.) onto the grid.
 *
 * Supports animated color gradient via `colorEnd` property on float texts:
 * when set, color interpolates from `color` → `colorEnd` as life decreases.
 *
 * Supports animated scale via `scaleStart` property: when set, scale
 * interpolates from `scaleStart` → `scale` as life decreases.
 *
 * NOTE: BOLD flag (CELL_FLAGS.BOLD) is broken on overlay layers (1-4) —
 * glyphs become invisible. Use outline + scale for emphasis instead.
 *
 * @param {object} renderer Renderer instance
 * @param {Array} floatTexts Float text array from juiceState
 * @param {number} gridW Grid width
 * @param {number} gridH Grid height
 * @param {object} [opts]
 * @param {string} [opts.bg] Default background color (overridden by per-text outline settings)
 */
export function drawFloatTexts(renderer, floatTexts, gridW, gridH, opts = {}) {
  const defaultBg = opts.bg || '#00000000';
  for (const ft of floatTexts) {
    const t = Math.max(0, ft.life / ft.maxLife); // 1.0 = fresh, 0.0 = expired
    // Never use BOLD on overlay layers — it's broken (glyphs become invisible)
    // DAMAGE_FX provides thick glyphs + glow via shader instead
    const flags = CELL_FLAGS.VISIBLE | (ft.damageFx ? CELL_FLAGS.DAMAGE_FX : 0);
    const bgColor = ft.outline ? (ft.outlineColor || '#000000') : defaultBg;

    // Animated color gradient: color → colorEnd as life decreases
    const fgColor = ft.colorEnd ? lerpColor(ft.color, ft.colorEnd, 1 - t) : ft.color;

    // Animated scale: scaleStart → scale as life decreases
    const baseScale = ft.scale || 1.0;
    const startScale = ft.scaleStart || baseScale;
    const scale = startScale + (baseScale - startScale) * (1 - t);

    for (let i = 0; i < ft.text.length; i++) {
      const tx = Math.floor(ft.x) + i;
      const ty = Math.floor(ft.y);
      if (tx < 1 || tx >= gridW - 1 || ty < 1 || ty >= gridH - 1) continue;
      renderer.setCell(
        tx, ty, ft.text[i], fgColor, bgColor, 0, flags,
        t, ft.x - Math.floor(ft.x), ft.y - ty, LAYERS.EFFECTS,
        scale, scale
      );
    }
  }
}
