import tilemapShaderCode from './shaders/tilemap.wgsl?raw';

// Cell struct must match shader exactly (32 bytes total, 4-byte aligned):
// glyph: u32 (offset 0)
// fg: u32 (offset 4)
// bg: u32 (offset 8)
// depth: f32 (offset 12)
// light: f32 (offset 16)
// flags: u32 (offset 20)
// offsetX: f32 (offset 24)
// offsetY: f32 (offset 28)

export const CELL_SIZE_BYTES = 32;

export const CELL_FLAGS = {
  VISIBLE: 1,      // BIT0
  EXPLORED: 2,    // BIT1
  HIGHLIGHTED: 4, // BIT2
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
  const a = 255;
  
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
export function createTilemapRenderer(device, format, atlasTexture, gridWidth, gridHeight) {
  const cellCount = gridWidth * gridHeight;
  const cpuBuffer = new ArrayBuffer(cellCount * CELL_SIZE_BYTES);
  const dataView = new DataView(cpuBuffer);
  
  // Create GPU buffer for cell storage
  const gpuBuffer = device.createBuffer({
    size: cpuBuffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  
  // Create sampler for SDF atlas
  const atlasSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });
  
  // Uniform buffer matches shader Uniforms struct: 12 x f32 = 48 bytes
  const UNIFORM_SIZE = 48;
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
      targets: [{ format }],
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
    ],
  });
  
  /**
   * Write a single cell to the CPU buffer.
   * @param {number} x - grid x (0 to gridWidth-1)
   * @param {number} y - grid y (0 to gridHeight-1)
   * @param {number} glyph - ASCII code 32-126
   * @param {number} fg - packed RGBA u32
   * @param {number} bg - packed RGBA u32
   * @param {number} depth - 0.0=floor, 0.5=entity, 1.0=ceiling
   * @param {number} flags - cell flags (VISIBLE|EXPLORED|HIGHLIGHTED)
   */
  function setTile(x, y, glyph, fg, bg, depth, flags = 0, light = 1.0, offsetX = 0, offsetY = 0) {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
      return;
    }

    const index = y * gridWidth + x;
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
  }
  
  /**
   * Zero the entire CPU buffer.
   */
  function clearGrid() {
    // Use Uint8Array to clear all bytes
    const uint8 = new Uint8Array(cpuBuffer);
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
  function render(encoder, outputTexture, canvasWidth, canvasHeight, time = 0, cellPixelWidth = 12, cellPixelHeight = 18, cameraOffsetX = 0, cameraOffsetY = 0) {
    // Uniform struct layout (must match shader):
    // resolution: vec2<f32>     offset 0
    // time: f32                 offset 8
    // parallaxStrength: f32     offset 12
    // cellPixelSize: vec2<f32>  offset 16
    // gridSize: vec2<f32>       offset 24
    // cameraOffset: vec2<f32>   offset 32
    // sdfEdge: f32              offset 40
    // sdfSmoothing: f32         offset 44
    const uniformData = new ArrayBuffer(UNIFORM_SIZE);
    const v = new DataView(uniformData);
    v.setFloat32(0, canvasWidth, true);
    v.setFloat32(4, canvasHeight, true);
    v.setFloat32(8, time, true);
    v.setFloat32(12, 0.5, true);  // parallaxStrength
    v.setFloat32(16, cellPixelWidth, true);
    v.setFloat32(20, cellPixelHeight, true);
    v.setFloat32(24, gridWidth, true);
    v.setFloat32(28, gridHeight, true);
    v.setFloat32(32, cameraOffsetX, true);
    v.setFloat32(36, cameraOffsetY, true);
    v.setFloat32(40, 0.5, true);  // sdfEdge
    v.setFloat32(44, 0.05, true); // sdfSmoothing

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
    passEncoder.draw(6, cellCount);
    passEncoder.end();
  }
  
  return {
    gridWidth,
    gridHeight,
    cellCount,
    cpuBuffer,
    dataView,
    gpuBuffer,
    pipeline,
    bindGroup,
    bindGroupLayout,
    setTile,
    clearGrid,
    upload,
    render,
  };
}

// Export shader code for testing
export { tilemapShaderCode };
