<script>
  import GamePanel from './GamePanel.svelte';
  import GameStatBar from './GameStatBar.svelte';
  import GameBadge from './GameBadge.svelte';

  export let player = null;
  export let day = 1;
  export let timeOfDay = '';
</script>

{#if player}
  <div class="hud-container">
    <GamePanel title="Day {day}">
      <div class="player-info">
        <span class="player-name">{player.name}</span>
        <span class="player-level">Lv{player.level}</span>
      </div>

      <GameStatBar
        label="HP"
        value={player.hp}
        max={player.maxHp}
        color={player.hp > player.maxHp * 0.5 ? 'var(--accent-green)' : 'var(--accent-red)'}
      />

      <GameStatBar
        label="Stamina"
        value={player.stamina}
        max={player.maxStamina}
        color="var(--accent)"
      />

      <div class="stat-badges">
        <GameBadge icon="/" label="ATK" value={player.attack} color="var(--accent-red)" />
        <GameBadge icon="[" label="DEF" value={player.defense} color="#4b80ca" />
      </div>

      <div class="footer-row">
        <GameBadge icon="$" value="{player.gold}g" color="var(--accent-amber)" />
        {#if timeOfDay}
          <span class="time">{timeOfDay}</span>
        {/if}
      </div>
    </GamePanel>
  </div>
{/if}

<style>
  .hud-container {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 200px;
    pointer-events: auto;
    animation: hud-in 300ms ease-out both;
  }

  .player-info {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
  }

  .player-name {
    color: var(--accent);
    font-weight: 600;
    font-size: 13px;
  }

  .player-level {
    color: var(--fg-muted);
    font-size: 11px;
  }

  .stat-badges {
    display: flex;
    gap: 6px;
    margin: 6px 0;
  }

  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
  }

  .time {
    color: var(--fg-dim);
    font-size: 11px;
  }

  @keyframes hud-in {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
</style>
