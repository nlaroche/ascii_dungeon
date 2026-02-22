<script>
  import { createEventDispatcher } from 'svelte';
  import GameButton from './GameButton.svelte';
  import TorchGlyph from './TorchGlyph.svelte';

  export let hasSave = false;

  const dispatch = createEventDispatcher();

  let selected = 0;

  $: menuItems = hasSave
    ? [
        { label: 'Continue', color: 'var(--accent)', action: 'continue' },
        { label: 'New Run', color: 'var(--accent-green)', action: 'new-run' },
      ]
    : [
        { label: 'New Run', color: 'var(--accent-green)', action: 'new-run' },
      ];

  function activate(item) {
    dispatch('menuSelect', item.action);
  }

  function handleKeydown(e) {
    if (e.key === 'ArrowUp' || e.key === 'w') {
      selected = Math.max(0, selected - 1);
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      selected = Math.min(menuItems.length - 1, selected + 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      activate(menuItems[selected]);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="intro-overlay">
  <div class="torches-top">
    <TorchGlyph size="lg" />
    <TorchGlyph size="lg" />
  </div>

  <div class="title-block">
    <div class="title-border">{'═'.repeat(24)}</div>
    <h1 class="title">ASCII DUNGEON</h1>
    <div class="title-border">{'═'.repeat(24)}</div>
    <p class="subtitle">A Roguelike Adventure</p>
  </div>

  <nav class="menu">
    {#each menuItems as item, i}
      <GameButton
        label={item.label}
        color={item.color}
        focused={i === selected}
        showArrow={i === selected}
        on:click={() => activate(item)}
        on:mouseenter={() => { selected = i; }}
      />
    {/each}
  </nav>

  <div class="torches-bottom">
    <TorchGlyph size="md" />
    <TorchGlyph size="md" />
  </div>

  <p class="version">v0.1 - WebGPU ASCII Engine</p>
</div>

<style>
  .intro-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    animation: overlay-in 600ms ease-out both;
  }

  .torches-top, .torches-bottom {
    display: flex;
    gap: 200px;
    pointer-events: none;
  }

  .torches-top {
    margin-bottom: 20px;
  }

  .torches-bottom {
    margin-top: 40px;
  }

  .title-block {
    text-align: center;
    margin-bottom: 30px;
    pointer-events: none;
  }

  .title-border {
    color: var(--fg-dim, #71717a);
    font-size: 14px;
    letter-spacing: 2px;
  }

  .title {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent, #68c2d3);
    margin: 6px 0;
    letter-spacing: 4px;
    text-shadow: 0 0 20px rgba(104, 194, 211, 0.3);
  }

  .subtitle {
    color: var(--fg-muted, #a1a1aa);
    font-size: 13px;
    margin: 8px 0 0;
    animation: subtitle-in 800ms 400ms ease-out both;
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: auto;
  }

  .version {
    position: absolute;
    bottom: 20px;
    color: var(--fg-dim, #71717a);
    font-size: 11px;
    pointer-events: none;
  }

  @keyframes overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes subtitle-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
