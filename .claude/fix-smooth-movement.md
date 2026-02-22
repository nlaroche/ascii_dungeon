Fix the teleporting player movement. The character snaps between tiles because setCell only takes integer coordinates and the FOV is computed from a rounded position.

THE PROBLEM:
- `renderer.setCell(Math.round(px), Math.round(py), '@', ...)` snaps the player to integer grid positions
- `castFOV(Math.round(px), Math.round(py), ...)` makes the entire FOV snap too
- Result: player appears to teleport from tile to tile

THE FIX - Smooth FOV transition:
Compute FOV from BOTH the current tile and the next tile, merge them, and use fractional position for lighting.

1. In fillDemoScene, change the FOV computation to merge two FOV sets:

Replace this:
```js
const isBlocking = (x, y) => dungeonMap[y]?.[x] === 1;
const fovVisible = castFOV(Math.round(px), Math.round(py), config.visionRadius, isBlocking);
```

With this:
```js
const isBlocking = (x, y) => dungeonMap[y]?.[x] === 1;
const cx = Math.floor(px), cy = Math.floor(py);
const nx = Math.ceil(px), ny = Math.ceil(py);
const fov1 = castFOV(cx, cy, config.visionRadius, isBlocking);
const fov2 = (cx !== nx || cy !== ny) ? castFOV(nx, ny, config.visionRadius, isBlocking) : fov1;
// Merge: union of both FOV sets
const fovVisible = new Set([...fov1, ...fov2]);
```

2. Render the player at BOTH the current and next tile during transitions:

Replace the single player render line:
```js
renderer.setCell(Math.round(px), Math.round(py), '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);
```

With a dual-render that fades between positions:
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

3. Also slow down movement more - change moveSpeed from 2 to 1.5 so each tile transition takes ~0.67 seconds (more visible smooth movement):

```js
const moveSpeed = 1.5;
```

IMPORTANT: Only change these specific parts of fillDemoScene and the loop. Do NOT change anything else.
