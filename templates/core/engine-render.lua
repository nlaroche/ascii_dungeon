-- ═══════════════════════════════════════════════════════════════════════════
-- Engine Render - WebGPU Pipeline Configuration
-- Defines how the game world is rendered. Templates can customize camera,
-- lighting, post-processing, and rendering modes.
-- ═══════════════════════════════════════════════════════════════════════════

local Render = {}

-- Current render configuration
local config = {}

-- ─────────────────────────────────────────────────────────────────────────────
-- Render Modes
-- ─────────────────────────────────────────────────────────────────────────────

Render.Modes = {
  -- 3D isometric view (default RPG style)
  isometric = {
    camera = {
      type = "orthographic",
      angle = { pitch = 45, yaw = 45 },
      zoom = { min = 0.5, max = 4.0, default = 1.0 },
      pan = true,
      rotate = false,
    },
    grid = {
      enabled = true,
      size = 1.0,
      divisions = 10,
      color = { 0.3, 0.3, 0.3, 0.5 },
    },
    lighting = {
      ambient = { 0.3, 0.3, 0.4 },
      directional = {
        direction = { -0.5, -1.0, -0.5 },
        color = { 1.0, 0.95, 0.9 },
        intensity = 1.0,
        shadows = true,
      },
    },
  },

  -- 2D top-down view (card games, board games)
  table = {
    camera = {
      type = "orthographic",
      angle = { pitch = 90, yaw = 0 },  -- Looking straight down
      zoom = { min = 0.25, max = 2.0, default = 1.0 },
      pan = true,
      rotate = false,
    },
    grid = {
      enabled = false,
    },
    lighting = {
      ambient = { 0.8, 0.8, 0.8 },
      directional = {
        direction = { 0, -1, 0 },
        color = { 1.0, 1.0, 1.0 },
        intensity = 0.3,
        shadows = false,
      },
    },
    background = { 0.15, 0.12, 0.1 },  -- Table felt color
  },

  -- 2D side-scrolling (platformers)
  sidescroll = {
    camera = {
      type = "orthographic",
      angle = { pitch = 0, yaw = 0 },
      zoom = { min = 0.5, max = 3.0, default = 1.0 },
      pan = true,
      rotate = false,
      followPlayer = true,
    },
    grid = {
      enabled = true,
      size = 1.0,
      snap = true,
    },
    lighting = {
      ambient = { 0.5, 0.5, 0.6 },
    },
  },

  -- Free 3D camera (first-person, third-person)
  free3d = {
    camera = {
      type = "perspective",
      fov = 60,
      near = 0.1,
      far = 1000,
      controls = "orbit",  -- or "fly", "fps"
    },
    grid = {
      enabled = true,
      size = 1.0,
      fadeDistance = 50,
    },
    lighting = {
      ambient = { 0.2, 0.2, 0.25 },
      directional = {
        direction = { -0.3, -0.8, -0.5 },
        color = { 1.0, 0.98, 0.95 },
        intensity = 1.2,
        shadows = true,
        cascades = 3,
      },
    },
    skybox = "default",
  },
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Configuration
-- ─────────────────────────────────────────────────────────────────────────────

function Render.configure(options)
  -- Start with a mode preset if specified
  if options.mode and Render.Modes[options.mode] then
    config = Render.deepMerge({}, Render.Modes[options.mode])
  else
    config = {}
  end

  -- Override with custom options
  config = Render.deepMerge(config, options)

  -- Ensure required fields exist
  config.camera = config.camera or Render.Modes.isometric.camera
  config.lighting = config.lighting or Render.Modes.isometric.lighting

  return config
end

function Render.getConfig()
  return config
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Post-Processing
-- ─────────────────────────────────────────────────────────────────────────────

Render.PostProcess = {
  none = {},

  retro = {
    pixelate = { scale = 2 },
    colorDepth = 16,
    dither = true,
  },

  cinematic = {
    bloom = { threshold = 0.8, intensity = 0.5 },
    vignette = { intensity = 0.3 },
    colorGrade = { contrast = 1.1, saturation = 0.9 },
  },

  noir = {
    desaturate = 1.0,
    contrast = 1.3,
    vignette = { intensity = 0.5 },
    grain = { intensity = 0.1 },
  },

  fantasy = {
    bloom = { threshold = 0.6, intensity = 0.4 },
    colorGrade = { warmth = 0.1, saturation = 1.1 },
  },
}

function Render.setPostProcess(preset)
  if type(preset) == "string" then
    config.postProcess = Render.PostProcess[preset] or {}
  else
    config.postProcess = preset
  end
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Glyph/Sprite Rendering (for ASCII/2D games)
-- ─────────────────────────────────────────────────────────────────────────────

Render.GlyphConfig = {
  font = "default",           -- Font atlas to use
  size = 1.0,                 -- Base glyph size in world units
  billboarding = "none",      -- "none", "y-axis", "full"
  pixelPerfect = false,       -- Snap to pixel grid
  outlines = false,           -- Draw glyph outlines
  shadows = {
    enabled = false,
    offset = { 0.05, -0.05 },
    color = { 0, 0, 0, 0.5 },
  },
}

function Render.setGlyphConfig(options)
  config.glyphs = Render.deepMerge(Render.GlyphConfig, options or {})
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Layer System
-- ─────────────────────────────────────────────────────────────────────────────

-- Layers control render order and can have different render settings
Render.Layers = {
  background = { order = 0, parallax = 0.5 },
  terrain    = { order = 10 },
  entities   = { order = 20 },
  effects    = { order = 30, blend = "additive" },
  ui         = { order = 100, screenSpace = true },
}

function Render.defineLayer(name, options)
  Render.Layers[name] = options
  -- Sort layers by order
  -- (In real implementation, would rebuild render order)
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Utility
-- ─────────────────────────────────────────────────────────────────────────────

function Render.deepMerge(base, override)
  local result = {}
  for k, v in pairs(base) do
    result[k] = v
  end
  for k, v in pairs(override or {}) do
    if type(v) == "table" and type(result[k]) == "table" then
      result[k] = Render.deepMerge(result[k], v)
    else
      result[k] = v
    end
  end
  return result
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Serialization
-- ─────────────────────────────────────────────────────────────────────────────

function Render.toJSON()
  return {
    config = config,
    layers = Render.Layers,
    modes = Render.Modes,
    postProcessPresets = Render.PostProcess,
  }
end

return Render
