<script>
  import { onMount, onDestroy } from 'svelte';
  import { Renderer, CELL_FLAGS } from '../../renderer/Renderer.js';
  import ParamSlider from '../components/ParamSlider.svelte';

  let canvas;
  let renderer = null;
  let error = null;
  let cleanup = null;

  let config = { cellSize: 20, animSpeed: 1.0, visionRadius: 10 };

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

  // Carve corridors (2 cells wide)
  function carveCorridor(x1, y1, x2, y2) {
    let cx = x1, cy = y1;
    while (cx !== x2) {
      for (let w = 0; w < 2; w++) {
        if (cy + w < GRID_H && cx >= 0 && cx < GRID_W) { dungeonMap[cy + w][cx] = 3; }
      }
      cx += Math.sign(x2 - x1);
    }
    while (cy !== y2) {
      for (let w = 0; w < 2; w++) {
        if (cx + w < GRID_W && cy >= 0 && cy < GRID_H) { dungeonMap[cy][cx + w] = 3; }
      }
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
    // Room 1 interior
    { x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 8 }, { x: 5, y: 8 },
    // Exit Room 1 through corridor to middle
    { x: 5, y: 6 }, { x: 13, y: 6 }, { x: 16, y: 6 }, { x: 16, y: 12 },
    // Middle room
    { x: 18, y: 14 }, { x: 23, y: 14 },
    // Corridor to Room 2
    { x: 25, y: 14 }, { x: 25, y: 6 }, { x: 30, y: 6 },
    // Room 2 interior
    { x: 35, y: 5 }, { x: 38, y: 5 }, { x: 38, y: 8 }, { x: 30, y: 8 },
    // Corridor to Room 6
    { x: 43, y: 6 }, { x: 52, y: 6 }, { x: 52, y: 10 },
    // Room 6 interior part 1
    { x: 58, y: 10 }, { x: 62, y: 10 }, { x: 62, y: 16 },
    // Exit Room 6 to Room 4
    { x: 52, y: 16 }, { x: 52, y: 20 },
    // Corridor to Room 4
    { x: 52, y: 30 }, { x: 43, y: 30 },
    // Room 4 interior
    { x: 35, y: 30 }, { x: 38, y: 30 }, { x: 38, y: 32 }, { x: 30, y: 32 },
    // Back to middle via corridor
    { x: 25, y: 30 }, { x: 25, y: 20 },
    // Corridor to Room 3
    { x: 25, y: 30 }, { x: 16, y: 30 },
    // Room 3 interior
    { x: 5, y: 30 }, { x: 10, y: 30 }, { x: 10, y: 32 }, { x: 5, y: 32 },
    // Return to Room 1
    { x: 5, y: 30 }, { x: 16, y: 30 }, { x: 16, y: 20 }, { x: 16, y: 14 },
    { x: 16, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 5 },
  ];

  // Validate path - only keep points on floor (2 or 3)
  const path = linePath(rawPath.filter(p => dungeonMap[p.y]?.[p.x] >= 2));

  let explored = new Set();

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
  function hasLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;
    while (cx !== x1 || cy !== y1) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
      if (cx === x1 && cy === y1) break;
      if (dungeonMap[cy]?.[cx] === 1) return false;
    }
    return true;
  }

  // ── Lighting: compute light at (x,y) from all torches ──
  function computeLight(x, y, time) {
    let totalLight = 0;
    for (const torch of torches) {
      const dx = x - torch.x;
      const dy = y - torch.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10 && hasLineOfSight(torch.x, torch.y, x, y)) {
        const flicker = 0.8 + Math.sin(time * 4 + torch.x * 3.7 + torch.y * 2.3) * 0.2;
        const intensity = Math.max(0, 1.0 - dist / 10) * flicker;
        totalLight += intensity;
      }
    }
    return Math.min(totalLight, 1.0);
  }

  function renderString(text, x, y, fg, bg) {
    for (let i = 0; i < text.length; i++) {
      renderer.setCell(x + i, y, text[i], fg, bg || '#000000', 0, CELL_FLAGS.VISIBLE);
    }
  }

  function fillDemoScene(time, px, py) {
    if (!renderer) return;
    renderer.clearGrid();

    // Get FOV using shadowcasting - merged from current and next tile for smooth transitions
    const isBlocking = (x, y) => dungeonMap[y]?.[x] === 1;
    const cx = Math.floor(px), cy = Math.floor(py);
    const nx = Math.ceil(px), ny = Math.ceil(py);
    const fov1 = castFOV(cx, cy, config.visionRadius, isBlocking);
    const fov2 = (cx !== nx || cy !== ny) ? castFOV(nx, ny, config.visionRadius, isBlocking) : fov1;
    // Merge: union of both FOV sets
    const fovVisible = new Set([...fov1, ...fov2]);

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const tile = dungeonMap[y][x];
        if (tile === 0) continue; // void = black (already cleared)

        const key = (y << 8) | x;
        const inVision = fovVisible.has(key);
        const wasExplored = explored.has(key);

        if (inVision) explored.add(key);

        let char = ' ', fg = '#000000', bg = '#0a0a14', depth = 0, flags = 0, light = 0;

        if (tile === 1) { // wall
          char = '#'; fg = '#555566'; bg = '#2a2a3a'; depth = 1.0;
        } else if (tile === 2) { // room floor
          bg = '#1a1a2e';
        } else if (tile === 3) { // corridor
          bg = '#141428';
        }

        if (inVision) {
          flags = CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED;
          light = computeLight(x, y, time);
          // Player proximity adds some ambient light
          const dx = x - px, dy = y - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proxLight = Math.max(0, 1.0 - dist / config.visionRadius) * 0.5;
          light = Math.min(light + proxLight, 1.0);
        } else if (wasExplored) {
          flags = CELL_FLAGS.EXPLORED;
          light = 0.0;
          // Dim explored areas - make them darker than before
          if (tile === 1) {
            fg = '#333344';
            bg = '#1a1a28';
          } else if (tile === 2) {
            bg = '#0d0d1a';
          } else if (tile === 3) {
            bg = '#0a0a14';
          }
        } else {
          continue; // not explored = black
        }

        renderer.setCell(x, y, char, fg, bg, depth, flags, light);
      }
    }

    // Torches
    for (const torch of torches) {
      const key = (torch.y << 8) | torch.x;
      if (!fovVisible.has(key)) continue;
      const flicker = Math.sin(time * 5 + torch.x) * 0.5 + 0.5;
      const g = Math.floor(102 + flicker * 68).toString(16).padStart(2, '0');
      renderer.setCell(torch.x, torch.y, '!', '#ff' + g + '00', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, 1.0);
      
      // Torch particles
      for (let p = 0; p < 3; p++) {
        const phase = time * 2 + p * 2.1 + torch.x * 0.7;
        const sparkY = torch.y - 1 - (phase % 3);
        const sparkX = torch.x + Math.sin(phase * 1.5) * 0.8;
        const rx = Math.round(sparkX), ry = Math.round(sparkY);
        if (ry >= 0 && ry < GRID_H && rx >= 0 && rx < GRID_W) {
          const fade = 1.0 - (phase % 3) / 3;
          if (fade > 0.1) {
            const sparkChar = fade > 0.5 ? '*' : '.';
            const r = 'ff';
            const gVal = Math.floor(fade * 170).toString(16).padStart(2, '0');
            renderer.setCell(rx, ry, sparkChar, '#' + r + gVal + '00', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, fade);
          }
        }
      }
    }

    // Enemies
    for (const enemy of enemies) {
      const key = (enemy.y << 8) | enemy.x;
      if (!fovVisible.has(key)) continue;
      const light = computeLight(enemy.x, enemy.y, time) + 0.3;
      renderer.setCell(enemy.x, enemy.y, enemy.char, enemy.fg, '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, Math.min(light, 1.0));
    }

    // Treasure
    for (const treasure of treasures) {
      const key = (treasure.y << 8) | treasure.x;
      if (!fovVisible.has(key)) continue;
      renderer.setCell(treasure.x, treasure.y, '$', '#ffdd00', '#1a1a2e', 0.0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, 1.0);
    }

    // Player rendered at nearest cell to eased position
    // The camera tween creates the visual slide effect
    renderer.setCell(Math.round(px), Math.round(py), '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);
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

      const loop = (now) => {
        if (!running) return;

        if (lastFrame === 0) {
          lastFrame = now;
          tweenStart = now / 1000;
          requestAnimationFrame(loop);
          return;
        }

        const dt = Math.min((now - lastFrame) / 1000, 0.1); // cap dt to 100ms
        lastFrame = now;
        time += dt * config.animSpeed;

        // Discrete tween movement
        const effectiveDuration = TWEEN_DURATION / config.animSpeed;
        const tweenElapsed = time - tweenStart;
        let tweenT = Math.min(tweenElapsed / effectiveDuration, 1.0);
        const easedT = easeOutQuint(tweenT);

        if (tweenT >= 1.0) {
          // Move to next path point
          fromX = toX;
          fromY = toY;
          pathIndex = (pathIndex + 1) % path.length;
          toX = path[pathIndex].x;
          toY = path[pathIndex].y;
          tweenStart = time;
          tweenT = 0;
        }

        // Interpolated position with easing
        const px = fromX + (toX - fromX) * easedT;
        const py = fromY + (toY - fromY) * easedT;

        // Camera centers on eased position for smooth world slide
        const dpr = window.devicePixelRatio || 1;
        const screenCenterX = (renderer.canvas.width / dpr) / 2;
        const screenCenterY = (renderer.canvas.height / dpr) / 2;
        renderer.cameraOffsetX = screenCenterX - px * config.cellSize;
        renderer.cameraOffsetY = screenCenterY - py * config.cellSize * 1.5;

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
  <h2>Graphics Lab</h2>

  {#if error}
    <div class="error">WebGPU Error: {error}</div>
  {/if}

  <div class="controls">
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
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .section h2 {
    color: #ffaa00;
    margin-bottom: 20px;
  }
  .controls {
    margin-bottom: 15px;
    max-width: 300px;
  }
  .preview {
    width: 100%;
    height: 700px;
    background: #000;
    border: 1px solid #333;
    border-radius: 4px;
    overflow: hidden;
  }
  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .error {
    color: #ff4444;
    background: #330000;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
  }
</style>
