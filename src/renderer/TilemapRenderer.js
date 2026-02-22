import tilemapShaderCode from './shaders/tilemap.wgsl?raw';

// Cell struct must match shader exactly (40 bytes total, 4-byte aligned):
// glyph: u32 (offset 0)
// fg: u32 (offset 4)
// bg: u32 (offset 8)
// depth: f32 (offset 12)
// light: f32 (offset 16)
// flags: u32 (offset 20)
// offsetX: f32 (offset 24)
// offsetY: f32 (offset 28)
// scaleX: f32 (offset 32)
// scaleY: f32 (offset 36)

export const CELL_SIZE_BYTES = 40;

export const CELL_FLAGS = {
  VISIBLE: 1,      // BIT0
  EXPLORED: 2,    // BIT1
  HIGHLIGHTED: 4, // BIT2
  BOLD: 8,        // BIT3
  DAMAGE_FX: 16,  // BIT4
};

export const LAYER_COUNT = 5;

export const LAYERS = {
  TERRAIN: 0,
  DECOR: 1,
  OBJECTS: 2,
  PLAYER: 3,
  EFFECTS: 4,
};

/**
 * Convert CSS hex color to packed RGBA u32.
 * @param {string} cssColor - CSS hex color like "#ff00ff" or "#abc"
 * @returns {number} - packed RGBA u32 (alpha always 255)
 */
export function colorToU32(cssColor) {
  let hex = cssColor;
  
  // Remove # prefix if present
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  
  // Handle 3-char hex (#abc -> #aabbcc)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Parse RGB components
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;

  // Pack as (r<<24)|(g<<16)|(b<<8)|a, >>> 0 for unsigned
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

/**
 * Create a tilemap renderer.
 * @param {GPUDevice} device
 * @param {GPUTextureFormat} format
 * @param {GPUTexture} atlasTexture
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {object}
 */
export const LIGHT_SUB = 3; // sub-cell resolution multiplier for light map

export function createTilemapRenderer(device, format, atlasTexture, gridWidth, gridHeight) {
  const cellsPerLayer = gridWidth * gridHeight;
  const totalCells = LAYER_COUNT * cellsPerLayer;
  const cpuBuffer = new ArrayBuffer(totalCells * CELL_SIZE_BYTES);
  const dataView = new DataView(cpuBuffer);

  // Create GPU buffer for cell storage
  const gpuBuffer = device.createBuffer({
    size: cpuBuffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Light map: 3x sub-cell resolution, vec4<f32> per texel (r, g, b, unused)
  const lightMapWidth = gridWidth * LIGHT_SUB;
  const lightMapHeight = gridHeight * LIGHT_SUB;
  const lightMapCPU = new Float32Array(lightMapWidth * lightMapHeight * 4);
  const lightMapGPU = device.createBuffer({
    size: lightMapCPU.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Create sampler for SDF atlas
  const atlasSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  // Uniform buffer: 14 x f32 = 56 bytes, padded to 64
  const UNIFORM_SIZE = 64;
  const uniformBuffer = device.createBuffer({
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  // Create pipeline layout
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  // Create render pipeline
  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: device.createShaderModule({ code: tilemapShaderCode }),
      entryPoint: 'vertexMain',
    },
    fragment: {
      module: device.createShaderModule({ code: tilemapShaderCode }),
      entryPoint: 'fragmentMain',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        },
      }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  // Create bind group
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: gpuBuffer } },
      { binding: 2, resource: atlasTexture.createView() },
      { binding: 3, resource: atlasSampler },
      { binding: 4, resource: { buffer: lightMapGPU } },
    ],
  });
  
  /**
   * Write a single cell to the CPU buffer.
   * @param {number} layer - layer index (0=TERRAIN, 1=DECOR, 2=OBJECTS, 3=PLAYER, 4=EFFECTS)
   * @param {number} x - grid x (0 to gridWidth-1)
   * @param {number} y - grid y (0 to gridHeight-1)
   * @param {number} glyph - ASCII code 32-126
   * @param {number} fg - packed RGBA u32
   * @param {number} bg - packed RGBA u32
   * @param {number} depth - 0.0=floor, 0.5=entity, 1.0=ceiling
   * @param {number} flags - cell flags (VISIBLE|EXPLORED|HIGHLIGHTED)
   */
  function setTile(layer, x, y, glyph, fg, bg, depth, flags = 0, light = 1.0, offsetX = 0, offsetY = 0, scaleX = 1.0, scaleY = 1.0) {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
      return;
    }
    if (layer < 0 || layer >= LAYER_COUNT) {
      return;
    }

    const index = layer * cellsPerLayer + y * gridWidth + x;
    const offset = index * CELL_SIZE_BYTES;

    // glyph: u32
    dataView.setUint32(offset + 0, glyph, true);
    // fg: u32
    dataView.setUint32(offset + 4, fg, true);
    // bg: u32
    dataView.setUint32(offset + 8, bg, true);
    // depth: f32
    dataView.setFloat32(offset + 12, depth, true);
    // light: f32
    dataView.setFloat32(offset + 16, light, true);
    // flags: u32
    dataView.setUint32(offset + 20, flags, true);
    // offsetX: f32
    dataView.setFloat32(offset + 24, offsetX, true);
    // offsetY: f32
    dataView.setFloat32(offset + 28, offsetY, true);
    // scaleX: f32
    dataView.setFloat32(offset + 32, scaleX, true);
    // scaleY: f32
    dataView.setFloat32(offset + 36, scaleY, true);
  }
  
  /**
   * Zero the entire CPU buffer (all layers).
   */
  function clearGrid() {
    const uint8 = new Uint8Array(cpuBuffer);
    uint8.fill(0);
  }

  /**
   * Zero a single layer's portion of the CPU buffer.
   * @param {number} layer - layer index to clear
   */
  function clearLayer(layer) {
    if (layer < 0 || layer >= LAYER_COUNT) return;
    const byteStart = layer * cellsPerLayer * CELL_SIZE_BYTES;
    const byteEnd = byteStart + cellsPerLayer * CELL_SIZE_BYTES;
    const uint8 = new Uint8Array(cpuBuffer, byteStart, byteEnd - byteStart);
    uint8.fill(0);
  }
  
  /**
   * Upload CPU buffer to GPU.
   * @param {GPUDevice} device
   */
  function upload(device) {
    device.queue.writeBuffer(gpuBuffer, 0, cpuBuffer);
  }
  
  /**
   * Render the tilemap.
   * @param {GPUCommandEncoder} encoder
   * @param {GPUTextureView} outputTexture
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {number} time
   * @param {number} cellPixelWidth
   * @param {number} cellPixelHeight
   * @param {number} cameraOffsetX
   * @param {number} cameraOffsetY
   * @returns {GPUTexture}
   */
  function render(encoder, outputTexture, canvasWidth, canvasHeight, time = 0, cellPixelWidth = 12, cellPixelHeight = 18, cameraOffsetX = 0, cameraOffsetY = 0, vignettePulse = 0) {
    // Uniform struct layout (must match shader):
    // resolution: vec2<f32>     offset 0
    // time: f32                 offset 8
    // vignettePulse: f32        offset 12
    // cellPixelSize: vec2<f32>  offset 16
    // gridSize: vec2<f32>       offset 24
    // cameraOffset: vec2<f32>   offset 32
    // sdfEdge: f32              offset 40
    // sdfSmoothing: f32         offset 44
    // cellsPerLayer: u32        offset 48
    // lightSubRes: f32          offset 52
    const uniformData = new ArrayBuffer(UNIFORM_SIZE);
    const v = new DataView(uniformData);
    v.setFloat32(0, canvasWidth, true);
    v.setFloat32(4, canvasHeight, true);
    v.setFloat32(8, time, true);
    v.setFloat32(12, vignettePulse, true);
    v.setFloat32(16, cellPixelWidth, true);
    v.setFloat32(20, cellPixelHeight, true);
    v.setFloat32(24, gridWidth, true);
    v.setFloat32(28, gridHeight, true);
    v.setFloat32(32, cameraOffsetX, true);
    v.setFloat32(36, cameraOffsetY, true);
    v.setFloat32(40, 0.5, true);  // sdfEdge
    v.setFloat32(44, 0.05, true); // sdfSmoothing
    v.setUint32(48, cellsPerLayer, true); // cellsPerLayer
    v.setFloat32(52, LIGHT_SUB, true);  // lightSubRes

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    
    const passEncoder = encoder.beginRenderPass({
      colorAttachments: [{
        view: outputTexture,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(6, totalCells);
    passEncoder.end();
  }
  
  function setLightTexel(x, y, r, g, b) {
    if (x < 0 || x >= lightMapWidth || y < 0 || y >= lightMapHeight) return;
    const idx = (y * lightMapWidth + x) * 4;
    lightMapCPU[idx] = r;
    lightMapCPU[idx + 1] = g;
    lightMapCPU[idx + 2] = b;
  }

  function clearLightMap() {
    lightMapCPU.fill(0);
  }

  function uploadLightMap(device) {
    device.queue.writeBuffer(lightMapGPU, 0, lightMapCPU);
  }

  return {
    gridWidth,
    gridHeight,
    cellsPerLayer,
    totalCells,
    cpuBuffer,
    dataView,
    gpuBuffer,
    pipeline,
    bindGroup,
    bindGroupLayout,
    lightMapWidth,
    lightMapHeight,
    lightMapCPU,
    setTile,
    clearGrid,
    clearLayer,
    clearLightMap,
    setLightTexel,
    upload,
    uploadLightMap,
    render,
  };
}

// Export shader code for testing
export { tilemapShaderCode };
