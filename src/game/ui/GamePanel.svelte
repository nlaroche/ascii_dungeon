<script>
  export let title = '';
</script>

<div class="game-panel">
  {#if title}
    <div class="panel-header">
      <span class="panel-title">{title}</span>
    </div>
  {/if}
  <div class="panel-body">
    <slot />
  </div>
</div>

<style>
  .game-panel {
    background: var(--bg-card);
    border: 2px solid var(--accent);
    border-radius: 2px;
    box-shadow: 0 0 12px rgba(104, 194, 211, 0.1), inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .panel-header {
    padding: 6px 12px;
    border-bottom: 1px solid var(--accent);
    background: linear-gradient(180deg, rgba(104, 194, 211, 0.08) 0%, transparent 100%);
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .panel-body {
    padding: 10px 12px;
  }
</style>
