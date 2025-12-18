// ═══════════════════════════════════════════════════════════════════════════
// ASCII Post-Processing Shader - CRT effects for retro ASCII look
// ═══════════════════════════════════════════════════════════════════════════

struct AsciiPostUniforms {
  resolution: vec2f,
  time: f32,
  scanlines: f32,      // 0-1: scanline intensity
  curvature: f32,      // 0-1: CRT screen curvature
  bloom: f32,          // 0-1: glow/bloom intensity
  noise: f32,          // 0-1: static noise intensity
  chromatic: f32,      // 0-1: chromatic aberration
  flicker: f32,        // 0-1: screen flicker
  vignette: f32,       // 0-1: edge darkening
  pixelate: f32,       // 0-1: pixelation amount
  colorShift: f32,     // 0-1: color palette shift
  _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: AsciiPostUniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertex Shader - Fullscreen triangle
// ─────────────────────────────────────────────────────────────────────────────

@vertex
fn vs_main(@builtin(vertex_index) vertexIdx: u32) -> VertexOutput {
  var output: VertexOutput;

  // Fullscreen triangle
  let x = f32((vertexIdx << 1u) & 2u);
  let y = f32(vertexIdx & 2u);

  output.position = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  output.uv = vec2f(x, 1.0 - y);

  return output;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

fn random(st: vec2f) -> f32 {
  return fract(sin(dot(st, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn hash(p: vec2f) -> f32 {
  let p2 = fract(p * vec2f(443.897, 441.423));
  let p3 = p2 + dot(p2, p2.yx + 19.19);
  return fract((p3.x + p3.y) * p3.x);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fragment Shader
// ─────────────────────────────────────────────────────────────────────────────

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  var uv = input.uv;
  let originalUv = uv;

  // ═══════════════════════════════════════════════════════════════════════════
  // CRT Curvature
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.curvature > 0.0) {
    let center = uv - 0.5;
    let dist = dot(center, center);
    uv = uv + center * dist * uniforms.curvature * 0.5;
  }

  // Check if we're outside the curved screen
  let outsideScreen = uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;

  // ═══════════════════════════════════════════════════════════════════════════
  // Pixelation
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.pixelate > 0.0) {
    let pixelSize = mix(1.0, 8.0, uniforms.pixelate);
    let pixels = uniforms.resolution / pixelSize;
    uv = floor(uv * pixels) / pixels;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Chromatic Aberration
  // ═══════════════════════════════════════════════════════════════════════════

  var col: vec3f;

  if (uniforms.chromatic > 0.0) {
    let offset = uniforms.chromatic * 0.004;
    // Radial chromatic aberration
    let dir = normalize(uv - 0.5);
    col.r = textureSample(inputTexture, inputSampler, uv + dir * offset).r;
    col.g = textureSample(inputTexture, inputSampler, uv).g;
    col.b = textureSample(inputTexture, inputSampler, uv - dir * offset).b;
  } else {
    col = textureSample(inputTexture, inputSampler, uv).rgb;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Bloom / Glow
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.bloom > 0.0) {
    var bloom = vec3f(0.0);
    let samples = 8.0;

    for (var i = 0.0; i < samples; i = i + 1.0) {
      let angle = i * 6.28318 / samples;
      let offset = vec2f(cos(angle), sin(angle)) * 0.01 * uniforms.bloom;
      bloom = bloom + textureSample(inputTexture, inputSampler, uv + offset).rgb;
    }
    bloom = bloom / samples;

    // Add bloom (brighter areas glow more)
    let luminance = dot(col, vec3f(0.299, 0.587, 0.114));
    col = col + bloom * uniforms.bloom * 0.5 * (0.5 + luminance);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Scanlines
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.scanlines > 0.0) {
    let scanY = originalUv.y * uniforms.resolution.y;

    // Primary scanlines
    let scanline = sin(scanY * 3.14159) * 0.5 + 0.5;
    let scanIntensity = 1.0 - uniforms.scanlines * 0.4 * (1.0 - scanline);

    // Secondary finer scanlines
    let fineScan = sin(scanY * 6.28318) * 0.5 + 0.5;
    let fineIntensity = 1.0 - uniforms.scanlines * 0.1 * (1.0 - fineScan);

    col = col * scanIntensity * fineIntensity;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Flicker
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.flicker > 0.0) {
    let flickerTime = floor(uniforms.time * 30.0);
    let flick = 1.0 - uniforms.flicker * 0.08 * random(vec2f(flickerTime, 0.0));
    col = col * flick;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Noise / Static
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.noise > 0.0) {
    let noiseVal = random(uv + fract(uniforms.time)) * uniforms.noise * 0.2;
    col = col + noiseVal - uniforms.noise * 0.1;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Vignette
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.vignette > 0.0) {
    let vigUv = originalUv * (1.0 - originalUv);
    let vig = vigUv.x * vigUv.y * 15.0;
    let vigFactor = clamp(pow(vig, 0.15 + uniforms.vignette * 0.15), 0.0, 1.0);
    col = col * vigFactor;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Color Shift (temperature/tint)
  // ═══════════════════════════════════════════════════════════════════════════

  if (uniforms.colorShift != 0.0) {
    // Warm/cool shift
    if (uniforms.colorShift > 0.0) {
      col.r = col.r * (1.0 + uniforms.colorShift * 0.2);
      col.b = col.b * (1.0 - uniforms.colorShift * 0.1);
    } else {
      col.r = col.r * (1.0 + uniforms.colorShift * 0.1);
      col.b = col.b * (1.0 - uniforms.colorShift * 0.2);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Final Output
  // ═══════════════════════════════════════════════════════════════════════════

  // Black outside curved screen
  if (outsideScreen && uniforms.curvature > 0.0) {
    col = vec3f(0.0);
  }

  // Clamp and output
  col = clamp(col, vec3f(0.0), vec3f(1.0));

  return vec4f(col, 1.0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Preset entry points for common effect combinations
// ═══════════════════════════════════════════════════════════════════════════

// Clean look - minimal effects
@fragment
fn fs_clean(input: VertexOutput) -> @location(0) vec4f {
  let col = textureSample(inputTexture, inputSampler, input.uv).rgb;
  return vec4f(col, 1.0);
}
