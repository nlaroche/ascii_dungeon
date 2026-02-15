<script>
  import { onMount, onDestroy } from 'svelte';
  import { Renderer } from './renderer/Renderer.js';
  import { Game } from './game/Game.js';
  import Workbench from './workbench/Workbench.svelte';

  let canvas;
  let renderer;
  let game;
  let error = null;
  let currentRoute = 'game';
  let gameInitialized = false;

  function handleHash() {
    const hash = window.location.hash.replace(/^#\/?/, '') || 'game';
    currentRoute = hash;
  }

  onMount(() => {
    window.addEventListener('hashchange', handleHash);
    handleHash();
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', handleHash);
    }
  });

  // Initialize game when canvas is bound and we're on the game route
  $: if (canvas && currentRoute === 'game' && !gameInitialized) {
    initGame();
  }

  async function initGame() {
    if (gameInitialized) return;
    gameInitialized = true;
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
  }

  function handleKeydown(event) {
    if (game && currentRoute === 'game') {
      game.handleInput(event.key);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown}/>

{#if currentRoute === 'game'}
  <main class="game-view">
    {#if error}
      <div class="error">
        <h1>WebGPU Not Available</h1>
        <p>{error}</p>
        <p>Make sure you're using a WebGPU-enabled browser (Chrome 113+, Edge 113+)</p>
        <a href="#workbench" class="btn">Go to Workbench</a>
      </div>
    {:else}
      <canvas bind:this={canvas}></canvas>
      <div class="controls">
        <p>Watch the dungeon run, or press [T] for Town, [R] to restart run</p>
        <a href="#workbench" class="btn">Workbench</a>
      </div>
    {/if}
  </main>
{:else if currentRoute === 'workbench'}
  <Workbench />
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #111;
    color: #eee;
    font-family: monospace;
    overflow: hidden;
  }

  .game-view {
    width: 100%;
    height: 100vh;
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
  }

  .controls {
    position: fixed;
    bottom: 10px;
    left: 10px;
    color: #888;
    font-size: 12px;
    display: flex;
    gap: 20px;
    align-items: center;
  }

  .btn {
    background: #222;
    color: #00ffff;
    border: 1px solid #00ffff;
    padding: 5px 10px;
    font-family: monospace;
    cursor: pointer;
    text-decoration: none;
    font-size: 12px;
  }

  .btn:hover {
    background: #00ffff;
    color: #111;
  }
</style>
