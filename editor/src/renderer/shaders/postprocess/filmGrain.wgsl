// ═══════════════════════════════════════════════════════════════════════════
// Film Grain Post-Processing Effect
// Adds cinematic noise overlay
// ═══════════════════════════════════════════════════════════════════════════

struct FilmGrainParams {
  intensity: f32,
  time: f32,
  luminanceInfluence: f32,
  _pad: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: FilmGrainParams;

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

// Hash function for noise
fn hash12(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Generate noise based on screen position and time
  let texSize = vec2f(textureDimensions(inputTexture));
  let screenPos = input.uv * texSize;

  // Animated noise
  let noise = hash12(screenPos + vec2f(params.time * 1000.0)) - 0.5;

  // Calculate luminance-based intensity (more grain in darker areas)
  let lum = luminance(color);
  let luminanceWeight = mix(1.0, 1.0 - lum, params.luminanceInfluence);

  // Apply grain
  let grainAmount = noise * params.intensity * luminanceWeight;
  let result = color + vec3f(grainAmount);

  return vec4f(saturate(result), 1.0);
}
