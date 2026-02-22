<script>
  import { createEventDispatcher } from 'svelte';

  export let label = '';
  export let focused = false;
  export let disabled = false;
  export let color = 'var(--accent)';
  export let showArrow = false;

  const dispatch = createEventDispatcher();

  function handleClick() {
    if (!disabled) dispatch('click');
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="game-btn"
  class:focused
  class:disabled
  style="--btn-color: {color};"
  on:click={handleClick}
  on:keydown={handleKeydown}
  {disabled}
>
  {#if showArrow}
    <span class="arrow">&gt;</span>
  {/if}
  <span class="btn-label">{label}</span>
</button>

<style>
  .game-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    background: transparent;
    border: 1px solid var(--btn-color);
    color: var(--btn-color);
    font-family: var(--font-mono, monospace);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 80ms ease-out;
    min-width: 160px;
    text-align: left;
  }

  .game-btn:hover:not(.disabled) {
    background: color-mix(in srgb, var(--btn-color) 15%, transparent);
    transform: scale(1.03);
  }

  .game-btn:active:not(.disabled) {
    animation: btn-squash 150ms ease-out;
  }

  .game-btn.focused {
    background: var(--btn-color);
    color: var(--bg, #09090b);
    box-shadow: 0 0 10px color-mix(in srgb, var(--btn-color) 30%, transparent);
  }

  .game-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .arrow {
    font-size: 16px;
    animation: arrow-pulse 1s ease-in-out infinite;
  }

  .btn-label {
    flex: 1;
  }

  @keyframes btn-squash {
    0% { transform: scaleX(1) scaleY(1); }
    40% { transform: scaleX(1.15) scaleY(0.85); }
    70% { transform: scaleX(0.95) scaleY(1.05); }
    100% { transform: scaleX(1) scaleY(1); }
  }

  @keyframes arrow-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
</style>
