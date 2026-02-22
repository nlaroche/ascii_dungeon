<script>
  import { onMount, onDestroy } from 'svelte';
  import { Renderer } from './renderer/Renderer.js';
  import { ScreenManager } from './game/ScreenManager.js';
  import { GameSession } from './game/GameSession.js';
  import { IntroScreen } from './game/screens/IntroScreen.js';
  import { TownScreen } from './game/screens/TownScreen.js';
  import { DungeonScreen } from './game/screens/DungeonScreen.js';
  import { RunCompleteScreen } from './game/screens/RunCompleteScreen.js';
  import { getCurrentTimeOfDay } from './lib/run.js';
  import TownModal from './workbench/helpers/TownModal.svelte';
  import IntroOverlay from './game/ui/IntroOverlay.svelte';
  import CharacterHUD from './game/ui/CharacterHUD.svelte';
  import Workbench from './workbench/Workbench.svelte';

  let canvas;
  let renderer;
  let screenManager;
  let error = null;
  let currentRoute = 'game';
  let gameInitialized = false;
  let modalBuilding = null;
  let currentScreenName = null;
  let sessionPlayer = null;
  let sessionDay = 1;
  let sessionTimeOfDay = '';
  let hasSave = false;

  const screens = {
    intro: IntroScreen,
    town: TownScreen,
    dungeon: DungeonScreen,
    runComplete: RunCompleteScreen,
  };

  /** Auto-fit grid to fill container (same logic as SceneCanvas). */
  function computeAutoFit(containerW, containerH) {
    const MIN_CELL = 10;
    const PREFERRED_CELL = 14;

    let cs = PREFERRED_CELL;
    let gw = Math.floor(containerW / cs);
    let gh = Math.floor(containerH / (cs * 1.5));
    if (gw < 40 || gh < 20) {
      cs = Math.max(MIN_CELL, Math.floor(Math.min(containerW / 40, containerH / (20 * 1.5))));
      gw = Math.floor(containerW / cs);
      gh = Math.floor(containerH / (cs * 1.5));
    }
    gw = Math.min(gw, 120);
    gh = Math.min(gh, 60);

    const usedW = gw * cs;
    const usedH = gh * cs * 1.5;
    const offsetX = (containerW - usedW) / 2;
    const offsetY = (containerH - usedH) / 2;

    return { cellSize: cs, gridW: gw, gridH: gh, offsetX, offsetY };
  }

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
    if (screenManager) {
      screenManager.stop();
    }
  });

  // Initialize game when canvas is bound and we're on the game route
  $: if (canvas && currentRoute === 'game' && !gameInitialized) {
    initGame();
  }

  function syncOverlayState() {
    if (!screenManager) return;
    currentScreenName = screenManager.currentScreenName;

    // Sync session data for overlays
    const session = screenManager.session;
    if (session) {
      sessionPlayer = session.player;
      sessionDay = session.calendar?.currentDay || 1;
      sessionTimeOfDay = getCurrentTimeOfDay(sessionDay);
    } else {
      sessionPlayer = null;
    }

    // Sync hasSave for intro overlay
    if (currentScreenName === 'intro') {
      hasSave = GameSession.hasSave();
    }

    // Clear modal if we left the town screen
    if (screenManager.currentScreen !== TownScreen && modalBuilding) {
      modalBuilding = null;
    }
  }

  async function initGame() {
    if (gameInitialized) return;
    gameInitialized = true;
    try {
      const parent = canvas.parentElement;
      const cw = parent ? parent.clientWidth : window.innerWidth;
      const ch = parent ? parent.clientHeight : window.innerHeight;
      const fit = computeAutoFit(cw, ch);

      renderer = new Renderer(canvas, {
        gridWidth: fit.gridW,
        gridHeight: fit.gridH,
        cellSize: fit.cellSize,
      });
      await renderer.init();
      renderer.gridOffsetX = fit.offsetX;
      renderer.gridOffsetY = fit.offsetY;

      hasSave = GameSession.hasSave();
      const session = GameSession.load() || null;
      screenManager = new ScreenManager(renderer, session, screens, {
        onBeforeFrame: () => {
          if (!parent) return;
          // Recompute auto-fit (handles window resize)
          const f = computeAutoFit(parent.clientWidth, parent.clientHeight);
          renderer.cellSize = f.cellSize;
          renderer.gridOffsetX = f.offsetX;
          renderer.gridOffsetY = f.offsetY;
          syncOverlayState();
        },
      });
      screenManager.start();
    } catch (e) {
      console.error('Failed to initialize:', e);
      error = e.message;
    }
  }

  function handleKeydown(event) {
    // Don't forward keyboard to IntroScreen — IntroOverlay handles it
    if (screenManager && currentRoute === 'game' && currentScreenName !== 'intro') {
      screenManager.handleInput(event.key);
    }
  }

  /** Convert pixel coordinates to grid coordinates */
  function pixelToGrid(e) {
    if (!renderer || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const gx = Math.floor((px - (renderer.gridOffsetX || 0)) / renderer.cellSize);
    const gy = Math.floor((py - (renderer.gridOffsetY || 0)) / (renderer.cellSize * 1.5));
    return { gx, gy };
  }

  function handleMouseMove(e) {
    if (!screenManager || currentRoute !== 'game') return;
    const pos = pixelToGrid(e);
    if (pos) screenManager.handleMouseMove(pos.gx, pos.gy);
  }

  function handleClick(e) {
    if (!screenManager || currentRoute !== 'game') return;
    const pos = pixelToGrid(e);
    if (pos) {
      screenManager.handleClick(pos.gx, pos.gy);
      // Sync modal state instantly on click (don't wait for next frame)
      if (screenManager.currentScreen === TownScreen) {
        modalBuilding = TownScreen._openBuilding;
      }
    }
  }

  function handleMouseLeave() {
    if (screenManager && currentRoute === 'game') {
      screenManager.handleMouseMove(-1, -1);
    }
  }

  function closeTownModal() {
    TownScreen.closeModal();
    modalBuilding = null;
  }

  function handleIntroMenu(event) {
    const action = event.detail;
    if (screenManager) {
      IntroScreen.activateMenu(screenManager.ctx, action);
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
      <canvas
        bind:this={canvas}
        on:mousemove={handleMouseMove}
        on:click={handleClick}
        on:mouseleave={handleMouseLeave}
      ></canvas>

      {#if currentScreenName === 'intro'}
        <IntroOverlay {hasSave} on:menuSelect={handleIntroMenu} />
      {/if}

      {#if currentScreenName === 'town' && sessionPlayer}
        <div class="hud-overlay">
          <CharacterHUD
            player={sessionPlayer}
            day={sessionDay}
            timeOfDay={sessionTimeOfDay}
          />
        </div>
      {/if}

      <TownModal building={modalBuilding} onClose={closeTownModal} />
      <div class="controls">
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
    background: #212123;
    color: #f2f0e5;
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
    position: relative;

    /* Theme variables (same as workbench) so TownModal renders correctly */
    --bg:            #09090b;
    --bg-card:       #18181b;
    --bg-muted:      #27272a;
    --bg-accent:     #3f3f46;
    --border:        #27272a;
    --border-muted:  #1e1e22;
    --border-accent: #3f3f46;
    --fg:            #fafafa;
    --fg-muted:      #a1a1aa;
    --fg-dim:        #71717a;
    --accent:        #68c2d3;
    --accent-green:  #a2dcc7;
    --accent-amber:  #d3a068;
    --accent-red:    #b45252;
    --radius-sm: 4px;
    --radius: 6px;
    --radius-lg: 8px;
    --font-mono: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace;
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    image-rendering: pixelated;
  }

  .error {
    color: #b45252;
    text-align: center;
  }

  .hud-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: var(--font-mono);
  }

  .controls {
    position: fixed;
    bottom: 10px;
    left: 10px;
    color: #868188;
    font-size: 12px;
    display: flex;
    gap: 20px;
    align-items: center;
  }

  .btn {
    background: #3a3858;
    color: #68c2d3;
    border: 1px solid #68c2d3;
    padding: 5px 10px;
    font-family: monospace;
    cursor: pointer;
    text-decoration: none;
    font-size: 12px;
  }

  .btn:hover {
    background: #68c2d3;
    color: #212123;
  }
</style>
