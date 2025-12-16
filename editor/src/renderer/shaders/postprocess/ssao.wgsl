// ═══════════════════════════════════════════════════════════════════════════
// Screen-Space Ambient Occlusion (SSAO) Post-Processing Effect
// Samples depth buffer to estimate local ambient occlusion
// ═══════════════════════════════════════════════════════════════════════════

struct SSAOParams {
  radius: f32,
  bias: f32,
  intensity: f32,
  samples: f32,  // Stored as float, cast to u32 in shader
  near: f32,
  far: f32,
  _pad0: f32,
  _pad1: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: SSAOParams;
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

// Better hash function for smoother noise
fn hash(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * vec3f(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Interleaved gradient noise - much smoother than random
fn interleavedGradientNoise(uv: vec2f) -> f32 {
  let frame = 0.0; // Could animate this
  let xy = vec2f(uv.x + 5.588238 * frame, uv.y + 5.588238 * frame);
  return fract(52.9829189 * fract(0.06711056 * xy.x + 0.00583715 * xy.y));
}

// Generate random vector in hemisphere
fn randomHemispherePoint(seed: vec2f, normal: vec3f) -> vec3f {
  // Simple random direction in upper hemisphere
  let rand1 = hash(seed);
  let rand2 = hash(seed + vec2f(13.0, 37.0));
  let rand3 = hash(seed + vec2f(71.0, 89.0));

  // Random direction
  let theta = rand1 * 6.28318;
  let phi = acos(rand2);

  var dir = vec3f(
    sin(phi) * cos(theta),
    sin(phi) * sin(theta),
    cos(phi)
  );

  // Make sure it's in the same hemisphere as normal
  if (dot(dir, normal) < 0.0) {
    dir = -dir;
  }

  // Scale by random length (bias toward center)
  let scale = rand3 * rand3;
  return dir * scale;
}

// Approximate normal from depth (gradient estimation)
fn estimateNormal(uv: vec2f, texSize: vec2i) -> vec3f {
  let offset = vec2f(1.0 / f32(texSize.x), 1.0 / f32(texSize.y));

  // Sample neighboring depths
  let centerCoord = clamp(vec2i(uv * vec2f(texSize)), vec2i(0), texSize - vec2i(1));
  let leftCoord = clamp(centerCoord - vec2i(1, 0), vec2i(0), texSize - vec2i(1));
  let rightCoord = clamp(centerCoord + vec2i(1, 0), vec2i(0), texSize - vec2i(1));
  let upCoord = clamp(centerCoord - vec2i(0, 1), vec2i(0), texSize - vec2i(1));
  let downCoord = clamp(centerCoord + vec2i(0, 1), vec2i(0), texSize - vec2i(1));

  let depthCenter = textureLoad(depthTexture, centerCoord, 0);
  let depthLeft = textureLoad(depthTexture, leftCoord, 0);
  let depthRight = textureLoad(depthTexture, rightCoord, 0);
  let depthUp = textureLoad(depthTexture, upCoord, 0);
  let depthDown = textureLoad(depthTexture, downCoord, 0);

  let dzdx = (depthRight - depthLeft) * 0.5;
  let dzdy = (depthDown - depthUp) * 0.5;

  return normalize(vec3f(-dzdx * f32(texSize.x) * 0.5, -dzdy * f32(texSize.y) * 0.5, 1.0));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Get texture size
  let texSizeU = textureDimensions(depthTexture);
  let texSize = vec2i(texSizeU);
  let pixelCoord = clamp(
    vec2i(input.uv * vec2f(texSizeU)),
    vec2i(0, 0),
    texSize - vec2i(1, 1)
  );

  // Sample center depth
  let depth = textureLoad(depthTexture, pixelCoord, 0);
  let linearDepth = linearizeDepth(depth, params.near, params.far);

  // Skip sky pixels (depth = 1.0)
  if (depth > 0.9999) {
    return vec4f(color, 1.0);
  }

  // Estimate surface normal from depth
  let normal = estimateNormal(input.uv, texSize);

  // Sample kernel positions and accumulate occlusion
  var occlusion = 0.0;
  let numSamples = min(u32(params.samples), 16u);

  // Use interleaved gradient noise for rotation - much smoother than random
  let pixelPos = input.uv * vec2f(texSizeU);
  let rotationAngle = interleavedGradientNoise(pixelPos) * 6.28318;
  let cosR = cos(rotationAngle);
  let sinR = sin(rotationAngle);

  for (var i = 0u; i < numSamples; i++) {
    // Generate sample in a spiral pattern (more uniform than random)
    let fi = f32(i);
    let angle = fi * 2.4; // Golden angle for good distribution
    let radius_t = (fi + 0.5) / f32(numSamples);
    let sampleRadius = sqrt(radius_t) * params.radius;

    // Base sample direction
    var sampleOffset = vec2f(cos(angle), sin(angle)) * sampleRadius;

    // Rotate sample by per-pixel noise
    sampleOffset = vec2f(
      sampleOffset.x * cosR - sampleOffset.y * sinR,
      sampleOffset.x * sinR + sampleOffset.y * cosR
    );

    // Scale by depth (larger radius for closer objects)
    let depthScale = clamp(1.0 / linearDepth * 5.0, 0.5, 1.5);
    sampleOffset *= depthScale * 0.05;

    // Convert to screen space
    let sampleUV = input.uv + sampleOffset;

    // Skip out-of-bounds samples
    if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
      continue;
    }

    // Sample depth at sample position
    let sampleCoord = clamp(
      vec2i(sampleUV * vec2f(texSizeU)),
      vec2i(0, 0),
      texSize - vec2i(1, 1)
    );
    let sampleDepth = textureLoad(depthTexture, sampleCoord, 0);
    let sampleLinearDepth = linearizeDepth(sampleDepth, params.near, params.far);

    // Compare depths - if sample is closer, it occludes
    let depthDiff = linearDepth - sampleLinearDepth;

    // Range check - only count occlusion within radius
    let rangeCheck = smoothstep(0.0, 1.0, params.radius * 5.0 / abs(depthDiff));

    // Accumulate occlusion if sample is in front
    if (depthDiff > params.bias && depthDiff < params.radius * 2.0) {
      occlusion += rangeCheck;
    }
  }

  // Normalize and apply intensity
  occlusion = 1.0 - (occlusion / f32(numSamples)) * params.intensity;
  occlusion = clamp(occlusion, 0.0, 1.0);

  // Apply AO to color
  let result = color * occlusion;

  return vec4f(result, 1.0);
}
