<script>
  export let label = '';
  export let value = 0;
  export let max = 100;
  export let color = 'var(--accent-green)';

  $: percentage = Math.min(100, Math.max(0, (value / max) * 100));
</script>

<div class="stat-bar">
  <div class="bar-header">
    <span class="label">{label}</span>
    <span class="values">{value}<span class="sep">/</span>{max}</span>
  </div>
  <div class="bar-track">
    <div
      class="bar-fill"
      style="width: {percentage}%; background: {color};"
    ></div>
  </div>
</div>

<style>
  .stat-bar {
    margin-bottom: var(--space-sm, 8px);
  }

  .bar-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
    font-size: 10px;
  }

  .label {
    color: var(--fg-muted);
  }

  .values {
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }

  .sep {
    color: var(--fg-dim);
    margin: 0 1px;
  }

  .bar-track {
    height: 4px;
    background: var(--bg-muted);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
    opacity: 0.8;
  }
</style>
