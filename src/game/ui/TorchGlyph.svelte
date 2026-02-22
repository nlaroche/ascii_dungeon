<script>
  export let size = 'md';
</script>

<span class="torch" class:sm={size === 'sm'} class:lg={size === 'lg'}>
  <span class="flame">*</span>
  <span class="post">{'\u2565'}</span>
</span>

<style>
  .torch {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    font-family: var(--font-mono, monospace);
    font-size: 20px;
  }

  .torch.sm { font-size: 14px; }
  .torch.lg { font-size: 28px; }

  .flame {
    color: var(--accent-amber, #d3a068);
    animation: torch-flicker 0.8s ease-in-out infinite alternate;
    text-shadow: 0 0 6px rgba(211, 160, 104, 0.6);
  }

  .post {
    color: var(--fg-dim, #71717a);
  }

  @keyframes torch-flicker {
    0% {
      opacity: 0.7;
      transform: translateY(0) scale(1);
      text-shadow: 0 0 4px rgba(211, 160, 104, 0.4);
    }
    30% {
      opacity: 1;
      transform: translateY(-1px) scaleX(1.1);
      text-shadow: 0 0 8px rgba(211, 160, 104, 0.8);
    }
    60% {
      opacity: 0.85;
      transform: translateY(0) scaleX(0.9);
      text-shadow: 0 0 6px rgba(211, 160, 104, 0.5);
    }
    100% {
      opacity: 0.95;
      transform: translateY(-1px) scale(1.05);
      text-shadow: 0 0 10px rgba(211, 160, 104, 0.7);
    }
  }
</style>
