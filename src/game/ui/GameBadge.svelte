<script>
  export let icon = '';
  export let label = '';
  export let value = '';
  export let color = 'var(--fg-muted)';
</script>

<span class="badge" style="--badge-color: {color};">
  {#if icon}<span class="icon">{icon}</span>{/if}
  {#if label}<span class="label">{label}</span>{/if}
  <span class="value">{value}</span>
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 2px;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    white-space: nowrap;
  }

  .icon {
    color: var(--badge-color);
    font-size: 12px;
  }

  .label {
    color: var(--fg-dim);
  }

  .value {
    color: var(--badge-color);
    font-weight: 600;
  }
</style>
