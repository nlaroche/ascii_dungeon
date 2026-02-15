<script>
  import { slide, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import ParamSlider from '../components/ParamSlider.svelte';
  import StatBar from '../components/StatBar.svelte';
  import {
    SKILL_TREE_SCHEMA, TIER_THRESHOLDS,
    createSkillTree, allocatePoint, allocatePoints,
    getVisibleSkills, getSkillBonuses, calcBonus,
    getTier, getAvailablePoints, getRemainingPoints,
  } from '../../lib/skills.js';

  // ── State ──
  let tree = createSkillTree();
  let playerLevel = 1;
  let floorsCleared = 0;
  let selectedBranch = 'attack';
  let expandedBranches = { attack: true, defense: false, exploration: false, fortune: false };
  let actionLog = [];
  let showGuide = false;
  let bulkAmount = 1;

  // ── Derived ──
  $: visible = getVisibleSkills(tree);
  $: bonuses = getSkillBonuses(tree);
  $: totalAvailable = getAvailablePoints(playerLevel, floorsCleared);
  $: remaining = getRemainingPoints(playerLevel, floorsCleared, tree);
  $: selectedInfo = visible[selectedBranch];

  // Muted color palette for dark mode (desaturated ~20pts from originals)
  const BRANCH_COLORS = {
    attack:      { accent: '#c4645a', dim: '#6b3832', bg: '#1f1614' },
    defense:     { accent: '#5a8ec4', dim: '#324a6b', bg: '#14191f' },
    exploration: { accent: '#5ab8c4', dim: '#326268', bg: '#141c1f' },
    fortune:     { accent: '#c4b05a', dim: '#6b5f32', bg: '#1f1c14' },
  };

  const TIER_COLORS = {
    2: '#7a9ab8',
    3: '#9a7ab8',
    4: '#c49a5a',
  };

  function getBranchColors(id) {
    return BRANCH_COLORS[id] || BRANCH_COLORS.attack;
  }

  // ── Actions ──
  function invest(skillPath, amount) {
    if (remaining < amount) {
      log(`Not enough points. Need ${amount}, have ${remaining}.`);
      return;
    }
    const oldTree = tree;
    tree = allocatePoints(tree, skillPath, amount);
    if (tree === oldTree) {
      log(`Cannot invest in ${skillPath} — locked or invalid.`);
      return;
    }

    const parts = skillPath.split('.');
    const baseId = parts[0];
    const subId = parts[1];
    const skill = tree.skills[baseId];
    const oldTier = getTier(oldTree.skills[baseId].points);
    const newTier = getTier(skill.points);

    if (!subId) {
      const bonus = calcBonus(SKILL_TREE_SCHEMA[baseId].base.baseValue, skill.points);
      log(`+${amount} ${SKILL_TREE_SCHEMA[baseId].label}  →  ${skill.points} pts  (+${fmt(bonus)} ${SKILL_TREE_SCHEMA[baseId].base.stat})`);
      if (newTier > oldTier) {
        log(`▲ TIER ${newTier} UNLOCKED — New skills revealed in ${SKILL_TREE_SCHEMA[baseId].label}`);
      }
    } else {
      const pts = skill.subSkills[subId] || 0;
      const schema = SKILL_TREE_SCHEMA[baseId];
      const subDef = [...(schema.tier2||[]), ...(schema.tier3||[]), ...(schema.tier4||[])].find(s => s.id === subId);
      if (subDef) {
        const bonus = calcBonus(subDef.baseValue, pts);
        log(`+${amount} ${subDef.label}  →  ${pts} pts  (+${fmt(bonus)} ${subDef.stat})`);
      }
    }
  }

  function resetTree() {
    tree = createSkillTree();
    actionLog = [];
    log('Tree reset.');
  }

  function maxBase(baseId) {
    const amount = Math.min(remaining, 200);
    if (amount > 0) invest(baseId, amount);
  }

  function toggleBranch(id) {
    expandedBranches[id] = !expandedBranches[id];
    expandedBranches = expandedBranches;
    selectedBranch = id;
  }

  function log(msg) {
    actionLog = [msg, ...actionLog.slice(0, 39)];
  }

  function fmt(n) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  }

  function previewGrowth(baseValue) {
    return [1, 5, 10, 25, 50, 100, 500, 1000].map(p => ({
      points: p,
      bonus: calcBonus(baseValue, p),
    }));
  }
</script>

<div class="lab">
  <!-- Header -->
  <header class="lab-header">
    <div class="title-group">
      <h2>Skill Tree</h2>
      <button class="text-btn" on:click={() => showGuide = !showGuide}>
        {showGuide ? 'Hide guide' : 'How it works'}
      </button>
    </div>
    <div class="points-display">
      <span class="points-remaining" class:depleted={remaining <= 0}>{remaining}</span>
      <span class="points-separator">/</span>
      <span class="points-total">{totalAvailable}</span>
      <span class="points-label">pts</span>
    </div>
  </header>

  {#if showGuide}
    <div class="guide" transition:slide={{ duration: 200, easing: quintOut }}>
      <p class="guide-lead">Every skill scales infinitely with accelerating returns. Deeper investment reveals hidden sub-skills.</p>
      <div class="guide-details">
        <div><strong>Growth</strong> — bonus = base × points<sup>1.5</sup>. Pt 1 = +5, Pt 10 = +158, Pt 100 = +5K, Pt 1000 = +158K</div>
        <div><strong>Tiers</strong> — At 10, 50, and 200 pts, new sub-skills appear in that branch</div>
        <div><strong>Points</strong> — Earn 1 per player level + 1 per dungeon floor cleared</div>
      </div>
    </div>
  {/if}

  <!-- Controls -->
  <div class="controls">
    <ParamSlider label="Player Lv" min={1} max={100} step={1} value={playerLevel} on:change={e => playerLevel = e.detail} />
    <ParamSlider label="Floors" min={0} max={100} step={1} value={floorsCleared} on:change={e => floorsCleared = e.detail} />
    <ParamSlider label="Invest ×" min={1} max={100} step={1} value={bulkAmount} on:change={e => bulkAmount = e.detail} />
    <button class="text-btn danger" on:click={resetTree}>Reset</button>
  </div>

  <!-- Main layout -->
  <div class="main-grid">

    <!-- LEFT: Branches -->
    <section class="branches">
      {#each Object.entries(visible) as [baseId, info]}
        {@const colors = getBranchColors(baseId)}
        {@const expanded = expandedBranches[baseId]}
        {@const pctToNext = info.nextTierAt ? Math.min(100, Math.round((info.points / info.nextTierAt) * 100)) : 100}

        <div class="branch" class:expanded class:active={selectedBranch === baseId} style="--accent: {colors.accent}; --dim: {colors.dim}; --bg: {colors.bg}">
          <button class="branch-head" on:click={() => toggleBranch(baseId)}>
            <span class="branch-icon">{info.char}</span>
            <div class="branch-text">
              <span class="branch-label">{info.label}</span>
              <span class="branch-sub">{info.points} pts · T{info.tier}</span>
            </div>
            <span class="branch-bonus">+{fmt(info.bonus)}</span>
            <span class="caret">{expanded ? '−' : '+'}</span>
          </button>

          <!-- Tier progress -->
          <div class="tier-track">
            <div class="tier-fill" style="width: {pctToNext}%"></div>
          </div>
          {#if info.nextTierAt}
            <div class="tier-hint">{info.nextTierAt - info.points} pts to Tier {info.tier + 1}</div>
          {/if}

          <!-- Invest -->
          <div class="invest-row">
            <button class="invest-btn" on:click={() => invest(baseId, bulkAmount)} disabled={remaining < bulkAmount}>
              +{bulkAmount}
            </button>
            <button class="invest-btn quiet" on:click={() => maxBase(baseId)} disabled={remaining <= 0}>
              Max
            </button>
          </div>

          <!-- Sub-skills (expanded) -->
          {#if expanded}
            <div class="sub-list" transition:slide={{ duration: 200, easing: quintOut }}>
              {#if info.subSkills.length === 0}
                <div class="sub-empty">Invest more to unlock sub-skills…</div>
              {/if}
              {#each info.subSkills as sub}
                {@const tc = TIER_COLORS[sub.tierSource] || colors.accent}
                <div class="sub-card" style="--sub-accent: {tc}">
                  <div class="sub-top">
                    <span class="sub-icon">{sub.char}</span>
                    <div class="sub-text">
                      <span class="sub-label">{sub.label}</span>
                      <span class="sub-desc">{sub.description}</span>
                    </div>
                    <span class="sub-value">+{fmt(sub.bonus)}</span>
                  </div>
                  <div class="sub-bottom">
                    <button class="invest-btn small" on:click={() => invest(`${baseId}.${sub.id}`, bulkAmount)} disabled={remaining < bulkAmount}>
                      +{bulkAmount}
                    </button>
                    <div class="sub-track">
                      <div class="sub-fill" style="width: {Math.min(100, sub.points * 0.5)}%"></div>
                    </div>
                    <span class="sub-pts">{sub.points}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </section>

    <!-- MIDDLE: Detail -->
    <section class="detail">
      {#if selectedInfo}
        {@const colors = getBranchColors(selectedBranch)}

        <div class="detail-head" style="--accent: {colors.accent}">
          <span class="detail-icon">{selectedInfo.char}</span>
          <div>
            <h3>{selectedInfo.label}</h3>
            <p class="detail-meta">{selectedInfo.points} pts invested · Tier {selectedInfo.tier} · +{fmt(selectedInfo.bonus)} {selectedInfo.stat}</p>
          </div>
        </div>

        <p class="detail-desc">{selectedInfo.description}</p>

        <!-- Growth table -->
        <h4>Growth Curve</h4>
        <table class="growth-table">
          <thead><tr><th>Pts</th><th>Bonus</th><th>Tier</th></tr></thead>
          <tbody>
            {#each previewGrowth(SKILL_TREE_SCHEMA[selectedBranch].base.baseValue) as row}
              {@const tier = getTier(row.points)}
              <tr class:past={selectedInfo.points > row.points} class:current={selectedInfo.points >= row.points && selectedInfo.points < (previewGrowth(SKILL_TREE_SCHEMA[selectedBranch].base.baseValue).find(r => r.points > row.points)?.points || Infinity)} class:future={selectedInfo.points < row.points}>
                <td>{row.points}</td>
                <td class="num" style="color: {colors.accent}">+{fmt(row.bonus)}</td>
                <td class="tier-cell" style="color: {TIER_COLORS[tier] || '#555'}">T{tier}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        <!-- Sub-skill details -->
        {#if selectedInfo.subSkills.length > 0}
          <h4>Sub-Skills <span class="count">{selectedInfo.subSkills.length}</span></h4>
          {#each selectedInfo.subSkills as sub}
            {@const tc = TIER_COLORS[sub.tierSource] || colors.accent}
            <div class="detail-sub" style="--sub-accent: {tc}">
              <div class="detail-sub-head">
                <span class="sub-icon">{sub.char}</span>
                <span class="sub-label">{sub.label}</span>
                <span class="detail-sub-tier">T{sub.tierSource}</span>
              </div>
              <p class="sub-desc">{sub.description}</p>
              <StatBar label={sub.stat} value={sub.bonus} max={Math.max(sub.bonus, 100)} color={tc} />
            </div>
          {/each}
        {/if}

        <!-- Locked tiers -->
        {#if selectedInfo.tier < 4}
          <div class="locked-section">
            <h4>Locked</h4>
            {#if selectedInfo.tier < 2}<div class="locked-row">Tier 2 at {TIER_THRESHOLDS[2]} pts — 2 skills</div>{/if}
            {#if selectedInfo.tier < 3}<div class="locked-row">Tier 3 at {TIER_THRESHOLDS[3]} pts — 2 skills</div>{/if}
            {#if selectedInfo.tier < 4}<div class="locked-row">Tier 4 at {TIER_THRESHOLDS[4]} pts — 1 ultimate</div>{/if}
          </div>
        {/if}
      {/if}
    </section>

    <!-- RIGHT: Bonuses -->
    <section class="sidebar">
      <h4>Active Bonuses</h4>
      {#if Object.keys(bonuses).length === 0}
        <p class="empty-msg">No bonuses yet.</p>
      {:else}
        <div class="bonus-list">
          {#each Object.entries(bonuses) as [stat, value]}
            <div class="bonus-row">
              <span class="bonus-stat">{stat}</span>
              <span class="bonus-val">+{fmt(value)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <h4>Summary</h4>
      <div class="summary-cards">
        {#each Object.entries(visible) as [baseId, info]}
          {@const colors = getBranchColors(baseId)}
          <div class="summary-card" style="--accent: {colors.accent}">
            <span class="summary-icon">{info.char}</span>
            <div class="summary-body">
              <span class="summary-label">{info.label}</span>
              <span class="summary-num">+{fmt(info.bonus)}</span>
            </div>
            <span class="summary-tier">T{info.tier}</span>
          </div>
        {/each}
      </div>

      <h4>Points</h4>
      <StatBar label="Spent" value={tree.totalPointsSpent} max={Math.max(tree.totalPointsSpent, totalAvailable)} color="#8a7a5a" />
      <StatBar label="Remaining" value={Math.max(0, remaining)} max={Math.max(totalAvailable, 1)} color={remaining > 0 ? '#5a8a5e' : '#8a5a5a'} />
    </section>
  </div>

  <!-- Log -->
  <div class="log">
    {#each actionLog as msg, i}
      <div class="log-line" style="opacity: {1 - i * 0.025}" class:unlock={msg.startsWith('▲')}>{msg}</div>
    {/each}
    {#if actionLog.length === 0}
      <div class="log-line empty">Activity will appear here.</div>
    {/if}
  </div>
</div>

<script context="module">
  // intentionally empty — getStatColor removed, colors come from branch context
</script>

<style>
  /* ── Inherits design tokens from Workbench ── */
  .lab { line-height: 1.5; }

  /* ── Header ── */
  .lab-header {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: var(--space-md);
  }
  .title-group { display: flex; align-items: baseline; gap: var(--space-md); }
  h2 { color: var(--fg); font-size: 18px; font-weight: 600; margin: 0; letter-spacing: 0.5px; }

  .points-display {
    display: flex; align-items: baseline; gap: 4px;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: var(--space-sm) var(--space-md);
  }
  .points-remaining { font-size: 22px; font-weight: 700; color: var(--accent-green); }
  .points-remaining.depleted { color: var(--accent-red); }
  .points-separator { color: var(--fg-dim); }
  .points-total { color: var(--fg-muted); font-size: 14px; }
  .points-label { color: var(--fg-dim); font-size: 11px; }

  /* ── Buttons ── */
  .text-btn {
    background: none; border: 1px solid var(--border); color: var(--fg-muted);
    padding: 4px 12px; border-radius: var(--radius); cursor: pointer;
    font-family: inherit; font-size: 11px;
    transition: all var(--transition-fast);
  }
  .text-btn:hover { color: var(--fg); border-color: var(--fg-dim); }
  .text-btn.danger { border-color: var(--border); color: var(--accent-red); }
  .text-btn.danger:hover { border-color: var(--accent-red); }

  /* ── Guide ── */
  .guide {
    background: var(--bg-card); border-radius: var(--radius);
    padding: var(--space-md); margin-bottom: var(--space-md);
  }
  .guide-lead { color: var(--fg); margin: 0 0 var(--space-sm); font-size: 13px; }
  .guide-details { display: flex; flex-direction: column; gap: var(--space-xs); color: var(--fg-muted); font-size: 11px; }
  .guide-details strong { color: var(--fg); }

  /* ── Controls ── */
  .controls {
    display: flex; gap: var(--space-md); align-items: flex-end;
    background: var(--bg-card); border-radius: var(--radius);
    padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-md);
  }
  .controls > :global(*) { flex: 1; }
  .controls > .text-btn { flex: 0; white-space: nowrap; }

  /* ── Main Grid ── */
  .main-grid {
    display: grid; grid-template-columns: 320px 1fr 240px;
    gap: var(--space-md); margin-bottom: var(--space-md);
  }

  /* ── Branches (left) ── */
  .branches { display: flex; flex-direction: column; gap: var(--space-sm); }

  .branch {
    background: var(--bg, var(--bg-card)); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }
  .branch:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
  .branch.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 2px 12px rgba(0,0,0,0.3); }

  .branch-head {
    display: flex; align-items: center; gap: var(--space-sm); padding: 10px 12px;
    background: none; border: none; width: 100%; cursor: pointer;
    font-family: inherit; font-size: 12px; color: var(--fg); text-align: left;
    transition: background 0.1s ease;
  }
  .branch-head:hover { background: rgba(255,255,255,0.02); }

  .branch-icon { font-size: 18px; width: 24px; text-align: center; color: var(--accent); }
  .branch-text { flex: 1; }
  .branch-label { font-weight: 600; display: block; }
  .branch-sub { font-size: 10px; color: var(--fg-dim); }
  .branch-bonus { font-size: 15px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  .caret { width: 16px; text-align: center; color: var(--fg-dim); font-size: 14px; }

  .tier-track { height: 2px; background: var(--bg-accent); margin: 0 12px; }
  .tier-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; opacity: 0.6; }
  .tier-hint { font-size: 9px; color: var(--fg-dim); padding: 4px 12px 0; }

  .invest-row { display: flex; gap: var(--space-xs); padding: var(--space-sm) 12px; }
  .invest-btn {
    flex: 1; background: var(--bg-muted); border: 1px solid var(--border);
    color: var(--fg-muted); padding: 5px 0; border-radius: 4px;
    cursor: pointer; font-family: inherit; font-size: 11px;
    transition: all 0.1s ease;
  }
  .invest-btn:hover:not(:disabled) { background: var(--bg-accent); color: var(--fg); }
  .invest-btn:disabled { opacity: 0.25; cursor: default; }
  .invest-btn.quiet { flex: 0; padding: 5px 12px; }
  .invest-btn.small { flex: 0; padding: 3px 10px; font-size: 10px; }

  /* ── Sub-skills ── */
  .sub-list { padding: 0 12px 10px; display: flex; flex-direction: column; gap: var(--space-xs); }
  .sub-empty { font-size: 10px; color: var(--fg-dim); font-style: italic; padding: 4px 0; }

  .sub-card {
    background: var(--bg-muted); border-radius: 4px; padding: var(--space-sm);
    border-left: 2px solid var(--sub-accent);
    transition: background var(--transition-fast), transform var(--transition-fast);
  }
  .sub-card:hover { background: var(--bg-accent); transform: translateX(2px); }
  .sub-top { display: flex; align-items: center; gap: var(--space-sm); }
  .sub-icon { font-size: 14px; color: var(--sub-accent); width: 18px; text-align: center; }
  .sub-text { flex: 1; }
  .sub-label { font-weight: 600; font-size: 11px; color: var(--fg); }
  .sub-desc { font-size: 9px; color: var(--fg-dim); display: block; margin-top: 1px; }
  .sub-value { font-size: 14px; font-weight: 700; color: var(--sub-accent); font-variant-numeric: tabular-nums; }

  .sub-bottom { display: flex; align-items: center; gap: var(--space-sm); margin-top: 6px; }
  .sub-track { flex: 1; height: 2px; background: var(--bg); border-radius: 1px; }
  .sub-fill { height: 100%; background: var(--sub-accent); opacity: 0.5; transition: width 0.3s ease; }
  .sub-pts { font-size: 9px; color: var(--fg-dim); width: 28px; text-align: right; }

  /* ── Detail (middle) ── */
  .detail {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-md);
  }
  .detail-head { display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md); }
  .detail-icon { font-size: 32px; color: var(--accent); }
  .detail h3 { font-size: 16px; font-weight: 600; margin: 0; }
  .detail-meta { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }
  .detail-desc {
    font-size: 12px; color: var(--fg-muted);
    background: var(--bg-muted); border-radius: 4px; padding: var(--space-sm) 12px;
    margin-bottom: var(--space-md);
  }

  .detail h4 {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
    color: var(--fg-dim); margin: var(--space-md) 0 var(--space-sm); font-weight: 500;
  }
  .count { color: var(--fg-muted); font-variant-numeric: tabular-nums; }

  /* Growth table */
  .growth-table {
    width: 100%; border-collapse: collapse;
    background: var(--bg-muted); border-radius: 4px; overflow: hidden;
  }
  .growth-table th {
    text-align: left; padding: 6px 10px; font-size: 9px;
    text-transform: uppercase; letter-spacing: 1px; color: var(--fg-dim);
    border-bottom: 1px solid var(--border); font-weight: 500;
  }
  .growth-table td { padding: 4px 10px; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.02); }
  .growth-table .num { font-weight: 600; font-variant-numeric: tabular-nums; }
  .growth-table .tier-cell { font-size: 10px; }
  .growth-table tr.past td { color: var(--fg-dim); }
  .growth-table tr.current td { background: rgba(255,255,255,0.03); color: var(--fg); }
  .growth-table tr.future td { color: var(--fg-muted); }

  /* Detail sub-skills */
  .detail-sub {
    background: var(--bg-muted); border-radius: 4px; padding: 10px;
    margin-bottom: var(--space-sm); border-left: 2px solid var(--sub-accent);
  }
  .detail-sub-head { display: flex; align-items: center; gap: var(--space-sm); }
  .detail-sub-tier { margin-left: auto; font-size: 9px; color: var(--fg-dim); }

  .locked-section {
    margin-top: var(--space-md); padding: var(--space-sm) 12px;
    border: 1px dashed var(--border); border-radius: 4px;
  }
  .locked-row { font-size: 11px; color: var(--fg-dim); padding: 2px 0; }

  /* ── Sidebar (right) ── */
  .sidebar {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-md);
  }
  .sidebar h4 {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
    color: var(--fg-dim); margin: var(--space-md) 0 var(--space-sm); font-weight: 500;
  }
  .sidebar h4:first-child { margin-top: 0; }

  .empty-msg { font-size: 11px; color: var(--fg-dim); margin: 0; }

  .bonus-list { display: flex; flex-direction: column; gap: 2px; }
  .bonus-row {
    display: flex; justify-content: space-between; padding: 4px var(--space-sm);
    background: var(--bg-muted); border-radius: 3px; font-size: 11px;
    transition: background var(--transition-fast);
  }
  .bonus-row:hover { background: var(--bg-accent); }
  .bonus-stat { color: var(--fg-muted); }
  .bonus-val { font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }

  .summary-cards { display: flex; flex-direction: column; gap: var(--space-xs); }
  .summary-card {
    display: flex; align-items: center; gap: var(--space-sm);
    background: var(--bg-muted); border-radius: 4px; padding: var(--space-sm);
    border-left: 2px solid var(--accent);
    transition: background var(--transition-fast), transform var(--transition-fast);
  }
  .summary-card:hover { background: var(--bg-accent); transform: translateX(2px); }
  .summary-icon { font-size: 14px; color: var(--accent); }
  .summary-body { flex: 1; }
  .summary-label { font-size: 10px; color: var(--fg-muted); display: block; }
  .summary-num { font-size: 13px; font-weight: 700; color: var(--fg); font-variant-numeric: tabular-nums; }
  .summary-tier { font-size: 9px; color: var(--fg-dim); }

  /* ── Log ── */
  .log {
    background: var(--bg-card); border-radius: var(--radius); padding: var(--space-sm) var(--space-md);
    max-height: 100px; overflow-y: auto;
  }
  .log-line { font-size: 10px; color: var(--fg-dim); padding: 2px 0; animation: fade-in 150ms ease; }
  .log-line.unlock { color: var(--fg); font-weight: 600; animation: slide-down 200ms ease; }
  .log-line.empty { color: var(--fg-dim); font-style: italic; }

  /* ── Responsive ── */
  @media (max-width: 1100px) {
    .main-grid { grid-template-columns: 1fr; }
  }
</style>
