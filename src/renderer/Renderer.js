import { createSDFAtlas } from './SDFAtlas.js';
import { createTilemapRenderer, colorToU32, CELL_FLAGS } from './TilemapRenderer.js';

export { colorToU32, CELL_FLAGS } from './TilemapRenderer.js';

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

    this.atlas = createSDFAtlas(this.device, 'monospace', 96);
    this.tilemap = createTilemapRenderer(
      this.device,
      this.format,
      this.atlas.texture,
      this.gridWidth,
      this.gridHeight
    );
    
    this.setupResize();
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth * window.devicePixelRatio;
      this.canvas.height = window.innerHeight * window.devicePixelRatio;
    });
  }

  setCell(x, y, char, fgColor, bgColor, depth = 0, flags = 0) {
    const charCode = typeof char === 'string' ? char.charCodeAt(0) : char;
    const fg = colorToU32(fgColor);
    const bg = colorToU32(bgColor);
    this.tilemap.setTile(x, y, charCode, fg, bg, depth, flags);
  }

  setCells(cellArray) {
    for (const cell of cellArray) {
      this.setCell(cell.x, cell.y, cell.char, cell.fg, cell.bg, cell.depth, cell.flags);
    }
  }

  clearGrid() {
    this.tilemap.clearGrid();
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
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    this.tilemap.upload(this.device);
    this.tilemap.render(
      commandEncoder,
      textureView,
      this.canvas.width,
      this.canvas.height,
      this.time,
      this.cellSize,
      this.cellSize * 1.5
    );

    this.device.queue.submit([commandEncoder.finish()]);
  }

  addEffect(type, x, y, options = {}) {
    // TODO: Register particle/glow/effect
  }
}
