In src/workbench/sections/GraphicsLab.svelte, make these exact changes:

1. On the line that renders the player (around line 392), change Math.round to Math.floor:
   BEFORE: renderer.setCell(Math.round(px), Math.round(py), '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);
   AFTER:  renderer.setCell(Math.floor(px), Math.floor(py), '@', '#00ff88', '#1a1a2e', 0.5, CELL_FLAGS.VISIBLE, 1.0);

2. In the animation loop (around line 428-431), replace the broken fractional offset with camera following:

   REMOVE these lines:
        const fracX = px - Math.round(px);
        const fracY = py - Math.round(py);
        renderer.cameraOffsetX = -fracX * config.cellSize;
        renderer.cameraOffsetY = -fracY * config.cellSize * 1.5;

   REPLACE with:
        const dpr = window.devicePixelRatio || 1;
        const screenCenterX = (renderer.canvas.width / dpr) / 2;
        const screenCenterY = (renderer.canvas.height / dpr) / 2;
        renderer.cameraOffsetX = screenCenterX - px * config.cellSize;
        renderer.cameraOffsetY = screenCenterY - py * config.cellSize * 1.5;

That's it. Only these two changes. Output the COMPLETE file with these changes applied.
