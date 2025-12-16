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

  // Uniforms
  private uniformBuffer!: GPUBuffer
  private uniformData = new Float32Array(48) // viewProj(16) + lightViewProj(16) + misc(16)

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
  private glyphVertexBuffer!: GPUBuffer
  private glyphIndexBuffer!: GPUBuffer
  private glyphBindGroup!: GPUBindGroup
  private glyphIndexCount = 0

  // Samplers
  private shadowSampler!: GPUSampler
  private reflectionSampler!: GPUSampler

  // Post-processing
  private postProcessManager!: PostProcessManager
  private postProcessEnabled = true

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
  }

  private createSamplers() {
    this.shadowSampler = this.device.createSampler({
      compare: 'less',
      magFilter: 'linear',
      minFilter: 'linear',
    })

    this.reflectionSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
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
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth32float',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
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

    // Update uniforms
    const viewProj = this.multiplyMatrices(
      camera.getProjectionMatrix(this.width / this.height),
      camera.getViewMatrix()
    )
    const lightDir: [number, number, number] = [-0.5, -1, -0.3]
    const lightViewProj = camera.getLightViewProjection(lightDir)

    this.uniformData.set(viewProj, 0)
    this.uniformData.set(lightViewProj, 16)
    this.uniformData.set(camera.position, 32)
    this.uniformData[35] = scene.time
    this.uniformData.set(this.normalize(lightDir), 36)
    this.uniformData[39] = 0.3 // ambient strength
    this.uniformData.set([1.0, 0.95, 0.9], 40) // warm sunlight
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)

    const commandEncoder = this.device.createCommandEncoder()

    // Shadow pass
    const shadowPass = commandEncoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowMap.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
    shadowPass.setPipeline(this.shadowPipeline)
    shadowPass.setBindGroup(0, this.shadowBindGroup)
    shadowPass.setVertexBuffer(0, this.vertexBuffer)
    shadowPass.setIndexBuffer(this.indexBuffer, 'uint16')
    shadowPass.drawIndexed(36, this.instanceCount)
    shadowPass.end()

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

    // Draw sky gradient first
    mainPass.setPipeline(this.skyPipeline)
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

    // Draw smooth polygon glyphs
    if (scene.hasGlyphs()) {
      const glyphVertexData = scene.getGlyphVertexData()
      const glyphIndexData = scene.getGlyphIndexData()
      this.glyphIndexCount = scene.getGlyphIndexCount()

      // Update glyph buffers
      this.device.queue.writeBuffer(this.glyphVertexBuffer, 0, glyphVertexData.buffer, glyphVertexData.byteOffset, glyphVertexData.byteLength)
      this.device.queue.writeBuffer(this.glyphIndexBuffer, 0, glyphIndexData.buffer, glyphIndexData.byteOffset, glyphIndexData.byteLength)

      // Draw glyphs
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
}
