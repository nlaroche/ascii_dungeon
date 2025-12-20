// 2D Terminal Grid Shader
// Renders ASCII characters as textured quads with fg/bg colors
// Includes grid lines and selection outline

struct Uniforms {
  viewProjection: mat4x4<f32>,
  gridSize: vec2<f32>,      // width, height in cells
  cellSize: vec2<f32>,      // pixel size of each cell (with zoom)
  gridOffset: vec2<f32>,    // scroll offset
  time: f32,
  showGrid: f32,            // 1.0 = show grid lines, 0.0 = hide
  selectionX1: f32,         // Selection bounds (-1 = no selection)
  selectionY1: f32,
  selectionX2: f32,
  selectionY2: f32,
  gameBoundsX: f32,         // Game/root node bounds (-1 = none)
  gameBoundsY: f32,
  gameBoundsW: f32,
  gameBoundsH: f32,
}

struct Cell {
  charCode: u32,
  fgColor: u32,
  bgColor: u32,
  flags: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> cells: array<Cell>;
@group(0) @binding(2) var fontTexture: texture_2d<f32>;
@group(0) @binding(3) var fontSampler: sampler;

struct VertexInput {
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) fgColor: vec4<f32>,
  @location(2) bgColor: vec4<f32>,
  @location(3) @interpolate(flat) cellCoord: vec2<f32>,  // Cell x,y for selection/hover (flat = no interpolation)
  @location(4) localPos: vec2<f32>,   // Position within cell (0-1)
}

// Font atlas configuration (must match BitmapFont.ts)
const CHARS_PER_ROW: f32 = 16.0;
const TOTAL_ROWS: f32 = 16.0;

// Unpack RGBA color from u32
fn unpackColor(packed: u32) -> vec4<f32> {
  return vec4<f32>(
    f32(packed & 0xFFu) / 255.0,
    f32((packed >> 8u) & 0xFFu) / 255.0,
    f32((packed >> 16u) & 0xFFu) / 255.0,
    f32((packed >> 24u) & 0xFFu) / 255.0
  );
}

// Get UV coordinates for a character
fn getCharUV(charCode: u32) -> vec4<f32> {
  let col = f32(charCode % 16u);
  let row = f32(charCode / 16u);
  let u0 = col / CHARS_PER_ROW;
  let v0 = row / TOTAL_ROWS;
  let u1 = (col + 1.0) / CHARS_PER_ROW;
  let v1 = (row + 1.0) / TOTAL_ROWS;
  return vec4<f32>(u0, v0, u1, v1);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Calculate cell position from instance index
  let gridWidth = u32(uniforms.gridSize.x);
  let cellX = f32(input.instanceIndex % gridWidth);
  let cellY = f32(input.instanceIndex / gridWidth);

  // Quad vertices (2 triangles, 6 vertices per cell)
  // Vertex order: 0=TL, 1=TR, 2=BL, 3=BL, 4=TR, 5=BR
  var localPos: vec2<f32>;
  var localUV: vec2<f32>;

  switch(input.vertexIndex) {
    case 0u: { localPos = vec2<f32>(0.0, 0.0); localUV = vec2<f32>(0.0, 0.0); }  // TL
    case 1u: { localPos = vec2<f32>(1.0, 0.0); localUV = vec2<f32>(1.0, 0.0); }  // TR
    case 2u: { localPos = vec2<f32>(0.0, 1.0); localUV = vec2<f32>(0.0, 1.0); }  // BL
    case 3u: { localPos = vec2<f32>(0.0, 1.0); localUV = vec2<f32>(0.0, 1.0); }  // BL
    case 4u: { localPos = vec2<f32>(1.0, 0.0); localUV = vec2<f32>(1.0, 0.0); }  // TR
    case 5u, default: { localPos = vec2<f32>(1.0, 1.0); localUV = vec2<f32>(1.0, 1.0); }  // BR
  }

  // Calculate world position (cells go left-to-right, top-to-bottom)
  let worldPos = vec2<f32>(
    (cellX + localPos.x) * uniforms.cellSize.x + uniforms.gridOffset.x,
    (cellY + localPos.y) * uniforms.cellSize.y + uniforms.gridOffset.y
  );

  // Transform to clip space
  output.position = uniforms.viewProjection * vec4<f32>(worldPos.x, worldPos.y, 0.0, 1.0);

  // Get cell data
  let cell = cells[input.instanceIndex];

  // Calculate UV for this character in the font atlas
  let charUV = getCharUV(cell.charCode);
  output.uv = vec2<f32>(
    mix(charUV.x, charUV.z, localUV.x),
    mix(charUV.y, charUV.w, localUV.y)
  );

  // Unpack colors
  output.fgColor = unpackColor(cell.fgColor);
  output.bgColor = unpackColor(cell.bgColor);
  output.cellCoord = vec2<f32>(cellX, cellY);
  output.localPos = localPos;

  return output;
}

// Extract emission from flags (bits 8-15)
fn getEmission(flags: u32) -> f32 {
  return f32((flags >> 8u) & 0xFFu) / 255.0;
}

// Get cell at grid position (with bounds check)
fn getCellAt(x: i32, y: i32) -> Cell {
  let gridW = i32(uniforms.gridSize.x);
  let gridH = i32(uniforms.gridSize.y);
  if (x < 0 || x >= gridW || y < 0 || y >= gridH) {
    return Cell(0u, 0u, 0u, 0u);
  }
  return cells[u32(y * gridW + x)];
}

// Calculate emission contribution from neighboring cells
fn calculateEmissionLight(cellX: i32, cellY: i32) -> vec3<f32> {
  var light = vec3<f32>(0.0);
  let radius = 3;  // Check 3 cells in each direction

  for (var dy = -radius; dy <= radius; dy = dy + 1) {
    for (var dx = -radius; dx <= radius; dx = dx + 1) {
      if (dx == 0 && dy == 0) { continue; }  // Skip self

      let neighbor = getCellAt(cellX + dx, cellY + dy);
      let emission = getEmission(neighbor.flags);

      if (emission > 0.0) {
        // Get neighbor's foreground color as emission color
        let emitColor = unpackColor(neighbor.fgColor).rgb;

        // Distance falloff (1/distance^2 but clamped)
        let dist = sqrt(f32(dx * dx + dy * dy));
        let falloff = 1.0 / (1.0 + dist * dist * 0.5);

        // Add contribution
        light = light + emitColor * emission * falloff;
      }
    }
  }

  return light;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Sample font texture (white on transparent)
  let fontSample = textureSample(fontTexture, fontSampler, input.uv);

  // Font texture is white text, use as mask between fg and bg
  let alpha = fontSample.r;  // Use red channel as alpha

  // Blend foreground and background based on font alpha
  var color = mix(input.bgColor, input.fgColor, alpha);

  // Apply emission lighting from neighboring cells
  let cellX = i32(input.cellCoord.x);
  let cellY = i32(input.cellCoord.y);
  let emissionLight = calculateEmissionLight(cellX, cellY);
  color = vec4<f32>(color.rgb + emissionLight * 0.5, color.a);

  // Also apply self-emission glow
  let selfCell = getCellAt(cellX, cellY);
  let selfEmission = getEmission(selfCell.flags);
  if (selfEmission > 0.0) {
    let emitColor = unpackColor(selfCell.fgColor).rgb;
    color = vec4<f32>(color.rgb + emitColor * selfEmission * 0.3, color.a);
  }

  // Grid line parameters
  let gridLineWidth = 1.0 / uniforms.cellSize.x;  // 1 pixel line width
  let gridLineWidthY = 1.0 / uniforms.cellSize.y;

  // Draw grid lines if enabled - with intensity variation at intervals
  // IMPORTANT: Only draw on LEFT and TOP edges of each cell to avoid doubled lines
  if (uniforms.showGrid > 0.5) {
    // Check if we're on a grid line (LEFT edge only for vertical, TOP edge only for horizontal)
    let onVerticalLine = input.localPos.x < gridLineWidth;
    let onHorizontalLine = input.localPos.y < gridLineWidthY;

    if (onVerticalLine || onHorizontalLine) {
      // Get cell coordinates
      let cellX = i32(input.cellCoord.x);
      let cellY = i32(input.cellCoord.y);

      // Calculate grid line intensity based on position
      // Origin (0,0) and major intervals are brighter
      var intensity = 0.15;  // Base grid line intensity

      // Check for major grid lines (every 10 cells)
      let onMajorX = (cellX % 10 == 0 && onVerticalLine);
      let onMajorY = (cellY % 10 == 0 && onHorizontalLine);
      if (onMajorX || onMajorY) {
        intensity = 0.25;
      }

      // Check for super-major grid lines (every 50 cells)
      let onSuperMajorX = (cellX % 50 == 0 && onVerticalLine);
      let onSuperMajorY = (cellY % 50 == 0 && onHorizontalLine);
      if (onSuperMajorX || onSuperMajorY) {
        intensity = 0.4;
      }

      // Origin lines are brightest
      let onOriginX = (cellX == 0 && onVerticalLine);
      let onOriginY = (cellY == 0 && onHorizontalLine);
      if (onOriginX || onOriginY) {
        intensity = 0.6;
      }

      // Draw grid line with calculated intensity
      color = mix(color, vec4<f32>(0.3, 0.3, 0.35, 1.0), intensity);
    }
  }

  // Selection outline - screen-space sizing (constant pixel width regardless of zoom)
  let hasSelection = uniforms.selectionX1 >= 0.0;
  if (hasSelection) {
    // Use integer cell coordinates for reliable comparison
    let selCellX = u32(input.cellCoord.x);
    let selCellY = u32(input.cellCoord.y);
    let selLocalX = input.localPos.x;
    let selLocalY = input.localPos.y;

    let selX1 = u32(uniforms.selectionX1);
    let selY1 = u32(uniforms.selectionY1);
    let selX2 = u32(uniforms.selectionX2);
    let selY2 = u32(uniforms.selectionY2);

    // Screen-space sizing: 2 pixels regardless of cell size/zoom
    let selEdgeX = 2.0 / uniforms.cellSize.x;  // 2 pixels in screen space
    let selEdgeY = 2.0 / uniforms.cellSize.y;

    // Left edge: cells at selX1, draw on left edge of cell
    let selOnLeft = selCellX == selX1 && selLocalX < selEdgeX && selCellY >= selY1 && selCellY <= selY2;
    // Right edge: cells at selX2, draw on right edge of cell
    let selOnRight = selCellX == selX2 && selLocalX > (1.0 - selEdgeX) && selCellY >= selY1 && selCellY <= selY2;
    // Top edge: cells at selY1, draw on top edge of cell
    let selOnTop = selCellY == selY1 && selLocalY < selEdgeY && selCellX >= selX1 && selCellX <= selX2;
    // Bottom edge: cells at selY2, draw on bottom edge of cell
    let selOnBottom = selCellY == selY2 && selLocalY > (1.0 - selEdgeY) && selCellX >= selX1 && selCellX <= selX2;

    if (selOnLeft || selOnRight || selOnTop || selOnBottom) {
      // Bright white selection outline
      color = mix(color, vec4<f32>(1.0, 1.0, 1.0, 1.0), 0.7);
    }
  }

  // Apply hover highlight - show character preview under cursor
  let cell = cells[u32(input.cellCoord.y) * u32(uniforms.gridSize.x) + u32(input.cellCoord.x)];
  let flags = cell.flags;
  if ((flags & 2u) != 0u) {
    // Hover - visible white tint so user can see the cell
    color = mix(color, vec4<f32>(1.0, 1.0, 1.0, 1.0), 0.35);
  }

  // Draw game bounds as faint tight-dotted border (screen-space sizing)
  let hasGameBounds = uniforms.gameBoundsX >= 0.0;
  if (hasGameBounds) {
    // Use integer cell coordinates for reliable comparison
    let gbCellX = u32(input.cellCoord.x);
    let gbCellY = u32(input.cellCoord.y);
    let gbLocalX = input.localPos.x;
    let gbLocalY = input.localPos.y;

    // Game bounds as integers (grid cell coordinates)
    let gbX1 = u32(uniforms.gameBoundsX);
    let gbY1 = u32(uniforms.gameBoundsY);
    let gbX2 = u32(uniforms.gameBoundsX + uniforms.gameBoundsW - 1.0);  // Inclusive end
    let gbY2 = u32(uniforms.gameBoundsY + uniforms.gameBoundsH - 1.0);

    // Screen-space sizing: 2 pixels regardless of zoom
    let gbEdgeX = 2.0 / uniforms.cellSize.x;
    let gbEdgeY = 2.0 / uniforms.cellSize.y;

    // Tight dot pattern based on screen-space position (constant dot spacing)
    // Use pixel coordinates for consistent dot spacing
    let screenPosX = input.localPos.x * uniforms.cellSize.x;  // Convert to screen pixels
    let screenPosY = input.localPos.y * uniforms.cellSize.y;
    let dotSpacing = 6.0;  // 6 pixels between dots
    let isDotX = fract(screenPosX / dotSpacing) < 0.5;
    let isDotY = fract(screenPosY / dotSpacing) < 0.5;

    // Draw dots on border edges (same logic as selection but with dot pattern)
    let gbOnLeft = gbCellX == gbX1 && gbLocalX < gbEdgeX && gbCellY >= gbY1 && gbCellY <= gbY2 && isDotY;
    let gbOnRight = gbCellX == gbX2 && gbLocalX > (1.0 - gbEdgeX) && gbCellY >= gbY1 && gbCellY <= gbY2 && isDotY;
    let gbOnTop = gbCellY == gbY1 && gbLocalY < gbEdgeY && gbCellX >= gbX1 && gbCellX <= gbX2 && isDotX;
    let gbOnBottom = gbCellY == gbY2 && gbLocalY > (1.0 - gbEdgeY) && gbCellX >= gbX1 && gbCellX <= gbX2 && isDotX;

    if (gbOnLeft || gbOnRight || gbOnTop || gbOnBottom) {
      // White alpha for game bounds (dotted pattern distinguishes from solid selection)
      color = mix(color, vec4<f32>(1.0, 1.0, 1.0, 1.0), 0.4);
    }
  }

  return color;
}
