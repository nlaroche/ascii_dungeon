// ═══════════════════════════════════════════════════════════════════════════
// Post Process Manager - Manages post-processing effect chain execution
// ═══════════════════════════════════════════════════════════════════════════

import { RenderTargetPool, type RenderTarget } from './RenderTargetPool'
import { useEngineState } from '../stores/useEngineState'
import type { PostEffect } from '../stores/engineState'

// Import shader sources
import bloomShader from './shaders/postprocess/bloom.wgsl?raw'
import colorGradeShader from './shaders/postprocess/colorGrade.wgsl?raw'
import vignetteShader from './shaders/postprocess/vignette.wgsl?raw'
import fogShader from './shaders/postprocess/fog.wgsl?raw'
import filmGrainShader from './shaders/postprocess/filmGrain.wgsl?raw'
import chromaticAberrationShader from './shaders/postprocess/chromaticAberration.wgsl?raw'
import fxaaShader from './shaders/postprocess/fxaa.wgsl?raw'
import pixelateShader from './shaders/postprocess/pixelate.wgsl?raw'
import sharpenShader from './shaders/postprocess/sharpen.wgsl?raw'
import outlineShader from './shaders/postprocess/outline.wgsl?raw'
import ssaoShader from './shaders/postprocess/ssao.wgsl?raw'
import blitShader from './shaders/postprocess/blit.wgsl?raw'

interface EffectPipeline {
  pipeline: GPURenderPipeline
  bindGroupLayout: GPUBindGroupLayout
  uniformBuffer: GPUBuffer
  uniformSize: number
}

interface EffectConfig {
  shader: string
  uniformSize: number // in floats (must be multiple of 4 for alignment)
  getUniforms: (effect: EffectProps, time: number) => Float32Array
  needsDepth?: boolean
}

// Helper type for effect properties - all numbers/arrays with unknown fallback
type EffectProps = Record<string, number | number[] | string | boolean | undefined>

// Helper to get number from effect property
const num = (val: unknown, def: number): number =>
  typeof val === 'number' ? val : def

const arr3 = (val: unknown, def: [number, number, number]): [number, number, number] =>
  Array.isArray(val) && val.length >= 3 ? [val[0], val[1], val[2]] : def

// Effect configurations
const EFFECT_CONFIGS: Record<string, EffectConfig> = {
  bloom: {
    shader: bloomShader,
    uniformSize: 4, // threshold, intensity, radius, _pad
    getUniforms: (effect, _time) => {
      return new Float32Array([
        num(effect.threshold, 0.8),
        num(effect.intensity, 1.0),
        num(effect.radius, 4),
        0, // padding
      ])
    },
  },
  colorGrading: {
    shader: colorGradeShader,
    uniformSize: 8, // exposure, contrast, saturation, gamma, tonemap, _pad x3
    getUniforms: (effect, _time) => {
      // Convert tonemapping string to number
      const tonemapMap: Record<string, number> = { none: 0, reinhard: 1, aces: 2, filmic: 3 }
      const tonemapping = typeof effect.tonemapping === 'string'
        ? (tonemapMap[effect.tonemapping] ?? 1)
        : num(effect.tonemapping, 1)
      return new Float32Array([
        num(effect.exposure, 1.0),
        num(effect.contrast, 1.0),
        num(effect.saturation, 1.0),
        num(effect.gamma, 2.2),
        tonemapping,
        0, 0, 0, // padding
      ])
    },
  },
  vignette: {
    shader: vignetteShader,
    uniformSize: 4, // intensity, smoothness, roundness, _pad
    getUniforms: (effect, _time) => {
      return new Float32Array([
        num(effect.intensity, 0.5),
        num(effect.smoothness, 0.5),
        num(effect.roundness, 0.5),
        0, // padding
      ])
    },
  },
  fog: {
    shader: fogShader,
    uniformSize: 12, // color(3), density, start, end, heightFalloff, fogType, near, far, _pad x2
    needsDepth: true,
    getUniforms: (effect, _time) => {
      const color = arr3(effect.color, [0.5, 0.5, 0.6])
      return new Float32Array([
        color[0], color[1], color[2],
        num(effect.density, 0.02),
        num(effect.start, 10),
        num(effect.end, 100),
        num(effect.heightFalloff, 0.5),
        num(effect.fogType, 1), // 0=linear, 1=exp, 2=exp2
        0.1, // near - TODO: get from camera
        500, // far - TODO: get from camera
        0, 0, // padding
      ])
    },
  },
  filmGrain: {
    shader: filmGrainShader,
    uniformSize: 4, // intensity, time, luminanceInfluence, _pad
    getUniforms: (effect, time) => {
      return new Float32Array([
        num(effect.intensity, 0.1),
        time,
        num(effect.luminanceInfluence, 0.5),
        0, // padding
      ])
    },
  },
  chromaticAberration: {
    shader: chromaticAberrationShader,
    uniformSize: 4, // intensity, _pad x3
    getUniforms: (effect, _time) => {
      return new Float32Array([
        num(effect.intensity, 0.01),
        0, 0, 0, // padding
      ])
    },
  },
  fxaa: {
    shader: fxaaShader,
    uniformSize: 4, // quality, _pad x3
    getUniforms: (effect, _time) => {
      // Convert quality string to number
      const qualityMap: Record<string, number> = { low: 0, medium: 1, high: 2 }
      const quality = typeof effect.quality === 'string'
        ? (qualityMap[effect.quality] ?? 1)
        : num(effect.quality, 1)
      return new Float32Array([
        quality,
        0, 0, 0, // padding
      ])
    },
  },
  pixelate: {
    shader: pixelateShader,
    uniformSize: 4, // pixelSize, _pad x3
    getUniforms: (effect, _time) => {
      return new Float32Array([
        num(effect.pixelSize, 4),
        0, 0, 0, // padding
      ])
    },
  },
  sharpen: {
    shader: sharpenShader,
    uniformSize: 4, // intensity, _pad x3
    getUniforms: (effect, _time) => {
      return new Float32Array([
        num(effect.intensity, 0.5),
        0, 0, 0, // padding
      ])
    },
  },
  outline: {
    shader: outlineShader,
    uniformSize: 8, // color (4), thickness, _pad x3
    getUniforms: (effect, _time) => {
      const color = Array.isArray(effect.color) && effect.color.length >= 4
        ? effect.color : [0, 0, 0, 1]
      return new Float32Array([
        // vec4f comes first for proper 16-byte alignment
        num(color[0], 0), num(color[1], 0), num(color[2], 0), num(color[3], 1),
        num(effect.thickness, 1),
        0, 0, 0, // padding
      ])
    },
  },
  ssao: {
    shader: ssaoShader,
    uniformSize: 8, // radius, bias, intensity, samples, near, far, _pad x2
    needsDepth: true,
    getUniforms: (effect, _time) => {
      return new Float32Array([
        num(effect.radius, 0.5),
        num(effect.bias, 0.025),
        num(effect.intensity, 1.0),
        num(effect.samples, 16),
        0.1, // near - TODO: get from camera
        500, // far - TODO: get from camera
        0, 0, // padding
      ])
    },
  },
}

export class PostProcessManager {
  private device: GPUDevice
  private format: GPUTextureFormat
  private targetPool: RenderTargetPool
  private effectPipelines: Map<string, EffectPipeline> = new Map()
  private sampler: GPUSampler
  private initialized = false

  // Blit pipeline for copying without effects
  private blitPipeline: GPURenderPipeline | null = null
  private blitBindGroupLayout: GPUBindGroupLayout | null = null

  // Scene texture (input to post-process chain)
  private sceneTexture: GPUTexture | null = null
  private sceneTextureView: GPUTextureView | null = null
  private depthTextureView: GPUTextureView | null = null

  private width = 0
  private height = 0

  constructor(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device
    this.format = format
    this.targetPool = new RenderTargetPool(device)

    // Create linear sampler for post-processing
    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  async init(): Promise<void> {
    // Create blit pipeline
    await this.createBlitPipeline()

    // Create pipelines for all effects
    for (const [effectId, config] of Object.entries(EFFECT_CONFIGS)) {
      await this.createEffectPipeline(effectId, config)
    }

    this.initialized = true
  }

  private async createBlitPipeline(): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: 'PostProcess_Blit',
      code: blitShader,
    })

    // Check for compilation errors
    const info = await shaderModule.getCompilationInfo()
    if (info.messages.length > 0) {
      console.log('Blit shader compilation:')
      info.messages.forEach((msg) => {
        console.log(`  [${msg.type}] ${msg.message} at line ${msg.lineNum}`)
      })
    }

    this.blitBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
      ],
    })

    this.blitPipeline = this.device.createRenderPipeline({
      label: 'PostProcess_Blit',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.blitBindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })
  }

  private async createEffectPipeline(
    effectId: string,
    config: EffectConfig
  ): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: `PostProcess_${effectId}`,
      code: config.shader,
    })

    // Check for compilation errors
    const info = await shaderModule.getCompilationInfo()
    if (info.messages.length > 0) {
      const hasError = info.messages.some((msg) => msg.type === 'error')
      if (hasError) {
        console.error(`❌ ${effectId} shader compilation FAILED:`)
      } else {
        console.log(`${effectId} shader compilation:`)
      }
      info.messages.forEach((msg) => {
        const logFn = msg.type === 'error' ? console.error : console.warn
        logFn(`  [${msg.type}] Line ${msg.lineNum}: ${msg.message}`)
      })
      if (hasError) {
        console.error(`  Shader source:\n${config.shader.split('\n').map((l, i) => `${i+1}: ${l}`).join('\n')}`)
      }
    } else {
      console.log(`✓ ${effectId} shader compiled successfully`)
    }

    // Create bind group layout
    const entries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ]

    // Add depth texture binding if needed
    if (config.needsDepth) {
      entries.push({
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'depth' },
      })
    }

    const bindGroupLayout = this.device.createBindGroupLayout({ entries })

    // Create uniform buffer (16-byte aligned)
    const uniformSize = Math.max(16, config.uniformSize * 4)
    const uniformBuffer = this.device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create pipeline
    const pipeline = this.device.createRenderPipeline({
      label: `PostProcess_${effectId}`,
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })

    this.effectPipelines.set(effectId, {
      pipeline,
      bindGroupLayout,
      uniformBuffer,
      uniformSize: config.uniformSize,
    })
  }

  /**
   * Resize internal textures.
   */
  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    if (width === 0 || height === 0) return

    this.width = width
    this.height = height

    // Destroy old scene texture
    if (this.sceneTexture) {
      this.sceneTexture.destroy()
    }

    // Create new scene texture
    this.sceneTexture = this.device.createTexture({
      label: 'PostProcess_SceneTexture',
      size: [width, height],
      format: this.format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    })
    this.sceneTextureView = this.sceneTexture.createView()
  }

  /**
   * Get the scene render target for main rendering.
   * The main render pass should output to this texture.
   */
  getSceneTarget(): { texture: GPUTexture; view: GPUTextureView } | null {
    if (!this.sceneTexture || !this.sceneTextureView) return null
    return { texture: this.sceneTexture, view: this.sceneTextureView }
  }

  /**
   * Set the depth texture for effects that need it.
   */
  setDepthTexture(depthView: GPUTextureView): void {
    this.depthTextureView = depthView
  }

  /**
   * Execute the post-processing chain.
   * Returns true if any effects were applied.
   */
  execute(
    commandEncoder: GPUCommandEncoder,
    outputView: GPUTextureView,
    time: number
  ): boolean {
    if (!this.initialized || !this.sceneTextureView) return false

    // Get enabled effects from state (ordered)
    const state = useEngineState.getState()
    const enabledEffects = state.renderPipeline.postEffects.filter(
      (e) => e.enabled && this.effectPipelines.has(e.id)
    )

    if (enabledEffects.length === 0) {
      // No effects - copy scene directly to output
      this.copyToOutput(commandEncoder, this.sceneTextureView, outputView)
      return false
    }

    // Begin frame for target pool
    this.targetPool.beginFrame()

    // Set up ping-pong buffers
    let currentInput = this.sceneTextureView
    let currentOutput: RenderTarget | null = null
    const acquiredTargets: RenderTarget[] = []

    // Process each enabled effect
    for (let i = 0; i < enabledEffects.length; i++) {
      const effect = enabledEffects[i]
      const isLast = i === enabledEffects.length - 1

      // Get output target
      const outputTarget = isLast
        ? outputView
        : (() => {
            currentOutput = this.targetPool.acquire(
              this.width,
              this.height,
              this.format
            )
            acquiredTargets.push(currentOutput)
            return currentOutput.view
          })()

      // Apply effect
      this.applyEffect(
        commandEncoder,
        effect,
        currentInput,
        outputTarget,
        time
      )

      // Swap for next iteration
      if (!isLast && currentOutput) {
        currentInput = currentOutput.view
      }
    }

    // Release acquired targets
    for (const target of acquiredTargets) {
      this.targetPool.release(target)
    }

    return true
  }

  private applyEffect(
    commandEncoder: GPUCommandEncoder,
    effect: PostEffect,
    inputView: GPUTextureView,
    outputView: GPUTextureView,
    time: number
  ): void {
    const effectPipeline = this.effectPipelines.get(effect.id)
    const config = EFFECT_CONFIGS[effect.id]
    if (!effectPipeline || !config) {
      console.warn(`PostProcess: Missing pipeline or config for effect '${effect.id}'`)
      return
    }

    // Skip effects that need depth if depth texture isn't available (copy input to output)
    if (config.needsDepth && !this.depthTextureView) {
      console.warn(`PostProcess: Effect '${effect.id}' needs depth texture but none is available, skipping`)
      this.copyToOutput(commandEncoder, inputView, outputView)
      return
    }

    // Update uniform buffer
    const uniforms = config.getUniforms(effect as unknown as EffectProps, time)
    this.device.queue.writeBuffer(effectPipeline.uniformBuffer, 0, uniforms as unknown as BufferSource)

    // Create bind group entries
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: inputView },
      { binding: 1, resource: this.sampler },
      { binding: 2, resource: { buffer: effectPipeline.uniformBuffer } },
    ]

    // Add depth texture if needed
    if (config.needsDepth && this.depthTextureView) {
      entries.push({ binding: 3, resource: this.depthTextureView })
    }

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: effectPipeline.bindGroupLayout,
      entries,
    })

    // Render pass
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: outputView,
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ],
    })

    pass.setPipeline(effectPipeline.pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3) // Fullscreen triangle
    pass.end()
  }

  private copyToOutput(
    commandEncoder: GPUCommandEncoder,
    sourceView: GPUTextureView,
    destView: GPUTextureView
  ): void {
    if (!this.blitPipeline || !this.blitBindGroupLayout) return

    // Create bind group for blit
    const bindGroup = this.device.createBindGroup({
      layout: this.blitBindGroupLayout,
      entries: [
        { binding: 0, resource: sourceView },
        { binding: 1, resource: this.sampler },
      ],
    })

    // Blit pass
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: destView,
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ],
    })

    pass.setPipeline(this.blitPipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3) // Fullscreen triangle
    pass.end()
  }

  /**
   * Check if post-processing is needed (any effects enabled).
   */
  hasActiveEffects(): boolean {
    const state = useEngineState.getState()
    return state.renderPipeline.postEffects.some(
      (e) => e.enabled && this.effectPipelines.has(e.id)
    )
  }

  /**
   * Destroy all resources.
   */
  destroy(): void {
    this.targetPool.destroy()

    for (const [, effect] of this.effectPipelines) {
      effect.uniformBuffer.destroy()
    }
    this.effectPipelines.clear()

    this.sceneTexture?.destroy()
    this.sceneTexture = null
    this.sceneTextureView = null
  }
}
