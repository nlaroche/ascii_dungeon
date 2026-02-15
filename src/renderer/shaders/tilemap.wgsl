// Tilemap vertex + fragment shader
// Renders instanced quads from a cell storage buffer with SDF glyph sampling.

struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  parallaxStrength: f32,
  cellPixelSize: vec2<f32>,
  gridSize: vec2<f32>,
  cameraOffset: vec2<f32>,
  sdfEdge: f32,
  sdfSmoothing: f32,
};

struct Cell {
  glyph: u32,
  fg: u32,
  bg: u32,
  depth: f32,
  light: f32,
  flags: u32,
  offsetX: f32,
  offsetY: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> cells: array<Cell>;
@group(0) @binding(2) var sdfAtlas: texture_2d<f32>;
@group(0) @binding(3) var atlasSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) atlasUV: vec2<f32>,
  @location(1) @interpolate(flat) fg: vec4<f32>,
  @location(2) @interpolate(flat) bg: vec4<f32>,
  @location(3) @interpolate(flat) light: f32,
  @location(4) @interpolate(flat) flags: u32,
  @location(5) @interpolate(flat) depth: f32,
};

fn unpackColor(packed: u32) -> vec4<f32> {
  let r = f32((packed >> 24u) & 0xFFu) / 255.0;
  let g = f32((packed >> 16u) & 0xFFu) / 255.0;
  let b = f32((packed >> 8u) & 0xFFu) / 255.0;
  let a = f32(packed & 0xFFu) / 255.0;
  return vec4<f32>(r, g, b, a);
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var quadPos = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
  );

  let cell = cells[instanceIndex];
  let gridW = u32(uniforms.gridSize.x);
  let gridX = f32(instanceIndex % gridW);
  let gridY = f32(instanceIndex / gridW);
  let localPos = quadPos[vertexIndex];

  // Cell position in pixels with sub-cell offset and camera offset (global scroll)
  var pixelPos = vec2<f32>(
    (gridX + cell.offsetX + localPos.x) * uniforms.cellPixelSize.x,
    (gridY + cell.offsetY + localPos.y) * uniforms.cellPixelSize.y,
  );

  // Parallax: walls (depth=1) shift less than floors (depth=0) when camera pans
  let parallaxScale = 1.0 - cell.depth * uniforms.parallaxStrength;
  pixelPos += uniforms.cameraOffset * parallaxScale;

  // Wall height: walls shift upward to create "rising" illusion
  pixelPos.y -= cell.depth * uniforms.cellPixelSize.y * 0.3;

  // NDC
  let ndc = vec2<f32>(
    (pixelPos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (pixelPos.y / uniforms.resolution.y) * 2.0,
  );

  // Compute atlas UV for this vertex
  let glyphIdx = cell.glyph - 32u;
  let atlasCol = glyphIdx % 16u;
  let atlasRow = glyphIdx / 16u;
  let cellU = f32(atlasCol) / 16.0;
  let cellV = f32(atlasRow) / 6.0;
  let cellW = 1.0 / 16.0;
  let cellH = 1.0 / 6.0;
  let atlasUV = vec2<f32>(
    cellU + localPos.x * cellW,
    cellV + localPos.y * cellH,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(ndc, cell.depth * 0.001, 1.0);
  output.atlasUV = atlasUV;
  output.fg = unpackColor(cell.fg);
  output.bg = unpackColor(cell.bg);
  output.light = cell.light;
  output.flags = cell.flags;
  output.depth = cell.depth;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // Minimum ambient so nothing is pure black
  let lit = max(input.light, 0.05);

  let bgLightScale = mix(0.4, 0.2, input.depth);
  let bgColor = vec4<f32>(input.bg.rgb * lit * bgLightScale, 1.0);

  // Sample SDF atlas BEFORE any non-uniform branches (WGSL requirement)
  let sdfValue = textureSample(sdfAtlas, atlasSampler, input.atlasUV).r;

  // SDF threshold with smoothstep for antialiased edges
  let edge = uniforms.sdfEdge;
  let spread = uniforms.sdfSmoothing;
  let alpha = 1.0 - smoothstep(edge - spread, edge + spread, sdfValue);

  // Not visible and not explored: pure black
  if ((input.flags & 3u) == 0u) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  // Explored but not currently visible: dim background only
  if ((input.flags & 1u) == 0u) {
    return vec4<f32>(input.bg.rgb * 0.15, 1.0);
  }

  // Foreground with lighting
  let fgColor = vec4<f32>(input.fg.rgb * lit, alpha);

  // Mix foreground over background
  var result = vec3<f32>(
    mix(bgColor.rgb, fgColor.rgb, alpha),
  );

  // Depth fog: walls are slightly darker, creating visual separation
  let depthDim = 1.0 - input.depth * 0.12;
  result *= depthDim;

  // Highlighted cells get a subtle additive tint
  if ((input.flags & 4u) != 0u) {
    let pulse = sin(uniforms.time * 3.0) * 0.05 + 0.1;
    result += vec3<f32>(pulse, pulse * 0.8, 0.0);
  }

  return vec4<f32>(result, 1.0);
}
