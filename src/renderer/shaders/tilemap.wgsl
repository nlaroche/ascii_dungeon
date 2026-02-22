// Tilemap vertex + fragment shader
// Renders instanced quads from a cell storage buffer with SDF glyph sampling.
// Supports multiple layers rendered back-to-front in a single draw call.

struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  vignettePulse: f32,
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
  scaleX: f32,
  scaleY: f32,
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

// ── Fog of War noise functions ──

// Integer hash for noise
fn hash2d(ix: i32, iy: i32) -> f32 {
  var n = ix * 374761393 + iy * 668265263;
  n = (n ^ (n >> 13u)) * 1274126177;
  n = n ^ (n >> 16u);
  return f32(n & 0x7FFFFFFF) / f32(0x7FFFFFFF);
}

// Smooth value noise (bilinear interpolation of hash)
fn valueNoise(p: vec2<f32>) -> f32 {
  let i = vec2<i32>(floor(p));
  let f = fract(p);
  // Smoothstep interpolation
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash2d(i.x, i.y);
  let b = hash2d(i.x + 1, i.y);
  let c = hash2d(i.x, i.y + 1);
  let d = hash2d(i.x + 1, i.y + 1);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian motion — layered noise for cloud-like fog
fn fbm(p: vec2<f32>) -> f32 {
  var val = 0.0;
  var amp = 0.5;
  var pos = p;
  for (var i = 0; i < 4; i++) {
    val += amp * valueNoise(pos);
    pos *= 2.1;
    amp *= 0.5;
  }
  return val;
}

// Fog of war: multi-layered atmospheric void
fn fogOfWar(worldPos: vec2<f32>, time: f32) -> vec3<f32> {
  // Layer 1: Large slow-moving fog banks
  let flow1 = fbm(worldPos * 0.12 + vec2<f32>(time * 0.06, time * 0.04));
  // Layer 2: Medium counter-flowing wisps
  let flow2 = fbm(worldPos * 0.2 - vec2<f32>(time * 0.03, time * -0.05));
  // Layer 3: Fine detail turbulence
  let detail = valueNoise(worldPos * 0.5 + vec2<f32>(time * 0.1, time * 0.08));

  // Combine: fog banks with wispy detail
  let fog = flow1 * 0.5 + flow2 * 0.3 + detail * 0.2;

  // Shape into wisps: mostly dark, subtle fog bands
  let wisps = smoothstep(0.35, 0.65, fog) * 0.025;
  // Secondary faint glow in darkest regions (deep ambient)
  let deepGlow = (1.0 - smoothstep(0.2, 0.5, fog)) * 0.006;

  // Runic symbols: very sparse, fading in and out
  let runeGrid = vec2<i32>(floor(worldPos * 0.5));
  let runeHash = hash2d(runeGrid.x + 73, runeGrid.y + 191);
  let runeActive = step(0.95, runeHash); // ~5% of grid has a rune
  let runePulse = sin(time * 0.3 + runeHash * 20.0) * 0.5 + 0.5;
  let runeGlow = runeActive * runePulse * 0.008;

  // Deep blue-indigo palette — subdued
  let tint = vec3<f32>(
    wisps * 0.2 + deepGlow * 0.3 + runeGlow * 0.4,
    wisps * 0.25 + deepGlow * 0.25 + runeGlow * 0.2,
    wisps * 0.7 + deepGlow * 0.7 + runeGlow * 0.7
  );

  return tint;
}

// Edge fog: tendrils that reach from void into explored areas
fn fogEdge(worldPos: vec2<f32>, time: f32) -> f32 {
  let tendril1 = fbm(worldPos * 0.3 + vec2<f32>(time * 0.07, -time * 0.05));
  let tendril2 = valueNoise(worldPos * 0.6 - vec2<f32>(time * 0.04, time * 0.09));
  // Wispy fingers pattern — subtle
  return smoothstep(0.4, 0.6, tendril1 * 0.7 + tendril2 * 0.3) * 0.06;
}

// Screen-space post effects: vignette + color grading
fn applyPostFX(color: vec3<f32>, screenPos: vec2<f32>) -> vec3<f32> {
  let uv = screenPos / uniforms.resolution;

  // Vignette: smooth darkening toward edges + pulse from damage
  let center = uv - vec2<f32>(0.5, 0.5);
  let vignetteDist = length(center) * 1.3;
  let baseVignette = 1.0 - smoothstep(0.4, 1.1, vignetteDist);
  let pulseVignette = baseVignette * (1.0 - uniforms.vignettePulse * 1.5);

  var c = color * pulseVignette;

  // Color grading: very subtle warm/cool split (reduced to not distort readability)
  let luminance = dot(c, vec3<f32>(0.299, 0.587, 0.114));
  let warmShift = vec3<f32>(0.012, 0.006, -0.004) * smoothstep(0.2, 0.5, luminance);
  let coolShift = vec3<f32>(-0.004, -0.002, 0.008) * (1.0 - smoothstep(0.0, 0.15, luminance));
  c += warmShift + coolShift;

  return max(c, vec3<f32>(0.0, 0.0, 0.0));
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

  // Default scale=0 (from zeroed buffer) to 1.0
  let sx = select(cell.scaleX, 1.0, cell.scaleX == 0.0);
  let sy = select(cell.scaleY, 1.0, cell.scaleY == 0.0);

  // Scale quad around cell center
  let scaledPos = vec2<f32>(
    (localPos.x - 0.5) * sx + 0.5,
    (localPos.y - 0.5) * sy + 0.5,
  );

  // World grid position (un-shifted, for light map sampling)
  let worldGridPos = vec2<f32>(
    gridX + cell.offsetX + scaledPos.x,
    gridY + cell.offsetY + scaledPos.y,
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
  let spread = uniforms.sdfSmoothing;

  // Bold flag: shift threshold inward for thicker glyphs
  let isBold = (input.flags & 8u) != 0u;
  let activeEdge = select(uniforms.sdfEdge, uniforms.sdfEdge - 0.12, isBold);
  let sdfAlpha = 1.0 - smoothstep(activeEdge - spread, activeEdge + spread, sdfValue);

  // Outline ring (wider threshold, subtract fill)
  let outlineEdge = activeEdge - 0.1;
  let outlineRaw = 1.0 - smoothstep(outlineEdge - spread, outlineEdge + spread, sdfValue);
  let outlineAlpha = max(outlineRaw - sdfAlpha, 0.0);

  // Visibility factor (continuous 0→1, used for fog-of-war blending)
  let vis = clamp(input.light, 0.0, 1.0);

  // Sample light map at sub-cell resolution (stepped/pixelated lookup)
  let subRes = uniforms.lightSubRes;
  let lmWidth = u32(uniforms.gridSize.x * subRes);
  let lmX = u32(clamp(floor(input.worldGridPos.x * subRes), 0.0, uniforms.gridSize.x * subRes - 1.0));
  let lmY = u32(clamp(floor(input.worldGridPos.y * subRes), 0.0, uniforms.gridSize.y * subRes - 1.0));
  let lightSample = lightMap[lmY * lmWidth + lmX];

  // ── Layer 0 (TERRAIN): opaque with smooth fog-of-war blending ──
  if (input.layer == 0u) {
    // Fog of war base: always computed for blending at edges
    let fogColor = fogOfWar(input.worldGridPos, uniforms.time);

    // Not visible and not explored: pure fog of war
    if ((input.flags & 3u) == 0u) {
      return vec4<f32>(applyPostFX(fogColor, input.position.xy), 1.0);
    }

    // ── Explored or visible terrain ──
    let exploredBg = input.bg.rgb;

    // Light map sample (faded by vis on CPU for fading cells)
    let lr = lightSample.r;
    let lg = lightSample.g;
    let lb = lightSample.b;

    // Lit bg: dark base + colored light from light map (reduced color intensity for readability)
    let litBg = exploredBg * 0.25 + vec3<f32>(lr, lg, lb) * 0.3;

    // Smooth blend: explored bg at vis=0, lit bg at vis=1
    var bgColor = mix(exploredBg, litBg, vis);

    // Wall shadow: darken bottom portion of stretched wall quads
    let localY = fract(input.worldGridPos.y);
    if (input.depth > 0.5 && localY > 0.82) {
      let shadowFade = (localY - 0.82) / 0.18;
      let shadowTint = vec3<f32>(lr, lg, lb) * 0.08;
      bgColor = mix(bgColor, shadowTint, shadowFade * 0.7 * vis);
    }

    // Foreground: walls show glyph subtly blended into bg, not stark
    // Non-interactive glyphs (#) stay close to their bg color
    let isWall = select(0.0, 1.0, input.depth > 0.5);
    // Walls: fg closer to bg (0.4 blend), floors: normal vis-based
    let fgBrightness = select(vis, mix(0.15, 0.5, vis), isWall > 0.5);
    let fgColor = input.fg.rgb * fgBrightness;

    // Glyph blending: walls are subtle texture, not bold marks
    let glyphStrength = select(sdfAlpha * vis, sdfAlpha * mix(0.3, 0.6, vis), isWall > 0.5);
    var result = mix(bgColor, fgColor, glyphStrength);

    // Depth fog: walls are slightly darker
    let depthDim = 1.0 - input.depth * 0.08;
    result *= depthDim;

    // Highlighted cells get a subtle additive tint
    if ((input.flags & 4u) != 0u) {
      let pulse = sin(uniforms.time * 3.0) * 0.05 + 0.1;
      result += vec3<f32>(pulse, pulse * 0.8, 0.0);
    }

    // Fog overlay: wisps and edge tendrils on explored/fading cells
    if (vis < 1.0) {
      let invVis = 1.0 - vis;
      // Fog tendrils reaching in from the edges
      let tendrilStrength = fogEdge(input.worldGridPos, uniforms.time);
      // Fog wisps drifting over remembered terrain
      let fogWisp = fogOfWar(input.worldGridPos + vec2<f32>(50.0, 30.0), uniforms.time * 0.7);
      // Combine: tendrils at edges + very subtle ambient fog
      let fogLayer = fogWisp * 0.6 + vec3<f32>(tendrilStrength * 0.15, tendrilStrength * 0.18, tendrilStrength * 0.4);
      result = result + fogLayer * invVis * 0.3;
    }

    return vec4<f32>(applyPostFX(result, input.position.xy), 1.0);
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
  let overlayLit = max(vis, 0.05);

  // ── DAMAGE_FX: chunky pixelated damage numbers ──
  // Uses textureLoad (nearest-neighbor) instead of textureSample (bilinear)
  // to get hard pixel edges like a bitmap font. Snaps to coarse texel grid.
  if ((input.flags & 16u) != 0u) {
    // Pixelated SDF: snap UV to coarse grid, then textureLoad (no filtering)
    let texDims = vec2<f32>(textureDimensions(sdfAtlas, 0));
    let pixelBlock = 8.0; // each visible "pixel" = 8x8 atlas texels → chunky bitmap look
    let rawTexel = input.atlasUV * texDims;
    let snapped = floor(rawTexel / pixelBlock) * pixelBlock + pixelBlock * 0.5;
    let texCoord = vec2<i32>(clamp(snapped, vec2<f32>(0.5), texDims - 0.5));
    let pixSdf = textureLoad(sdfAtlas, texCoord, 0).r;

    let charPhase = floor(input.worldGridPos.x) * 2.61;
    let pulse = sin(uniforms.time * 4.0 + charPhase) * 0.5 + 0.5;

    // ── FILL — hard binary from pixelated SDF ──
    let fillEdge = uniforms.sdfEdge + 0.05;
    let fillAlpha = step(pixSdf, fillEdge);
    let fillBoost = pulse * 0.1;
    let fillColor = min(input.fg.rgb + fillBoost, vec3<f32>(1.0));
    let fAlpha = fillAlpha * input.fg.a;

    // ── BLACK OUTLINE — thick hard border ──
    let outlineEdge = fillEdge + 0.13;
    let outlineRaw = step(pixSdf, outlineEdge);
    let outlineOnly = max(outlineRaw - fillAlpha, 0.0);
    let blackOutline = vec3<f32>(0.04, 0.04, 0.05);
    let oAlpha = outlineOnly;

    // ── GLOW — soft halo (uses smooth sdfValue, not pixelated) ──
    let glowEdge = outlineEdge + 0.04;
    let glowSpread = spread * 3.0;
    let glowRaw = 1.0 - smoothstep(glowEdge - glowSpread, glowEdge + glowSpread, sdfValue);
    let glowOnly = max(glowRaw - outlineRaw, 0.0);
    let glowColor = input.fg.rgb * (0.2 + pulse * 0.3);
    let gAlpha = glowOnly * (0.25 + pulse * 0.15);

    // ── Composite back-to-front (premultiplied alpha) ──
    var rgb = glowColor * gAlpha;
    var a = gAlpha;
    rgb = rgb * (1.0 - oAlpha) + blackOutline * oAlpha;
    a = a * (1.0 - oAlpha) + oAlpha;
    rgb = rgb * (1.0 - fAlpha) + fillColor * fAlpha;
    a = a * (1.0 - fAlpha) + fAlpha;

    return vec4<f32>(rgb, a);
  }

  let glyphAlpha = sdfAlpha * input.fg.a;
  let glyphColor = input.fg.rgb * overlayLit * glyphAlpha;

  // Outline via bg color (only when bg.a > 0)
  let olAlpha = outlineAlpha * input.bg.a;
  let olColor = input.bg.rgb * overlayLit * olAlpha;
  let totalAlpha = glyphAlpha + olAlpha * (1.0 - glyphAlpha);

  return vec4<f32>(glyphColor + olColor, totalAlpha);
}
