Fix the player movement in GraphicsLab.svelte so the character smoothly tweens between cells instead of teleporting.

## Current Problem
The camera follows the player smoothly via continuous interpolation, but the '@' character rendered at Math.floor(px) jumps instantly from one cell to the next. The user wants to SEE the character slide from one cell to another with an easeOutQuint tween over ~0.25 seconds.

## Solution: Discrete Tween System

Replace the continuous path interpolation with a discrete cell-to-cell tween system:

1. **Track the current cell and target cell separately**:
   - `currentCellX, currentCellY` — where the player IS right now (integer)
   - `targetCellX, targetCellY` — where the player is moving TO (integer)
   - `tweenProgress` — 0 to 1, how far through the tween

2. **Path progression**: Instead of continuous `time * moveSpeed`, advance through the path at discrete steps. Every time a tween finishes (progress >= 1), move to the next waypoint in the path.

3. **EaseOutQuint function**:
```javascript
function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}
```

4. **Camera follows the eased position**: The camera centers on the EASED interpolated position between currentCell and targetCell. This makes both the world AND the player appear to slide smoothly.

5. **Player rendered at currentCell**: The '@' is always rendered at `currentCellX, currentCellY`. The visual sliding comes entirely from the camera offset tweening between positions.

Wait, that still has the same problem — the player is grid-snapped. Let me reconsider.

## Better Solution: Camera tween creates visual slide

The key insight: if the camera offset tweens smoothly from "centered on old cell" to "centered on new cell" with easeOutQuint, then the ENTIRE GRID slides smoothly. Since the player '@' is part of the grid, it visually slides too. The player always renders at a fixed grid cell, but the camera movement creates the illusion of smooth character movement.

Here's the implementation:

```javascript
// State for discrete tween movement
let pathIndex = 0;
let tweenStart = 0;
const TWEEN_DURATION = 0.25; // seconds
let fromX, fromY, toX, toY;

// Initialize
fromX = toX = path[0].x;
fromY = toY = path[0].y;

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

// In the loop:
const loop = (now) => {
  // ... dt calculation ...
  time += dt;

  // Check if current tween is complete
  const tweenElapsed = time - tweenStart;
  let tweenT = Math.min(tweenElapsed / TWEEN_DURATION, 1.0);
  const easedT = easeOutQuint(tweenT);

  if (tweenT >= 1.0) {
    // Move to next path point
    fromX = toX;
    fromY = toY;
    pathIndex = (pathIndex + 1) % path.length;
    toX = path[pathIndex].x;
    toY = path[pathIndex].y;
    tweenStart = time;
    tweenT = 0;
  }

  // Interpolated position with easing
  const px = fromX + (toX - fromX) * easedT;
  const py = fromY + (toY - fromY) * easedT;

  // Camera centers on eased position
  const dpr = window.devicePixelRatio || 1;
  const screenCenterX = (renderer.canvas.width / dpr) / 2;
  const screenCenterY = (renderer.canvas.height / dpr) / 2;
  renderer.cameraOffsetX = screenCenterX - px * config.cellSize;
  renderer.cameraOffsetY = screenCenterY - py * config.cellSize * 1.5;

  // Player always rendered at the FROM cell (where they currently are)
  // The camera tween creates the visual slide
  // Actually render at toX, toY so they appear to move forward
  // No wait — render at the EASED position rounded to nearest cell
  // This way the @ jumps cells but the camera smooths it out

  // ... fillDemoScene uses px, py for FOV/lighting ...
  fillDemoScene(time, px, py);
  renderer.render();
};
```

The player '@' in fillDemoScene should render at `Math.round(px), Math.round(py)` — the nearest cell to the eased position. Since the camera is also centered on the eased position, the '@' stays near screen center and the world slides around it. The easing makes the slide accelerate/decelerate naturally.

## Changes to make:

1. Replace the continuous animation variables with the discrete tween state:
   - Remove `const moveSpeed = 1.5; const t = ...; const idx = ...; const frac = ...;`
   - Add `pathIndex`, `tweenStart`, `fromX/Y`, `toX/Y` state
   - Add `easeOutQuint` function
   - Add `TWEEN_DURATION = 0.25`

2. In the loop, implement the tween logic above

3. Keep `fillDemoScene(time, px, py)` using the eased px, py for FOV/lighting

4. Keep camera offset using the eased px, py

5. In fillDemoScene, render player at `Math.round(px), Math.round(py)`

6. The TWEEN_DURATION should be affected by config.animSpeed:
   `const effectiveDuration = TWEEN_DURATION / config.animSpeed;`
   So higher animSpeed = faster movement.

The result: the player visually slides from cell to cell with easeOutQuint easing. The camera tracks the eased position. FOV and lighting update smoothly during the slide. The world feels alive and responsive.
