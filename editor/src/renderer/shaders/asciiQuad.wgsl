// ═══════════════════════════════════════════════════════════════════════════
// ASCII Quad Shader - Renders textured quads for ASCII art in 3D space
// ═══════════════════════════════════════════════════════════════════════════

struct Uniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  color: vec4f,      // Tint color + alpha
  uvOffset: vec2f,   // UV offset for scrolling/animation
  uvScale: vec2f,    // UV scale
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var asciiTexture: texture_2d<f32>;
@group(0) @binding(2) var asciiSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
}

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) uv: vec2f,
  @location(1) worldPos: vec3f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let worldPos = (uniforms.model * vec4f(input.position, 1.0)).xyz;
  output.clipPos = uniforms.viewProj * vec4f(worldPos, 1.0);
  output.worldPos = worldPos;

  // Apply UV transform
  output.uv = input.uv * uniforms.uvScale + uniforms.uvOffset;

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texColor = textureSample(asciiTexture, asciiSampler, input.uv);

  // Apply tint and alpha
  let finalColor = texColor.rgb * uniforms.color.rgb;
  let finalAlpha = texColor.a * uniforms.color.a;

  // Discard fully transparent pixels
  if (finalAlpha < 0.01) {
    discard;
  }

  return vec4f(finalColor, finalAlpha);
}

// ═══════════════════════════════════════════════════════════════════════════
// Billboard variant - always faces camera
// ═══════════════════════════════════════════════════════════════════════════

struct BillboardUniforms {
  viewProj: mat4x4f,
  cameraRight: vec3f,
  _pad0: f32,
  cameraUp: vec3f,
  _pad1: f32,
  position: vec3f,    // World position
  scale: f32,         // Uniform scale
  color: vec4f,
  uvOffset: vec2f,
  uvScale: vec2f,
}

@group(0) @binding(0) var<uniform> billboard: BillboardUniforms;
@group(0) @binding(1) var bbTexture: texture_2d<f32>;
@group(0) @binding(2) var bbSampler: sampler;

struct BillboardVertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_billboard(@builtin(vertex_index) vertexIdx: u32) -> BillboardVertexOutput {
  var output: BillboardVertexOutput;

  // Quad vertices (centered at origin)
  var positions = array<vec2f, 6>(
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
    vec2f( 0.5,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5,  0.5),
    vec2f(-0.5,  0.5),
  );

  var uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, 0.0),
  );

  let localPos = positions[vertexIdx];

  // Billboard: construct world position using camera axes
  let worldPos = billboard.position
    + billboard.cameraRight * localPos.x * billboard.scale
    + billboard.cameraUp * localPos.y * billboard.scale;

  output.clipPos = billboard.viewProj * vec4f(worldPos, 1.0);
  output.uv = uvs[vertexIdx] * billboard.uvScale + billboard.uvOffset;

  return output;
}

@fragment
fn fs_billboard(input: BillboardVertexOutput) -> @location(0) vec4f {
  let texColor = textureSample(bbTexture, bbSampler, input.uv);

  let finalColor = texColor.rgb * billboard.color.rgb;
  let finalAlpha = texColor.a * billboard.color.a;

  if (finalAlpha < 0.01) {
    discard;
  }

  return vec4f(finalColor, finalAlpha);
}
