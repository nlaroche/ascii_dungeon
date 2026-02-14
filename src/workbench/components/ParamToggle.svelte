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
    margin-bottom: 15px;
  }
  
  .label {
    color: #888;
    font-size: 12px;
  }
  
  .toggle {
    width: 44px;
    height: 24px;
    background: #333;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
  }
  
  .toggle.on {
    background: #00ff00;
  }
  
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  
  .toggle.on .knob {
    transform: translateX(20px);
  }
</style>
