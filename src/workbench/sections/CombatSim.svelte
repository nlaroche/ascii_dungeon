<script>
  import { LAYERS, CELL_FLAGS } from '../../renderer/Renderer.js';
  import { createPlayer } from '../../lib/player.js';
  import { resolveCombat } from '../../lib/combat.js';
  import { createJuiceEngine } from '../../lib/juice.js';
  import { createRng } from '../../lib/rng.js';
  import SceneCanvas from '../helpers/SceneCanvas.svelte';
  import { drawArena } from '../helpers/drawArena.js';
  import { drawParticles, drawFloatTexts } from '../helpers/drawJuice.js';
  import ParamSlider from '../components/ParamSlider.svelte';
  import { COLORS } from '../../lib/palette.js';

  // ── Arena ──
  const GRID_W = 80;
  const GRID_H = 40;
  const CELL_SIZE = 16;

  const FLOOR_BG = COLORS.floorBg;
  const PLAYER_FG = COLORS.player;
  const ENEMY_FG = COLORS.damage;
  const FLASH_COLOR = COLORS.flash;

  // ── Phases (tick-based simultaneous combat) ──
  const PHASE = {
    IDLE: 'idle',
    CLASH: 'clash',
    HIT_FREEZE: 'hit_freeze',
    IMPACT: 'impact',
    KNOCKBACK: 'knockback',
    RECOVER: 'recover',
    TICK_WAIT: 'tick_wait',
    DONE: 'done',
  };

  // ── State ──
  let renderer = null;
  let phase = PHASE.IDLE;
  let phaseTime = 0;

  // Positions — truly adjacent, no gap
  const ARENA_Y = Math.floor(GRID_H / 2);
  const CENTER = Math.floor(GRID_W / 2);
  const PLAYER_HOME = CENTER;      // @ stands at center
  const ENEMY_HOME = CENTER + 1;   // G stands directly right of @

  let playerX = PLAYER_HOME;
  let enemyX = ENEMY_HOME;

  // Combatant data
  let player = createPlayer({ name: 'Hero', hp: 100, maxHp: 100, attack: 12, defense: 5 });
  let enemy = createPlayer({ name: 'Goblin', hp: 80, maxHp: 80, attack: 8, defense: 3 });

  // Juice engine + combat RNG
  const juice = createJuiceEngine();
  let combatRng = createRng(Date.now());
  let juiceState = { frozen: false, shakeX: 0, shakeY: 0, vignette: 0, particles: [], floatTexts: [], entityOverrides: {} };

  // Controls
  let playerAttack = 12;
  let playerDefense = 5;
  let enemyAttack = 8;
  let enemyDefense = 3;
  let tickSpeed = 800;
  let combatLog = [];

  // Phase durations (seconds)
  const CLASH_DURATION = 0.06;
  const KNOCKBACK_DURATION = 0.10;
  const RECOVER_DURATION = 0.15;
  let hitFreezeDuration = 0.08;
  let impactDuration = 0.10;

  // Per-tick results
  let lastPlayerDmg = 0;
  let lastEnemyDmg = 0;

  let playerDead = false;
  let enemyDead = false;

  function addLog(msg) {
    combatLog = [...combatLog, msg];
    if (combatLog.length > 50) combatLog = combatLog.slice(-50);
  }

  function resetState() {
    phase = PHASE.IDLE;
    phaseTime = 0;
    playerX = PLAYER_HOME;
    enemyX = ENEMY_HOME;
    juice.reset();
    juiceState = { frozen: false, shakeX: 0, shakeY: 0, vignette: 0, particles: [], floatTexts: [], entityOverrides: {} };
    playerDead = false;
    enemyDead = false;
    combatLog = [];
    lastPlayerDmg = 0;
    lastEnemyDmg = 0;
    combatRng = createRng(Date.now());
    player = createPlayer({ name: 'Hero', hp: 100, maxHp: 100, attack: playerAttack, defense: playerDefense });
    enemy = createPlayer({ name: 'Goblin', hp: 80, maxHp: 80, attack: enemyAttack, defense: enemyDefense });
  }

  function startFight() {
    if (phase !== PHASE.IDLE && phase !== PHASE.DONE) return;
    resetState();
    addLog('Fight begins!');
    startTick();
  }

  function startTick() {
    // Both attack simultaneously (with ±20% variance)
    const result = resolveCombat(player, enemy, combatRng);
    lastEnemyDmg = result.defenderDamage;
    lastPlayerDmg = result.attackerDamage;

    enemy = { ...enemy, hp: result.defenderHp };
    if (lastPlayerDmg > 0) {
      player = { ...player, hp: player.hp - lastPlayerDmg };
    }

    addLog(`Hero hits for ${lastEnemyDmg}! Goblin counters for ${lastPlayerDmg}!`);

    phase = PHASE.CLASH;
    phaseTime = 0;
  }

  function updatePhase(dt) {
    phaseTime += dt;

    switch (phase) {
      case PHASE.CLASH: {
        const t = Math.min(1, phaseTime / CLASH_DURATION);
        // Both lunge toward each other — they're adjacent so lunge is small
        const lunge = t * 0.4;
        playerX = PLAYER_HOME + lunge;
        enemyX = ENEMY_HOME - lunge;

        if (t >= 1) {
          juice.flash('player', FLASH_COLOR, 3);
          juice.flash('enemy', FLASH_COLOR, 3);
          const totalDmg = lastPlayerDmg + lastEnemyDmg;
          hitFreezeDuration = 0.05 + Math.min(0.06, totalDmg * 0.002);
          phase = PHASE.HIT_FREEZE;
          phaseTime = 0;
        }
        break;
      }

      case PHASE.HIT_FREEZE: {
        if (phaseTime >= hitFreezeDuration) {
          const totalDmg = lastPlayerDmg + lastEnemyDmg;

          // Bright impact flash particles at collision point
          juice.particles((playerX + enemyX) / 2, ARENA_Y, {
            count: 4, speed: 3, spread: Math.PI * 2, gravity: 2, life: 0.3,
            color: '#ffffff', chars: ['*', '+'],
          });

          // ── Damage numbers ──
          // Color = who dealt the hit. Position = who got hit.
          // Player's hit on enemy: player color (lime), flies out of enemy
          {
            const isCrit = lastEnemyDmg > Math.max(1, player.attack - 5) * 1.1;
            const scaleStart = isCrit ? 3.0 : 2.2;

            juice.floatText(enemyX, ARENA_Y - 1, `${lastEnemyDmg}`, {
              color: PLAYER_FG,
              colorEnd: isCrit ? COLORS.fg : COLORS.accentGreen,
              outline: true, outlineColor: COLORS.black,
              damageFx: true,
              scaleStart, scale: 1.0,
              vx: combatRng.float(0.3, 1.2),
              vy: combatRng.float(-5, -3),
              gravity: 10, bounce: 0.3, groundY: ARENA_Y + 2,
              life: 1.5,
            });

            juice.particles(enemyX, ARENA_Y, {
              count: 6 + Math.min(12, lastEnemyDmg),
              speed: 6, spread: 0.7 * Math.PI, gravity: 8, life: 0.6,
              color: PLAYER_FG, angle: 0,
              chars: ['*', '+', '.', ',', '\''],
            });
          }

          // Enemy's hit on player: enemy color (red), flies out of player
          if (lastPlayerDmg > 0) {
            const pIsCrit = lastPlayerDmg > Math.max(1, (enemy.attack || 0) - (player.defense || 0)) * 1.1;
            const pScaleStart = pIsCrit ? 3.0 : 2.2;

            juice.floatText(playerX, ARENA_Y - 1, `${lastPlayerDmg}`, {
              color: ENEMY_FG,
              colorEnd: pIsCrit ? COLORS.fg : COLORS.accentRed,
              outline: true, outlineColor: COLORS.black,
              damageFx: true,
              scaleStart: pScaleStart, scale: 1.0,
              vx: combatRng.float(-1.2, -0.3),
              vy: combatRng.float(-5, -3),
              gravity: 10, bounce: 0.3, groundY: ARENA_Y + 2,
              life: 1.5,
            });

            juice.particles(playerX, ARENA_Y, {
              count: 6 + Math.min(12, lastPlayerDmg),
              speed: 5, spread: 0.7 * Math.PI, gravity: 8, life: 0.6,
              color: ENEMY_FG, angle: Math.PI,
              chars: ['*', '+', '.', ',', '\''],
            });
          }

          // Bump both characters apart on hit
          juice.bump('player', -1, 0, { distance: 0.3, duration: 150 });
          juice.bump('enemy', 1, 0, { distance: 0.3, duration: 150 });

          // Squash on impact (horizontal compression = hit feel)
          juice.squash('player', 'x', 0.3, { duration: 120 });
          juice.squash('enemy', 'x', 0.3, { duration: 120 });

          // Hitstop — brief freeze for impact weight
          juice.hitstop(60 + Math.min(40, totalDmg * 3));

          // Screen shake proportional to damage
          juice.shake(Math.min(4, totalDmg / 6), { decay: 12, frequency: 35 });

          phase = PHASE.IMPACT;
          phaseTime = 0;
          impactDuration = 0.12;
        }
        break;
      }

      case PHASE.IMPACT: {
        if (phaseTime >= impactDuration) {
          phase = PHASE.KNOCKBACK;
          phaseTime = 0;
        }
        break;
      }

      case PHASE.KNOCKBACK: {
        const t = Math.min(1, phaseTime / KNOCKBACK_DURATION);
        const ease = 1 - (1 - t) * (1 - t);
        playerX = PLAYER_HOME + 0.4 * (1 - ease);
        enemyX = ENEMY_HOME - 0.4 * (1 - ease);

        if (t >= 1) {
          playerX = PLAYER_HOME;
          enemyX = ENEMY_HOME;
          phase = PHASE.RECOVER;
          phaseTime = 0;
        }
        break;
      }

      case PHASE.RECOVER: {
        if (phaseTime >= RECOVER_DURATION) {
          if (enemy.hp <= 0) {
            enemyDead = true;
            addLog(`${enemy.name} is defeated!`);
            juice.particles(enemyX, ARENA_Y, {
              count: 24, speed: 6, spread: Math.PI * 2, gravity: 4, life: 1.0,
              color: COLORS.damage, chars: ['%', '*', '#', '!', '~', '+', '^', '.', '@'],
            });
            juice.shake(5, { decay: 8, frequency: 30 });
            juice.hitstop(120);
            juice.vignettePulse(0.6, 400);
            juice.floatText(enemyX - 1, ARENA_Y - 3, 'KO!', {
              color: '#ff4444', colorEnd: '#ff8800',
              outline: true, outlineColor: '#881111',
              damageFx: true,
              scaleStart: 2.5, scale: 1.2,
              vy: -2, gravity: 3, life: 2.0,
            });
            phase = PHASE.DONE;
            return;
          }
          if (player.hp <= 0) {
            playerDead = true;
            addLog(`${player.name} is defeated!`);
            juice.particles(playerX, ARENA_Y, {
              count: 24, speed: 6, spread: Math.PI * 2, gravity: 4, life: 1.0,
              color: COLORS.damage, chars: ['%', '*', '#', '!', '~', '+', '^', '.', '@'],
            });
            juice.shake(5, { decay: 8, frequency: 30 });
            juice.hitstop(120);
            juice.vignettePulse(0.6, 400);
            juice.floatText(playerX - 1, ARENA_Y - 3, 'KO!', {
              color: '#ff4444', colorEnd: '#ff8800',
              outline: true, outlineColor: '#881111',
              damageFx: true,
              scaleStart: 2.5, scale: 1.2,
              vy: -2, gravity: 3, life: 2.0,
            });
            phase = PHASE.DONE;
            return;
          }
          phase = PHASE.TICK_WAIT;
          phaseTime = 0;
        }
        break;
      }

      case PHASE.TICK_WAIT: {
        if (phaseTime >= tickSpeed / 1000) {
          startTick();
        }
        break;
      }
    }
  }

  function drawScene() {
    if (!renderer) return;
    renderer.clearGrid();

    drawArena(renderer, GRID_W, GRID_H, {
      time: renderer.time,
      ambient: [0.3, 0.25, 0.2],
      torches: [
        { x: CENTER - 5, y: ARENA_Y - 3 },
        { x: CENTER + 6, y: ARENA_Y - 3 },
        { x: CENTER - 5, y: ARENA_Y + 3 },
        { x: CENTER + 6, y: ARENA_Y + 3 },
      ],
      playerLight: { x: CENTER, y: ARENA_Y },
      torchIntensity: 1.5,
    });

    // Player — apply bump/squash/flash overrides
    const playerOvr = juiceState.entityOverrides['player'] || {};
    if (!playerDead) {
      const bx = playerX + (playerOvr.offsetX || 0);
      const by = ARENA_Y + (playerOvr.offsetY || 0);
      const px = Math.floor(bx);
      const fg = playerOvr.flashColor || PLAYER_FG;
      const sx = playerOvr.scaleX || 1.0;
      const sy = playerOvr.scaleY || 1.0;
      renderer.setCell(
        px, Math.floor(by), '@', fg, FLOOR_BG, 0.5,
        CELL_FLAGS.VISIBLE, 1.0, bx - px, by - Math.floor(by), LAYERS.PLAYER, sx, sy
      );
    } else {
      renderer.setCell(
        PLAYER_HOME, ARENA_Y, '%', COLORS.fgDim, FLOOR_BG, 0,
        CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.PLAYER
      );
    }

    // Enemy — apply bump/squash/flash overrides
    const enemyOvr = juiceState.entityOverrides['enemy'] || {};
    if (!enemyDead) {
      const bx = enemyX + (enemyOvr.offsetX || 0);
      const by = ARENA_Y + (enemyOvr.offsetY || 0);
      const ex = Math.floor(bx);
      const fg = enemyOvr.flashColor || ENEMY_FG;
      const sx = enemyOvr.scaleX || 1.0;
      const sy = enemyOvr.scaleY || 1.0;
      renderer.setCell(
        ex, Math.floor(by), 'G', fg, FLOOR_BG, 0.5,
        CELL_FLAGS.VISIBLE, 1.0, bx - ex, by - Math.floor(by), LAYERS.PLAYER, sx, sy
      );
    } else {
      renderer.setCell(
        ENEMY_HOME, ARENA_Y, '%', COLORS.fgDim, FLOOR_BG, 0,
        CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.PLAYER
      );
    }

    // Juice effects
    drawParticles(renderer, juiceState.particles, GRID_W, GRID_H);
    drawFloatTexts(renderer, juiceState.floatTexts, GRID_W, GRID_H);


    renderer.render();
  }

  function handleSetup(r) { renderer = r; }
  function handleFrame(r, dt) {
    if (!renderer) return;
    // Phase logic first — creates particles/floatTexts
    updatePhase(dt);
    // Juice update AFTER phase logic — so newly created effects are in the snapshot
    juiceState = juice.update(dt);
    renderer.cameraOffsetX = juiceState.shakeX;
    renderer.cameraOffsetY = juiceState.shakeY;
    renderer.vignettePulse = juiceState.vignette;
    drawScene();
  }
  function handleReset() { resetState(); }

  // HP bar helpers for template
  $: playerHpPct = Math.max(0, player.hp / player.maxHp * 100);
  $: enemyHpPct = Math.max(0, enemy.hp / enemy.maxHp * 100);
  $: playerHpColor = playerHpPct > 60 ? 'var(--accent-green)' : playerHpPct > 30 ? 'var(--accent-amber)' : 'var(--accent-red)';
  $: enemyHpColor = enemyHpPct > 60 ? 'var(--accent-green)' : enemyHpPct > 30 ? 'var(--accent-amber)' : 'var(--accent-red)';

  $: if (phase === PHASE.IDLE || phase === PHASE.DONE) {
    player = { ...player, attack: playerAttack, defense: playerDefense };
    enemy = { ...enemy, attack: enemyAttack, defense: enemyDefense };
  }
</script>

<div class="section">
  <div class="viewport">
    <SceneCanvas
      gridWidth={GRID_W}
      gridHeight={GRID_H}
      cellSize={CELL_SIZE}
      onSetup={handleSetup}
      onFrame={handleFrame}
    />

    <!-- HP bars at top -->
    <div class="hp-bar-row">
      <div class="hp-group">
        <span class="hp-name player-name">Hero</span>
        <div class="hp-bar-track">
          <div class="hp-bar-fill" style="width: {playerHpPct}%; background: {playerHpColor}"></div>
        </div>
        <span class="hp-text">{Math.max(0, player.hp)}/{player.maxHp}</span>
      </div>

      <span class="vs">vs</span>

      <div class="hp-group">
        <span class="hp-name enemy-name">Goblin</span>
        <div class="hp-bar-track">
          <div class="hp-bar-fill" style="width: {enemyHpPct}%; background: {enemyHpColor}"></div>
        </div>
        <span class="hp-text">{Math.max(0, enemy.hp)}/{enemy.maxHp}</span>
      </div>
    </div>

    <!-- Controls panel -->
    <div class="controls-panel">
      <h3>Combat Sim</h3>
      <div class="btn-row">
        <button class="btn" on:click={startFight} disabled={phase !== PHASE.IDLE && phase !== PHASE.DONE}>Fight</button>
        <button class="btn btn-secondary" on:click={handleReset}>Reset</button>
        <span class="phase-badge">{phase.replace('_', ' ')}</span>
      </div>

      <div class="stat-section">
        <h4 class="stat-label player-name">Hero</h4>
        <ParamSlider label="ATK" min={1} max={30} step={1} value={playerAttack}
          on:change={e => playerAttack = e.detail} />
        <ParamSlider label="DEF" min={0} max={20} step={1} value={playerDefense}
          on:change={e => playerDefense = e.detail} />
      </div>

      <div class="stat-section">
        <h4 class="stat-label enemy-name">Goblin</h4>
        <ParamSlider label="ATK" min={1} max={30} step={1} value={enemyAttack}
          on:change={e => enemyAttack = e.detail} />
        <ParamSlider label="DEF" min={0} max={20} step={1} value={enemyDefense}
          on:change={e => enemyDefense = e.detail} />
      </div>

      <ParamSlider label="Tick Speed" min={200} max={1500} step={50} value={tickSpeed}
        on:change={e => tickSpeed = e.detail} />

      <div class="log">
        {#each combatLog as entry}
          <div class="log-entry">{entry}</div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .viewport {
    flex: 1;
    position: relative;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    min-height: 0;
  }

  /* ── HP bar row ── */
  .hp-bar-row {
    position: absolute;
    top: 10px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10;
    pointer-events: none;
    background: rgba(9, 9, 11, 0.7);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-muted);
  }
  .hp-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .vs {
    font-size: 10px;
    color: var(--fg-dim);
    font-family: var(--font-mono);
    text-transform: uppercase;
  }
  .hp-name {
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-mono);
    min-width: 50px;
  }
  .player-name { color: var(--accent-green); }
  .enemy-name { color: var(--accent-red); }
  .hp-bar-track {
    width: 120px;
    height: 8px;
    background: var(--bg-muted);
    border: 1px solid var(--border-muted);
    border-radius: 3px;
    overflow: hidden;
  }
  .hp-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.15s ease-out;
  }
  .hp-text {
    font-size: 11px;
    color: var(--fg-dim);
    font-family: var(--font-mono);
    min-width: 55px;
  }

  /* ── Controls panel ── */
  .controls-panel {
    position: absolute;
    top: 48px;
    right: 12px;
    width: 220px;
    background: rgba(9, 9, 11, 0.88);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    z-index: 10;
    max-height: calc(100% - 60px);
    overflow-y: auto;
  }
  .controls-panel h3 {
    color: var(--accent-amber);
    margin: 0 0 8px 0;
    font-size: 14px;
  }

  .btn-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }
  .btn {
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: var(--radius-sm);
    padding: 4px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn:hover { opacity: 0.85; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    background: var(--bg-accent);
    color: var(--fg-muted);
  }
  .phase-badge {
    font-size: 9px;
    color: var(--fg-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-left: auto;
  }

  .stat-section {
    margin-bottom: 6px;
  }
  .stat-label {
    font-size: 11px;
    font-weight: 600;
    margin: 0 0 2px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .log {
    margin-top: 8px;
    background: var(--bg);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
    padding: 6px;
    height: 100px;
    overflow-y: auto;
    font-size: 10px;
    color: var(--fg-dim);
  }
  .log-entry {
    padding: 1px 0;
    border-bottom: 1px solid var(--border-muted);
  }
  .log-entry:last-child { border-bottom: none; }
</style>
