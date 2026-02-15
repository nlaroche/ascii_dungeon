// Tilemap vertex + fragment shader
// Renders instanced quads from a cell storage buffer with SDF glyph sampling.
// Supports multiple layers rendered back-to-front in a single draw call.

struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  parallaxStrength: f32,
  cellPixelSize: vec2<f32>,
  gridSize: vec2<f32>,
  cameraOffset: vec2<f32>,
  sdfEdge: f32,
  sdfSmoothing: f32,
  cellsPerLayer: u32,
  lightSubRes: f32,
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
@group(0) @binding(4) var<storage, read> lightMap: array<vec4<f32>>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) atlasUV: vec2<f32>,
  @location(1) @interpolate(flat) fg: vec4<f32>,
  @location(2) @interpolate(flat) bg: vec4<f32>,
  @location(3) @interpolate(flat) light: f32,
  @location(4) @interpolate(flat) flags: u32,
  @location(5) @interpolate(flat) depth: f32,
  @location(6) @interpolate(flat) layer: u32,
  @location(7) @interpolate(flat) glyph: u32,
  @location(8) worldGridPos: vec2<f32>,
};

fn unpackColor(packed: u32) -> vec4<f32> {
  let r = f32((packed >> 24u) & 0xFFu) / 255.0;
  let g = f32((packed >> 16u) & 0xFFu) / 255.0;
  let b = f32((packed >> 8u) & 0xFFu) / 255.0;
  let a = f32(packed & 0xFFu) / 255.0;
  return vec4<f32>(r, g, b, a);
}

// Integer hash for void texture noise (deterministic per-cell)
fn hash2d(ix: i32, iy: i32) -> f32 {
  var n = ix * 374761393 + iy * 668265263;
  n = (n ^ (n >> 13u)) * 1274126177;
  n = n ^ (n >> 16u);
  return f32(n & 0x7FFFFFFF) / f32(0x7FFFFFFF);
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
  let cpl = uniforms.cellsPerLayer;
  let layerIdx = instanceIndex / cpl;
  let localIdx = instanceIndex % cpl;
  let gridW = u32(uniforms.gridSize.x);
  let gridX = f32(localIdx % gridW);
  let gridY = f32(localIdx / gridW);
  let localPos = quadPos[vertexIndex];

  // World grid position (un-shifted, for light map sampling)
  let worldGridPos = vec2<f32>(
    gridX + cell.offsetX + localPos.x,
    gridY + cell.offsetY + localPos.y,
  );

  // Cell position in pixels with sub-cell offset and camera offset (global scroll)
  var pixelPos = vec2<f32>(
    worldGridPos.x * uniforms.cellPixelSize.x,
    worldGridPos.y * uniforms.cellPixelSize.y,
  );

  // Camera offset: uniform scroll for all cells (no depth-based parallax)
  pixelPos += uniforms.cameraOffset;

  // Wall height: top edge lifts up, bottom stays in place (fills shadow gap)
  let wallShift = cell.depth * uniforms.cellPixelSize.y * 0.3;
  pixelPos.y -= wallShift * (1.0 - localPos.y);

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

  // Depth: layer 0 at back, layer 4 at front. Within a layer, use cell depth.
  let zDepth = (f32(layerIdx) * 0.1 + cell.depth * 0.001);

  var output: VertexOutput;
  output.position = vec4<f32>(ndc, zDepth, 1.0);
  output.atlasUV = atlasUV;
  output.fg = unpackColor(cell.fg);
  output.bg = unpackColor(cell.bg);
  output.light = cell.light;
  output.flags = cell.flags;
  output.depth = cell.depth;
  output.layer = layerIdx;
  output.glyph = cell.glyph;
  output.worldGridPos = worldGridPos;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // Sample SDF atlas BEFORE any non-uniform branches (WGSL requirement)
  let sdfValue = textureSample(sdfAtlas, atlasSampler, input.atlasUV).r;

  // SDF threshold with smoothstep for antialiased edges
  let edge = uniforms.sdfEdge;
  let spread = uniforms.sdfSmoothing;
  let sdfAlpha = 1.0 - smoothstep(edge - spread, edge + spread, sdfValue);

  // Minimum ambient so nothing is pure black
  let lit = max(input.light, 0.05);

  // Sample light map at sub-cell resolution (stepped/pixelated lookup)
  let subRes = uniforms.lightSubRes;
  let lmWidth = u32(uniforms.gridSize.x * subRes);
  let lmX = u32(clamp(floor(input.worldGridPos.x * subRes), 0.0, uniforms.gridSize.x * subRes - 1.0));
  let lmY = u32(clamp(floor(input.worldGridPos.y * subRes), 0.0, uniforms.gridSize.y * subRes - 1.0));
  let lightSample = lightMap[lmY * lmWidth + lmX];

  // ── Layer 0 (TERRAIN): existing opaque logic ──
  if (input.layer == 0u) {
    // Not visible and not explored: subtle void texture
    if ((input.flags & 3u) == 0u) {
      let gx = i32(floor(input.worldGridPos.x));
      let gy = i32(floor(input.worldGridPos.y));
      let h = hash2d(gx, gy);
      // Very subtle noise: most cells near-black, occasional faint speckle
      let voidBright = select(0.0, h * 0.03, h > 0.85);
      // Slight blue tint for depth feeling
      let voidColor = vec3<f32>(voidBright * 0.4, voidBright * 0.5, voidBright * 1.0);
      return vec4<f32>(voidColor, 1.0);
    }

    // Explored but not currently visible: bg from CPU (pre-dimmed)
    if ((input.flags & 1u) == 0u) {
      return vec4<f32>(input.bg.rgb, 1.0);
    }

    // Visible: sub-cell lighting from light map on base bg
    let baseBg = input.bg.rgb;
    let lr = lightSample.r;
    let lg = lightSample.g;
    let lb = lightSample.b;
    var bgColor = baseBg * 0.2 + vec3<f32>(lr, lg, lb) * 0.4;

    // Wall shadow: darken bottom portion of stretched wall quads
    let localY = fract(input.worldGridPos.y);
    if (input.depth > 0.5 && localY > 0.82) {
      let shadowFade = (localY - 0.82) / 0.18;
      // Shadow tinted by light color instead of pure black
      let shadowTint = vec3<f32>(lr, lg, lb) * 0.08;
      bgColor = mix(bgColor, shadowTint, shadowFade * 0.7);
    }

    // Foreground with scalar lighting
    let fgColor = vec3<f32>(input.fg.rgb * lit);

    // Mix foreground over background
    var result = mix(bgColor, fgColor, sdfAlpha);

    // Depth fog: walls are slightly darker
    let depthDim = 1.0 - input.depth * 0.08;
    result *= depthDim;

    // Highlighted cells get a subtle additive tint
    if ((input.flags & 4u) != 0u) {
      let pulse = sin(uniforms.time * 3.0) * 0.05 + 0.1;
      result += vec3<f32>(pulse, pulse * 0.8, 0.0);
    }

    return vec4<f32>(result, 1.0);
  }

  // ── Layers 1-4 (overlay): transparent with premultiplied alpha ──

  // Empty cell or space = fully transparent
  if (input.glyph == 0u || input.glyph == 32u) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }

  // Not visible = transparent (don't render overlays in fog of war)
  if ((input.flags & 1u) == 0u) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }

  // Glyph foreground with premultiplied alpha
  let glyphAlpha = sdfAlpha * input.fg.a;
  let glyphColor = input.fg.rgb * lit * glyphAlpha;

  return vec4<f32>(glyphColor, glyphAlpha);
}
