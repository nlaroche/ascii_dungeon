<script>
  import { createEventDispatcher } from 'svelte';

  export let label = '';
  export let value = false;

  const dispatch = createEventDispatcher();

  function toggle() {
    value = !value;
    dispatch('change', value);
  }
</script>

<div class="param-toggle">
  <span class="label">{label}</span>
  <button
    class="toggle"
    class:on={value}
    on:click={toggle}
    aria-pressed={value}
  >
    <span class="knob"></span>
  </button>
</div>

<style>
  .param-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md, 16px);
  }

  .label {
    color: var(--fg-muted);
    font-size: 11px;
  }

  .toggle {
    width: 36px;
    height: 20px;
    background: var(--bg-accent);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    position: relative;
    transition: all 200ms ease;
  }

  .toggle:hover {
    border-color: var(--fg-dim);
  }

  .toggle.on {
    background: var(--accent-green);
    border-color: var(--accent-green);
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--fg-dim);
    border-radius: 50%;
    transition: all 200ms ease;
  }

  .toggle.on .knob {
    transform: translateX(16px);
    background: var(--fg);
  }
</style>
