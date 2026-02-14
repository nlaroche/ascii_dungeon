<script>
  import Sidebar from './components/Sidebar.svelte';
  import DungeonGen from './sections/DungeonGen.svelte';
  import CombatSim from './sections/CombatSim.svelte';
  import PlayerEditor from './sections/PlayerEditor.svelte';
  import AIViewer from './sections/AIViewer.svelte';
  import EconomySim from './sections/EconomySim.svelte';
  import GraphicsLab from './sections/GraphicsLab.svelte';
  import IntelligenceLab from './sections/IntelligenceLab.svelte';
  import SkillTreeLab from './sections/SkillTreeLab.svelte';
  
  let activeSection = 'dungeon';
  
  const sections = [
    { id: 'dungeon', label: 'Dungeon' },
    { id: 'combat', label: 'Combat' },
    { id: 'player', label: 'Player' },
    { id: 'ai', label: 'AI' },
    { id: 'economy', label: 'Economy' },
    { id: 'graphics', label: 'Graphics' },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'skilltrees', label: 'Skill Trees' }
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
    {#if activeSection === 'dungeon'}
      <DungeonGen />
    {:else if activeSection === 'combat'}
      <CombatSim />
    {:else if activeSection === 'player'}
      <PlayerEditor />
    {:else if activeSection === 'ai'}
      <AIViewer />
    {:else if activeSection === 'economy'}
      <EconomySim />
    {:else if activeSection === 'graphics'}
      <GraphicsLab />
    {:else if activeSection === 'intelligence'}
      <IntelligenceLab />
    {:else if activeSection === 'skilltrees'}
      <SkillTreeLab />
    {/if}
  </main>
</div>

<style>
  .workbench {
    display: flex;
    width: 100%;
    height: 100vh;
    background: #111;
    color: #eee;
    font-family: monospace;
  }
  
  .content {
    flex: 1;
    overflow: auto;
    padding: 20px;
  }
</style>
