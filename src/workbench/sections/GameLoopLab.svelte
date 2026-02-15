<script>
  import { fade, fly } from 'svelte/transition';
  import ParamSlider from '../components/ParamSlider.svelte';
  import StatBar from '../components/StatBar.svelte';
  
  // Imports from lib modules
  import {
    createRun, advanceFloor, completeFloor, endRun, setPhase,
    getFloorDifficulty, getDungeonConfig,
    getRunSummary, getRunGrade,
    createCalendar, recordRun, getWeekSummary, getCurrentTimeOfDay,
    getStaminaCost, hasStamina, spendStamina, restoreStamina,
  } from '../../lib/run.js';
  
  import {
    createTown, refreshVendor,
    addToStash, removeFromStash, sortStash,
    equipItem, unequipItem,
    buyItem, sellItem, getItemPrice, getItemBuyPrice,
    restAtInn, getRestCost,
    getUpgradeCost, purchaseUpgrade, getUpgradeEffects,
    processLootBag,
  } from '../../lib/town.js';
  
  import { createPlayer, applyDamage, healPlayer, addGold, addXp } from '../../lib/player.js';
  import { createItem, getItemDisplayName, getItemColor, getTotalLevel } from '../../lib/items.js';

  // State
  let player = createPlayer();
  let run = null;
  let town = createTown();
  let calendar = createCalendar();
  let eventLog = [];
  let phase = 'town';
  let playerLevel = 1;
  let difficulty = 1.0;
  let autoRunning = false;
  let endReason = 'cleared';

  const END_REASONS = ['death', 'cleared', 'retired'];

  // Helper functions
  function addLogEntry(msg, type = 'info') {
    eventLog = [{ message: msg, type, time: Date.now() }, ...eventLog].slice(0, 30);
  }

  function resetAll() {
    autoRunning = false;
    player = createPlayer();
    run = null;
    town = createTown();
    calendar = createCalendar();
    phase = 'town';
    eventLog = [];
    addLogEntry('All state reset', 'phase');
  }

  // Phase transitions
  function startRun() {
    player = { ...player, level: playerLevel };
    run = createRun(calendar.currentDay, player, { maxFloors: 5, difficulty: difficulty });
    town = refreshVendor(town, playerLevel, calendar.currentDay);
    phase = 'dungeon';
    addLogEntry(`Started run on Day ${calendar.currentDay}, Floor 1`, 'phase');
  }

  function simulateFloor() {
    const enemies = 2 + Math.floor(Math.random() * 5);
    const gold = enemies * (10 + Math.floor(Math.random() * 20));
    const xp = enemies * (15 + Math.floor(Math.random() * 10));
    const foundItem = Math.random() < 0.3;
    
    const floorResult = {
      floor: run.floor,
      enemiesKilled: enemies,
      goldFound: gold,
      xpGained: xp,
      itemsFound: foundItem ? [createItem(['weapon', 'armor', 'amulet'][Math.floor(Math.random() * 3)], run.floor)] : [],
      staminaSpent: 10 + Math.floor(Math.random() * 20),
      playerHpAfter: player.hp - Math.floor(Math.random() * 20),
      events: [`Defeated ${enemies} enemies`, `Found ${gold} gold`],
    };
    
    player = addGold(player, gold);
    player = addXp(player, xp);
    
    run = completeFloor(run, floorResult);
    phase = 'floor_complete';
    
    addLogEntry(`Floor ${run.floor} complete: ${enemies} enemies, ${gold} gold`, 'loot');
  }

  function nextFloor() {
    const advanced = advanceFloor(run);
    if (advanced) {
      run = advanced;
      phase = 'dungeon';
      addLogEntry(`Advanced to Floor ${run.floor}`, 'phase');
    }
  }

  function endCurrentRun(reason) {
    run = endRun(run, reason);
    const summary = getRunSummary(run);
    calendar = recordRun(calendar, summary);
    phase = 'run_complete';
    addLogEntry(`Run ended: ${reason} at floor ${run.floor}`, 'phase');
  }

  function returnToTown() {
    const { town: processedTown, added } = processLootBag(town, run.lootBag);
    town = processedTown;
    player = { ...run.startingPlayer, gold: player.gold, xp: player.xp, level: player.level };
    phase = 'town';
    addLogEntry(`Returned to town on Day ${calendar.currentDay}`, 'phase');
  }

  // Stamina actions during dungeon
  function performAction(action) {
    if (!hasStamina(player, action)) {
      addLogEntry('Not enough stamina!', 'damage');
      return;
    }
    
    player = spendStamina(player, action);
    const cost = getStaminaCost(action);
    
    if (action === 'rest') {
      player = restoreStamina(player, 5);
      addLogEntry('Rested (+5 stamina)', 'heal');
    } else if (action === 'move') {
      addLogEntry(`Moved (-${cost} stamina)`, 'info');
    } else if (action === 'attack') {
      addLogEntry(`Attacked (-${cost} stamina)`, 'damage');
    } else if (action === 'explore') {
      addLogEntry(`Explored (-${cost} stamina)`, 'info');
    }
  }

  // Auto run - continuous loop using setTimeout chains
  function autoRun() {
    if (phase !== 'town') {
      addLogEntry('Must be in town to start auto run', 'damage');
      return;
    }
    
    autoRunning = true;
    addLogEntry('Auto-run started — looping town ↔ dungeon', 'phase');
    autoStep();
  }

  function autoStep() {
    if (!autoRunning) return;

    if (phase === 'town') {
      startRun();
      setTimeout(autoStep, 400);
    } else if (phase === 'dungeon') {
      simulateFloor();
      setTimeout(autoStep, 400);
    } else if (phase === 'floor_complete') {
      if (run.floor < run.maxFloors) {
        nextFloor();
      } else {
        endCurrentRun('cleared');
      }
      setTimeout(autoStep, 400);
    } else if (phase === 'run_complete') {
      returnToTown();
      setTimeout(autoStep, 1000); // pause in town
    }
  }

  function stopAutoRun() {
    autoRunning = false;
    addLogEntry('Auto-run stopped', 'info');
  }

  // Town actions
  function buyFromVendor(index) {
    const result = buyItem(town, player, index);
    if (result.success) {
      town = result.town;
      player = result.player;
      addLogEntry(result.message, 'loot');
    } else {
      addLogEntry(result.message, 'damage');
    }
  }

  function sellToVendor(index) {
    const result = sellItem(town, player, index);
    if (result.success) {
      town = result.town;
      player = result.player;
      addLogEntry(result.message, 'loot');
    }
  }

  function restAtInnAction() {
    const result = restAtInn(town, player);
    if (result.success) {
      player = result.player;
      addLogEntry(result.message, 'heal');
    } else {
      addLogEntry(result.message, 'damage');
    }
  }

  function buyUpgrade(type) {
    const result = purchaseUpgrade(town, player, type);
    if (result.success) {
      town = result.town;
      player = result.player;
      addLogEntry(result.message, 'loot');
    } else {
      addLogEntry(result.message, 'damage');
    }
  }

  // Computed values
  $: difficultyInfo = run ? getFloorDifficulty(run.floor, run.day) : null;
  $: dungeonConfig = run ? getDungeonConfig(run.floor, run.day) : null;
  $: runSummary = run && run.outcome ? getRunSummary(run) : null;
  $: runGrade = run && run.outcome ? getRunGrade(run) : null;
  $: weekInfo = getWeekSummary(calendar);
  $: timeOfDay = getCurrentTimeOfDay(calendar.currentDay);
  $: restCost = getRestCost(town);
  $: upgradeEffects = getUpgradeEffects(town);

  // Phase colors
  const phaseColors = {
    town: 'var(--accent-green)',
    dungeon: 'var(--accent-cyan)',
    floor_complete: 'var(--accent-amber)',
    run_complete: 'var(--accent-red)'
  };

  // Log type colors
  const logColors = {
    loot: 'var(--accent-amber)',
    damage: 'var(--accent-red)',
    heal: 'var(--accent-green)',
    phase: 'var(--accent)',
    info: 'var(--fg-muted)'
  };
</script>

<div class="lab">
  <!-- Header -->
  <header class="lab-header">
    <h2>Game Loop</h2>
    <div class="header-stats">
      <span class="stat-badge">Day {calendar.currentDay}</span>
      <span class="stat-badge">Week {calendar.currentWeek}</span>
      <span class="stat-badge time-{timeOfDay}">{timeOfDay}</span>
    </div>
    <button class="btn-reset" on:click={resetAll}>⟳ Reset All</button>
  </header>

  <div class="lab-content">
    <!-- Left Panel: Phase Diagram + Controls -->
    <aside class="left-panel">
      <div class="phase-diagram">
        <h3>Phase Loop</h3>
        <div class="phase-list">
          <div class="phase-item" class:active={phase === 'town'}>
            <span class="phase-dot" class:pulsing={phase === 'town'} style="background: {phase === 'town' ? phaseColors['town'] : 'var(--border)'}"></span>
            <span class="phase-name">Town</span>
          </div>
          <div class="phase-arrow">→</div>
          <div class="phase-item" class:active={phase === 'dungeon'}>
            <span class="phase-dot" class:pulsing={phase === 'dungeon'} style="background: {phase === 'dungeon' ? phaseColors['dungeon'] : 'var(--border)'}"></span>
            <span class="phase-name">Dungeon</span>
          </div>
          <div class="phase-arrow">→</div>
          <div class="phase-item" class:active={phase === 'floor_complete'}>
            <span class="phase-dot" class:pulsing={phase === 'floor_complete'} style="background: {phase === 'floor_complete' ? phaseColors['floor_complete'] : 'var(--border)'}"></span>
            <span class="phase-name">Floor</span>
          </div>
          <div class="phase-arrow">→</div>
          <div class="phase-item" class:active={phase === 'run_complete'}>
            <span class="phase-dot" class:pulsing={phase === 'run_complete'} style="background: {phase === 'run_complete' ? phaseColors['run_complete'] : 'var(--border)'}"></span>
            <span class="phase-name">Complete</span>
          </div>
          <div class="phase-arrow">→</div>
          <div class="phase-item" class:active={phase === 'town'}>
            <span class="phase-dot" class:pulsing={phase === 'town'} style="background: {phase === 'town' ? phaseColors['town'] : 'var(--border)'}"></span>
            <span class="phase-name">Town</span>
          </div>
        </div>
      </div>

      <div class="controls">
        <h3>Controls</h3>
        
        {#if phase === 'town'}
          <button class="btn-primary" on:click={startRun}>Start Run</button>
          <button class="btn-secondary" on:click={autoRun} disabled={autoRunning}>▶ Auto Run</button>
        {:else if phase === 'dungeon'}
          <button class="btn-primary" on:click={simulateFloor}>Simulate Floor</button>
          <div class="dropdown">
            <select bind:value={endReason}>
              {#each END_REASONS as reason}
                <option value={reason}>{reason}</option>
              {/each}
            </select>
            <button class="btn-danger" on:click={() => endCurrentRun(endReason)}>End Run</button>
          </div>
        {:else if phase === 'floor_complete'}
          {#if run && run.floor < run.maxFloors}
            <button class="btn-primary" on:click={nextFloor}>Next Floor</button>
          {/if}
          <button class="btn-danger" on:click={() => endCurrentRun('cleared')}>End Run</button>
        {:else if phase === 'run_complete'}
          <button class="btn-primary" on:click={returnToTown}>Return to Town</button>
        {/if}

        {#if autoRunning}
          <button class="btn-warning" on:click={stopAutoRun}>⏹ Stop Auto</button>
        {/if}
      </div>

      <div class="params">
        <h3>Params</h3>
        <ParamSlider label="Player Level" bind:value={playerLevel} min={1} max={100} step={1} />
        <ParamSlider label="Difficulty" bind:value={difficulty} min={0.5} max={3} step={0.1} />
      </div>
    </aside>

    <!-- Center Panel: Phase Content -->
    <main class="center-panel">
      {#key phase}
        <div class="phase-content" in:fade={{ duration: 200 }}>
          
          <!-- Dungeon Phase -->
          {#if phase === 'dungeon' && run}
            <div class="dungeon-view">
              <h2 class="floor-title">Floor {run.floor} / {run.maxFloors}</h2>
              
              {#if difficultyInfo}
                <div class="info-cards">
                  <div class="info-card">
                    <div class="info-label">Difficulty</div>
                    <div class="info-value">×{difficultyInfo.enemyHpMult.toFixed(2)} HP</div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Enemies</div>
                    <div class="info-value">{Math.floor(difficultyInfo.enemyCount)}</div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Treasure</div>
                    <div class="info-value">×{difficultyInfo.treasureMult.toFixed(2)}</div>
                  </div>
                </div>
              {/if}

              {#if dungeonConfig}
                <div class="dungeon-info">
                  <span>Grid: {dungeonConfig.width}×{dungeonConfig.height}</span>
                  <span>Rooms: {dungeonConfig.roomCount}</span>
                </div>
              {/if}

              <div class="stamina-section">
                <label>Stamina</label>
                <StatBar current={player.stamina} max={player.maxStamina} color="var(--accent-cyan)" />
              </div>

              <div class="action-buttons">
                <button class="btn-action" on:click={() => performAction('move')}>Move (-1)</button>
                <button class="btn-action" on:click={() => performAction('attack')}>Attack (-2)</button>
                <button class="btn-action" on:click={() => performAction('explore')}>Explore (-3)</button>
                <button class="btn-action btn-heal" on:click={() => performAction('rest')}>Rest (+5)</button>
              </div>
            </div>

          <!-- Floor Complete Phase -->
          {:else if phase === 'floor_complete' && run}
            <div class="floor-complete-view">
              <h2>Floor {run.floor} Complete!</h2>
              
              {#if run.floors.length > 0}
                {@const lastFloor = run.floors[run.floors.length - 1]}
                <div class="result-card">
                  <div class="result-stat">
                    <span class="result-icon">⚔</span>
                    <span class="result-value">{lastFloor.enemiesKilled}</span>
                    <span class="result-label">Enemies</span>
                  </div>
                  <div class="result-stat">
                    <span class="result-icon">💰</span>
                    <span class="result-value">{lastFloor.goldFound}</span>
                    <span class="result-label">Gold</span>
                  </div>
                  <div class="result-stat">
                    <span class="result-icon">✨</span>
                    <span class="result-value">{lastFloor.xpGained}</span>
                    <span class="result-label">XP</span>
                  </div>
                  <div class="result-stat">
                    <span class="result-icon">🎒</span>
                    <span class="result-value">{lastFloor.itemsFound.length}</span>
                    <span class="result-label">Items</span>
                  </div>
                </div>

                {#if lastFloor.itemsFound.length > 0}
                  <div class="loot-bag">
                    <h4>Loot Bag</h4>
                    {#each lastFloor.itemsFound as item}
                      <div class="loot-item" style="color: {getItemColor(item)}">
                        {item.char} {getItemDisplayName(item)}
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>

          <!-- Run Complete Phase -->
          {:else if phase === 'run_complete' && runSummary && runGrade}
            <div class="run-complete-view">
              <h2>Run Complete</h2>
              
              <div class="grade-display grade-{runGrade}">
                {runGrade}
              </div>

              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">Floors</span>
                  <span class="summary-value">{runSummary.floorsCleared}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Enemies</span>
                  <span class="summary-value">{runSummary.enemiesKilled}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Gold</span>
                  <span class="summary-value">{runSummary.totalGold}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">XP</span>
                  <span class="summary-value">{runSummary.totalXp}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Items</span>
                  <span class="summary-value">{runSummary.itemsFound}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Duration</span>
                  <span class="summary-value">{Math.floor(runSummary.duration / 1000)}s</span>
                </div>
              </div>

              {#if calendar.history.length > 0}
                <div class="run-history">
                  <h4>Recent Runs</h4>
                  {#each calendar.history.slice(-5).reverse() as historyRun, i}
                    <div class="history-item">
                      <span>Day {historyRun.day}: {historyRun.floorsCleared} floors</span>
                      <span class="history-grade grade-{getRunGrade({...run, outcome: {reason: 'cleared', floor: historyRun.floorsCleared, finalStats: {}}})}">
                        {getRunGrade({...run, outcome: {reason: 'cleared', floor: historyRun.floorsCleared, finalStats: {}}})}
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

          <!-- Town Phase -->
          {:else if phase === 'town'}
            <div class="town-view">
              <div class="town-welcome">
                <h2>Day {calendar.currentDay} — Welcome Back</h2>
                <div class="town-gold">
                  <span class="gold-icon">💰</span>
                  <span class="gold-amount">{player.gold}g</span>
                </div>
              </div>
              
              <div class="town-cards">
                <!-- Vendor -->
                <div class="town-card">
                  <h3>Vendor</h3>
                  <div class="vendor-list">
                    {#each town.vendor.items as item, i}
                      <div class="vendor-item">
                        <span style="color: {getItemColor(item)}">{item.char}</span>
                        <span class="item-name">{getItemDisplayName(item)}</span>
                        <span class="item-price">{getItemBuyPrice(item)}g</span>
                        <button class="btn-small" on:click={() => buyFromVendor(i)}>Buy</button>
                      </div>
                    {/each}
                    {#if town.vendor.items.length === 0}
                      <div class="empty-message">Vendor empty</div>
                    {/if}
                  </div>
                </div>

                <!-- Stash -->
                <div class="town-card">
                  <h3>Stash ({town.stash.length}/{upgradeEffects.stashCapacity})</h3>
                  <div class="stash-list">
                    {#each town.stash as item, i}
                      <div class="stash-item">
                        <span style="color: {getItemColor(item)}">{item.char}</span>
                        <span class="item-name">{getItemDisplayName(item)}</span>
                        <span class="item-level">Lv{getTotalLevel(item)}</span>
                        <button class="btn-small" on:click={() => sellToVendor(i)}>{getItemPrice(item)}g</button>
                      </div>
                    {/each}
                    {#if town.stash.length === 0}
                      <div class="empty-message">Stash empty</div>
                    {/if}
                  </div>
                </div>

                <!-- Inn -->
                <div class="town-card">
                  <h3>Inn</h3>
                  <div class="inn-content">
                    <button class="btn-primary" on:click={restAtInnAction}>Rest ({restCost}g)</button>
                    
                    <div class="upgrades">
                      <h4>Upgrades</h4>
                      <div class="upgrade-item">
                        <span>Stash +5</span>
                        <button class="btn-small" on:click={() => buyUpgrade('stashSize')}>
                          {getUpgradeCost('stashSize', town.upgrades.stashSize)}g
                        </button>
                      </div>
                      <div class="upgrade-item">
                        <span>Vendor Quality</span>
                        <button class="btn-small" on:click={() => buyUpgrade('vendorQuality')}>
                          {getUpgradeCost('vendorQuality', town.upgrades.vendorQuality)}g
                        </button>
                      </div>
                      <div class="upgrade-item">
                        <span>Inn Discount</span>
                        <button class="btn-small" on:click={() => buyUpgrade('innDiscount')}>
                          {getUpgradeCost('innDiscount', town.upgrades.innDiscount)}g
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/key}
    </main>

    <!-- Right Panel: Player Status + Stats -->
    <aside class="right-panel">
      <div class="player-status">
        <h3>Player</h3>
        
        <div class="stat-row">
          <label>HP</label>
          <StatBar current={player.hp} max={player.maxHp} color="var(--text-red)" />
          <span class="stat-value">{player.hp}/{player.maxHp}</span>
        </div>
        
        <div class="stat-row">
          <label>Stamina</label>
          <StatBar current={player.stamina} max={player.maxStamina} color="var(--accent-cyan)" />
          <span class="stat-value">{player.stamina}/{player.maxStamina}</span>
        </div>
        
        <div class="stat-row">
          <label>Gold</label>
          <span class="stat-value gold">{player.gold}g</span>
        </div>
        
        <div class="stat-row">
          <label>Level {player.level}</label>
          <StatBar current={player.xp} max={player.xpToNext} color="var(--accent-purple)" />
          <span class="stat-value">{player.xp}/{player.xpToNext} XP</span>
        </div>

        <div class="equipment">
          <h4>Equipment</h4>
          <div class="equip-slot">
            <span class="slot-label">Weapon</span>
            <span class="slot-item">{player.equipment?.weapon?.name || 'None'}</span>
          </div>
          <div class="equip-slot">
            <span class="slot-label">Armor</span>
            <span class="slot-item">{player.equipment?.armor?.name || 'None'}</span>
          </div>
          <div class="equip-slot">
            <span class="slot-label">Amulet</span>
            <span class="slot-item">{player.equipment?.amulet?.name || 'None'}</span>
          </div>
        </div>
      </div>

      {#if run && phase !== 'town'}
        <div class="run-stats">
          <h3>Run Stats</h3>
          <div class="run-stat">
            <span>Floor</span>
            <span>{run.floor}/{run.maxFloors}</span>
          </div>
          <div class="run-stat">
            <span>Enemies</span>
            <span>{run.stats.enemiesKilled}</span>
          </div>
          <div class="run-stat">
            <span>Gold</span>
            <span>{run.stats.goldCollected}</span>
          </div>
          <div class="run-stat">
            <span>Items</span>
            <span>{run.stats.itemsFound}</span>
          </div>
        </div>
      {/if}

      <div class="calendar-panel">
        <h3>Calendar</h3>
        <div class="cal-stat">
          <span>Day</span>
          <span>{calendar.currentDay}</span>
        </div>
        <div class="cal-stat">
          <span>Week</span>
          <span>{calendar.currentWeek}</span>
        </div>
        <div class="cal-stat">
          <span>Runs</span>
          <span>{calendar.runsCompleted}</span>
        </div>
        <div class="cal-stat">
          <span>Best Floor</span>
          <span>{calendar.bestFloor}</span>
        </div>
        <div class="cal-stat">
          <span>Time</span>
          <span class="time-{timeOfDay}">{timeOfDay}</span>
        </div>
      </div>
    </aside>
  </div>

  <!-- Event Log -->
  <footer class="event-log">
    <h4>Event Log</h4>
    <div class="log-entries">
      {#each eventLog as entry, i}
        <div class="log-entry" style="opacity: {1 - (i * 0.03)}; color: {logColors[entry.type] || logColors.info}">
          <span class="log-time">{new Date(entry.time).toLocaleTimeString()}</span>
          <span class="log-message">{entry.message}</span>
        </div>
      {/each}
      {#if eventLog.length === 0}
        <div class="log-entry" style="color: var(--text-muted)">No events yet...</div>
      {/if}
    </div>
  </footer>
</div>

<style>
  .lab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--bg);
    color: var(--fg);
  }

  .lab-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
  }

  .lab-header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .header-stats {
    display: flex;
    gap: var(--space-sm);
    flex: 1;
  }

  .stat-badge {
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg-muted);
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 500;
  }

  .time-dawn { color: var(--accent-amber); }
  .time-morning { color: var(--accent-amber); }
  .time-noon { color: var(--accent-green); }
  .time-afternoon { color: var(--accent); }
  .time-dusk { color: var(--accent-amber); }
  .time-night { color: var(--accent); }

  .btn-reset {
    padding: var(--space-xs) var(--space-md);
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    cursor: pointer;
    font-size: 11px;
  }

  .btn-reset:hover {
    background: var(--bg-accent);
  }

  .lab-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Left Panel */
  .left-panel {
    width: 200px;
    padding: var(--space-md);
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    overflow-y: auto;
  }

  .left-panel h3 {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    margin: 0 0 var(--space-sm) 0;
  }

  .phase-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .phase-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) 0;
  }

  .phase-item.active {
    font-weight: 600;
  }

  .phase-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  .phase-item.active .phase-dot {
    box-shadow: 0 0 8px currentColor;
  }

  .phase-line {
    width: 2px;
    height: 16px;
    background: var(--border);
    margin-left: 4px;
  }

  .phase-name {
    font-size: 11px;
    text-transform: capitalize;
  }

  .phase-arrow {
    color: var(--fg-dim);
    font-size: 10px;
    margin: 2px 0;
  }

  .phase-dot.pulsing {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
    50% { box-shadow: 0 0 8px 2px currentColor; opacity: 0.8; }
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .btn-primary, .btn-secondary, .btn-danger, .btn-warning {
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg);
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  .btn-secondary {
    background: var(--bg-muted);
    border: 1px solid var(--border);
    color: var(--fg);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-accent);
  }

  .btn-danger {
    background: var(--accent-red);
    color: white;
  }

  .btn-warning {
    background: var(--accent-amber);
    color: var(--bg);
  }

  .btn-primary:disabled, .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dropdown {
    display: flex;
    gap: var(--space-xs);
  }

  .dropdown select {
    flex: 1;
    padding: var(--space-sm);
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 11px;
  }

  .params {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  /* Center Panel */
  .center-panel {
    flex: 1;
    padding: var(--space-lg);
    overflow-y: auto;
    background: var(--bg-app);
  }

  .phase-content {
    height: 100%;
  }

  /* Dungeon View */
  .dungeon-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .floor-title {
    font-size: var(--text-2xl);
    text-align: center;
    color: var(--accent-cyan);
    margin: 0;
  }

  .info-cards {
    display: flex;
    gap: var(--space-md);
    justify-content: center;
  }

  .info-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-md);
    text-align: center;
    min-width: 100px;
  }

  .info-label {
    font-size: 10px;
    color: var(--fg-muted);
    margin-bottom: var(--space-xs);
  }

  .info-value {
    font-size: 14px;
    font-weight: 600;
  }

  .dungeon-info {
    display: flex;
    gap: var(--space-lg);
    justify-content: center;
    color: var(--fg-muted);
    font-size: 11px;
  }

  .stamina-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    max-width: 400px;
    margin: 0 auto;
    width: 100%;
  }

  .stamina-section label {
    font-size: 11px;
    color: var(--fg-muted);
  }

  .action-buttons {
    display: flex;
    gap: var(--space-sm);
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-action {
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
  }

  .btn-action:hover {
    background: var(--bg-accent);
    border-color: var(--accent);
  }

  .btn-action.btn-heal:hover {
    border-color: var(--accent-green);
  }

  /* Floor Complete View */
  .floor-complete-view {
    text-align: center;
  }

  .floor-complete-view h2 {
    color: var(--accent-amber);
    margin-bottom: var(--space-lg);
  }

  .result-card {
    display: flex;
    gap: var(--space-lg);
    justify-content: center;
    padding: var(--space-lg);
    background: var(--bg-card);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    max-width: 500px;
    margin: 0 auto;
  }

  .result-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .result-icon {
    font-size: 16px;
  }

  .result-value {
    font-size: 16px;
    font-weight: 700;
  }

  .result-label {
    font-size: 10px;
    color: var(--fg-muted);
  }

  .loot-bag {
    margin-top: var(--space-lg);
    padding: var(--space-md);
    background: var(--bg-card);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  .loot-bag h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 11px;
    color: var(--fg-muted);
  }

  .loot-item {
    padding: var(--space-xs) 0;
    font-size: 11px;
  }

  /* Run Complete View */
  .run-complete-view {
    text-align: center;
  }

  .run-complete-view h2 {
    color: var(--accent-red);
    margin-bottom: var(--space-md);
  }

  .grade-display {
    font-size: 72px;
    font-weight: 800;
    line-height: 1;
    margin: var(--space-lg) 0;
  }

  .grade-S { color: #ffd700; }
  .grade-A { color: var(--accent-green); }
  .grade-B { color: var(--accent); }
  .grade-C { color: var(--accent-amber); }
  .grade-D { color: var(--accent-amber); }
  .grade-F { color: var(--accent-red); }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
    max-width: 400px;
    margin: 0 auto var(--space-lg);
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    padding: var(--space-sm);
    background: var(--bg-card);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }

  .summary-label {
    font-size: 10px;
    color: var(--fg-muted);
  }

  .summary-value {
    font-size: 14px;
    font-weight: 600;
  }

  .run-history {
    max-width: 400px;
    margin: 0 auto;
    text-align: left;
  }

  .run-history h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 11px;
    color: var(--fg-muted);
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-xs);
    font-size: 11px;
  }

  .history-grade {
    font-weight: 700;
  }

  /* Town View */
  .town-view {
    height: 100%;
  }

  .town-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
    height: 100%;
  }

  .town-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .town-welcome {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: var(--space-md);
  }

  .town-welcome h2 {
    margin: 0;
    font-size: 16px;
    color: var(--fg);
  }

  .town-gold {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .gold-icon {
    font-size: 20px;
  }

  .gold-amount {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent-amber);
  }

  .town-card h3 {
    margin: 0 0 var(--space-md) 0;
    font-size: 12px;
    color: var(--fg);
  }

  .vendor-list, .stash-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .vendor-item, .stash-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs);
    background: var(--bg-muted);
    border-radius: var(--radius-sm);
    font-size: 11px;
  }

  .item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-price, .item-level {
    color: var(--fg-muted);
    font-size: 10px;
  }

  .btn-small {
    padding: var(--space-xs) var(--space-sm);
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--bg);
    font-size: 10px;
    cursor: pointer;
  }

  .btn-small:hover {
    filter: brightness(1.1);
  }

  .empty-message {
    color: var(--fg-muted);
    font-size: 11px;
    text-align: center;
    padding: var(--space-lg);
  }

  .inn-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    flex: 1;
  }

  .inn-content .btn-primary {
    width: 100%;
  }

  .upgrades {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .upgrades h4 {
    margin: 0;
    font-size: 11px;
    color: var(--fg-muted);
  }

  .upgrade-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-xs);
    background: var(--bg-muted);
    border-radius: var(--radius-sm);
    font-size: 11px;
  }

  /* Right Panel */
  .right-panel {
    width: 240px;
    padding: var(--space-md);
    background: var(--bg-card);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    overflow-y: auto;
  }

  .right-panel h3 {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    margin: 0 0 var(--space-sm) 0;
  }

  .player-status {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .stat-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .stat-row label {
    font-size: 10px;
    color: var(--fg-muted);
  }

  .stat-value {
    font-size: 11px;
    font-weight: 500;
  }

  .stat-value.gold {
    color: var(--accent-amber);
  }

  .equipment {
    margin-top: var(--space-md);
  }

  .equipment h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 11px;
    color: var(--fg-muted);
  }

  .equip-slot {
    display: flex;
    justify-content: space-between;
    padding: var(--space-xs) 0;
    font-size: 11px;
    border-bottom: 1px solid var(--border);
  }

  .slot-label {
    color: var(--fg-muted);
  }

  .slot-item {
    color: var(--fg);
  }

  .run-stats, .calendar-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .run-stat, .cal-stat {
    display: flex;
    justify-content: space-between;
    padding: var(--space-xs) 0;
    font-size: 11px;
    border-bottom: 1px solid var(--border);
  }

  .run-stat span:last-child, .cal-stat span:last-child {
    font-weight: 500;
  }

  /* Event Log */
  .event-log {
    height: 150px;
    padding: var(--space-md);
    background: var(--bg-card);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
  }

  .event-log h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 11px;
    color: var(--fg-muted);
  }

  .log-entries {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .log-entry {
    display: flex;
    gap: var(--space-md);
    font-size: 11px;
    padding: 2px 0;
  }

  .log-time {
    color: var(--fg-muted);
    font-size: 10px;
    flex-shrink: 0;
  }

  .log-message {
    flex: 1;
  }

  /* Log type colors */
  .log-type-loot { color: var(--accent-amber); }
  .log-type-damage { color: var(--accent-red); }
  .log-type-heal { color: var(--accent-green); }
  .log-type-phase { color: var(--accent); }
  .log-type-info { color: var(--fg-muted); }
</style>
