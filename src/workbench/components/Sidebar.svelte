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
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
  }

  .header {
    padding: var(--space-lg) var(--space-md);
    border-bottom: 1px solid var(--border);
  }

  .header h1 {
    margin: 0;
    font-size: 14px;
    color: var(--fg);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 600;
  }

  .nav {
    flex: 1;
    padding: var(--space-sm) 0;
    overflow-y: auto;
  }

  .nav-item {
    display: block;
    width: 100%;
    padding: 10px var(--space-md);
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    color: var(--fg-dim);
    font-family: var(--font-mono);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .nav-item:hover {
    background: var(--bg-muted);
    color: var(--fg-muted);
    border-left-color: var(--border-accent);
    padding-left: calc(var(--space-md) + 4px);
  }

  .nav-item.active {
    background: var(--bg-muted);
    color: var(--accent-green);
    border-left-color: var(--accent-green);
    font-weight: 600;
  }

  .footer {
    padding: var(--space-md);
    border-top: 1px solid var(--border);
  }

  .back-link {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    width: 100%;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .back-link:hover {
    background: var(--bg-muted);
    border-color: var(--accent-red);
    color: var(--accent-red);
  }
</style>
