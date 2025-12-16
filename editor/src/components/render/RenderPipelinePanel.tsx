// ═══════════════════════════════════════════════════════════════════════════
// Render Pipeline Panel - Unified UI for render settings
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import {
  useTheme,
  useRenderPipeline,
  useLighting,
  useEnvironment,
} from '../../stores/useEngineState'
import type { PostEffect, SceneLight, DebugViewMode } from '../../stores/engineState'

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
      <DebugViewSection />
      <PassesSection />
      <PostEffectsSection />
      <LightingSection />
      <EnvironmentSection />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug View Section
// ─────────────────────────────────────────────────────────────────────────────

function DebugViewSection() {
  const theme = useTheme()
  const { debugView, setDebugView, showStats, toggleStats } = useRenderPipeline()

  const views: DebugViewMode[] = ['final', 'depth', 'normals', 'shadow', 'albedo']

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase tracking-wider" style={{ color: theme.textMuted }}>
          Debug View
        </span>
        <button
          onClick={toggleStats}
          className="px-2 py-0.5 rounded text-xs"
          style={{
            backgroundColor: showStats ? theme.accent : theme.bgHover,
            color: showStats ? theme.bg : theme.text,
          }}
        >
          Stats
        </button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {views.map((view) => (
          <button
            key={view}
            onClick={() => setDebugView(view)}
            className="px-2 py-1 rounded capitalize"
            style={{
              backgroundColor: debugView === view ? theme.accent : theme.bgHover,
              color: debugView === view ? theme.bg : theme.text,
            }}
          >
            {view}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Passes Section
// ─────────────────────────────────────────────────────────────────────────────

function PassesSection() {
  const theme = useTheme()
  const { passes, setPassEnabled } = useRenderPipeline()
  const [expanded, setExpanded] = useState(false)

  const passNames = Object.keys(passes) as Array<keyof typeof passes>

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-2"
      >
        <span className="uppercase tracking-wider" style={{ color: theme.textMuted }}>
          {expanded ? '▼' : '▶'} Render Passes
        </span>
        <span style={{ color: theme.textDim }}>
          {passNames.filter((p) => passes[p].enabled).length}/{passNames.length}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1 pl-2">
          {passNames.map((passId) => (
            <div key={passId} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={passes[passId].enabled}
                onChange={(e) => setPassEnabled(passId, e.target.checked)}
                className="accent-current"
                style={{ accentColor: theme.accent }}
              />
              <span style={{ color: theme.text }} className="capitalize">
                {passId}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Post Effects Section
// ─────────────────────────────────────────────────────────────────────────────

function PostEffectsSection() {
  const theme = useTheme()
  const {
    postEffects,
    setPostEffectEnabled,
    updatePostEffect,
    reorderPostEffect,
  } = useRenderPipeline()
  const [expanded, setExpanded] = useState(true)
  const [expandedEffect, setExpandedEffect] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const handleDragStart = (id: string) => {
    setDraggedId(id)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== targetId) {
      const targetIdx = postEffects.findIndex((e) => e.id === targetId)
      reorderPostEffect(draggedId, targetIdx)
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  const enabledCount = postEffects.filter((e) => e.enabled).length

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-2"
      >
        <span className="uppercase tracking-wider" style={{ color: theme.textMuted }}>
          {expanded ? '▼' : '▶'} Post Effects
        </span>
        <span style={{ color: theme.textDim }}>
          {enabledCount}/{postEffects.length}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1">
          {postEffects.map((effect) => (
            <PostEffectItem
              key={effect.id}
              effect={effect}
              isExpanded={expandedEffect === effect.id}
              isDragging={draggedId === effect.id}
              onToggle={() => setPostEffectEnabled(effect.id, !effect.enabled)}
              onExpandToggle={() =>
                setExpandedEffect(expandedEffect === effect.id ? null : effect.id)
              }
              onUpdate={(settings) => updatePostEffect(effect.id, settings)}
              onDragStart={() => handleDragStart(effect.id)}
              onDragOver={(e) => handleDragOver(e, effect.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PostEffectItem({
  effect,
  isExpanded,
  isDragging,
  onToggle,
  onExpandToggle,
  onUpdate,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  effect: PostEffect
  isExpanded: boolean
  isDragging: boolean
  onToggle: () => void
  onExpandToggle: () => void
  onUpdate: (settings: Partial<PostEffect>) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const theme = useTheme()

  // Get editable properties (exclude id, name, enabled)
  const editableProps = Object.entries(effect).filter(
    ([key]) => !['id', 'name', 'enabled'].includes(key)
  )

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className="rounded"
      style={{
        backgroundColor: isDragging ? theme.accentBg : theme.bgHover,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div className="flex items-center gap-1 px-2 py-1">
        <span
          className="cursor-grab select-none"
          style={{ color: theme.textDim }}
          title="Drag to reorder"
        >
          ≡
        </span>
        <input
          type="checkbox"
          checked={effect.enabled}
          onChange={onToggle}
          className="accent-current"
          style={{ accentColor: theme.accent }}
        />
        <button
          onClick={onExpandToggle}
          className="flex-1 text-left"
          style={{ color: effect.enabled ? theme.text : theme.textDim }}
        >
          {effect.name}
        </button>
        {editableProps.length > 0 && (
          <span style={{ color: theme.textDim }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {isExpanded && editableProps.length > 0 && (
        <div className="px-3 py-2 space-y-2" style={{ borderTop: `1px solid ${theme.border}` }}>
          {editableProps.map(([key, value]) => (
            <PropertyInput
              key={key}
              label={key}
              value={value}
              onChange={(newValue) => onUpdate({ [key]: newValue })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lighting Section
// ─────────────────────────────────────────────────────────────────────────────

function LightingSection() {
  const theme = useTheme()
  const {
    sun,
    ambient,
    lights,
    gi,
    setSunEnabled,
    setSunDirection,
    setSunColor,
    setSunIntensity,
    setAmbientColor,
    setAmbientIntensity,
    addLight,
    removeLight,
    updateLight,
    setGIEnabled,
    setGIIntensity,
  } = useLighting()
  const [expanded, setExpanded] = useState(true)

  const addNewLight = () => {
    const id = `light_${Date.now()}`
    addLight({
      id,
      type: 'point',
      enabled: true,
      position: [0, 2, 0],
      color: [1, 1, 1],
      intensity: 1,
      range: 10,
      castShadows: false,
    })
  }

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-2"
      >
        <span className="uppercase tracking-wider" style={{ color: theme.textMuted }}>
          {expanded ? '▼' : '▶'} Lighting
        </span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Sun */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sun.enabled}
                onChange={(e) => setSunEnabled(e.target.checked)}
                style={{ accentColor: theme.accent }}
              />
              <span style={{ color: theme.text }}>Sun</span>
            </div>
            {sun.enabled && (
              <div className="pl-4 space-y-1">
                <SliderInput
                  label="Intensity"
                  value={sun.intensity}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={setSunIntensity}
                />
                <ColorInput
                  label="Color"
                  value={sun.color}
                  onChange={(c) => setSunColor(c)}
                />
              </div>
            )}
          </div>

          {/* Ambient */}
          <div className="space-y-1">
            <span style={{ color: theme.text }}>Ambient</span>
            <div className="pl-4 space-y-1">
              <SliderInput
                label="Intensity"
                value={ambient.intensity}
                min={0}
                max={1}
                step={0.05}
                onChange={setAmbientIntensity}
              />
              <ColorInput
                label="Color"
                value={ambient.color}
                onChange={(c) => setAmbientColor(c)}
              />
            </div>
          </div>

          {/* GI */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={gi.enabled}
              onChange={(e) => setGIEnabled(e.target.checked)}
              style={{ accentColor: theme.accent }}
            />
            <span style={{ color: theme.text }}>Global Illumination</span>
          </div>
          {gi.enabled && (
            <div className="pl-4">
              <SliderInput
                label="Intensity"
                value={gi.intensity}
                min={0}
                max={2}
                step={0.1}
                onChange={setGIIntensity}
              />
            </div>
          )}

          {/* Scene Lights */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span style={{ color: theme.textMuted }}>Scene Lights</span>
              <button
                onClick={addNewLight}
                className="px-2 py-0.5 rounded"
                style={{ backgroundColor: theme.bgHover, color: theme.text }}
              >
                + Add
              </button>
            </div>
            <div className="space-y-1">
              {lights.map((light) => (
                <SceneLightItem
                  key={light.id}
                  light={light}
                  onUpdate={(updates) => updateLight(light.id, updates)}
                  onRemove={() => removeLight(light.id)}
                />
              ))}
              {lights.length === 0 && (
                <div style={{ color: theme.textDim }}>No scene lights</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SceneLightItem({
  light,
  onUpdate,
  onRemove,
}: {
  light: SceneLight
  onUpdate: (updates: Partial<SceneLight>) => void
  onRemove: () => void
}) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded" style={{ backgroundColor: theme.bgHover }}>
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          type="checkbox"
          checked={light.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          style={{ accentColor: theme.accent }}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left"
          style={{ color: light.enabled ? theme.text : theme.textDim }}
        >
          {light.id} ({light.type})
        </button>
        <button
          onClick={onRemove}
          className="px-1"
          style={{ color: theme.error }}
          title="Remove light"
        >
          ×
        </button>
      </div>
      {expanded && (
        <div className="px-3 py-2 space-y-1" style={{ borderTop: `1px solid ${theme.border}` }}>
          <SliderInput
            label="Intensity"
            value={light.intensity}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => onUpdate({ intensity: v })}
          />
          <SliderInput
            label="Range"
            value={light.range}
            min={1}
            max={50}
            step={1}
            onChange={(v) => onUpdate({ range: v })}
          />
          <ColorInput
            label="Color"
            value={light.color}
            onChange={(c) => onUpdate({ color: c })}
          />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Section
// ─────────────────────────────────────────────────────────────────────────────

function EnvironmentSection() {
  const theme = useTheme()
  const {
    skybox,
    fog,
    timeOfDay,
    setSkyType,
    setSkyGradient,
    setFogEnabled,
    setFogDensity,
    setFogColor,
    setTimeOfDay,
  } = useEnvironment()
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-2"
      >
        <span className="uppercase tracking-wider" style={{ color: theme.textMuted }}>
          {expanded ? '▼' : '▶'} Environment
        </span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Time of Day */}
          <SliderInput
            label="Time of Day"
            value={timeOfDay}
            min={0}
            max={1}
            step={0.01}
            onChange={setTimeOfDay}
          />

          {/* Sky Type */}
          <div className="space-y-1">
            <label style={{ color: theme.textMuted }}>Sky Type</label>
            <select
              value={skybox.type}
              onChange={(e) => setSkyType(e.target.value as typeof skybox.type)}
              className="w-full px-2 py-1 rounded"
              style={{
                backgroundColor: theme.bgHover,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
            >
              <option value="gradient">Gradient</option>
              <option value="procedural">Procedural</option>
              <option value="cubemap">Cubemap</option>
              <option value="hdri">HDRI</option>
            </select>
          </div>

          {/* Sky Colors */}
          {skybox.type === 'gradient' && (
            <div className="space-y-1">
              <ColorInput
                label="Zenith"
                value={skybox.gradient.zenith}
                onChange={(c) => setSkyGradient({ zenith: c })}
              />
              <ColorInput
                label="Horizon"
                value={skybox.gradient.horizon}
                onChange={(c) => setSkyGradient({ horizon: c })}
              />
              <ColorInput
                label="Ground"
                value={skybox.gradient.ground}
                onChange={(c) => setSkyGradient({ ground: c })}
              />
            </div>
          )}

          {/* Fog */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fog.enabled}
                onChange={(e) => setFogEnabled(e.target.checked)}
                style={{ accentColor: theme.accent }}
              />
              <span style={{ color: theme.text }}>Fog</span>
            </div>
            {fog.enabled && (
              <div className="pl-4 space-y-1">
                <SliderInput
                  label="Density"
                  value={fog.density}
                  min={0}
                  max={0.2}
                  step={0.005}
                  onChange={setFogDensity}
                />
                <ColorInput
                  label="Color"
                  value={fog.color}
                  onChange={(c) => setFogColor(c)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Input Components
// ─────────────────────────────────────────────────────────────────────────────

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const theme = useTheme()

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 truncate" style={{ color: theme.textMuted }}>
        {label}
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
        style={{ accentColor: theme.accent }}
      />
      <span className="w-10 text-right" style={{ color: theme.text }}>
        {value.toFixed(2)}
      </span>
    </div>
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: [number, number, number]
  onChange: (value: [number, number, number]) => void
}) {
  const theme = useTheme()

  const toHex = (rgb: [number, number, number]) => {
    return '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')
  }

  const fromHex = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return [r, g, b]
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 truncate" style={{ color: theme.textMuted }}>
        {label}
      </span>
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => onChange(fromHex(e.target.value))}
        className="w-8 h-6 rounded cursor-pointer"
        style={{ border: `1px solid ${theme.border}` }}
      />
      <span style={{ color: theme.text }}>{toHex(value)}</span>
    </div>
  )
}

// Known dropdown options for specific properties
const DROPDOWN_OPTIONS: Record<string, string[]> = {
  quality: ['low', 'medium', 'high'],
  tonemapping: ['none', 'reinhard', 'aces', 'filmic'],
  fogType: ['linear', 'exponential', 'exponential2'],
}

function PropertyInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}) {
  const theme = useTheme()

  // Check if this property should be a dropdown
  const dropdownOpts = DROPDOWN_OPTIONS[label]
  if (dropdownOpts && typeof value === 'string') {
    return (
      <div className="flex items-center gap-2">
        <span className="w-24 truncate capitalize" style={{ color: theme.textMuted }}>
          {label}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-0.5 rounded"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
        >
          {dropdownOpts.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (typeof value === 'number') {
    return (
      <div className="flex items-center gap-2">
        <span className="w-24 truncate capitalize" style={{ color: theme.textMuted }}>
          {label}
        </span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step="0.1"
          className="flex-1 px-2 py-0.5 rounded"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
        />
      </div>
    )
  }

  if (typeof value === 'string') {
    return (
      <div className="flex items-center gap-2">
        <span className="w-24 truncate capitalize" style={{ color: theme.textMuted }}>
          {label}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-0.5 rounded"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
        />
      </div>
    )
  }

  if (Array.isArray(value) && value.length === 3 && typeof value[0] === 'number') {
    return (
      <ColorInput
        label={label}
        value={value as [number, number, number]}
        onChange={(c) => onChange(c)}
      />
    )
  }

  if (Array.isArray(value) && value.length === 4 && typeof value[0] === 'number') {
    // RGBA color
    return (
      <ColorInput
        label={label}
        value={[value[0], value[1], value[2]] as [number, number, number]}
        onChange={(c) => onChange([...c, value[3]])}
      />
    )
  }

  // Fallback: display as text
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 truncate capitalize" style={{ color: theme.textMuted }}>
        {label}
      </span>
      <span style={{ color: theme.text }}>{JSON.stringify(value)}</span>
    </div>
  )
}

export default RenderPipelinePanel
