<script>
  import { PALETTE, COLORS } from '../../lib/palette.js';

  // Palette names for display
  const PALETTE_NAMES = [
    'cream', 'silver', 'gray', 'dark gray', 'charcoal', 'deep indigo',
    'near-black', 'dark purple', 'navy', 'blue', 'cyan', 'mint',
    'pale gold', 'amber', 'rust red', 'mauve', 'plum', 'brown',
    'tan', 'sand', 'lime', 'olive', 'teal', 'dark olive',
    'khaki', 'sage', 'blush', 'pink', 'slate',
  ];

  // Semantic groups for COLORS display
  const SEMANTIC_GROUPS = [
    {
      label: 'UI Chrome',
      keys: ['bg', 'bgCard', 'bgMuted', 'bgAccent', 'border', 'borderMuted', 'borderAccent',
             'fg', 'fgMuted', 'fgDim', 'accent', 'accentGreen', 'accentAmber', 'accentRed'],
    },
    {
      label: 'Game Entities',
      keys: ['player', 'goblin', 'skeleton', 'torch', 'treasure'],
    },
    {
      label: 'Dungeon Terrain',
      keys: ['wallFg', 'wallBg', 'floorFg', 'floorBg'],
    },
    {
      label: 'Combat / Effects',
      keys: ['damage', 'heal', 'flash', 'xpGold', 'hpHigh', 'hpMid', 'hpLow', 'hpBg'],
    },
    {
      label: 'Skill Regions',
      keys: ['combat', 'defense', 'vitality', 'exploration', 'fortune', 'arcane'],
    },
    {
      label: 'Item Records',
      keys: ['recordBase', 'recordLow', 'killMid', 'killHigh',
             'treasureMid', 'treasureHigh', 'exploreMid', 'exploreHigh',
             'surviveMid', 'surviveHigh'],
    },
    {
      label: 'Resonance',
      keys: ['bloodBrothers', 'goldenPair', 'pathfinders', 'ironBond',
             'warriorSoul', 'treasureHunter', 'berserker', 'paladin'],
    },
    {
      label: 'Particles & Shared',
      keys: ['particleDefault', 'smoke', 'black'],
    },
  ];

  // Entity preview data
  const ENTITIES = [
    { char: '@', label: 'Player', fg: COLORS.player, bg: COLORS.floorBg },
    { char: 'g', label: 'Goblin', fg: COLORS.goblin, bg: COLORS.floorBg },
    { char: 's', label: 'Skeleton', fg: COLORS.skeleton, bg: COLORS.floorBg },
    { char: '!', label: 'Torch', fg: COLORS.torch, bg: COLORS.floorBg },
    { char: '$', label: 'Treasure', fg: COLORS.treasure, bg: COLORS.floorBg },
  ];

  // Dungeon tile preview
  const DUNGEON_TILES = [
    { char: '#', label: 'Wall', fg: COLORS.wallFg, bg: COLORS.wallBg },
    { char: '.', label: 'Floor', fg: COLORS.floorFg, bg: COLORS.floorBg },
    { char: '#', label: 'Wall (dim)', fg: COLORS.fgDim, bg: COLORS.bgMuted },
    { char: '.', label: 'Floor (dim)', fg: COLORS.bgAccent, bg: COLORS.black },
  ];

  // Color ramps
  const RAMPS = [
    { label: 'Kill', colors: [COLORS.recordBase, COLORS.recordLow, COLORS.killMid, COLORS.killHigh] },
    { label: 'Treasure', colors: [COLORS.recordBase, COLORS.recordLow, COLORS.treasureMid, COLORS.treasureHigh] },
    { label: 'Explore', colors: [COLORS.recordBase, COLORS.recordLow, COLORS.exploreMid, COLORS.exploreHigh] },
    { label: 'Survive', colors: [COLORS.recordBase, COLORS.recordLow, COLORS.surviveMid, COLORS.surviveHigh] },
  ];

  // Contrast pairs to test
  const CONTRAST_PAIRS = [
    { fg: COLORS.fg, bg: COLORS.bg, label: 'fg / bg' },
    { fg: COLORS.fgMuted, bg: COLORS.bgCard, label: 'fgMuted / bgCard' },
    { fg: COLORS.player, bg: COLORS.floorBg, label: 'player / floorBg' },
    { fg: COLORS.damage, bg: COLORS.black, label: 'damage / black' },
    { fg: COLORS.treasure, bg: COLORS.floorBg, label: 'treasure / floorBg' },
    { fg: COLORS.accent, bg: COLORS.bg, label: 'accent / bg' },
    { fg: COLORS.wallFg, bg: COLORS.wallBg, label: 'wallFg / wallBg' },
  ];

  function copyHex(hex) {
    navigator.clipboard.writeText(hex);
  }

  function luma(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
</script>

<div class="section">
  <!-- 1. Full Palette Grid -->
  <div class="card">
    <h2>CC-29 Palette</h2>
    <p class="hint">{PALETTE.length} colors. Click to copy hex.</p>
    <div class="palette-grid">
      {#each PALETTE as hex, i}
        <button
          class="swatch"
          style="background: {hex}; color: {luma(hex) > 0.5 ? '#212123' : '#f2f0e5'}"
          on:click={() => copyHex(hex)}
          title={`${PALETTE_NAMES[i]}: ${hex}`}
        >
          <span class="swatch-name">{PALETTE_NAMES[i]}</span>
          <span class="swatch-hex">{hex}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- 2. Semantic Map -->
  <div class="card">
    <h2>Semantic Color Map</h2>
    {#each SEMANTIC_GROUPS as group}
      <h3>{group.label}</h3>
      <div class="semantic-grid">
        {#each group.keys as key}
          <div class="semantic-item">
            <span
              class="semantic-swatch"
              style="background: {COLORS[key]}"
            ></span>
            <span class="semantic-key">{key}</span>
            <span class="semantic-hex">{COLORS[key]}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- 3. Entity Preview -->
  <div class="card">
    <h2>Entity Preview</h2>
    <div class="entity-row">
      {#each ENTITIES as ent}
        <div class="entity-cell">
          <div class="tile" style="background: {ent.bg}; color: {ent.fg}">
            {ent.char}
          </div>
          <span class="entity-label">{ent.label}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- 4. Dungeon Preview -->
  <div class="card">
    <h2>Dungeon Preview</h2>
    <div class="dungeon-preview">
      {#each DUNGEON_TILES as tile}
        <div class="dungeon-cell">
          <div class="tile" style="background: {tile.bg}; color: {tile.fg}">
            {tile.char}
          </div>
          <span class="entity-label">{tile.label}</span>
        </div>
      {/each}
    </div>
    <div class="dungeon-scene" style="background: {COLORS.black}">
      {#each { length: 3 } as _, row}
        <div class="dungeon-row">
          {#each { length: 12 } as _, col}
            {@const isWall = row === 0 || row === 2 || col === 0 || col === 11}
            {@const hasEntity = row === 1 && col === 3}
            {@const hasTreasure = row === 1 && col === 8}
            {@const hasTorch = row === 0 && col === 5}
            <span
              class="dungeon-char"
              style="color: {hasEntity ? COLORS.player : hasTreasure ? COLORS.treasure : hasTorch ? COLORS.torch : isWall ? COLORS.wallFg : COLORS.floorFg};
                     background: {isWall ? COLORS.wallBg : COLORS.floorBg}"
            >{hasEntity ? '@' : hasTreasure ? '$' : hasTorch ? '!' : isWall ? '#' : '.'}</span>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- 5. Item Color Ramps -->
  <div class="card">
    <h2>Item Color Ramps</h2>
    {#each RAMPS as ramp}
      <div class="ramp-row">
        <span class="ramp-label">{ramp.label}</span>
        <div class="ramp-bar">
          {#each ramp.colors as color}
            <div class="ramp-segment" style="background: {color}"></div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- 6. Skill Region Colors -->
  <div class="card">
    <h2>Skill Region Colors</h2>
    <div class="region-row">
      {#each ['combat', 'defense', 'vitality', 'exploration', 'fortune', 'arcane'] as region}
        <div class="region-cell">
          <div class="region-swatch" style="background: {COLORS[region]}"></div>
          <span class="entity-label">{region}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- 7. Contrast Pairs -->
  <div class="card">
    <h2>Contrast Pairs</h2>
    <div class="contrast-grid">
      {#each CONTRAST_PAIRS as pair}
        <div class="contrast-item">
          <div class="contrast-preview" style="background: {pair.bg}; color: {pair.fg}">
            AaBbCc 123
          </div>
          <span class="contrast-label">{pair.label}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .section { padding: var(--space-md) 0; display: flex; flex-direction: column; gap: var(--space-md); }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-lg);
  }

  .card h2 {
    color: var(--fg);
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 var(--space-sm);
  }

  .card h3 {
    color: var(--fg-muted);
    font-size: 13px;
    font-weight: 600;
    margin: var(--space-md) 0 var(--space-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hint { color: var(--fg-dim); font-size: 12px; margin: 0 0 var(--space-sm); }

  /* Palette Grid */
  .palette-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 4px;
  }

  .swatch {
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
    padding: 8px 6px;
    font-family: var(--font-mono);
    font-size: 9px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    transition: transform var(--transition-fast);
  }

  .swatch:hover { transform: scale(1.05); }
  .swatch-name { font-weight: 600; }
  .swatch-hex { opacity: 0.8; }

  /* Semantic Map */
  .semantic-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 4px;
  }

  .semantic-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 3px 6px;
    border-radius: var(--radius-sm);
  }

  .semantic-swatch {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    border: 1px solid var(--border-muted);
    flex-shrink: 0;
  }

  .semantic-key {
    color: var(--fg);
    font-size: 11px;
    font-weight: 500;
  }

  .semantic-hex {
    color: var(--fg-dim);
    font-size: 10px;
    margin-left: auto;
  }

  /* Entity Preview */
  .entity-row, .dungeon-preview, .region-row {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .entity-cell, .dungeon-cell, .region-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .tile {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-family: var(--font-mono);
    font-weight: bold;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-muted);
  }

  .entity-label {
    color: var(--fg-dim);
    font-size: 10px;
  }

  /* Dungeon Scene */
  .dungeon-scene {
    margin-top: var(--space-sm);
    padding: var(--space-sm);
    border-radius: var(--radius);
    border: 1px solid var(--border-muted);
    display: inline-block;
  }

  .dungeon-row {
    display: flex;
    line-height: 1;
  }

  .dungeon-char {
    font-family: var(--font-mono);
    font-size: 16px;
    width: 16px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Color Ramps */
  .ramp-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-xs);
  }

  .ramp-label {
    color: var(--fg-muted);
    font-size: 11px;
    width: 60px;
    text-align: right;
  }

  .ramp-bar {
    display: flex;
    flex: 1;
    height: 24px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border-muted);
  }

  .ramp-segment { flex: 1; }

  /* Region Swatches */
  .region-swatch {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-muted);
  }

  /* Contrast Pairs */
  .contrast-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-sm);
  }

  .contrast-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .contrast-preview {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    border: 1px solid var(--border-muted);
  }

  .contrast-label {
    color: var(--fg-dim);
    font-size: 10px;
    text-align: center;
  }
</style>
