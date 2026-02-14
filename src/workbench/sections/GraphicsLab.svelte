<script>
  import { onMount, onDestroy } from 'svelte';
  import { Renderer, CELL_FLAGS } from '../../renderer/Renderer.js';
  import ParamSlider from '../components/ParamSlider.svelte';

  let canvas;
  let renderer = null;
  let error = null;
  let cleanup = null;

  let config = { cellSize: 20, animSpeed: 1.0, visionRadius: 10 };

  // ── Dungeon Layout ──
  const GRID_W = 60, GRID_H = 35;
  const dungeonMap = [];
  // 0=void, 1=wall, 2=room floor, 3=corridor floor
  for (let y = 0; y < GRID_H; y++) {
    dungeonMap[y] = new Uint8Array(GRID_W);
  }

  const rooms = [
    { x: 2, y: 2, w: 12, h: 9 },
    { x: 28, y: 2, w: 14, h: 9 },
    { x: 2, y: 20, w: 12, h: 10 },
    { x: 28, y: 18, w: 14, h: 12 },
    { x: 16, y: 11, w: 10, h: 7 },
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
        if (cy + w < GRID_H) { dungeonMap[cy + w][cx] = 3; }
      }
      cx += Math.sign(x2 - x1);
    }
    while (cy !== y2) {
      for (let w = 0; w < 2; w++) {
        if (cx + w < GRID_W) { dungeonMap[cy][cx + w] = 3; }
      }
      cy += Math.sign(y2 - y1);
    }
  }

  // Room 1 -> Middle
  carveCorridor(13, 6, 16, 6);
  carveCorridor(16, 6, 16, 13);
  // Room 2 -> Middle
  carveCorridor(28, 6, 25, 6);
  carveCorridor(25, 6, 25, 13);
  // Room 3 -> Middle
  carveCorridor(13, 24, 16, 24);
  carveCorridor(16, 17, 16, 24);
  // Room 4 -> Middle
  carveCorridor(28, 24, 25, 24);
  carveCorridor(25, 17, 25, 24);

  // Add walls around corridors where missing
  for (let y = 1; y < GRID_H - 1; y++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      if (dungeonMap[y][x] === 3) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dungeonMap[y + dy][x + dx] === 0) {
              dungeonMap[y + dy][x + dx] = 1;
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
    { x: 4, y: 20 }, { x: 10, y: 20 }, // Room 3 top wall
    { x: 30, y: 18 }, { x: 38, y: 18 },// Room 4 top wall
    { x: 17, y: 11 }, { x: 24, y: 11 },// Middle room
  ];

  const enemies = [
    { x: 8, y: 5, char: 'G', fg: '#cc4400' },
    { x: 34, y: 6, char: 'S', fg: '#aaaaaa' },
    { x: 6, y: 25, char: 'S', fg: '#aaaaaa' },
    { x: 35, y: 24, char: 'D', fg: '#ff00ff' },
    { x: 20, y: 14, char: 'R', fg: '#ff4444' },
  ];

  const treasures = [
    { x: 10, y: 7 }, { x: 36, y: 8 },
    { x: 8, y: 26 }, { x: 34, y: 27 },
  ];

  // ── Walking path ──
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

  const path = linePath([
    { x: 5, y: 6 }, { x: 11, y: 6 },   // Room 1
    { x: 16, y: 6 }, { x: 16, y: 13 },  // Corridor down
    { x: 20, y: 13 }, { x: 24, y: 13 }, // Middle room
    { x: 25, y: 13 }, { x: 25, y: 6 },  // Corridor up
    { x: 34, y: 6 }, { x: 38, y: 6 },   // Room 2
    { x: 38, y: 9 }, { x: 34, y: 9 },   // Room 2 bottom
    { x: 25, y: 9 }, { x: 25, y: 24 },  // Corridor down
    { x: 34, y: 24 }, { x: 38, y: 24 }, // Room 4
    { x: 38, y: 27 }, { x: 30, y: 27 }, // Room 4 bottom
    { x: 25, y: 24 }, { x: 16, y: 24 }, // Corridor left
    { x: 8, y: 24 }, { x: 5, y: 24 },   // Room 3
    { x: 5, y: 27 }, { x: 11, y: 27 },  // Room 3 bottom
    { x: 11, y: 24 }, { x: 16, y: 24 }, // Back corridor
    { x: 16, y: 13 }, { x: 16, y: 6 },  // Up to room 1
    { x: 5, y: 6 },                       // Back to start
  ]);

  let explored = new Set();

  // ── Lighting: compute light at (x,y) from all torches ──
  function computeLight(x, y, time) {
    let totalLight = 0;
    for (const torch of torches) {
      const dx = x - torch.x;
      const dy = y - torch.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 8) {
        const flicker = 0.85 + Math.sin(time * 4 + torch.x * 3.7 + torch.y * 2.3) * 0.15;
        const intensity = Math.max(0, 1.0 - dist / 8) * flicker;
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

    const vr = config.visionRadius;

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const tile = dungeonMap[y][x];
        if (tile === 0) continue; // void = black (already cleared)

        const dx = x - px;
        const dy = y - py;
        const distSq = dx * dx + dy * dy;
        const inVision = distSq <= vr * vr;
        const key = (y << 8) | x;
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
          const proxLight = Math.max(0, 1.0 - Math.sqrt(distSq) / vr) * 0.5;
          light = Math.min(light + proxLight, 1.0);
        } else if (wasExplored) {
          flags = CELL_FLAGS.EXPLORED;
          light = 0.0;
        } else {
          continue; // not explored = black
        }

        renderer.setCell(x, y, char, fg, bg, depth, flags, light);
      }
    }

    // Torches
    for (const torch of torches) {
      const dx = torch.x - px, dy = torch.y - py;
      if (dx * dx + dy * dy <= vr * vr) {
        const flicker = Math.sin(time * 5 + torch.x) * 0.5 + 0.5;
        const g = Math.floor(102 + flicker * 68).toString(16).padStart(2, '0');
        renderer.setCell(torch.x, torch.y, '!', '#ff' + g + '00', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, 1.0);
      }
    }

    // Enemies
    for (const enemy of enemies) {
      const dx = enemy.x - px, dy = enemy.y - py;
      if (dx * dx + dy * dy <= vr * vr) {
        const light = computeLight(enemy.x, enemy.y, time) + 0.3;
        renderer.setCell(enemy.x, enemy.y, enemy.char, enemy.fg, '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, Math.min(light, 1.0));
      }
    }

    // Treasure
    for (const treasure of treasures) {
      const dx = treasure.x - px, dy = treasure.y - py;
      if (dx * dx + dy * dy <= vr * vr) {
        renderer.setCell(treasure.x, treasure.y, '$', '#ffdd00', '#1a1a2e', 0.0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, 1.0);
      }
    }

    // Player (always full brightness)
    renderer.setCell(Math.round(px), Math.round(py), '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);
  }

  onMount(async () => {
    try {
      renderer = new Renderer(canvas, { gridWidth: GRID_W, gridHeight: GRID_H, cellSize: config.cellSize });
      await renderer.init();

      let running = true;
      let time = 0;
      let lastFrame = 0;

      const loop = (now) => {
        if (!running) return;

        if (lastFrame === 0) {
          lastFrame = now;
          requestAnimationFrame(loop);
          return;
        }

        const dt = Math.min((now - lastFrame) / 1000, 0.1); // cap dt to 100ms
        lastFrame = now;
        time += dt * config.animSpeed;

        const moveSpeed = 3;
        const t = ((time * moveSpeed) % path.length + path.length) % path.length;
        const idx = Math.floor(t);
        const frac = t - idx;
        const curr = path[idx];
        const next = path[(idx + 1) % path.length];

        const px = curr.x + (next.x - curr.x) * frac;
        const py = curr.y + (next.y - curr.y) * frac;

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
