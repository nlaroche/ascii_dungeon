Implement true smooth sub-cell player movement using camera scrolling.

THE APPROACH:
The grid can only render characters at integer positions. To make the player smoothly glide between cells, we shift the ENTIRE grid by fractional pixel amounts. The player '@' stays at an integer grid cell, but the camera offset makes it visually appear at the correct sub-pixel position.

The shader already has a `cameraOffset` uniform at offset 32-36 in the uniform buffer. It's currently multiplied by `cell.depth * parallaxStrength` for parallax only. We need it to apply to ALL cells as a base scroll offset.

## CHANGES NEEDED:

### 1. src/renderer/shaders/tilemap.wgsl
Change line 71 from:
```
  pixelPos += cell.depth * uniforms.cameraOffset * uniforms.parallaxStrength;
```
To:
```
  pixelPos += uniforms.cameraOffset;
```

This makes cameraOffset shift ALL cells equally (global scroll), not just a parallax effect.

### 2. src/renderer/Renderer.js
Add camera offset properties and pass them through to the tilemap render call.

In the constructor, after `this.tilemap = null;`, add:
```js
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
```

In the render() method, pass the camera offsets to tilemap.render():
Change:
```js
    this.tilemap.render(
      commandEncoder,
      textureView,
      this.canvas.width,
      this.canvas.height,
      this.time,
      this.cellSize * dpr,
      this.cellSize * 1.5 * dpr
    );
```
To:
```js
    this.tilemap.render(
      commandEncoder,
      textureView,
      this.canvas.width,
      this.canvas.height,
      this.time,
      this.cellSize * dpr,
      this.cellSize * 1.5 * dpr,
      this.cameraOffsetX * dpr,
      this.cameraOffsetY * dpr
    );
```

### 3. src/workbench/sections/GraphicsLab.svelte
In the render loop, compute the fractional player offset and apply it as camera scroll.

Replace the player rendering and camera setup. In the loop function, BEFORE calling fillDemoScene, add camera offset calculation:

Replace this block in the loop:
```js
        const px = curr.x + (next.x - curr.x) * frac;
        const py = curr.y + (next.y - curr.y) * frac;

        renderer.cellSize = config.cellSize;
        fillDemoScene(time, px, py);
        renderer.render();
```

With:
```js
        const px = curr.x + (next.x - curr.x) * frac;
        const py = curr.y + (next.y - curr.y) * frac;

        // Smooth camera: offset the grid by the fractional part of player position
        const fracX = px - Math.round(px);
        const fracY = py - Math.round(py);
        renderer.cameraOffsetX = -fracX * config.cellSize;
        renderer.cameraOffsetY = -fracY * config.cellSize * 1.5;

        renderer.cellSize = config.cellSize;
        fillDemoScene(time, px, py);
        renderer.render();
```

Also, revert the player rendering back to a single position. Replace the dual-tile player rendering block:
```js
    // Player rendered at both tiles during transition
    const playerCX = Math.floor(px), playerCY = Math.floor(py);
    const playerNX = Math.ceil(px), playerNY = Math.ceil(py);
    const playerFrac = Math.max(Math.abs(px - playerCX), Math.abs(py - playerCY));
    if (playerCX !== playerNX || playerCY !== playerNY) {
      // Fading out of current tile
      const fadeOut = Math.max(0.2, 1.0 - playerFrac);
      renderer.setCell(playerCX, playerCY, '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, fadeOut);
      // Fading into next tile
      const fadeIn = Math.max(0.2, playerFrac);
      renderer.setCell(playerNX, playerNY, '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, fadeIn);
    } else {
      renderer.setCell(playerCX, playerCY, '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);
    }
```

With:
```js
    // Player at nearest grid cell (camera offset handles smooth visual movement)
    renderer.setCell(Math.round(px), Math.round(py), '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);
```

HOW IT WORKS:
- Player is at fractional position (5.3, 6.7)
- Player '@' is rendered at grid cell (5, 7) via Math.round
- Camera offset is set to (-0.3 * cellWidth, 0.3 * cellHeight) pixels
- The shader shifts ALL cells by this offset
- Visually, the '@' appears at the exact fractional position between cells
- As the player moves, the fractional offset smoothly changes, creating fluid movement

IMPORTANT:
- Change all 3 files as specified
- Keep all hex colors (no rgb syntax)
- Keep Svelte 4 patterns
- The cameraOffset is in CSS pixels, multiplied by DPR in Renderer.render()
