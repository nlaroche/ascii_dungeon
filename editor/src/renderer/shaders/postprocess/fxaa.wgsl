// ═══════════════════════════════════════════════════════════════════════════
// FXAA - Fast Approximate Anti-Aliasing
// ═══════════════════════════════════════════════════════════════════════════

struct FXAAParams {
  quality: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: FXAAParams;

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

fn getLuma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texSize = vec2f(textureDimensions(inputTexture));
  let texelSize = 1.0 / texSize;

  // Sample center and 8 neighbors upfront (before any conditionals)
  let center = textureSample(inputTexture, inputSampler, input.uv).rgb;
  let n  = textureSample(inputTexture, inputSampler, input.uv + vec2f(0.0, -texelSize.y)).rgb;
  let s  = textureSample(inputTexture, inputSampler, input.uv + vec2f(0.0, texelSize.y)).rgb;
  let e  = textureSample(inputTexture, inputSampler, input.uv + vec2f(texelSize.x, 0.0)).rgb;
  let w  = textureSample(inputTexture, inputSampler, input.uv + vec2f(-texelSize.x, 0.0)).rgb;
  let nw = textureSample(inputTexture, inputSampler, input.uv + vec2f(-texelSize.x, -texelSize.y)).rgb;
  let ne = textureSample(inputTexture, inputSampler, input.uv + vec2f(texelSize.x, -texelSize.y)).rgb;
  let sw = textureSample(inputTexture, inputSampler, input.uv + vec2f(-texelSize.x, texelSize.y)).rgb;
  let se = textureSample(inputTexture, inputSampler, input.uv + vec2f(texelSize.x, texelSize.y)).rgb;

  // Compute luma values
  let lumaC  = getLuma(center);
  let lumaN  = getLuma(n);
  let lumaS  = getLuma(s);
  let lumaE  = getLuma(e);
  let lumaW  = getLuma(w);
  let lumaNW = getLuma(nw);
  let lumaNE = getLuma(ne);
  let lumaSW = getLuma(sw);
  let lumaSE = getLuma(se);

  // Find luma range in 3x3 neighborhood
  let lumaMin = min(lumaC, min(min(min(lumaN, lumaS), min(lumaE, lumaW)), min(min(lumaNW, lumaNE), min(lumaSW, lumaSE))));
  let lumaMax = max(lumaC, max(max(max(lumaN, lumaS), max(lumaE, lumaW)), max(max(lumaNW, lumaNE), max(lumaSW, lumaSE))));
  let lumaRange = lumaMax - lumaMin;

  // Threshold for edge detection
  let threshold = 0.05;

  // Detect edge direction using Sobel-like operator
  let edgeH = abs(lumaNW - lumaNE) + 2.0 * abs(lumaW - lumaE) + abs(lumaSW - lumaSE);
  let edgeV = abs(lumaNW - lumaSW) + 2.0 * abs(lumaN - lumaS) + abs(lumaNE - lumaSE);

  // Gradient magnitudes
  let gradN = abs(lumaN - lumaC);
  let gradS = abs(lumaS - lumaC);
  let gradE = abs(lumaE - lumaC);
  let gradW = abs(lumaW - lumaC);

  // Compute blend weights using branchless math
  // isHorizontal: 1 if horizontal edge, 0 if vertical
  let isHorz = step(edgeV, edgeH);

  // For horizontal edges, blend vertically (N or S)
  // For vertical edges, blend horizontally (E or W)
  let useN = step(gradS, gradN);  // 1 if N gradient is steeper
  let useE = step(gradW, gradE);  // 1 if E gradient is steeper

  // Select neighbor to blend with (all computed branchless)
  // If horizontal edge: use N if useN, else S
  // If vertical edge: use E if useE, else W
  let horzNeighbor = mix(s, n, useN);
  let vertNeighbor = mix(w, e, useE);
  let neighbor = mix(vertNeighbor, horzNeighbor, isHorz);

  // Blend amount based on edge strength
  let isEdge = step(threshold, lumaRange);  // 1 if edge, 0 if not

  // DEBUG: Make edges very visible (red tint) to verify detection
  // Remove this for production - just for testing
  let debugColor = vec3f(1.0, 0.0, 0.0);  // Red
  let debugResult = mix(center, debugColor, isEdge * 0.5);

  // Normal FXAA blending
  let maxBlend = 0.3 + params.quality * 0.1;
  let blend = isEdge * min(lumaRange * 2.0, maxBlend);
  let normalResult = mix(center, neighbor, blend);

  // Use debug mode: quality 0 = debug (show red edges), quality 1+ = normal FXAA
  let useDebug = step(params.quality, 0.5);  // 1 if quality < 0.5 (low), 0 otherwise
  let result = mix(normalResult, debugResult, useDebug);

  return vec4f(result, 1.0);
}
