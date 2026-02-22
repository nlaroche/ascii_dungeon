<script>
  import ParamSlider from '../components/ParamSlider.svelte';
  import ParamToggle from '../components/ParamToggle.svelte';
  import GamePanel from '../../game/ui/GamePanel.svelte';
  import GameStatBar from '../../game/ui/GameStatBar.svelte';
  import GameButton from '../../game/ui/GameButton.svelte';
  import GameBadge from '../../game/ui/GameBadge.svelte';
  import TorchGlyph from '../../game/ui/TorchGlyph.svelte';
  import CharacterHUD from '../../game/ui/CharacterHUD.svelte';
  import IntroOverlay from '../../game/ui/IntroOverlay.svelte';

  // ── Interactive state ──
  let hpValue = 75;
  let hpMax = 100;
  let staminaValue = 15;
  let staminaMax = 20;
  let xpValue = 340;
  let xpMax = 500;
  let attackStat = 12;
  let defenseStat = 7;
  let goldAmount = 42;
  let playerLevel = 3;
  let showHasSave = true;
  let btnFocused = 0;

  $: mockPlayer = {
    name: 'Hero',
    hp: hpValue,
    maxHp: hpMax,
    stamina: staminaValue,
    maxStamina: staminaMax,
    attack: attackStat,
    defense: defenseStat,
    gold: goldAmount,
    level: playerLevel,
  };
</script>

<div class="uilab">
  <h2>Game UI Components</h2>
  <p class="hint">Reusable Svelte components for in-game UI overlays.</p>

  <div class="grid">
    <!-- GamePanel -->
    <section class="card">
      <h3>GamePanel</h3>
      <div class="demo-row">
        <GamePanel title="Inventory">
          <p class="sample-text">Panel with title and content slot.</p>
        </GamePanel>
      </div>
      <div class="demo-row">
        <GamePanel>
          <p class="sample-text">Panel without title — just a bordered container.</p>
        </GamePanel>
      </div>
    </section>

    <!-- GameStatBar -->
    <section class="card">
      <h3>GameStatBar</h3>
      <div class="demo-row">
        <GameStatBar label="HP" value={hpValue} max={hpMax} color="var(--accent-green)" />
        <GameStatBar label="Stamina" value={staminaValue} max={staminaMax} color="var(--accent)" />
        <GameStatBar label="XP" value={xpValue} max={xpMax} color="var(--accent-amber)" />
      </div>
      <div class="controls-row">
        <ParamSlider label="HP" bind:value={hpValue} min={0} max={hpMax} step={1} />
        <ParamSlider label="Stamina" bind:value={staminaValue} min={0} max={staminaMax} step={1} />
        <ParamSlider label="XP" bind:value={xpValue} min={0} max={xpMax} step={10} />
      </div>
    </section>

    <!-- GameButton -->
    <section class="card">
      <h3>GameButton</h3>
      <div class="demo-row btn-row">
        <GameButton label="New Run" color="var(--accent-green)" focused={btnFocused === 0} showArrow={btnFocused === 0} on:click={() => { btnFocused = 0; }} />
        <GameButton label="Continue" color="var(--accent)" focused={btnFocused === 1} showArrow={btnFocused === 1} on:click={() => { btnFocused = 1; }} />
        <GameButton label="Disabled" color="var(--fg-dim)" disabled={true} />
      </div>
    </section>

    <!-- GameBadge -->
    <section class="card">
      <h3>GameBadge</h3>
      <div class="demo-row badge-row">
        <GameBadge icon="/" label="ATK" value={attackStat} color="var(--accent-red)" />
        <GameBadge icon="[" label="DEF" value={defenseStat} color="#4b80ca" />
        <GameBadge icon="$" value="{goldAmount}g" color="var(--accent-amber)" />
        <GameBadge icon="*" label="LV" value={playerLevel} color="var(--accent)" />
      </div>
      <div class="controls-row">
        <ParamSlider label="ATK" bind:value={attackStat} min={1} max={50} step={1} />
        <ParamSlider label="DEF" bind:value={defenseStat} min={1} max={50} step={1} />
        <ParamSlider label="Gold" bind:value={goldAmount} min={0} max={999} step={1} />
      </div>
    </section>

    <!-- TorchGlyph -->
    <section class="card">
      <h3>TorchGlyph</h3>
      <div class="demo-row torch-row">
        <div class="torch-demo">
          <span class="torch-label">sm</span>
          <TorchGlyph size="sm" />
        </div>
        <div class="torch-demo">
          <span class="torch-label">md</span>
          <TorchGlyph size="md" />
        </div>
        <div class="torch-demo">
          <span class="torch-label">lg</span>
          <TorchGlyph size="lg" />
        </div>
      </div>
    </section>

    <!-- CharacterHUD -->
    <section class="card card-wide">
      <h3>CharacterHUD</h3>
      <div class="demo-row hud-demo">
        <div class="hud-preview">
          <CharacterHUD player={mockPlayer} day={5} timeOfDay="afternoon" />
        </div>
      </div>
      <div class="controls-row">
        <ParamSlider label="HP" bind:value={hpValue} min={0} max={hpMax} step={1} />
        <ParamSlider label="Stamina" bind:value={staminaValue} min={0} max={staminaMax} step={1} />
        <ParamSlider label="Level" bind:value={playerLevel} min={1} max={20} step={1} />
      </div>
    </section>

    <!-- IntroOverlay Preview -->
    <section class="card card-wide">
      <h3>IntroOverlay</h3>
      <div class="demo-row">
        <ParamToggle label="Has Save" bind:value={showHasSave} />
      </div>
      <div class="intro-preview">
        <IntroOverlay hasSave={showHasSave} />
      </div>
    </section>
  </div>
</div>

<style>
  .uilab {
    max-width: 900px;
  }

  .uilab h2 {
    color: var(--fg);
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
  }

  .card h3 {
    color: var(--fg-muted);
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 12px;
  }

  .card-wide {
    grid-column: 1 / -1;
  }

  .demo-row {
    margin-bottom: 12px;
  }

  .controls-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .sample-text {
    color: var(--fg-dim);
    font-size: 12px;
    margin: 0;
  }

  .btn-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .badge-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .torch-row {
    display: flex;
    gap: 30px;
    align-items: flex-end;
    justify-content: center;
    padding: 16px 0;
  }

  .torch-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .torch-label {
    color: var(--fg-dim);
    font-size: 10px;
  }

  .hud-preview {
    position: relative;
    width: 240px;
    height: 200px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .hud-demo {
    display: flex;
    justify-content: center;
  }

  .intro-preview {
    position: relative;
    width: 100%;
    height: 300px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
</style>
