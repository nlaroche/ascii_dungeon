// ═══════════════════════════════════════════════════════════════════════════
// Bloom Post-Processing Effect
// Single-pass simplified bloom (bright extract + blur + composite)
// ═══════════════════════════════════════════════════════════════════════════

struct BloomParams {
  threshold: f32,
  intensity: f32,
  radius: f32,
  _pad: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: BloomParams;

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

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

// Extract bright pixels with soft threshold
fn brightPass(color: vec3f, threshold: f32) -> vec3f {
  let lum = luminance(color);
  let softness = 0.5;
  let knee = threshold * softness;
  let soft = lum - threshold + knee;
  let contribution = clamp(soft / (2.0 * knee + 0.00001), 0.0, 1.0);
  return color * contribution * contribution;
}

// Gaussian blur weights for 9-tap filter
const OFFSETS = array<f32, 4>(1.0, 2.0, 3.0, 4.0);
const WEIGHTS = array<f32, 4>(0.29, 0.22, 0.12, 0.05);

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texSize = vec2f(textureDimensions(inputTexture));
  let texelSize = 1.0 / texSize;

  // Sample original color
  let originalColor = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Accumulate blurred bright pixels
  var bloomColor = brightPass(originalColor, params.threshold) * 0.16;

  // 9-tap blur in both directions (simplified single-pass)
  for (var i = 0; i < 4; i++) {
    let offset = texelSize * OFFSETS[i] * params.radius;
    let weight = WEIGHTS[i];

    // Sample in 4 directions
    let sample1 = textureSample(inputTexture, inputSampler, input.uv + vec2f(offset.x, 0.0)).rgb;
    let sample2 = textureSample(inputTexture, inputSampler, input.uv - vec2f(offset.x, 0.0)).rgb;
    let sample3 = textureSample(inputTexture, inputSampler, input.uv + vec2f(0.0, offset.y)).rgb;
    let sample4 = textureSample(inputTexture, inputSampler, input.uv - vec2f(0.0, offset.y)).rgb;

    // Extract bright and accumulate
    bloomColor += brightPass(sample1, params.threshold) * weight;
    bloomColor += brightPass(sample2, params.threshold) * weight;
    bloomColor += brightPass(sample3, params.threshold) * weight;
    bloomColor += brightPass(sample4, params.threshold) * weight;
  }

  // Normalize (sum of weights: 0.16 + 4*(0.29+0.22+0.12+0.05) = 0.16 + 4*0.68 = 2.88)
  bloomColor /= 2.88;

  // Add bloom to original
  let result = originalColor + bloomColor * params.intensity;

  return vec4f(result, 1.0);
}
