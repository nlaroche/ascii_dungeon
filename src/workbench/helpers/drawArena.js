// ── Full Scene Renderer ──
// One-stop scene rendering: grid cells, lighting, AO, torch effects, wall tinting,
// torch particles, dust motes, FOV fade transitions.
//
// Arena tabs: drawArena(r, W, H, { time }) — auto arena, auto torches, auto AO.
// Dungeon tabs: drawArena(r, W, H, { tileAt, torches, fovVisible, ... }) — full control.

import { CELL_FLAGS, LAYERS, LIGHT_SUB } from '../../renderer/Renderer.js';
import {
  TORCH_COLOR, PLAYER_COLOR, MIN_AMBIENT, TORCH_RADIUS, PLAYER_RADIUS,
  rgbHex, torchFlicker, computeRadialLight, applyWallLightInheritance,
} from '../../lib/lighting.js';
import { hasLineOfSight } from '../../lib/fov.js';
import { COLORS } from '../../lib/palette.js';

const SUB = LIGHT_SUB;

// Color helpers
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const halfRgb = c => c.map(v => Math.floor(v * 0.5));

// Base tile colors from palette
const BASE_WALL_FG = hexRgb(COLORS.wallFg);
const BASE_ROOM_BG = hexRgb(COLORS.floorBg);
const EXPLORED_WALL_FG = halfRgb(hexRgb(COLORS.wallFg));
const EXPLORED_WALL_BG = halfRgb(hexRgb(COLORS.wallBg));
const EXPLORED_ROOM_BG = halfRgb(hexRgb(COLORS.floorBg));

const FADE_OUT_DURATION = 0.5;
const FADE_IN_DURATION = 0.25;

/**
 * Draw a fully lit, particle-adorned scene.
 *
 * @param {object} renderer Renderer instance
 * @param {number} gridW Grid width in cells
 * @param {number} gridH Grid height in cells
 * @param {object} [opts] Options
 * @param {string} [opts.floorChar=' '] Character for floor cells
 * @param {number} [opts.time=0] Scene time in seconds
 * @param {Function|null} [opts.tileAt] (x,y) => 0|1|2|3 for dungeon maps; null = arena mode
 * @param {Array|null} [opts.torches] Custom torch positions [{x,y}]; null = auto-place on walls
 * @param {{x:number, y:number}|null} [opts.playerLight] Player glow position
 * @param {Set|null} [opts.fovVisible] Set of (y<<8|x) for visible cells; null = everything visible
 * @param {Float32Array|null} [opts.aoMap] Pre-computed AO; null = no AO
 * @param {number} [opts.torchIntensity=1.0] Torch brightness multiplier
 * @param {boolean} [opts.showTorchParticles=true] Show torch particle effects
 * @param {boolean} [opts.showDust=false] Show dust motes
 * @param {Array|null} [opts.dustMotes] Dust mote array (mutated for animation)
 * @param {Set|null} [opts.explored] Set for FOV explored state (dungeon mode)
 * @param {object|null} [opts.fadeState] Fade state from createFadeState() for FOV transitions
 * @param {number[]|null} [opts.ambient] [r,g,b] minimum ambient light; null = default per mode
 * @returns {{ lightR: Float32Array, lightG: Float32Array, lightB: Float32Array }}
 */
export function drawArena(renderer, gridW, gridH, opts = {}) {
  const {
    floorChar = ' ',
    time = 0,
    tileAt = null,
    torches: customTorches = null,
    playerLight = null,
    fovVisible = null,
    aoMap = null,
    torchIntensity = 1.0,
    showTorchParticles = true,
    showDust = false,
    dustMotes = null,
    explored = null,
    fadeState = null,
    ambient = null,
  } = opts;

  const isDungeonMode = tileAt !== null;
  const allVisible = fovVisible === null;

  // Arena helpers
  const isArenaWall = (x, y) => x === 0 || x === gridW - 1 || y === 0 || y === gridH - 1;
  const isArenaFloor = (x, y) => x > 0 && x < gridW - 1 && y > 0 && y < gridH - 1;

  // Tile type accessors (work for both arena and dungeon modes)
  const getTile = isDungeonMode
    ? (x, y) => tileAt(x, y)
    : (x, y) => isArenaWall(x, y) ? 1 : 2;

  const isWall = (x, y) => {
    if (x < 0 || x >= gridW || y < 0 || y >= gridH) return true;
    return getTile(x, y) === 1;
  };
  const isFloor = (x, y) => {
    if (x < 0 || x >= gridW || y < 0 || y >= gridH) return false;
    return getTile(x, y) >= 2;
  };

  // ── Torches ──
  const torchPositions = customTorches || generateAutoTorches(gridW, gridH);

  // ── Lighting ──
  let lightR, lightG, lightB;

  if (isDungeonMode && fovVisible) {
    // Full dungeon lighting with LOS, sub-cell resolution, and light bleed
    const result = computeDungeonLight(
      renderer, gridW, gridH, torchPositions, playerLight,
      fovVisible, aoMap, torchIntensity, time, isWall, isFloor, ambient
    );
    lightR = result.lightR;
    lightG = result.lightG;
    lightB = result.lightB;
  } else {
    // Arena lighting: use computeRadialLight from lib
    const torchSources = torchPositions.map(t => ({
      x: t.x, y: t.y,
      color: TORCH_COLOR,
      radius: 10,
      intensity: torchFlicker(time, t.x, t.y) * 0.8 * torchIntensity,
    }));
    if (playerLight) {
      torchSources.push({
        x: playerLight.x, y: playerLight.y,
        color: PLAYER_COLOR,
        radius: PLAYER_RADIUS,
        intensity: 0.6,
      });
    }
    const arenaAmbient = ambient || [0.18, 0.15, 0.12];
    const result = computeRadialLight(renderer, torchSources, gridW, gridH, SUB, {
      ambient: arenaAmbient,
      isFloor,
      aoMap,
      visibleSet: fovVisible,
    });
    lightR = result.lightR;
    lightG = result.lightG;
    lightB = result.lightB;
    applyWallLightInheritance(renderer, lightR, lightG, lightB, gridW, gridH, SUB, isWall, isFloor, fovVisible);
  }

  // ── Fade state: snapshot leaving FOV ──
  if (fadeState && fovVisible) {
    for (const key of fadeState.prevFovVisible) {
      if (!fovVisible.has(key)) {
        const x = key & 0xFF, y = key >> 8;
        const idx = y * gridW + x;
        fadeState.cachedLightR[idx] = lightR[idx];
        fadeState.cachedLightG[idx] = lightG[idx];
        fadeState.cachedLightB[idx] = lightB[idx];
      }
    }
    fadeState.prevFovVisible = fovVisible;
  }

  // ── Draw grid cells ──
  const flags_base = CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED;

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const tile = getTile(x, y);
      if (tile === 0) continue; // void

      const key = (y << 8) | x;
      const inVision = allVisible || fovVisible.has(key);
      const wasExplored = explored ? explored.has(key) : false;
      const idx = y * gridW + x;

      // Dungeon mode with FOV
      if (!allVisible) {
        if (fadeState && inVision) {
          if (!wasExplored && fadeState.firstSeenTime[idx] < 0) {
            fadeState.firstSeenTime[idx] = time;
          }
          explored.add(key);
          fadeState.lastVisibleTime[idx] = time;
        } else if (explored && inVision) {
          explored.add(key);
        }

        if (!inVision && !wasExplored) continue;
      }

      // Determine visibility factor for fading
      let vis = 1.0;
      if (!allVisible && fadeState) {
        if (inVision) {
          const timeSinceDiscovered = time - fadeState.firstSeenTime[idx];
          vis = Math.min(1.0, timeSinceDiscovered / FADE_IN_DURATION);
          fadeState.cachedLightR[idx] = lightR[idx];
          fadeState.cachedLightG[idx] = lightG[idx];
          fadeState.cachedLightB[idx] = lightB[idx];
        } else {
          const timeSinceSeen = time - fadeState.lastVisibleTime[idx];
          vis = Math.max(0.0, 1.0 - timeSinceSeen / FADE_OUT_DURATION);
        }
      } else if (!allVisible && !inVision) {
        vis = 0.0;
      }

      // Cell rendering
      let char = floorChar, fg, bg, depth = 0, flags = 0, light = 0;

      if (isDungeonMode && !allVisible) {
        // Dungeon mode: full FOV rendering with explored/visible states
        let baseFg, expBg, expFg;
        if (tile === 1) {
          char = '#'; baseFg = BASE_WALL_FG; depth = 1.0;
          expBg = EXPLORED_WALL_BG; expFg = EXPLORED_WALL_FG;
        } else {
          baseFg = hexRgb(COLORS.black);
          expBg = EXPLORED_ROOM_BG; expFg = hexRgb(COLORS.black);
        }

        flags = CELL_FLAGS.EXPLORED;
        if (vis > 0.001) flags |= CELL_FLAGS.VISIBLE;
        light = vis;
        bg = rgbHex(expBg[0], expBg[1], expBg[2]);

        // Fg: walls get tinted by light
        if (tile === 1) {
          const lr = inVision ? lightR[idx] : fadeState ? fadeState.cachedLightR[idx] : 0;
          const lg = inVision ? lightG[idx] : fadeState ? fadeState.cachedLightG[idx] : 0;
          const lb = inVision ? lightB[idx] : fadeState ? fadeState.cachedLightB[idx] : 0;
          const litFgR = Math.min(255, Math.floor(baseFg[0] + lr * 50));
          const litFgG = Math.min(255, Math.floor(baseFg[1] + lg * 35));
          const litFgB = Math.min(255, Math.floor(baseFg[2] + lb * 15));
          const fR = Math.floor(expFg[0] + (litFgR - expFg[0]) * vis);
          const fG = Math.floor(expFg[1] + (litFgG - expFg[1]) * vis);
          const fB = Math.floor(expFg[2] + (litFgB - expFg[2]) * vis);
          fg = rgbHex(Math.max(0, fR), Math.max(0, fG), Math.max(0, fB));
        } else {
          fg = COLORS.black;
        }

        // Fading light map for cells losing visibility
        if (!inVision && vis > 0.001 && fadeState) {
          for (let sy = 0; sy < SUB; sy++) {
            for (let sx = 0; sx < SUB; sx++) {
              renderer.setLightTexel(x * SUB + sx, y * SUB + sy,
                fadeState.cachedLightR[idx] * vis,
                fadeState.cachedLightG[idx] * vis,
                fadeState.cachedLightB[idx] * vis
              );
            }
          }
        }
      } else {
        // Arena mode: simple wall/floor, fully visible
        const tileIsWall = tile === 1;
        char = tileIsWall ? '#' : floorChar;
        fg = tileIsWall ? COLORS.wallFg : COLORS.floorFg;
        bg = tileIsWall ? COLORS.wallBg : COLORS.floorBg;
        depth = tileIsWall ? 1.0 : 0.0;
        flags = flags_base;
        light = 1.0;
      }

      renderer.setCell(x, y, char, fg, bg, depth, flags, light, 0, 0, LAYERS.TERRAIN);
    }
  }

  // ── Torch glyphs on walls ──
  for (const torch of torchPositions) {
    if (!allVisible) {
      const key = (torch.y << 8) | torch.x;
      if (!fovVisible.has(key)) continue;
    }
    const tTile = getTile(torch.x, torch.y);
    if (tTile === 1) {
      // Wall torch
      const flicker = Math.sin(time * 5 + torch.x) * 0.5 + 0.5;
      const g = Math.floor(102 + flicker * 68).toString(16).padStart(2, '0');
      renderer.setCell(
        torch.x, torch.y, '!', '#ff' + g + '00',
        isDungeonMode ? COLORS.bgMuted : COLORS.wallBg,
        0, CELL_FLAGS.VISIBLE | (isDungeonMode ? CELL_FLAGS.HIGHLIGHTED : CELL_FLAGS.EXPLORED),
        1.0, 0, 0, isDungeonMode ? LAYERS.OBJECTS : LAYERS.DECOR
      );
    }
  }

  // ── Torch particles ──
  if (showTorchParticles) {
    for (const torch of torchPositions) {
      if (!allVisible) {
        const key = (torch.y << 8) | torch.x;
        if (!fovVisible.has(key)) continue;
      }
      drawTorchParticles(renderer, torch, time, gridW, gridH, torchIntensity);
    }
  }

  // ── Dust motes ──
  if (showDust && dustMotes) {
    for (const mote of dustMotes) {
      const mx = mote.x + Math.sin(time * 0.5 + mote.phase) * 0.8;
      const my = mote.y + Math.cos(time * 0.3 + mote.phase) * 0.4;
      const rx = Math.round(mx) % gridW;
      const ry = Math.round(my) % gridH;

      const visible = allVisible || (fovVisible && fovVisible.has((ry << 8) | rx));
      if (visible && isFloor(rx, ry)) {
        renderer.setCell(rx, ry, mote.char, COLORS.smoke, COLORS.bgMuted, 0.0, CELL_FLAGS.VISIBLE, 0.15, 0, 0, LAYERS.DECOR);
      }

      mote.x += mote.speedX * 0.016;
      mote.y += mote.speedY * 0.016;
      if (mote.x < 0) mote.x += gridW;
      if (mote.x >= gridW) mote.x -= gridW;
      if (mote.y < 0) mote.y += gridH;
      if (mote.y >= gridH) mote.y -= gridH;
    }
  }

  return { lightR, lightG, lightB };
}

// ── Auto torch placement for arena mode ──
function generateAutoTorches(gridW, gridH) {
  return [
    { x: 5, y: 0 }, { x: gridW - 6, y: 0 },
    { x: 5, y: gridH - 1 }, { x: gridW - 6, y: gridH - 1 },
    { x: 0, y: Math.floor(gridH / 2) }, { x: gridW - 1, y: Math.floor(gridH / 2) },
  ];
}

// ── Full dungeon lighting with LOS, bleed, and wall inheritance ──
function computeDungeonLight(renderer, gridW, gridH, torchPositions, playerLight, fovVisible, aoMap, torchIntensity, time, isWall, isFloor, ambient) {
  renderer.clearLightMap();

  const lightR = new Float32Array(gridW * gridH);
  const lightG = new Float32Array(gridW * gridH);
  const lightB = new Float32Array(gridW * gridH);

  // Pass 1: Floor cells — sub-cell lighting
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!isFloor(x, y)) continue;
      const key = (y << 8) | x;
      if (!fovVisible.has(key)) continue;

      // Cache LOS per torch
      const torchLOS = [];
      for (let ti = 0; ti < torchPositions.length; ti++) {
        const t = torchPositions[ti];
        const dx = x - t.x, dy = y - t.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const wallMounted = isWall(t.x, t.y);
        torchLOS[ti] = dist < TORCH_RADIUS && hasLineOfSight(t.x, t.y, x, y, (bx, by) => isWall(bx, by), wallMounted);
      }

      const ao = aoMap ? aoMap[y * gridW + x] : 1.0;
      let cellSumR = 0, cellSumG = 0, cellSumB = 0;

      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const fx = x + (sx + 0.5) / SUB;
          const fy = y + (sy + 0.5) / SUB;
          let r = 0, g = 0, b = 0;

          for (let ti = 0; ti < torchPositions.length; ti++) {
            if (!torchLOS[ti]) continue;
            const t = torchPositions[ti];
            const dx = fx - t.x, dy = fy - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < TORCH_RADIUS) {
              const flicker = torchFlicker(time, t.x, t.y);
              const falloff = Math.max(0, 1.0 - dist / TORCH_RADIUS);
              const intensity = falloff * falloff * flicker * torchIntensity;
              r += TORCH_COLOR[0] * intensity;
              g += TORCH_COLOR[1] * intensity;
              b += TORCH_COLOR[2] * intensity;
            }
          }

          // Player glow
          if (playerLight) {
            const pdx = fx - playerLight.x, pdy = fy - playerLight.y;
            const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pDist < PLAYER_RADIUS) {
              const pFalloff = Math.max(0, 1.0 - pDist / PLAYER_RADIUS);
              const pIntensity = pFalloff * pFalloff * 0.6;
              r += PLAYER_COLOR[0] * pIntensity;
              g += PLAYER_COLOR[1] * pIntensity;
              b += PLAYER_COLOR[2] * pIntensity;
            }
          }

          const dungeonAmbient = ambient || MIN_AMBIENT;
          r = Math.max(r, dungeonAmbient[0]);
          g = Math.max(g, dungeonAmbient[1]);
          b = Math.max(b, dungeonAmbient[2]);
          r *= ao; g *= ao; b *= ao;

          renderer.setLightTexel(x * SUB + sx, y * SUB + sy, r, g, b);
          cellSumR += r; cellSumG += g; cellSumB += b;
        }
      }

      const subCount = SUB * SUB;
      const idx = y * gridW + x;
      lightR[idx] = cellSumR / subCount;
      lightG[idx] = cellSumG / subCount;
      lightB[idx] = cellSumB / subCount;
    }
  }

  // Pass 1.5: Light bleed — visible floor cells with no direct light
  const bleedR = new Float32Array(gridW * gridH);
  const bleedG = new Float32Array(gridW * gridH);
  const bleedB = new Float32Array(gridW * gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!isFloor(x, y)) continue;
      const key = (y << 8) | x;
      if (!fovVisible.has(key)) continue;
      const idx = y * gridW + x;
      if (lightR[idx] + lightG[idx] + lightB[idx] > 0.05) {
        bleedR[idx] = lightR[idx];
        bleedG[idx] = lightG[idx];
        bleedB[idx] = lightB[idx];
        continue;
      }
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && isFloor(nx, ny)) {
          const nIdx = ny * gridW + nx;
          sumR += lightR[nIdx]; sumG += lightG[nIdx]; sumB += lightB[nIdx];
          count++;
        }
      }
      if (count > 0) {
        bleedR[idx] = (sumR / count) * 0.5;
        bleedG[idx] = (sumG / count) * 0.5;
        bleedB[idx] = (sumB / count) * 0.5;
      }
    }
  }
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!isFloor(x, y)) continue;
      const idx = y * gridW + x;
      if (bleedR[idx] > lightR[idx]) {
        lightR[idx] = bleedR[idx];
        lightG[idx] = bleedG[idx];
        lightB[idx] = bleedB[idx];
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            renderer.setLightTexel(x * SUB + sx, y * SUB + sy, bleedR[idx], bleedG[idx], bleedB[idx]);
          }
        }
      }
    }
  }

  // Pass 2: Walls inherit max of adjacent floor light
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!isWall(x, y)) continue;
      const key = (y << 8) | x;
      if (!fovVisible.has(key)) continue;

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

      const wr = maxR * 0.7, wg = maxG * 0.7, wb = maxB * 0.7;
      const idx = y * gridW + x;
      lightR[idx] = wr;
      lightG[idx] = wg;
      lightB[idx] = wb;

      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          renderer.setLightTexel(x * SUB + sx, y * SUB + sy, wr, wg, wb);
        }
      }
    }
  }

  return { lightR, lightG, lightB };
}

// ── Torch particle effects: sparks, embers, heat shimmer, smoke ──
function drawTorchParticles(renderer, torch, time, gridW, gridH, torchIntensity) {
  // Core sparks — bright, fast, rise straight up
  for (let p = 0; p < 5; p++) {
    const life = ((time * 1.0 + p * 0.61 + torch.x * 0.17 + torch.y * 0.11) % 2.0) / 2.0;
    const rise = life * 3.0;
    const wobble = Math.sin(time * 2.5 + p * 3.1 + torch.x) * life * 0.4;
    const px = torch.x + wobble;
    const py = torch.y - 0.3 - rise;
    const cx = Math.floor(px), cy = Math.floor(py);
    if (cy >= 0 && cy < gridH && cx >= 0 && cx < gridW) {
      const fade = (1.0 - life) * (1.0 - life) * torchIntensity;
      if (fade > 0.05) {
        const gVal = Math.min(255, Math.floor(200 * fade + 40));
        const sparkChar = fade > 0.6 ? '*' : fade > 0.3 ? '\'' : '.';
        renderer.setCell(cx, cy, sparkChar, rgbHex(255, gVal, Math.floor(fade * 30)), COLORS.black, life * 0.3, CELL_FLAGS.VISIBLE, fade * 0.8, px - cx, py - cy, LAYERS.EFFECTS);
      }
    }
  }

  // Embers — slower, arc sideways, linger longer
  for (let e = 0; e < 3; e++) {
    const life = ((time * 0.4 + e * 1.1 + torch.x * 0.31 + torch.y * 0.23) % 5.0) / 5.0;
    const rise = life * 4.0;
    const side = (e % 2 === 0 ? 1 : -1);
    const arc = side * life * (1.0 - life) * 4.0 + Math.sin(time * 0.6 + e * 2.0) * 0.3;
    const px = torch.x + arc;
    const py = torch.y - 0.5 - rise;
    const cx = Math.floor(px), cy = Math.floor(py);
    if (cy >= 0 && cy < gridH && cx >= 0 && cx < gridW) {
      const fade = Math.pow(1.0 - life, 1.5) * torchIntensity;
      if (fade > 0.03) {
        const rVal = Math.min(255, Math.floor(200 + fade * 55));
        const gVal = Math.floor(fade * fade * 120);
        renderer.setCell(cx, cy, ',', rgbHex(rVal, gVal, 0), COLORS.black, life * 0.2, CELL_FLAGS.VISIBLE, fade * 0.6, px - cx, py - cy, LAYERS.EFFECTS);
      }
    }
  }

  // Heat shimmer — wavy distortion chars near the flame
  for (let h = 0; h < 2; h++) {
    const shimmerY = torch.y - 1 - h;
    if (shimmerY < 0 || shimmerY >= gridH) continue;
    const shimmerPhase = Math.sin(time * 3.0 + h * 1.5 + torch.x * 0.7);
    const shimmerX = torch.x + shimmerPhase * 0.3;
    const scx = Math.floor(shimmerX);
    if (scx >= 0 && scx < gridW) {
      const shimmerAlpha = (0.15 - h * 0.05) * torchIntensity;
      const shimmerChar = shimmerPhase > 0 ? '~' : '-';
      renderer.setCell(scx, shimmerY, shimmerChar, rgbHex(255, 180, 80), COLORS.black, 0.1, CELL_FLAGS.VISIBLE, shimmerAlpha, shimmerX - scx, 0, LAYERS.EFFECTS);
    }
  }

  // Smoke wisps — slow, wide spread, fade to grey
  for (let s = 0; s < 2; s++) {
    const sLife = ((time * 0.35 + s * 1.7 + torch.x * 0.3) % 5.0) / 5.0;
    const sRise = 2.5 + sLife * 5.0;
    const sSpread = sLife * 2.0;
    const sWobble = Math.sin(time * 0.5 + s * 4.0 + torch.x) * sSpread;
    const smokeX = torch.x + sWobble;
    const smokeY = torch.y - sRise;
    const sCellX = Math.floor(smokeX), sCellY = Math.floor(smokeY);
    if (sCellY >= 0 && sCellY < gridH && sCellX >= 0 && sCellX < gridW) {
      const sFade = Math.pow(1.0 - sLife, 2) * torchIntensity;
      if (sFade > 0.06) {
        const grey = Math.floor(50 + sFade * 35);
        renderer.setCell(sCellX, sCellY, '~', rgbHex(grey, grey, Math.floor(grey * 0.9)), COLORS.black, sLife * 0.25, CELL_FLAGS.VISIBLE, sFade * 0.25, smokeX - sCellX, smokeY - sCellY, LAYERS.EFFECTS);
      }
    }
  }
}
