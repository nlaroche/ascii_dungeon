<script>
  import { 
    createItem, addRecordXP, getEquipmentStats, detectResonance, detectEquipmentResonance,
    getVisualStage, getItemDisplayName, getItemColor,
    RECORD_TYPES, ITEM_SLOTS, ITEM_TIERS, MAX_LEVEL, xpToNextLevel
  } from '../../lib/items.js';
  
  // State
  let floorLevel = 5;
  let inventory = [];
  let selectedItem = null;
  let equipment = { weapon: null, armor: null, amulet: null };
  let bulkMode = false;
  
  const MAX_INVENTORY = 10;
  
  // XP amounts
  const XP_AMOUNTS = {
    kill: 10,
    treasure: 15,
    explore: 8,
    survive: 12
  };
  
  // Tier colors
  const TIER_COLORS = {
    common: '#aaaaaa',
    uncommon: '#44ff44',
    rare: '#4488ff',
    epic: '#aa44ff',
    legendary: '#ffaa00'
  };
  
  // Record type colors
  const RECORD_COLORS = {
    kill: '#ff4444',
    treasure: '#ffdd00',
    explore: '#44aaff',
    survive: '#44ff44'
  };
  
  // Generate a random item
  function generateItem(slot) {
    const item = createItem(slot, floorLevel, Math.random);
    if (inventory.length >= MAX_INVENTORY) {
      inventory.shift();
    }
    inventory = [...inventory, item];
    selectedItem = item;
  }
  
  // Add XP to selected item
  function addXP(recordType) {
    if (!selectedItem) return;
    const amount = bulkMode ? 50 : XP_AMOUNTS[recordType];
    selectedItem = addRecordXP(selectedItem, recordType, amount);
    // Update in inventory
    const idx = inventory.findIndex(i => i.id === selectedItem.id);
    if (idx >= 0) {
      inventory[idx] = selectedItem;
      inventory = inventory;
    }
  }
  
  // Equip item to slot
  function equipItem(slot) {
    if (!selectedItem) return;
    if (selectedItem.slot !== slot) return;
    equipment[slot] = selectedItem;
    equipment = equipment;
  }
  
  // Unequip slot
  function unequipItem(slot) {
    equipment[slot] = null;
    equipment = equipment;
  }
  
  // Get derived stats for an item
  function getItemDerivedStats(item) {
    if (!item) return null;
    const stats = {
      bonusDamage: 0,
      critChance: 0,
      bonusDefense: 0,
      damageReduction: 0,
      bonusMaxHP: 0,
      lifesteal: 0,
      staminaEfficiency: 1.0,
      movementSpeed: 0,
      mapReveal: 0,
      goldBonus: 0,
      rareItemChance: 0
    };
    
    // Calculate from item records
    const kill = item.records?.kill?.level || 0;
    const treasure = item.records?.treasure?.level || 0;
    const explore = item.records?.explore?.level || 0;
    const survive = item.records?.survive?.level || 0;
    
    // Kill record bonuses
    if (kill >= 1) {
      stats.bonusDamage += Math.floor(2 * Math.pow(1.8, kill - 1));
    }
    if (kill >= 5) {
      stats.critChance = Math.min(0.30, (kill - 4) * 0.05);
    }
    
    // Survive record bonuses
    if (survive >= 1) {
      stats.bonusDefense += Math.floor(2 * Math.pow(1.7, survive - 1));
    }
    stats.damageReduction = Math.min(0.50, survive * 0.05);
    stats.bonusMaxHP = survive * 5;
    if (survive >= 3) {
      stats.lifesteal = Math.min(0.25, (survive - 2) * 0.05);
    }
    
    // Explore record bonuses
    stats.staminaEfficiency = Math.max(0.50, 1.0 - explore * 0.05);
    if (explore >= 4) {
      stats.movementSpeed = Math.min(0.50, (explore - 3) * 0.10);
    }
    if (explore >= 2) {
      stats.mapReveal = (explore - 1) * 2;
    }
    
    // Treasure record bonuses
    if (treasure >= 2) {
      stats.goldBonus = Math.min(1.0, (treasure - 1) * 0.10);
    }
    if (treasure >= 5) {
      stats.rareItemChance = Math.min(0.25, (treasure - 4) * 0.05);
    }
    
    // Add base stats
    stats.bonusDamage += item.baseDamage || 0;
    stats.bonusDefense += item.baseDefense || 0;
    
    return stats;
  }
  
  // Get progress percentage for a record
  function getRecordProgress(record) {
    if (!record || record.level >= MAX_LEVEL) return 100;
    const needed = xpToNextLevel(record.level);
    return Math.min(100, (record.xp / needed) * 100);
  }
  
  // Get resonances
  $: resonances = detectEquipmentResonance(equipment);
  $: activeResonance = resonances.length > 0 ? resonances[0] : null;
</script>

<div class="section">
  <h2>Items Lab</h2>
  
  <!-- Section 1: Item Generator -->
  <div class="generator-section">
    <h3>Item Generator</h3>
    <div class="generator-controls">
      <div class="slider-group">
        <label>Floor Level: <span class="value">{floorLevel}</span></label>
        <input 
          type="range" 
          min="1" 
          max="30" 
          step="1" 
          bind:value={floorLevel}
        />
      </div>
      <div class="button-row">
        <button on:click={() => generateItem('weapon')}>Generate Weapon</button>
        <button on:click={() => generateItem('armor')}>Generate Armor</button>
        <button on:click={() => generateItem('amulet')}>Generate Amulet</button>
      </div>
    </div>
    
    <div class="inventory">
      <h4>Inventory ({inventory.length}/{MAX_INVENTORY})</h4>
      <div class="inventory-grid">
        {#each inventory as item}
          <button 
            class="inventory-item"
            class:selected={selectedItem?.id === item.id}
            on:click={() => selectedItem = item}
          >
            <span class="glyph" style="color: {getItemColor(item)}">{item.char}</span>
            <span class="item-name">{getItemDisplayName(item)}</span>
            <span class="tier-badge" style="background: {TIER_COLORS[item.tier]}">{item.tier}</span>
            <span class="slot-badge">{item.slot}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
  
  <!-- Section 2: Item Inspector -->
  <div class="inspector-section">
    <h3>Item Inspector</h3>
    {#if selectedItem}
      <div class="inspector-content">
        <div class="item-header">
          <span class="glyph large" style="color: {getItemColor(selectedItem)}">{selectedItem.char}</span>
          <div class="item-title">
            <h4>{getItemDisplayName(selectedItem)}</h4>
            <span class="tier-slot">[{selectedItem.tier}] {selectedItem.slot}</span>
          </div>
        </div>
        
        <div class="record-bars">
          <h5>Records</h5>
          {#each Object.entries(selectedItem.records) as [type, record]}
            <div class="record-bar">
              <div class="record-label">
                <span class="record-name" style="color: {RECORD_COLORS[type]}">{type}</span>
                <span class="record-level">Lv {record.level}/{MAX_LEVEL}</span>
              </div>
              <div class="progress-track">
                <div 
                  class="progress-fill {type}"
                  style="width: {getRecordProgress(record)}%; background: {RECORD_COLORS[type]}"
                ></div>
              </div>
              <span class="xp-text">
                {record.xp}/{record.level >= MAX_LEVEL ? 'MAX' : xpToNextLevel(record.level)} XP
              </span>
            </div>
          {/each}
        </div>
        
        {#if selectedItem.visualMarks && selectedItem.visualMarks.length > 0}
          <div class="visual-marks">
            <h5>Visual Marks</h5>
            <ul>
              {#each selectedItem.visualMarks as mark}
                <li>{mark}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        <div class="derived-stats">
          <h5>Derived Stats</h5>
          {#each Object.entries(getItemDerivedStats(selectedItem)) as [stat, value]}
            <div class="stat-row">
              <span class="stat-name">{stat.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span class="stat-value">
                {#if typeof value === 'number'}
                  {stat.includes('Efficiency') || stat.includes('Chance') || stat.includes('Reduction') || stat.includes('Speed') || stat.includes('Chance') 
                    ? (value * 100).toFixed(0) + '%' 
                    : value.toFixed(value < 1 && value > 0 ? 2 : 0)}
                {:else}
                  {value}
                {/if}
              </span>
            </div>
          {/each}
        </div>
        
        {#if selectedItem.primaryRecord}
          <div class="primary-record">
            Primary Record: <span style="color: {RECORD_COLORS[selectedItem.primaryRecord]}">{selectedItem.primaryRecord}</span>
          </div>
        {/if}
      </div>
    {:else}
      <p class="no-selection">Select an item from inventory to inspect</p>
    {/if}
  </div>
  
  <!-- Section 3: Record Simulator -->
  <div class="simulator-section">
    <h3>Record Simulator</h3>
    <div class="simulator-controls">
      <div class="bulk-toggle">
        <label>
          <input type="checkbox" bind:checked={bulkMode} />
          Bulk Mode (+50 XP)
        </label>
      </div>
      <div class="action-buttons">
        <button 
          class="action-btn kill" 
          on:click={() => addXP('kill')}
          disabled={!selectedItem}
        >
          Kill Enemy (+{bulkMode ? 50 : XP_AMOUNTS.kill} XP)
        </button>
        <button 
          class="action-btn treasure" 
          on:click={() => addXP('treasure')}
          disabled={!selectedItem}
        >
          Find Treasure (+{bulkMode ? 50 : XP_AMOUNTS.treasure} XP)
        </button>
        <button 
          class="action-btn explore" 
          on:click={() => addXP('explore')}
          disabled={!selectedItem}
        >
          Explore Room (+{bulkMode ? 50 : XP_AMOUNTS.explore} XP)
        </button>
        <button 
          class="action-btn survive" 
          on:click={() => addXP('survive')}
          disabled={!selectedItem}
        >
          Survive Hit (+{bulkMode ? 50 : XP_AMOUNTS.survive} XP)
        </button>
      </div>
    </div>
  </div>
  
  <!-- Section 4: Equipment & Resonance -->
  <div class="equipment-section">
    <h3>Equipment & Resonance</h3>
    <div class="equipment-slots">
      <div class="equip-slot">
        <span class="slot-label">Weapon</span>
        {#if equipment.weapon}
          <button class="equipped-item" on:click={() => unequipItem('weapon')}>
            <span class="glyph" style="color: {getItemColor(equipment.weapon)}">{equipment.weapon.char}</span>
            <span>{getItemDisplayName(equipment.weapon)}</span>
            <span class="unequip-btn">Unequip</span>
          </button>
        {:else}
          <button 
            class="empty-slot"
            class:can-equip={selectedItem?.slot === 'weapon'}
            on:click={() => equipItem('weapon')}
            disabled={!selectedItem || selectedItem.slot !== 'weapon'}
          >
            Empty
          </button>
        {/if}
      </div>
      
      <div class="equip-slot">
        <span class="slot-label">Armor</span>
        {#if equipment.armor}
          <button class="equipped-item" on:click={() => unequipItem('armor')}>
            <span class="glyph" style="color: {getItemColor(equipment.armor)}">{equipment.armor.char}</span>
            <span>{getItemDisplayName(equipment.armor)}</span>
            <span class="unequip-btn">Unequip</span>
          </button>
        {:else}
          <button 
            class="empty-slot"
            class:can-equip={selectedItem?.slot === 'armor'}
            on:click={() => equipItem('armor')}
            disabled={!selectedItem || selectedItem.slot !== 'armor'}
          >
            Empty
          </button>
        {/if}
      </div>
      
      <div class="equip-slot">
        <span class="slot-label">Amulet</span>
        {#if equipment.amulet}
          <button class="equipped-item" on:click={() => unequipItem('amulet')}>
            <span class="glyph" style="color: {getItemColor(equipment.amulet)}">{equipment.amulet.char}</span>
            <span>{getItemDisplayName(equipment.amulet)}</span>
            <span class="unequip-btn">Unequip</span>
          </button>
        {:else}
          <button 
            class="empty-slot"
            class:can-equip={selectedItem?.slot === 'amulet'}
            on:click={() => equipItem('amulet')}
            disabled={!selectedItem || selectedItem.slot !== 'amulet'}
          >
            Empty
          </button>
        {/if}
      </div>
    </div>
    
    <div class="resonance-display">
      {#if activeResonance}
        <div class="resonance-active" style="border-color: {activeResonance.color}; box-shadow: 0 0 10px {activeResonance.color}40">
          <h4 style="color: {activeResonance.color}">{activeResonance.label}</h4>
          <p>{activeResonance.description}</p>
          <span class="resonance-strength">Strength: {activeResonance.strength}%</span>
        </div>
      {:else}
        <div class="resonance-inactive">
          <p>No resonance - equip items with matching primary records</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .section h2 {
    color: #ffaa00;
    margin-bottom: 20px;
  }
  
  .section h3 {
    color: #ffaa00;
    margin: 20px 0 15px;
    font-size: 16px;
  }
  
  .section h4 {
    color: #ccc;
    margin: 10px 0;
    font-size: 14px;
  }
  
  .section h5 {
    color: #888;
    margin: 10px 0 8px;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  /* Generator Section */
  .generator-controls {
    margin-bottom: 15px;
  }
  
  .slider-group {
    margin-bottom: 12px;
  }
  
  .slider-group label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    color: #888;
  }
  
  .slider-group .value {
    color: #00ffff;
    font-weight: bold;
  }
  
  .slider-group input[type="range"] {
    width: 200px;
    height: 6px;
    background: #333;
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
  }
  
  .slider-group input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #00ff00;
    border-radius: 50%;
    cursor: pointer;
  }
  
  .button-row {
    display: flex;
    gap: 10px;
  }
  
  .button-row button {
    background: #333;
    color: #eee;
    border: 1px solid #555;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 12px;
  }
  
  .button-row button:hover {
    background: #444;
    border-color: #777;
  }
  
  /* Inventory */
  .inventory {
    margin-top: 15px;
  }
  
  .inventory-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .inventory-item {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #222;
    border: 1px solid #444;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
  }
  
  .inventory-item:hover {
    border-color: #666;
  }
  
  .inventory-item.selected {
    border-color: #00ffff;
    background: #2a2a3a;
  }
  
  .inventory-item .glyph {
    font-size: 14px;
    font-weight: bold;
  }
  
  .inventory-item .item-name {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .tier-badge, .slot-badge {
    font-size: 9px;
    padding: 2px 4px;
    border-radius: 2px;
    text-transform: uppercase;
  }
  
  .tier-badge {
    color: #111;
    font-weight: bold;
  }
  
  .slot-badge {
    background: #444;
    color: #aaa;
  }
  
  /* Inspector */
  .inspector-content {
    background: #1a1a24;
    padding: 15px;
    border-radius: 6px;
    border: 1px solid #333;
  }
  
  .item-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid #333;
  }
  
  .glyph.large {
    font-size: 32px;
    font-weight: bold;
  }
  
  .item-title h4 {
    margin: 0;
    font-size: 16px;
    color: #fff;
  }
  
  .tier-slot {
    font-size: 11px;
    color: #888;
  }
  
  .no-selection {
    color: #666;
    font-style: italic;
    padding: 20px;
    text-align: center;
  }
  
  /* Record Bars */
  .record-bars {
    margin-bottom: 15px;
  }
  
  .record-bar {
    margin-bottom: 10px;
  }
  
  .record-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
    font-size: 11px;
  }
  
  .record-name {
    text-transform: capitalize;
    font-weight: bold;
  }
  
  .record-level {
    color: #888;
  }
  
  .progress-track {
    height: 8px;
    background: #333;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.2s ease;
  }
  
  .xp-text {
    font-size: 10px;
    color: #666;
  }
  
  /* Visual Marks */
  .visual-marks {
    margin-bottom: 15px;
  }
  
  .visual-marks ul {
    list-style: none;
    padding: 0;
    margin: 5px 0;
  }
  
  .visual-marks li {
    font-size: 11px;
    color: #888;
    padding: 2px 0;
  }
  
  /* Derived Stats */
  .derived-stats {
    margin-bottom: 15px;
  }
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    padding: 3px 0;
    border-bottom: 1px solid #2a2a3a;
  }
  
  .stat-name {
    color: #888;
    text-transform: capitalize;
  }
  
  .stat-value {
    color: #00ff88;
    font-weight: bold;
  }
  
  .primary-record {
    font-size: 12px;
    color: #aaa;
    padding: 8px;
    background: #222;
    border-radius: 4px;
    text-align: center;
  }
  
  /* Simulator */
  .simulator-controls {
    background: #1a1a24;
    padding: 15px;
    border-radius: 6px;
    border: 1px solid #333;
  }
  
  .bulk-toggle {
    margin-bottom: 12px;
  }
  
  .bulk-toggle label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #888;
    cursor: pointer;
  }
  
  .bulk-toggle input[type="checkbox"] {
    width: 16px;
    height: 16px;
  }
  
  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .action-btn {
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
    color: #fff;
    transition: all 0.2s;
  }
  
  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .action-btn.kill { background: #aa3333; }
  .action-btn.kill:hover:not(:disabled) { background: #cc4444; }
  
  .action-btn.treasure { background: #aa8800; }
  .action-btn.treasure:hover:not(:disabled) { background: #ccaa00; }
  
  .action-btn.explore { background: #3366aa; }
  .action-btn.explore:hover:not(:disabled) { background: #4488cc; }
  
  .action-btn.survive { background: #33aa33; }
  .action-btn.survive:hover:not(:disabled) { background: #44cc44; }
  
  /* Equipment */
  .equipment-slots {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
  }
  
  .equip-slot {
    flex: 1;
  }
  
  .slot-label {
    display: block;
    font-size: 11px;
    color: #888;
    margin-bottom: 5px;
    text-transform: uppercase;
  }
  
  .empty-slot, .equipped-item {
    width: 100%;
    padding: 12px;
    background: #222;
    border: 2px dashed #444;
    border-radius: 6px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
    color: #666;
    text-align: center;
    transition: all 0.2s;
  }
  
  .empty-slot.can-equip {
    border-color: #666;
    color: #888;
  }
  
  .empty-slot:hover:not(:disabled) {
    border-color: #00ffff;
    color: #00ffff;
  }
  
  .empty-slot:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .equipped-item {
    display: flex;
    align-items: center;
    gap: 8px;
    border-style: solid;
    border-color: #555;
    color: #ccc;
  }
  
  .equipped-item:hover {
    border-color: #ff6666;
  }
  
  .equipped-item .glyph {
    font-size: 18px;
    font-weight: bold;
  }
  
  .unequip-btn {
    margin-left: auto;
    font-size: 9px;
    color: #ff4444;
    text-transform: uppercase;
  }
  
  /* Resonance */
  .resonance-display {
    min-height: 80px;
  }
  
  .resonance-active {
    background: #1a1a28;
    border: 2px solid;
    border-radius: 6px;
    padding: 15px;
    text-align: center;
  }
  
  .resonance-active h4 {
    margin: 0 0 5px;
  }
  
  .resonance-active p {
    font-size: 12px;
    color: #aaa;
    margin: 5px 0;
  }
  
  .resonance-strength {
    font-size: 11px;
    color: #888;
  }
  
  .resonance-inactive {
    padding: 20px;
    text-align: center;
    background: #1a1a24;
    border-radius: 6px;
    border: 1px solid #333;
  }
  
  .resonance-inactive p {
    color: #666;
    font-size: 12px;
    margin: 0;
  }
</style>
