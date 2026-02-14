// SDF Atlas - Signed Distance Field generation for font glyphs

export function generateSDF(binaryGrid, width, height, spread = 32) {
  const dist = new Float32Array(width * height);
  
  // Initialize: negative inside (1), positive outside (0)
  for (let i = 0; i < binaryGrid.length; i++) {
    dist[i] = binaryGrid[i] === 1 ? -1 : Infinity;
  }
  
  // Forward pass: top-left to bottom-right
  // Check neighbors: top-left, top, top-right, left
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Check top-left neighbor
      if (x > 0 && y > 0) {
        const nidx = (y - 1) * width + (x - 1);
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
      // Check top neighbor
      if (y > 0) {
        const nidx = (y - 1) * width + x;
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
      // Check top-right neighbor
      if (x < width - 1 && y > 0) {
        const nidx = (y - 1) * width + (x + 1);
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
      // Check left neighbor
      if (x > 0) {
        const nidx = y * width + (x - 1);
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
    }
  }
  
  // Backward pass: bottom-right to top-left
  // Check neighbors: bottom-right, bottom, bottom-left, right
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      
      // Check bottom-right neighbor
      if (x < width - 1 && y < height - 1) {
        const nidx = (y + 1) * width + (x + 1);
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
      // Check bottom neighbor
      if (y < height - 1) {
        const nidx = (y + 1) * width + x;
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
      // Check bottom-left neighbor
      if (x > 0 && y < height - 1) {
        const nidx = (y + 1) * width + (x - 1);
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
      // Check right neighbor
      if (x < width - 1) {
        const nidx = y * width + (x + 1);
        if (dist[nidx] + 1 < dist[idx]) dist[idx] = dist[nidx] + 1;
      }
    }
  }
  
  // Normalize to 0-1 range: value = 0.5 + distance / (2 * spread)
  // Negative distances (inside) become < 0.5, positive (outside) become > 0.5
  for (let i = 0; i < dist.length; i++) {
    const normalized = 0.5 + dist[i] / (2 * spread);
    dist[i] = Math.max(0, Math.min(1, normalized));
  }
  
  return dist;
}

export function createSDFAtlas(device, fontFamily = 'monospace', fontSize = 96) {
  const glyphSize = 128;
  const atlasCharWidth = 64;
  const atlasCharHeight = 64;
  const cols = 16;
  const rows = 6;
  const atlasWidth = 1024;
  const atlasHeight = 384;
  
  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d');
  
  const sdfData = new Float32Array(atlasWidth * atlasHeight);
  
  for (let charCode = 32; charCode <= 126; charCode++) {
    const char = String.fromCharCode(charCode);
    const charIdx = charCode - 32;
    const col = charIdx % cols;
    const row = Math.floor(charIdx / cols);
    
    // Render glyph to temp canvas at high resolution
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = glyphSize;
    tempCanvas.height = glyphSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, glyphSize, glyphSize);
    tempCtx.fillStyle = 'white';
    tempCtx.font = `bold ${fontSize}px ${fontFamily}`;
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';
    tempCtx.fillText(char, glyphSize / 2, glyphSize / 2);
    
    const imageData = tempCtx.getImageData(0, 0, glyphSize, glyphSize);
    const binaryGrid = new Uint8Array(glyphSize * glyphSize);
    
    // Extract alpha channel and threshold to create binary grid
    for (let i = 0; i < glyphSize * glyphSize; i++) {
      const alpha = imageData.data[i * 4 + 3];
      binaryGrid[i] = alpha > 128 ? 1 : 0;
    }
    
    // Generate SDF for this glyph
    const sdf = generateSDF(binaryGrid, glyphSize, glyphSize, 32);
    
    // Downsample and pack into atlas (64x64 per cell)
    for (let y = 0; y < atlasCharHeight; y++) {
      for (let x = 0; x < atlasCharWidth; x++) {
        const srcX = Math.floor(x * glyphSize / atlasCharWidth);
        const srcY = Math.floor(y * glyphSize / atlasCharHeight);
        const srcIdx = srcY * glyphSize + srcX;
        
        const dstX = col * atlasCharWidth + x;
        const dstY = row * atlasCharHeight + y;
        const dstIdx = dstY * atlasWidth + dstX;
        
        sdfData[dstIdx] = sdf[srcIdx];
      }
    }
  }
  
  // Create GPU texture
  const texture = device.createTexture({
    size: [atlasWidth, atlasHeight],
    format: 'r8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
  });
  
  // Create buffer and upload data
  const buffer = device.createBuffer({
    size: sdfData.byteLength,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  
  device.queue.writeBuffer(buffer, 0, sdfData);
  
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToTexture(
    { buffer, offset: 0 },
    { texture },
    [atlasWidth, atlasHeight]
  );
  device.queue.submit([commandEncoder.finish()]);
  
  return {
    texture,
    charWidth: atlasCharWidth,
    charHeight: atlasCharHeight,
    cols,
    rows,
    getUV(charCode) {
      const charIdx = charCode - 32;
      if (charIdx < 0 || charIdx >= 96) {
        throw new Error(`Invalid character code: ${charCode}`);
      }
      const col = charIdx % cols;
      const row = Math.floor(charIdx / cols);
      const u0 = col / cols;
      const v0 = row / rows;
      const u1 = (col + 1) / cols;
      const v1 = (row + 1) / rows;
      return { u0, v0, u1, v1 };
    }
  };
}

export function getUV(charCode, cols = 16, rows = 6) {
  if (charCode < 32 || charCode > 126) {
    throw new Error(`Character code must be between 32 and 126, got ${charCode}`);
  }
  const charIdx = charCode - 32;
  const col = charIdx % cols;
  const row = Math.floor(charIdx / cols);
  const u0 = col / cols;
  const v0 = row / rows;
  const u1 = (col + 1) / cols;
  const v1 = (row + 1) / rows;
  return { u0, v0, u1, v1 };
}
