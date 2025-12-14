// Sky gradient shader - fullscreen triangle

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

  // Colors
  let horizonColor = vec3f(0.7, 0.8, 0.95);  // Light blue-white at horizon
  let zenithColor = vec3f(0.3, 0.5, 0.85);   // Deeper blue at top
  let groundColor = vec3f(0.35, 0.45, 0.6);  // Slightly darker blue-gray below

  var skyColor: vec3f;
  if (t > 0.5) {
    // Upper half - horizon to zenith
    let upperT = (t - 0.5) * 2.0;
    skyColor = mix(horizonColor, zenithColor, upperT);
  } else {
    // Lower half - ground fade to horizon
    let lowerT = t * 2.0;
    skyColor = mix(groundColor, horizonColor, lowerT);
  }

  return vec4f(skyColor, 1.0);
}
