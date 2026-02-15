<script>
  import { slide } from 'svelte/transition';
  import ParamSlider from '../components/ParamSlider.svelte';
  import StatBar from '../components/StatBar.svelte';
  import {
    SKILL_GRAPH_NODES,
    createSkillTree,
    canAllocate,
    allocateNode,
    deallocateNode,
    getVisibleNodes,
    getVisibleEdges,
    getSkillBonuses,
    getRegionColor,
    getNodeTypeChar,
    getTreeStats,
    getRemainingPoints,
    getAvailablePoints,
    REGIONS,
  } from '../../lib/skills.js';

  // ── State ──
  let tree = createSkillTree();
  let playerLevel = 1;
  let floorsCleared = 0;
  let hoveredNode = null;
  let selectedNode = null;

  // ── Viewport State (pan/zoom) ──
  let svgElement;
  let viewBox = { x: -150, y: -150, w: 600, h: 600 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  // ── Derived State ──
  $: visibleNodes = getVisibleNodes(tree);
  $: visibleEdges = getVisibleEdges(tree);
  $: bonuses = getSkillBonuses(tree);
  $: stats = getTreeStats(tree);
  $: remainingPoints = getRemainingPoints(playerLevel, floorsCleared, tree);
  $: availablePoints = getAvailablePoints(playerLevel, floorsCleared);

  // Map node x,y to SVG coords (spacing = 50)
  const SPACING = 50;
  function nodeToSvg(node) {
    return { x: node.x * SPACING, y: node.y * SPACING };
  }

  // ── Event Handlers ──
  function handleNodeClick(node) {
    if (node.status === 'allocated') {
      selectedNode = node;
      return;
    }
    if (canAllocate(tree, node.id) && remainingPoints > 0) {
      tree = allocateNode(tree, node.id);
      selectedNode = { ...node, status: 'allocated' };
    }
  }

  function handleNodeHover(node) {
    hoveredNode = node;
  }

  function handleNodeUnhover() {
    hoveredNode = null;
  }

  function handleReset() {
    tree = createSkillTree();
    selectedNode = null;
    hoveredNode = null;
  }

  // ── Pan & Zoom ──
  function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const newW = viewBox.w * zoomFactor;
    const newH = viewBox.h * zoomFactor;
    
    // Zoom toward mouse position
    const rect = svgElement.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const mouseY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
    
    const newX = mouseX - (mouseX - viewBox.x) * zoomFactor;
    const newY = mouseY - (mouseY - viewBox.y) * zoomFactor;
    
    viewBox = { x: newX, y: newY, w: newW, h: newH };
  }

  function handleMouseDown(e) {
    if (e.target === svgElement || e.target.tagName === 'rect') {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
    }
  }

  function handleMouseMove(e) {
    if (isPanning) {
      const dx = (e.clientX - panStart.x) * (viewBox.w / svgElement.clientWidth);
      const dy = (e.clientY - panStart.y) * (viewBox.h / svgElement.clientHeight);
      viewBox.x -= dx;
      viewBox.y -= dy;
      panStart = { x: e.clientX, y: e.clientY };
    }
  }

  function handleMouseUp() {
    isPanning = false;
  }

  // ── Helpers ──
  function getNodeRadius(type) {
    if (type === 'keystone') return 16;
    if (type === 'notable') return 12;
    return 8;
  }

  function isEdgeAllocated(edge) {
    const [a, b] = edge;
    return tree.allocated.has(a) && tree.allocated.has(b);
  }

  function formatStat(stat) {
    return stat.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }
</script>

<div class="lab">
  <!-- Header -->
  <header class="lab-header">
    <div class="header-left">
      <h2>Skill Tree</h2>
      <button class="btn-text" on:click={() => {}}>How it works</button>
    </div>
    <div class="header-right">
      <button class="btn-reset" on:click={handleReset}>Reset</button>
      <span class="points-display">{remainingPoints}/{availablePoints} pts</span>
    </div>
  </header>

  <!-- Main Content -->
  <div class="lab-body">
    <!-- SVG Graph Viewport -->
    <div class="graph-container">
      <svg
        bind:this={svgElement}
        class="graph-svg"
        viewBox="{viewBox.x} {viewBox.y} {viewBox.w} {viewBox.h}"
        on:wheel={handleWheel}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
      >
        <!-- Background -->
        <rect
          x={viewBox.x - 1000}
          y={viewBox.y - 1000}
          width={viewBox.w + 2000}
          height={viewBox.h + 2000}
          fill="var(--bg)"
        />
        
        <!-- Edges -->
        {#each visibleEdges as [aId, bId]}
          {@const a = SKILL_GRAPH_NODES[aId]}
          {@const b = SKILL_GRAPH_NODES[bId]}
          {@const aPos = nodeToSvg(a)}
          {@const bPos = nodeToSvg(b)}
          {@const allocated = isEdgeAllocated([aId, bId])}
          <line
            x1={aPos.x}
            y1={aPos.y}
            x2={bPos.x}
            y2={bPos.y}
            stroke={allocated ? 'var(--fg-dim)' : 'var(--border)'}
            stroke-opacity={allocated ? 1 : 0.3}
            stroke-width={allocated ? 1.5 : 1}
          />
        {/each}

        <!-- Nodes -->
        {#each visibleNodes as node (node.id)}
          {@const pos = nodeToSvg(node)}
          {@const radius = getNodeRadius(node.type)}
          {@const isAllocated = node.status === 'allocated'}
          {@const isAvailable = node.status === 'available'}
          {@const regionColor = getRegionColor(node.region)}
          
          <g
            class="node-group"
            class:allocated={isAllocated}
            class:available={isAvailable}
            transform="translate({pos.x}, {pos.y})"
            on:click={() => handleNodeClick(node)}
            on:mouseenter={() => handleNodeHover(node)}
            on:mouseleave={handleNodeUnhover}
          >
            <!-- Glow for allocated nodes -->
            {#if isAllocated}
              <circle
                r={radius + 4}
                fill={regionColor}
                opacity="0.3"
                class="node-glow"
              />
            {/if}
            
            <!-- Node circle -->
            <circle
              r={radius}
              fill={isAllocated ? regionColor : 'var(--bg-muted)'}
              fill-opacity={isAllocated ? 0.8 : 1}
              stroke={regionColor}
              stroke-opacity={isAllocated ? 1 : 0.5}
              stroke-width="2"
              class="node-circle"
            />
            
            <!-- Node char -->
            <text
              text-anchor="middle"
              dominant-baseline="central"
              fill={isAllocated ? 'white' : regionColor}
              fill-opacity={isAllocated ? 1 : 0.6}
              font-size={radius * 1.2}
              font-family="var(--font-mono)"
              class="node-char"
            >
              {node.char}
            </text>
          </g>
        {/each}
      </svg>

      <!-- Tooltip overlay -->
      {#if hoveredNode}
        <div 
          class="tooltip"
          style="
            left: {(hoveredNode.x * SPACING - viewBox.x) / viewBox.w * 100}%;
            top: {(hoveredNode.y * SPACING - viewBox.y) / viewBox.h * 100}%;
          "
        >
          <span class="tooltip-char" style="color: {getRegionColor(hoveredNode.region)}">{hoveredNode.char}</span>
          <span class="tooltip-label">{hoveredNode.label}</span>
          {#if hoveredNode.stat}
            <span class="tooltip-stat">+{hoveredNode.value} {hoveredNode.stat}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Right Sidebar -->
    <aside class="lab-sidebar">
      <!-- Node Detail -->
      <section class="sidebar-section">
        <h3>Node Detail</h3>
        {#if selectedNode}
          <div class="node-detail">
            <div class="node-detail-header">
              <span 
                class="node-detail-char"
                style="color: {getRegionColor(selectedNode.region)}"
              >
                {selectedNode.char}
              </span>
              <div class="node-detail-info">
                <span class="node-detail-name">{selectedNode.label}</span>
                <div class="node-detail-badges">
                  <span class="badge badge-type">{selectedNode.type}</span>
                  <span 
                    class="badge badge-region"
                    style="background: {getRegionColor(selectedNode.region)}"
                  >
                    {selectedNode.region}
                  </span>
                  {#if selectedNode.type === 'keystone'}
                    <span class="badge badge-keystone">KEYSTONE</span>
                  {/if}
                </div>
              </div>
            </div>
            <p class="node-detail-desc">{selectedNode.description}</p>
            {#if selectedNode.stat}
              <div class="node-detail-bonus">
                +{selectedNode.value} {formatStat(selectedNode.stat)}
              </div>
            {/if}
          </div>
        {:else}
          <p class="empty-state">Click a node to view details</p>
        {/if}
      </section>

      <!-- Active Bonuses -->
      <section class="sidebar-section">
        <h3>Active Bonuses</h3>
        {#if Object.keys(bonuses).length > 0}
          <div class="bonuses-list">
            {#each Object.entries(bonuses) as [stat, value]}
              <StatBar label={formatStat(stat)} value={value} max={value * 1.5} />
            {/each}
          </div>
        {:else}
          <p class="empty-state">Allocate nodes to see bonuses</p>
        {/if}
      </section>

      <!-- Region Legend -->
      <section class="sidebar-section">
        <h3>Regions</h3>
        <div class="region-legend">
          {#each REGIONS as region}
            <div class="region-item">
              <span 
                class="region-dot"
                style="background: {getRegionColor(region)}"
              ></span>
              <span class="region-name">{region}</span>
              <span class="region-count">{stats.regionCounts[region] || 0}</span>
            </div>
          {/each}
        </div>
      </section>

      <!-- Tree Stats -->
      <section class="sidebar-section">
        <h3>Tree Stats</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{stats.totalAllocated}</span>
            <span class="stat-label">Allocated</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{stats.totalVisible}</span>
            <span class="stat-label">Visible</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{stats.totalNodes}</span>
            <span class="stat-label">Total Nodes</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{remainingPoints}</span>
            <span class="stat-label">Points Left</span>
          </div>
        </div>
      </section>
    </aside>
  </div>

  <!-- Controls Bar -->
  <footer class="lab-controls">
    <div class="control-group">
      <ParamSlider
        label="Player Lv"
        value={playerLevel}
        min={1}
        max={100}
        on:change={(e) => playerLevel = e.detail}
      />
    </div>
    <div class="control-group">
      <ParamSlider
        label="Floors"
        value={floorsCleared}
        min={0}
        max={100}
        on:change={(e) => floorsCleared = e.detail}
      />
    </div>
  </footer>
</div>

<style>
  .lab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--bg);
    color: var(--fg);
  }

  /* Header */
  .lab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .header-left h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .points-display {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: var(--accent);
    font-weight: bold;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--fg-dim);
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .btn-reset {
    background: var(--bg-muted);
    border: 1px solid var(--border);
    color: var(--fg);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .btn-reset:hover {
    background: var(--bg-active);
  }

  /* Body */
  .lab-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Graph Container */
  .graph-container {
    flex: 1;
    position: relative;
    background: var(--bg);
    overflow: hidden;
  }

  .graph-svg {
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .graph-svg:active {
    cursor: grabbing;
  }

  /* Node styling */
  .node-group {
    cursor: pointer;
    transition: transform 0.15s ease-out;
  }

  .node-group:hover {
    transform: scale(1.2);
  }

  .node-group.available .node-circle {
    animation: pulse 2s ease-in-out infinite;
  }

  .node-group.available .node-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { stroke-opacity: 0.5; }
    50% { stroke-opacity: 0.8; }
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 0.4; }
  }

  .node-char {
    pointer-events: none;
    user-select: none;
  }

  /* Tooltip */
  .tooltip {
    position: absolute;
    transform: translate(-50%, -100%);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-xs) var(--space-sm);
    pointer-events: none;
    white-space: nowrap;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .tooltip-char {
    font-family: var(--font-mono);
    font-size: 1.2rem;
  }

  .tooltip-label {
    font-weight: bold;
    font-size: 0.85rem;
  }

  .tooltip-stat {
    font-size: 0.75rem;
    color: var(--fg-dim);
  }

  /* Sidebar */
  .lab-sidebar {
    width: 260px;
    background: var(--bg-card);
    border-left: 1px solid var(--border);
    overflow-y: auto;
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .sidebar-section h3 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 0.9rem;
    color: var(--fg-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .empty-state {
    color: var(--fg-dim);
    font-size: 0.85rem;
    font-style: italic;
  }

  /* Node Detail */
  .node-detail {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
  }

  .node-detail-header {
    display: flex;
    gap: var(--space-sm);
    align-items: flex-start;
    margin-bottom: var(--space-sm);
  }

  .node-detail-char {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    line-height: 1;
  }

  .node-detail-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .node-detail-name {
    font-weight: bold;
    font-size: 1rem;
  }

  .node-detail-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .badge {
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-type {
    background: var(--bg-muted);
    color: var(--fg-dim);
  }

  .badge-region {
    color: white;
  }

  .badge-keystone {
    background: linear-gradient(135deg, #ffd700, #ff8c00);
    color: #222;
    font-weight: bold;
  }

  .node-detail-desc {
    font-size: 0.8rem;
    color: var(--fg-dim);
    margin: 0 0 var(--space-sm) 0;
    line-height: 1.4;
  }

  .node-detail-bonus {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: var(--accent);
    font-weight: bold;
  }

  /* Bonuses */
  .bonuses-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  /* Region Legend */
  .region-legend {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .region-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.85rem;
  }

  .region-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .region-name {
    flex: 1;
    text-transform: capitalize;
  }

  .region-count {
    font-family: var(--font-mono);
    color: var(--fg-dim);
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }

  .stat-item {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
    text-align: center;
  }

  .stat-value {
    display: block;
    font-family: var(--font-mono);
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--accent);
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--fg-dim);
    text-transform: uppercase;
  }

  /* Controls */
  .lab-controls {
    display: flex;
    gap: var(--space-lg);
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--border);
    background: var(--bg-card);
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 200px;
  }
</style>
