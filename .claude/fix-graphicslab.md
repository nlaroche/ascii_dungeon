Fix the runtime crash in GraphicsLab.svelte: "Cannot read properties of undefined (reading 'x')" at line 269 in the animation loop.

THE BUG:
The `linePath()` function builds a walking path from waypoints. The animation loop uses fractional indexing for smooth movement:
```js
const t = (time * moveSpeed) % path.length;
const idx = Math.floor(t);
const curr = path[idx % path.length];
const next = path[(idx + 1) % path.length];
```

The problem: on the very first frame, `performance.now()` returns a large timestamp (e.g. 45000ms). The `dt` calculation `(now - lastFrame) / 1000` produces a huge delta on frame 1 because `lastFrame` was set milliseconds before. This makes `time` very large, and floating point issues with the modulo can produce out-of-bounds indices.

THE FIX:
1. Initialize `lastFrame` to 0 (not `performance.now()`)
2. On the first frame, detect that lastFrame is 0 and just set `lastFrame = now` without advancing time
3. Add a guard: `if (!curr || !next) return requestAnimationFrame(loop);`

Here is the specific fix. Replace the loop function in onMount:

```js
let running = true;
let time = 0;
let lastFrame = 0;

const loop = (now) => {
  if (!running) return;

  if (lastFrame === 0) {
    lastFrame = now;
    requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min((now - lastFrame) / 1000, 0.1); // cap dt to 100ms
  lastFrame = now;
  time += dt * config.animSpeed;

  const moveSpeed = 3;
  const t = ((time * moveSpeed) % path.length + path.length) % path.length;
  const idx = Math.floor(t);
  const frac = t - idx;
  const curr = path[idx];
  const next = path[(idx + 1) % path.length];

  const px = curr.x + (next.x - curr.x) * frac;
  const py = curr.y + (next.y - curr.y) * frac;

  renderer.cellSize = config.cellSize;
  fillDemoScene(time, px, py);
  renderer.render();

  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
```

Key changes:
- `lastFrame = 0` instead of `performance.now()`
- Skip first frame (just record timestamp)
- Cap `dt` to 0.1s max to prevent time jumps
- Double-modulo `((x % n) + n) % n` ensures positive index
- Remove redundant `idx % path.length` (already guaranteed by the modulo above)

IMPORTANT: Only change the loop function inside onMount. Do NOT change anything else in the file.
