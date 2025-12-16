// ═══════════════════════════════════════════════════════════════════════════
// Sharpen Post-Processing Effect
// Unsharp mask sharpening
// ═══════════════════════════════════════════════════════════════════════════

struct SharpenParams {
  intensity: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: SharpenParams;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertexIndex << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vertexIndex & 2u) * 2.0 - 1.0;
  output.position = vec4f(x, y, 0.0, 1.0);
  output.uv = vec2f((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texSize = vec2f(textureDimensions(inputTexture));
  let texelSize = 1.0 / texSize;

  // Sample center and neighbors (3x3 kernel)
  let center = textureSample(inputTexture, inputSampler, input.uv).rgb;

  let n = textureSample(inputTexture, inputSampler, input.uv + vec2f(0.0, -texelSize.y)).rgb;
  let s = textureSample(inputTexture, inputSampler, input.uv + vec2f(0.0, texelSize.y)).rgb;
  let e = textureSample(inputTexture, inputSampler, input.uv + vec2f(texelSize.x, 0.0)).rgb;
  let w = textureSample(inputTexture, inputSampler, input.uv + vec2f(-texelSize.x, 0.0)).rgb;

  // Laplacian edge detection (simplified unsharp mask)
  let laplacian = 4.0 * center - n - s - e - w;

  // Add sharpening
  let sharpened = center + laplacian * params.intensity;

  return vec4f(saturate(sharpened), 1.0);
}
