// ═══════════════════════════════════════════════════════════════════════════
// PlayModeToolbar - Play/Pause/Stop controls for scene execution
// Unity-like play mode controls in the top toolbar
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { usePlayMode } from '../stores/useEngineState'
import { useTheme } from '../stores/useEngineState'

// ─────────────────────────────────────────────────────────────────────────────
// Icon Components (ASCII-style for consistency)
// ─────────────────────────────────────────────────────────────────────────────

const PlayIcon = () => <span style={{ fontSize: '14px' }}>▶</span>
const PauseIcon = () => <span style={{ fontSize: '14px' }}>⏸</span>
const StopIcon = () => <span style={{ fontSize: '14px' }}>◼</span>
const StepIcon = () => <span style={{ fontSize: '14px' }}>⏭</span>
const ApplyIcon = () => <span style={{ fontSize: '12px' }}>✓</span>

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar Button
// ─────────────────────────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

function ToolbarButton({ icon, label, onClick, disabled, active, variant = 'default' }: ToolbarButtonProps) {
  const theme = useTheme()

  const getColor = () => {
    if (disabled) return theme.textDim
    switch (variant) {
      case 'success': return theme.success
      case 'warning': return theme.warning
      case 'danger': return theme.error
      default: return active ? theme.accent : theme.text
    }
  }

  const getBgColor = () => {
    if (active) return theme.accentBg
    return 'transparent'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '28px',
        padding: '0',
        border: 'none',
        borderRadius: '4px',
        background: getBgColor(),
        color: getColor(),
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = theme.bgHover
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? theme.accentBg : 'transparent'
      }}
    >
      {icon}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayModeToolbar Component
// ─────────────────────────────────────────────────────────────────────────────

export function PlayModeToolbar() {
  const theme = useTheme()
  const {
    status,
    isPlaying,
    isPaused,
    isStopped,
    isRunning,
    elapsedTime,
    frameCount,
    start,
    stop,
    pause,
    resume,
    step,
  } = usePlayMode()

  // Format elapsed time as MM:SS.ms
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        background: theme.bgPanel,
        borderRadius: '6px',
        border: `1px solid ${theme.border}`,
      }}
    >
      {/* Play/Pause Button */}
      {isStopped ? (
        <ToolbarButton
          icon={<PlayIcon />}
          label="Play (F5)"
          onClick={start}
          variant="success"
        />
      ) : isPlaying ? (
        <ToolbarButton
          icon={<PauseIcon />}
          label="Pause (F6)"
          onClick={pause}
          active
          variant="warning"
        />
      ) : (
        <ToolbarButton
          icon={<PlayIcon />}
          label="Resume (F6)"
          onClick={resume}
          variant="success"
        />
      )}

      {/* Stop Button */}
      <ToolbarButton
        icon={<StopIcon />}
        label="Stop (F8)"
        onClick={() => stop(false)}
        disabled={isStopped}
        variant="danger"
      />

      {/* Step Button */}
      <ToolbarButton
        icon={<StepIcon />}
        label="Step Frame (F10)"
        onClick={() => step(1)}
        disabled={!isPaused}
      />

      {/* Separator */}
      <div
        style={{
          width: '1px',
          height: '20px',
          background: theme.border,
          margin: '0 4px',
        }}
      />

      {/* Apply Button (keep changes on stop) */}
      <ToolbarButton
        icon={<ApplyIcon />}
        label="Stop & Apply Changes"
        onClick={() => stop(true)}
        disabled={isStopped}
        variant="success"
      />

      {/* Status Display */}
      {isRunning && (
        <>
          <div
            style={{
              width: '1px',
              height: '20px',
              background: theme.border,
              margin: '0 4px',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: theme.textMuted,
            }}
          >
            {/* Status Indicator */}
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isPlaying ? theme.success : theme.warning,
                animation: isPlaying ? 'pulse 1s infinite' : 'none',
              }}
            />
            <span style={{ color: theme.text, minWidth: '60px' }}>
              {formatTime(elapsedTime)}
            </span>
            <span style={{ color: theme.textDim }}>
              F{frameCount}
            </span>
          </div>
        </>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact Version for smaller spaces
// ─────────────────────────────────────────────────────────────────────────────

export function PlayModeToolbarCompact() {
  const theme = useTheme()
  const {
    isPlaying,
    isPaused,
    isStopped,
    start,
    stop,
    pause,
    resume,
  } = usePlayMode()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
      }}
    >
      {isStopped ? (
        <ToolbarButton icon={<PlayIcon />} label="Play" onClick={start} variant="success" />
      ) : isPlaying ? (
        <ToolbarButton icon={<PauseIcon />} label="Pause" onClick={pause} active variant="warning" />
      ) : (
        <ToolbarButton icon={<PlayIcon />} label="Resume" onClick={resume} variant="success" />
      )}
      <ToolbarButton
        icon={<StopIcon />}
        label="Stop"
        onClick={() => stop(false)}
        disabled={isStopped}
        variant="danger"
      />
    </div>
  )
}

export default PlayModeToolbar
