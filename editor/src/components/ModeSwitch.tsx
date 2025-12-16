// ModeSwitch - Toggle between Engine Mode and Template Mode

import { useEngineState } from '../stores/useEngineState'
import type { EditorMode } from '../stores/engineState'

interface ModeSwitchProps {
  className?: string
}

export function ModeSwitch({ className = '' }: ModeSwitchProps) {
  const editorMode = useEngineState((s) => s.ui.editorMode)
  const setPath = useEngineState((s) => s.setPath)

  const toggleMode = () => {
    const newMode: EditorMode = editorMode === 'engine' ? 'template' : 'engine'
    setPath(['ui', 'editorMode'], newMode, `Switch to ${newMode} mode`)
  }

  return (
    <button
      onClick={toggleMode}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${className} ${
        editorMode === 'engine'
          ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
          : 'bg-cyan-700 text-cyan-100 hover:bg-cyan-600'
      }`}
      title={`Currently in ${editorMode === 'engine' ? 'Engine' : 'Template'} Mode. Click to switch.`}
    >
      <span className="font-mono">
        {editorMode === 'engine' ? '{ }' : '[ ]'}
      </span>
      <span>
        {editorMode === 'engine' ? 'Engine' : 'Template'}
      </span>
    </button>
  )
}
