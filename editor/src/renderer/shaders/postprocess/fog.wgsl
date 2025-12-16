// ═══════════════════════════════════════════════════════════════════════════
// Fog Post-Processing Effect
// Depth-based atmospheric fog
// ═══════════════════════════════════════════════════════════════════════════

struct FogParams {
  color: vec3f,
  density: f32,
  start: f32,
  end: f32,
  heightFalloff: f32,
  fogType: u32, // 0=linear, 1=exponential, 2=height
  near: f32,
  far: f32,
  _pad0: f32,
  _pad1: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: FogParams;
@group(0) @binding(3) var depthTexture: texture_depth_2d;

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

// Convert depth buffer value to linear depth
fn linearizeDepth(depth: f32, near: f32, far: f32) -> f32 {
  return near * far / (far + depth * (near - far));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Sample depth using textureLoad - clamp coords to valid range
  let texSize = textureDimensions(depthTexture);
  let pixelCoord = clamp(
    vec2i(input.uv * vec2f(texSize)),
    vec2i(0, 0),
    vec2i(texSize) - vec2i(1, 1)
  );
  let depth = textureLoad(depthTexture, pixelCoord, 0);

  // Convert to linear depth
  let linearDepth = linearizeDepth(depth, params.near, params.far);

  // Calculate fog factor based on type
  var fogFactor: f32;

  switch (params.fogType) {
    case 0u: {
      // Linear fog
      fogFactor = saturate((params.end - linearDepth) / (params.end - params.start));
    }
    case 1u: {
      // Exponential fog
      fogFactor = exp(-params.density * linearDepth);
    }
    case 2u: {
      // Exponential squared fog
      let exp_factor = params.density * linearDepth;
      fogFactor = exp(-exp_factor * exp_factor);
    }
    default: {
      fogFactor = 1.0;
    }
  }

  // Clamp fog factor
  fogFactor = saturate(fogFactor);

  // Mix color with fog
  let result = mix(params.color, color, fogFactor);

  return vec4f(result, 1.0);
}
