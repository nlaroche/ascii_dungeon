<script>
  import { createEventDispatcher } from 'svelte';
  
  export let sections = [];
  export let activeSection = 'dungeon';
  
  const dispatch = createEventDispatcher();
  
  function selectSection(id) {
    dispatch('sectionChange', id);
  }
  
  function goToGame() {
    dispatch('goToGame');
  }
</script>

<aside class="sidebar">
  <div class="header">
    <h1>Workbench</h1>
  </div>
  
  <nav class="nav">
    {#each sections as section}
      <button 
        class="nav-item" 
        class:active={activeSection === section.id}
        on:click={() => selectSection(section.id)}
      >
        {section.label}
      </button>
    {/each}
  </nav>
  
  <div class="footer">
    <button class="back-link" on:click={goToGame}>
      ← Back to Game
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 200px;
    min-width: 200px;
    height: 100%;
    background: #0a0a0a;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
  }
  
  .header {
    padding: 20px;
    border-bottom: 1px solid #333;
  }
  
  .header h1 {
    margin: 0;
    font-size: 18px;
    color: #00ffff;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  
  .nav {
    flex: 1;
    padding: 10px 0;
    overflow-y: auto;
  }
  
  .nav-item {
    display: block;
    width: 100%;
    padding: 12px 20px;
    background: transparent;
    border: none;
    color: #888;
    font-family: monospace;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .nav-item:hover {
    background: #1a1a1a;
    color: #ffaa00;
  }
  
  .nav-item.active {
    background: #1a1a1a;
    color: #00ff00;
    border-left: 3px solid #00ff00;
  }
  
  .footer {
    padding: 20px;
    border-top: 1px solid #333;
  }
  
  .back-link {
    background: transparent;
    border: 1px solid #ff4444;
    color: #ff4444;
    padding: 10px 15px;
    font-family: monospace;
    font-size: 12px;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s;
  }
  
  .back-link:hover {
    background: #ff4444;
    color: #111;
  }
</style>
