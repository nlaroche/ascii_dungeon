// ═══════════════════════════════════════════════════════════════════════════
// ASCII Post-Processor - CRT and retro effects for ASCII rendering
// ═══════════════════════════════════════════════════════════════════════════

import asciiPostProcessCode from './shaders/asciiPostProcess.wgsl?raw'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AsciiPostSettings {
  enabled: boolean
  scanlines: number       // 0-1
  curvature: number       // 0-1
  bloom: number           // 0-1
  noise: number           // 0-1
  chromatic: number       // 0-1
  flicker: number         // 0-1
  vignette: number        // 0-1
  pixelate: number        // 0-1
  colorShift: number      // -1 to 1 (cool to warm)
}

export interface AsciiPostPreset {
  name: string
  settings: Partial<AsciiPostSettings>
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

export const ASCII_POST_PRESETS: Record<string, AsciiPostPreset> = {
  clean: {
    name: 'Clean',
    settings: {
      scanlines: 0,
      curvature: 0,
      bloom: 0,
      noise: 0,
      chromatic: 0,
      flicker: 0,
      vignette: 0,
      pixelate: 0,
      colorShift: 0,
    },
  },
  crt: {
    name: 'CRT Monitor',
    settings: {
      scanlines: 0.6,
      curvature: 0.4,
      bloom: 0.3,
      noise: 0.15,
      chromatic: 0.3,
      flicker: 0.2,
      vignette: 0.5,
      pixelate: 0,
      colorShift: 0,
    },
  },
  neon: {
    name: 'Neon Glow',
    settings: {
      scanlines: 0.2,
      curvature: 0,
      bloom: 0.8,
      noise: 0.05,
      chromatic: 0.5,
      flicker: 0,
      vignette: 0.3,
      pixelate: 0,
      colorShift: 0.2,
    },
  },
  glitch: {
    name: 'Glitchy',
    settings: {
      scanlines: 0.4,
      curvature: 0.1,
      bloom: 0.2,
      noise: 0.5,
      chromatic: 0.6,
      flicker: 0.6,
      vignette: 0.4,
      pixelate: 0.1,
      colorShift: 0,
    },
  },
  retro: {
    name: 'Retro Terminal',
    settings: {
      scanlines: 0.8,
      curvature: 0.5,
      bloom: 0.4,
      noise: 0.2,
      chromatic: 0.2,
      flicker: 0.3,
      vignette: 0.6,
      pixelate: 0,
      colorShift: -0.2,
    },
  },
  arcade: {
    name: 'Arcade Cabinet',
    settings: {
      scanlines: 0.5,
      curvature: 0.3,
      bloom: 0.5,
      noise: 0.1,
      chromatic: 0.4,
      flicker: 0.1,
      vignette: 0.7,
      pixelate: 0,
      colorShift: 0.1,
    },
  },
  minimal: {
    name: 'Minimal',
    settings: {
      scanlines: 0.2,
      curvature: 0,
      bloom: 0.2,
      noise: 0,
      chromatic: 0,
      flicker: 0,
      vignette: 0.2,
      pixelate: 0,
      colorShift: 0,
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Post-Processor Class
// ─────────────────────────────────────────────────────────────────────────────

export class AsciiPostProcessor {
  private device: GPUDevice
  private pipeline: GPURenderPipeline | null = null
  private bindGroup: GPUBindGroup | null = null
  private uniformBuffer: GPUBuffer | null = null
  private sampler: GPUSampler | null = null

  private settings: AsciiPostSettings = {
    enabled: true,
    scanlines: 0.5,
    curvature: 0.3,
    bloom: 0.4,
    noise: 0.1,
    chromatic: 0.3,
    flicker: 0.1,
    vignette: 0.4,
    pixelate: 0,
    colorShift: 0,
  }

  constructor(device: GPUDevice) {
    this.device = device
  }

  /**
   * Initialize the post-processor
   */
  async init(format: GPUTextureFormat): Promise<void> {
    // Create shader module
    const shaderModule = this.device.createShaderModule({
      code: asciiPostProcessCode,
    })

    // Create uniform buffer (48 bytes = 12 floats, padded to 16-byte alignment)
    this.uniformBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create sampler
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })

    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    })

    // Create pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })
  }

  /**
   * Create bind group for a specific input texture
   */
  createBindGroup(inputTexture: GPUTextureView): GPUBindGroup {
    if (!this.pipeline || !this.uniformBuffer || !this.sampler) {
      throw new Error('AsciiPostProcessor not initialized')
    }

    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: inputTexture },
        { binding: 2, resource: this.sampler },
      ],
    })
  }

  /**
   * Render post-processing effects
   */
  render(
    commandEncoder: GPUCommandEncoder,
    inputTexture: GPUTextureView,
    outputView: GPUTextureView,
    width: number,
    height: number,
    time: number
  ): void {
    if (!this.pipeline || !this.uniformBuffer) return
    if (!this.settings.enabled) return

    // Update uniforms
    const uniformData = new Float32Array([
      width,                    // resolution.x
      height,                   // resolution.y
      time,                     // time
      this.settings.scanlines,  // scanlines
      this.settings.curvature,  // curvature
      this.settings.bloom,      // bloom
      this.settings.noise,      // noise
      this.settings.chromatic,  // chromatic
      this.settings.flicker,    // flicker
      this.settings.vignette,   // vignette
      this.settings.pixelate,   // pixelate
      this.settings.colorShift, // colorShift
    ])
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)

    // Create bind group
    const bindGroup = this.createBindGroup(inputTexture)

    // Render
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: outputView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    })

    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(0, bindGroup)
    passEncoder.draw(3) // Fullscreen triangle
    passEncoder.end()
  }

  /**
   * Get current settings
   */
  getSettings(): AsciiPostSettings {
    return { ...this.settings }
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<AsciiPostSettings>): void {
    Object.assign(this.settings, settings)
  }

  /**
   * Apply a preset
   */
  applyPreset(presetName: string): void {
    const preset = ASCII_POST_PRESETS[presetName]
    if (preset) {
      this.updateSettings(preset.settings)
    }
  }

  /**
   * Get available preset names
   */
  static getPresetNames(): string[] {
    return Object.keys(ASCII_POST_PRESETS)
  }

  /**
   * Enable/disable post-processing
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled
  }
}
