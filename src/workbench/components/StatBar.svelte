<script>
  export let label = '';
  export let value = 0;
  export let max = 100;
  export let color = '#00ff00';
  
  $: percentage = Math.min(100, Math.max(0, (value / max) * 100));
</script>

<div class="stat-bar">
  <div class="bar-header">
    <span class="label">{label}</span>
    <span class="values">{value} / {max}</span>
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
    margin-bottom: 10px;
  }
  
  .bar-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 11px;
  }
  
  .label {
    color: #888;
  }
  
  .values {
    color: #eee;
  }
  
  .bar-track {
    height: 8px;
    background: #222;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .bar-fill {
    height: 100%;
    transition: width 0.3s ease;
  }
</style>
