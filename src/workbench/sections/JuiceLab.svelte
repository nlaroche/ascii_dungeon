<script>
  import { LAYERS, CELL_FLAGS } from '../../renderer/Renderer.js';
  import { createJuiceEngine } from '../../lib/juice.js';
  import ParamSlider from '../components/ParamSlider.svelte';
  import SceneCanvas from '../helpers/SceneCanvas.svelte';
  import { drawArena } from '../helpers/drawArena.js';
  import { drawParticles, drawFloatTexts } from '../helpers/drawJuice.js';
  import { COLORS } from '../../lib/palette.js';

  // ── Arena ──
  const GRID_W = 40;
  const GRID_H = 20;
  const CELL_SIZE = 14;

  const FLOOR_BG = COLORS.floorBg;
  const PLAYER_FG = COLORS.player;
  const ENEMY_FG = COLORS.damage;

  // Character positions
  const ARENA_Y = 10;
  const PLAYER_HOME_X = 12;
  const ENEMY_HOME_X = 27;

  let renderer = null;

  const juice = createJuiceEngine();
  let juiceState = { frozen: false, shakeX: 0, shakeY: 0, vignette: 0, particles: [], floatTexts: [], entityOverrides: {} };

  // ── Tunable parameters ──
  let intensity = 1.0;
  let masterSpeed = 1.0;

  let hitstopDuration = 100;
  let shakeAmplitude = 2.5;
  let shakeDecay = 15;
  let shakeFrequency = 40;
  let bumpDistance = 0.5;
  let bumpDuration = 120;
  let squashAmount = 0.25;
  let squashDuration = 100;
  let particleCount = 10;
  let particleSpeed = 5;
  let particleSpread = 0.6;
  let particleGravity = 5;
  let particleLife = 0.5;
  let flashFrames = 3;
  let vignetteIntensity = 0.4;
  let vignetteDuration = 350;

  // ── Event log ──
  let eventLog = [];
  function addLog(msg) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    eventLog = [...eventLog, `[${ts}] ${msg}`];
    if (eventLog.length > 50) eventLog = eventLog.slice(-50);
  }

  // ── Sync intensity/speed to engine ──
  $: juice.intensity = intensity;
  $: juice.speed = masterSpeed;

  // ── Trigger functions ──
  function triggerHit() {
    addLog('HIT combo — hitstop + flash + particles + shake + bump + float text');
    juice.hitstop(hitstopDuration);
    juice.flash('enemy', COLORS.flash, flashFrames);
    juice.particles(ENEMY_HOME_X, ARENA_Y, {
      count: particleCount,
      speed: particleSpeed,
      spread: particleSpread * Math.PI,
      gravity: particleGravity,
      life: particleLife,
      color: ENEMY_FG,
      angle: 0,
    });
    juice.shake(shakeAmplitude, { decay: shakeDecay, frequency: shakeFrequency });
    juice.bump('player', 1, 0, { distance: bumpDistance * 0.3, duration: bumpDuration });
    juice.bump('enemy', 1, 0, { distance: bumpDistance, duration: bumpDuration });
    juice.squash('enemy', 'x', squashAmount, { duration: squashDuration });
    juice.floatText(ENEMY_HOME_X, ARENA_Y - 2, '-12', {
      color: COLORS.damage,
      outlineColor: COLORS.black,
      bold: true,
      outline: true,
      scale: 1.5,
      vy: -4,
      gravity: 18,
      bounce: 0.4,
      groundY: ARENA_Y,
      life: 1.2,
    });
    juice.vignettePulse(vignetteIntensity, vignetteDuration);
  }

  function triggerBump() {
    addLog('BUMP — nudge enemy');
    juice.bump('enemy', 1, 0, { distance: bumpDistance, duration: bumpDuration });
  }

  function triggerShake() {
    addLog('SHAKE — screen shake');
    juice.shake(shakeAmplitude, { decay: shakeDecay, frequency: shakeFrequency });
  }

  function triggerSquash() {
    addLog('SQUASH — squash & stretch on enemy');
    juice.squash('enemy', 'x', squashAmount, { duration: squashDuration });
  }

  function triggerParticles() {
    addLog('PARTICLES — burst from enemy');
    juice.particles(ENEMY_HOME_X, ARENA_Y, {
      count: particleCount,
      speed: particleSpeed,
      spread: particleSpread * Math.PI,
      gravity: particleGravity,
      life: particleLife,
      color: COLORS.accentAmber,
      angle: -Math.PI / 2,
    });
  }

  function triggerFlash() {
    addLog('FLASH — white flash on enemy');
    juice.flash('enemy', COLORS.flash, flashFrames);
  }

  function triggerAll() {
    addLog('ALL — everything at once!');
    triggerHit();
  }

  // ── Render ──
  function drawScene() {
    if (!renderer) return;
    renderer.clearGrid();

    // Base arena grid with lighting, torch particles, wall tinting
    drawArena(renderer, GRID_W, GRID_H, { time: renderer.time });

    // Connect vignette pulse
    renderer.vignettePulse = juiceState.vignette;

    const overrides = juiceState.entityOverrides;
    const playerOvr = overrides['player'] || {};
    const enemyOvr = overrides['enemy'] || {};

    // Player
    const pFg = playerOvr.flashColor || PLAYER_FG;
    const pOffX = playerOvr.offsetX || 0;
    const pOffY = playerOvr.offsetY || 0;
    const pScaleX = playerOvr.scaleX || 1.0;
    const pScaleY = playerOvr.scaleY || 1.0;
    renderer.setCell(
      PLAYER_HOME_X, ARENA_Y, '@', pFg, FLOOR_BG, 0.5,
      CELL_FLAGS.VISIBLE, 1.0, pOffX, pOffY, LAYERS.PLAYER, pScaleX, pScaleY
    );
    // Player label
    const pLabel = 'Hero';
    for (let i = 0; i < pLabel.length; i++) {
      renderer.setCell(
        PLAYER_HOME_X - 1 + i, ARENA_Y - 2, pLabel[i], PLAYER_FG, FLOOR_BG, 0,
        CELL_FLAGS.VISIBLE, 0.7, 0, 0, LAYERS.OBJECTS
      );
    }

    // Enemy
    const eFg = enemyOvr.flashColor || ENEMY_FG;
    const eOffX = enemyOvr.offsetX || 0;
    const eOffY = enemyOvr.offsetY || 0;
    const eScaleX = enemyOvr.scaleX || 1.0;
    const eScaleY = enemyOvr.scaleY || 1.0;
    renderer.setCell(
      ENEMY_HOME_X, ARENA_Y, 'G', eFg, FLOOR_BG, 0.5,
      CELL_FLAGS.VISIBLE, 1.0, eOffX, eOffY, LAYERS.PLAYER, eScaleX, eScaleY
    );
    // Enemy label
    const eLabel = 'Goblin';
    for (let i = 0; i < eLabel.length; i++) {
      renderer.setCell(
        ENEMY_HOME_X - 2 + i, ARENA_Y - 2, eLabel[i], ENEMY_FG, FLOOR_BG, 0,
        CELL_FLAGS.VISIBLE, 0.7, 0, 0, LAYERS.OBJECTS
      );
    }

    // VS divider
    renderer.setCell(Math.floor(GRID_W / 2) - 1, ARENA_Y, 'v', COLORS.fgDim, FLOOR_BG, 0, CELL_FLAGS.VISIBLE, 0.4, 0, 0, LAYERS.OBJECTS);
    renderer.setCell(Math.floor(GRID_W / 2), ARENA_Y, 's', COLORS.fgDim, FLOOR_BG, 0, CELL_FLAGS.VISIBLE, 0.4, 0, 0, LAYERS.OBJECTS);

    // Particles and float texts
    drawParticles(renderer, juiceState.particles, GRID_W, GRID_H);
    drawFloatTexts(renderer, juiceState.floatTexts, GRID_W, GRID_H);

    renderer.render();
  }

  function handleSetup(r) {
    renderer = r;
  }

  function handleFrame(r, dt) {
    juiceState = juice.update(dt);

    // Apply screen shake
    r.cameraOffsetX = juiceState.shakeX;
    r.cameraOffsetY = juiceState.shakeY;

    drawScene();
  }
</script>

<div class="section">
  <div class="card">
    <h2>Juiciness Lab</h2>

    <div class="canvas-wrap">
      <SceneCanvas
        gridWidth={GRID_W}
        gridHeight={GRID_H}
        cellSize={CELL_SIZE}
        onSetup={handleSetup}
        onFrame={handleFrame}
      />
    </div>

    <!-- Trigger buttons -->
    <div class="controls">
      <div class="controls-row">
        <button class="btn btn-hit" on:click={triggerHit}>Hit</button>
        <button class="btn btn-secondary" on:click={triggerBump}>Bump</button>
        <button class="btn btn-secondary" on:click={triggerShake}>Shake</button>
        <button class="btn btn-secondary" on:click={triggerSquash}>Squash</button>
        <button class="btn btn-secondary" on:click={triggerParticles}>Particles</button>
        <button class="btn btn-secondary" on:click={triggerFlash}>Flash</button>
        <button class="btn btn-all" on:click={triggerAll}>All</button>
      </div>
    </div>

    <!-- Parameter sliders -->
    <div class="params-grid">
      <div class="param-group">
        <h3 class="group-title global-title">Global</h3>
        <ParamSlider label="Intensity" min={0} max={2} step={0.05} value={intensity}
          on:change={e => intensity = e.detail} />
        <ParamSlider label="Speed" min={0.25} max={3} step={0.05} value={masterSpeed}
          on:change={e => masterSpeed = e.detail} />
      </div>

      <div class="param-group">
        <h3 class="group-title">Hitstop</h3>
        <ParamSlider label="Duration (ms)" min={0} max={200} step={5} value={hitstopDuration}
          on:change={e => hitstopDuration = e.detail} />
      </div>

      <div class="param-group">
        <h3 class="group-title">Shake</h3>
        <ParamSlider label="Amplitude" min={0} max={5} step={0.1} value={shakeAmplitude}
          on:change={e => shakeAmplitude = e.detail} />
        <ParamSlider label="Decay" min={5} max={25} step={1} value={shakeDecay}
          on:change={e => shakeDecay = e.detail} />
        <ParamSlider label="Frequency" min={20} max={60} step={1} value={shakeFrequency}
          on:change={e => shakeFrequency = e.detail} />
      </div>

      <div class="param-group">
        <h3 class="group-title">Bump</h3>
        <ParamSlider label="Distance" min={0.1} max={1} step={0.05} value={bumpDistance}
          on:change={e => bumpDistance = e.detail} />
        <ParamSlider label="Duration (ms)" min={50} max={200} step={5} value={bumpDuration}
          on:change={e => bumpDuration = e.detail} />
      </div>

      <div class="param-group">
        <h3 class="group-title">Squash</h3>
        <ParamSlider label="Amount" min={0.05} max={0.5} step={0.01} value={squashAmount}
          on:change={e => squashAmount = e.detail} />
        <ParamSlider label="Duration (ms)" min={50} max={200} step={5} value={squashDuration}
          on:change={e => squashDuration = e.detail} />
      </div>

      <div class="param-group">
        <h3 class="group-title">Particles</h3>
        <ParamSlider label="Count" min={2} max={20} step={1} value={particleCount}
          on:change={e => particleCount = e.detail} />
        <ParamSlider label="Speed" min={1} max={10} step={0.5} value={particleSpeed}
          on:change={e => particleSpeed = e.detail} />
        <ParamSlider label="Spread" min={0.2} max={1} step={0.05} value={particleSpread}
          on:change={e => particleSpread = e.detail} />
        <ParamSlider label="Gravity" min={0} max={10} step={0.5} value={particleGravity}
          on:change={e => particleGravity = e.detail} />
        <ParamSlider label="Life (s)" min={0.1} max={1} step={0.05} value={particleLife}
          on:change={e => particleLife = e.detail} />
      </div>

      <div class="param-group">
        <h3 class="group-title">Flash</h3>
        <ParamSlider label="Frames" min={1} max={6} step={1} value={flashFrames}
          on:change={e => flashFrames = e.detail} />
      </div>

      <div class="param-group">
        <h3 class="group-title">Vignette</h3>
        <ParamSlider label="Intensity" min={0} max={0.8} step={0.05} value={vignetteIntensity}
          on:change={e => vignetteIntensity = e.detail} />
        <ParamSlider label="Duration (ms)" min={50} max={500} step={10} value={vignetteDuration}
          on:change={e => vignetteDuration = e.detail} />
      </div>
    </div>

    <!-- Event log -->
    <div class="log-wrap">
      <h3 class="log-title">Event Log</h3>
      <div class="log">
        {#each eventLog as entry}
          <div class="log-entry">{entry}</div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .card h2 { margin-bottom: var(--space-md); }

  .canvas-wrap {
    width: 100%;
    height: 320px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: #000;
  }

  .controls {
    margin-top: var(--space-md);
  }
  .controls-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .btn {
    background: var(--bg-accent);
    color: var(--fg-muted);
    border: none;
    border-radius: var(--radius-sm);
    padding: 6px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }
  .btn:hover { opacity: 0.85; }
  .btn-hit {
    background: var(--accent-red);
    color: #000;
  }
  .btn-all {
    background: var(--accent-amber);
    color: #000;
  }
  .btn-secondary {
    background: var(--bg-accent);
    color: var(--fg-muted);
    border: 1px solid var(--border-muted);
  }

  .params-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-sm);
    margin-top: var(--space-md);
  }

  .param-group {
    background: var(--bg-muted);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
  }
  .group-title {
    color: var(--fg-muted);
    font-size: 11px;
    font-weight: 600;
    margin: 0 0 var(--space-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .global-title { color: var(--accent); }

  .log-wrap {
    margin-top: var(--space-md);
  }
  .log-title {
    color: var(--fg-dim);
    font-size: 11px;
    font-weight: 600;
    margin: 0 0 var(--space-xs);
    text-transform: uppercase;
  }
  .log {
    background: var(--bg);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
    height: 120px;
    overflow-y: auto;
    font-size: 11px;
    color: var(--fg-dim);
  }
  .log-entry {
    padding: 1px 0;
    border-bottom: 1px solid var(--border-muted);
  }
  .log-entry:last-child { border-bottom: none; }

  @media (max-width: 900px) {
    .params-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
