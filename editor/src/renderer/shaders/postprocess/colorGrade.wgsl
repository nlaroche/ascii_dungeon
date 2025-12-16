// ═══════════════════════════════════════════════════════════════════════════
// Color Grading Post-Processing Effect
// Exposure, contrast, saturation, and tonemapping
// ═══════════════════════════════════════════════════════════════════════════

struct ColorGradeParams {
  exposure: f32,      // EV adjustment (-3 to +3, 0 = no change)
  contrast: f32,      // 1.0 = no change
  saturation: f32,    // 1.0 = no change
  tonemapping: u32,   // 0=none, 1=reinhard, 2=aces, 3=filmic
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: ColorGradeParams;

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

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

// Tonemapping functions
fn tonemapReinhard(color: vec3f) -> vec3f {
  return color / (color + vec3f(1.0));
}

fn tonemapACES(color: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return saturate((color * (a * color + b)) / (color * (c * color + d) + e));
}

fn tonemapFilmic(color: vec3f) -> vec3f {
  let x = max(vec3f(0.0), color - vec3f(0.004));
  return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  var color = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Exposure (EV adjustment: 0 = no change, +1 = 2x brighter, -1 = 2x darker)
  color *= pow(2.0, params.exposure);

  // Contrast (1.0 = no change, expand/compress around mid-gray)
  color = (color - vec3f(0.5)) * params.contrast + vec3f(0.5);
  color = max(color, vec3f(0.0));

  // Saturation (1.0 = no change)
  let lum = luminance(color);
  color = mix(vec3f(lum), color, params.saturation);

  // Tonemapping (only apply if HDR values present)
  switch (params.tonemapping) {
    case 1u: { color = tonemapReinhard(color); }
    case 2u: { color = tonemapACES(color); }
    case 3u: { color = tonemapFilmic(color); }
    default: {}
  }

  return vec4f(saturate(color), 1.0);
}
