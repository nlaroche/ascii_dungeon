Enhance GraphicsLab.svelte with atmospheric particles and improved torch effects. Also add workbench controls for the new visual features.

## 1. Dust Motes
Add 15-20 floating dust particles on visible floor tiles. These are tiny characters that drift slowly.

In the script section, add a dust mote array and animation logic:
```javascript
// Generate dust motes once
const dustMotes = [];
for (let i = 0; i < 20; i++) {
  dustMotes.push({
    x: Math.random() * GRID_W,
    y: Math.random() * GRID_H,
    char: Math.random() > 0.5 ? '.' : ',',
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.15,
    phase: Math.random() * Math.PI * 2
  });
}
```

In fillDemoScene, after rendering treasures but before the player, render dust motes:
```javascript
// Dust motes - floating particles on visible floor tiles
if (config.showDust) {
  for (const mote of dustMotes) {
    // Gentle sine-wave drift
    const mx = mote.x + Math.sin(time * 0.5 + mote.phase) * 0.8;
    const my = mote.y + Math.cos(time * 0.3 + mote.phase) * 0.4;
    const rx = Math.round(mx) % GRID_W;
    const ry = Math.round(my) % GRID_H;

    // Only render on visible floor tiles
    const key = (ry << 8) | rx;
    if (fovVisible.has(key) && dungeonMap[ry]?.[rx] >= 2) {
      renderer.setCell(rx, ry, mote.char, '#888866', '#1a1a2e', 0.0, CELL_FLAGS.VISIBLE, 0.15);
    }

    // Slowly drift
    mote.x += mote.speedX * 0.016;
    mote.y += mote.speedY * 0.016;

    // Wrap around
    if (mote.x < 0) mote.x += GRID_W;
    if (mote.x >= GRID_W) mote.x -= GRID_W;
    if (mote.y < 0) mote.y += GRID_H;
    if (mote.y >= GRID_H) mote.y -= GRID_H;
  }
}
```

## 2. Enhanced Torch Particles
Replace the current torch particle code (the for loop with `for (let p = 0; p < 3; p++)`) with:

```javascript
// Enhanced torch particles - sparks, embers, smoke
for (let p = 0; p < 6; p++) {
  const phase = time * 2.5 + p * 1.3 + torch.x * 0.7 + torch.y * 0.3;
  const sparkLife = phase % 4; // 4-frame lifecycle
  const sparkY = torch.y - 1 - sparkLife;
  const sparkX = torch.x + Math.sin(phase * 1.8) * 1.2; // wider scatter
  const rx = Math.round(sparkX), ry = Math.round(sparkY);

  if (ry >= 0 && ry < GRID_H && rx >= 0 && rx < GRID_W) {
    const fade = 1.0 - sparkLife / 4;
    if (fade > 0.05) {
      // Color gradient: bright yellow -> orange -> dim red
      const r = 'ff';
      const gVal = Math.floor(fade * 200).toString(16).padStart(2, '0');
      const bVal = Math.floor(fade * fade * 40).toString(16).padStart(2, '0');
      const sparkChar = fade > 0.6 ? '*' : fade > 0.3 ? '+' : '.';
      renderer.setCell(rx, ry, sparkChar, '#' + r + gVal + bVal, '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, fade * 0.8);
    }
  }
}

// Smoke wisps above sparks
for (let s = 0; s < 2; s++) {
  const sPhase = time * 1.2 + s * 3.0 + torch.x;
  const smokeY = torch.y - 4 - (sPhase % 3);
  const smokeX = torch.x + Math.sin(sPhase * 0.7) * 1.5;
  const srx = Math.round(smokeX), sry = Math.round(smokeY);
  if (sry >= 0 && sry < GRID_H && srx >= 0 && srx < GRID_W) {
    const sFade = 1.0 - (sPhase % 3) / 3;
    if (sFade > 0.1) {
      renderer.setCell(srx, sry, '~', '#555555', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, sFade * 0.3);
    }
  }
}
```

## 3. Wall Face Shading
In the fillDemoScene function, when rendering walls (tile === 1), check if any adjacent floor tile is lit. If so, slightly brighten the wall face toward the nearest torch:

After the existing wall color assignment, add:
```javascript
if (tile === 1 && inVision) {
  // Check adjacent floor tiles for light
  let maxAdjacentLight = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < GRID_H && nx >= 0 && nx < GRID_W) {
        if (dungeonMap[ny][nx] >= 2) { // floor tile
          const floorLight = computeLight(nx, ny, time);
          if (floorLight > maxAdjacentLight) maxAdjacentLight = floorLight;
        }
      }
    }
  }
  if (maxAdjacentLight > 0.1) {
    // Brighten wall toward warm torch color
    const warmth = maxAdjacentLight * 0.3;
    const rr = Math.min(255, parseInt(fg.slice(1,3), 16) + Math.floor(warmth * 80));
    const gg = Math.min(255, parseInt(fg.slice(3,5), 16) + Math.floor(warmth * 50));
    fg = '#' + rr.toString(16).padStart(2, '0') + gg.toString(16).padStart(2, '0') + fg.slice(5);
  }
}
```

## 4. Workbench Controls
Add to the config object:
```javascript
let config = { cellSize: 20, animSpeed: 1.0, visionRadius: 10, showDust: true, torchIntensity: 1.0 };
```

Add new sliders/controls in the controls div:
- A checkbox toggle for "Dust Motes" bound to config.showDust
- A ParamSlider for "Torch Intensity" (0.5 to 2.0, step 0.1, default 1.0) bound to config.torchIntensity

Use config.torchIntensity as a multiplier in the torch particle fade calculations.

Also add a slider for "Parallax" (0 to 1.0, step 0.05, default 0.3) that sets `renderer.parallaxStrength` (if available).
