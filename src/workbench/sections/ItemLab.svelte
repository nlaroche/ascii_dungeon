<script>
  import { onMount } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
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
  import { COLORS } from '../../lib/palette.js';

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
  $: totalLevel = getTotalLevel(selectedItem);

  // Muted record colors
  const REC = {
    kill:     { color: COLORS.combat, dim: COLORS.bgMuted, label: 'Kill',     action: 'Slay Enemy' },
    treasure: { color: COLORS.fortune, dim: COLORS.bgMuted, label: 'Treasure', action: 'Find Treasure' },
    explore:  { color: COLORS.defense, dim: COLORS.bgMuted, label: 'Explore',  action: 'Explore Dungeon' },
    survive:  { color: COLORS.vitality, dim: COLORS.bgMuted, label: 'Survive',  action: 'Survive Hit' },
  };

  // ── Actions ──
  function doAction(recordType) {
    equipment[selectedSlot] = addRecordXP(equipment[selectedSlot], recordType, xpAmount);
    equipment = equipment;
    const item = equipment[selectedSlot];
    const rec = item.records[recordType];
    log(`+${xpAmount} XP → ${REC[recordType].label} on ${item.name} (Lv${rec.level}, ${rec.xp}/${rec.level >= MAX_LEVEL ? 'MAX' : xpToNextLevel(rec.level)} XP)`);
  }

  function generateNew() {
    equipment[selectedSlot] = createItem(selectedSlot, floorLevel);
    equipment = equipment;
    log(`New ${equipment[selectedSlot].tier} ${selectedSlot}: ${equipment[selectedSlot].name}`);
  }

  function generateLegacy() {
    const overrides = {};
    const types = Object.keys(RECORD_TYPES);
    const chosen = types[Math.floor(Math.random() * types.length)];
    overrides[RECORD_TYPES[chosen]] = 3 + Math.floor(Math.random() * 5);
    equipment[selectedSlot] = createLegacyItem(selectedSlot, floorLevel, overrides);
    equipment = equipment;
    const item = equipment[selectedSlot];
    log(`Ancient ${item.tier} ${item.name} — ${overrides[RECORD_TYPES[chosen]]} ${RECORD_TYPES[chosen]} levels`);
  }

  function maxOutRecord(recordType) {
    let item = equipment[selectedSlot];
    for (let i = 0; i < 200; i++) {
      if (item.records[recordType].level >= MAX_LEVEL) break;
      item = addRecordXP(item, recordType, 5120);
    }
    equipment[selectedSlot] = item;
    equipment = equipment;
    log(`Maxed ${recordType} → Lv${item.records[recordType].level}`);
  }

  function resetItem() {
    equipment[selectedSlot] = createItem(selectedSlot, floorLevel);
    equipment = equipment;
    log(`Reset ${selectedSlot}`);
  }

  function log(msg) {
    actionLog = [msg, ...actionLog.slice(0, 49)];
  }
</script>

<div class="lab">
  <!-- Header -->
  <header class="lab-header">
    <div class="title-group">
      <h2>Item Lab</h2>
      <button class="text-btn" on:click={() => showGuide = !showGuide}>
        {showGuide ? 'Hide guide' : 'How it works'}
      </button>
    </div>
    <div class="item-badge" style="--c: {itemColor}">
      <span class="badge-char">{selectedItem.char}</span>
      <div class="badge-info">
        <span class="badge-name">{displayName}</span>
        <span class="badge-meta">Total Lv{totalLevel}</span>
      </div>
    </div>
  </header>

  {#if showGuide}
    <div class="guide" transition:slide={{ duration: 200, easing: quintOut }}>
      <p class="guide-lead">Items grow and transform based on how you use them. Every action leaves a permanent mark.</p>
      <div class="guide-grid">
        {#each Object.entries(REC) as [type, r]}
          <div class="guide-card" style="--c: {r.color}">
            <strong>{r.label}</strong>
            <span>
              {#if type === 'kill'}Slay enemies for bonus damage (+2 to +50), crit chance at Lv5+.
              {:else if type === 'treasure'}Collect loot for gold bonus at Lv2+, rare drops at Lv5+.
              {:else if type === 'explore'}Traverse the dungeon for stamina reduction, speed at Lv4+, map reveal at Lv2+.
              {:else}Take hits for defense, damage reduction, +5 HP/lv, lifesteal at Lv3+.
              {/if}
            </span>
          </div>
        {/each}
      </div>
      <div class="guide-row"><strong>Resonance</strong> — Matching dominant records at Lv3+ across items create combo bonuses.</div>
      <div class="guide-row"><strong>Growth</strong> — Names evolve with primary record. XP doubles each level: 10 → 20 → 40 → ... → 5120.</div>
    </div>
  {/if}

  <!-- Main layout -->
  <div class="main-grid">

    <!-- LEFT: Equipment & Controls -->
    <section class="panel">
      <h4>Equipment</h4>
      <div class="eq-slots">
        {#each ['weapon', 'armor', 'amulet'] as slot}
          {@const item = equipment[slot]}
          {@const color = getItemColor(item)}
          {@const active = selectedSlot === slot}
          <button class="eq-slot" class:active on:click={() => selectedSlot = slot}>
            <span class="slot-char" style="color: {color}">{item.char}</span>
            <span class="slot-body">
              <span class="slot-name" style="color: {color}">{getItemDisplayName(item)}</span>
              <span class="slot-meta">{item.tier} {slot}</span>
            </span>
            {#if item.primaryRecord}
              {@const pr = item.primaryRecord}
              <span class="slot-tag" style="--c: {REC[pr].color}">{REC[pr].label} {item.records[pr].level}</span>
            {:else}
              <span class="slot-tag dim">Fresh</span>
            {/if}
          </button>
        {/each}
      </div>

      <h4>Actions</h4>
      <ParamSlider label="XP per action" min={1} max={200} step={1} value={xpAmount} on:change={e => xpAmount = e.detail} />
      <div class="btn-grid">
        {#each Object.entries(REC) as [type, r]}
          <button class="act-btn" style="--c: {r.color}" on:click={() => doAction(type)}>
            {r.action}
          </button>
        {/each}
      </div>

      <h4>Generate</h4>
      <ParamSlider label="Floor level" min={1} max={30} step={1} value={floorLevel} on:change={e => floorLevel = e.detail} />
      <div class="btn-row">
        <button class="text-btn" on:click={generateNew}>Random</button>
        <button class="text-btn gold" on:click={generateLegacy}>Ancient</button>
        <button class="text-btn danger" on:click={resetItem}>Reset</button>
      </div>

      <h4>Quick Max</h4>
      <div class="btn-grid sm">
        {#each Object.entries(REC) as [type, r]}
          <button class="max-btn" style="--c: {r.color}" on:click={() => maxOutRecord(type)}>
            {r.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- MIDDLE: Item Details -->
    <section class="panel detail">
      <div class="item-hero" style="--c: {itemColor}">
        <span class="hero-char">{selectedItem.char}</span>
        <div>
          <div class="hero-name">{displayName}</div>
          <div class="hero-meta">{selectedItem.tier} {selectedItem.slot} · Floor {selectedItem.floorCreated} · Total Lv{totalLevel}</div>
        </div>
      </div>

      <h4>Living Records</h4>
      <div class="records">
        {#each Object.entries(selectedItem.records) as [type, rec]}
          {@const needed = rec.level >= MAX_LEVEL ? 1 : xpToNextLevel(rec.level)}
          {@const pct = rec.level >= MAX_LEVEL ? 100 : Math.round(rec.xp / needed * 100)}
          {@const stage = getVisualStage(type, rec.level)}
          {@const r = REC[type]}
          <div class="rec" style="--c: {r.color}">
            <div class="rec-head">
              <span class="rec-label">{r.label}</span>
              <span class="rec-lv">{rec.level}</span>
              <div class="rec-bar"><div class="rec-fill" style="width: {pct}%"></div></div>
              <span class="rec-xp">{#if rec.level >= MAX_LEVEL}MAX{:else}{rec.xp}/{needed}{/if}</span>
            </div>
            {#if rec.level > 0}
              <div class="rec-bonus">{stage.prefix ? `"${stage.prefix}"` : ''} — {getRecordBonusForType(type, rec.level)}</div>
            {/if}
          </div>
        {/each}
      </div>

      {#if selectedItem.visualMarks.length > 0}
        <h4>Visual Marks <span class="count">{selectedItem.visualMarks.length}</span></h4>
        <div class="marks" in:fade={{ duration: 150 }}>
          {#each selectedItem.visualMarks as mark}
            <span class="mark">{mark}</span>
          {/each}
        </div>
      {/if}

      <h4>Tooltip</h4>
      <pre class="tooltip">{tooltip.join('\n')}</pre>
    </section>

    <!-- RIGHT: Stats & Resonance -->
    <section class="panel sidebar">
      <h4>Combat</h4>
      <StatBar label="Bonus Damage" value={stats.bonusDamage} max={Math.max(stats.bonusDamage, 60)} color={COLORS.combat} />
      <StatBar label="Crit Chance" value={Math.round(stats.critChance * 100)} max={50} color={COLORS.accentAmber} />
      <StatBar label="Bonus Defense" value={stats.bonusDefense} max={Math.max(stats.bonusDefense, 60)} color={COLORS.defense} />
      <StatBar label="Dmg Reduction" value={Math.round(stats.damageReduction * 100)} max={75} color={COLORS.defense} />
      <StatBar label="Bonus Max HP" value={stats.bonusMaxHP} max={Math.max(stats.bonusMaxHP, 50)} color={COLORS.vitality} />
      <StatBar label="Lifesteal" value={Math.round(stats.lifesteal * 100)} max={50} color={COLORS.vitality} />

      <h4>Movement</h4>
      <StatBar label="Stamina Eff." value={Math.round(stats.staminaEfficiency * 100)} max={100} color={COLORS.exploration} />
      <StatBar label="Move Speed" value={Math.round(stats.movementSpeed * 100)} max={100} color={COLORS.exploration} />
      <StatBar label="Map Reveal" value={stats.mapReveal} max={20} color={COLORS.defense} />

      <h4>Fortune</h4>
      <StatBar label="Gold Bonus" value={Math.round(stats.goldBonus * 100)} max={100} color={COLORS.fortune} />
      <StatBar label="Rare Chance" value={Math.round(stats.rareItemChance * 100)} max={50} color={COLORS.fortune} />

      <h4>Resonance</h4>
      {#if resonances.length > 0}
        {#each resonances as r}
          <div class="res-card" style="--c: {r.color}">
            <div class="res-name">{r.label}</div>
            <div class="res-desc">{r.description}</div>
            <StatBar label="Strength" value={r.strength} max={50} color={r.color} />
          </div>
        {/each}
      {:else}
        <p class="empty">No resonance. Match dominant records at Lv3+ across equipment.</p>
      {/if}

      <h4>Resonance Map</h4>
      <div class="res-map">
        {#each [
          ['Kill + Kill', 'Blood Brothers', COLORS.bloodBrothers],
          ['Treasure + Treasure', 'Golden Pair', COLORS.goldenPair],
          ['Explore + Explore', 'Pathfinders', COLORS.pathfinders],
          ['Survive + Survive', 'Iron Bond', COLORS.ironBond],
          ['Kill + Survive', 'Warrior Soul', COLORS.warriorSoul],
          ['Treasure + Explore', 'Treasure Hunter', COLORS.treasureHunter],
          ['Kill + Treasure', 'Berserker', COLORS.berserker],
          ['Explore + Survive', 'Paladin', COLORS.paladin],
        ] as [pair, name, color]}
          <div class="res-row">
            <span class="res-pair">{pair}</span>
            <span style="color: {color}; font-weight: 600">{name}</span>
          </div>
        {/each}
      </div>
    </section>
  </div>

  <!-- Log -->
  <div class="log">
    {#each actionLog as msg, i}
      <div class="log-line" style="opacity: {1 - i * 0.02}">{msg}</div>
    {/each}
    {#if actionLog.length === 0}
      <div class="log-line empty">Perform actions to see results here.</div>
    {/if}
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
  /* ── Lab container (inherits tokens from Workbench) ── */
  .lab { line-height: 1.5; }

  /* ── Header ── */
  .lab-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: var(--space-md);
  }
  .title-group { display: flex; align-items: baseline; gap: var(--space-md); }
  h2 { color: var(--fg); font-size: 18px; font-weight: 600; margin: 0; letter-spacing: 0.5px; }

  .item-badge {
    display: flex; align-items: center; gap: var(--space-sm);
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: var(--space-sm) var(--space-md);
  }
  .badge-char { font-size: 22px; color: var(--c); }
  .badge-info { display: flex; flex-direction: column; }
  .badge-name { font-size: 13px; font-weight: 600; color: var(--c); }
  .badge-meta { font-size: 9px; color: var(--fg-dim); }

  /* ── Buttons ── */
  .text-btn {
    background: none; border: 1px solid var(--border); color: var(--fg-muted);
    padding: 4px 12px; border-radius: var(--radius); cursor: pointer;
    font-family: inherit; font-size: 11px; transition: all var(--transition-fast);
  }
  .text-btn:hover { color: var(--fg); border-color: var(--fg-dim); }
  .text-btn.gold { border-color: var(--border); color: var(--accent-amber); }
  .text-btn.gold:hover { border-color: var(--accent-amber); }
  .text-btn.danger { border-color: var(--border); color: var(--accent-red); }
  .text-btn.danger:hover { border-color: var(--accent-red); }

  /* ── Guide ── */
  .guide {
    background: var(--bg-card); border-radius: var(--radius);
    padding: var(--space-md); margin-bottom: var(--space-md);
  }
  .guide-lead { color: var(--fg); margin: 0 0 var(--space-sm); font-size: 13px; }
  .guide-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); margin-bottom: var(--space-sm); }
  .guide-card {
    background: var(--bg-muted); border-left: 2px solid var(--c);
    padding: var(--space-sm) 12px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: 11px; color: var(--fg-muted);
  }
  .guide-card strong { color: var(--c); display: block; margin-bottom: 2px; }
  .guide-row { color: var(--fg-muted); font-size: 11px; padding: 2px 0; }
  .guide-row strong { color: var(--fg); }

  /* ── Section headers ── */
  h4 {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
    color: var(--fg-dim); margin: var(--space-md) 0 var(--space-sm); font-weight: 500;
  }
  h4:first-child { margin-top: 0; }
  .count { color: var(--fg-muted); font-variant-numeric: tabular-nums; }

  /* ── Main Grid ── */
  .main-grid {
    display: grid; grid-template-columns: 280px 1fr 260px;
    gap: var(--space-md); margin-bottom: var(--space-md);
  }

  .panel {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-md);
  }

  /* ── Equipment Slots ── */
  .eq-slots { display: flex; flex-direction: column; gap: var(--space-xs); }
  .eq-slot {
    display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) 10px;
    background: var(--bg-muted); border: 1px solid transparent; border-radius: var(--radius-sm);
    cursor: pointer; font-family: inherit; font-size: 12px; color: var(--fg);
    text-align: left; transition: all var(--transition-fast);
  }
  .eq-slot:hover { background: var(--bg-accent); transform: translateX(2px); }
  .eq-slot.active { border-color: var(--border-accent); background: var(--bg-accent); box-shadow: 0 0 0 1px var(--border-accent); }
  .slot-char { font-size: 18px; width: 24px; text-align: center; }
  .slot-body { flex: 1; display: flex; flex-direction: column; }
  .slot-name { font-size: 11px; font-weight: 600; }
  .slot-meta { font-size: 9px; color: var(--fg-dim); }
  .slot-tag {
    font-size: 9px; padding: 2px 6px; border-radius: 3px; font-weight: 600;
    background: color-mix(in srgb, var(--c) 20%, transparent); color: var(--c);
  }
  .slot-tag.dim { background: var(--bg-accent); color: var(--fg-dim); }

  /* ── Action/Max Buttons ── */
  .btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xs); }
  .btn-grid.sm { gap: 3px; }
  .btn-row { display: flex; gap: var(--space-xs); }
  .btn-row .text-btn { flex: 1; text-align: center; }

  .act-btn {
    background: var(--bg-muted); border: 1px solid var(--border); padding: 7px 6px;
    font-family: inherit; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm);
    color: var(--c); transition: all var(--transition-fast);
    border-left: 2px solid var(--c);
  }
  .act-btn:hover { background: var(--bg-accent); }
  .act-btn:active { transform: scale(0.97); }

  .max-btn {
    background: var(--bg-muted); border: 1px solid var(--border); padding: 4px 6px;
    font-family: inherit; font-size: 10px; cursor: pointer; border-radius: var(--radius-sm);
    color: var(--fg-dim); transition: all var(--transition-fast);
    border-left: 2px solid color-mix(in srgb, var(--c) 40%, transparent);
  }
  .max-btn:hover { color: var(--c); background: var(--bg-accent); border-left-color: var(--c); }

  /* ── Item Hero ── */
  .item-hero { display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md); }
  .hero-char { font-size: 36px; color: var(--c); }
  .hero-name { font-size: 16px; font-weight: 600; color: var(--c); }
  .hero-meta { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

  /* ── Records ── */
  .records { display: flex; flex-direction: column; gap: var(--space-xs); }
  .rec {
    background: var(--bg-muted); border-radius: var(--radius-sm); padding: var(--space-sm) 10px;
    border-left: 2px solid var(--c); transition: background var(--transition-fast), transform var(--transition-fast);
  }
  .rec:hover { background: var(--bg-accent); transform: translateX(2px); }
  .rec-head { display: flex; align-items: center; gap: var(--space-sm); }
  .rec-label { width: 62px; font-size: 11px; font-weight: 600; color: var(--c); }
  .rec-lv { width: 18px; font-size: 12px; text-align: right; color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; }
  .rec-bar { flex: 1; height: 4px; background: var(--bg); border-radius: 2px; overflow: hidden; margin: 0 var(--space-xs); }
  .rec-fill { height: 100%; background: var(--c); opacity: 0.7; transition: width 0.3s ease; border-radius: 2px; }
  .rec-xp { width: 55px; font-size: 10px; color: var(--fg-dim); text-align: right; font-variant-numeric: tabular-nums; }
  .rec-bonus { font-size: 10px; color: var(--fg-muted); margin-top: 3px; padding-left: 2px; }

  /* ── Marks ── */
  .marks { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
  .mark {
    background: var(--bg-muted); border: 1px solid var(--border); padding: 2px 8px;
    font-size: 10px; color: var(--fg-muted); border-radius: 3px;
    transition: background var(--transition-fast), color var(--transition-fast);
  }
  .mark:hover { background: var(--bg-accent); color: var(--fg); }

  /* ── Tooltip ── */
  .tooltip {
    background: var(--bg-muted); border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 10px; font-size: 11px; color: var(--fg-muted); line-height: 1.5;
    white-space: pre; overflow-x: auto; margin: 0;
  }

  /* ── Resonance ── */
  .res-card {
    background: var(--bg-muted); border-left: 2px solid var(--c);
    border-radius: var(--radius-sm); padding: var(--space-sm); margin-bottom: var(--space-sm);
    transition: background var(--transition-fast), transform var(--transition-fast);
    animation: fade-in 200ms ease;
  }
  .res-card:hover { background: var(--bg-accent); transform: translateX(2px); }
  .res-name { font-size: 12px; font-weight: 600; color: var(--c); margin-bottom: 2px; }
  .res-desc { font-size: 10px; color: var(--fg-muted); margin-bottom: 6px; }
  .empty { font-size: 11px; color: var(--fg-dim); margin: 0; }

  .res-map { font-size: 10px; }
  .res-row {
    display: flex; justify-content: space-between; padding: 3px var(--space-xs);
    border-bottom: 1px solid var(--border-muted);
  }
  .res-pair { color: var(--fg-dim); }

  /* ── Log ── */
  .log {
    background: var(--bg-card); border-radius: var(--radius); padding: var(--space-sm) var(--space-md);
    max-height: 100px; overflow-y: auto;
  }
  .log-line { font-size: 10px; color: var(--fg-dim); padding: 2px 0; animation: fade-in 150ms ease; }
  .log-line.empty { font-style: italic; animation: none; }

  /* ── Responsive ── */
  @media (max-width: 1100px) {
    .main-grid { grid-template-columns: 1fr; }
  }
</style>
