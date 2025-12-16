// ═══════════════════════════════════════════════════════════════════════════
// Common Post-Processing Utilities
// ═══════════════════════════════════════════════════════════════════════════

// Fullscreen triangle vertex shader
// Generates a fullscreen triangle from vertex ID without any vertex buffer
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_fullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;

  // Generate fullscreen triangle
  let x = f32((vertexIndex & 1u) << 1u) - 1.0;
  let y = f32((vertexIndex & 2u)) - 1.0;

  output.position = vec4f(x, -y, 0.0, 1.0);
  output.uv = vec2f((x + 1.0) * 0.5, (y + 1.0) * 0.5);

  return output;
}

// ─────────────────────────────────────────────────────────────────────────────
// Color Space Utilities
// ─────────────────────────────────────────────────────────────────────────────

fn linearToSRGB(linear: vec3f) -> vec3f {
  let cutoff = linear < vec3f(0.0031308);
  let higher = vec3f(1.055) * pow(linear, vec3f(1.0/2.4)) - vec3f(0.055);
  let lower = linear * vec3f(12.92);
  return select(higher, lower, cutoff);
}

fn sRGBToLinear(srgb: vec3f) -> vec3f {
  let cutoff = srgb < vec3f(0.04045);
  let higher = pow((srgb + vec3f(0.055)) / vec3f(1.055), vec3f(2.4));
  let lower = srgb / vec3f(12.92);
  return select(higher, lower, cutoff);
}

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tonemapping Functions (LYGIA-inspired)
// ─────────────────────────────────────────────────────────────────────────────

fn tonemapReinhard(color: vec3f) -> vec3f {
  return color / (color + vec3f(1.0));
}

fn tonemapReinhardExtended(color: vec3f, maxWhite: f32) -> vec3f {
  let numerator = color * (vec3f(1.0) + color / (maxWhite * maxWhite));
  return numerator / (vec3f(1.0) + color);
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

fn tonemapUncharted2(color: vec3f) -> vec3f {
  let A = 0.15;
  let B = 0.50;
  let C = 0.10;
  let D = 0.20;
  let E = 0.02;
  let F = 0.30;
  return ((color * (A * color + C * B) + D * E) / (color * (A * color + B) + D * F)) - E / F;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blur Utilities
// ─────────────────────────────────────────────────────────────────────────────

// 9-tap Gaussian weights (sigma ~1.5)
const GAUSSIAN_WEIGHTS = array<f32, 5>(
  0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216
);

// Box blur sample pattern
fn boxBlur3x3(tex: texture_2d<f32>, samp: sampler, uv: vec2f, texelSize: vec2f) -> vec4f {
  var color = vec4f(0.0);
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      color += textureSample(tex, samp, uv + vec2f(f32(x), f32(y)) * texelSize);
    }
  }
  return color / 9.0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Detection (Sobel)
// ─────────────────────────────────────────────────────────────────────────────

fn sobelEdge(tex: texture_2d<f32>, samp: sampler, uv: vec2f, texelSize: vec2f) -> f32 {
  let tl = luminance(textureSample(tex, samp, uv + vec2f(-1.0, -1.0) * texelSize).rgb);
  let t  = luminance(textureSample(tex, samp, uv + vec2f( 0.0, -1.0) * texelSize).rgb);
  let tr = luminance(textureSample(tex, samp, uv + vec2f( 1.0, -1.0) * texelSize).rgb);
  let l  = luminance(textureSample(tex, samp, uv + vec2f(-1.0,  0.0) * texelSize).rgb);
  let r  = luminance(textureSample(tex, samp, uv + vec2f( 1.0,  0.0) * texelSize).rgb);
  let bl = luminance(textureSample(tex, samp, uv + vec2f(-1.0,  1.0) * texelSize).rgb);
  let b  = luminance(textureSample(tex, samp, uv + vec2f( 0.0,  1.0) * texelSize).rgb);
  let br = luminance(textureSample(tex, samp, uv + vec2f( 1.0,  1.0) * texelSize).rgb);

  let gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  let gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

  return sqrt(gx*gx + gy*gy);
}

// ─────────────────────────────────────────────────────────────────────────────
// Noise Functions
// ─────────────────────────────────────────────────────────────────────────────

fn hash12(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash22(p: vec2f) -> vec2f {
  var p3 = fract(vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Film grain noise
fn filmGrainNoise(uv: vec2f, time: f32, intensity: f32) -> f32 {
  let noise = hash12(uv * 1000.0 + time * 100.0);
  return (noise - 0.5) * intensity;
}
