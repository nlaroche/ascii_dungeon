<script>
  import { fade } from 'svelte/transition';
  import Sidebar from './components/Sidebar.svelte';
  import DungeonGen from './sections/DungeonGen.svelte';
  import CombatSim from './sections/CombatSim.svelte';
  import PlayerEditor from './sections/PlayerEditor.svelte';
  import AIViewer from './sections/AIViewer.svelte';
  import EconomySim from './sections/EconomySim.svelte';
  import GraphicsLab from './sections/GraphicsLab.svelte';
  import IntelligenceLab from './sections/IntelligenceLab.svelte';
  import SkillTreeLab from './sections/SkillTreeLab.svelte';
  import ItemLab from './sections/ItemLab.svelte';
  import JuiceLab from './sections/JuiceLab.svelte';
  import PaletteLab from './sections/PaletteLab.svelte';
  import GameLoopLab from './sections/GameLoopLab.svelte';
  import UILab from './sections/UILab.svelte';

  let activeSection = 'gameloop';

  const sections = [
    { id: 'gameloop', label: 'Game Loop' },
    { id: 'dungeon', label: 'Dungeon' },
    { id: 'combat', label: 'Combat' },
    { id: 'player', label: 'Player' },
    { id: 'ai', label: 'AI' },
    { id: 'economy', label: 'Economy' },
    { id: 'items', label: 'Items' },
    { id: 'graphics', label: 'Graphics' },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'skilltrees', label: 'Skill Trees' },
    { id: 'juice', label: 'Juice' },
    { id: 'palette', label: 'Palette' },
    { id: 'ui', label: 'UI' },
  ];

  function handleSectionChange(event) {
    activeSection = event.detail;
  }

  function goToGame() {
    window.location.hash = 'game';
  }
</script>

<div class="workbench">
  <Sidebar
    {sections}
    {activeSection}
    on:sectionChange={handleSectionChange}
    on:goToGame={goToGame}
  />

  <main class="content">
    {#key activeSection}
      <div class="section-wrapper" in:fade={{ duration: 150, delay: 50 }}>
        {#if activeSection === 'gameloop'}
          <GameLoopLab />
        {:else if activeSection === 'dungeon'}
          <DungeonGen />
        {:else if activeSection === 'combat'}
          <CombatSim />
        {:else if activeSection === 'player'}
          <PlayerEditor />
        {:else if activeSection === 'ai'}
          <AIViewer />
        {:else if activeSection === 'economy'}
          <EconomySim />
        {:else if activeSection === 'items'}
          <ItemLab />
        {:else if activeSection === 'graphics'}
          <GraphicsLab />
        {:else if activeSection === 'intelligence'}
          <IntelligenceLab />
        {:else if activeSection === 'skilltrees'}
          <SkillTreeLab />
        {:else if activeSection === 'juice'}
          <JuiceLab />
        {:else if activeSection === 'palette'}
          <PaletteLab />
        {:else if activeSection === 'ui'}
          <UILab />
        {/if}
      </div>
    {/key}
  </main>
</div>

<style>
  .workbench {
    /* ── Palette (Neutral Zinc) ── */
    --bg:            #09090b;
    --bg-card:       #18181b;
    --bg-muted:      #27272a;
    --bg-accent:     #3f3f46;

    --border:        #27272a;
    --border-muted:  #1e1e22;
    --border-accent: #3f3f46;

    --fg:            #fafafa;
    --fg-muted:      #a1a1aa;
    --fg-dim:        #71717a;

    --accent:        #68c2d3;
    --accent-green:  #a2dcc7;
    --accent-amber:  #d3a068;
    --accent-red:    #b45252;

    /* ── Scale ── */
    --radius-sm: 4px;
    --radius: 6px;
    --radius-lg: 8px;

    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;

    --font-mono: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace;
    --transition-fast: 120ms ease;
    --transition: 200ms ease;

    /* ── Ring (focus-visible) ── */
    --ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);

    /* ── Layout ── */
    display: flex;
    width: 100%;
    height: 100vh;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding: var(--space-lg);
  }

  .section-wrapper {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    animation: section-in 200ms ease both;
  }

  /* ── Scrollbar ── */
  .content::-webkit-scrollbar { width: 6px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .content::-webkit-scrollbar-thumb:hover { background: var(--fg-dim); }

  :global(.workbench *) {
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  /* ── Keyframes (globally available via -global- prefix) ── */
  @keyframes -global-section-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes -global-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes -global-slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes -global-scale-in {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* ── Global focus ring ── */
  :global(.workbench button:focus-visible),
  :global(.workbench select:focus-visible),
  :global(.workbench input:focus-visible) {
    outline: none;
    box-shadow: var(--ring);
  }

  /* ── Global button reset ── */
  :global(.workbench button) {
    font-family: var(--font-mono);
    cursor: pointer;
  }

  :global(.workbench button:active:not(:disabled)) {
    transform: scale(0.97);
  }

  /* ── Shared section/card styles ── */
  :global(.workbench .section) {
    padding: var(--space-md) 0;
  }
  :global(.workbench .card) {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-lg);
  }
  :global(.workbench .card h2) {
    color: var(--fg);
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 var(--space-sm);
  }
  :global(.workbench .card h3) {
    color: var(--fg-muted);
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 var(--space-sm);
  }
  :global(.workbench .hint) {
    color: var(--fg-dim);
    font-size: 12px;
    margin: 0;
  }
</style>
