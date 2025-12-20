// ═══════════════════════════════════════════════════════════════════════════
// Post-Process Pipeline - Unified post-processing for 2D ASCII rendering
// Combines individual effects (bloom, vignette) with CRT effects (scanlines, curvature)
// Supports both per-camera and global effect stacks
// ═══════════════════════════════════════════════════════════════════════════

import { RenderTargetPool, type RenderTarget } from './RenderTargetPool'

// Import shaders
import asciiPostProcessCode from './shaders/asciiPostProcess.wgsl?raw'
import blitShader from './shaders/postprocess/blit.wgsl?raw'
import bloomShader from './shaders/postprocess/bloom.wgsl?raw'
import vignetteShader from './shaders/postprocess/vignette.wgsl?raw'
import filmGrainShader from './shaders/postprocess/filmGrain.wgsl?raw'
import chromaticAberrationShader from './shaders/postprocess/chromaticAberration.wgsl?raw'
import fxaaShader from './shaders/postprocess/fxaa.wgsl?raw'
import sharpenShader from './shaders/postprocess/sharpen.wgsl?raw'
import colorGradeShader from './shaders/postprocess/colorGrade.wgsl?raw'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EffectCategory = 'crt' | 'individual'

export interface PostProcessEffect {
  id: string
  name: string
  enabled: boolean
  category: EffectCategory
  intensity?: number
  params?: Record<string, number | string | number[]>
}

export interface CRTSettings {
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

export interface PostProcessStack {
  enabled: boolean
  crtEnabled: boolean
  crtSettings: CRTSettings
  effects: PostProcessEffect[]
  preset?: string
}

export interface PostProcessPreset {
  name: string
  crtSettings: Partial<CRTSettings>
  effects?: PostProcessEffect[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Settings & Presets
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CRT_SETTINGS: CRTSettings = {
  scanlines: 0,
  curvature: 0,
  bloom: 0,
  noise: 0,
  chromatic: 0,
  flicker: 0,
  vignette: 0,
  pixelate: 0,
  colorShift: 0,
}

export const DEFAULT_STACK: PostProcessStack = {
  enabled: false,
  crtEnabled: false,
  crtSettings: { ...DEFAULT_CRT_SETTINGS },
  effects: [],
}

export const POST_PROCESS_PRESETS: Record<string, PostProcessPreset> = {
  clean: {
    name: 'Clean',
    crtSettings: { ...DEFAULT_CRT_SETTINGS },
  },
  crt: {
    name: 'CRT Monitor',
    crtSettings: {
      scanlines: 0.6,
      curvature: 0.4,
      bloom: 0.3,
      noise: 0.15,
      chromatic: 0.3,
      flicker: 0.2,
      vignette: 0.5,
    },
  },
  neon: {
    name: 'Neon Glow',
    crtSettings: {
      scanlines: 0.2,
      bloom: 0.8,
      noise: 0.05,
      chromatic: 0.5,
      vignette: 0.3,
      colorShift: 0.2,
    },
  },
  retro: {
    name: 'Retro Terminal',
    crtSettings: {
      scanlines: 0.8,
      curvature: 0.5,
      bloom: 0.4,
      noise: 0.2,
      chromatic: 0.2,
      flicker: 0.3,
      vignette: 0.6,
      colorShift: -0.2,
    },
  },
  arcade: {
    name: 'Arcade Cabinet',
    crtSettings: {
      scanlines: 0.5,
      curvature: 0.3,
      bloom: 0.5,
      noise: 0.1,
      chromatic: 0.4,
      flicker: 0.1,
      vignette: 0.7,
      colorShift: 0.1,
    },
  },
  minimal: {
    name: 'Minimal',
    crtSettings: {
      scanlines: 0.2,
      bloom: 0.2,
      vignette: 0.2,
    },
  },
  glitch: {
    name: 'Glitchy',
    crtSettings: {
      scanlines: 0.4,
      curvature: 0.1,
      bloom: 0.2,
      noise: 0.5,
      chromatic: 0.6,
      flicker: 0.6,
      vignette: 0.4,
      pixelate: 0.1,
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect Pipeline Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface EffectConfig {
  shader: string
  uniformSize: number // in floats (must be multiple of 4 for alignment)
  getUniforms: (effect: PostProcessEffect, time: number) => Float32Array
}

const num = (val: unknown, def: number): number =>
  typeof val === 'number' ? val : def

const arr3 = (val: unknown, def: [number, number, number]): [number, number, number] =>
  Array.isArray(val) && val.length >= 3 ? [val[0], val[1], val[2]] : def

const EFFECT_CONFIGS: Record<string, EffectConfig> = {
  bloom: {
    shader: bloomShader,
    uniformSize: 4,
    getUniforms: (effect) => new Float32Array([
      num(effect.params?.threshold, 0.8),
      num(effect.intensity ?? effect.params?.intensity, 1.0),
      num(effect.params?.radius, 4),
      0,
    ]),
  },
  vignette: {
    shader: vignetteShader,
    uniformSize: 4,
    getUniforms: (effect) => new Float32Array([
      num(effect.intensity ?? effect.params?.intensity, 0.5),
      num(effect.params?.smoothness, 0.5),
      num(effect.params?.roundness, 0.5),
      0,
    ]),
  },
  filmGrain: {
    shader: filmGrainShader,
    uniformSize: 4,
    getUniforms: (effect, time) => new Float32Array([
      num(effect.intensity ?? effect.params?.intensity, 0.1),
      time,
      num(effect.params?.luminanceInfluence, 0.5),
      0,
    ]),
  },
  chromaticAberration: {
    shader: chromaticAberrationShader,
    uniformSize: 4,
    getUniforms: (effect) => new Float32Array([
      num(effect.intensity ?? effect.params?.intensity, 0.01),
      0, 0, 0,
    ]),
  },
  fxaa: {
    shader: fxaaShader,
    uniformSize: 4,
    getUniforms: (effect) => {
      const qualityMap: Record<string, number> = { low: 0, medium: 1, high: 2 }
      const quality = typeof effect.params?.quality === 'string'
        ? (qualityMap[effect.params.quality] ?? 1)
        : num(effect.params?.quality, 1)
      return new Float32Array([quality, 0, 0, 0])
    },
  },
  sharpen: {
    shader: sharpenShader,
    uniformSize: 4,
    getUniforms: (effect) => new Float32Array([
      num(effect.intensity ?? effect.params?.intensity, 0.5),
      0, 0, 0,
    ]),
  },
  colorGrading: {
    shader: colorGradeShader,
    uniformSize: 8,
    getUniforms: (effect) => {
      const tonemapMap: Record<string, number> = { none: 0, reinhard: 1, aces: 2, filmic: 3 }
      const tonemapping = typeof effect.params?.tonemapping === 'string'
        ? (tonemapMap[effect.params.tonemapping] ?? 1)
        : num(effect.params?.tonemapping, 1)
      return new Float32Array([
        num(effect.params?.exposure, 1.0),
        num(effect.params?.contrast, 1.0),
        num(effect.params?.saturation, 1.0),
        num(effect.params?.gamma, 2.2),
        tonemapping,
        0, 0, 0,
      ])
    },
  },
}

interface EffectPipeline {
  pipeline: GPURenderPipeline
  bindGroupLayout: GPUBindGroupLayout
  uniformBuffer: GPUBuffer
}

// ─────────────────────────────────────────────────────────────────────────────
// PostProcessPipeline Class
// ─────────────────────────────────────────────────────────────────────────────

export class PostProcessPipeline {
  private device: GPUDevice
  private format: GPUTextureFormat
  private targetPool: RenderTargetPool
  private initialized = false
  private width = 0
  private height = 0

  // Shared sampler
  private sampler: GPUSampler

  // Blit pipeline (simple copy)
  private blitPipeline: GPURenderPipeline | null = null
  private blitBindGroupLayout: GPUBindGroupLayout | null = null

  // CRT pipeline (combined ASCII effects)
  private crtPipeline: GPURenderPipeline | null = null
  private crtBindGroupLayout: GPUBindGroupLayout | null = null
  private crtUniformBuffer: GPUBuffer | null = null

  // Individual effect pipelines
  private effectPipelines: Map<string, EffectPipeline> = new Map()

  constructor(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device
    this.format = format
    this.targetPool = new RenderTargetPool(device)

    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  async init(): Promise<void> {
    await this.createBlitPipeline()
    await this.createCRTPipeline()

    for (const [effectId, config] of Object.entries(EFFECT_CONFIGS)) {
      await this.createEffectPipeline(effectId, config)
    }

    this.initialized = true
    console.log('✓ PostProcessPipeline initialized')
  }

  private async createBlitPipeline(): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: 'PostProcess_Blit',
      code: blitShader,
    })

    this.blitBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    })

    this.blitPipeline = this.device.createRenderPipeline({
      label: 'PostProcess_Blit',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.blitBindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    })
  }

  private async createCRTPipeline(): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: 'PostProcess_CRT',
      code: asciiPostProcessCode,
    })

    // Uniform buffer: 14 floats (56 bytes, aligned to 16 = 64 bytes)
    // Matches AsciiPostUniforms struct: vec2f + 11 f32 + 1 pad
    this.crtUniformBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.crtBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    })

    this.crtPipeline = this.device.createRenderPipeline({
      label: 'PostProcess_CRT',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.crtBindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    })
  }

  private async createEffectPipeline(effectId: string, config: EffectConfig): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: `PostProcess_${effectId}`,
      code: config.shader,
    })

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    })

    const uniformSize = Math.max(16, config.uniformSize * 4)
    const uniformBuffer = this.device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const pipeline = this.device.createRenderPipeline({
      label: `PostProcess_${effectId}`,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    })

    this.effectPipelines.set(effectId, { pipeline, bindGroupLayout, uniformBuffer })
  }

  /**
   * Simple blit (copy) from source to destination.
   */
  blit(
    encoder: GPUCommandEncoder,
    sourceView: GPUTextureView,
    destView: GPUTextureView
  ): void {
    if (!this.blitPipeline || !this.blitBindGroupLayout) return

    const bindGroup = this.device.createBindGroup({
      layout: this.blitBindGroupLayout,
      entries: [
        { binding: 0, resource: sourceView },
        { binding: 1, resource: this.sampler },
      ],
    })

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: destView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      }],
    })

    pass.setPipeline(this.blitPipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()
  }

  /**
   * Execute a post-process stack (camera or global).
   * Returns the output texture view.
   */
  executeStack(
    encoder: GPUCommandEncoder,
    inputView: GPUTextureView,
    outputView: GPUTextureView,
    stack: PostProcessStack,
    width: number,
    height: number,
    time: number
  ): void {
    if (!this.initialized) {
      this.blit(encoder, inputView, outputView)
      return
    }

    this.width = width
    this.height = height

    // Check if any effects are active
    const hasCRT = stack.crtEnabled && this.hasCRTEffects(stack.crtSettings)
    const enabledEffects = stack.effects.filter(e => e.enabled && this.effectPipelines.has(e.id))
    const hasEffects = enabledEffects.length > 0

    if (!stack.enabled || (!hasCRT && !hasEffects)) {
      // No effects - simple blit
      this.blit(encoder, inputView, outputView)
      return
    }

    this.targetPool.beginFrame()

    let currentInput = inputView
    const acquiredTargets: RenderTarget[] = []

    // Apply individual effects first
    for (let i = 0; i < enabledEffects.length; i++) {
      const effect = enabledEffects[i]
      const isLast = i === enabledEffects.length - 1 && !hasCRT

      const outputTarget = isLast
        ? outputView
        : (() => {
            const target = this.targetPool.acquire(width, height, this.format)
            acquiredTargets.push(target)
            return target.view
          })()

      this.applyEffect(encoder, effect, currentInput, outputTarget, time)

      if (!isLast) {
        currentInput = acquiredTargets[acquiredTargets.length - 1].view
      }
    }

    // Apply CRT effects last (if enabled)
    if (hasCRT) {
      this.applyCRT(encoder, currentInput, outputView, stack.crtSettings, time)
    }

    // Release acquired targets
    for (const target of acquiredTargets) {
      this.targetPool.release(target)
    }
  }

  private hasCRTEffects(settings: CRTSettings): boolean {
    return (
      settings.scanlines > 0 ||
      settings.curvature > 0 ||
      settings.bloom > 0 ||
      settings.noise > 0 ||
      settings.chromatic > 0 ||
      settings.flicker > 0 ||
      settings.vignette > 0 ||
      settings.pixelate > 0 ||
      settings.colorShift !== 0
    )
  }

  private applyEffect(
    encoder: GPUCommandEncoder,
    effect: PostProcessEffect,
    inputView: GPUTextureView,
    outputView: GPUTextureView,
    time: number
  ): void {
    const effectPipeline = this.effectPipelines.get(effect.id)
    const config = EFFECT_CONFIGS[effect.id]
    if (!effectPipeline || !config) return

    // Update uniforms
    const uniforms = config.getUniforms(effect, time)
    this.device.queue.writeBuffer(effectPipeline.uniformBuffer, 0, uniforms)

    const bindGroup = this.device.createBindGroup({
      layout: effectPipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: inputView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: effectPipeline.uniformBuffer } },
      ],
    })

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: outputView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      }],
    })

    pass.setPipeline(effectPipeline.pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()
  }

  private applyCRT(
    encoder: GPUCommandEncoder,
    inputView: GPUTextureView,
    outputView: GPUTextureView,
    settings: CRTSettings,
    time: number
  ): void {
    if (!this.crtPipeline || !this.crtBindGroupLayout || !this.crtUniformBuffer) return

    // Update uniforms - matches AsciiPostUniforms struct
    const uniformData = new Float32Array([
      this.width,           // resolution.x
      this.height,          // resolution.y
      time,                 // time
      settings.scanlines,   // scanlines
      settings.curvature,   // curvature
      settings.bloom,       // bloom
      settings.noise,       // noise
      settings.chromatic,   // chromatic
      settings.flicker,     // flicker
      settings.vignette,    // vignette
      settings.pixelate,    // pixelate
      settings.colorShift,  // colorShift
      0,                    // _pad
      0,                    // padding to 64 bytes
    ])
    this.device.queue.writeBuffer(this.crtUniformBuffer, 0, uniformData)

    const bindGroup = this.device.createBindGroup({
      layout: this.crtBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.crtUniformBuffer } },
        { binding: 1, resource: inputView },
        { binding: 2, resource: this.sampler },
      ],
    })

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: outputView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      }],
    })

    pass.setPipeline(this.crtPipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()
  }

  /**
   * Apply a preset to a stack.
   */
  applyPreset(stack: PostProcessStack, presetName: string): PostProcessStack {
    const preset = POST_PROCESS_PRESETS[presetName]
    if (!preset) return stack

    return {
      ...stack,
      enabled: true,
      crtEnabled: true,
      crtSettings: {
        ...DEFAULT_CRT_SETTINGS,
        ...preset.crtSettings,
      },
      effects: preset.effects || [],
      preset: presetName,
    }
  }

  /**
   * Get available preset names.
   */
  static getPresetNames(): string[] {
    return Object.keys(POST_PROCESS_PRESETS)
  }

  /**
   * Get available individual effect IDs.
   */
  static getEffectIds(): string[] {
    return Object.keys(EFFECT_CONFIGS)
  }

  /**
   * Create a default effect with a given ID.
   */
  static createEffect(id: string): PostProcessEffect | null {
    if (!EFFECT_CONFIGS[id]) return null

    const names: Record<string, string> = {
      bloom: 'Bloom',
      vignette: 'Vignette',
      filmGrain: 'Film Grain',
      chromaticAberration: 'Chromatic Aberration',
      fxaa: 'FXAA',
      sharpen: 'Sharpen',
      colorGrading: 'Color Grading',
    }

    return {
      id,
      name: names[id] || id,
      enabled: true,
      category: 'individual',
      intensity: 0.5,
    }
  }

  /**
   * Destroy all resources.
   */
  destroy(): void {
    this.targetPool.destroy()
    this.crtUniformBuffer?.destroy()

    for (const [, effect] of this.effectPipelines) {
      effect.uniformBuffer.destroy()
    }
    this.effectPipelines.clear()
  }
}
