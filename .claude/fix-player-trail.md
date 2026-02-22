Fix the player trail issue. The dual-tile player rendering shows '@' on two tiles simultaneously, creating a trail effect. In a tile-based game the player should be on ONE tile at a time.

Replace the dual player rendering block with a single render at the nearest position:

Find and replace this entire block:
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

With this simple single-position render:
```js
    // Player at nearest tile (FOV/lighting provides the smooth transition)
    renderer.setCell(Math.round(px), Math.round(py), '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);
```

The smoothness comes from the merged FOV (already computing from both floor and ceil positions) and the fractional-position lighting, not from showing the character on two tiles.

IMPORTANT: Only change this one block. Keep everything else exactly the same.
