// ═══════════════════════════════════════════════════════════════════════════
// Outline Post-Processing Effect
// Sobel edge detection for stylized outlines
// ═══════════════════════════════════════════════════════════════════════════

struct OutlineParams {
  color: vec4f,      // vec4f must come first for 16-byte alignment
  thickness: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: OutlineParams;

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
  return dot(color, vec3f(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texSize = vec2f(textureDimensions(inputTexture));
  let texelSize = params.thickness / texSize;

  let originalColor = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Sample 3x3 neighborhood for Sobel
  let tl = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(-texelSize.x, -texelSize.y)).rgb);
  let tm = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(0.0, -texelSize.y)).rgb);
  let tr = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(texelSize.x, -texelSize.y)).rgb);
  let ml = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(-texelSize.x, 0.0)).rgb);
  let mr = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(texelSize.x, 0.0)).rgb);
  let bl = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(-texelSize.x, texelSize.y)).rgb);
  let bm = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(0.0, texelSize.y)).rgb);
  let br = luminance(textureSample(inputTexture, inputSampler, input.uv + vec2f(texelSize.x, texelSize.y)).rgb);

  // Sobel operators
  let gx = -tl + tr - 2.0 * ml + 2.0 * mr - bl + br;
  let gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;

  // Edge magnitude
  let edge = sqrt(gx * gx + gy * gy);

  // Apply threshold and smoothstep for anti-aliased edges
  let edgeFactor = smoothstep(0.1, 0.3, edge);

  // Mix original color with outline color
  let result = mix(originalColor, params.color.rgb, edgeFactor * params.color.a);

  return vec4f(result, 1.0);
}
