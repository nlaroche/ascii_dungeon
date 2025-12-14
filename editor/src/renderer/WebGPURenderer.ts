// WebGPU Renderer - Core rendering class

import { Camera } from './Camera'
import { Scene } from './Scene'
import { INSTANCE_BYTES } from './types'
import voxelShaderCode from './shaders/voxel.wgsl?raw'
import waterShaderCode from './shaders/water.wgsl?raw'

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

  // Textures
  private depthTexture!: GPUTexture
  private shadowMap!: GPUTexture
  private reflectionTexture!: GPUTexture
  private reflectionDepth!: GPUTexture

  // Bind groups
  private mainBindGroup!: GPUBindGroup
  private shadowBindGroup!: GPUBindGroup
  private waterBindGroup!: GPUBindGroup

  // Samplers
  private shadowSampler!: GPUSampler
  private reflectionSampler!: GPUSampler

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

    // Create textures
    this.createTextures()

    // Create samplers
    this.createSamplers()

    // Create pipelines
    await this.createPipelines()

    // Create bind groups
    this.createBindGroups()

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
    // Depth texture for main pass
    this.depthTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
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
      format: 'depth24plus',
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
        format: 'depth24plus',
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
        format: 'depth24plus',
        depthWriteEnabled: false, // Water doesn't write depth
        depthCompare: 'less',
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
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })

    this.reflectionTexture = this.device.createTexture({
      size: [width, height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    this.reflectionDepth = this.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
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
      console.log('  Camera target:', camera.target)
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

    // Main pass
    const mainPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.4, g: 0.6, b: 0.9, a: 1.0 }, // Sky blue
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

    // Draw non-water instances
    mainPass.setPipeline(this.mainPipeline)
    mainPass.setBindGroup(0, this.mainBindGroup)
    mainPass.setVertexBuffer(0, this.vertexBuffer)
    mainPass.setIndexBuffer(this.indexBuffer, 'uint16')
    mainPass.drawIndexed(36, scene.getNonWaterInstanceCount())

    // Draw water instances
    if (scene.getWaterInstanceCount() > 0) {
      mainPass.setPipeline(this.waterPipeline)
      mainPass.setBindGroup(0, this.waterBindGroup)
      mainPass.drawIndexed(36, scene.getWaterInstanceCount(), 0, 0, scene.getNonWaterInstanceCount())
    }

    mainPass.end()

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
    this.depthTexture?.destroy()
    this.shadowMap?.destroy()
    this.reflectionTexture?.destroy()
    this.reflectionDepth?.destroy()
  }
}
