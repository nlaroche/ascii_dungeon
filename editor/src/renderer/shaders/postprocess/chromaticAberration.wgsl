// ═══════════════════════════════════════════════════════════════════════════
// Chromatic Aberration Post-Processing Effect
// RGB channel separation towards screen edges
// ═══════════════════════════════════════════════════════════════════════════

struct ChromaticAberrationParams {
  intensity: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: ChromaticAberrationParams;

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
  // Calculate offset direction (from center)
  let center = vec2f(0.5);
  let dir = input.uv - center;
  let dist = length(dir);

  // Scale offset by distance from center (more aberration at edges)
  let offset = dir * params.intensity * dist;

  // Sample each channel with different offsets
  let r = textureSample(inputTexture, inputSampler, input.uv + offset).r;
  let g = textureSample(inputTexture, inputSampler, input.uv).g;
  let b = textureSample(inputTexture, inputSampler, input.uv - offset).b;

  return vec4f(r, g, b, 1.0);
}
