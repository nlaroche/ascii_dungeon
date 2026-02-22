/**
 * Shadowcasting Field of View (FOV) — extracted from GraphicsLab.
 * Recursive shadowcasting with 8 octants. Returns a Set of visible cell keys.
 *
 * @example
 * import { castFOV } from './fov.js';
 * const visible = castFOV(10, 10, 8, 80, 45, (x, y) => grid[y][x] === 1);
 * if (visible.has((y << 8) | x)) { ... }
 */

/**
 * Compute FOV from a center point using recursive shadowcasting.
 *
 * @param {number} cx Center X (grid cell)
 * @param {number} cy Center Y (grid cell)
 * @param {number} radius View radius in cells
 * @param {number} gridW Grid width
 * @param {number} gridH Grid height
 * @param {Function} isBlocking (x, y) => boolean — true if cell blocks LOS
 * @returns {Set<number>} Set of visible cell keys encoded as (y << 8) | x
 */
export function castFOV(cx, cy, radius, gridW, gridH, isBlocking) {
  const visible = new Set();
  visible.add((cy << 8) | cx);

  for (let octant = 0; octant < 8; octant++) {
    castOctant(cx, cy, radius, octant, 1, 1.0, 0.0, gridW, gridH, isBlocking, visible);
  }
  return visible;
}

/**
 * Cast a single octant of the FOV (recursive).
 * @private
 */
function castOctant(cx, cy, radius, octant, row, startSlope, endSlope, gridW, gridH, isBlocking, visible) {
  if (startSlope < endSlope) return;

  let nextStartSlope = startSlope;

  for (let j = row; j <= radius; j++) {
    let blocked = false;

    for (let dx = -j; dx <= 0; dx++) {
      const dy = -j;
      const leftSlope = (dx - 0.5) / (dy + 0.5);
      const rightSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rightSlope) continue;
      if (endSlope > leftSlope) break;

      // Transform by octant
      let tx, ty;
      switch (octant) {
        case 0: tx = cx + dx; ty = cy + dy; break;
        case 1: tx = cx + dy; ty = cy + dx; break;
        case 2: tx = cx - dy; ty = cy + dx; break;
        case 3: tx = cx - dx; ty = cy + dy; break;
        case 4: tx = cx - dx; ty = cy - dy; break;
        case 5: tx = cx - dy; ty = cy - dx; break;
        case 6: tx = cx + dy; ty = cy - dx; break;
        case 7: tx = cx + dx; ty = cy - dy; break;
      }

      const distSq = (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy);
      if (distSq > radius * radius) continue;
      if (tx < 0 || tx >= gridW || ty < 0 || ty >= gridH) continue;

      visible.add((ty << 8) | tx);

      if (blocked) {
        if (isBlocking(tx, ty)) {
          nextStartSlope = rightSlope;
        } else {
          blocked = false;
          startSlope = nextStartSlope;
        }
      } else if (isBlocking(tx, ty) && j < radius) {
        blocked = true;
        castOctant(cx, cy, radius, octant, j + 1, startSlope, leftSlope, gridW, gridH, isBlocking, visible);
        nextStartSlope = rightSlope;
      }
    }
    if (blocked) break;
  }
}

/**
 * Bresenham line-of-sight check between two points.
 *
 * @param {number} x0 Start X
 * @param {number} y0 Start Y
 * @param {number} x1 End X
 * @param {number} y1 End Y
 * @param {Function} isBlocking (x, y) => boolean
 * @param {boolean} [skipSourceWall=false] Skip first blocking cell (for wall-mounted sources)
 * @returns {boolean} True if line of sight exists
 */
export function hasLineOfSight(x0, y0, x1, y1, isBlocking, skipSourceWall = false) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;
  let skippedFirst = false;

  while (cx !== x1 || cy !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
    if (cx === x1 && cy === y1) break;
    if (isBlocking(cx, cy)) {
      if (skipSourceWall && !skippedFirst) {
        skippedFirst = true;
        continue;
      }
      return false;
    }
  }
  return true;
}
