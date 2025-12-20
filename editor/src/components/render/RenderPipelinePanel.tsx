// ═══════════════════════════════════════════════════════════════════════════
// Render Pipeline Panel - 2D ASCII post-processing effects stack
// ═══════════════════════════════════════════════════════════════════════════

import { useTheme, useEngineState } from '../../stores/useEngineState'
import { ToggleButton, StackItemScrubber } from '../ui/Scrubber'
import type { CRTSettings } from '../../stores/engineState'
import { DEFAULT_CRT_SETTINGS } from '../../stores/engineState'

// Effect definition for the stack
interface EffectDef {
  id: keyof CRTSettings
  name: string
  description: string
  min: number
  max: number
  step: number
  precision?: number
}

// All available effects with their configurations
const EFFECTS: EffectDef[] = [
  { id: 'scanlines', name: 'Scanlines', description: 'CRT horizontal line effect', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'curvature', name: 'Curvature', description: 'CRT screen bend', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'bloom', name: 'Bloom', description: 'Glow around bright areas', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'vignette', name: 'Vignette', description: 'Darken screen edges', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'chromatic', name: 'Chromatic', description: 'Color fringing', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'noise', name: 'Noise', description: 'Film grain effect', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'flicker', name: 'Flicker', description: 'Screen brightness variation', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'pixelate', name: 'Pixelate', description: 'Reduce resolution', min: 0, max: 1, step: 0.05, precision: 2 },
  { id: 'colorShift', name: 'Color Shift', description: 'Warm/cool tint', min: -1, max: 1, step: 0.1, precision: 1 },
]

// Preset definitions
const PRESETS: Record<string, { name: string; settings: Partial<CRTSettings> }> = {
  clean: { name: 'Clean', settings: {} },
  crt: {
    name: 'CRT Monitor',
    settings: { scanlines: 0.6, curvature: 0.4, bloom: 0.3, noise: 0.15, chromatic: 0.3, flicker: 0.2, vignette: 0.5 },
  },
  neon: {
    name: 'Neon Glow',
    settings: { scanlines: 0.2, bloom: 0.8, noise: 0.05, chromatic: 0.5, vignette: 0.3, colorShift: 0.2 },
  },
  retro: {
    name: 'Retro Terminal',
    settings: { scanlines: 0.8, curvature: 0.5, bloom: 0.4, noise: 0.2, chromatic: 0.2, flicker: 0.3, vignette: 0.6, colorShift: -0.2 },
  },
  arcade: {
    name: 'Arcade Cabinet',
    settings: { scanlines: 0.5, curvature: 0.3, bloom: 0.5, noise: 0.1, chromatic: 0.4, flicker: 0.1, vignette: 0.7 },
  },
  minimal: {
    name: 'Minimal',
    settings: { scanlines: 0.2, bloom: 0.2, vignette: 0.2 },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

export function RenderPipelinePanel() {
  const theme = useTheme()

  return (
    <div
      className="h-full overflow-y-auto text-xs"
      style={{ backgroundColor: theme.bgPanel }}
    >
      <MasterToggle />
      <PresetsSection />
      <EffectsStack />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Toggle - Enable/disable all post-processing
// ─────────────────────────────────────────────────────────────────────────────

function MasterToggle() {
  const theme = useTheme()
  const enabled = useEngineState((s) => s.renderPipeline?.globalPostProcess?.enabled ?? false)
  const setPath = useEngineState((s) => s.setPath)

  return (
    <div
      className="p-3 flex items-center justify-between"
      style={{ borderBottom: `1px solid ${theme.border}` }}
    >
      <span className="font-medium" style={{ color: theme.text }}>
        Post-Processing
      </span>
      <ToggleButton
        active={enabled}
        onClick={() => setPath(['renderPipeline', 'globalPostProcess', 'enabled'], !enabled)}
      >
        {enabled ? 'ON' : 'OFF'}
      </ToggleButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets Section - Quick preset buttons
// ─────────────────────────────────────────────────────────────────────────────

function PresetsSection() {
  const theme = useTheme()
  const globalPostProcess = useEngineState((s) => s.renderPipeline?.globalPostProcess)
  const setPath = useEngineState((s) => s.setPath)

  if (!globalPostProcess?.enabled) return null

  const applyPreset = (presetId: string) => {
    const preset = PRESETS[presetId]
    if (!preset) return

    const newSettings = { ...DEFAULT_CRT_SETTINGS, ...preset.settings }
    setPath(['renderPipeline', 'globalPostProcess'], {
      ...globalPostProcess,
      crtEnabled: presetId !== 'clean',
      crtSettings: newSettings,
      preset: presetId,
    })
  }

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
        Presets
      </div>
      <div className="flex flex-wrap gap-1">
        {Object.entries(PRESETS).map(([id, preset]) => (
          <ToggleButton
            key={id}
            active={globalPostProcess.preset === id}
            onClick={() => applyPreset(id)}
            size="sm"
          >
            {preset.name}
          </ToggleButton>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Effects Stack - Toggleable list of effects using shared StackItemScrubber
// ─────────────────────────────────────────────────────────────────────────────

function EffectsStack() {
  const theme = useTheme()
  const globalPostProcess = useEngineState((s) => s.renderPipeline?.globalPostProcess)
  const setPath = useEngineState((s) => s.setPath)

  if (!globalPostProcess?.enabled) return null

  const crt = globalPostProcess.crtSettings

  const isEffectEnabled = (id: keyof CRTSettings) => {
    return crt[id] !== 0
  }

  const toggleEffect = (id: keyof CRTSettings, enabled: boolean) => {
    if (enabled) {
      // Enable with a default value
      const defaultValue = id === 'colorShift' ? 0.3 : 0.5
      setPath(['renderPipeline', 'globalPostProcess', 'crtSettings', id], defaultValue)
    } else {
      // Disable
      setPath(['renderPipeline', 'globalPostProcess', 'crtSettings', id], 0)
    }
    // Clear preset since we're customizing
    setPath(['renderPipeline', 'globalPostProcess', 'preset'], undefined)
  }

  const updateEffect = (id: keyof CRTSettings, value: number) => {
    setPath(['renderPipeline', 'globalPostProcess', 'crtSettings', id], value)
    setPath(['renderPipeline', 'globalPostProcess', 'preset'], undefined)
  }

  return (
    <div className="p-3">
      <div className="text-xs uppercase tracking-wider mb-3" style={{ color: theme.textMuted }}>
        Effects Stack
      </div>
      <div className="space-y-1">
        {EFFECTS.map((effect) => (
          <StackItemScrubber
            key={effect.id}
            enabled={isEffectEnabled(effect.id)}
            onToggle={(enabled) => toggleEffect(effect.id, enabled)}
            title={effect.name}
            value={crt[effect.id]}
            onChange={(v) => updateEffect(effect.id, v)}
            min={effect.min}
            max={effect.max}
            step={effect.step}
            precision={effect.precision ?? 2}
            description={effect.description}
          />
        ))}
      </div>

      {/* Reset button - depressed/inactive style */}
      <ToggleButton
        active={false}
        onClick={() => {
          setPath(['renderPipeline', 'globalPostProcess', 'crtSettings'], { ...DEFAULT_CRT_SETTINGS })
          setPath(['renderPipeline', 'globalPostProcess', 'preset'], 'clean')
        }}
        className="w-full mt-3"
      >
        Reset All Effects
      </ToggleButton>
    </div>
  )
}

export default RenderPipelinePanel
