<script>
  import { onMount } from 'svelte';
  import { Renderer } from './renderer/Renderer.js';
  import { Game } from './game/Game.js';
  
  let canvas;
  let renderer;
  let game;
  let error = null;

  onMount(async () => {
    try {
      renderer = new Renderer(canvas);
      await renderer.init();
      
      game = new Game(renderer);
      game.start();
      
      renderer.startLoop();
    } catch (e) {
      console.error('Failed to initialize:', e);
      error = e.message;
    }
  });

  function handleKeydown(event) {
    if (game) {
      game.handleInput(event.key);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown}/>

<main>
  {#if error}
    <div class="error">
      <h1>WebGPU Not Available</h1>
      <p>{error}</p>
      <p>Make sure you're using a WebGPU-enabled browser (Chrome 113+, Edge 113+)</p>
    </div>
  {:else}
    <canvas bind:this={canvas}></canvas>
    <div class="controls">
      <p>Watch the dungeon run, or press [T] for Town, [R] to restart run</p>
    </div>
  {/if}
</main>

<style>
  main {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  canvas {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
  
  .error {
    color: #ff4444;
    text-align: center;
    font-family: monospace;
  }
  
  .controls {
    position: fixed;
    bottom: 10px;
    color: #888;
    font-family: monospace;
    font-size: 12px;
  }
</style>
