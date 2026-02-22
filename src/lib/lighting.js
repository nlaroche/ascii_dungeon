// ── Shared Lighting Module ──
// Reusable torch colors, flicker, radial light computation, and wall inheritance.
// Used by GraphicsLab (full dungeon) and JuiceLab (arena).

// ── Constants ──
export const TORCH_COLOR = [0.9, 0.65, 0.35];
export const PLAYER_COLOR = [0.4, 0.7, 0.5];
export const MIN_AMBIENT = [0.08, 0.08, 0.14];
export const TORCH_RADIUS = 12;
export const PLAYER_RADIUS = 8;

// ── Helpers ──

/** Pack r,g,b (0-255) into a hex color string. */
export function rgbHex(r, g, b) {
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

/** Deterministic flicker value for a torch at (tx, ty) at the given time. */
export function torchFlicker(time, tx, ty) {
  return 0.85 + Math.sin(time * 4 + tx * 3.7 + ty * 2.3) * 0.15;
}

/**
 * Compute radial light from point sources onto renderer's sub-cell light map.
 *
 * @param {Object} renderer - Renderer instance (needs setLightTexel, clearLightMap)
 * @param {Array} sources - Light sources: [{ x, y, color: [r,g,b], radius, intensity }]
 * @param {number} gridW - Grid width in cells
 * @param {number} gridH - Grid height in cells
 * @param {number} subRes - Sub-cell resolution (e.g. 3 = 3×3 sub-cells per cell)
 * @param {Object} [opts] - Options
 * @param {Function} [opts.losCheck] - (srcX, srcY, dstX, dstY) => bool, line-of-sight check
 * @param {number[]} [opts.ambient] - [r, g, b] minimum ambient light per visible cell
 * @param {Float32Array} [opts.aoMap] - Per-cell AO multiplier (length gridW*gridH)
 * @param {Set} [opts.visibleSet] - Set of (y<<8|x) keys for visible cells; if null, all cells are lit
 * @param {Function} [opts.isFloor] - (x, y) => bool, whether cell is a floor (not wall/void)
 * @returns {{ lightR: Float32Array, lightG: Float32Array, lightB: Float32Array }}
 */
export function computeRadialLight(renderer, sources, gridW, gridH, subRes, opts = {}) {
  const {
    losCheck = null,
    ambient = null,
    aoMap = null,
    visibleSet = null,
    isFloor = null,
  } = opts;

  renderer.clearLightMap();

  const lightR = new Float32Array(gridW * gridH);
  const lightG = new Float32Array(gridW * gridH);
  const lightB = new Float32Array(gridW * gridH);

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      // Skip cells not in visible set (if provided)
      if (visibleSet) {
        const key = (y << 8) | x;
        if (!visibleSet.has(key)) continue;
      }

      // Skip non-floor cells (if filter provided)
      if (isFloor && !isFloor(x, y)) continue;

      // Cache LOS results per cell (expensive, do once)
      let srcLOS;
      if (losCheck) {
        srcLOS = sources.map(s => {
          const dx = x - s.x, dy = y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= s.radius) return false;
          return losCheck(s.x, s.y, x, y, s.wallMounted || false);
        });
      }

      const ao = aoMap ? aoMap[y * gridW + x] : 1.0;
      let cellSumR = 0, cellSumG = 0, cellSumB = 0;

      for (let sy = 0; sy < subRes; sy++) {
        for (let sx = 0; sx < subRes; sx++) {
          const fx = x + (sx + 0.5) / subRes;
          const fy = y + (sy + 0.5) / subRes;
          let r = 0, g = 0, b = 0;

          for (let si = 0; si < sources.length; si++) {
            if (losCheck && !srcLOS[si]) continue;
            const s = sources[si];
            const dx = fx - s.x, dy = fy - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= s.radius) continue;

            const falloff = Math.max(0, 1.0 - dist / s.radius);
            const intensity = falloff * falloff * (s.intensity || 1.0);
            r += s.color[0] * intensity;
            g += s.color[1] * intensity;
            b += s.color[2] * intensity;
          }

          // Minimum ambient
          if (ambient) {
            r = Math.max(r, ambient[0]);
            g = Math.max(g, ambient[1]);
            b = Math.max(b, ambient[2]);
          }

          // AO
          r *= ao; g *= ao; b *= ao;

          renderer.setLightTexel(x * subRes + sx, y * subRes + sy, r, g, b);
          cellSumR += r; cellSumG += g; cellSumB += b;
        }
      }

      const subCount = subRes * subRes;
      const idx = y * gridW + x;
      lightR[idx] = cellSumR / subCount;
      lightG[idx] = cellSumG / subCount;
      lightB[idx] = cellSumB / subCount;
    }
  }

  return { lightR, lightG, lightB };
}

/**
 * Walls inherit max light from adjacent floor cells (× factor).
 * Updates both per-cell arrays and renderer sub-cell light map.
 *
 * @param {Object} renderer - Renderer instance
 * @param {Float32Array} lightR - Per-cell R light
 * @param {Float32Array} lightG - Per-cell G light
 * @param {Float32Array} lightB - Per-cell B light
 * @param {number} gridW - Grid width
 * @param {number} gridH - Grid height
 * @param {number} subRes - Sub-cell resolution
 * @param {Function} isWall - (x, y) => bool
 * @param {Function} isFloor - (x, y) => bool
 * @param {Set} [visibleSet] - Set of (y<<8|x) keys; if null, all walls processed
 * @param {number} [factor=0.7] - Inheritance multiplier
 */
export function applyWallLightInheritance(
  renderer, lightR, lightG, lightB, gridW, gridH, subRes, isWall, isFloor, visibleSet = null, factor = 0.7
) {
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!isWall(x, y)) continue;
      if (visibleSet) {
        const key = (y << 8) | x;
        if (!visibleSet.has(key)) continue;
      }

      let maxR = 0, maxG = 0, maxB = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && isFloor(nx, ny)) {
            const nIdx = ny * gridW + nx;
            if (lightR[nIdx] > maxR) maxR = lightR[nIdx];
            if (lightG[nIdx] > maxG) maxG = lightG[nIdx];
            if (lightB[nIdx] > maxB) maxB = lightB[nIdx];
          }
        }
      }

      const wr = maxR * factor, wg = maxG * factor, wb = maxB * factor;
      const idx = y * gridW + x;
      lightR[idx] = wr;
      lightG[idx] = wg;
      lightB[idx] = wb;

      for (let sy = 0; sy < subRes; sy++) {
        for (let sx = 0; sx < subRes; sx++) {
          renderer.setLightTexel(x * subRes + sx, y * subRes + sy, wr, wg, wb);
        }
      }
    }
  }
}
