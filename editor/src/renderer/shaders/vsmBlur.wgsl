// Gaussian blur for VSM shadow map
// Separable 9-tap blur (run twice: horizontal then vertical)

struct BlurParams {
  direction: vec2f,  // (1,0) for horizontal, (0,1) for vertical
  texelSize: vec2f,  // 1.0 / textureSize
}

@group(0) @binding(0) var<uniform> params: BlurParams;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var texSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;

  // Fullscreen triangle
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  output.position = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  output.uv = vec2f(x, 1.0 - y);

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  // 9-tap Gaussian weights (sigma ~= 1.5)
  let weights = array<f32, 5>(
    0.227027,
    0.1945946,
    0.1216216,
    0.054054,
    0.016216
  );

  let offset = params.direction * params.texelSize;
  var result = textureSample(inputTexture, texSampler, input.uv) * weights[0];

  // Sample in both directions
  for (var i = 1; i < 5; i++) {
    let sampleOffset = offset * f32(i);
    result += textureSample(inputTexture, texSampler, input.uv + sampleOffset) * weights[i];
    result += textureSample(inputTexture, texSampler, input.uv - sampleOffset) * weights[i];
  }

  return result;
}
