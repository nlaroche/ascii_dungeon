import { createSDFAtlas } from './SDFAtlas.js';
import { createTilemapRenderer, colorToU32, CELL_FLAGS, LAYER_COUNT, LAYERS, LIGHT_SUB } from './TilemapRenderer.js';

export { colorToU32, CELL_FLAGS, LAYER_COUNT, LAYERS, LIGHT_SUB } from './TilemapRenderer.js';

export class Renderer {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.gridWidth = config.gridWidth || 80;
    this.gridHeight = config.gridHeight || 50;
    this.cellSize = config.cellSize || 12;
    
    this.device = null;
    this.context = null;
    this.format = null;
    this.time = 0;
    this.atlas = null;
    this.tilemap = null;
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.parallaxStrength = 0.3;
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

    this.resizeCanvas();

    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    });

    this.atlas = createSDFAtlas(this.device, 'Consolas, "Courier New", monospace', 96);
    this.tilemap = createTilemapRenderer(
      this.device,
      this.format,
      this.atlas.texture,
      this.gridWidth,
      this.gridHeight
    );
    
    this.setupResize();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    if (parent) {
      this.canvas.width = parent.clientWidth * dpr;
      this.canvas.height = parent.clientHeight * dpr;
    } else {
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
    }
  }

  setupResize() {
    const observer = new ResizeObserver(() => this.resizeCanvas());
    observer.observe(this.canvas.parentElement || this.canvas);
  }

  setCell(x, y, char, fgColor, bgColor, depth = 0, flags = 0, light = 1.0, offsetX = 0, offsetY = 0, layer = 0) {
    const charCode = typeof char === 'string' ? char.charCodeAt(0) : char;
    const fg = colorToU32(fgColor);
    const bg = colorToU32(bgColor);
    this.tilemap.setTile(layer, x, y, charCode, fg, bg, depth, flags, light, offsetX, offsetY);
  }

  setCells(cellArray) {
    for (const cell of cellArray) {
      this.setCell(cell.x, cell.y, cell.char, cell.fg, cell.bg, cell.depth, cell.flags, cell.light, cell.offsetX, cell.offsetY, cell.layer);
    }
  }

  clearGrid() {
    this.tilemap.clearGrid();
  }

  clearLayer(layer) {
    this.tilemap.clearLayer(layer);
  }

  get lightMapWidth() {
    return this.tilemap.lightMapWidth;
  }

  get lightMapHeight() {
    return this.tilemap.lightMapHeight;
  }

  setLightTexel(x, y, r, g, b) {
    this.tilemap.setLightTexel(x, y, r, g, b);
  }

  clearLightMap() {
    this.tilemap.clearLightMap();
  }

  startLoop() {
    const render = () => {
      this.time += 0.016;
      this.render();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  render() {
    this.tilemap.parallaxStrength = this.parallaxStrength;

    const dpr = window.devicePixelRatio || 1;
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    this.tilemap.upload(this.device);
    this.tilemap.uploadLightMap(this.device);
    this.tilemap.render(
      commandEncoder,
      textureView,
      this.canvas.width,
      this.canvas.height,
      this.time,
      this.cellSize * dpr,
      this.cellSize * 1.5 * dpr,
      this.cameraOffsetX * dpr,
      this.cameraOffsetY * dpr
    );

    this.device.queue.submit([commandEncoder.finish()]);

    if (!this._ready) {
      this._ready = true;
      this.canvas.dataset.ready = '1';
    }
  }

  addEffect(type, x, y, options = {}) {
    // TODO: Register particle/glow/effect
  }
}
