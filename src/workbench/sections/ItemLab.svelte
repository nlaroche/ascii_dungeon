<script>
  import { onMount } from 'svelte';
  import ParamSlider from '../components/ParamSlider.svelte';
  import ParamSelect from '../components/ParamSelect.svelte';
  import StatBar from '../components/StatBar.svelte';
  import {
    RECORD_TYPES, MAX_LEVEL, ITEM_SLOTS, ITEM_TIERS,
    createItem, createLegacyItem, addRecordXP, xpToNextLevel,
    getItemDisplayName, getItemColor, getVisualStage, getVisualMark,
    getTotalLevel, getItemTooltip,
    detectResonance, detectEquipmentResonance, getEquipmentStats,
    getRecordDamage, getRecordCrit, getRecordDefense, getRecordDamageReduction,
    getRecordMaxHP, getRecordLifesteal, getRecordStaminaEfficiency,
    getRecordMovementSpeed, getRecordMapReveal, getRecordGoldBonus, getRecordRareChance,
  } from '../../lib/items.js';

  // ── State ──
  let equipment = {
    weapon: createItem('weapon', 1, () => 0.1),
    armor: createItem('armor', 1, () => 0.2),
    amulet: createItem('amulet', 1, () => 0.3),
  };

  let selectedSlot = 'weapon';
  let floorLevel = 1;
  let xpAmount = 15;
  let actionLog = [];
  let showGuide = false;

  // ── Derived ──
  $: selectedItem = equipment[selectedSlot];
  $: displayName = getItemDisplayName(selectedItem);
  $: itemColor = getItemColor(selectedItem);
  $: tooltip = getItemTooltip(selectedItem);
  $: eqResult = getEquipmentStats(equipment);
  $: stats = eqResult.stats;
  $: resonances = eqResult.resonances;

  // ── Actions ──
  function doAction(recordType, label) {
    equipment[selectedSlot] = addRecordXP(equipment[selectedSlot], recordType, xpAmount);
    equipment = equipment; // trigger reactivity
    const item = equipment[selectedSlot];
    const rec = item.records[recordType];
    log(`${label}: +${xpAmount} XP to ${recordType} on ${item.name} (Lv${rec.level}, ${rec.xp}/${rec.level >= MAX_LEVEL ? 'MAX' : xpToNextLevel(rec.level)} XP)`);
  }

  function generateNew() {
    equipment[selectedSlot] = createItem(selectedSlot, floorLevel);
    equipment = equipment;
    log(`Generated new ${equipment[selectedSlot].tier} ${selectedSlot}: ${equipment[selectedSlot].name}`);
  }

  function generateLegacy() {
    const overrides = {};
    const types = Object.keys(RECORD_TYPES);
    const chosen = types[Math.floor(Math.random() * types.length)];
    overrides[RECORD_TYPES[chosen]] = 3 + Math.floor(Math.random() * 5);
    equipment[selectedSlot] = createLegacyItem(selectedSlot, floorLevel, overrides);
    equipment = equipment;
    const item = equipment[selectedSlot];
    log(`Found ancient ${item.tier} ${item.name} with ${overrides[RECORD_TYPES[chosen]]} ${RECORD_TYPES[chosen]} levels!`);
  }

  function maxOutRecord(recordType) {
    let item = equipment[selectedSlot];
    for (let i = 0; i < 200; i++) {
      if (item.records[recordType].level >= MAX_LEVEL) break;
      item = addRecordXP(item, recordType, 5120);
    }
    equipment[selectedSlot] = item;
    equipment = equipment;
    log(`Maxed out ${recordType} on ${item.name} to Lv${item.records[recordType].level}`);
  }

  function resetItem() {
    equipment[selectedSlot] = createItem(selectedSlot, floorLevel);
    equipment = equipment;
    log(`Reset ${selectedSlot} to fresh item`);
  }

  function log(msg) {
    actionLog = [msg, ...actionLog.slice(0, 49)];
  }

  function pct(v) { return `${Math.round(v * 100)}%`; }

  const slotOptions = [
    { value: 'weapon', label: 'Weapon' },
    { value: 'armor', label: 'Armor' },
    { value: 'amulet', label: 'Amulet' },
  ];

  const RECORD_COLORS = {
    kill: '#ff4444',
    treasure: '#ffdd00',
    explore: '#44aaff',
    survive: '#44ff44',
  };

  const RECORD_LABELS = {
    kill: 'Kill',
    treasure: 'Treasure',
    explore: 'Explore',
    survive: 'Survive',
  };

  const ACTION_LABELS = {
    kill: 'Slay Enemy',
    treasure: 'Find Treasure',
    explore: 'Explore Dungeon',
    survive: 'Survive Hit',
  };
</script>

<div class="section">
  <div class="header-row">
    <h2>Item Lab</h2>
    <button class="guide-btn" on:click={() => showGuide = !showGuide}>
      {showGuide ? 'Hide Guide' : 'How It Works'}
    </button>
  </div>

  {#if showGuide}
    <div class="guide">
      <h3>Living Records Item System</h3>
      <p>Items grow and transform based on how you use them. Every action leaves a mark.</p>
      <div class="guide-grid">
        <div class="guide-card" style="border-color: #ff4444">
          <strong style="color: #ff4444">KILL</strong> — Slay enemies to sharpen your weapon.
          Grants bonus damage (+2 to +50), and crit chance at Lv5+ (up to 30%).
        </div>
        <div class="guide-card" style="border-color: #ffdd00">
          <strong style="color: #ffdd00">TREASURE</strong> — Collect gold and loot.
          Grants gold bonus at Lv2+ (up to +100%), rare item chance at Lv5+ (up to 25%).
        </div>
        <div class="guide-card" style="border-color: #44aaff">
          <strong style="color: #44aaff">EXPLORE</strong> — Traverse the dungeon.
          Reduces stamina cost (5%/lv), grants movement speed at Lv4+, map reveal at Lv2+.
        </div>
        <div class="guide-card" style="border-color: #44ff44">
          <strong style="color: #44ff44">SURVIVE</strong> — Take hits and endure.
          Grants defense (+2 to +50), damage reduction (5%/lv), +5 HP/lv, lifesteal at Lv3+.
        </div>
      </div>
      <h3>Resonance</h3>
      <p>When two equipped items share the same dominant record type at Lv3+, they <strong>resonate</strong>, creating a powerful combo bonus. Different primary types can also create complementary resonance (kill+survive = Warrior Soul, treasure+explore = Treasure Hunter, etc.).</p>
      <h3>Visual Growth</h3>
      <p>Each level-up adds a permanent visual mark to the item. The item's name changes with its primary record: a kill-focused sword becomes "Sharpened" at Lv1, "Bloodied" at Lv3, "Champion's" at Lv7, and "Legendary" at Lv10. Its color intensifies as it grows.</p>
      <h3>XP Curve</h3>
      <p>Lv1: 10 XP, Lv2: 20, Lv3: 40, Lv4: 80 ... Lv10: 5120 XP. Total to max one record: 10,230 XP.</p>
    </div>
  {/if}

  <div class="layout">
    <!-- LEFT: Equipment & Controls -->
    <div class="panel controls-panel">
      <h3>Equipment</h3>

      <div class="eq-slots">
        {#each ['weapon', 'armor', 'amulet'] as slot}
          {@const item = equipment[slot]}
          {@const color = getItemColor(item)}
          <button
            class="eq-slot"
            class:selected={selectedSlot === slot}
            on:click={() => selectedSlot = slot}
          >
            <span class="slot-char" style="color: {color}">{item.char}</span>
            <span class="slot-info">
              <span class="slot-name" style="color: {color}">{getItemDisplayName(item)}</span>
              <span class="slot-meta">[{item.tier}] {slot}</span>
            </span>
            {#if item.primaryRecord}
              <span class="slot-badge" style="background: {RECORD_COLORS[item.primaryRecord]}">{RECORD_LABELS[item.primaryRecord]} Lv{item.records[item.primaryRecord].level}</span>
            {:else}
              <span class="slot-badge empty">Fresh</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="divider"></div>

      <h3>Actions</h3>
      <ParamSlider label="XP per Action" min={1} max={200} step={1} value={xpAmount} on:change={e => xpAmount = e.detail} />

      <div class="action-grid">
        {#each Object.entries(ACTION_LABELS) as [type, label]}
          <button class="action-btn" style="border-color: {RECORD_COLORS[type]}" on:click={() => doAction(type, label)}>
            <span style="color: {RECORD_COLORS[type]}">{label}</span>
          </button>
        {/each}
      </div>

      <div class="divider"></div>

      <h3>Item Generation</h3>
      <ParamSlider label="Floor Level" min={1} max={30} step={1} value={floorLevel} on:change={e => floorLevel = e.detail} />
      <div class="gen-row">
        <button class="gen-btn" on:click={generateNew}>New Random</button>
        <button class="gen-btn legacy" on:click={generateLegacy}>Find Ancient</button>
        <button class="gen-btn danger" on:click={resetItem}>Reset</button>
      </div>

      <div class="divider"></div>

      <h3>Quick Max</h3>
      <div class="action-grid">
        {#each Object.entries(RECORD_LABELS) as [type, label]}
          <button class="max-btn" style="border-color: {RECORD_COLORS[type]}" on:click={() => maxOutRecord(type)}>
            Max {label}
          </button>
        {/each}
      </div>
    </div>

    <!-- MIDDLE: Item Details -->
    <div class="panel detail-panel">
      <h3>Selected Item</h3>

      <div class="item-header">
        <span class="big-char" style="color: {itemColor}">{selectedItem.char}</span>
        <div>
          <div class="item-name" style="color: {itemColor}">{displayName}</div>
          <div class="item-meta">[{selectedItem.tier}] {selectedItem.slot} | Floor {selectedItem.floorCreated} | Total Lv{getTotalLevel(selectedItem)}</div>
        </div>
      </div>

      <div class="records">
        {#each Object.entries(selectedItem.records) as [type, rec]}
          {@const needed = rec.level >= MAX_LEVEL ? 1 : xpToNextLevel(rec.level)}
          {@const xpPct = rec.level >= MAX_LEVEL ? 100 : Math.round(rec.xp / needed * 100)}
          {@const stage = getVisualStage(type, rec.level)}
          <div class="record-row">
            <div class="record-label" style="color: {RECORD_COLORS[type]}">{RECORD_LABELS[type]}</div>
            <div class="record-level">Lv{rec.level}</div>
            <div class="record-bar-wrap">
              <div class="record-bar" style="width: {xpPct}%; background: {RECORD_COLORS[type]}"></div>
            </div>
            <div class="record-xp">
              {#if rec.level >= MAX_LEVEL}MAX{:else}{rec.xp}/{needed}{/if}
            </div>
          </div>
          {#if rec.level > 0}
            <div class="record-bonus" style="color: {stage.color}">
              {stage.prefix ? `"${stage.prefix}"` : ''} — {getRecordBonusForType(type, rec.level)}
            </div>
          {/if}
        {/each}
      </div>

      {#if selectedItem.visualMarks.length > 0}
        <div class="marks-section">
          <h4>Visual Marks ({selectedItem.visualMarks.length})</h4>
          <div class="marks-list">
            {#each selectedItem.visualMarks as mark, i}
              <span class="mark">{mark}</span>
            {/each}
          </div>
        </div>
      {/if}

      <div class="divider"></div>

      <h3>Tooltip Preview</h3>
      <pre class="tooltip-preview">{tooltip.join('\n')}</pre>
    </div>

    <!-- RIGHT: Stats & Resonance -->
    <div class="panel stats-panel">
      <h3>Equipment Stats</h3>
      <div class="stat-group">
        <h4>Combat</h4>
        <StatBar label="Bonus Damage" value={stats.bonusDamage} max={Math.max(stats.bonusDamage, 60)} color="#ff4444" />
        <StatBar label="Crit Chance" value={Math.round(stats.critChance * 100)} max={50} color="#ff8844" />
        <StatBar label="Bonus Defense" value={stats.bonusDefense} max={Math.max(stats.bonusDefense, 60)} color="#4444ff" />
        <StatBar label="Damage Reduction" value={Math.round(stats.damageReduction * 100)} max={75} color="#6666ff" />
        <StatBar label="Bonus Max HP" value={stats.bonusMaxHP} max={Math.max(stats.bonusMaxHP, 50)} color="#44ff44" />
        <StatBar label="Lifesteal" value={Math.round(stats.lifesteal * 100)} max={50} color="#88ff88" />
      </div>
      <div class="stat-group">
        <h4>Movement</h4>
        <StatBar label="Stamina Eff." value={Math.round(stats.staminaEfficiency * 100)} max={100} color="#44aaff" />
        <StatBar label="Move Speed" value={Math.round(stats.movementSpeed * 100)} max={100} color="#66ccff" />
        <StatBar label="Map Reveal" value={stats.mapReveal} max={20} color="#8888ff" />
      </div>
      <div class="stat-group">
        <h4>Fortune</h4>
        <StatBar label="Gold Bonus" value={Math.round(stats.goldBonus * 100)} max={100} color="#ffdd00" />
        <StatBar label="Rare Chance" value={Math.round(stats.rareItemChance * 100)} max={50} color="#ffaa00" />
      </div>

      <div class="divider"></div>

      <h3>Resonance</h3>
      {#if resonances.length > 0}
        {#each resonances as r}
          <div class="resonance-card" style="border-color: {r.color}">
            <div class="res-label" style="color: {r.color}">{r.label}</div>
            <div class="res-desc">{r.description}</div>
            <StatBar label="Strength" value={r.strength} max={50} color={r.color} />
          </div>
        {/each}
      {:else}
        <div class="no-resonance">
          No resonance active. Equip items with matching or complementary primary records at Lv3+ to activate.
        </div>
      {/if}

      <div class="divider"></div>

      <h3>Resonance Map</h3>
      <div class="res-map">
        <div class="res-map-row"><span class="res-combo">Kill + Kill</span> = <span style="color:#ff0000">Blood Brothers</span> (+damage)</div>
        <div class="res-map-row"><span class="res-combo">Treasure + Treasure</span> = <span style="color:#ffdd00">Golden Pair</span> (+gold)</div>
        <div class="res-map-row"><span class="res-combo">Explore + Explore</span> = <span style="color:#00aaff">Pathfinders</span> (+movement)</div>
        <div class="res-map-row"><span class="res-combo">Survive + Survive</span> = <span style="color:#8888ff">Iron Bond</span> (+defense)</div>
        <div class="res-map-row"><span class="res-combo">Kill + Survive</span> = <span style="color:#ff8800">Warrior Soul</span> (+atk & def)</div>
        <div class="res-map-row"><span class="res-combo">Treasure + Explore</span> = <span style="color:#44ff44">Treasure Hunter</span> (+loot & speed)</div>
        <div class="res-map-row"><span class="res-combo">Kill + Treasure</span> = <span style="color:#ff4400">Berserker</span> (+offense)</div>
        <div class="res-map-row"><span class="res-combo">Explore + Survive</span> = <span style="color:#ffff88">Paladin</span> (+tank)</div>
      </div>
    </div>
  </div>

  <!-- Action Log -->
  <div class="log-panel">
    <h3>Action Log</h3>
    <div class="log-scroll">
      {#each actionLog as msg, i}
        <div class="log-entry" style="opacity: {1 - i * 0.02}">{msg}</div>
      {/each}
      {#if actionLog.length === 0}
        <div class="log-empty">Perform actions to see results here...</div>
      {/if}
    </div>
  </div>
</div>

<script context="module">
  function getRecordBonusForType(type, level) {
    if (level < 1) return 'No bonus';
    switch (type) {
      case 'kill': {
        const dmg = Math.floor(2 * Math.pow(1.8, level - 1));
        const crit = level >= 5 ? `, ${Math.min(30, (level - 4) * 5)}% crit` : '';
        return `+${dmg} damage${crit}`;
      }
      case 'treasure': {
        const gold = level >= 2 ? `+${(level - 1) * 10}% gold` : 'no bonus yet';
        const rare = level >= 5 ? `, +${(level - 4) * 5}% rare` : '';
        return gold + rare;
      }
      case 'explore': {
        const stam = `${level * 5}% less stamina`;
        const spd = level >= 4 ? `, +${(level - 3) * 10}% speed` : '';
        const map = level >= 2 ? `, +${(level - 1) * 2} reveal` : '';
        return stam + spd + map;
      }
      case 'survive': {
        const def = Math.floor(2 * Math.pow(1.7, level - 1));
        return `+${def} def, ${level * 5}% DR, +${level * 5} HP${level >= 3 ? `, ${(level - 2) * 5}% lifesteal` : ''}`;
      }
      default: return '';
    }
  }
</script>

<style>
  .section h2 { color: #ffaa00; margin-bottom: 10px; }
  .section h3 { color: #aaa; margin: 10px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
  .section h4 { color: #777; margin: 8px 0 4px; font-size: 11px; text-transform: uppercase; }

  .header-row { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }
  .guide-btn {
    background: #222; color: #ffaa00; border: 1px solid #444; padding: 4px 12px;
    font-family: monospace; font-size: 11px; cursor: pointer; border-radius: 3px;
  }
  .guide-btn:hover { border-color: #ffaa00; }

  .guide {
    background: #0a0a18; border: 1px solid #333; border-radius: 4px; padding: 16px;
    margin-bottom: 16px; font-size: 12px; line-height: 1.6; color: #ccc;
  }
  .guide h3 { color: #ffaa00; margin-top: 16px; }
  .guide h3:first-child { margin-top: 0; }
  .guide p { margin: 6px 0; }
  .guide-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
  .guide-card {
    background: #111; border-left: 3px solid; padding: 8px 12px; font-size: 11px;
    border-radius: 0 3px 3px 0;
  }

  .layout { display: grid; grid-template-columns: 280px 1fr 300px; gap: 16px; }
  .panel { background: #0d0d1a; border: 1px solid #222; border-radius: 4px; padding: 12px; }

  /* Equipment Slots */
  .eq-slots { display: flex; flex-direction: column; gap: 6px; }
  .eq-slot {
    display: flex; align-items: center; gap: 8px; padding: 8px;
    background: #111; border: 1px solid #333; border-radius: 3px;
    cursor: pointer; font-family: monospace; font-size: 12px; color: #ccc;
    text-align: left;
  }
  .eq-slot:hover { border-color: #555; }
  .eq-slot.selected { border-color: #ffaa00; background: #1a1a28; }
  .slot-char { font-size: 20px; width: 28px; text-align: center; }
  .slot-info { flex: 1; display: flex; flex-direction: column; }
  .slot-name { font-size: 11px; font-weight: bold; }
  .slot-meta { font-size: 10px; color: #666; }
  .slot-badge {
    font-size: 9px; padding: 2px 6px; border-radius: 3px; color: #000; font-weight: bold;
  }
  .slot-badge.empty { background: #444; color: #888; }

  .divider { border-top: 1px solid #222; margin: 12px 0; }

  /* Actions */
  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .action-btn {
    background: #111; border: 1px solid; padding: 8px 6px;
    font-family: monospace; font-size: 11px; cursor: pointer; border-radius: 3px;
    color: #ccc;
  }
  .action-btn:hover { background: #1a1a28; }
  .action-btn:active { transform: scale(0.97); }

  .gen-row { display: flex; gap: 6px; }
  .gen-btn {
    flex: 1; background: #111; border: 1px solid #444; padding: 6px 8px;
    font-family: monospace; font-size: 11px; color: #ccc; cursor: pointer;
    border-radius: 3px;
  }
  .gen-btn:hover { border-color: #888; }
  .gen-btn.legacy { border-color: #886600; color: #ffaa00; }
  .gen-btn.legacy:hover { border-color: #ffaa00; }
  .gen-btn.danger { border-color: #662222; color: #ff4444; }
  .gen-btn.danger:hover { border-color: #ff4444; }

  .max-btn {
    background: #111; border: 1px solid; padding: 4px 6px;
    font-family: monospace; font-size: 10px; cursor: pointer; border-radius: 3px;
    color: #888;
  }
  .max-btn:hover { color: #eee; background: #1a1a28; }

  /* Item Details */
  .item-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .big-char { font-size: 36px; }
  .item-name { font-size: 16px; font-weight: bold; }
  .item-meta { font-size: 11px; color: #666; }

  .records { display: flex; flex-direction: column; gap: 2px; }
  .record-row { display: flex; align-items: center; gap: 8px; height: 20px; }
  .record-label { width: 70px; font-size: 11px; font-weight: bold; }
  .record-level { width: 30px; font-size: 11px; text-align: right; color: #aaa; }
  .record-bar-wrap { flex: 1; height: 6px; background: #1a1a28; border-radius: 3px; overflow: hidden; }
  .record-bar { height: 100%; transition: width 0.3s ease; border-radius: 3px; }
  .record-xp { width: 70px; font-size: 10px; color: #666; text-align: right; }
  .record-bonus { font-size: 10px; margin-left: 108px; margin-bottom: 4px; }

  .marks-section { margin-top: 12px; }
  .marks-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .mark {
    background: #1a1a28; border: 1px solid #333; padding: 2px 8px;
    font-size: 10px; color: #aaa; border-radius: 3px;
  }

  .tooltip-preview {
    background: #0a0a14; border: 1px solid #333; border-radius: 3px;
    padding: 10px; font-size: 11px; color: #ccc; line-height: 1.5;
    white-space: pre; overflow-x: auto; margin: 0;
  }

  /* Stats */
  .stat-group { margin-bottom: 8px; }

  /* Resonance */
  .resonance-card {
    background: #111; border: 1px solid; border-radius: 4px; padding: 8px;
    margin-bottom: 8px;
  }
  .res-label { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
  .res-desc { font-size: 11px; color: #aaa; margin-bottom: 6px; }
  .no-resonance { font-size: 11px; color: #555; padding: 8px; background: #111; border-radius: 3px; }

  .res-map { font-size: 10px; line-height: 1.8; }
  .res-map-row { color: #888; }
  .res-combo { color: #aaa; }

  /* Log */
  .log-panel {
    margin-top: 16px; background: #0a0a14; border: 1px solid #222;
    border-radius: 4px; padding: 12px;
  }
  .log-scroll { max-height: 120px; overflow-y: auto; }
  .log-entry { font-size: 11px; color: #888; padding: 2px 0; border-bottom: 1px solid #1a1a1a; }
  .log-empty { font-size: 11px; color: #444; }

  @media (max-width: 1200px) {
    .layout { grid-template-columns: 1fr; }
  }
</style>
