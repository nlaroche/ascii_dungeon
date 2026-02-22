<script>
  import { createEventDispatcher } from 'svelte';

  export let label = '';
  export let min = 0;
  export let max = 100;
  export let step = 1;
  export let value = 50;

  const dispatch = createEventDispatcher();
  const id = 'slider-' + label.toLowerCase().replace(/\s+/g, '-');

  function handleChange(event) {
    value = parseFloat(event.target.value);
    dispatch('change', value);
  }
</script>

<div class="param-slider">
  <label for={id}>
    <span class="label">{label}</span>
    <span class="value">{value}</span>
  </label>
  <input
    {id}
    type="range"
    {min}
    {max}
    {step}
    {value}
    on:input={handleChange}
  />
</div>

<style>
  .param-slider {
    margin-bottom: var(--space-md, 16px);
  }

  label {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-xs, 4px);
    font-size: 11px;
  }

  .label {
    color: var(--fg-muted);
  }

  .value {
    color: var(--accent);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  input[type="range"] {
    width: 100%;
    height: 4px;
    background: var(--bg-accent);
    border-radius: 2px;
    outline: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: var(--accent-green);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
  }

  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: var(--accent-green);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  input[type="range"]::-moz-range-track {
    height: 4px;
    background: var(--bg-accent);
    border-radius: 2px;
  }
</style>
