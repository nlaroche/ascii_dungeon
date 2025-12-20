// ═══════════════════════════════════════════════════════════════════════════
// RuntimeInspector - Displays runtime state during play mode
// Shows performance stats, entity states, variables, and recent events
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'
import { usePlayMode, useTheme, useEngineState } from '../stores/useEngineState'
import { PlayMode } from '../scripting/runtime/PlayModeManager'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RuntimeEntity {
  id: string
  name: string
  position: [number, number, number]
  componentCount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible Section
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const theme = useTheme()
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div style={{ marginBottom: '8px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '6px 8px',
          background: theme.bgHover,
          border: 'none',
          borderRadius: '4px',
          color: theme.text,
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: theme.textDim }}>{isOpen ? '▾' : '▸'}</span>
        {title}
      </button>
      {isOpen && (
        <div style={{ padding: '8px 0 0 8px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Row
// ─────────────────────────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const theme = useTheme()

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        fontSize: '11px',
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <span style={{ color: theme.textMuted }}>{label}</span>
      <span style={{ color: color || theme.text, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance Panel
// ─────────────────────────────────────────────────────────────────────────────

function PerformancePanel() {
  const theme = useTheme()
  const { frameCount, elapsedTime, getStats } = usePlayMode()
  const [stats, setStats] = useState({ fps: 0, frameTime: 0, entityCount: 0, behaviorCount: 0 })

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getStats())
    }, 100)
    return () => clearInterval(interval)
  }, [getStats])

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return theme.success
    if (fps >= 30) return theme.warning
    return theme.error
  }

  return (
    <Section title="Performance" defaultOpen>
      <StatRow label="FPS" value={stats.fps} color={getFpsColor(stats.fps)} />
      <StatRow label="Frame Time" value={`${stats.frameTime.toFixed(2)}ms`} />
      <StatRow label="Frame" value={frameCount} />
      <StatRow label="Time" value={`${elapsedTime.toFixed(1)}s`} />
      <StatRow label="Entities" value={stats.entityCount} />
      <StatRow label="Behaviors" value={stats.behaviorCount} />
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Entities Panel
// ─────────────────────────────────────────────────────────────────────────────

function EntitiesPanel() {
  const theme = useTheme()
  const { getAllEntities, isRunning } = usePlayMode()
  const [entities, setEntities] = useState<RuntimeEntity[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!isRunning) {
      setEntities([])
      return
    }

    const interval = setInterval(() => {
      const allEntities = getAllEntities()
      setEntities(allEntities.map(e => ({
        id: e.id,
        name: e.name,
        position: e.position,
        componentCount: e.components.length,
      })))
    }, 500)

    return () => clearInterval(interval)
  }, [isRunning, getAllEntities])

  if (entities.length === 0) {
    return (
      <Section title="Entities" defaultOpen>
        <div style={{ color: theme.textDim, fontSize: '11px', padding: '8px' }}>
          No entities in scene
        </div>
      </Section>
    )
  }

  return (
    <Section title={`Entities (${entities.length})`} defaultOpen>
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {entities.map(entity => (
          <div
            key={entity.id}
            onClick={() => setSelectedId(selectedId === entity.id ? null : entity.id)}
            style={{
              padding: '6px 8px',
              marginBottom: '2px',
              background: selectedId === entity.id ? theme.accentBg : 'transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.text }}>{entity.name}</span>
              <span style={{ color: theme.textDim }}>{entity.componentCount} comp</span>
            </div>
            {selectedId === entity.id && (
              <div style={{ marginTop: '4px', color: theme.textMuted, fontFamily: 'monospace', fontSize: '10px' }}>
                pos: [{entity.position.map(p => p.toFixed(1)).join(', ')}]
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Variables Panel
// ─────────────────────────────────────────────────────────────────────────────

function VariablesPanel() {
  const theme = useTheme()
  // TODO: Implement variable watching
  const variables: Record<string, unknown> = {
    'time': 0,
    'deltaTime': 0.016,
    'paused': false,
  }

  return (
    <Section title="Variables" defaultOpen={false}>
      {Object.entries(variables).map(([key, value]) => (
        <div
          key={key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0',
            fontSize: '11px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <span style={{ color: theme.textMuted }}>{key}</span>
          <span style={{ color: theme.accent, fontFamily: 'monospace' }}>
            {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
          </span>
        </div>
      ))}
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Events Panel
// ─────────────────────────────────────────────────────────────────────────────

function EventsPanel() {
  const theme = useTheme()
  const [events, setEvents] = useState<Array<{ type: string; time: number }>>([])

  // TODO: Subscribe to actual game events
  useEffect(() => {
    // Mock events for now
    const interval = setInterval(() => {
      // This would be replaced with actual event capture
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Section title="Recent Events" defaultOpen={false}>
      {events.length === 0 ? (
        <div style={{ color: theme.textDim, fontSize: '11px', padding: '8px' }}>
          No events captured
        </div>
      ) : (
        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
          {events.map((event, i) => (
            <div
              key={i}
              style={{
                padding: '4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: theme.textMuted,
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <span style={{ color: theme.accent }}>{event.type}</span>
              <span style={{ marginLeft: '8px' }}>{event.time.toFixed(2)}s</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls Panel
// ─────────────────────────────────────────────────────────────────────────────

function ControlsPanel() {
  const theme = useTheme()
  const { status, start, stop, pause, resume, step, isPlaying, isPaused, isStopped } = usePlayMode()

  const buttonStyle = (active?: boolean) => ({
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    background: active ? theme.accentBg : theme.bgHover,
    color: active ? theme.accent : theme.text,
    fontSize: '11px',
    cursor: 'pointer',
    flex: 1,
  })

  return (
    <Section title="Controls" defaultOpen>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {isStopped ? (
          <button style={buttonStyle()} onClick={start}>
            ▶ Play
          </button>
        ) : isPlaying ? (
          <button style={buttonStyle(true)} onClick={pause}>
            ⏸ Pause
          </button>
        ) : (
          <button style={buttonStyle()} onClick={resume}>
            ▶ Resume
          </button>
        )}
        <button
          style={{ ...buttonStyle(), opacity: isStopped ? 0.5 : 1 }}
          onClick={() => stop(false)}
          disabled={isStopped}
        >
          ◼ Stop
        </button>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          style={{ ...buttonStyle(), opacity: isPaused ? 1 : 0.5 }}
          onClick={() => step(1)}
          disabled={!isPaused}
        >
          ⏭ Step
        </button>
        <button
          style={{ ...buttonStyle(), opacity: isStopped ? 0.5 : 1 }}
          onClick={() => stop(true)}
          disabled={isStopped}
        >
          ✓ Apply
        </button>
      </div>
      <div style={{ marginTop: '8px', fontSize: '10px', color: theme.textDim, textAlign: 'center' }}>
        Status: <span style={{ color: theme.accent }}>{status}</span>
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main RuntimeInspector
// ─────────────────────────────────────────────────────────────────────────────

export function RuntimeInspector() {
  const theme = useTheme()
  const { isRunning, isStopped } = usePlayMode()

  if (isStopped) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          color: theme.textDim,
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>▶</div>
        <div style={{ fontSize: '12px', textAlign: 'center' }}>
          Press Play to start the scene
        </div>
        <div style={{ fontSize: '10px', marginTop: '8px', color: theme.textMuted }}>
          Runtime stats will appear here
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '8px',
      }}
    >
      <ControlsPanel />
      <PerformancePanel />
      <EntitiesPanel />
      <VariablesPanel />
      <EventsPanel />
    </div>
  )
}

export default RuntimeInspector
