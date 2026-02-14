<script>
  import { onMount, onDestroy } from 'svelte';
  import { Renderer, CELL_FLAGS } from '../../renderer/Renderer.js';
  import ParamSlider from '../components/ParamSlider.svelte';

  let canvas;
  let renderer = null;
  let error = null;
  let cleanup = null;

  let config = { cellSize: 16, animSpeed: 1.0 };

  const rooms = [
    { x: 3, y: 3, w: 10, h: 8 },
    { x: 25, y: 3, w: 12, h: 8 },
    { x: 3, y: 20, w: 10, h: 10 },
    { x: 25, y: 20, w: 12, h: 10 },
    { x: 14, y: 12, w: 8, h: 6 },
  ];

  const corridors = [
    { x1: 8, y1: 7, x2: 13, y2: 9 },
    { x1: 31, y1: 7, x2: 22, y2: 9 },
    { x1: 8, y1: 25, x2: 13, y2: 21 },
    { x1: 31, y1: 25, x2: 22, y2: 21 },
  ];

  const torches = [
    { x: 2, y: 4 }, { x: 13, y: 2 }, { x: 24, y: 4 }, { x: 37, y: 2 },
    { x: 2, y: 15 }, { x: 13, y: 13 }, { x: 24, y: 15 }, { x: 37, y: 13 },
    { x: 2, y: 29 }, { x: 13, y: 27 }, { x: 24, y: 29 }, { x: 37, y: 27 },
  ];

  const enemies = [
    { x: 5, y: 5, char: 'G', fg: '#cc4400' },
    { x: 32, y: 5, char: 'S', fg: '#aaaaaa' },
    { x: 5, y: 25, char: 'S', fg: '#aaaaaa' },
    { x: 32, y: 25, char: 'D', fg: '#ff00ff' },
  ];

  const treasures = [
    { x: 10, y: 6 }, { x: 28, y: 6 },
    { x: 10, y: 24 }, { x: 28, y: 24 },
  ];

  const path = [
    { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 },
    { x: 10, y: 6 }, { x: 10, y: 7 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 },
    { x: 14, y: 8 }, { x: 15, y: 8 }, { x: 16, y: 8 }, { x: 17, y: 8 }, { x: 18, y: 8 }, { x: 19, y: 8 },
    { x: 20, y: 8 }, { x: 21, y: 8 }, { x: 22, y: 8 }, { x: 22, y: 7 }, { x: 22, y: 6 }, { x: 23, y: 6 },
    { x: 24, y: 6 }, { x: 25, y: 6 }, { x: 26, y: 6 }, { x: 27, y: 6 }, { x: 28, y: 6 }, { x: 29, y: 6 },
    { x: 30, y: 6 }, { x: 31, y: 6 }, { x: 32, y: 6 }, { x: 32, y: 7 }, { x: 32, y: 8 }, { x: 32, y: 9 },
    { x: 32, y: 10 }, { x: 31, y: 10 }, { x: 30, y: 10 }, { x: 29, y: 10 }, { x: 28, y: 10 }, { x: 27, y: 10 },
    { x: 26, y: 10 }, { x: 25, y: 10 }, { x: 25, y: 11 }, { x: 25, y: 12 }, { x: 25, y: 13 }, { x: 25, y: 14 },
    { x: 25, y: 15 }, { x: 25, y: 16 }, { x: 25, y: 17 }, { x: 25, y: 18 }, { x: 25, y: 19 }, { x: 25, y: 20 },
    { x: 25, y: 21 }, { x: 25, y: 22 }, { x: 25, y: 23 }, { x: 24, y: 23 }, { x: 23, y: 23 }, { x: 22, y: 23 },
    { x: 21, y: 23 }, { x: 20, y: 23 }, { x: 19, y: 23 }, { x: 18, y: 23 }, { x: 17, y: 23 }, { x: 16, y: 23 },
    { x: 15, y: 23 }, { x: 14, y: 23 }, { x: 13, y: 23 }, { x: 12, y: 23 }, { x: 11, y: 23 }, { x: 10, y: 23 },
    { x: 9, y: 23 }, { x: 8, y: 23 }, { x: 8, y: 22 }, { x: 8, y: 21 }, { x: 8, y: 20 }, { x: 8, y: 19 },
    { x: 8, y: 18 }, { x: 8, y: 17 }, { x: 8, y: 16 }, { x: 8, y: 15 }, { x: 8, y: 14 }, { x: 8, y: 13 },
    { x: 8, y: 12 }, { x: 8, y: 11 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 },
    { x: 5, y: 9 }, { x: 5, y: 8 }, { x: 5, y: 7 }, { x: 5, y: 6 },
  ];

  let playerPos = { x: 5, y: 5 };
  let explored = new Set();

  function isInRoom(x, y) {
    for (const room of rooms) {
      if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) {
        return true;
      }
    }
    return false;
  }

  function isInCorridor(x, y) {
    for (const corr of corridors) {
      const minX = Math.min(corr.x1, corr.x2);
      const maxX = Math.max(corr.x1, corr.x2);
      const minY = Math.min(corr.y1, corr.y2);
      const maxY = Math.max(corr.y1, corr.y2);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return true;
      }
    }
    return false;
  }

  function isVisible(x, y) {
    const dx = x - playerPos.x;
    const dy = y - playerPos.y;
    return dx * dx + dy * dy <= 25;
  }

  function renderString(text, x, y, fg, bg) {
    for (let i = 0; i < text.length; i++) {
      renderer.setCell(x + i, y, text[i], fg, bg || '#000000', 0, CELL_FLAGS.VISIBLE);
    }
  }

  function fillDemoScene(time) {
    if (!renderer) return;

    renderer.clearGrid();

    const gridWidth = renderer.gridWidth;
    const gridHeight = renderer.gridHeight;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        let char = ' ';
        let fg = '#000000';
        let bg = '#0a0a14';
        let depth = 0.0;
        let flags = 0;

        const inRoom = isInRoom(x, y);
        const inCorridor = isInCorridor(x, y);
        const visible = isVisible(x, y);
        const exploredCell = explored.has(`${x},${y}`);

        if (inRoom) {
          char = ' ';
          bg = '#1a1a2e';
          depth = 0.0;
        } else if (inCorridor) {
          char = ' ';
          bg = '#15152a';
          depth = 0.0;
        } else {
          char = '#';
          fg = '#555555';
          bg = '#2a2a3a';
          depth = 1.0;
        }

        if (visible) {
          flags = CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED;
          explored.add(`${x},${y}`);
        } else if (exploredCell) {
          flags = CELL_FLAGS.EXPLORED;
          bg = '#0a0a14';
          char = ' ';
        }

        renderer.setCell(x, y, char, fg, bg, depth, flags);
      }
    }

    for (const torch of torches) {
      if (isVisible(torch.x, torch.y)) {
        const flicker = Math.sin(time * 5) * 0.5 + 0.5;
        const g = Math.floor(102 + flicker * 68);
        const torchFg = `rgb(255,${g},0)`;
        renderer.setCell(torch.x, torch.y, '!', torchFg, '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED);
      }
    }

    for (const enemy of enemies) {
      if (isVisible(enemy.x, enemy.y)) {
        renderer.setCell(enemy.x, enemy.y, enemy.char, enemy.fg, '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE);
      }
    }

    for (const treasure of treasures) {
      if (isVisible(treasure.x, treasure.y)) {
        renderer.setCell(treasure.x, treasure.y, '$', '#ffdd00', '#1a1a2e', 0.0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED);
      }
    }

    renderer.setCell(playerPos.x, playerPos.y, '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE);

    renderString("Dungeon Explorer Demo", 2, 0, '#ffaa00', '#000000');
  }

  onMount(async () => {
    try {
      renderer = new Renderer(canvas, { gridWidth: 80, gridHeight: 50, cellSize: config.cellSize });
      await renderer.init();

      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 80; x++) {
          explored.add(`${x},${y}`);
        }
      }

      let running = true;
      let time = 0;
      const loop = () => {
        if (!running) return;

        time += 0.016 * config.animSpeed;

        const pathIndex = Math.floor(time * 3) % path.length;
        playerPos = path[pathIndex];

        renderer.cellSize = config.cellSize;

        fillDemoScene(time);
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
      min={8} 
      max={24} 
      step={1} 
      value={config.cellSize} 
      on:change={e => { config.cellSize = e.detail; renderer.cellSize = e.detail; }} 
    />
    <ParamSlider 
      label="Anim Speed" 
      min={0} 
      max={5} 
      step={0.1} 
      value={config.animSpeed} 
      on:change={e => config.animSpeed = e.detail} 
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
    height: 600px;
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
