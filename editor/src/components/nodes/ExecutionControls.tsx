// =============================================================================
// Execution Controls - Play/Pause/Stop controls for visual scripting
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useTheme } from '../../stores/useEngineState'
import {
  GraphRunner,
  GraphRunnerState,
  GraphRunnerEvent,
} from '../../scripting/runtime/GraphRunner'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ExecutionControlsProps {
  nodes: Node[]
  edges: Edge[]
  graphRunner?: GraphRunner
}

// -----------------------------------------------------------------------------
// Icons (inline SVG for simplicity)
// -----------------------------------------------------------------------------

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h12v12H6z" />
  </svg>
)

const RestartIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </svg>
)

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ExecutionControls({ nodes, edges, graphRunner }: ExecutionControlsProps) {
  const theme = useTheme()
  const [state, setState] = useState<GraphRunnerState>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [runner] = useState(() => graphRunner || new GraphRunner())

  // Subscribe to runner events
  useEffect(() => {
    const unsubscribe = runner.addListener((event: GraphRunnerEvent) => {
      switch (event.type) {
        case 'stateChange':
          setState((event.data as { state: GraphRunnerState }).state)
          break
        case 'log':
          setLogs((prev) => [...prev.slice(-99), (event.data as { message: string }).message])
          break
        case 'error':
          const error = (event.data as { error?: string; errors?: string[] })
          const errorMsg = error.error || error.errors?.join(', ') || 'Unknown error'
          setLogs((prev) => [...prev.slice(-99), `ERROR: ${errorMsg}`])
          break
      }
    })

    return unsubscribe
  }, [runner])

  // Handle play button
  const handlePlay = useCallback(async () => {
    if (state === 'paused') {
      runner.resume()
      return
    }

    // Load and start the graph
    setLogs([])
    const result = runner.loadFromReactFlow(nodes, edges, 'editor-graph')

    if (!result.success) {
      setLogs((prev) => [...prev, `Failed to load graph: ${result.errors.join(', ')}`])
      return
    }

    if (result.warnings.length > 0) {
      setLogs((prev) => [...prev, ...result.warnings.map((w) => `Warning: ${w}`)])
    }

    await runner.start()
  }, [runner, nodes, edges, state])

  // Handle pause button
  const handlePause = useCallback(() => {
    runner.pause()
  }, [runner])

  // Handle stop button
  const handleStop = useCallback(() => {
    runner.stop()
  }, [runner])

  // Handle restart button
  const handleRestart = useCallback(async () => {
    runner.stop()
    setLogs([])
    const result = runner.loadFromReactFlow(nodes, edges, 'editor-graph')
    if (result.success) {
      await runner.start()
    }
  }, [runner, nodes, edges])

  // Determine button states
  const isRunning = state === 'running'
  const isPaused = state === 'paused'
  const isIdle = state === 'idle' || state === 'error'

  return (
    <div className="flex flex-col">
      {/* Control buttons */}
      <div
        className="flex items-center gap-1 px-2 py-1 rounded"
        style={{
          backgroundColor: theme.bgPanel,
          border: `1px solid ${theme.border}`,
        }}
      >
        {/* Play/Resume button */}
        <button
          onClick={handlePlay}
          disabled={isRunning}
          className="p-1.5 rounded transition-colors disabled:opacity-40"
          style={{
            backgroundColor: isIdle || isPaused ? '#22c55e' : theme.bgHover,
            color: isIdle || isPaused ? 'white' : theme.textMuted,
          }}
          title={isPaused ? 'Resume' : 'Play'}
        >
          <PlayIcon />
        </button>

        {/* Pause button */}
        <button
          onClick={handlePause}
          disabled={!isRunning}
          className="p-1.5 rounded transition-colors disabled:opacity-40"
          style={{
            backgroundColor: isRunning ? '#f59e0b' : theme.bgHover,
            color: isRunning ? 'white' : theme.textMuted,
          }}
          title="Pause"
        >
          <PauseIcon />
        </button>

        {/* Stop button */}
        <button
          onClick={handleStop}
          disabled={isIdle}
          className="p-1.5 rounded transition-colors disabled:opacity-40"
          style={{
            backgroundColor: !isIdle ? '#ef4444' : theme.bgHover,
            color: !isIdle ? 'white' : theme.textMuted,
          }}
          title="Stop"
        >
          <StopIcon />
        </button>

        {/* Separator */}
        <div
          className="w-px h-4 mx-1"
          style={{ backgroundColor: theme.border }}
        />

        {/* Restart button */}
        <button
          onClick={handleRestart}
          className="p-1.5 rounded transition-colors hover:opacity-80"
          style={{
            backgroundColor: theme.bgHover,
            color: theme.textMuted,
          }}
          title="Restart"
        >
          <RestartIcon />
        </button>

        {/* State indicator */}
        <div className="flex items-center gap-1.5 ml-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor:
                state === 'running'
                  ? '#22c55e'
                  : state === 'paused'
                  ? '#f59e0b'
                  : state === 'error'
                  ? '#ef4444'
                  : theme.textMuted,
            }}
          />
          <span className="text-[10px]" style={{ color: theme.textMuted }}>
            {state === 'running'
              ? 'Running'
              : state === 'paused'
              ? 'Paused'
              : state === 'error'
              ? 'Error'
              : 'Idle'}
          </span>
        </div>

        {/* Log toggle */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="ml-2 px-2 py-0.5 rounded text-[10px] transition-colors"
          style={{
            backgroundColor: showLogs ? theme.accent : theme.bgHover,
            color: showLogs ? theme.bg : theme.textMuted,
          }}
        >
          Logs {logs.length > 0 ? `(${logs.length})` : ''}
        </button>
      </div>

      {/* Log panel */}
      {showLogs && (
        <div
          className="mt-1 p-2 rounded max-h-40 overflow-y-auto"
          style={{
            backgroundColor: theme.bgPanel,
            border: `1px solid ${theme.border}`,
          }}
        >
          {logs.length === 0 ? (
            <div className="text-[10px]" style={{ color: theme.textDim }}>
              No logs yet. Click Play to start the graph.
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="text-[10px] font-mono"
                  style={{
                    color: log.startsWith('ERROR')
                      ? '#ef4444'
                      : log.startsWith('Warning')
                      ? '#f59e0b'
                      : theme.text,
                  }}
                >
                  {log}
                </div>
              ))}
            </div>
          )}
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="mt-2 px-2 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
            >
              Clear Logs
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ExecutionControls
