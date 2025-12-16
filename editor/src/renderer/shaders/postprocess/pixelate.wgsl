// ═══════════════════════════════════════════════════════════════════════════
// Pixelate Post-Processing Effect
// Retro-style downsampling effect
// ═══════════════════════════════════════════════════════════════════════════

struct PixelateParams {
  pixelSize: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: PixelateParams;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  // Fullscreen triangle: vertices at (-1,-1), (3,-1), (-1,3)
  let x = f32((vertexIndex << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vertexIndex & 2u) * 2.0 - 1.0;
  output.position = vec4f(x, y, 0.0, 1.0);
  output.uv = vec2f((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texSize = vec2f(textureDimensions(inputTexture));

  // Calculate pixel-aligned UV
  let pixelatedResolution = texSize / params.pixelSize;
  let pixelatedUV = floor(input.uv * pixelatedResolution) / pixelatedResolution;

  // Sample at pixelated position
  let color = textureSample(inputTexture, inputSampler, pixelatedUV);

  return color;
}
