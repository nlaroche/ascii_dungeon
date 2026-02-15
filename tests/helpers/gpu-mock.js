/**
 * WebGPU mock for unit testing renderer modules.
 * Provides a minimal mock of the WebGPU API surface used by our renderer.
 */

export function createMockDevice() {
  const buffers = [];
  const textures = [];

  const device = {
    createBuffer(desc) {
      const buf = {
        size: desc.size,
        usage: desc.usage,
        _data: new ArrayBuffer(desc.size),
        mapState: 'unmapped',
        destroy() {},
      };
      buffers.push(buf);
      return buf;
    },

    createTexture(desc) {
      const tex = {
        size: desc.size,
        format: desc.format,
        usage: desc.usage,
        createView() {
          return { _texture: tex, label: 'mock-view' };
        },
        destroy() {},
      };
      textures.push(tex);
      return tex;
    },

    createSampler(desc) {
      return { ...desc, _type: 'sampler' };
    },

    createShaderModule(desc) {
      return { code: desc.code, _type: 'shader-module' };
    },

    createRenderPipeline(desc) {
      return {
        getBindGroupLayout(index) {
          return { _index: index, _type: 'bind-group-layout' };
        },
        _type: 'render-pipeline',
      };
    },

    createComputePipeline(desc) {
      return {
        getBindGroupLayout(index) {
          return { _index: index, _type: 'bind-group-layout' };
        },
        _type: 'compute-pipeline',
      };
    },

    createBindGroup(desc) {
      return { layout: desc.layout, entries: desc.entries, _type: 'bind-group' };
    },

    createBindGroupLayout(desc) {
      return { entries: desc.entries, _type: 'bind-group-layout' };
    },

    createPipelineLayout(desc) {
      return { bindGroupLayouts: desc.bindGroupLayouts, _type: 'pipeline-layout' };
    },

    createCommandEncoder() {
      const commands = [];
      return {
        beginRenderPass(desc) {
          const drawCalls = [];
          return {
            setPipeline(p) { drawCalls.push({ type: 'setPipeline', pipeline: p }); },
            setBindGroup(i, bg) { drawCalls.push({ type: 'setBindGroup', index: i, bindGroup: bg }); },
            draw(count, instances) { drawCalls.push({ type: 'draw', count, instances }); },
            end() { commands.push({ type: 'renderPass', drawCalls }); },
          };
        },
        beginComputePass() {
          const dispatches = [];
          return {
            setPipeline(p) { dispatches.push({ type: 'setPipeline', pipeline: p }); },
            setBindGroup(i, bg) { dispatches.push({ type: 'setBindGroup', index: i, bindGroup: bg }); },
            dispatchWorkgroups(x, y, z) { dispatches.push({ type: 'dispatch', x, y, z }); },
            end() { commands.push({ type: 'computePass', dispatches }); },
          };
        },
        finish() { return { commands }; },
      };
    },

    queue: {
      writeBuffer(buffer, offset, data) {
        const src = data instanceof ArrayBuffer ? data : data.buffer;
        new Uint8Array(buffer._data).set(new Uint8Array(src, data.byteOffset || 0, data.byteLength || src.byteLength), offset);
      },
      copyExternalImageToTexture(src, dst, size) {},
      submit(commandBuffers) {},
    },

    _buffers: buffers,
    _textures: textures,
  };

  return device;
}

export function createMockCanvas(width = 1024, height = 512) {
  return {
    width,
    height,
    getContext(type) {
      if (type === 'webgpu') {
        return {
          configure(config) {},
          getCurrentTexture() {
            return {
              createView() { return { _type: 'swapchain-view' }; },
            };
          },
        };
      }
      if (type === '2d') {
        return {
          fillStyle: '',
          font: '',
          textBaseline: '',
          fillRect() {},
          fillText() {},
          clearRect() {},
          getImageData(x, y, w, h) {
            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
          },
          putImageData() {},
          measureText(text) {
            return { width: text.length * 10 };
          },
        };
      }
      return null;
    },
  };
}
