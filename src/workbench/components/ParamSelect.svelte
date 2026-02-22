<script>
  import { createEventDispatcher } from 'svelte';

  export let label = '';
  export let options = [];
  export let value = '';

  const dispatch = createEventDispatcher();

  function handleChange(event) {
    value = event.target.value;
    dispatch('change', value);
  }
</script>

<div class="param-select">
  <label>
    <span class="label">{label}</span>
    <select {value} on:change={handleChange}>
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </label>
</div>

<style>
  .param-select {
    margin-bottom: var(--space-md, 16px);
  }

  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }

  .label {
    color: var(--fg-muted);
  }

  select {
    background: var(--bg-card);
    color: var(--accent-amber);
    border: 1px solid var(--border);
    padding: 5px 10px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    cursor: pointer;
    min-width: 120px;
    border-radius: var(--radius-sm, 4px);
    transition: border-color 120ms ease;
  }

  select:focus {
    outline: none;
    border-color: var(--border-accent);
  }

  select:hover {
    border-color: var(--fg-dim);
  }

  option {
    background: var(--bg);
    color: var(--fg);
  }
</style>
