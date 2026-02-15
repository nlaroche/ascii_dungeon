<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Renderer } from '../../renderer/Renderer.js';

  export let gridWidth = 80;
  export let gridHeight = 45;

  /** Cell size in CSS px. 0 = auto-fit to fill container. */
  export let cellSize = 0;

  /** @type {(renderer: Renderer) => (void | (() => void))} */
  export let onSetup = null;
  /** @type {(renderer: Renderer, dt: number, time: number) => void} */
  export let onFrame = null;

  let canvas;
  let renderer = null;
  let error = null;

  const dispatch = createEventDispatcher();

  /**
   * When cellSize=0 (auto-fit), compute grid dimensions and cell size
   * so the grid fills the container with readable text.
   * Returns { cellSize, gridW, gridH }.
   */
  function computeAutoFit(containerW, containerH) {
    // Target cell sizes to try (prefer larger for readability)
    const MIN_CELL = 10;
    const MAX_CELL = 20;
    const PREFERRED_CELL = 14;

    // Use preferred cell size, then compute grid dims to fill container
    let cs = PREFERRED_CELL;

    // If preferred is too large for the container, shrink
    let gw = Math.floor(containerW / cs);
    let gh = Math.floor(containerH / (cs * 1.5));
    if (gw < 40 || gh < 20) {
      cs = Math.max(MIN_CELL, Math.floor(Math.min(containerW / 40, containerH / (20 * 1.5))));
      gw = Math.floor(containerW / cs);
      gh = Math.floor(containerH / (cs * 1.5));
    }

    // Cap grid dimensions to reasonable maximums
    gw = Math.min(gw, 120);
    gh = Math.min(gh, 60);

    // Compute centering offset (pixels remaining after grid fills)
    const usedW = gw * cs;
    const usedH = gh * cs * 1.5;
    const offsetX = (containerW - usedW) / 2;
    const offsetY = (containerH - usedH) / 2;

    return { cellSize: cs, gridW: gw, gridH: gh, offsetX, offsetY };
  }

  onMount(async () => {
    if (!canvas) return;
    try {
      const parent = canvas.parentElement;
      const cw = parent ? parent.clientWidth : window.innerWidth;
      const ch = parent ? parent.clientHeight : window.innerHeight;

      let effectiveCellSize, effectiveGridW, effectiveGridH, offsetX = 0, offsetY = 0;

      if (cellSize > 0) {
        // Fixed cell size mode (e.g., dungeon tab)
        effectiveCellSize = cellSize;
        effectiveGridW = gridWidth;
        effectiveGridH = gridHeight;
      } else {
        // Auto-fit mode: compute grid to fill container
        const fit = computeAutoFit(cw, ch);
        effectiveCellSize = fit.cellSize;
        effectiveGridW = fit.gridW;
        effectiveGridH = fit.gridH;
        offsetX = fit.offsetX;
        offsetY = fit.offsetY;
      }

      renderer = new Renderer(canvas, {
        gridWidth: effectiveGridW,
        gridHeight: effectiveGridH,
        cellSize: effectiveCellSize,
      });
      await renderer.init();

      // Store the centering offset (applied via gridOffset)
      renderer.gridOffsetX = offsetX;
      renderer.gridOffsetY = offsetY;

      let userCleanup = null;
      if (onSetup) {
        userCleanup = onSetup(renderer);
      }

      let running = true;
      let lastFrame = 0;
      let time = 0;

      const loop = (now) => {
        if (!running) return;
        const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0.016;
        lastFrame = now;
        time += dt;
        renderer.time = time;

        // Re-compute cellSize on each frame if auto-fit (handles resize)
        if (cellSize === 0 && parent) {
          const fit = computeAutoFit(parent.clientWidth, parent.clientHeight);
          renderer.cellSize = fit.cellSize;
          renderer.gridOffsetX = fit.offsetX;
          renderer.gridOffsetY = fit.offsetY;
        }

        if (onFrame) {
          onFrame(renderer, dt, time);
        }

        animFrame = requestAnimationFrame(loop);
      };

      let animFrame = requestAnimationFrame(loop);

      cleanup = () => {
        running = false;
        cancelAnimationFrame(animFrame);
        if (typeof userCleanup === 'function') userCleanup();
      };

      dispatch('ready', renderer);
    } catch (e) {
      error = e.message;
    }
  });

  let cleanup = null;

  onDestroy(() => {
    if (cleanup) cleanup();
  });

  export function getRenderer() {
    return renderer;
  }
</script>

{#if error}
  <div class="scene-error">WebGPU Error: {error}</div>
{/if}
<canvas bind:this={canvas}></canvas>

<style>
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .scene-error {
    color: var(--accent-red);
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.2);
    padding: 10px;
    border-radius: var(--radius);
    margin-bottom: 8px;
  }
</style>
