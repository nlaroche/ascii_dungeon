// WebGPU Renderer - Core rendering class

import { Camera } from './Camera'
import { Scene } from './Scene'
import { INSTANCE_BYTES } from './types'
import voxelShaderCode from './shaders/voxel.wgsl?raw'
import waterShaderCode from './shaders/water.wgsl?raw'
import skyShaderCode from './shaders/sky.wgsl?raw'
import gridShaderCode from './shaders/grid.wgsl?raw'
import gizmoShaderCode from './shaders/gizmo.wgsl?raw'
import glyphShaderCode from './shaders/glyph.wgsl?raw'
import shadowVSMCode from './shaders/shadowVSM.wgsl?raw'
import vsmBlurCode from './shaders/vsmBlur.wgsl?raw'
import { GizmoGeometry, type GizmoMode, type GizmoAxis } from './Gizmo'
import { PostProcessManager } from './PostProcessManager'

// Cube geometry data
const CUBE_VERTICES = new Float32Array([
  // Position (xyz), Normal (xyz) - 24 vertices (4 per face)
  // Front face
  -0.5, -0.5,  0.5,  0, 0, 1,
   0.5, -0.5,  0.5,  0, 0, 1,
   0.5,  0.5,  0.5,  0, 0, 1,
  -0.5,  0.5,  0.5,  0, 0, 1,
  // Back face
   0.5, -0.5, -0.5,  0, 0, -1,
  -0.5, -0.5, -0.5,  0, 0, -1,
  -0.5,  0.5, -0.5,  0, 0, -1,
   0.5,  0.5, -0.5,  0, 0, -1,
  // Top face
  -0.5,  0.5,  0.5,  0, 1, 0,
   0.5,  0.5,  0.5,  0, 1, 0,
   0.5,  0.5, -0.5,  0, 1, 0,
  -0.5,  0.5, -0.5,  0, 1, 0,
  // Bottom face
  -0.5, -0.5, -0.5,  0, -1, 0,
   0.5, -0.5, -0.5,  0, -1, 0,
   0.5, -0.5,  0.5,  0, -1, 0,
  -0.5, -0.5,  0.5,  0, -1, 0,
  // Right face
   0.5, -0.5,  0.5,  1, 0, 0,
   0.5, -0.5, -0.5,  1, 0, 0,
   0.5,  0.5, -0.5,  1, 0, 0,
   0.5,  0.5,  0.5,  1, 0, 0,
  // Left face
  -0.5, -0.5, -0.5,  -1, 0, 0,
  -0.5, -0.5,  0.5,  -1, 0, 0,
  -0.5,  0.5,  0.5,  -1, 0, 0,
  -0.5,  0.5, -0.5,  -1, 0, 0,
])

const CUBE_INDICES = new Uint16Array([
  0, 1, 2, 0, 2, 3,       // Front
  4, 5, 6, 4, 6, 7,       // Back
  8, 9, 10, 8, 10, 11,    // Top
  12, 13, 14, 12, 14, 15, // Bottom
  16, 17, 18, 16, 18, 19, // Right
  20, 21, 22, 20, 22, 23, // Left
])

const SHADOW_MAP_SIZE = 1024
const MAX_INSTANCES = 10000
const MAX_GLYPH_VERTICES = 50000  // Max vertices for all glyph meshes
const MAX_GLYPH_INDICES = 100000  // Max indices for all glyph meshes
const GLYPH_VERTEX_SIZE = 11 * 4  // 11 floats: pos(3) + normal(3) + color(4) + emission(1)

export class WebGPURenderer {
  private device!: GPUDevice
  private context!: GPUCanvasContext
  private format!: GPUTextureFormat

  // Geometry
  private vertexBuffer!: GPUBuffer
  private indexBuffer!: GPUBuffer

  // Instance data
  private instanceBuffer!: GPUBuffer
  private instanceCount = 0

  // Uniforms - expanded for enhanced lighting
  // Layout: viewProj(16) + lightViewProj(16) + cameraPos(4) + mainLightDir(4) + mainLightColor(4)
  //         + fillLightDir(4) + fillLightColor(4) + ambientSky(4) + ambientGround(4) = 60 floats
  private uniformBuffer!: GPUBuffer
  private uniformData = new Float32Array(60)

  // Pipelines
  private mainPipeline!: GPURenderPipeline
  private shadowPipeline!: GPURenderPipeline
  private waterPipeline!: GPURenderPipeline
  private skyPipeline!: GPURenderPipeline
  private gridPipeline!: GPURenderPipeline

  // Textures
  private depthTexture!: GPUTexture
  private shadowMap!: GPUTexture
  private reflectionTexture!: GPUTexture
  private reflectionDepth!: GPUTexture

  // Bind groups
  private mainBindGroup!: GPUBindGroup
  private shadowBindGroup!: GPUBindGroup
  private waterBindGroup!: GPUBindGroup
  private gridBindGroup!: GPUBindGroup

  // Grid uniform buffer (viewProj + cameraPos)
  private gridUniformBuffer!: GPUBuffer
  private gridUniformData = new Float32Array(20) // viewProj(16) + cameraPos(4)

  // Gizmo rendering
  private _gizmoDebugLogged = false
  private gizmoPipeline!: GPURenderPipeline
  private gizmoUniformBuffer!: GPUBuffer
  private gizmoUniformData = new Float32Array(20) // viewProj(16) + position(3) + scale(1)
  private gizmoVertexBuffer!: GPUBuffer
  private gizmoIndexBuffer!: GPUBuffer
  private gizmoBindGroup!: GPUBindGroup
  private gizmoGeometryCache: Map<string, { vertices: GPUBuffer; indices: GPUBuffer; indexCount: number }> = new Map()

  // Wireframe rendering for selection bounds
  private wireframePipeline!: GPURenderPipeline
  private wireframeVertexBuffer!: GPUBuffer
  private wireframeIndexBuffer!: GPUBuffer
  private wireframeUniformBuffer!: GPUBuffer
  private wireframeBindGroup!: GPUBindGroup

  // Glyph mesh rendering (smooth polygon glyphs)
  private glyphPipeline!: GPURenderPipeline
  private glyphShadowPipeline!: GPURenderPipeline
  private glyphVertexBuffer!: GPUBuffer
  private glyphIndexBuffer!: GPUBuffer
  private glyphBindGroup!: GPUBindGroup
  private glyphShadowBindGroup!: GPUBindGroup
  private glyphIndexCount = 0

  // Samplers
  private shadowSampler!: GPUSampler
  private reflectionSampler!: GPUSampler

  // VSM (Variance Shadow Mapping) resources
  private vsmPipeline!: GPURenderPipeline
  private vsmBlurPipeline!: GPURenderPipeline
  private vsmShadowMap!: GPUTexture      // rg32float format (depth, depth²)
  private vsmBlurTemp!: GPUTexture       // Intermediate blur texture
  private vsmDepthTexture!: GPUTexture   // Depth texture for VSM pass
  private vsmBindGroup!: GPUBindGroup
  private vsmBlurBindGroupH!: GPUBindGroup  // Horizontal blur
  private vsmBlurBindGroupV!: GPUBindGroup  // Vertical blur
  private vsmSampler!: GPUSampler        // Non-comparison sampler for VSM
  private vsmBlurUniformBuffer!: GPUBuffer
  private mainPipelineVSM!: GPURenderPipeline  // Alternative main pipeline for VSM
  private mainBindGroupVSM!: GPUBindGroup

  // Post-processing
  private postProcessManager!: PostProcessManager
  private postProcessEnabled = true

  // Shadow settings (updated from UI)
  private shadowSettings = {
    enabled: true,
    type: 'pcf' as 'pcf' | 'vsm' | 'pcss',
    resolution: 1024,
    softness: 0.5,
    bias: 0.005,
  }

  // Reflection settings (updated from UI)
  private reflectionSettings = {
    enabled: true,
    floorReflectivity: 0.15,
    waterReflectivity: 0.6,
  }

  // Lighting settings (updated from UI)
  private lightingSettings = {
    sun: {
      enabled: true,
      direction: [-0.2, -0.95, -0.1] as [number, number, number],  // Nearly vertical
      color: [1.0, 0.95, 0.9] as [number, number, number],
      intensity: 1.0,
    },
    ambient: {
      color: [0.18, 0.25, 0.35] as [number, number, number],
      intensity: 0.4,
    },
    fill: {
      enabled: true,
      direction: [0.6, -0.3, 0.5] as [number, number, number],
      color: [0.6, 0.7, 0.9] as [number, number, number],
      intensity: 0.4,
    },
  }

  // Environment settings (updated from UI)
  private environmentSettings = {
    sky: {
      zenithColor: [0.02, 0.03, 0.06] as [number, number, number],
      horizonColor: [0.08, 0.12, 0.18] as [number, number, number],
      groundColor: [0.03, 0.04, 0.03] as [number, number, number],
    },
  }

  // Sky uniform buffer (for dynamic sky colors)
  // Layout: zenithColor(4) + horizonColor(4) + groundColor(4) = 12 floats = 48 bytes
  private skyUniformBuffer!: GPUBuffer
  private skyUniformData = new Float32Array(12)
  private skyBindGroup!: GPUBindGroup

  private width = 0
  private height = 0
  private initialized = false

  async init(canvas: HTMLCanvasElement): Promise<void> {
    // Request adapter and device
    const adapter = await navigator.gpu?.requestAdapter()
    if (!adapter) {
      throw new Error('WebGPU not supported - no adapter found')
    }

    this.device = await adapter.requestDevice()

    // Setup canvas context
    this.context = canvas.getContext('webgpu') as GPUCanvasContext
    this.format = navigator.gpu.getPreferredCanvasFormat()

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    })

    this.width = canvas.width
    this.height = canvas.height

    // Create geometry buffers
    this.createGeometryBuffers()

    // Create instance buffer
    this.instanceBuffer = this.device.createBuffer({
      size: MAX_INSTANCES * INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create grid uniform buffer
    this.gridUniformBuffer = this.device.createBuffer({
      size: this.gridUniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create sky uniform buffer
    this.skyUniformBuffer = this.device.createBuffer({
      size: this.skyUniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create textures
    this.createTextures()

    // Create samplers
    this.createSamplers()

    // Create pipelines
    await this.createPipelines()

    // Create gizmo pipeline
    await this.createGizmoPipeline()

    // Create glyph pipeline
    await this.createGlyphPipeline()

    // Create bind groups
    this.createBindGroups()

    // Initialize post-processing
    this.postProcessManager = new PostProcessManager(this.device, this.format)
    await this.postProcessManager.init()
    this.postProcessManager.resize(this.width, this.height)

    this.initialized = true
  }

  private createGeometryBuffers() {
    this.vertexBuffer = this.device.createBuffer({
      size: CUBE_VERTICES.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(this.vertexBuffer, 0, CUBE_VERTICES)

    this.indexBuffer = this.device.createBuffer({
      size: CUBE_INDICES.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(this.indexBuffer, 0, CUBE_INDICES)
  }

  private createTextures() {
    // Depth texture for main pass (depth32float for post-process sampling)
    this.depthTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    // Shadow map
    this.shadowMap = this.device.createTexture({
      size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    // Reflection texture (for water)
    this.reflectionTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    this.reflectionDepth = this.device.createTexture({
      size: [this.width, this.height],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })

    // VSM shadow map (rg32float for depth moments)
    this.vsmShadowMap = this.device.createTexture({
      size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
      format: 'rg32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    // VSM blur intermediate texture
    this.vsmBlurTemp = this.device.createTexture({
      size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
      format: 'rg32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    // VSM depth texture (for depth testing during VSM shadow pass)
    this.vsmDepthTexture = this.device.createTexture({
      size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }

  private createSamplers() {
    this.shadowSampler = this.device.createSampler({
      compare: 'greater',  // ref > stored → 1.0: fragment further than shadow map = LIT (inverted depth)
      magFilter: 'linear',
      minFilter: 'linear',
    })

    this.reflectionSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    })

    // VSM sampler - non-comparison, linear filtering for soft shadows
    this.vsmSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  private async createPipelines() {
    const voxelModule = this.device.createShaderModule({ code: voxelShaderCode })
    const waterModule = this.device.createShaderModule({ code: waterShaderCode })

    // Check for shader compilation errors
    const voxelInfo = await voxelModule.getCompilationInfo()
    if (voxelInfo.messages.length > 0) {
      console.log('Voxel shader compilation messages:')
      voxelInfo.messages.forEach(msg => {
        console.log(`  [${msg.type}] ${msg.message} at line ${msg.lineNum}`)
      })
    }
    const waterInfo = await waterModule.getCompilationInfo()
    if (waterInfo.messages.length > 0) {
      console.log('Water shader compilation messages:')
      waterInfo.messages.forEach(msg => {
        console.log(`  [${msg.type}] ${msg.message} at line ${msg.lineNum}`)
      })
    }

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 24, // 6 floats * 4 bytes
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
      ],
    }

    // Bind group layout for main pipeline
    const mainBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    })

    // Main render pipeline
    this.mainPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [mainBindGroupLayout] }),
      vertex: {
        module: voxelModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: voxelModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    })

    // Shadow pipeline (depth only)
    const shadowBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    })

    this.shadowPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [shadowBindGroupLayout] }),
      vertex: {
        module: voxelModule,
        entryPoint: 'vs_shadow',
        buffers: [vertexBufferLayout],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',  // Render front faces to shadow map
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: true,
        depthCompare: 'greater',  // Inverted depth: larger values win (closer to light)
      },
    })

    // VSM shadow pipeline (outputs depth moments to color attachment)
    const vsmModule = this.device.createShaderModule({ code: shadowVSMCode })
    const vsmBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    })

    this.vsmPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [vsmBindGroupLayout] }),
      vertex: {
        module: vsmModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: vsmModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'rg32float' }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    })

    // VSM blur pipeline (Gaussian blur)
    const vsmBlurModule = this.device.createShaderModule({ code: vsmBlurCode })
    const vsmBlurBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    })

    this.vsmBlurPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [vsmBlurBindGroupLayout] }),
      vertex: {
        module: vsmBlurModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: vsmBlurModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'rg32float' }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })

    // VSM blur uniform buffer
    this.vsmBlurUniformBuffer = this.device.createBuffer({
      size: 16, // vec2 direction + vec2 texelSize
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Water pipeline
    const waterBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    })

    this.waterPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [waterBindGroupLayout] }),
      vertex: {
        module: waterModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: waterModule,
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
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: false, // Water doesn't write depth
        depthCompare: 'less',
      },
    })

    // Sky pipeline (fullscreen gradient)
    const skyModule = this.device.createShaderModule({ code: skyShaderCode })
    this.skyPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: skyModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: skyModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: false,
        depthCompare: 'always', // Always draw sky (it's at z=1)
      },
    })

    // Grid pipeline
    const gridModule = this.device.createShaderModule({ code: gridShaderCode })
    this.gridPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: gridModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: gridModule,
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
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
      },
    })
  }

  private async createGizmoPipeline() {
    const gizmoModule = this.device.createShaderModule({ code: gizmoShaderCode })

    // Check for shader compilation errors
    const info = await gizmoModule.getCompilationInfo()
    if (info.messages.length > 0) {
      console.log('Gizmo shader compilation messages:')
      info.messages.forEach(msg => {
        console.log(`  [${msg.type}] ${msg.message} at line ${msg.lineNum}`)
      })
    }

    // Create uniform buffer for gizmo
    this.gizmoUniformBuffer = this.device.createBuffer({
      size: this.gizmoUniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create max-sized vertex and index buffers for gizmo geometry
    const MAX_GIZMO_VERTICES = 2048
    const MAX_GIZMO_INDICES = 4096

    this.gizmoVertexBuffer = this.device.createBuffer({
      size: MAX_GIZMO_VERTICES * 7 * 4, // 7 floats per vertex
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })

    this.gizmoIndexBuffer = this.device.createBuffer({
      size: MAX_GIZMO_INDICES * 2, // 2 bytes per index
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })

    // Vertex layout for gizmo (position + color)
    const gizmoVertexLayout: GPUVertexBufferLayout = {
      arrayStride: 7 * 4, // 7 floats: position(3) + color(4)
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
        { shaderLocation: 1, offset: 12, format: 'float32x4' }, // color
      ],
    }

    // Gizmo pipeline
    this.gizmoPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: gizmoModule,
        entryPoint: 'vs_main',
        buffers: [gizmoVertexLayout],
      },
      fragment: {
        module: gizmoModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none', // Don't cull gizmo faces
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
      },
    })

    // Wireframe uniform buffer (viewProj + model + color)
    this.wireframeUniformBuffer = this.device.createBuffer({
      size: (16 + 16 + 4) * 4, // viewProj(16) + modelMatrix(16) + color(4)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create wireframe vertex/index buffers
    const wireBox = GizmoGeometry.createWireframeBox()
    this.wireframeVertexBuffer = this.device.createBuffer({
      size: wireBox.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(this.wireframeVertexBuffer, 0, wireBox.vertices)

    this.wireframeIndexBuffer = this.device.createBuffer({
      size: wireBox.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(this.wireframeIndexBuffer, 0, wireBox.indices)

    // Wireframe pipeline (line-list)
    this.wireframePipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: gizmoModule,
        entryPoint: 'vs_wireframe',
        buffers: [{
          arrayStride: 12, // 3 floats: position
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
          ],
        }],
      },
      fragment: {
        module: gizmoModule,
        entryPoint: 'fs_wireframe',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'line-list',
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
      },
    })
  }

  private async createGlyphPipeline() {
    const glyphModule = this.device.createShaderModule({ code: glyphShaderCode })

    // Check for shader compilation errors
    const info = await glyphModule.getCompilationInfo()
    if (info.messages.length > 0) {
      console.log('Glyph shader compilation messages:')
      info.messages.forEach(msg => {
        console.log(`  [${msg.type}] ${msg.message} at line ${msg.lineNum}`)
      })
    }

    // Create glyph vertex buffer (dynamic, updated each frame)
    this.glyphVertexBuffer = this.device.createBuffer({
      size: MAX_GLYPH_VERTICES * GLYPH_VERTEX_SIZE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })

    // Create glyph index buffer (dynamic, updated each frame)
    this.glyphIndexBuffer = this.device.createBuffer({
      size: MAX_GLYPH_INDICES * 4, // 4 bytes per index (uint32)
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })

    // Vertex layout for glyphs: pos(3) + normal(3) + color(4) + emission(1) = 11 floats
    const glyphVertexLayout: GPUVertexBufferLayout = {
      arrayStride: GLYPH_VERTEX_SIZE, // 11 floats = 44 bytes
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },    // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' },   // normal
        { shaderLocation: 2, offset: 24, format: 'float32x4' },   // color
        { shaderLocation: 3, offset: 40, format: 'float32' },     // emission
      ],
    }

    // Bind group layout for glyph pipeline
    const glyphBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    })

    // Glyph render pipeline
    this.glyphPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [glyphBindGroupLayout] }),
      vertex: {
        module: glyphModule,
        entryPoint: 'vs_main',
        buffers: [glyphVertexLayout],
      },
      fragment: {
        module: glyphModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
      },
    })

    // Glyph shadow pipeline (depth-only for shadow casting)
    const glyphShadowBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    })

    this.glyphShadowPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [glyphShadowBindGroupLayout] }),
      vertex: {
        module: glyphModule,
        entryPoint: 'vs_shadow',
        buffers: [glyphVertexLayout],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',  // Render front faces to shadow map
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: true,
        depthCompare: 'greater',  // Inverted depth: larger values win
      },
    })
  }

  private createBindGroups() {
    // Main bind group
    this.mainBindGroup = this.device.createBindGroup({
      layout: this.mainPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 2, resource: this.shadowMap.createView() },
        { binding: 3, resource: this.shadowSampler },
      ],
    })

    // Shadow bind group
    this.shadowBindGroup = this.device.createBindGroup({
      layout: this.shadowPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
      ],
    })

    // Water bind group
    this.waterBindGroup = this.device.createBindGroup({
      layout: this.waterPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 2, resource: this.reflectionTexture.createView() },
        { binding: 3, resource: this.reflectionSampler },
      ],
    })

    // Grid bind group
    this.gridBindGroup = this.device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.gridUniformBuffer } },
      ],
    })

    // Sky bind group
    this.skyBindGroup = this.device.createBindGroup({
      layout: this.skyPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.skyUniformBuffer } },
      ],
    })

    // Gizmo bind group
    this.gizmoBindGroup = this.device.createBindGroup({
      layout: this.gizmoPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.gizmoUniformBuffer } },
      ],
    })

    // Wireframe bind group (uses binding 0 for its own uniforms)
    this.wireframeBindGroup = this.device.createBindGroup({
      layout: this.wireframePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.wireframeUniformBuffer } },
      ],
    })

    // Glyph bind group
    this.glyphBindGroup = this.device.createBindGroup({
      layout: this.glyphPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.shadowMap.createView() },
        { binding: 2, resource: this.shadowSampler },
      ],
    })

    // Glyph shadow bind group (for shadow casting)
    this.glyphShadowBindGroup = this.device.createBindGroup({
      layout: this.glyphShadowPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
      ],
    })

    // VSM bind group (uses same layout as shadow bind group)
    this.vsmBindGroup = this.device.createBindGroup({
      layout: this.vsmPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
      ],
    })

    // VSM blur bind groups (horizontal: vsmShadowMap -> vsmBlurTemp, vertical: vsmBlurTemp -> vsmShadowMap)
    this.vsmBlurBindGroupH = this.device.createBindGroup({
      layout: this.vsmBlurPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.vsmBlurUniformBuffer } },
        { binding: 1, resource: this.vsmShadowMap.createView() },
        { binding: 2, resource: this.vsmSampler },
      ],
    })

    this.vsmBlurBindGroupV = this.device.createBindGroup({
      layout: this.vsmBlurPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.vsmBlurUniformBuffer } },
        { binding: 1, resource: this.vsmBlurTemp.createView() },
        { binding: 2, resource: this.vsmSampler },
      ],
    })
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return
    if (width === 0 || height === 0) return

    this.width = width
    this.height = height

    // Recreate size-dependent textures
    this.depthTexture.destroy()
    this.reflectionTexture.destroy()
    this.reflectionDepth.destroy()

    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    this.reflectionTexture = this.device.createTexture({
      size: [width, height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    this.reflectionDepth = this.device.createTexture({
      size: [width, height],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })

    // Recreate bind groups that reference resized textures
    this.waterBindGroup = this.device.createBindGroup({
      layout: this.waterPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 2, resource: this.reflectionTexture.createView() },
        { binding: 3, resource: this.reflectionSampler },
      ],
    })

    // Resize post-processing
    this.postProcessManager?.resize(width, height)
  }

  private frameCount = 0

  render(scene: Scene, camera: Camera) {
    if (!this.initialized) return

    // Update instance buffer
    const instanceData = scene.getInstanceData()
    this.instanceCount = scene.getInstanceCount()

    // Debug: log once
    if (this.frameCount === 0) {
      console.log('First render frame:')
      console.log('  Instance count:', this.instanceCount)
      console.log('  Instance data length:', instanceData.length)
      console.log('  Canvas size:', this.width, 'x', this.height)
      console.log('  Camera position:', camera.position)
    }
    this.frameCount++

    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData.buffer, instanceData.byteOffset, instanceData.byteLength)

    // Update uniforms with lighting from settings
    const viewProj = this.multiplyMatrices(
      camera.getProjectionMatrix(this.width / this.height),
      camera.getViewMatrix()
    )

    // Get lighting from settings
    const { sun, ambient, fill } = this.lightingSettings
    const mainLightDir = this.normalize(sun.direction)
    const lightViewProj = camera.getLightViewProjection(mainLightDir)
    const fillLightDir = this.normalize(fill.direction)

    // Ambient colors from settings (sky color for top, darker for ground)
    const ambientSky: [number, number, number, number] = [
      ambient.color[0] * ambient.intensity,
      ambient.color[1] * ambient.intensity,
      ambient.color[2] * ambient.intensity,
      1.0
    ]
    const ambientGround: [number, number, number, number] = [
      ambient.color[0] * ambient.intensity * 0.6,
      ambient.color[1] * ambient.intensity * 0.6,
      ambient.color[2] * ambient.intensity * 0.5,
      1.0
    ]

    // viewProj: 0-15
    this.uniformData.set(viewProj, 0)
    // lightViewProj: 16-31
    this.uniformData.set(lightViewProj, 16)
    // cameraPos: 32-35 (xyz = position, w = time)
    this.uniformData.set(camera.position, 32)
    this.uniformData[35] = scene.time
    // mainLightDir: 36-39 (xyz = direction, w = intensity)
    this.uniformData.set(mainLightDir, 36)
    this.uniformData[39] = sun.enabled ? sun.intensity : 0.0
    // mainLightColor: 40-43 (w = shadowEnabled flag)
    const shadowEnabled = this.shadowSettings.enabled ? 1.0 : 0.0
    this.uniformData.set([sun.color[0], sun.color[1], sun.color[2], shadowEnabled], 40)
    // fillLightDir: 44-47 (xyz = direction, w = intensity)
    this.uniformData.set(fillLightDir, 44)
    this.uniformData[47] = fill.enabled ? fill.intensity : 0.0
    // fillLightColor: 48-51
    this.uniformData.set([fill.color[0], fill.color[1], fill.color[2], 1.0], 48)
    // ambientSky: 52-55
    this.uniformData.set(ambientSky, 52)
    // ambientGround: 56-59
    this.uniformData.set(ambientGround, 56)

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)

    const commandEncoder = this.device.createCommandEncoder()

    // Update glyph buffers early so they can be used in shadow pass
    const hasGlyphs = scene.hasGlyphs()
    if (hasGlyphs) {
      const glyphVertexData = scene.getGlyphVertexData()
      const glyphIndexData = scene.getGlyphIndexData()
      this.glyphIndexCount = scene.getGlyphIndexCount()
      this.device.queue.writeBuffer(this.glyphVertexBuffer, 0, glyphVertexData.buffer, glyphVertexData.byteOffset, glyphVertexData.byteLength)
      this.device.queue.writeBuffer(this.glyphIndexBuffer, 0, glyphIndexData.buffer, glyphIndexData.byteOffset, glyphIndexData.byteLength)
    }

    // Shadow pass - render both voxels and glyphs to shadow map
    if (this.shadowSettings.enabled) {
      const shadowPass = commandEncoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: this.shadowMap.createView(),
          depthClearValue: 0.0,  // Clear to 0 (inverted depth: larger = closer to light)
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      })

      // Render voxel instances to shadow map
      shadowPass.setPipeline(this.shadowPipeline)
      shadowPass.setBindGroup(0, this.shadowBindGroup)
      shadowPass.setVertexBuffer(0, this.vertexBuffer)
      shadowPass.setIndexBuffer(this.indexBuffer, 'uint16')
      shadowPass.drawIndexed(36, this.instanceCount)

      // Render glyphs to shadow map (so glyphs cast shadows)
      if (hasGlyphs && this.glyphIndexCount > 0) {
        shadowPass.setPipeline(this.glyphShadowPipeline)
        shadowPass.setBindGroup(0, this.glyphShadowBindGroup)
        shadowPass.setVertexBuffer(0, this.glyphVertexBuffer)
        shadowPass.setIndexBuffer(this.glyphIndexBuffer, 'uint32')
        shadowPass.drawIndexed(this.glyphIndexCount)
      }

      shadowPass.end()
    }

    // Reflection pass (render scene flipped for water)
    const reflectionPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.reflectionTexture.createView(),
        clearValue: { r: 0.4, g: 0.6, b: 0.9, a: 1.0 }, // Sky color
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.reflectionDepth.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
    reflectionPass.setPipeline(this.mainPipeline)
    reflectionPass.setBindGroup(0, this.mainBindGroup)
    reflectionPass.setVertexBuffer(0, this.vertexBuffer)
    reflectionPass.setIndexBuffer(this.indexBuffer, 'uint16')
    // For now, render same scene - proper reflection would flip Y
    reflectionPass.drawIndexed(36, scene.getNonWaterInstanceCount())
    reflectionPass.end()

    // Determine render target (post-process scene texture or canvas)
    const hasPostEffects = this.postProcessEnabled && this.postProcessManager?.hasActiveEffects()
    const sceneTarget = hasPostEffects ? this.postProcessManager.getSceneTarget() : null
    const mainRenderTarget = sceneTarget?.view ?? this.context.getCurrentTexture().createView()

    // Pass depth texture to post-process manager for effects that need it
    if (hasPostEffects) {
      this.postProcessManager.setDepthTexture(this.depthTexture.createView())
    }

    // Main pass
    const mainPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: mainRenderTarget,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })

    // Update sky uniforms with environment settings
    const { sky } = this.environmentSettings
    this.skyUniformData.set([sky.zenithColor[0], sky.zenithColor[1], sky.zenithColor[2], 1.0], 0)
    this.skyUniformData.set([sky.horizonColor[0], sky.horizonColor[1], sky.horizonColor[2], 1.0], 4)
    this.skyUniformData.set([sky.groundColor[0], sky.groundColor[1], sky.groundColor[2], 1.0], 8)
    this.device.queue.writeBuffer(this.skyUniformBuffer, 0, this.skyUniformData)

    // Draw sky gradient first
    mainPass.setPipeline(this.skyPipeline)
    mainPass.setBindGroup(0, this.skyBindGroup)
    mainPass.draw(3) // Fullscreen triangle

    // Draw grid
    this.gridUniformData.set(viewProj, 0)
    this.gridUniformData.set(camera.position, 16)
    this.device.queue.writeBuffer(this.gridUniformBuffer, 0, this.gridUniformData)
    mainPass.setPipeline(this.gridPipeline)
    mainPass.setBindGroup(0, this.gridBindGroup)
    mainPass.draw(6) // Two triangles for the quad

    // Draw non-water instances (voxel cubes)
    mainPass.setPipeline(this.mainPipeline)
    mainPass.setBindGroup(0, this.mainBindGroup)
    mainPass.setVertexBuffer(0, this.vertexBuffer)
    mainPass.setIndexBuffer(this.indexBuffer, 'uint16')
    mainPass.drawIndexed(36, scene.getNonWaterInstanceCount())

    // Draw smooth polygon glyphs (buffers already uploaded before shadow pass)
    if (hasGlyphs && this.glyphIndexCount > 0) {
      mainPass.setPipeline(this.glyphPipeline)
      mainPass.setBindGroup(0, this.glyphBindGroup)
      mainPass.setVertexBuffer(0, this.glyphVertexBuffer)
      mainPass.setIndexBuffer(this.glyphIndexBuffer, 'uint32')
      mainPass.drawIndexed(this.glyphIndexCount)
    }

    // Draw water instances
    if (scene.getWaterInstanceCount() > 0) {
      mainPass.setPipeline(this.waterPipeline)
      mainPass.setBindGroup(0, this.waterBindGroup)
      mainPass.drawIndexed(36, scene.getWaterInstanceCount(), 0, 0, scene.getNonWaterInstanceCount())
    }

    mainPass.end()

    // Execute post-processing chain
    if (hasPostEffects) {
      const canvasView = this.context.getCurrentTexture().createView()
      this.postProcessManager.execute(commandEncoder, canvasView, scene.time)
    }

    this.device.queue.submit([commandEncoder.finish()])
  }

  // Render gizmo for a selected node
  renderGizmo(
    camera: Camera,
    mode: GizmoMode,
    position: [number, number, number],
    hoveredAxis: GizmoAxis
  ) {
    if (!this.initialized) return
    if (mode === 'select') {
      // In select mode, we now show move gizmo from the viewport
      // This check should not be hit if viewport correctly maps select -> move
      console.warn('[Gizmo] renderGizmo called with select mode, skipping')
      return
    }

    const viewProj = this.multiplyMatrices(
      camera.getProjectionMatrix(this.width / this.height),
      camera.getViewMatrix()
    )

    // Calculate screen-constant scale based on distance from camera
    const dx = position[0] - camera.position[0]
    const dy = position[1] - camera.position[1]
    const dz = position[2] - camera.position[2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const gizmoScale = distance * 0.15 // Constant screen size

    // Get gizmo geometry for current mode and hover state
    const geometries = GizmoGeometry.createGizmoGeometry(mode, hoveredAxis)

    // Combine all axis geometries
    let totalVertices: number[] = []
    let totalIndices: number[] = []
    let vertexOffset = 0

    geometries.forEach((geom) => {
      for (let i = 0; i < geom.vertices.length; i++) {
        totalVertices.push(geom.vertices[i])
      }
      for (let i = 0; i < geom.indices.length; i++) {
        totalIndices.push(geom.indices[i] + vertexOffset)
      }
      vertexOffset += geom.vertices.length / 7
    })

    if (totalIndices.length === 0) {
      console.warn('[Gizmo] No geometry generated for mode:', mode)
      return
    }

    // Debug: log once when gizmo is rendered
    if (!this._gizmoDebugLogged) {
      console.log('[Gizmo] Rendering gizmo:', {
        mode,
        position,
        scale: gizmoScale,
        vertices: totalVertices.length / 7,
        indices: totalIndices.length
      })
      this._gizmoDebugLogged = true
    }

    // Update buffers
    const vertexData = new Float32Array(totalVertices)
    const indexData = new Uint16Array(totalIndices)

    this.device.queue.writeBuffer(this.gizmoVertexBuffer, 0, vertexData)
    this.device.queue.writeBuffer(this.gizmoIndexBuffer, 0, indexData)

    // Update uniforms
    this.gizmoUniformData.set(viewProj, 0)
    this.gizmoUniformData[16] = position[0]
    this.gizmoUniformData[17] = position[1]
    this.gizmoUniformData[18] = position[2]
    this.gizmoUniformData[19] = gizmoScale
    this.device.queue.writeBuffer(this.gizmoUniformBuffer, 0, this.gizmoUniformData)

    // Render
    const commandEncoder = this.device.createCommandEncoder()
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'load', // Don't clear, draw on top
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthLoadOp: 'load',
        depthStoreOp: 'store',
      },
    })

    pass.setPipeline(this.gizmoPipeline)
    pass.setBindGroup(0, this.gizmoBindGroup)
    pass.setVertexBuffer(0, this.gizmoVertexBuffer)
    pass.setIndexBuffer(this.gizmoIndexBuffer, 'uint16')
    pass.drawIndexed(indexData.length)
    pass.end()

    this.device.queue.submit([commandEncoder.finish()])
  }

  // Render wireframe bounds for selected objects
  renderSelectionBounds(
    camera: Camera,
    bounds: Array<{
      position: [number, number, number]
      scale: [number, number, number]
      color?: [number, number, number, number]
    }>
  ) {
    if (!this.initialized || bounds.length === 0) return

    // Always refresh wireframe geometry to avoid any caching issues
    const wireBox = GizmoGeometry.createWireframeBox()
    this.device.queue.writeBuffer(this.wireframeVertexBuffer, 0, wireBox.vertices)
    this.device.queue.writeBuffer(this.wireframeIndexBuffer, 0, wireBox.indices)

    const viewProj = this.multiplyMatrices(
      camera.getProjectionMatrix(this.width / this.height),
      camera.getViewMatrix()
    )

    const commandEncoder = this.device.createCommandEncoder()
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'load',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthLoadOp: 'load',
        depthStoreOp: 'store',
      },
    })

    pass.setPipeline(this.wireframePipeline)
    pass.setVertexBuffer(0, this.wireframeVertexBuffer)
    pass.setIndexBuffer(this.wireframeIndexBuffer, 'uint16')

    // Render each bound
    for (const bound of bounds) {
      const color = bound.color || [0.2, 0.8, 1.0, 1.0]

      // Build model matrix (scale and translate)
      const modelMatrix = new Float32Array(16)
      // Column-major identity with scale and translation
      modelMatrix[0] = bound.scale[0]
      modelMatrix[5] = bound.scale[1]
      modelMatrix[10] = bound.scale[2]
      modelMatrix[12] = bound.position[0]
      modelMatrix[13] = bound.position[1]
      modelMatrix[14] = bound.position[2]
      modelMatrix[15] = 1

      // Update wireframe uniform buffer
      const uniformData = new Float32Array(36) // viewProj(16) + model(16) + color(4)
      uniformData.set(viewProj, 0)
      uniformData.set(modelMatrix, 16)
      uniformData.set(color, 32)
      this.device.queue.writeBuffer(this.wireframeUniformBuffer, 0, uniformData)

      pass.setBindGroup(0, this.wireframeBindGroup)
      pass.drawIndexed(24) // 12 edges * 2 vertices
    }

    pass.end()
    this.device.queue.submit([commandEncoder.finish()])
  }

  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] =
          a[0 * 4 + j] * b[i * 4 + 0] +
          a[1 * 4 + j] * b[i * 4 + 1] +
          a[2 * 4 + j] * b[i * 4 + 2] +
          a[3 * 4 + j] * b[i * 4 + 3]
      }
    }
    return result
  }

  private normalize(v: [number, number, number]): [number, number, number] {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return [v[0] / len, v[1] / len, v[2] / len]
  }

  destroy() {
    this.vertexBuffer?.destroy()
    this.indexBuffer?.destroy()
    this.instanceBuffer?.destroy()
    this.uniformBuffer?.destroy()
    this.gridUniformBuffer?.destroy()
    this.skyUniformBuffer?.destroy()
    this.gizmoUniformBuffer?.destroy()
    this.gizmoVertexBuffer?.destroy()
    this.gizmoIndexBuffer?.destroy()
    this.wireframeUniformBuffer?.destroy()
    this.wireframeVertexBuffer?.destroy()
    this.wireframeIndexBuffer?.destroy()
    this.depthTexture?.destroy()
    this.shadowMap?.destroy()
    this.reflectionTexture?.destroy()
    this.reflectionDepth?.destroy()

    // VSM resources
    this.vsmShadowMap?.destroy()
    this.vsmBlurTemp?.destroy()
    this.vsmDepthTexture?.destroy()
    this.vsmBlurUniformBuffer?.destroy()

    // Destroy post-processing
    this.postProcessManager?.destroy()

    // Clear geometry cache
    this.gizmoGeometryCache.forEach(({ vertices, indices }) => {
      vertices.destroy()
      indices.destroy()
    })
    this.gizmoGeometryCache.clear()
  }

  /**
   * Enable or disable post-processing.
   */
  setPostProcessEnabled(enabled: boolean): void {
    this.postProcessEnabled = enabled
  }

  /**
   * Update shadow settings from UI
   */
  updateShadowSettings(settings: Partial<typeof this.shadowSettings>): void {
    Object.assign(this.shadowSettings, settings)
    // If resolution changed, we'd need to recreate shadow map (deferred for now)
  }

  /**
   * Update reflection settings from UI
   */
  updateReflectionSettings(settings: Partial<typeof this.reflectionSettings>): void {
    Object.assign(this.reflectionSettings, settings)
  }

  /**
   * Get current shadow settings (for reading in viewport)
   */
  getShadowSettings() {
    return this.shadowSettings
  }

  /**
   * Get current reflection settings (for reading in viewport)
   */
  getReflectionSettings() {
    return this.reflectionSettings
  }

  /**
   * Update lighting settings from UI
   */
  updateLightingSettings(settings: {
    sun?: Partial<typeof this.lightingSettings.sun>
    ambient?: Partial<typeof this.lightingSettings.ambient>
    fill?: Partial<typeof this.lightingSettings.fill>
  }): void {
    if (settings.sun) Object.assign(this.lightingSettings.sun, settings.sun)
    if (settings.ambient) Object.assign(this.lightingSettings.ambient, settings.ambient)
    if (settings.fill) Object.assign(this.lightingSettings.fill, settings.fill)
  }

  /**
   * Update environment settings from UI
   */
  updateEnvironmentSettings(settings: {
    sky?: Partial<typeof this.environmentSettings.sky>
  }): void {
    if (settings.sky) Object.assign(this.environmentSettings.sky, settings.sky)
  }

  /**
   * Get current lighting settings
   */
  getLightingSettings() {
    return this.lightingSettings
  }

  /**
   * Get current environment settings
   */
  getEnvironmentSettings() {
    return this.environmentSettings
  }
}
