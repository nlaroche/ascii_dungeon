The dungeon only fills the top-left corner of the canvas. Fix this by making the grid dynamically sized to fill the canvas.

CHANGES NEEDED in GraphicsLab.svelte:

1. Change GRID_W and GRID_H from constants to computed values based on canvas size and cell size.

Replace the fixed constants:
```js
const GRID_W = 60, GRID_H = 35;
```

With dynamic calculation inside onMount, AFTER renderer.init():
```js
// Calculate grid size to fill canvas
function calcGridSize(cellSize) {
  const parent = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const pw = parent ? parent.clientWidth : 800;
  const ph = parent ? parent.clientHeight : 600;
  return {
    w: Math.floor((pw * dpr) / cellSize),
    h: Math.floor((ph * dpr) / (cellSize * 1.5))
  };
}
```

BUT this is complex because the dungeon layout is computed at module level before mount.

SIMPLER FIX: Just increase default cell size so the 60x35 grid fills the canvas better. The canvas is typically ~1000px wide. At cellSize 20 with DPR 1, that's 50 cells. But we have 60 cells, so at cellSize 20 the grid is actually wider than the canvas (60*20 = 1200px). The issue might be that cellHeight = cellSize * 1.5 = 30, so 35*30 = 1050px tall which is bigger than the 700px preview.

Actually the real issue is the Renderer passes cellSize for BOTH width and height to the tilemap render call. Look at Renderer.js line 110-111:
```js
this.cellSize,
this.cellSize * 1.5
```

The cellSize is in CSS pixels but the canvas dimensions are in device pixels (multiplied by DPR). On high-DPI screens (DPR=2), the canvas is 2000px wide but cellSize is still 20, so the grid only covers the top-left quarter.

THE ACTUAL FIX: In Renderer.js render() method, multiply cellSize by DPR:

```js
render() {
    const dpr = window.devicePixelRatio || 1;
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    this.tilemap.upload(this.device);
    this.tilemap.render(
      commandEncoder,
      textureView,
      this.canvas.width,
      this.canvas.height,
      this.time,
      this.cellSize * dpr,
      this.cellSize * 1.5 * dpr
    );

    this.device.queue.submit([commandEncoder.finish()]);

    if (!this._ready) {
      this._ready = true;
      this.canvas.dataset.ready = '1';
    }
  }
```

This ensures cells scale properly on high-DPI screens. On DPR=1 screens this changes nothing. On DPR=2 screens, cells will now be the correct visual size.

IMPORTANT: Only change the render() method in Renderer.js. Do NOT change GraphicsLab.svelte.
