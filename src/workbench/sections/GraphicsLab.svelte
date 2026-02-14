<script>
  import { onMount, onDestroy } from 'svelte';
  import { Renderer, CELL_FLAGS } from '../../renderer/Renderer.js';
  import ParamSlider from '../components/ParamSlider.svelte';

  let canvas;
  let renderer = null;
  let cellSize = 12;
  let animSpeed = 1.0;
  let error = null;
  let cleanup = null;

  function fillDemoScene(time) {
    if (!renderer) return;
    
    renderer.clearGrid();
    
    const gridWidth = renderer.gridWidth;
    const gridHeight = renderer.gridHeight;
    
    // Draw border
    for (let x = 0; x < gridWidth; x++) {
      renderer.setCell(x, 0, '#', '#444444', '#222222', 1.0, CELL_FLAGS.VISIBLE);
      renderer.setCell(x, gridHeight - 1, '#', '#444444', '#222222', 1.0, CELL_FLAGS.VISIBLE);
    }
    for (let y = 0; y < gridHeight; y++) {
      renderer.setCell(0, y, '#', '#444444', '#222222', 1.0, CELL_FLAGS.VISIBLE);
      renderer.setCell(gridWidth - 1, y, '#', '#444444', '#222222', 1.0, CELL_FLAGS.VISIBLE);
    }
    
    // Draw floor tiles inside border
    for (let y = 1; y < gridHeight - 1; y++) {
      for (let x = 1; x < gridWidth - 1; x++) {
        renderer.setCell(x, y, '.', '#333333', '#111111', 0.0, CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED);
      }
    }
    
    // Draw player
    renderer.setCell(10, 8, '@', '#00ff00', '#000000', 0.5, CELL_FLAGS.VISIBLE);
    
    // Draw enemies
    renderer.setCell(15, 5, 'G', '#ff0000', '#000000', 0.5, CELL_FLAGS.VISIBLE);
    renderer.setCell(20, 12, 'S', '#ff4400', '#000000', 0.5, CELL_FLAGS.VISIBLE);
    renderer.setCell(25, 8, 'D', '#ff00ff', '#000000', 0.5, CELL_FLAGS.VISIBLE);
    
    // Draw treasure
    renderer.setCell(18, 10, '$', '#ffff00', '#000000', 0.0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED);
    
    // Draw title text
    const title = "Graphics Lab Preview";
    for (let i = 0; i < title.length; i++) {
      renderer.setCell(2 + i, 1, title[i], '#ffaa00', '#000000', 0, CELL_FLAGS.VISIBLE);
    }
    
    // Pulsing animation using Math.sin(time * animSpeed)
    const pulseRow = 15;
    const pulseCount = 10;
    const pulsePhase = Math.sin(time * animSpeed);
    const pulseFlag = pulsePhase > 0 ? CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED : CELL_FLAGS.VISIBLE;
    
    for (let i = 0; i < pulseCount; i++) {
      renderer.setCell(5 + i, pulseRow, '*', '#00ffff', '#000000', 0.0, pulseFlag);
    }
  }

  onMount(async () => {
    try {
      renderer = new Renderer(canvas, { gridWidth: 80, gridHeight: 50, cellSize });
      await renderer.init();

      let running = true;
      let time = 0;
      const loop = () => {
        if (!running) return;
        time += 0.016 * animSpeed;
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
    <ParamSlider label="Cell Size" min={6} max={24} step={1} value={cellSize} on:change={e => cellSize = e.detail} />
    <ParamSlider label="Anim Speed" min={0} max={3} step={0.1} value={animSpeed} on:change={e => animSpeed = e.detail} />
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
