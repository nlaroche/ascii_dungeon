<script>
  import { onMount, onDestroy } from 'svelte';
  import { Renderer, CELL_FLAGS, LAYERS, LIGHT_SUB } from '../../renderer/Renderer.js';
  import { createVCam, createController, updateController, getScreenOffset } from '../../lib/camera.js';
  import ParamSlider from '../components/ParamSlider.svelte';

  let canvas;
  let renderer = null;
  let error = null;
  let cleanup = null;

  let config = { cellSize: 20, animSpeed: 1.0, visionRadius: 10, showDust: true, torchIntensity: 1.0 };

  // ── Tween State for smooth player movement ──
  const TWEEN_DURATION = 0.25; // seconds per cell transition
  let pathIndex = 0;
  let tweenStart = 0;
  let fromX, fromY, toX, toY;

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  // ── Dungeon Layout ──
  const GRID_W = 80, GRID_H = 45;
  const dungeonMap = [];
  // 0=void, 1=wall, 2=room floor, 3=corridor floor
  for (let y = 0; y < GRID_H; y++) {
    dungeonMap[y] = new Uint8Array(GRID_W);
  }

  const rooms = [
    { x: 2, y: 2, w: 14, h: 10 },     // Room 1 (top-left)
    { x: 28, y: 2, w: 16, h: 10 },    // Room 2 (top-right)
    { x: 2, y: 25, w: 14, h: 12 },    // Room 3 (bottom-left)
    { x: 28, y: 25, w: 16, h: 12 },   // Room 4 (bottom-right)
    { x: 16, y: 13, w: 12, h: 8 },    // Room 5 (center)
    { x: 52, y: 8, w: 18, h: 14 },    // Room 6 (far-right, large hall)
  ];

  // Fill rooms
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1) {
          dungeonMap[y][x] = 1; // wall
        } else {
          dungeonMap[y][x] = 2; // floor
        }
      }
    }
  }

  // Carve corridors (2 cells wide, inclusive of both endpoints)
  function carveCorridor(x1, y1, x2, y2) {
    let cx = x1, cy = y1;
    // Horizontal segment (includes endpoint x2)
    while (true) {
      for (let w = 0; w < 2; w++) {
        if (cy + w < GRID_H && cx >= 0 && cx < GRID_W) { dungeonMap[cy + w][cx] = 3; }
      }
      if (cx === x2) break;
      cx += Math.sign(x2 - x1);
    }
    // Vertical segment (includes endpoint y2)
    while (true) {
      for (let w = 0; w < 2; w++) {
        if (cx + w < GRID_W && cy >= 0 && cy < GRID_H) { dungeonMap[cy][cx + w] = 3; }
      }
      if (cy === y2) break;
      cy += Math.sign(y2 - cy);
    }
  }

  // Room 1 -> Middle
  carveCorridor(13, 6, 16, 6);
  carveCorridor(16, 6, 16, 13);
  // Room 2 -> Middle
  carveCorridor(28, 6, 25, 6);
  carveCorridor(25, 6, 25, 13);
  // Room 3 -> Middle
  carveCorridor(13, 30, 16, 30);
  carveCorridor(16, 20, 16, 30);
  // Room 4 -> Middle
  carveCorridor(28, 30, 25, 30);
  carveCorridor(25, 20, 25, 30);
  // Room 5 (center) already connected via above corridors
  
  // Room 2 -> Room 6 (far right)
  carveCorridor(43, 6, 52, 6);
  carveCorridor(52, 6, 52, 14);
  // Room 4 -> Room 6
  carveCorridor(43, 30, 52, 30);
  carveCorridor(52, 20, 52, 30);

  // Add walls around corridors where missing
  for (let y = 1; y < GRID_H - 1; y++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      if (dungeonMap[y][x] === 3) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < GRID_H && nx >= 0 && nx < GRID_W) {
              if (dungeonMap[ny][nx] === 0) {
                dungeonMap[ny][nx] = 1;
              }
            }
          }
        }
      }
    }
  }

  // ── Torches (placed on walls adjacent to floor) ──
  const torches = [
    { x: 4, y: 2 }, { x: 10, y: 2 },   // Room 1 top wall
    { x: 2, y: 6 }, { x: 13, y: 6 },   // Room 1 sides
    { x: 30, y: 2 }, { x: 38, y: 2 },  // Room 2 top wall
    { x: 28, y: 6 }, { x: 41, y: 6 },  // Room 2 sides
    { x: 4, y: 25 }, { x: 10, y: 25 }, // Room 3 top wall
    { x: 30, y: 25 }, { x: 38, y: 25 },// Room 4 top wall
    { x: 17, y: 13 }, { x: 24, y: 13 },// Middle room
    // Room 6 torches
    { x: 54, y: 8 }, { x: 62, y: 8 }, { x: 68, y: 8 },
    { x: 52, y: 12 }, { x: 68, y: 12 },
    { x: 54, y: 18 }, { x: 62, y: 18 }, { x: 68, y: 18 },
    // Corridors to Room 6
    { x: 48, y: 6 }, { x: 50, y: 30 },
  ];

  // Generate dust motes once
  const dustMotes = [];
  for (let i = 0; i < 20; i++) {
    dustMotes.push({
      x: Math.random() * GRID_W,
      y: Math.random() * GRID_H,
      char: Math.random() > 0.5 ? '.' : ',',
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.15,
      phase: Math.random() * Math.PI * 2
    });
  }

  const enemies = [
    { x: 8, y: 5, char: 'G', fg: '#cc4400' },
    { x: 34, y: 6, char: 'S', fg: '#aaaaaa' },
    { x: 6, y: 30, char: 'S', fg: '#aaaaaa' },
    { x: 35, y: 30, char: 'D', fg: '#ff00ff' },
    { x: 22, y: 16, char: 'R', fg: '#ff4444' },
    // Additional enemies in Room 6
    { x: 58, y: 12, char: 'O', fg: '#00ccff' },
    { x: 65, y: 16, char: 'T', fg: '#ff8800' },
  ];

  const treasures = [
    { x: 10, y: 7 }, { x: 36, y: 8 },
    { x: 8, y: 31 }, { x: 34, y: 31 },
    { x: 60, y: 10 }, { x: 64, y: 18 },
  ];

  // ── Walking path (validated - only floor tiles) ──
  function linePath(points) {
    const result = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      let cx = a.x, cy = a.y;
      while (cx !== b.x || cy !== b.y) {
        result.push({ x: cx, y: cy });
        if (cx !== b.x) cx += dx;
        else cy += dy;
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  const rawPath = [
    // Room 1 interior tour
    { x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 8 }, { x: 5, y: 8 },
    { x: 5, y: 6 },
    // East through R1 + corridor into Room 5 corridor
    { x: 17, y: 6 },
    // South through corridor into Room 5 interior
    { x: 17, y: 14 },
    // Room 5 interior east
    { x: 25, y: 14 },
    // North up corridor to y=6
    { x: 25, y: 6 },
    // East through corridor into Room 2
    { x: 29, y: 6 },
    // Room 2 interior tour
    { x: 35, y: 5 }, { x: 38, y: 5 }, { x: 38, y: 8 }, { x: 30, y: 8 },
    // Exit R2 east through corridor to Room 6
    { x: 42, y: 6 }, { x: 53, y: 6 },
    // South into Room 6
    { x: 53, y: 10 },
    // Room 6 interior tour
    { x: 58, y: 10 }, { x: 62, y: 10 }, { x: 62, y: 16 },
    // Exit R6 south through corridor
    { x: 53, y: 16 }, { x: 53, y: 30 },
    // West through corridor into Room 4
    { x: 29, y: 30 },
    // Room 4 interior tour
    { x: 35, y: 30 }, { x: 38, y: 30 }, { x: 38, y: 32 }, { x: 30, y: 32 },
    // Exit R4 west through corridor, north into Room 5
    { x: 30, y: 30 }, { x: 26, y: 30 },
    { x: 26, y: 19 },
    // Room 5 interior west
    { x: 17, y: 19 },
    // South through corridor toward Room 3
    { x: 17, y: 30 },
    // West into Room 3
    { x: 5, y: 30 },
    // Room 3 interior tour
    { x: 5, y: 32 }, { x: 10, y: 32 }, { x: 10, y: 30 },
    // Return east through corridor, north to Room 1
    { x: 17, y: 30 },
    { x: 17, y: 6 },
    { x: 5, y: 6 }, { x: 5, y: 5 },
  ];

  // Generate full path then filter out any wall/void cells (safety net)
  const path = linePath(rawPath).filter(p => dungeonMap[p.y]?.[p.x] >= 2);

  let explored = new Set();
  // Track when each cell was last in FOV (for fade-out transition)
  const lastVisibleTime = new Float32Array(GRID_W * GRID_H);
  // Track when each cell was FIRST discovered (for fade-in reveal)
  const firstSeenTime = new Float32Array(GRID_W * GRID_H);
  firstSeenTime.fill(-999); // sentinel: never seen
  const FADE_OUT_DURATION = 0.5; // seconds for visible → explored fade
  const FADE_IN_DURATION = 0.25; // seconds for void → visible reveal

  // Snapshot of light values when cell was last visible (so fade has data to fade FROM)
  const cachedLightR = new Float32Array(GRID_W * GRID_H);
  const cachedLightG = new Float32Array(GRID_W * GRID_H);
  const cachedLightB = new Float32Array(GRID_W * GRID_H);
  // Previous FOV set to detect cells leaving vision
  let prevFovVisible = new Set();

  // ── Shadow-casting FOV ──
  function castFOV(cx, cy, radius, isBlocking) {
    const visible = new Set();
    visible.add((cy << 8) | cx);

    for (let octant = 0; octant < 8; octant++) {
      castOctant(cx, cy, radius, octant, 1, 1.0, 0.0, isBlocking, visible);
    }
    return visible;
  }

  function castOctant(cx, cy, radius, octant, row, startSlope, endSlope, isBlocking, visible) {
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
        if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) continue;

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
          castOctant(cx, cy, radius, octant, j + 1, startSlope, leftSlope, isBlocking, visible);
          nextStartSlope = rightSlope;
        }
      }
      if (blocked) break;
    }
  }

  // ── Line of sight for torch lighting ──
  // skipSourceWall: if true, don't block on the first wall cell adjacent to
  // the source (allows wall-mounted torches to emit past their own wall)
  function hasLineOfSight(x0, y0, x1, y1, skipSourceWall = false) {
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
      if (dungeonMap[cy]?.[cx] === 1) {
        // Skip first wall hit when source is wall-mounted
        if (skipSourceWall && !skippedFirst) {
          skippedFirst = true;
          continue;
        }
        return false;
      }
    }
    return true;
  }

  // ── Colored Lighting ──
  const TORCH_COLOR = [0.9, 0.65, 0.35];   // warm but less saturated
  const PLAYER_COLOR = [0.4, 0.7, 0.5];    // softer green

  // Cell-level light arrays for fg tinting + overlay scalar light
  const lightR = new Float32Array(GRID_W * GRID_H);
  const lightG = new Float32Array(GRID_W * GRID_H);
  const lightB = new Float32Array(GRID_W * GRID_H);

  // Pre-computed AO per cell (doesn't change)
  const aoMap = new Float32Array(GRID_W * GRID_H);
  (function precomputeAO() {
    aoMap.fill(1.0);
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (dungeonMap[y][x] < 2) continue;
        let wallCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || ny >= GRID_H || nx < 0 || nx >= GRID_W || dungeonMap[ny][nx] === 1) {
              wallCount++;
            }
          }
        }
        if (wallCount > 0) {
          aoMap[y * GRID_W + x] = 1.0 - wallCount * 0.035;
        }
      }
    }
  })();

  const TORCH_RADIUS = 12;
  const PLAYER_RADIUS = 8;
  const SUB = LIGHT_SUB;
  // Minimum ambient light for all visible floor/corridor cells (prevents pitch-dark areas)
  const MIN_AMBIENT = [0.08, 0.08, 0.14]; // cool blue ambient, always present in visible areas

  function computeLightMap(time, px, py, fovVisible) {
    if (!renderer) return;
    renderer.clearLightMap();

    // Snapshot current light for cells leaving FOV (before zeroing)
    for (const key of prevFovVisible) {
      if (!fovVisible.has(key)) {
        const x = key & 0xFF, y = key >> 8;
        const idx = y * GRID_W + x;
        cachedLightR[idx] = lightR[idx];
        cachedLightG[idx] = lightG[idx];
        cachedLightB[idx] = lightB[idx];
      }
    }
    prevFovVisible = fovVisible;

    // Cell-level: clear for fg tinting
    lightR.fill(0);
    lightG.fill(0);
    lightB.fill(0);

    // Pass 1: Floor cells — compute light at sub-cell resolution
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const tile = dungeonMap[y][x];
        if (tile < 2) continue;
        const key = (y << 8) | x;
        if (!fovVisible.has(key)) continue;

        // Cache LOS results for this cell (expensive, do once per cell)
        const torchLOS = [];
        for (let ti = 0; ti < torches.length; ti++) {
          const t = torches[ti];
          const dx = x - t.x, dy = y - t.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Torches are wall-mounted: skip first wall cell in LOS trace
          const isWallTorch = dungeonMap[t.y]?.[t.x] === 1;
          torchLOS[ti] = dist < TORCH_RADIUS && hasLineOfSight(t.x, t.y, x, y, isWallTorch);
        }

        const ao = aoMap[y * GRID_W + x];
        let cellSumR = 0, cellSumG = 0, cellSumB = 0;

        // Iterate sub-cells within this cell
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            const fx = x + (sx + 0.5) / SUB;
            const fy = y + (sy + 0.5) / SUB;
            let r = 0, g = 0, b = 0;

            // Torch contributions at sub-cell position
            for (let ti = 0; ti < torches.length; ti++) {
              if (!torchLOS[ti]) continue;
              const t = torches[ti];
              const dx = fx - t.x, dy = fy - t.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < TORCH_RADIUS) {
                const flicker = 0.85 + Math.sin(time * 4 + t.x * 3.7 + t.y * 2.3) * 0.15;
                const falloff = Math.max(0, 1.0 - dist / TORCH_RADIUS);
                const intensity = falloff * falloff * flicker * config.torchIntensity;
                r += TORCH_COLOR[0] * intensity;
                g += TORCH_COLOR[1] * intensity;
                b += TORCH_COLOR[2] * intensity;
              }
            }

            // Player glow at sub-cell position
            const pdx = fx - px, pdy = fy - py;
            const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pDist < PLAYER_RADIUS) {
              const pFalloff = Math.max(0, 1.0 - pDist / PLAYER_RADIUS);
              const pIntensity = pFalloff * pFalloff * 0.6;
              r += PLAYER_COLOR[0] * pIntensity;
              g += PLAYER_COLOR[1] * pIntensity;
              b += PLAYER_COLOR[2] * pIntensity;
            }

            // Minimum ambient for visible floor cells (hallway consistency)
            r = Math.max(r, MIN_AMBIENT[0]);
            g = Math.max(g, MIN_AMBIENT[1]);
            b = Math.max(b, MIN_AMBIENT[2]);

            // Apply AO
            r *= ao; g *= ao; b *= ao;

            // Write to light map texture
            const lmX = x * SUB + sx;
            const lmY = y * SUB + sy;
            renderer.setLightTexel(lmX, lmY, r, g, b);

            cellSumR += r; cellSumG += g; cellSumB += b;
          }
        }

        // Cell-level average for fg tinting
        const subCount = SUB * SUB;
        const idx = y * GRID_W + x;
        lightR[idx] = cellSumR / subCount;
        lightG[idx] = cellSumG / subCount;
        lightB[idx] = cellSumB / subCount;
      }
    }

    // Pass 1.5: Light bleed — visible floor cells with no direct light
    // pick up light from adjacent lit floor cells (softens LOS corner clipping)
    const bleedR = new Float32Array(GRID_W * GRID_H);
    const bleedG = new Float32Array(GRID_W * GRID_H);
    const bleedB = new Float32Array(GRID_W * GRID_H);
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (dungeonMap[y][x] < 2) continue;
        const key = (y << 8) | x;
        if (!fovVisible.has(key)) continue;
        const idx = y * GRID_W + x;
        // Already has decent light? Keep it
        if (lightR[idx] + lightG[idx] + lightB[idx] > 0.05) {
          bleedR[idx] = lightR[idx];
          bleedG[idx] = lightG[idx];
          bleedB[idx] = lightB[idx];
          continue;
        }
        // Average neighbors' light (cardinal only, × 0.5 falloff)
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && dungeonMap[ny][nx] >= 2) {
            const nIdx = ny * GRID_W + nx;
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
    // Write bleed results back
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (dungeonMap[y][x] < 2) continue;
        const idx = y * GRID_W + x;
        if (bleedR[idx] > lightR[idx]) {
          lightR[idx] = bleedR[idx];
          lightG[idx] = bleedG[idx];
          lightB[idx] = bleedB[idx];
          // Update sub-cell light map too
          for (let sy = 0; sy < SUB; sy++) {
            for (let sx = 0; sx < SUB; sx++) {
              renderer.setLightTexel(x * SUB + sx, y * SUB + sy, bleedR[idx], bleedG[idx], bleedB[idx]);
            }
          }
        }
      }
    }

    // Pass 2: Walls inherit max of adjacent floor cells' light (× 0.7)
    // Fill all sub-cells of wall uniformly
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (dungeonMap[y][x] !== 1) continue;
        const key = (y << 8) | x;
        if (!fovVisible.has(key)) continue;

        let maxR = 0, maxG = 0, maxB = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < GRID_H && nx >= 0 && nx < GRID_W && dungeonMap[ny][nx] >= 2) {
              const nIdx = ny * GRID_W + nx;
              if (lightR[nIdx] > maxR) maxR = lightR[nIdx];
              if (lightG[nIdx] > maxG) maxG = lightG[nIdx];
              if (lightB[nIdx] > maxB) maxB = lightB[nIdx];
            }
          }
        }

        const wr = maxR * 0.7, wg = maxG * 0.7, wb = maxB * 0.7;
        const idx = y * GRID_W + x;
        lightR[idx] = wr;
        lightG[idx] = wg;
        lightB[idx] = wb;

        // Fill all sub-cells with same value
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            renderer.setLightTexel(x * SUB + sx, y * SUB + sy, wr, wg, wb);
          }
        }
      }
    }
  }

  // Scalar intensity from cell-level light map for overlay objects
  function getLightIntensity(x, y) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return 0;
    const idx = y * GRID_W + x;
    return Math.min(lightR[idx] + lightG[idx] + lightB[idx], 1.0);
  }

  function renderString(text, x, y, fg, bg) {
    for (let i = 0; i < text.length; i++) {
      renderer.setCell(x + i, y, text[i], fg, bg || '#000000', 0, CELL_FLAGS.VISIBLE);
    }
  }

  // Helper to pack r,g,b (0-255) into a hex color string
  function rgbHex(r, g, b) {
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  }

  function fillDemoScene(time, px, py) {
    if (!renderer) return;
    renderer.clearGrid();  // clears all layers

    // Get FOV using shadowcasting - merged from current and next tile for smooth transitions
    const isBlocking = (x, y) => dungeonMap[y]?.[x] === 1;
    const cx = Math.floor(px), cy = Math.floor(py);
    const nx = Math.ceil(px), ny = Math.ceil(py);
    const fov1 = castFOV(cx, cy, config.visionRadius, isBlocking);
    const fov2 = (cx !== nx || cy !== ny) ? castFOV(nx, ny, config.visionRadius, isBlocking) : fov1;
    // Merge: union of both FOV sets
    const fovVisible = new Set([...fov1, ...fov2]);

    // Compute colored light map
    computeLightMap(time, px, py, fovVisible);

    // Base colors for tile types [r, g, b]
    const BASE_WALL_BG  = [42, 42, 58];   // #2a2a3a
    const BASE_WALL_FG  = [85, 85, 102];  // #555566
    const BASE_ROOM_BG  = [26, 26, 46];   // #1a1a2e
    const BASE_CORR_BG  = [20, 20, 40];   // #141428

    // Explored-only target colors [r, g, b]
    const EXPLORED_WALL_FG = [51, 51, 68];   // #333344
    const EXPLORED_WALL_BG = [26, 26, 40];   // #1a1a28
    const EXPLORED_ROOM_BG = [13, 13, 26];   // #0d0d1a
    const EXPLORED_CORR_BG = [10, 10, 20];   // #0a0a14

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const tile = dungeonMap[y][x];
        if (tile === 0) continue; // void cells handled by shader noise

        const key = (y << 8) | x;
        const inVision = fovVisible.has(key);
        const wasExplored = explored.has(key);

        const idx = y * GRID_W + x;

        if (inVision) {
          // Record first discovery time
          if (!wasExplored && firstSeenTime[idx] < 0) {
            firstSeenTime[idx] = time;
          }
          explored.add(key);
          lastVisibleTime[idx] = time;
        }

        if (!inVision && !wasExplored) continue;

        let char = ' ', fg, bg, depth = 0, flags = 0, light = 0;

        // Select base + explored colors by tile type
        let baseFg, expBg, expFg;
        if (tile === 1) {
          char = '#'; baseFg = BASE_WALL_FG; depth = 1.0;
          expBg = EXPLORED_WALL_BG; expFg = EXPLORED_WALL_FG;
        } else if (tile === 2) {
          baseFg = [0, 0, 0]; expBg = EXPLORED_ROOM_BG; expFg = [0, 0, 0];
        } else {
          baseFg = [0, 0, 0]; expBg = EXPLORED_CORR_BG; expFg = [0, 0, 0];
        }

        // Compute visibility: 1.0 = fully in vision, fading 1→0, 0 = explored-only
        let vis;
        if (inVision) {
          // Fade-in: ramp from 0 to 1 over FADE_IN_DURATION on first discovery
          const timeSinceDiscovered = time - firstSeenTime[idx];
          vis = Math.min(1.0, timeSinceDiscovered / FADE_IN_DURATION);
          // Update cached light for when this cell eventually leaves FOV
          cachedLightR[idx] = lightR[idx];
          cachedLightG[idx] = lightG[idx];
          cachedLightB[idx] = lightB[idx];
        } else {
          const timeSinceSeen = time - lastVisibleTime[idx];
          vis = Math.max(0.0, 1.0 - timeSinceSeen / FADE_OUT_DURATION);
        }

        // Use current light for visible cells, cached light for fading cells
        const lr = inVision ? lightR[idx] : cachedLightR[idx];
        const lg = inVision ? lightG[idx] : cachedLightG[idx];
        const lb = inVision ? lightB[idx] : cachedLightB[idx];

        // Always set EXPLORED; set VISIBLE when any visibility remains
        flags = CELL_FLAGS.EXPLORED;
        if (vis > 0.001) flags |= CELL_FLAGS.VISIBLE;

        // light = continuous visibility (shader uses this as the blend factor)
        light = vis;

        // Bg: shader will blend between explored and lit based on vis
        // Send explored bg — shader adds light map on top scaled by vis
        let baseBg;
        if (tile === 1) baseBg = BASE_WALL_BG;
        else if (tile === 2) baseBg = BASE_ROOM_BG;
        else baseBg = BASE_CORR_BG;
        bg = rgbHex(expBg[0], expBg[1], expBg[2]);

        // Fg: walls get tinted by light when visible, lerp to explored fg
        if (tile === 1) {
          const litFgR = Math.min(255, Math.floor(baseFg[0] + lr * 100));
          const litFgG = Math.min(255, Math.floor(baseFg[1] + lg * 70));
          const litFgB = Math.min(255, Math.floor(baseFg[2] + lb * 30));
          const fR = Math.floor(expFg[0] + (litFgR - expFg[0]) * vis);
          const fG = Math.floor(expFg[1] + (litFgG - expFg[1]) * vis);
          const fB = Math.floor(expFg[2] + (litFgB - expFg[2]) * vis);
          fg = rgbHex(Math.max(0, fR), Math.max(0, fG), Math.max(0, fB));
        } else {
          fg = '#000000';
        }

        // Write fading light map sub-cells for cells losing visibility
        if (!inVision && vis > 0.001) {
          for (let sy = 0; sy < SUB; sy++) {
            for (let sx = 0; sx < SUB; sx++) {
              renderer.setLightTexel(x * SUB + sx, y * SUB + sy,
                cachedLightR[idx] * vis, cachedLightG[idx] * vis, cachedLightB[idx] * vis
              );
            }
          }
        }

        renderer.setCell(x, y, char, fg, bg, depth, flags, light, 0, 0, LAYERS.TERRAIN);
      }
    }

    // Torches (OBJECTS layer)
    for (const torch of torches) {
      const key = (torch.y << 8) | torch.x;
      if (!fovVisible.has(key)) continue;
      const flicker = Math.sin(time * 5 + torch.x) * 0.5 + 0.5;
      const g = Math.floor(102 + flicker * 68).toString(16).padStart(2, '0');
      renderer.setCell(torch.x, torch.y, '!', '#ff' + g + '00', '#1a1a2e', 0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, 1.0, 0, 0, LAYERS.OBJECTS);

      // ── Torch particle system: sparks, embers, heat shimmer, smoke ──

      // Core sparks — bright, fast, rise straight up
      for (let p = 0; p < 5; p++) {
        const life = ((time * 1.0 + p * 0.61 + torch.x * 0.17 + torch.y * 0.11) % 2.0) / 2.0;
        const rise = life * 3.0;
        const wobble = Math.sin(time * 2.5 + p * 3.1 + torch.x) * life * 0.4;
        const px = torch.x + wobble;
        const py = torch.y - 0.3 - rise;
        const cx = Math.floor(px), cy = Math.floor(py);
        if (cy >= 0 && cy < GRID_H && cx >= 0 && cx < GRID_W) {
          const fade = (1.0 - life) * (1.0 - life) * config.torchIntensity;
          if (fade > 0.05) {
            const gVal = Math.min(255, Math.floor(200 * fade + 40));
            const sparkChar = fade > 0.6 ? '*' : fade > 0.3 ? '\'' : '.';
            renderer.setCell(cx, cy, sparkChar, rgbHex(255, gVal, Math.floor(fade * 30)), '#000000', life * 0.3, CELL_FLAGS.VISIBLE, fade * 0.8, px - cx, py - cy, LAYERS.EFFECTS);
          }
        }
      }

      // Embers — slower, arc sideways, linger longer
      for (let e = 0; e < 3; e++) {
        const life = ((time * 0.4 + e * 1.1 + torch.x * 0.31 + torch.y * 0.23) % 5.0) / 5.0;
        const rise = life * 4.0;
        // Parabolic arc to one side
        const side = (e % 2 === 0 ? 1 : -1);
        const arc = side * life * (1.0 - life) * 4.0 + Math.sin(time * 0.6 + e * 2.0) * 0.3;
        const px = torch.x + arc;
        const py = torch.y - 0.5 - rise;
        const cx = Math.floor(px), cy = Math.floor(py);
        if (cy >= 0 && cy < GRID_H && cx >= 0 && cx < GRID_W) {
          const fade = Math.pow(1.0 - life, 1.5) * config.torchIntensity;
          if (fade > 0.03) {
            // Embers cool from orange to deep red
            const rVal = Math.min(255, Math.floor(200 + fade * 55));
            const gVal = Math.floor(fade * fade * 120);
            renderer.setCell(cx, cy, ',', rgbHex(rVal, gVal, 0), '#000000', life * 0.2, CELL_FLAGS.VISIBLE, fade * 0.6, px - cx, py - cy, LAYERS.EFFECTS);
          }
        }
      }

      // Heat shimmer — wavy distortion chars near the flame
      for (let h = 0; h < 2; h++) {
        const shimmerY = torch.y - 1 - h;
        if (shimmerY < 0 || shimmerY >= GRID_H) continue;
        const shimmerPhase = Math.sin(time * 3.0 + h * 1.5 + torch.x * 0.7);
        const shimmerX = torch.x + shimmerPhase * 0.3;
        const scx = Math.floor(shimmerX);
        if (scx >= 0 && scx < GRID_W) {
          const shimmerAlpha = (0.15 - h * 0.05) * config.torchIntensity;
          const shimmerChar = shimmerPhase > 0 ? '~' : '-';
          renderer.setCell(scx, shimmerY, shimmerChar, rgbHex(255, 180, 80), '#000000', 0.1, CELL_FLAGS.VISIBLE, shimmerAlpha, shimmerX - scx, 0, LAYERS.EFFECTS);
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
        if (sCellY >= 0 && sCellY < GRID_H && sCellX >= 0 && sCellX < GRID_W) {
          const sFade = Math.pow(1.0 - sLife, 2) * config.torchIntensity;
          if (sFade > 0.06) {
            const grey = Math.floor(50 + sFade * 35);
            renderer.setCell(sCellX, sCellY, '~', rgbHex(grey, grey, Math.floor(grey * 0.9)), '#000000', sLife * 0.25, CELL_FLAGS.VISIBLE, sFade * 0.25, smokeX - sCellX, smokeY - sCellY, LAYERS.EFFECTS);
          }
        }
      }
    }

    // Enemies (OBJECTS layer)
    for (const enemy of enemies) {
      const key = (enemy.y << 8) | enemy.x;
      if (!fovVisible.has(key)) continue;
      const eLight = getLightIntensity(enemy.x, enemy.y) + 0.3;
      renderer.setCell(enemy.x, enemy.y, enemy.char, enemy.fg, '#1a1a2e', 0, CELL_FLAGS.VISIBLE, Math.min(eLight, 1.0), 0, 0, LAYERS.OBJECTS);
    }

    // Treasure (OBJECTS layer)
    for (const treasure of treasures) {
      const key = (treasure.y << 8) | treasure.x;
      if (!fovVisible.has(key)) continue;
      renderer.setCell(treasure.x, treasure.y, '$', '#ffdd00', '#1a1a2e', 0.0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, 1.0, 0, 0, LAYERS.OBJECTS);
    }

    // Dust motes (DECOR layer)
    if (config.showDust) {
      for (const mote of dustMotes) {
        const mx = mote.x + Math.sin(time * 0.5 + mote.phase) * 0.8;
        const my = mote.y + Math.cos(time * 0.3 + mote.phase) * 0.4;
        const rx = Math.round(mx) % GRID_W;
        const ry = Math.round(my) % GRID_H;

        const key = (ry << 8) | rx;
        if (fovVisible.has(key) && dungeonMap[ry]?.[rx] >= 2) {
          renderer.setCell(rx, ry, mote.char, '#888866', '#1a1a2e', 0.0, CELL_FLAGS.VISIBLE, 0.15, 0, 0, LAYERS.DECOR);
        }

        mote.x += mote.speedX * 0.016;
        mote.y += mote.speedY * 0.016;

        if (mote.x < 0) mote.x += GRID_W;
        if (mote.x >= GRID_W) mote.x -= GRID_W;
        if (mote.y < 0) mote.y += GRID_H;
        if (mote.y >= GRID_H) mote.y -= GRID_H;
      }
    }

    // Player (PLAYER layer) with sub-cell offset for smooth movement
    const cellX = Math.floor(px);
    const cellY = Math.floor(py);
    renderer.setCell(cellX, cellY, '@', '#00ff88', '#1a1a2e', 0, CELL_FLAGS.VISIBLE, 1.0, px - cellX, py - cellY, LAYERS.PLAYER);
  }

  onMount(async () => {
    try {
      renderer = new Renderer(canvas, { gridWidth: GRID_W, gridHeight: GRID_H, cellSize: config.cellSize });
      await renderer.init();

      let running = true;
      let time = 0;
      let lastFrame = 0;

      // Initialize tween state
      fromX = toX = path[0].x;
      fromY = toY = path[0].y;
      tweenStart = 0;

      // Camera: follow target object (updated each frame)
      const followTarget = { x: path[0].x, y: path[0].y };
      const vcam = createVCam({
        followTarget,
        damping: 6.0,
        deadZoneX: 1.5,
        deadZoneY: 1.0,
      });
      const camCtrl = createController(vcam);

      const loop = (now) => {
        if (!running) return;

        if (lastFrame === 0) {
          lastFrame = now;
          tweenStart = 0;
          requestAnimationFrame(loop);
          return;
        }

        const dt = Math.min((now - lastFrame) / 1000, 0.1);
        lastFrame = now;
        time += dt * config.animSpeed;

        // Discrete tween movement
        const effectiveDuration = TWEEN_DURATION / config.animSpeed;
        const tweenElapsed = time - tweenStart;
        let tweenT = Math.min(tweenElapsed / effectiveDuration, 1.0);

        if (tweenT >= 1.0) {
          fromX = toX;
          fromY = toY;
          pathIndex = (pathIndex + 1) % path.length;
          toX = path[pathIndex].x;
          toY = path[pathIndex].y;
          tweenStart = time;
          tweenT = 0;
        }

        // Compute easing AFTER potential path advancement
        const easedT = easeOutQuint(tweenT);
        const px = fromX + (toX - fromX) * easedT;
        const py = fromY + (toY - fromY) * easedT;

        // Update camera follow target and tick
        followTarget.x = px;
        followTarget.y = py;
        updateController(camCtrl, dt);

        // Get pixel offsets from camera
        const dpr = window.devicePixelRatio || 1;
        const cssW = renderer.canvas.width / dpr;
        const cssH = renderer.canvas.height / dpr;
        const cam = getScreenOffset(camCtrl, cssW, cssH, config.cellSize, config.cellSize * 1.5);
        renderer.cameraOffsetX = cam.offsetX;
        renderer.cameraOffsetY = cam.offsetY;

        renderer.cellSize = config.cellSize;
        fillDemoScene(time, px, py);
        renderer.render();

        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      cleanup = () => { running = false; };
    } catch (e) {
      error = e.message;
    }
  });

  onDestroy(() => {
    if (cleanup) cleanup();
  });
</script>

<div class="section">
  {#if error}
    <div class="error">WebGPU Error: {error}</div>
  {/if}

  <div class="viewport">
    <canvas bind:this={canvas}></canvas>

    <div class="controls-panel">
      <h3>Graphics Lab</h3>
      <ParamSlider
        label="Cell Size"
        min={10}
        max={28}
        step={1}
        value={config.cellSize}
        on:change={e => { config.cellSize = e.detail; if (renderer) renderer.cellSize = e.detail; }}
      />
      <ParamSlider
        label="Anim Speed"
        min={0}
        max={5}
        step={0.1}
        value={config.animSpeed}
        on:change={e => config.animSpeed = e.detail}
      />
      <ParamSlider
        label="Vision"
        min={4}
        max={20}
        step={1}
        value={config.visionRadius}
        on:change={e => config.visionRadius = e.detail}
      />
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={config.showDust} />
        Dust Motes
      </label>
      <ParamSlider
        label="Torch Intensity"
        min={0.5}
        max={2.0}
        step={0.1}
        value={config.torchIntensity}
        on:change={e => config.torchIntensity = e.detail}
      />
    </div>
  </div>
</div>

<style>
  .section {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .viewport {
    flex: 1;
    position: relative;
    background: #000;
    border: 1px solid #333;
    border-radius: 4px;
    overflow: hidden;
    min-height: 0;
  }
  .viewport canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .controls-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 220px;
    background: rgba(10, 10, 20, 0.85);
    backdrop-filter: blur(6px);
    border: 1px solid #333;
    border-radius: 6px;
    padding: 12px;
    z-index: 10;
  }
  .controls-panel h3 {
    color: #ffaa00;
    margin: 0 0 10px 0;
    font-size: 14px;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #ccc;
    margin: 4px 0;
    cursor: pointer;
  }
  .error {
    color: #ff4444;
    background: #330000;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 8px;
  }
</style>
