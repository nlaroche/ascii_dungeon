<script>
  import { createEventDispatcher } from 'svelte';
  
  export let label = '';
  export let min = 0;
  export let max = 100;
  export let step = 1;
  export let value = 50;
  
  const dispatch = createEventDispatcher();
  
  function handleChange(event) {
    value = parseFloat(event.target.value);
    dispatch('change', value);
  }
</script>

<div class="param-slider">
  <label>
    <span class="label">{label}</span>
    <span class="value">{value}</span>
  </label>
  <input 
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
    margin-bottom: 15px;
  }
  
  label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    font-size: 12px;
  }
  
  .label {
    color: #888;
  }
  
  .value {
    color: #00ffff;
    font-weight: bold;
  }
  
  input[type="range"] {
    width: 100%;
    height: 6px;
    background: #333;
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
  }
  
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #00ff00;
    border-radius: 50%;
    cursor: pointer;
  }
  
  input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #00ff00;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
</style>
