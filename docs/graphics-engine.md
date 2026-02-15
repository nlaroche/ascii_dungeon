# Feature Spec: ASCII Graphics Engine

## Overview
Complete rewrite of the rendering pipeline from Canvas2D text upload to a full GPU-native ASCII rendering engine. Features SDF (Signed Distance Field) glyph rendering, GPU-instanced tilemap, 2.5D depth layers with parallax, GPU raymarched 2D lighting with dynamic shadows, hybrid particle system (ASCII + pixel), tweened animations between map states, and a comprehensive post-processing stack. The Graphics Lab workbench section provides real-time control over every parameter.

## Architecture Summary

```
Game State (CPU)
  │
  ├─ Tilemap Buffer ──────► GPU Tile Instances (glyph, fg, bg, depth, light)
  ├─ Light Sources ────────► GPU 2D Raymarched Lightmap
  ├─ Particle Emitters ───► GPU Particle Buffer (position, velocity, life, type)
  ├─ Tween Queue ──────────► CPU interpolation → tile buffer updates
  │
  └─ Render Pipeline:
       Pass 1: Lightmap generation (raymarched shadows)
       Pass 2: Tilemap rendering (SDF glyphs × lighting × depth)
       Pass 3: Particle rendering (instanced quads)
       Pass 4: Composite + post-processing (bloom, CRT, chromatic, color grade)
```

---

## Phase 1: SDF Glyph Atlas + GPU Tilemap Renderer

### Goal
Replace Canvas2D text rendering with a GPU-instanced tilemap where each cell is a quad textured from an SDF glyph atlas. Every cell has independent foreground color, background color, glyph index, and depth value.

### Acceptance Criteria

- [ ] Create `src/renderer/SDFAtlas.js`:
  - Generates an SDF atlas texture from a monospace font at build time (using Canvas2D + CPU SDF generation)
  - Atlas layout: 16×6 grid (characters 32-127), each cell 64×64 pixels
  - SDF generation: for each pixel, compute distance to nearest edge of the glyph (positive outside, negative inside), normalize to 0-1 range, store in single-channel texture
  - Export: `createSDFAtlas(device, fontFamily, fontSize)` → returns `{ texture, charWidth, charHeight, getUV(charCode) }`
  - The `getUV(charCode)` function returns `{ u0, v0, u1, v1 }` for the character's position in the atlas
  - Must handle the full printable ASCII range (32-126)

- [ ] Create `src/renderer/TilemapRenderer.js`:
  - Manages a tilemap as a GPU storage buffer, NOT individual draw calls
  - Tilemap data structure per cell (packed into a storage buffer):
    ```
    struct Cell {
      glyph: u32,       // ASCII code (32-126)
      fg: u32,          // packed RGBA foreground
      bg: u32,          // packed RGBA background
      depth: f32,       // Z-layer (0.0 = floor, 0.5 = objects, 1.0 = ceiling)
      light: f32,       // light intensity (0.0-1.0), written by lighting pass
      flags: u32,       // bitflags: BIT0=visible, BIT1=explored, BIT2=highlighted
    }
    ```
  - Export: `createTilemapRenderer(device, format, atlas)` → renderer object
  - Method: `setTile(x, y, glyph, fg, bg, depth, flags)` — updates CPU buffer
  - Method: `setTileRange(tiles)` — batch update from array of `{x, y, glyph, fg, bg, depth, flags}`
  - Method: `upload()` — copies CPU buffer to GPU
  - Method: `render(passEncoder, uniforms)` — draws all tiles as instanced quads
  - Tilemap size: configurable, default 80×50 (4000 cells)
  - Uses instanced rendering: 1 quad template, N instances reading from storage buffer

- [ ] WGSL shader `src/renderer/shaders/tilemap.wgsl`:
  - Vertex shader: reads cell data from storage buffer using `instance_index`, positions quad at grid position, applies 2.5D depth offset (parallax shift based on `depth` and camera offset uniform)
  - Fragment shader: samples SDF atlas, applies SDF thresholding for crisp edges at any zoom:
    - `smoothstep(0.45, 0.55, sdfValue)` for standard rendering
    - Glyph foreground color from cell `fg`, background from cell `bg`
    - Multiply foreground by `cell.light` value
    - Discard fully transparent pixels for layering
  - Uniforms: `resolution`, `time`, `gridSize`, `cellPixelSize`, `cameraOffset` (vec2 for parallax)

- [ ] Refactor `src/renderer/Renderer.js`:
  - Replace `createTextTexture()` and `renderTextToTexture()` with tilemap system
  - Constructor takes config: `{ gridWidth, gridHeight, cellSize }`
  - Keep `init()` async, now also creates SDF atlas and tilemap renderer
  - New method: `setCell(x, y, char, fgColor, bgColor, depth)` — converts char to glyph index, color string to packed u32
  - New method: `setCells(cellArray)` — batch version
  - New method: `clearGrid()` — resets all cells to empty
  - Keep existing `startLoop()` and `render()` but rewrite render to use tilemap pass
  - Remove `drawText()` and `pendingText` — replaced by `setCell`/`setCells`
  - Add `colorToU32(cssColor)` utility that converts '#rrggbb' or 'rgb(...)' to packed RGBA u32

- [ ] Refactor `src/game/Game.js`:
  - Replace `renderDungeon()` to use `renderer.setCell()` per tile instead of building ASCII string
  - Replace `renderSummary()`, `renderTown()`, `renderHUD()` to use `setCells()` for text rendering (iterate over string chars, place each at grid position)
  - Create helper: `renderString(x, y, text, fg, bg)` that sets cells for a string at grid coordinates
  - All existing game functionality must work identically after refactor

- [ ] Build must pass with no warnings about unused imports

### Technical Constraints
- SDF atlas generation happens once at init, NOT every frame
- Tilemap buffer upload happens once per frame via `upload()`, NOT per-cell
- The shader must handle the full 80×50 grid at 60fps without dropped frames
- Color packing: `(r << 24) | (g << 16) | (b << 8) | a` where r,g,b,a are 0-255
- Do NOT use `createRenderPipeline` with `'auto'` layout — define explicit bind group layouts for composability with later passes

### Files to Create
- `src/renderer/SDFAtlas.js` — SDF glyph atlas generator
- `src/renderer/TilemapRenderer.js` — GPU tilemap instance renderer
- `src/renderer/shaders/tilemap.wgsl` — tilemap vertex + fragment shader

### Files to Modify
- `src/renderer/Renderer.js` — rewrite to use tilemap pipeline
- `src/game/Game.js` — adapt all render methods to cell-based API
- `src/lib/index.js` — no changes needed (pure lib unchanged)

### Implementation Notes
- For SDF generation, use the "dead reckoning" algorithm: render glyph to canvas at high res, then for each pixel compute min distance to edge. This is O(n²) but only runs once.
- Pack the SDF into an `r8unorm` texture (single channel, 8-bit). The shader only needs the distance value.
- For instanced rendering, use `@builtin(instance_index)` in WGSL to index into the cell storage buffer.
- Parallax formula: `screenPos.x += cell.depth * cameraOffset.x * parallaxStrength`

---

## Phase 2: GPU Raymarched Lighting + Dynamic Shadows

### Goal
Add a real-time 2D lighting system computed entirely on the GPU. Point lights (torches, spells, player glow) cast light that is blocked by wall tiles, creating dynamic shadows. Light values are written to each cell's `light` field and read during tilemap rendering.

### Acceptance Criteria

- [ ] Create `src/renderer/LightingPass.js`:
  - Manages a list of point lights: `{ x, y, radius, intensity, color: [r,g,b] }`
  - Uploads light data to a GPU storage buffer (max 64 lights)
  - Uploads wall/occluder data as a 2D texture (1 = wall/opaque, 0 = passable) from the tilemap
  - Runs a compute shader that generates a lightmap texture (same dimensions as tilemap grid)
  - Export: `createLightingPass(device, gridWidth, gridHeight)` → lighting object
  - Method: `setLights(lightArray)` — update light sources
  - Method: `setOccluders(occluderGrid)` — update wall map (2D array of 0/1)
  - Method: `compute(commandEncoder)` — dispatch compute shader
  - Method: `getLightmapTexture()` — returns the GPU texture for the tilemap pass to read

- [ ] WGSL compute shader `src/renderer/shaders/lighting.wgsl`:
  - Workgroup size: 8×8
  - For each cell in the grid, iterate over all lights
  - For each light, cast a ray from the cell to the light position
  - Step along the ray checking the occluder texture — if any wall cell is hit, the light is blocked (shadow)
  - If not blocked, add `light.intensity * falloff(distance, light.radius)` to the cell's light value
  - Falloff function: `max(0, 1 - (distance / radius)²)` — smooth inverse-square
  - Accumulate color: `cellLight.rgb += light.color * contribution`
  - Ambient light uniform: base light level so unlit areas aren't pure black (default 0.05)
  - Output: `rgba16float` texture where RGB = light color, A = total intensity

- [ ] Integrate lighting into `src/renderer/TilemapRenderer.js`:
  - Tilemap fragment shader reads from the lightmap texture
  - Foreground color is multiplied by lightmap color: `finalFg = fg * lightColor`
  - Background color is also modulated: `finalBg = bg * (ambient + lightColor * 0.3)`
  - Add lightmap texture + sampler to the tilemap bind group

- [ ] Create `src/lib/lighting.js` (pure functions):
  - `createLight(x, y, radius, intensity, color)` — factory
  - `createLightingState(lights)` — returns `{ lights, dirty: true }`
  - `addLight(state, light)` → new state
  - `removeLight(state, index)` → new state
  - `moveLight(state, index, x, y)` → new state
  - `getLightsForDungeon(dungeon)` — auto-generates lights from dungeon features:
    - Torch on wall → warm orange light (radius 6, color [1.0, 0.7, 0.3])
    - Player → dim white light (radius 4, color [0.8, 0.8, 1.0])
    - Treasure → faint gold glow (radius 3, color [1.0, 0.9, 0.4])
    - Enemy → faint red glow (radius 2, color [1.0, 0.2, 0.2])

- [ ] Update `src/game/Game.js`:
  - After generating dungeon, call `getLightsForDungeon()` to create light sources
  - Pass lights and occluder grid to renderer each frame
  - Player light follows player position
  - When enemy is killed, remove its light
  - When treasure is collected, remove its light

- [ ] Update `src/renderer/Renderer.js`:
  - Create `LightingPass` during init
  - New method: `setLights(lights)` — passes to lighting pass
  - New method: `setOccluders(grid)` — passes to lighting pass
  - In render loop: run lighting compute before tilemap render
  - Pass lightmap texture to tilemap renderer

- [ ] Build must pass

### Technical Constraints
- Compute shader must handle 80×50 grid × 64 lights within 2ms (budget for 60fps)
- Ray stepping uses integer grid coordinates (Bresenham-like), NOT floating-point raymarching
- The occluder texture is `r8uint` format, updated only when the dungeon changes (not every frame)
- Lightmap is `rgba16float` for HDR light accumulation (needed for bloom pass later)
- Light data buffer: `struct Light { pos: vec2<f32>, radius: f32, intensity: f32, color: vec3<f32>, padding: f32 }` — 32 bytes per light

### Files to Create
- `src/renderer/LightingPass.js` — GPU lighting compute
- `src/renderer/shaders/lighting.wgsl` — raymarched lighting compute shader
- `src/lib/lighting.js` — pure light management functions

### Files to Modify
- `src/renderer/TilemapRenderer.js` — read lightmap in fragment shader
- `src/renderer/shaders/tilemap.wgsl` — multiply tile color by lightmap
- `src/renderer/Renderer.js` — integrate lighting pass
- `src/game/Game.js` — generate and manage lights
- `src/lib/index.js` — re-export lighting module

---

## Phase 3: Particle System + Tweened Animations

### Goal
Add a GPU-driven particle system supporting both ASCII-character particles and pixel-dot particles. Add a tween engine for smooth animations between game states (tile transitions, camera movement, damage flash, etc).

### Acceptance Criteria

- [ ] Create `src/renderer/ParticleSystem.js`:
  - GPU-instanced particle rendering with storage buffer
  - Particle data structure:
    ```
    struct Particle {
      pos: vec2<f32>,        // world position (grid coords, fractional)
      vel: vec2<f32>,        // velocity (grid cells per second)
      life: f32,             // remaining life (0-1, decreasing)
      maxLife: f32,          // initial life for age calculation
      size: f32,             // scale factor
      type: u32,             // 0=pixel, 1=ascii
      glyph: u32,            // ASCII code if type=1
      color: u32,            // packed RGBA
      flags: u32,            // BIT0=gravity, BIT1=fade, BIT2=shrink, BIT3=glow
    }
    ```
  - Max particles: 4096 (configurable)
  - Export: `createParticleSystem(device, format, atlas, maxParticles)` → system object
  - Method: `emit(emitter)` — add particles from an emitter config
  - Method: `update(dt)` — advance particle simulation (GPU compute)
  - Method: `render(passEncoder, uniforms)` — draw living particles
  - Emitter config: `{ x, y, count, spread, speed, life, type, glyph, color, gravity, fade, shrink, glow }`

- [ ] WGSL compute shader `src/renderer/shaders/particles_update.wgsl`:
  - Workgroup size: 256 (1D dispatch)
  - For each particle: update position by velocity × dt, apply gravity if flagged, decrease life by dt/maxLife
  - Dead particles (life <= 0): mark as inactive (set life to -1)

- [ ] WGSL render shader `src/renderer/shaders/particles_render.wgsl`:
  - Vertex shader: read particle from storage buffer, create billboard quad at particle position
  - Fragment shader: for ASCII particles, sample SDF atlas at particle glyph UV, apply particle color and alpha (faded by life if fade flag set). For pixel particles, render a circular dot with soft edges.
  - Blend mode: additive for glow particles, alpha blend for others

- [ ] Create `src/lib/particles.js` (pure emitter presets):
  - `emitterPresets` object with named presets:
    - `hit`: red ASCII '*' burst, 5-10 particles, fast velocity, short life, gravity
    - `kill`: mix of red '.' pixels and bone ASCII chars, 15-20 particles, explosion pattern
    - `treasure`: gold '*' and '$' ASCII, 8-12 particles, float upward, fade
    - `magic`: blue/purple '~' and '°' ASCII, 10-15 particles, spiral pattern, glow
    - `torch`: orange/yellow pixel dots, 2-4 per frame, float up, short life, glow
    - `footstep`: gray '.' pixels, 1-2 particles, low velocity, very short life
    - `levelup`: rainbow ASCII '!' and '★', 20-30 particles, radial burst, long life
    - `heal`: green '+' ASCII, 5-8 particles, float up, fade
  - `createEmitter(presetName, x, y, overrides)` — returns emitter config
  - All presets are pure data objects, no side effects

- [ ] Create `src/lib/tween.js` (pure tween engine):
  - Easing functions: `linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeOutBounce`, `easeOutElastic`, `easeOutBack`
  - `ease(type, t)` — takes easing name and normalized time (0-1), returns eased value (0-1)
  - `createTween(from, to, duration, easingType)` → tween object `{ from, to, duration, easing, elapsed: 0 }`
  - `updateTween(tween, dt)` → `{ ...tween, elapsed: tween.elapsed + dt, value: interpolated, done: boolean }`
  - `interpolateColor(colorA, colorB, t)` — lerp between two '#rrggbb' colors
  - `createTweenGroup(tweens)` → group object for coordinating multiple tweens
  - `updateTweenGroup(group, dt)` → updated group with all tweens advanced

- [ ] Create `src/renderer/AnimationManager.js`:
  - Bridges tween lib with renderer — applies tween values to tiles
  - Method: `animateTile(x, y, property, from, to, duration, easing)` — animate a tile's fg, bg, depth, or glyph
  - Method: `animateCamera(fromOffset, toOffset, duration, easing)` — smooth camera pan (parallax offset)
  - Method: `screenShake(intensity, duration)` — adds decaying random offset to camera
  - Method: `screenFlash(color, duration)` — overlay a color that fades out
  - Method: `update(dt)` — advance all active animations, clean up finished ones
  - Method: `getActiveCount()` — number of running animations

- [ ] Integrate particles into `src/game/Game.js`:
  - On combat hit → emit `hit` particles at target position
  - On enemy kill → emit `kill` particles
  - On treasure collect → emit `treasure` particles
  - On level up → emit `levelup` particles
  - On heal → emit `heal` particles
  - Torch tiles continuously emit `torch` particles
  - Player movement emits `footstep` particles at previous position

- [ ] Integrate tweens into `src/game/Game.js`:
  - When player moves, tween the player tile from old position to new position (200ms, easeOutQuad)
  - When enemy is killed, flash the tile white then fade to empty (300ms)
  - When entering a new dungeon, animate camera pan to starting position
  - On damage taken, screen shake (200ms, intensity proportional to damage)
  - On critical hit or kill, brief screen flash (100ms, white at 0.3 alpha)

- [ ] Update `src/renderer/Renderer.js`:
  - Create particle system and animation manager during init
  - Method: `emitParticles(emitter)` — delegates to particle system
  - Method: `animate(...)` — delegates to animation manager
  - In render loop: update particles, update animations, render particles after tilemap

- [ ] Build must pass

### Technical Constraints
- Particle update is a GPU compute shader, NOT CPU-side
- Max 4096 particles — dead particles are recycled (ring buffer or free list)
- Tween functions in `src/lib/tween.js` must be pure (no timers, no requestAnimationFrame)
- AnimationManager updates are driven by the render loop's dt, NOT independent timers
- Particle rendering uses alpha blending with depth test disabled (particles render on top)
- ASCII particles reuse the SDF atlas from Phase 1

### Files to Create
- `src/renderer/ParticleSystem.js` — GPU particle management
- `src/renderer/shaders/particles_update.wgsl` — particle compute shader
- `src/renderer/shaders/particles_render.wgsl` — particle render shader
- `src/renderer/AnimationManager.js` — tween-to-renderer bridge
- `src/lib/particles.js` — pure emitter presets
- `src/lib/tween.js` — pure tween/easing functions

### Files to Modify
- `src/renderer/Renderer.js` — integrate particle system and animation manager
- `src/game/Game.js` — emit particles and trigger animations on game events
- `src/lib/index.js` — re-export particles and tween modules

---

## Phase 4: Post-Processing Stack + Graphics Lab Workbench

### Goal
Multi-pass post-processing pipeline with configurable effects. The Graphics Lab workbench section provides real-time controls for every rendering parameter.

### Acceptance Criteria

#### Post-Processing Pipeline

- [ ] Create `src/renderer/PostProcessStack.js`:
  - Manages a chain of post-processing passes, each reading from the previous pass's output
  - Render target management: ping-pong between two offscreen textures
  - Method: `addPass(name, shaderModule, uniforms)` — register a post-process pass
  - Method: `setPassEnabled(name, enabled)` — toggle individual passes
  - Method: `setPassUniform(name, key, value)` — update a pass's parameters
  - Method: `render(commandEncoder, inputTexture, outputView)` — run all enabled passes
  - Default pass order: Bloom → Chromatic Aberration → Scanlines → CRT Curvature → Vignette → Color Grading

- [ ] WGSL shader `src/renderer/shaders/bloom.wgsl`:
  - Two-pass Gaussian blur (horizontal then vertical) on bright pixels
  - Brightness threshold uniform (default 0.8): pixels above this contribute to bloom
  - Blur radius uniform (default 4 pixels)
  - Bloom intensity uniform (default 0.3): strength of additive bloom
  - Extracts bright regions → blurs → adds back to scene

- [ ] WGSL shader `src/renderer/shaders/chromatic.wgsl`:
  - Offsets R, G, B channels by different amounts based on distance from screen center
  - Intensity uniform (default 0.003): max pixel offset in UV space
  - Radial falloff: stronger at edges, zero at center

- [ ] WGSL shader `src/renderer/shaders/scanlines.wgsl`:
  - Horizontal scanline darkening with configurable:
    - Intensity (0-1, default 0.04)
    - Line frequency (default: 1.5× vertical resolution)
    - Flicker: subtle time-based intensity variation

- [ ] WGSL shader `src/renderer/shaders/crt.wgsl`:
  - Barrel distortion (CRT curvature): warp UV coordinates toward edges
  - Curvature uniform (default 0.02)
  - Optional: rounded screen corners with dark falloff

- [ ] WGSL shader `src/renderer/shaders/vignette.wgsl`:
  - Darken edges of screen based on distance from center
  - Intensity uniform (default 0.5)
  - Softness uniform (default 0.5): how gradual the falloff is

- [ ] WGSL shader `src/renderer/shaders/colorgrade.wgsl`:
  - Per-channel color adjustments:
    - Brightness (-1 to 1, default 0)
    - Contrast (0 to 2, default 1)
    - Saturation (0 to 2, default 1)
  - Tint color (RGB multiplier, default [1,1,1])
  - Preset tints for biomes: `cave: [0.7, 0.8, 1.0]`, `lava: [1.0, 0.8, 0.7]`, `forest: [0.8, 1.0, 0.8]`, `void: [0.6, 0.5, 0.8]`

- [ ] Integrate into `src/renderer/Renderer.js`:
  - Render tilemap + particles to an offscreen texture (not directly to swapchain)
  - Run post-process stack on the offscreen texture
  - Final output to swapchain
  - Method: `setPostProcessParam(passName, key, value)` — expose to game/workbench
  - Method: `setPostProcessEnabled(passName, enabled)` — toggle passes
  - Method: `getPostProcessDefaults()` — returns all default param values

#### Screen Effects

- [ ] Add screen shake to `AnimationManager`:
  - Applies a decaying random offset to the camera uniform
  - `screenShake(intensity, duration, decay)` — intensity in pixels, decay curve
  - Updated each frame, offset approaches zero over duration

- [ ] Add screen flash to post-process stack:
  - Overlay a solid color with alpha that fades to zero
  - `screenFlash(color, alpha, duration)` — one-shot effect
  - Renders as a final fullscreen pass with alpha blend

#### Graphics Lab Workbench Section

- [ ] Rewrite `src/workbench/sections/GraphicsLab.svelte`:
  - Embedded canvas that creates its own `Renderer` instance for live preview
  - Demo scene: a small dungeon (10×10) with player, enemies, torches, treasure — uses real game data structures
  - Generates lights automatically from the demo dungeon
  - Sections (collapsible panels):

  **SDF & Tilemap**
  - Font family selector (monospace, Courier New, Consolas, custom)
  - Cell size slider (8-32px)
  - SDF edge softness slider (affects smoothstep range)
  - Grid overlay toggle
  - Foreground/background color pickers for demo tiles

  **Lighting**
  - Ambient light slider (0-0.3)
  - Click to place/remove point lights on the demo grid
  - Per-light controls: radius slider (1-20), intensity slider (0-2), color picker
  - Shadow toggle (on/off)
  - Shadow quality: ray step count slider (8-64)

  **Particles**
  - Dropdown to select emitter preset
  - "Emit" button: fires the selected preset at grid center
  - Override controls: count, speed, life, gravity toggle, glow toggle
  - Live particle count display
  - "Continuous" toggle: keeps emitting at set interval

  **Animations**
  - Easing function dropdown (all 10 types from tween.js)
  - Duration slider (100ms-3000ms)
  - Preview: a '@' character moves from point A to point B using selected easing
  - "Play" / "Reset" buttons
  - Screen shake test button (configurable intensity)
  - Screen flash test button (configurable color)

  **Post-Processing**
  - Per-effect toggle (on/off) for each of the 6 passes
  - Per-effect parameter sliders:
    - Bloom: threshold, radius, intensity
    - Chromatic: intensity
    - Scanlines: intensity, frequency
    - CRT: curvature
    - Vignette: intensity, softness
    - Color grade: brightness, contrast, saturation, tint color
  - "Biome Presets" buttons: Cave, Lava, Forest, Void — sets color grading presets
  - "Reset All" button restoring defaults

  **Tick Control**
  - FPS slider (1-60)
  - Pause/Resume toggle
  - Step forward one tick button
  - Current tick counter
  - FPS counter display (actual measured FPS)

- [ ] Create `src/workbench/components/CollapsiblePanel.svelte`:
  - Title bar with expand/collapse toggle
  - Props: `title`, `expanded` (default true)
  - Click title to toggle, smooth height animation

- [ ] Create `src/workbench/components/ColorPicker.svelte`:
  - Labeled color input (`<input type="color">`) with hex value display
  - Props: `label`, `value`
  - Dispatches `change` event

- [ ] Build must pass

### Technical Constraints
- Post-process passes use ping-pong textures: render pass A to texture 1, pass B reads texture 1 and writes to texture 2, etc.
- All shader files are imported as strings (use Vite's `?raw` suffix for `.wgsl` files, or inline as template literals)
- The Graphics Lab renderer instance is SEPARATE from the game renderer — it creates its own WebGPU device and canvas context
- Graphics Lab must be fully functional even when the game is not running
- All post-process parameters must have sane defaults that look good out of the box
- Bloom requires a half-resolution intermediate texture for the blur passes

### Vite WGSL Import Strategy
- Option A: Store shaders as `.wgsl` files and import with `?raw` → `import shaderCode from './shaders/tilemap.wgsl?raw'`
- Option B: Keep shaders as template literal strings inside JS files
- Choose Option A if Vite handles it cleanly, Option B as fallback. Either way, shaders must NOT be fetched at runtime.

### Files to Create
- `src/renderer/PostProcessStack.js` — multi-pass post-processing manager
- `src/renderer/shaders/bloom.wgsl` — bloom effect
- `src/renderer/shaders/chromatic.wgsl` — chromatic aberration
- `src/renderer/shaders/scanlines.wgsl` — scanline effect
- `src/renderer/shaders/crt.wgsl` — CRT curvature
- `src/renderer/shaders/vignette.wgsl` — vignette darkening
- `src/renderer/shaders/colorgrade.wgsl` — color grading
- `src/workbench/sections/GraphicsLab.svelte` — complete rewrite
- `src/workbench/components/CollapsiblePanel.svelte`
- `src/workbench/components/ColorPicker.svelte`

### Files to Modify
- `src/renderer/Renderer.js` — render to offscreen texture, run post-process stack
- `src/renderer/AnimationManager.js` — add screen shake/flash
- `src/lib/index.js` — no new lib exports needed
- `src/workbench/Workbench.svelte` — ensure GraphicsLab section is registered

---

## Cross-Cutting Technical Notes

### WebGPU Compatibility
- All GPU features require WebGPU (Chrome 113+, Edge 113+)
- If WebGPU is unavailable, the renderer should fall back to a basic Canvas2D mode:
  - No SDF (use regular `fillText`)
  - No lighting (uniform brightness)
  - No particles (skip)
  - No post-processing (skip)
  - The Graphics Lab should display "WebGPU required for full features" and disable GPU-specific controls

### Performance Budgets
- Tilemap render: < 1ms for 80×50 grid
- Lighting compute: < 2ms for 64 lights on 80×50 grid
- Particle update + render: < 1ms for 4096 particles
- Post-processing (all 6 passes): < 2ms total
- Target: 60fps with all systems active on mid-range GPU

### Color Convention
- All colors in the pure lib modules (`src/lib/`) use CSS color strings ('#rrggbb')
- All colors in the renderer use packed u32 (RGBA)
- Conversion happens at the renderer boundary, NOT in lib code

### Depth Layering (2.5D)
- `depth: 0.0` — floor tiles, explored markers
- `depth: 0.2` — items on floor (treasure, potions)
- `depth: 0.5` — entities (player, enemies)
- `depth: 0.7` — wall tops, tall objects
- `depth: 1.0` — ceiling, overhead effects
- Parallax formula: `offset = depth * cameraVelocity * parallaxScale`
- This creates a subtle depth illusion when the camera moves
