Completely rewrite GraphicsLab.svelte to fix multiple issues. This is a full rewrite of the script section.

CURRENT PROBLEMS:
1. Character appears to teleport (movement not smooth enough)
2. Vision is just a circle - no proper FOV with shadow casting
3. Torches have no real lighting effect - just distance falloff, no shadows from walls
4. Character walks through walls (path waypoints cross wall tiles)
5. Map doesn't fill the preview area (grid too small)
6. No particle effects for torches
7. Explored-but-not-visible areas look the same as unexplored

REQUIREMENTS FOR THE REWRITE:

## 1. LARGER GRID - Fill the canvas
Change grid to 80x45 (from 60x35). Build a bigger dungeon with 6 rooms.

## 2. SHADOW-CASTING FOV
Implement a simple recursive shadowcasting algorithm for field-of-view.
The player should only see tiles that have line-of-sight (walls block vision).

Here is a simple shadowcasting implementation to use:

```javascript
function castFOV(cx, cy, radius, isBlocking) {
  const visible = new Set();
  visible.add((cy << 8) | cx);

  for (let octant = 0; octant < 8; octant++) {
    castOctant(cx, cy, radius, octant, 1, 1.0, 0.0, isBlocking, visible);
  }
  return visible;
}

function castOctant(cx, cy, radius, octant, row, startSlope, endSlope, isBlocking, visible) {
  if (startSlope < endSlope) return;

  let nextStartSlope = startSlope;

  for (let j = row; j <= radius; j++) {
    let blocked = false;

    for (let dx = -j; dx <= 0; dx++) {
      const dy = -j;
      const leftSlope = (dx - 0.5) / (dy + 0.5);
      const rightSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rightSlope) continue;
      if (endSlope > leftSlope) break;

      // Transform by octant
      let tx, ty;
      switch (octant) {
        case 0: tx = cx + dx; ty = cy + dy; break;
        case 1: tx = cx + dy; ty = cy + dx; break;
        case 2: tx = cx - dy; ty = cy + dx; break;
        case 3: tx = cx - dx; ty = cy + dy; break;
        case 4: tx = cx - dx; ty = cy - dy; break;
        case 5: tx = cx - dy; ty = cy - dx; break;
        case 6: tx = cx + dy; ty = cy - dx; break;
        case 7: tx = cx + dx; ty = cy - dy; break;
      }

      const distSq = (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy);
      if (distSq > radius * radius) continue;
      if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) continue;

      visible.add((ty << 8) | tx);

      if (blocked) {
        if (isBlocking(tx, ty)) {
          nextStartSlope = rightSlope;
        } else {
          blocked = false;
          startSlope = nextStartSlope;
        }
      } else if (isBlocking(tx, ty) && j < radius) {
        blocked = true;
        castOctant(cx, cy, radius, octant, j + 1, startSlope, leftSlope, isBlocking, visible);
        nextStartSlope = rightSlope;
      }
    }
    if (blocked) break;
  }
}
```

Use it like:
```javascript
const isBlocking = (x, y) => dungeonMap[y]?.[x] === 1;
const fovVisible = castFOV(Math.round(px), Math.round(py), config.visionRadius, isBlocking);
```

Then in fillDemoScene, replace the simple circle check `distSq <= vr * vr` with `fovVisible.has((y << 8) | x)`.

## 3. TORCH LIGHTING WITH WALL SHADOWS
For torch lighting, do a simplified version: light from a torch only reaches a cell if there's no wall directly between them (simple line-of-sight check):

```javascript
function hasLineOfSight(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;
  while (cx !== x1 || cy !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
    if (cx === x1 && cy === y1) break;
    if (dungeonMap[cy]?.[cx] === 1) return false;
  }
  return true;
}
```

Update computeLight to use this:
```javascript
function computeLight(x, y, time) {
  let totalLight = 0;
  for (const torch of torches) {
    const dx = x - torch.x;
    const dy = y - torch.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10 && hasLineOfSight(torch.x, torch.y, x, y)) {
      const flicker = 0.8 + Math.sin(time * 4 + torch.x * 3.7 + torch.y * 2.3) * 0.2;
      const intensity = Math.max(0, 1.0 - dist / 10) * flicker;
      totalLight += intensity;
    }
  }
  return Math.min(totalLight, 1.0);
}
```

## 4. FIX THE PATH - No walking through walls
The walking path waypoints MUST only go through floor/corridor tiles (dungeonMap value 2 or 3), never through walls (value 1) or void (value 0).

Build the path AFTER the dungeon is carved. Each waypoint must be on a floor tile. Connect rooms through the corridor centers. Here's a corrected path using the actual carved floor tiles:

```javascript
const path = linePath([
  // Room 1 interior
  { x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 8 }, { x: 5, y: 8 },
  // Exit Room 1 through corridor to middle
  { x: 5, y: 6 }, { x: 13, y: 6 }, { x: 16, y: 6 }, { x: 16, y: 12 },
  // Middle room
  { x: 18, y: 14 }, { x: 23, y: 14 },
  // Corridor to Room 2
  { x: 25, y: 14 }, { x: 25, y: 6 }, { x: 30, y: 6 },
  // Room 2 interior
  { x: 35, y: 5 }, { x: 38, y: 5 }, { x: 38, y: 8 }, { x: 30, y: 8 },
  // Back to middle via corridor
  { x: 25, y: 8 }, { x: 25, y: 14 },
  // Corridor to Room 4
  { x: 25, y: 20 }, { x: 30, y: 22 },
  // Room 4 interior
  { x: 35, y: 22 }, { x: 38, y: 22 }, { x: 38, y: 26 }, { x: 30, y: 26 },
  // Back to middle
  { x: 25, y: 22 }, { x: 25, y: 14 }, { x: 16, y: 14 },
  // Corridor to Room 3
  { x: 16, y: 22 }, { x: 10, y: 22 },
  // Room 3 interior
  { x: 5, y: 23 }, { x: 10, y: 23 }, { x: 10, y: 27 }, { x: 5, y: 27 },
  // Return to Room 1
  { x: 5, y: 23 }, { x: 16, y: 23 }, { x: 16, y: 14 }, { x: 16, y: 6 },
  { x: 5, y: 6 }, { x: 5, y: 5 },
]);
```

IMPORTANT: After building the dungeon, validate the path - skip any waypoint where dungeonMap[y][x] is 0 or 1.

## 5. TORCH PARTICLES
Add simple animated particles around torches. For each torch, generate 3-4 "spark" positions that float upward over time:

```javascript
// In fillDemoScene, after rendering torches:
for (const torch of torches) {
  if (!fovVisible.has((torch.y << 8) | torch.x)) continue;
  for (let p = 0; p < 3; p++) {
    const phase = time * 2 + p * 2.1 + torch.x * 0.7;
    const sparkY = torch.y - 1 - (phase % 3);
    const sparkX = torch.x + Math.sin(phase * 1.5) * 0.8;
    const rx = Math.round(sparkX), ry = Math.round(sparkY);
    if (ry >= 0 && ry < GRID_H && rx >= 0 && rx < GRID_W) {
      const fade = 1.0 - (phase % 3) / 3;
      if (fade > 0.1) {
        const sparkChar = fade > 0.5 ? '*' : '.';
        const r = 'ff';
        const g = Math.floor(fade * 170).toString(16).padStart(2, '0');
        renderer.setCell(rx, ry, sparkChar, '#' + r + g + '00', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, fade);
      }
    }
  }
}
```

## 6. BIGGER DUNGEON LAYOUT
Use a larger grid and add a 6th room. Update GRID_W to 80, GRID_H to 45:

```javascript
const GRID_W = 80, GRID_H = 45;

const rooms = [
  { x: 2, y: 2, w: 14, h: 10 },     // Room 1 (top-left)
  { x: 28, y: 2, w: 16, h: 10 },    // Room 2 (top-right)
  { x: 2, y: 25, w: 14, h: 12 },    // Room 3 (bottom-left)
  { x: 28, y: 25, w: 16, h: 12 },   // Room 4 (bottom-right)
  { x: 16, y: 13, w: 12, h: 8 },    // Room 5 (center)
  { x: 52, y: 8, w: 18, h: 14 },    // Room 6 (far-right, large hall)
];
```

Add corridors from Room 2 to Room 6, and from Room 4 to Room 6.
Add more torches in Room 6 and along new corridors.
Add 2 more enemies in Room 6.

## 7. SMOOTH MOVEMENT ANIMATION
The current lerp between tiles IS smooth movement, but make moveSpeed slower (2 tiles/sec instead of 3) so users can actually see the tweening. Also ensure the player position is used as a float (not rounded) for the FOV center, and that light values smoothly transition.

Change moveSpeed from 3 to 2 in the loop.

## WHAT TO KEEP
- Keep the Svelte 4 patterns (onMount, onDestroy, createEventDispatcher)
- Keep the config object pattern for slider reactivity
- Keep the ParamSlider components and slider handlers
- Keep the HTML structure and styles exactly as-is
- Keep the loop timing fix (lastFrame = 0, skip first frame, cap dt)
- Keep all hex color strings (NO rgb() syntax - colorToU32 only handles hex)
- Keep using the `light` parameter in setCell (8th argument)

## IMPORTANT RULES
- ALL colors must be hex strings like '#ff6600', NEVER rgb() or rgba()
- Use Svelte 4 syntax (not Svelte 5 runes)
- CELL_FLAGS imported from '../../renderer/Renderer.js'
- Floor tiles use SPACE character ' ' with colored backgrounds
- The `renderer.setCell(x, y, char, fg, bg, depth, flags, light)` signature has 8 args
