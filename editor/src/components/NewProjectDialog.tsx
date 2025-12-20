// ═══════════════════════════════════════════════════════════════════════════
// New Project Dialog - Choose demo or empty project
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../stores/useEngineState'
import { DEMO_PROJECTS, DemoProjectData } from '../lib/demoProjects'

// Re-export for MenuBar
export type DemoProject = DemoProjectData

interface NewProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelectDemo: (demo: DemoProject) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Card
// ─────────────────────────────────────────────────────────────────────────────

function DemoCard({
  demo,
  isSelected,
  onSelect
}: {
  demo: DemoProject
  isSelected: boolean
  onSelect: () => void
}) {
  const theme = useTheme()

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        background: isSelected ? theme.accentBg : theme.bgHover,
        border: `2px solid ${isSelected ? theme.accent : theme.border}`,
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        minWidth: '280px',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.accent + '80'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.border
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '32px' }}>{demo.icon}</span>
        <div>
          <div style={{
            fontSize: '16px',
            fontWeight: 600,
            color: isSelected ? theme.accent : theme.text
          }}>
            {demo.name}
          </div>
          <div style={{
            fontSize: '11px',
            color: theme.textMuted,
            marginTop: '2px'
          }}>
            {demo.template}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: '12px',
        color: theme.textMuted,
        marginBottom: '12px',
        lineHeight: '1.4'
      }}>
        {demo.description}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {demo.features.slice(0, 4).map((feature) => (
          <span
            key={feature}
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: theme.bgPanel,
              borderRadius: '4px',
              color: theme.textDim,
            }}
          >
            {feature}
          </span>
        ))}
        {demo.features.length > 4 && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              color: theme.textDim,
            }}
          >
            +{demo.features.length - 4} more
          </span>
        )}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New Project Dialog
// ─────────────────────────────────────────────────────────────────────────────

export function NewProjectDialog({ isOpen, onClose, onSelectDemo }: NewProjectDialogProps) {
  const theme = useTheme()
  const [demos, setDemos] = useState<DemoProject[]>([])
  const [selectedDemo, setSelectedDemo] = useState<DemoProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load demos from embedded data
  useEffect(() => {
    if (!isOpen) return

    setLoading(false)
    setError(null)
    setDemos(DEMO_PROJECTS)
    setSelectedDemo(DEMO_PROJECTS[0])
  }, [isOpen])

  const handleCreate = useCallback(() => {
    if (selectedDemo) {
      onSelectDemo(selectedDemo)
      onClose()
    }
  }, [selectedDemo, onSelectDemo, onClose])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && selectedDemo) {
        handleCreate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleCreate, selectedDemo])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.bgPanel,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.text
            }}>
              New Project
            </h2>
            <p style={{
              margin: '4px 0 0',
              fontSize: '12px',
              color: theme.textMuted
            }}>
              Choose a template to get started
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textMuted,
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: theme.textMuted
            }}>
              Loading demos...
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: theme.error
            }}>
              {error}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {demos.map((demo) => (
                <DemoCard
                  key={demo.id}
                  demo={demo}
                  isSelected={selectedDemo?.id === demo.id}
                  onSelect={() => setSelectedDemo(demo)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              color: theme.textMuted,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedDemo}
            style={{
              padding: '8px 20px',
              background: selectedDemo ? theme.accent : theme.bgHover,
              border: 'none',
              borderRadius: '6px',
              color: selectedDemo ? '#000' : theme.textDim,
              fontSize: '12px',
              fontWeight: 500,
              cursor: selectedDemo ? 'pointer' : 'not-allowed',
            }}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewProjectDialog
