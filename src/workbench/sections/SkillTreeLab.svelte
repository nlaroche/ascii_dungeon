<script>
  import { createSkillTree, getVisibleNodes } from '../../lib/skills.js';

  let tree = createSkillTree();
  let visibleNodes = getVisibleNodes(tree);

  function refresh() {
    visibleNodes = getVisibleNodes(tree);
  }
</script>

<div class="card">
  <h2>Skill Tree</h2>
  
  <div class="nodes-list">
    {#each visibleNodes as node}
      <div class="node" class:allocated={node.status === 'allocated'}>
        <span class="char">{node.char}</span>
        <span class="label">{node.label}</span>
        <span class="stat">({node.stat}: +{node.value})</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-md);
  }

  h2 {
    margin: 0 0 var(--space-md) 0;
    font-size: 1.2rem;
  }

  .nodes-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .node {
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .node.allocated {
    background: var(--bg-active);
    border-color: var(--accent);
  }

  .char {
    font-family: monospace;
    width: 20px;
    text-align: center;
  }

  .label {
    font-weight: bold;
  }

  .stat {
    color: var(--text-muted);
    font-size: 0.85rem;
  }
</style>
