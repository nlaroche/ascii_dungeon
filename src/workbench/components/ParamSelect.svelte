<script>
  import { createEventDispatcher } from 'svelte';
  
  export let label = '';
  export let options = []; // Array of {value, label}
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
    margin-bottom: 15px;
  }
  
  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
  
  .label {
    color: #888;
  }
  
  select {
    background: #222;
    color: #ffaa00;
    border: 1px solid #444;
    padding: 6px 10px;
    font-family: monospace;
    font-size: 12px;
    cursor: pointer;
    min-width: 120px;
  }
  
  select:focus {
    outline: none;
    border-color: #ffaa00;
  }
  
  option {
    background: #111;
    color: #eee;
  }
</style>
