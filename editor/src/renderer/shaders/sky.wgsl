// Sky gradient shader - fullscreen triangle with dynamic colors

struct SkyUniforms {
  zenithColor: vec4f,   // rgb + padding
  horizonColor: vec4f,  // rgb + padding
  groundColor: vec4f,   // rgb + padding
}

@group(0) @binding(0) var<uniform> sky: SkyUniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;

  // Fullscreen triangle (covers entire screen with one triangle)
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);

  output.position = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 1.0, 1.0);
  output.uv = vec2f(x, 1.0 - y);

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  // Gradient from horizon to zenith
  let t = input.uv.y;

  // Read colors from uniforms
  let zenithColor = sky.zenithColor.rgb;
  let horizonColor = sky.horizonColor.rgb;
  let groundColor = sky.groundColor.rgb;

  var skyColor: vec3f;
  if (t > 0.5) {
    // Upper half - horizon to zenith
    let upperT = (t - 0.5) * 2.0;
    skyColor = mix(horizonColor, zenithColor, pow(upperT, 0.8));
  } else {
    // Lower half - ground fade to horizon
    let lowerT = t * 2.0;
    skyColor = mix(groundColor, horizonColor, pow(lowerT, 1.2));
  }

  // Subtle radial gradient for depth
  let center = vec2f(0.5, 0.6);
  let dist = length(input.uv - center);
  skyColor *= 1.0 - dist * 0.15;

  return vec4f(skyColor, 1.0);
}
