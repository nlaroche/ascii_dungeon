<script>
  import { fade } from 'svelte/transition';

  export let building = null;
  export let onClose = null;

  function handleKeydown(e) {
    if (e.key === 'Escape' && building && onClose) {
      onClose();
    }
  }

  function handleBackdropClick() {
    if (onClose) onClose();
  }

  function handleModalClick(e) {
    e.stopPropagation();
  }

  const vendorItems = [
    { name: 'Iron Sword', glyph: '/', price: '12g', stat: '+8 ATK', rarity: 'common' },
    { name: 'Leather Armor', glyph: '[', price: '8g', stat: '+5 DEF', rarity: 'common' },
    { name: 'Health Potion', glyph: '!', price: '3g', stat: '+50 HP', rarity: 'common' },
    { name: 'Torch Bundle', glyph: '*', price: '2g', stat: 'Light +3', rarity: 'common' },
    { name: 'Map Fragment', glyph: '?', price: '5g', stat: 'Reveal floor', rarity: 'uncommon' },
    { name: 'Lucky Charm', glyph: '=', price: '15g', stat: '+5% Crit', rarity: 'rare' },
  ];

  const stashItems = [
    { char: '/', fg: 'var(--fg-muted)', name: 'Iron Sword +1' },
    { char: '[', fg: 'var(--accent)', name: 'Leather Armor' },
    { char: '!', fg: 'var(--accent-green)', name: 'Potion x3' },
    { char: '*', fg: 'var(--accent-red)', name: 'Fire Rune' },
  ];

  const quests = [
    { title: 'Clear the Mines', desc: 'Defeat 10 goblins in the abandoned mines', reward: '50g + 100 XP', difficulty: 'Easy', difficultyClass: 'diff-easy' },
    { title: 'Lost Artifact', desc: 'Retrieve the ancient rune from floor 5', reward: '120g + 250 XP', difficulty: 'Medium', difficultyClass: 'diff-medium' },
    { title: "Dragon's Lair", desc: 'Slay the elder dragon', reward: '500g + 1000 XP', difficulty: 'Hard', difficultyClass: 'diff-hard' },
  ];

  const equipment = [
    { name: 'Iron Sword', glyph: '/', action: 'Upgrade to +2', cost: '25g', stat: '+3 ATK', statColor: 'var(--accent-green)' },
    { name: 'Chain Mail', glyph: '[', action: 'Repair (80%)', cost: '10g', stat: '80% → 100%', statColor: 'var(--accent-amber)' },
    { name: 'Buckler', glyph: ')', action: 'Reinforce', cost: '15g', stat: '+2 DEF', statColor: 'var(--accent-green)' },
  ];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if building}
  <div
    class="backdrop"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Enter' && handleBackdropClick()}
    role="button"
    tabindex="0"
    transition:fade={{ duration: 100 }}
  >
    <div
      class="modal"
      on:click={handleModalClick}
      on:keydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <header class="modal-header">
        <span class="icon" style="color: {building.fg}">{building.icon}</span>
        <h2>{building.label}</h2>
        <button class="close-btn" on:click={onClose}>&times;</button>
      </header>

      <div class="modal-body">
        {#if building.label === 'Vendor'}
          <section>
            <h3 class="section-title">Available Wares</h3>
            <ul class="item-list">
              {#each vendorItems as item}
                <li class="item-row">
                  <span class="item-glyph {item.rarity}">{item.glyph}</span>
                  <div class="item-info">
                    <span class="item-name {item.rarity}">{item.name}</span>
                    <span class="item-stat">{item.stat}</span>
                  </div>
                  <span class="item-price">{item.price}</span>
                  <button class="buy-btn">Buy</button>
                </li>
              {/each}
            </ul>
          </section>
          <div class="gold-display">Your Gold: 42</div>

        {:else if building.label === 'Inn'}
          <section>
            <h3 class="section-title center">Rest & Recovery</h3>
            <div class="rest-options">
              <div class="rest-card">
                <div class="rest-card-header accent-green">Short Rest</div>
                <div class="rest-card-body">
                  <div class="rest-cost">5 gold</div>
                  <div class="rest-effect">Restore 50% HP</div>
                  <div class="hp-bar-label">Current HP: 85/120</div>
                  <div class="hp-bar"><div class="hp-fill" style="width: 70.8%"></div></div>
                  <button class="rest-btn accent-green">Rest (5g)</button>
                </div>
              </div>
              <div class="rest-card">
                <div class="rest-card-header accent">Full Rest</div>
                <div class="rest-card-body">
                  <div class="rest-cost">15 gold</div>
                  <div class="rest-effect">Restore 100% HP + MP</div>
                  <div class="hp-bar-label">Current HP: 85/120</div>
                  <div class="hp-bar"><div class="hp-fill" style="width: 70.8%"></div></div>
                  <button class="rest-btn accent">Rest (15g)</button>
                </div>
              </div>
            </div>
          </section>

        {:else if building.label === 'Stash'}
          <section>
            <h3 class="section-title">Storage (5/20)</h3>
            <div class="stash-grid">
              {#each [...Array(12)] as _, i}
                <div class="stash-slot" class:filled={i < 4} style={i < 4 ? `color: ${stashItems[i].fg}` : ''} title={i < 4 ? stashItems[i].name : 'Empty'}>
                  {#if i < 4}
                    {stashItems[i].char}
                  {/if}
                </div>
              {/each}
            </div>
            <div class="stash-buttons">
              <button class="action-btn">Deposit</button>
              <button class="action-btn">Withdraw</button>
            </div>
          </section>

        {:else if building.label === 'Guild Hall'}
          <section>
            <div class="guild-header">
              <span class="guild-icon" style="color: var(--accent)">⚜</span>
              <h3>Guild Hall</h3>
            </div>
            <div class="guild-rank">
              <span>Guild Rank: Apprentice</span>
              <div class="xp-bar"><div class="xp-fill" style="width: 68%"></div></div>
              <span class="xp-text">340/500 XP</span>
            </div>
          </section>

          <section class="quest-section">
            <h3 class="section-title">Available Quests</h3>
            <ul class="quest-list">
              {#each quests as quest}
                <li class="quest-entry">
                  <div class="quest-header">
                    <span class="quest-title">{quest.title}</span>
                    <span class="quest-difficulty {quest.difficultyClass}">{quest.difficulty}</span>
                  </div>
                  <p class="quest-desc">{quest.desc}</p>
                  <div class="quest-footer">
                    <span class="quest-reward">{quest.reward}</span>
                    <button class="accept-btn">Accept</button>
                  </div>
                </li>
              {/each}
            </ul>
          </section>

        {:else if building.label === 'Blacksmith'}
          <section>
            <h3 class="section-title" style="color: var(--accent-red)">Forge & Repairs</h3>
            <h4 class="subsection-title">Equipment</h4>
            <ul class="equipment-list">
              {#each equipment as item}
                <li class="equipment-row">
                  <span class="equip-glyph" style="color: var(--fg-muted)">{item.glyph}</span>
                  <div class="equipment-info">
                    <span class="equipment-name">{item.name}</span>
                    <span class="equipment-action">{item.action}</span>
                  </div>
                  <div class="equipment-right">
                    {#if item.stat}<span class="equipment-stat" style="color: {item.statColor}">{item.stat}</span>{/if}
                    <button class="upgrade-btn">{item.cost}</button>
                  </div>
                </li>
              {/each}
            </ul>
          </section>

          <section class="salvage-section">
            <div class="divider"></div>
            <h4 class="subsection-title">Salvage</h4>
            <p class="hint">Break down items for materials</p>
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: modal-backdrop-in 100ms ease;
  }

  .modal {
    background: var(--bg-card);
    border: 2px solid var(--accent);
    border-radius: 2px;
    box-shadow: 0 0 20px rgba(104, 194, 211, 0.15), 0 0 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
    max-width: 420px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    animation: modal-card-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 2px solid var(--accent);
    background: linear-gradient(180deg, rgba(104, 194, 211, 0.08) 0%, transparent 100%);
    position: relative;
  }

  .modal-header .icon {
    font-size: 24px;
    line-height: 1;
  }

  .modal-header h2 {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    color: var(--fg);
  }

  .close-btn {
    background: transparent;
    border: 1px solid var(--fg-dim);
    color: var(--fg-dim);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 2px;
    transition: all 0.1s ease;
  }

  .close-btn:hover {
    color: var(--accent-red);
    border-color: var(--accent-red);
    box-shadow: 0 0 6px rgba(180, 82, 82, 0.3);
    transform: scale(1.1);
  }

  .modal-body {
    padding: 12px 16px;
  }

  .section-title {
    color: var(--accent-amber);
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .section-title.center {
    text-align: center;
  }

  .subsection-title {
    color: var(--fg-muted);
    font-size: 13px;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  .item-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
    border-radius: var(--radius);
    transition: background var(--transition);
  }

  .item-row:hover {
    background: var(--bg-muted);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .item-glyph {
    font-size: 16px;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }
  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .item-stat {
    font-size: 10px;
    color: var(--fg-dim);
  }
  .item-glyph.common { color: var(--fg-muted); }
  .item-glyph.uncommon { color: var(--accent-green); }
  .item-glyph.rare { color: var(--accent); }
  .item-name.common { color: var(--fg); }
  .item-name.uncommon { color: var(--accent-green); }
  .item-name.rare { color: var(--accent); }

  .item-price {
    color: var(--accent-amber);
    font-size: 13px;
  }

  .buy-btn {
    background: transparent;
    border: 1px solid var(--accent-amber);
    color: var(--accent-amber);
    padding: 4px 12px;
    border-radius: var(--radius);
    font-size: 11px;
    cursor: pointer;
    transition: all var(--transition);
  }

  .buy-btn:hover {
    background: rgba(208, 160, 104, 0.15);
    transform: scale(1.05);
  }

  .gold-display {
    margin-top: 12px;
    padding: 8px 12px;
    border: 1px solid var(--accent-amber);
    border-radius: 2px;
    color: var(--accent-amber);
    font-weight: 600;
    background: rgba(211, 160, 104, 0.08);
    text-align: center;
  }

  .rest-options {
    display: flex;
    gap: 12px;
  }

  .rest-card {
    flex: 1;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .rest-card-header {
    padding: 8px;
    font-weight: 600;
    font-size: 13px;
    text-align: center;
  }

  .rest-card-header.accent-green {
    color: var(--accent-green);
    background: rgba(162, 220, 199, 0.1);
  }

  .rest-card-header.accent {
    color: var(--accent);
    background: rgba(104, 194, 211, 0.1);
  }

  .rest-card-body {
    padding: 8px;
  }

  .rest-btn {
    width: 100%;
    margin-top: 8px;
    padding: 6px;
    background: transparent;
    border-radius: var(--radius);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.1s ease;
  }
  .rest-btn.accent-green {
    border: 1px solid var(--accent-green);
    color: var(--accent-green);
  }
  .rest-btn.accent-green:hover {
    background: rgba(162, 220, 199, 0.15);
  }
  .rest-btn.accent {
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .rest-btn:hover {
    background: rgba(104, 194, 211, 0.15);
    transform: scale(1.05);
  }

  .buy-btn:active, .accept-btn:active, .upgrade-btn:active, .action-btn:active, .rest-btn:active {
    transform: scale(0.95);
  }

  .rest-cost {
    color: var(--accent-amber);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .rest-effect {
    color: var(--fg-muted);
    font-size: 12px;
    margin-bottom: 12px;
  }

  .hp-bar-label {
    font-size: 11px;
    color: var(--fg-dim);
    margin-bottom: 4px;
  }

  .hp-bar, .xp-bar {
    height: 6px;
    background: var(--bg);
    border-radius: 3px;
    overflow: hidden;
  }

  .hp-fill {
    height: 100%;
    background: var(--accent-green);
    border-radius: 3px;
  }

  .stash-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .stash-slot {
    background: var(--bg-muted);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    min-height: 40px;
    transition: all 0.1s ease;
  }

  .stash-slot.filled:hover {
    border-color: var(--accent);
    box-shadow: 0 0 6px rgba(104, 194, 211, 0.2);
    transform: scale(1.08);
  }

  .stash-slot.filled {
    border-style: solid;
  }

  .stash-buttons {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .action-btn {
    flex: 1;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: 8px 16px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition);
  }

  .action-btn:hover {
    border-color: var(--fg-muted);
    color: var(--fg);
    transform: scale(1.05);
  }

  .guild-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .guild-icon {
    font-size: 20px;
  }

  .guild-header h3 {
    margin: 0;
    color: var(--fg);
    font-size: 14px;
  }

  .guild-rank {
    background: var(--bg-muted);
    padding: 8px;
    border-radius: var(--radius);
  }

  .guild-rank span:first-child {
    color: var(--fg-muted);
    font-size: 12px;
  }

  .xp-bar {
    margin: 8px 0 4px;
  }

  .xp-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }

  .xp-text {
    font-size: 11px;
    color: var(--fg-dim);
  }

  .quest-section {
    margin-top: 10px;
  }

  .quest-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .quest-entry {
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px;
    margin-bottom: 6px;
    transition: border-color 0.1s, box-shadow 0.1s;
  }

  .quest-entry:hover {
    border-color: var(--accent);
    box-shadow: 0 0 8px rgba(104, 194, 211, 0.1);
  }

  .quest-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .quest-title {
    font-weight: 600;
    color: var(--fg);
  }

  .quest-difficulty {
    font-size: 11px;
    font-weight: 600;
  }
  .quest-difficulty.diff-easy { color: var(--accent-green); }
  .quest-difficulty.diff-medium { color: var(--accent-amber); }
  .quest-difficulty.diff-hard { color: var(--accent-red); }

  .quest-desc {
    color: var(--fg-dim);
    font-size: 12px;
    margin: 0 0 4px;
  }

  .quest-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .quest-reward {
    color: var(--accent-amber);
    font-size: 12px;
  }

  .accept-btn {
    background: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: var(--radius);
    font-size: 11px;
    cursor: pointer;
    transition: all var(--transition);
  }

  .accept-btn:hover {
    background: rgba(104, 194, 211, 0.15);
    transform: scale(1.05);
  }

  .equipment-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .equipment-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-muted);
    transition: background 0.1s;
  }

  .equipment-row:hover {
    background: rgba(104, 194, 211, 0.05);
  }

  .equipment-row:last-child {
    border-bottom: none;
  }

  .equip-glyph {
    font-size: 16px;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .equipment-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .equipment-name {
    color: var(--fg);
    font-weight: 500;
  }

  .equipment-action {
    color: var(--fg-dim);
    font-size: 12px;
  }

  .equipment-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .equipment-stat {
    color: var(--accent-green);
    font-size: 11px;
  }

  .upgrade-btn {
    background: transparent;
    border: 1px solid var(--accent-amber);
    color: var(--accent-amber);
    padding: 4px 10px;
    border-radius: var(--radius);
    font-size: 11px;
    cursor: pointer;
    transition: all var(--transition);
  }

  .upgrade-btn:hover {
    background: rgba(208, 160, 104, 0.15);
    transform: scale(1.05);
  }

  .salvage-section .hint {
    color: var(--fg-dim);
    font-size: 12px;
    margin: 0;
  }

  .divider {
    border-top: 1px solid var(--border);
    margin: 16px 0;
  }

  @keyframes modal-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes modal-card-in {
    0% { opacity: 0; transform: translateY(20px) scale(0.8, 1.2); }
    50% { opacity: 1; transform: translateY(-4px) scale(1.03, 0.97); }
    75% { transform: translateY(2px) scale(0.99, 1.01); }
    100% { transform: translateY(0) scale(1, 1); }
  }
</style>
