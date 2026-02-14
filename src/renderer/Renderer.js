/**
 * WebGPU Renderer for ASCII Dungeon
 * Handles all GPU operations, text rendering with shaders
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.format = null;
    this.uniformBuffer = null;
    this.time = 0;
    this.charTexture = null;
    this.textPipeline = null;
    this.textBuffer = null;
    this.lastAscii = '';
    this.textTexture = null;
  }

  async init() {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported in this browser');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }

    this.device = await adapter.requestDevice();
    
    this.canvas.width = window.innerWidth * window.devicePixelRatio;
    this.canvas.height = window.innerHeight * window.devicePixelRatio;

    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    });

    await this.createResources();
    this.setupResize();
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth * window.devicePixelRatio;
      this.canvas.height = window.innerHeight * window.devicePixelRatio;
    });
  }

  async createResources() {
    // Create uniform buffer for time/resolution
    this.uniformBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create ASCII texture for text rendering (using canvas 2d as intermediate)
    this.createTextTexture();
    
    // Create render pipeline
    await this.createRenderPipeline();
  }

  createTextTexture() {
    // Create a 2D canvas to render text, then upload as texture
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 512;
    this.textCtx = this.textCanvas.getContext('2d');
    
    // Draw default ASCII charset
    this.textCtx.fillStyle = '#000000';
    this.textCtx.fillRect(0, 0, 1024, 512);
    this.textCtx.font = '24px monospace';
    this.textCtx.fillStyle = '#ffffff';
    this.textCtx.textBaseline = 'top';
    
    // Draw ASCII characters 32-126
    let charX = 0;
    let charY = 0;
    for (let i = 32; i < 127; i++) {
      const char = String.fromCharCode(i);
      this.textCtx.fillText(char, charX * 20 + 4, charY * 28 + 4);
      charX++;
      if (charX >= 20) {
        charX = 0;
        charY++;
      }
    }
    
    // Upload to GPU
    this.textTexture = this.device.createTexture({
      size: [1024, 512],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    this.device.queue.copyExternalImageToTexture(
      { source: this.textCanvas },
      { texture: this.textTexture },
      [1024, 512]
    );
  }

  async createRenderPipeline() {
    // Simple fullscreen quad shader
    const shaderCode = `
      struct Uniforms {
        resolution: vec2<f32>,
        time: f32,
        padding: vec2<f32>,
      };
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var myTexture: texture_2d<f32>;
      @group(0) @binding(2) var mySampler: sampler;
      
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      };
      
      @vertex
      fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var positions = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(1.0, 1.0)
        );
        
        var output: VertexOutput;
        output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
        output.uv = positions[vertexIndex] * 0.5 + 0.5;
        output.uv.y = 1.0 - output.uv.y;
        return output;
      }
      
      @fragment
      fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        var color = textureSample(myTexture, mySampler, uv);
        
        // Add scanline effect
        let scanline = sin(uv.y * uniforms.resolution.y * 1.5) * 0.04;
        color.rgb = color.rgb - scanline;
        
        // Add subtle glow/vignette
        let center = vec2<f32>(0.5, 0.5);
        let dist = distance(uv, center);
        let vignette = 1.0 - dist * 0.5;
        color.rgb = color.rgb * vignette;
        
        // CRT curvature (subtle)
        let offset = (uv - 0.5) * 0.02;
        color.rgb = color.rgb + offset.x;
        
        return color;
      }
    `;

    const shaderModule = this.device.createShaderModule({
      code: shaderCode
    });

    const sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest'
    });

    this.textPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });

    this.textBindGroup = this.device.createBindGroup({
      layout: this.textPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.textTexture.createView() },
        { binding: 2, resource: sampler }
      ]
    });
  }

  startLoop() {
    const render = () => {
      this.time += 0.016;
      this.render();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  drawText(ascii, x, y, color) {
    // Store text to render this frame
    this.pendingText = { ascii, x, y, color };
  }

  render() {
    // Update uniforms
    const uniformData = new Float32Array([
      this.canvas.width, this.canvas.height, this.time, 0
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Render text to 2D canvas, then copy to texture
    this.renderTextToTexture();

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.02, g: 0.02, b: 0.04, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.textPipeline);
    renderPass.setBindGroup(0, this.textBindGroup);
    renderPass.draw(6);
    
    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  renderTextToTexture() {
    if (!this.pendingText) return;
    
    const { ascii, color } = this.pendingText;
    
    // Clear and draw to 2D canvas
    this.textCtx.fillStyle = '#000000';
    this.textCtx.fillRect(0, 0, 1024, 512);
    
    // Draw the ASCII text
    this.textCtx.fillStyle = color;
    this.textCtx.font = '20px monospace';
    this.textCtx.textBaseline = 'top';
    
    const lines = ascii.split('\n');
    lines.forEach((line, i) => {
      this.textCtx.fillText(line, 10, i * 24 + 10);
    });
    
    // Upload to GPU texture
    this.device.queue.copyExternalImageToTexture(
      { source: this.textCanvas },
      { texture: this.textTexture },
      [1024, 512]
    );
    
    this.pendingText = null;
  }

  addEffect(type, x, y, options = {}) {
    // TODO: Register particle/glow/effect
  }
}
