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
    { name: 'Iron Sword', price: '12g' },
    { name: 'Leather Armor', price: '8g' },
    { name: 'Health Potion', price: '3g' },
    { name: 'Torch Bundle', price: '2g' },
    { name: 'Map Fragment', price: '5g' },
    { name: 'Lucky Charm', price: '15g' },
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
    { name: 'Iron Sword', action: 'Upgrade to +2', cost: '25g', stat: '+3 ATK' },
    { name: 'Chain Mail', action: 'Repair (80%)', cost: '10g', stat: '' },
    { name: 'Buckler', action: 'Reinforce', cost: '15g', stat: '+2 DEF' },
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
    transition:fade={{ duration: 250 }}
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
                  <span class="item-name">{item.name}</span>
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
                </div>
              </div>
              <div class="rest-card">
                <div class="rest-card-header accent">Full Rest</div>
                <div class="rest-card-body">
                  <div class="rest-cost">15 gold</div>
                  <div class="rest-effect">Restore 100% HP + MP</div>
                  <div class="hp-bar-label">Current HP: 85/120</div>
                  <div class="hp-bar"><div class="hp-fill" style="width: 70.8%"></div></div>
                </div>
              </div>
            </div>
          </section>

        {:else if building.label === 'Stash'}
          <section>
            <h3 class="section-title">Storage (5/20)</h3>
            <div class="stash-grid">
              {#each [...Array(20)] as _, i}
                <div class="stash-slot" class:filled={i < 4} style={i < 4 ? `color: ${stashItems[i].fg}` : ''}>
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
                  <div class="equipment-info">
                    <span class="equipment-name">{item.name}</span>
                    <span class="equipment-action">{item.action}</span>
                  </div>
                  <div class="equipment-right">
                    {#if item.stat}<span class="equipment-stat">{item.stat}</span>{/if}
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
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: modal-backdrop-in 250ms ease;
  }

  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border-accent);
    border-radius: var(--radius-lg);
    box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1);
    max-width: 480px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    animation: modal-card-in 300ms ease;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
    position: relative;
  }

  .modal-header .icon {
    font-size: 32px;
    line-height: 1;
  }

  .modal-header h2 {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--fg);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--fg-dim);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
    transition: color var(--transition);
  }

  .close-btn:hover {
    color: var(--fg);
  }

  .modal-body {
    padding: 24px;
  }

  .section-title {
    color: var(--accent-amber);
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px;
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
    padding: 10px 12px;
    border-radius: var(--radius);
    transition: background var(--transition);
  }

  .item-row:hover {
    background: var(--bg-muted);
  }

  .item-name {
    flex: 1;
    color: var(--fg);
  }

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
  }

  .gold-display {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    color: var(--accent-amber);
    font-weight: 600;
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
    padding: 12px;
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
    padding: 12px;
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
    aspect-ratio: 1;
    background: var(--bg-muted);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    min-height: 56px;
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
    padding: 12px;
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
    margin-top: 16px;
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
    padding: 12px;
    margin-bottom: 8px;
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
    margin: 0 0 8px;
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
  }

  .equipment-row:last-child {
    border-bottom: none;
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
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
```
