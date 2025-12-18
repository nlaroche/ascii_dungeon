// Terminal 2D Renderer - ASCII grid rendering for 2D editor mode
// Uses WebGPU to render a terminal-style character grid

import {
  generateFontTexture,
  FONT_CONFIG,
  createGridBuffer,
  setGridCell,
  packColor,
  DUNGEON_PALETTE,
  CELL_FLAG_SELECTED,
  CELL_FLAG_HOVERED,
  type GridCell,
} from './BitmapFont'

import grid2dShader from './shaders/grid2d.wgsl?raw'

export interface TerminalConfig {
  gridWidth: number
  gridHeight: number
  cellWidth: number   // pixels
  cellHeight: number  // pixels
}

const DEFAULT_CONFIG: TerminalConfig = {
  gridWidth: 500,  // Very large workspace for editing (effectively infinite)
  gridHeight: 500,
  cellWidth: 12,
  cellHeight: 20,
}

export class Terminal2DRenderer {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private format: GPUTextureFormat = 'bgra8unorm'

  // Pipeline and bind groups
  private pipeline: GPURenderPipeline | null = null
  private bindGroup: GPUBindGroup | null = null
  private bindGroupLayout: GPUBindGroupLayout | null = null

  // Buffers
  private uniformBuffer: GPUBuffer | null = null
  private cellBuffer: GPUBuffer | null = null

  // Font texture
  private fontTexture: GPUTexture | null = null
  private fontSampler: GPUSampler | null = null

  // Grid data
  private config: TerminalConfig = DEFAULT_CONFIG
  private gridData: Uint32Array
  private gridDirty: boolean = true

  // View state
  private viewOffset: [number, number] = [0, 0]
  private zoom: number = 1.0  // Zoom factor (1.0 = 100%)
  private targetZoom: number = 1.0  // Target zoom for animation
  private zoomAnimating: boolean = false
  private zoomAnchorWorld: [number, number] = [0, 0]  // World position to keep fixed during zoom
  private zoomAnchorScreen: [number, number] = [0, 0]  // Screen position to keep fixed during zoom
  private showGrid: boolean = true
  private time: number = 0

  // Predefined zoom steps (percentages)
  private static readonly ZOOM_STEPS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]

  // Selection state
  private selection: { x1: number; y1: number; x2: number; y2: number } | null = null
  private hoveredCell: { x: number; y: number } | null = null
  private cursorPos: [number, number] = [0, 0]

  // Game bounds (shown as dotted border gizmo)
  private gameBounds: { x: number; y: number; width: number; height: number } | null = null

  constructor(config?: Partial<TerminalConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.gridData = createGridBuffer(this.config.gridWidth, this.config.gridHeight)

    // Initialize with empty cells
    this.clear()
  }

  async init(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device
    this.context = context
    this.format = format

    // Create uniform buffer
    // Layout: mat4x4 viewProjection (64) + vec2 gridSize (8) + vec2 cellSize (8) +
    //         vec2 gridOffset (8) + f32 time (4) + f32 showGrid (4) +
    //         vec4 selection (16) + vec4 gameBounds (16) = 128 bytes
    this.uniformBuffer = device.createBuffer({
      label: 'Grid2D Uniforms',
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create cell storage buffer
    const cellCount = this.config.gridWidth * this.config.gridHeight
    this.cellBuffer = device.createBuffer({
      label: 'Grid2D Cells',
      size: cellCount * 16,  // 4 u32s per cell
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    // Generate and upload font texture
    await this.createFontTexture()

    // Create sampler
    this.fontSampler = device.createSampler({
      label: 'Font Sampler',
      magFilter: 'nearest',
      minFilter: 'nearest',
      mipmapFilter: 'nearest',
    })

    // Create bind group layout (stored for pipeline recreation)
    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'Grid2D Bind Group Layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    })

    // Create bind group
    this.bindGroup = device.createBindGroup({
      label: 'Grid2D Bind Group',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.cellBuffer } },
        { binding: 2, resource: this.fontTexture!.createView() },
        { binding: 3, resource: this.fontSampler },
      ],
    })

    // Create pipeline
    await this.createPipeline()
  }

  /**
   * Create or recreate the render pipeline (for shader hot-reload)
   */
  async createPipeline(shaderCode?: string) {
    if (!this.device || !this.bindGroupLayout) return

    // Create shader module with provided code or default
    const shaderModule = this.device.createShaderModule({
      label: 'Grid2D Shader',
      code: shaderCode ?? grid2dShader,
    })

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'Grid2D Pipeline Layout',
      bindGroupLayouts: [this.bindGroupLayout],
    })

    // Create render pipeline
    this.pipeline = this.device.createRenderPipeline({
      label: 'Grid2D Pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })

    console.log('[Terminal2D] Initialized')
  }

  private async createFontTexture() {
    if (!this.device) return

    // Generate font bitmap
    const fontData = generateFontTexture()

    // Create texture
    this.fontTexture = this.device.createTexture({
      label: 'Font Texture',
      size: [FONT_CONFIG.textureWidth, FONT_CONFIG.textureHeight, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })

    // Upload font data
    this.device.queue.writeTexture(
      { texture: this.fontTexture },
      fontData.data,
      { bytesPerRow: FONT_CONFIG.textureWidth * 4 },
      [FONT_CONFIG.textureWidth, FONT_CONFIG.textureHeight, 1]
    )

    console.log(`[Terminal2D] Font texture created: ${FONT_CONFIG.textureWidth}x${FONT_CONFIG.textureHeight}`)
  }

  /**
   * Clear the grid to empty black background
   */
  clear() {
    const emptyFg = packColor(0.15, 0.15, 0.15)  // Subtle fg for any debug chars
    const emptyBg = packColor(0.0, 0.0, 0.0)     // Pure black background

    for (let y = 0; y < this.config.gridHeight; y++) {
      for (let x = 0; x < this.config.gridWidth; x++) {
        this.setCell(x, y, ' ', emptyFg, emptyBg)
      }
    }
    this.gridDirty = true
  }

  /**
   * Set game bounds (shown as dotted border gizmo in shader)
   */
  setGameBounds(x: number, y: number, width: number, height: number) {
    this.gameBounds = { x, y, width, height }
  }

  /**
   * Clear game bounds
   */
  clearGameBounds() {
    this.gameBounds = null
  }

  /**
   * Fill a rectangular region with black background
   */
  fillRegion(x: number, y: number, width: number, height: number) {
    const emptyFg = packColor(0.15, 0.15, 0.15)
    const emptyBg = packColor(0.0, 0.0, 0.0)

    for (let by = y; by < y + height; by++) {
      for (let bx = x; bx < x + width; bx++) {
        if (bx >= 0 && bx < this.config.gridWidth && by >= 0 && by < this.config.gridHeight) {
          this.setCell(bx, by, ' ', emptyFg, emptyBg)
        }
      }
    }
  }

  /**
   * Draw a thin dotted border around a rectangle (shows game bounds)
   */
  drawDottedBorder(x: number, y: number, width: number, height: number, color: number = packColor(0.3, 0.4, 0.5)) {
    // Use a subtle dot pattern for the border - draws ON the edge, not outside
    const dotChar = '·'  // Middle dot character

    // Top and bottom edges (dotted pattern)
    for (let bx = x; bx < x + width; bx++) {
      if (bx % 2 === 0) {  // Every other cell for dotted effect
        this.setCellFgOnly(bx, y, dotChar, color)
        this.setCellFgOnly(bx, y + height - 1, dotChar, color)
      }
    }

    // Left and right edges (dotted pattern)
    for (let by = y; by < y + height; by++) {
      if (by % 2 === 0) {  // Every other cell for dotted effect
        this.setCellFgOnly(x, by, dotChar, color)
        this.setCellFgOnly(x + width - 1, by, dotChar, color)
      }
    }
  }

  /**
   * Set only the foreground character and color, preserving background
   */
  setCellFgOnly(x: number, y: number, char: string, fgColor: number) {
    if (x < 0 || x >= this.config.gridWidth || y < 0 || y >= this.config.gridHeight) return

    const idx = (y * this.config.gridWidth + x) * 4
    const currentBg = this.gridData[idx + 2]  // Preserve existing background
    const currentFlags = this.gridData[idx + 3]

    this.gridData[idx] = char.charCodeAt(0)
    this.gridData[idx + 1] = fgColor
    this.gridData[idx + 2] = currentBg
    this.gridData[idx + 3] = currentFlags
    this.gridDirty = true
  }

  /**
   * Set a single cell
   */
  setCell(x: number, y: number, char: string, fgColor?: number, bgColor?: number, flags: number = 0) {
    if (x < 0 || x >= this.config.gridWidth || y < 0 || y >= this.config.gridHeight) return

    const charCode = char.charCodeAt(0)
    const palette = DUNGEON_PALETTE[char] || { fg: packColor(0.5, 0.5, 0.5), bg: packColor(0.08, 0.08, 0.08) }

    setGridCell(this.gridData, this.config.gridWidth, x, y, {
      charCode,
      fgColor: fgColor ?? palette.fg,
      bgColor: bgColor ?? palette.bg,
      flags,
    })
    this.gridDirty = true
  }

  /**
   * Set cell from character with automatic palette lookup
   */
  setCellChar(x: number, y: number, char: string, flags: number = 0) {
    const palette = DUNGEON_PALETTE[char] || { fg: packColor(0.5, 0.5, 0.5), bg: packColor(0.08, 0.08, 0.08) }
    this.setCell(x, y, char, palette.fg, palette.bg, flags)
  }

  /**
   * Load ASCII art string into the grid
   */
  loadAscii(ascii: string, offsetX: number = 0, offsetY: number = 0) {
    const lines = ascii.split('\n')
    for (let y = 0; y < lines.length; y++) {
      const line = lines[y]
      for (let x = 0; x < line.length; x++) {
        const char = line[x]
        this.setCellChar(offsetX + x, offsetY + y, char)
      }
    }
  }

  /**
   * Set selection area
   */
  setSelection(x1: number, y1: number, x2: number, y2: number) {
    this.selection = {
      x1: Math.min(x1, x2),
      y1: Math.min(y1, y2),
      x2: Math.max(x1, x2),
      y2: Math.max(y1, y2),
    }
    this.updateSelectionFlags()
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selection = null
    this.updateSelectionFlags()
  }

  /**
   * Set hovered cell
   */
  setHoveredCell(x: number | null, y: number | null) {
    if (x === null || y === null) {
      this.hoveredCell = null
    } else {
      this.hoveredCell = { x, y }
    }
    this.updateSelectionFlags()
  }

  /**
   * Update cell flags based on selection/hover state
   */
  private updateSelectionFlags() {
    for (let y = 0; y < this.config.gridHeight; y++) {
      for (let x = 0; x < this.config.gridWidth; x++) {
        const idx = (y * this.config.gridWidth + x) * 4
        let flags = 0

        // Selection flag
        if (this.selection) {
          if (x >= this.selection.x1 && x <= this.selection.x2 &&
              y >= this.selection.y1 && y <= this.selection.y2) {
            flags |= CELL_FLAG_SELECTED
          }
        }

        // Hover flag
        if (this.hoveredCell && this.hoveredCell.x === x && this.hoveredCell.y === y) {
          flags |= CELL_FLAG_HOVERED
        }

        this.gridData[idx + 3] = flags
      }
    }
    this.gridDirty = true
  }

  /**
   * Set view offset (for panning)
   */
  setViewOffset(x: number, y: number) {
    this.viewOffset = [x, y]
  }

  /**
   * Pan by delta (for mouse dragging)
   * Clamps to prevent scrolling too far from content
   */
  pan(dx: number, dy: number, canvasWidth?: number, canvasHeight?: number) {
    this.viewOffset[0] += dx
    this.viewOffset[1] += dy

    // Clamp to prevent scrolling too far from content
    if (canvasWidth !== undefined && canvasHeight !== undefined) {
      this.clampViewOffset(canvasWidth, canvasHeight)
    }
  }

  /**
   * Clamp view offset - currently disabled for infinite scrolling
   * Keeping method for potential future use
   */
  clampViewOffset(_canvasWidth: number, _canvasHeight: number) {
    // Infinite scrolling - no clamping
    // View offset can go anywhere
  }

  /**
   * Set zoom level directly (1.0 = 100%) - no animation
   */
  setZoom(zoom: number) {
    this.zoom = Math.max(0.25, Math.min(4.0, zoom))
    this.targetZoom = this.zoom
    this.zoomAnimating = false
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.zoom
  }

  /**
   * Get target zoom level (for UI display during animation)
   */
  getTargetZoom(): number {
    return this.targetZoom
  }

  /**
   * Zoom in one step toward mouse position
   */
  zoomInToward(screenX: number, screenY: number) {
    const currentIndex = this.findNearestZoomStepIndex(this.targetZoom)
    const newIndex = Math.min(currentIndex + 1, Terminal2DRenderer.ZOOM_STEPS.length - 1)
    this.zoomTowardPoint(Terminal2DRenderer.ZOOM_STEPS[newIndex], screenX, screenY)
  }

  /**
   * Zoom out one step toward mouse position
   */
  zoomOutToward(screenX: number, screenY: number) {
    const currentIndex = this.findNearestZoomStepIndex(this.targetZoom)
    const newIndex = Math.max(currentIndex - 1, 0)
    this.zoomTowardPoint(Terminal2DRenderer.ZOOM_STEPS[newIndex], screenX, screenY)
  }

  /**
   * Zoom to a specific level toward a screen position
   */
  zoomTowardPoint(newZoom: number, screenX: number, screenY: number) {
    // Calculate the world position under the mouse before zoom
    const cellW = this.config.cellWidth * this.zoom
    const cellH = this.config.cellHeight * this.zoom
    const worldX = (screenX - this.viewOffset[0]) / cellW
    const worldY = (screenY - this.viewOffset[1]) / cellH

    // Store anchor positions for smooth animation
    this.zoomAnchorWorld = [worldX, worldY]
    this.zoomAnchorScreen = [screenX, screenY]

    // Set target zoom for animation
    this.targetZoom = Math.max(0.25, Math.min(4.0, newZoom))
    this.zoomAnimating = true
  }

  /**
   * Find nearest zoom step index
   */
  private findNearestZoomStepIndex(zoom: number): number {
    let nearestIndex = 0
    let nearestDist = Math.abs(Terminal2DRenderer.ZOOM_STEPS[0] - zoom)

    for (let i = 1; i < Terminal2DRenderer.ZOOM_STEPS.length; i++) {
      const dist = Math.abs(Terminal2DRenderer.ZOOM_STEPS[i] - zoom)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIndex = i
      }
    }
    return nearestIndex
  }

  /**
   * Update zoom animation (call each frame)
   * Returns true if still animating
   */
  updateZoomAnimation(deltaTime: number): boolean {
    if (!this.zoomAnimating) return false

    // Ease-out animation
    const speed = 12.0  // Higher = faster animation
    const diff = this.targetZoom - this.zoom
    const step = diff * Math.min(1.0, deltaTime * speed)

    if (Math.abs(diff) < 0.001) {
      // Close enough, snap to target
      this.zoom = this.targetZoom
      this.zoomAnimating = false
    } else {
      this.zoom += step
    }

    // Recalculate view offset to keep anchor point fixed during animation
    const cellW = this.config.cellWidth * this.zoom
    const cellH = this.config.cellHeight * this.zoom
    this.viewOffset[0] = this.zoomAnchorScreen[0] - this.zoomAnchorWorld[0] * cellW
    this.viewOffset[1] = this.zoomAnchorScreen[1] - this.zoomAnchorWorld[1] * cellH

    return this.zoomAnimating
  }

  /**
   * Set grid visibility
   */
  setShowGrid(show: boolean) {
    this.showGrid = show
  }

  /**
   * Reset view to origin (0,0) at 100% zoom
   * Used for Home key
   */
  resetView(canvasWidth: number, canvasHeight: number) {
    // Reset zoom to 100%
    this.zoom = 1.0
    this.targetZoom = 1.0
    this.zoomAnimating = false

    // Center the view so origin (0,0) is at the center of the canvas
    const cellW = this.config.cellWidth * this.zoom
    const cellH = this.config.cellHeight * this.zoom

    // Put origin at center of canvas
    this.viewOffset[0] = canvasWidth / 2
    this.viewOffset[1] = canvasHeight / 2
  }

  /**
   * Get current view offset
   */
  getViewOffset(): [number, number] {
    return [...this.viewOffset]
  }

  /**
   * Center the view on the content within the given canvas size.
   * @deprecated Use centerOnBounds for better control
   */
  centerOnContent(canvasWidth: number, canvasHeight: number) {
    const cellW = this.config.cellWidth * this.zoom
    const cellH = this.config.cellHeight * this.zoom

    // Calculate total content size
    const contentWidth = this.config.gridWidth * cellW
    const contentHeight = this.config.gridHeight * cellH

    // Center the content
    this.viewOffset[0] = (canvasWidth - contentWidth) / 2
    this.viewOffset[1] = (canvasHeight - contentHeight) / 2
  }

  /**
   * Center the view on specific bounds (e.g., game bounds)
   */
  centerOnBounds(canvasWidth: number, canvasHeight: number, bounds: { x: number; y: number; width: number; height: number }) {
    const cellW = this.config.cellWidth * this.zoom
    const cellH = this.config.cellHeight * this.zoom

    // Calculate the center of the bounds in pixel coordinates
    const boundsCenterX = (bounds.x + bounds.width / 2) * cellW
    const boundsCenterY = (bounds.y + bounds.height / 2) * cellH

    // Set view offset so that the bounds center is at the canvas center
    this.viewOffset[0] = canvasWidth / 2 - boundsCenterX
    this.viewOffset[1] = canvasHeight / 2 - boundsCenterY
  }

  /**
   * Get grid dimensions
   */
  getGridSize(): [number, number] {
    return [this.config.gridWidth, this.config.gridHeight]
  }

  /**
   * Get cell dimensions in pixels (accounting for zoom)
   */
  getCellSize(): [number, number] {
    return [this.config.cellWidth * this.zoom, this.config.cellHeight * this.zoom]
  }

  /**
   * Convert screen coordinates to grid cell (accounting for zoom)
   * Returns coordinates even outside grid bounds for infinite scrolling
   * Clamps to grid bounds for actual grid operations
   */
  screenToCell(screenX: number, screenY: number): [number, number] | null {
    const cellW = this.config.cellWidth * this.zoom
    const cellH = this.config.cellHeight * this.zoom
    const x = Math.floor((screenX - this.viewOffset[0]) / cellW)
    const y = Math.floor((screenY - this.viewOffset[1]) / cellH)

    // Return coordinates clamped to grid bounds
    // This allows hover to work at edges while preventing out-of-bounds access
    const clampedX = Math.max(0, Math.min(this.config.gridWidth - 1, x))
    const clampedY = Math.max(0, Math.min(this.config.gridHeight - 1, y))

    return [clampedX, clampedY]
  }

  /**
   * Render the grid
   */
  render(encoder: GPUCommandEncoder, targetView: GPUTextureView, canvasWidth: number, canvasHeight: number) {
    if (!this.device || !this.pipeline || !this.bindGroup || !this.uniformBuffer || !this.cellBuffer) {
      return
    }

    this.time += 1 / 60  // Approximate

    // Calculate zoomed cell size
    const cellW = this.config.cellWidth * this.zoom
    const cellH = this.config.cellHeight * this.zoom

    // Update uniform buffer (128 bytes total)
    const uniformData = new ArrayBuffer(128)
    const floatView = new Float32Array(uniformData)

    // Simple orthographic projection for 2D (pixel-perfect)
    // Maps [0, width] to [-1, 1] and [0, height] to [1, -1] (flip Y for screen coords)
    const ortho = new Float32Array([
      2 / canvasWidth, 0, 0, 0,
      0, -2 / canvasHeight, 0, 0,
      0, 0, 1, 0,
      -1, 1, 0, 1,
    ])
    floatView.set(ortho, 0)

    // Grid size
    floatView[16] = this.config.gridWidth
    floatView[17] = this.config.gridHeight

    // Cell size (with zoom applied)
    floatView[18] = cellW
    floatView[19] = cellH

    // Grid offset
    floatView[20] = this.viewOffset[0]
    floatView[21] = this.viewOffset[1]

    // Time
    floatView[22] = this.time

    // Show grid flag
    floatView[23] = this.showGrid ? 1.0 : 0.0

    // Selection bounds (indices 24-27)
    if (this.selection) {
      floatView[24] = this.selection.x1
      floatView[25] = this.selection.y1
      floatView[26] = this.selection.x2
      floatView[27] = this.selection.y2
    } else {
      floatView[24] = -1  // No selection marker
      floatView[25] = -1
      floatView[26] = -1
      floatView[27] = -1
    }

    // Game bounds (indices 28-31) - drawn as dotted gizmo between cells
    if (this.gameBounds) {
      floatView[28] = this.gameBounds.x
      floatView[29] = this.gameBounds.y
      floatView[30] = this.gameBounds.width
      floatView[31] = this.gameBounds.height
    } else {
      floatView[28] = -1  // No game bounds marker
      floatView[29] = -1
      floatView[30] = -1
      floatView[31] = -1
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)

    // Update cell buffer if dirty
    if (this.gridDirty) {
      this.device.queue.writeBuffer(this.cellBuffer, 0, this.gridData as unknown as BufferSource)
      this.gridDirty = false
    }

    // Create render pass
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },  // Pure black background
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })

    renderPass.setPipeline(this.pipeline)
    renderPass.setBindGroup(0, this.bindGroup)

    // Draw all cells as instances (6 vertices per cell quad)
    const cellCount = this.config.gridWidth * this.config.gridHeight
    renderPass.draw(6, cellCount, 0, 0)

    renderPass.end()
  }

  /**
   * Get current selection bounds
   */
  getSelection(): { x1: number; y1: number; x2: number; y2: number } | null {
    return this.selection
  }

  /**
   * Extract ASCII string from selection
   */
  getSelectionAscii(): string | null {
    if (!this.selection) return null

    const lines: string[] = []
    for (let y = this.selection.y1; y <= this.selection.y2; y++) {
      let line = ''
      for (let x = this.selection.x1; x <= this.selection.x2; x++) {
        const idx = (y * this.config.gridWidth + x) * 4
        const charCode = this.gridData[idx]
        line += String.fromCharCode(charCode)
      }
      lines.push(line)
    }
    return lines.join('\n')
  }

  /**
   * Clean up GPU resources
   */
  destroy() {
    this.uniformBuffer?.destroy()
    this.cellBuffer?.destroy()
    this.fontTexture?.destroy()
    this.pipeline = null
    this.bindGroup = null
  }
}
