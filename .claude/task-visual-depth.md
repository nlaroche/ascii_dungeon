Add visual depth effects to the tilemap renderer for a fake 3D look.

## Changes to `src/renderer/shaders/tilemap.wgsl`

### 1. Parallax by depth (vertex shader)
Currently line 71 applies camera offset uniformly:
```wgsl
pixelPos += uniforms.cameraOffset;
```

Change to depth-scaled parallax:
```wgsl
// Parallax: walls (depth=1) shift less than floors (depth=0) when camera pans
let parallaxScale = 1.0 - cell.depth * uniforms.parallaxStrength;
pixelPos += uniforms.cameraOffset * parallaxScale;
```

This makes walls appear to be on a different visual plane than floors.

### 2. Wall height offset (vertex shader)
After the parallax calculation, add a vertical shift for walls:
```wgsl
// Wall height: walls shift upward to create "rising" illusion
pixelPos.y -= cell.depth * uniforms.cellPixelSize.y * 0.3;
```

This makes walls look like they "rise up" from the floor — Q*bert style.

### 3. Depth-based ambient darkening (fragment shader)
In fragmentMain, after computing `result`, darken based on depth. Add this BEFORE the highlighted check:
```wgsl
// Depth fog: walls are slightly darker, creating visual separation
let depthDim = 1.0 - input.depth * 0.12;
result *= depthDim;
```

Note: `input.depth` doesn't exist yet — need to pass depth through VertexOutput.

### 4. Pass depth through VertexOutput
Add to VertexOutput struct:
```wgsl
@location(5) @interpolate(flat) depth: f32,
```

In vertexMain, set:
```wgsl
output.depth = cell.depth;
```

### 5. Better floor lighting (fragment shader)
Currently line 107:
```wgsl
let bgColor = vec4<f32>(input.bg.rgb * lit * 0.3, 1.0);
```

Change to depth-dependent: floors (depth=0) get more bg light, walls (depth=1) get less:
```wgsl
let bgLightScale = mix(0.4, 0.2, input.depth);
let bgColor = vec4<f32>(input.bg.rgb * lit * bgLightScale, 1.0);
```

## Changes to `src/renderer/TilemapRenderer.js`

Make parallaxStrength configurable instead of hardcoded 0.5:
- Add `parallaxStrength` to the returned object (default 0.5)
- In the render function, use `parallaxStrength` instead of hardcoded value at line 216

## Changes to `src/renderer/Renderer.js`

Add `parallaxStrength` property:
- In constructor: `this.parallaxStrength = 0.3;`
- In render(): pass `this.parallaxStrength` to tilemap.render()

The tilemap.render() function signature needs to accept parallaxStrength. Add it as an optional parameter or set it directly on the tilemap object before render.

## CRITICAL WGSL RULES
- Do NOT use `smooth` as a variable name (reserved keyword) — use `spread` instead
- `textureSample()` MUST remain BEFORE any non-uniform control flow (if/return)
- Storage buffer visibility must be `'read-only-storage'`
