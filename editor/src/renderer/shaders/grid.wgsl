// Infinite grid shader on the horizontal (XZ) plane

struct Uniforms {
  viewProj: mat4x4f,
  cameraPos: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) worldPos: vec3f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;

  // Large quad centered on camera (XZ plane at Y=0)
  let gridSize = 500.0;
  let camX = uniforms.cameraPos.x;
  let camZ = uniforms.cameraPos.z;

  var pos: vec2f;
  switch(vertexIndex) {
    case 0u: { pos = vec2f(-gridSize + camX, -gridSize + camZ); }
    case 1u: { pos = vec2f( gridSize + camX, -gridSize + camZ); }
    case 2u: { pos = vec2f( gridSize + camX,  gridSize + camZ); }
    case 3u: { pos = vec2f(-gridSize + camX, -gridSize + camZ); }
    case 4u: { pos = vec2f( gridSize + camX,  gridSize + camZ); }
    case 5u: { pos = vec2f(-gridSize + camX,  gridSize + camZ); }
    default: { pos = vec2f(0.0, 0.0); }
  }

  let worldPos = vec3f(pos.x, 0.0, pos.y);
  output.clipPos = uniforms.viewProj * vec4f(worldPos, 1.0);
  output.worldPos = worldPos;

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let x = input.worldPos.x;
  let z = input.worldPos.z;

  // Grid line calculation
  let gridSize1 = 1.0;   // Small grid every 1 unit
  let gridSize10 = 10.0; // Major grid every 10 units

  // Calculate distance to nearest grid line
  let lineWidth1 = 0.02;  // Thin lines
  let lineWidth10 = 0.04; // Thicker lines for major grid

  // Small grid
  let gx1 = abs(fract(x / gridSize1 + 0.5) - 0.5) * gridSize1;
  let gz1 = abs(fract(z / gridSize1 + 0.5) - 0.5) * gridSize1;
  let dist1 = min(gx1, gz1);

  // Major grid (every 10 units)
  let gx10 = abs(fract(x / gridSize10 + 0.5) - 0.5) * gridSize10;
  let gz10 = abs(fract(z / gridSize10 + 0.5) - 0.5) * gridSize10;
  let dist10 = min(gx10, gz10);

  // Anti-aliased lines using screen-space derivatives
  let ddx = length(vec2f(dpdx(x), dpdx(z)));
  let ddz = length(vec2f(dpdy(x), dpdy(z)));
  let pixelSize = max(ddx, ddz);

  // Calculate line intensity
  let line1 = 1.0 - smoothstep(0.0, pixelSize * 1.5, dist1 - lineWidth1);
  let line10 = 1.0 - smoothstep(0.0, pixelSize * 2.0, dist10 - lineWidth10);

  // Combine: major grid is brighter
  let lineIntensity = max(line1 * 0.15, line10 * 0.4);

  // Fade out with distance from camera
  let distFromCam = length(input.worldPos.xz - uniforms.cameraPos.xz);
  let fade = 1.0 - smoothstep(50.0, 200.0, distFromCam);

  let alpha = lineIntensity * fade;

  if (alpha < 0.01) {
    discard;
  }

  // Gray color for grid
  return vec4f(0.5, 0.5, 0.5, alpha);
}
