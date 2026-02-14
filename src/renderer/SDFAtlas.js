/**
 * SDF Atlas - Signed Distance Field glyph atlas for GPU text rendering.
 * Uses 8SSEDT (8-point Signed Sequential Euclidean Distance Transform).
 */

const INF = 1e20;
const SQRT2 = Math.SQRT2;

/**
 * Compute unsigned distance transform using 8SSEDT.
 * @param {Uint8Array} inside - binary mask (1 = inside region)
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array} - unsigned Euclidean distance to nearest 0-cell
 */
function computeEDT(inside, width, height) {
  const dist = new Float32Array(width * height);

  // Initialize: 0 at boundary/inside edges, INF elsewhere
  for (let i = 0; i < inside.length; i++) {
    dist[i] = inside[i] ? 0 : INF;
  }

  // Find edge pixels (inside pixels adjacent to outside)
  // Only edge pixels should be 0; interior pixels need distance too
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!inside[idx]) continue;
      // Check if this pixel borders an outside pixel
      let isEdge = false;
      for (let dy = -1; dy <= 1 && !isEdge; dy++) {
        for (let dx = -1; dx <= 1 && !isEdge; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) { isEdge = true; continue; }
          if (!inside[ny * width + nx]) isEdge = true;
        }
      }
      if (!isEdge) dist[idx] = INF;
    }
  }

  // Forward pass (top-left to bottom-right)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (x > 0 && y > 0) { const d = dist[(y-1)*width+(x-1)] + SQRT2; if (d < dist[idx]) dist[idx] = d; }
      if (y > 0)           { const d = dist[(y-1)*width+x] + 1;        if (d < dist[idx]) dist[idx] = d; }
      if (x < width-1 && y > 0) { const d = dist[(y-1)*width+(x+1)] + SQRT2; if (d < dist[idx]) dist[idx] = d; }
      if (x > 0)           { const d = dist[y*width+(x-1)] + 1;        if (d < dist[idx]) dist[idx] = d; }
    }
  }

  // Backward pass (bottom-right to top-left)
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      if (x < width-1 && y < height-1) { const d = dist[(y+1)*width+(x+1)] + SQRT2; if (d < dist[idx]) dist[idx] = d; }
      if (y < height-1)                { const d = dist[(y+1)*width+x] + 1;        if (d < dist[idx]) dist[idx] = d; }
      if (x > 0 && y < height-1)       { const d = dist[(y+1)*width+(x-1)] + SQRT2; if (d < dist[idx]) dist[idx] = d; }
      if (x < width-1)                 { const d = dist[y*width+(x+1)] + 1;        if (d < dist[idx]) dist[idx] = d; }
    }
  }

  return dist;
}

/**
 * Generate a signed distance field from a binary glyph image.
 * @param {Uint8Array} binaryGrid - 1 = inside glyph, 0 = outside
 * @param {number} width
 * @param {number} height
 * @param {number} spread - distance range in pixels (default 32)
 * @returns {Float32Array} - normalized SDF values (0-1), 0.5 = edge
 */
export function generateSDF(binaryGrid, width, height, spread = 32) {
  // Compute distance from outside to nearest inside edge
  const outsideDist = computeEDT(binaryGrid, width, height);

  // Compute distance from inside to nearest outside edge (invert the grid)
  const inverted = new Uint8Array(binaryGrid.length);
  for (let i = 0; i < binaryGrid.length; i++) {
    inverted[i] = binaryGrid[i] ? 0 : 1;
  }
  const insideDist = computeEDT(inverted, width, height);

  // Signed distance: positive outside, negative inside
  const result = new Float32Array(width * height);
  for (let i = 0; i < result.length; i++) {
    const signedDist = binaryGrid[i] ? -insideDist[i] : outsideDist[i];
    const normalized = 0.5 + signedDist / (2 * spread);
    result[i] = Math.max(0, Math.min(1, normalized));
  }

  return result;
}

/**
 * Get UV coordinates for a character in the atlas.
 * @param {number} charCode - ASCII code (32-126)
 * @param {number} cols - atlas columns (default 16)
 * @param {number} rows - atlas rows (default 6)
 * @returns {{u0: number, v0: number, u1: number, v1: number}}
 */
export function getUV(charCode, cols = 16, rows = 6) {
  if (charCode < 32 || charCode > 126) {
    throw new Error(`Character code must be between 32 and 126, got ${charCode}`);
  }
  const idx = charCode - 32;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  return {
    u0: col / cols,
    v0: row / rows,
    u1: (col + 1) / cols,
    v1: (row + 1) / rows,
  };
}

/**
 * Atlas constants
 */
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 6;
export const ATLAS_CHAR_WIDTH = 64;
export const ATLAS_CHAR_HEIGHT = 64;
export const ATLAS_WIDTH = 1024;
export const ATLAS_HEIGHT = 384;
export const GLYPH_RENDER_SIZE = 128;

/**
 * Create an SDF glyph atlas and upload to GPU.
 * @param {GPUDevice} device
 * @param {string} fontFamily
 * @param {number} fontSize
 * @returns {{texture: GPUTexture, charWidth: number, charHeight: number, cols: number, rows: number, getUV: function}}
 */
export function createSDFAtlas(device, fontFamily = 'monospace', fontSize = 96) {
  const sdfData = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT);

  for (let charCode = 32; charCode <= 126; charCode++) {
    const char = String.fromCharCode(charCode);
    const charIdx = charCode - 32;
    const col = charIdx % ATLAS_COLS;
    const row = Math.floor(charIdx / ATLAS_COLS);

    // Render glyph at high resolution
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = GLYPH_RENDER_SIZE;
    tempCanvas.height = GLYPH_RENDER_SIZE;
    const ctx = tempCanvas.getContext('2d');

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, GLYPH_RENDER_SIZE, GLYPH_RENDER_SIZE);
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, GLYPH_RENDER_SIZE / 2, GLYPH_RENDER_SIZE / 2);

    // Extract binary grid from alpha channel
    const imageData = ctx.getImageData(0, 0, GLYPH_RENDER_SIZE, GLYPH_RENDER_SIZE);
    const binaryGrid = new Uint8Array(GLYPH_RENDER_SIZE * GLYPH_RENDER_SIZE);
    for (let i = 0; i < binaryGrid.length; i++) {
      binaryGrid[i] = imageData.data[i * 4] > 128 ? 1 : 0;
    }

    // Generate SDF
    const sdf = generateSDF(binaryGrid, GLYPH_RENDER_SIZE, GLYPH_RENDER_SIZE, 32);

    // Downsample 128x128 → 64x64 and pack into atlas
    for (let y = 0; y < ATLAS_CHAR_HEIGHT; y++) {
      for (let x = 0; x < ATLAS_CHAR_WIDTH; x++) {
        const srcX = Math.floor(x * GLYPH_RENDER_SIZE / ATLAS_CHAR_WIDTH);
        const srcY = Math.floor(y * GLYPH_RENDER_SIZE / ATLAS_CHAR_HEIGHT);
        const dstX = col * ATLAS_CHAR_WIDTH + x;
        const dstY = row * ATLAS_CHAR_HEIGHT + y;
        // Convert float 0-1 to uint8 0-255 for r8unorm
        sdfData[dstY * ATLAS_WIDTH + dstX] = Math.round(sdf[srcY * GLYPH_RENDER_SIZE + srcX] * 255);
      }
    }
  }

  // Upload to GPU as r8unorm texture
  const texture = device.createTexture({
    size: [ATLAS_WIDTH, ATLAS_HEIGHT],
    format: 'r8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    sdfData,
    { bytesPerRow: ATLAS_WIDTH },
    [ATLAS_WIDTH, ATLAS_HEIGHT],
  );

  return {
    texture,
    charWidth: ATLAS_CHAR_WIDTH,
    charHeight: ATLAS_CHAR_HEIGHT,
    cols: ATLAS_COLS,
    rows: ATLAS_ROWS,
    getUV: (charCode) => getUV(charCode, ATLAS_COLS, ATLAS_ROWS),
  };
}
