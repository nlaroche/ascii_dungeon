<script>
  import ParamSlider from '../components/ParamSlider.svelte';
  import SceneCanvas from '../helpers/SceneCanvas.svelte';
  import TownModal from '../helpers/TownModal.svelte';
  import * as dungeonScene from '../scenes/dungeonScene.js';
  import * as townScene from '../scenes/townScene.js';
  import * as characterScene from '../scenes/characterScene.js';
  import * as completionScene from '../scenes/completionScene.js';
  import * as introScene from '../scenes/introScene.js';

  const TABS = [
    { id: 'dungeon', label: 'Dungeon', scene: dungeonScene },
    { id: 'town', label: 'Town', scene: townScene },
    { id: 'character', label: 'Character', scene: characterScene },
    { id: 'completion', label: 'Completion', scene: completionScene },
    { id: 'intro', label: 'Intro', scene: introScene },
  ];

  let activeTab = 'dungeon';
  let renderer = null;
  let sceneKey = 0;
  let openBuilding = null;

  $: activeScene = TABS.find(t => t.id === activeTab).scene;
  $: gridW = activeScene.gridWidth;
  $: gridH = activeScene.gridHeight;
  // Dungeon uses fixed cellSize from config slider; all other scenes auto-fit
  $: sceneCellSize = activeTab === 'dungeon' ? config.cellSize : 0;

  function switchTab(id) {
    if (id === activeTab) return;
    openBuilding = null;
    activeTab = id;
    sceneKey++;
  }

  function handleSetup(r) {
    renderer = r;
    activeScene.onSetup(r);
  }

  function handleFrame(r, dt) {
    activeScene.onFrame(r, dt);
  }

  function handleMouseMove(gx, gy) {
    if (activeTab === 'town') {
      townScene.setMousePos(gx, gy);
    }
  }

  function handleClick(gx, gy) {
    if (activeTab === 'town') {
      const building = townScene.getHoveredBuilding();
      if (building) {
        openBuilding = building;
      }
    }
  }

  function closeModal() {
    openBuilding = null;
  }

  // Dungeon-specific config
  let config = dungeonScene.getConfig();

  function updateDungeonConfig(key, value) {
    config[key] = value;
    dungeonScene.setConfig({ [key]: value });
    if (key === 'cellSize' && renderer) renderer.cellSize = value;
  }
</script>

<div class="section">
  <div class="tab-bar">
    {#each TABS as tab}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        on:click={() => switchTab(tab.id)}
      >{tab.label}</button>
    {/each}
  </div>

  <div class="viewport">
    <div class="canvas-wrap" class:blurred={openBuilding !== null}>
      {#key sceneKey}
        <SceneCanvas
          gridWidth={gridW}
          gridHeight={gridH}
          cellSize={sceneCellSize}
          onSetup={handleSetup}
          onFrame={handleFrame}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />
      {/key}
    </div>

    {#if activeTab === 'dungeon'}
      <div class="controls-panel">
        <h3>Dungeon</h3>
        <ParamSlider
          label="Cell Size"
          min={10}
          max={28}
          step={1}
          value={config.cellSize}
          on:change={e => updateDungeonConfig('cellSize', e.detail)}
        />
        <ParamSlider
          label="Anim Speed"
          min={0}
          max={5}
          step={0.1}
          value={config.animSpeed}
          on:change={e => updateDungeonConfig('animSpeed', e.detail)}
        />
        <ParamSlider
          label="Vision"
          min={4}
          max={20}
          step={1}
          value={config.visionRadius}
          on:change={e => updateDungeonConfig('visionRadius', e.detail)}
        />
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showDust}
            on:change={() => updateDungeonConfig('showDust', config.showDust)} />
          Dust Motes
        </label>
        <ParamSlider
          label="Torch Intensity"
          min={0.5}
          max={2.0}
          step={0.1}
          value={config.torchIntensity}
          on:change={e => updateDungeonConfig('torchIntensity', e.detail)}
        />
      </div>
    {/if}

    <TownModal building={openBuilding} onClose={closeModal} />
  </div>
</div>

<style>
  .section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 4px 4px 0;
    background: var(--bg);
  }
  .tab {
    padding: 6px 14px;
    font-size: 12px;
    font-family: inherit;
    color: var(--fg-muted);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: var(--radius) var(--radius) 0 0;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .tab:hover {
    color: var(--fg);
    background: var(--bg-accent);
  }
  .tab.active {
    color: var(--accent);
    background: var(--bg-card);
    border-color: var(--border);
  }
  .viewport {
    flex: 1;
    position: relative;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 0 0 var(--radius) var(--radius);
    overflow: hidden;
    min-height: 0;
  }
  .canvas-wrap {
    position: absolute;
    inset: 0;
    transition: filter 0.3s ease;
  }
  .canvas-wrap.blurred {
    filter: blur(3px) grayscale(0.5) brightness(0.75);
    pointer-events: none;
  }
  .controls-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 220px;
    background: rgba(9, 9, 11, 0.88);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    z-index: 10;
  }
  .controls-panel h3 {
    color: var(--accent-amber);
    margin: 0 0 10px 0;
    font-size: 14px;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--fg-muted);
    margin: 4px 0;
    cursor: pointer;
  }
</style>
