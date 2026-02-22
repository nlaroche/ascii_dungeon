// ── FOV Fade State + AO Computation ──
// Reusable state management for FOV exploration transitions and ambient occlusion.

/**
 * Create fade state arrays for FOV exploration transitions.
 * Tracks when cells were first seen, last visible, and cached light values.
 *
 * @param {number} gridW Grid width
 * @param {number} gridH Grid height
 * @returns {object} Fade state with explored set and typed arrays
 */
export function createFadeState(gridW, gridH) {
  const size = gridW * gridH;
  const firstSeenTime = new Float32Array(size);
  firstSeenTime.fill(-999); // sentinel: never seen
  return {
    explored: new Set(),
    firstSeenTime,
    lastVisibleTime: new Float32Array(size),
    cachedLightR: new Float32Array(size),
    cachedLightG: new Float32Array(size),
    cachedLightB: new Float32Array(size),
    prevFovVisible: new Set(),
  };
}

/**
 * Pre-compute ambient occlusion map for a grid.
 * Floor cells near walls get darkened based on adjacent wall count.
 *
 * @param {number} gridW Grid width
 * @param {number} gridH Grid height
 * @param {Function} isWall (x, y) => boolean — true if cell is a wall
 * @param {Function} isFloor (x, y) => boolean — true if cell is a floor
 * @returns {Float32Array} AO multiplier per cell (1.0 = no occlusion)
 */
export function computeAO(gridW, gridH, isWall, isFloor) {
  const aoMap = new Float32Array(gridW * gridH);
  aoMap.fill(1.0);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!isFloor(x, y)) continue;
      let wallCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy, nx = x + dx;
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH || isWall(nx, ny)) {
            wallCount++;
          }
        }
      }
      if (wallCount > 0) {
        aoMap[y * gridW + x] = 1.0 - wallCount * 0.035;
      }
    }
  }
  return aoMap;
}
