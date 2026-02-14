<script>
  import { onMount } from 'svelte';
  import { Renderer } from './renderer/Renderer.js';
  import { Game } from './game/Game.js';
  
  let canvas;
  let renderer;
  let game;
  let error = null;
  let currentRoute = 'game';

  onMount(async () => {
    // Handle routing
    const handleHash = () => {
      const hash = window.location.hash.slice(1) || 'game';
      currentRoute = hash;
    };
    
    window.addEventListener('hashchange', handleHash);
    handleHash();
    
    // Only initialize game if on game route
    if (currentRoute === 'game') {
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
  });

  function handleKeydown(event) {
    if (game) {
      game.handleInput(event.key);
    }
  }
  
  function goToGame() {
    window.location.hash = 'game';
  }
  
  function goToWorkbench() {
    window.location.hash = 'workbench';
  }
</script>

<svelte:window on:keydown={handleKeydown}/>

<main>
  {#if currentRoute === 'game'}
    {#if error}
      <div class="error">
        <h1>WebGPU Not Available</h1>
        <p>{error}</p>
        <p>Make sure you're using a WebGPU-enabled browser (Chrome 113+, Edge 113+)</p>
        <button on:click={goToWorkbench}>Go to Workbench</button>
      </div>
    {:else}
      <canvas bind:this={canvas}></canvas>
      <div class="controls">
        <p>Watch the dungeon run, or press [T] for Town, [R] to restart run</p>
        <button on:click={goToWorkbench}>Workbench</button>
      </div>
    {/if}
  {:else if currentRoute === 'workbench'}
    <script>
      import Workbench from './workbench/Workbench.svelte';
    </script>
    <svelte:component this={Workbench} />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #111;
    color: #eee;
    font-family: monospace;
    overflow: hidden;
  }

  main {
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
    font-family: monospace;
  }
  
  .controls {
    position: fixed;
    bottom: 10px;
    left: 10px;
    color: #888;
    font-family: monospace;
    font-size: 12px;
    display: flex;
    gap: 20px;
    align-items: center;
  }
  
  button {
    background: #222;
    color: #00ffff;
    border: 1px solid #00ffff;
    padding: 5px 10px;
    font-family: monospace;
    cursor: pointer;
  }
  
  button:hover {
    background: #00ffff;
    color: #111;
  }
</style>
