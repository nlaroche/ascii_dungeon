Fix the camera and movement system in GraphicsLab.svelte. There are TWO bugs:

## Bug 1: Sub-cell camera offset creates visual glitches
The current approach uses `renderer.cameraOffsetX = -fracX * config.cellSize` to shift the entire grid for "smooth" movement. This is WRONG because the player IS part of the grid — shifting all cells shifts the player too. At `Math.round()` boundaries (0.5), the player grid cell snaps while the offset jumps in the opposite direction, creating a visible teleport/jitter.

## Bug 2: No camera following — player walks off screen
The 80x45 grid is larger than the canvas viewport. Without camera centering, the player walks off the visible area.

## The Fix

### Camera Following (center viewport on player)
The camera offset should center the VIEW on the player's interpolated position. This means the dungeon scrolls beneath while the player appears near screen center.

In the animation loop, compute camera offset as:
```javascript
// Center camera on the player's interpolated position
const screenCenterX = (renderer.canvas.width / dpr) / 2;
const screenCenterY = (renderer.canvas.height / dpr) / 2;
const dpr = window.devicePixelRatio || 1;

// Camera centers on interpolated player position
renderer.cameraOffsetX = screenCenterX - px * config.cellSize;
renderer.cameraOffsetY = screenCenterY - py * config.cellSize * 1.5;
```

### Grid-snapped player position
Keep the player rendered at `Math.floor(px), Math.floor(py)` — this is fine because the camera following makes the visual transition smooth. The player stays near screen center while the world scrolls.

### Remove the broken fracX/fracY offset
Delete the lines:
```javascript
const fracX = px - Math.round(px);
const fracY = py - Math.round(py);
renderer.cameraOffsetX = -fracX * config.cellSize;
renderer.cameraOffsetY = -fracY * config.cellSize * 1.5;
```

Replace with the camera following code above.

### Keep everything else the same
- Keep the interpolated px, py for FOV/lighting computations (this makes FOV transition smoothly)
- Keep the merged FOV from floor/ceil positions
- Keep the path, enemies, torches, particles etc
- Player renders at `Math.floor(px), Math.floor(py)` (change from Math.round to Math.floor)

### Note about DPR
The Renderer.js already multiplies cameraOffset by DPR in render(). So pass CSS pixel values (not physical pixels) to cameraOffsetX/Y. The canvas.width is in physical pixels, so divide by DPR to get CSS pixels for the center calculation.
