// ═══════════════════════════════════════════════════════════════════════════
// Vignette Post-Processing Effect
// Darkens the edges of the screen
// ═══════════════════════════════════════════════════════════════════════════

struct VignetteParams {
  intensity: f32,
  smoothness: f32,
  roundness: f32,
  _pad: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: VignetteParams;

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
  let color = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Calculate distance from center
  let uv = input.uv * 2.0 - 1.0;

  // Adjust for aspect ratio (get texture dimensions)
  let texSize = vec2f(textureDimensions(inputTexture));
  let aspect = texSize.x / texSize.y;
  let uvAspect = vec2f(uv.x * aspect, uv.y);

  // Calculate vignette
  let dist = length(uvAspect) * params.roundness;
  let vignette = smoothstep(1.0 - params.smoothness, 1.0, dist);

  // Apply vignette
  let vignetteColor = color * (1.0 - vignette * params.intensity);

  return vec4f(vignetteColor, 1.0);
}
