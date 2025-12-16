// ═══════════════════════════════════════════════════════════════════════════
// NodeTree - Unity-like hierarchical tree view for scene nodes
// Features: drag-drop reparenting, multi-select, context menu, keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTheme, useSelection, useNodes, flattenNodes } from '../stores/useEngineState'
import type { Node } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DragState {
  nodeId: string
  dropTarget: string | null
  dropPosition: 'before' | 'inside' | 'after' | null
}

interface ContextMenuState {
  x: number
  y: number
  nodeId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Icons by Type
// ─────────────────────────────────────────────────────────────────────────────

const NODE_ICONS: Record<string, string> = {
  Node: '○',
  Node2D: '◇',
  Node3D: '◆',
  Light: '☀',
  Camera: '◎',
  Sprite: '▣',
  Audio: '♪',
  UI: '▢',
}

function getNodeIcon(type: string): string {
  return NODE_ICONS[type] || '○'
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Node Item
// ─────────────────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: Node
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  dragState: DragState | null
  onDragStart: (nodeId: string) => void
  onDragOver: (nodeId: string, position: 'before' | 'inside' | 'after') => void
  onDragEnd: () => void
  onDrop: () => void
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void
  onSelect: (nodeId: string, e: React.MouseEvent) => void
  onStartRename: (nodeId: string) => void
  renamingId: string | null
  onRenameSubmit: (newName: string) => void
  onRenameCancel: () => void
  selectedIds: string[]
  allNodes: Node[]
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onContextMenu,
  onSelect,
  onStartRename,
  renamingId,
  onRenameSubmit,
  onRenameCancel,
  selectedIds,
  allNodes,
}: TreeNodeProps) {
  const theme = useTheme()
  const isSelected = selectedIds.includes(node.id)
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const isRenaming = renamingId === node.id
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Drag state for this node
  const isDragging = dragState?.nodeId === node.id
  const isDropTarget = dragState?.dropTarget === node.id
  const dropPosition = isDropTarget ? dragState?.dropPosition : null

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
    onDragStart(node.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!dragState || dragState.nodeId === node.id) return

    // Determine drop position based on mouse Y within the element
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let position: 'before' | 'inside' | 'after'
    if (y < height * 0.25) {
      position = 'before'
    } else if (y > height * 0.75) {
      position = 'after'
    } else {
      position = 'inside'
    }

    onDragOver(node.id, position)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDrop()
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isRenaming) {
      onSelect(node.id, e)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.id !== 'root') {
      onStartRename(node.id)
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle(node.id)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onRenameSubmit(e.currentTarget.value)
    } else if (e.key === 'Escape') {
      onRenameCancel()
    }
  }

  const handleRenameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onRenameSubmit(e.currentTarget.value)
  }

  // Drop indicator styles
  const getDropIndicatorStyle = () => {
    if (!isDropTarget || !dropPosition) return {}

    if (dropPosition === 'before') {
      return {
        borderTop: `2px solid ${theme.accent}`,
      }
    } else if (dropPosition === 'after') {
      return {
        borderBottom: `2px solid ${theme.accent}`,
      }
    } else {
      return {
        backgroundColor: theme.accent + '30',
      }
    }
  }

  return (
    <div>
      {/* Node row */}
      <div
        draggable={node.id !== 'root' && !isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        className="flex items-center gap-1 px-2 py-1 cursor-pointer rounded text-xs select-none"
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          backgroundColor: isSelected ? theme.accentBg : 'transparent',
          color: isSelected ? theme.accent : theme.text,
          opacity: isDragging ? 0.5 : 1,
          ...getDropIndicatorStyle(),
        }}
        onMouseEnter={(e) => {
          if (!isSelected && !isDropTarget) {
            e.currentTarget.style.backgroundColor = theme.bgHover
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected && !isDropTarget) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        {/* Expand/collapse toggle */}
        <span
          className="w-4 text-center select-none"
          style={{ color: theme.textDim, visibility: hasChildren ? 'visible' : 'hidden' }}
          onClick={handleToggle}
        >
          {isExpanded ? '▼' : '▶'}
        </span>

        {/* Icon */}
        <span
          style={{
            color: node.visual?.color
              ? `rgb(${node.visual.color.map((c) => c * 255).join(',')})`
              : theme.textMuted,
          }}
        >
          {node.visual?.glyph || getNodeIcon(node.type)}
        </span>

        {/* Name (editable when renaming) */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            defaultValue={node.name}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            className="flex-1 bg-transparent outline-none border px-1 rounded text-xs"
            style={{
              borderColor: theme.accent,
              color: theme.text,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1">{node.name}</span>
        )}

        {/* Component count badge */}
        {node.components.length > 0 && !isRenaming && (
          <span
            className="ml-auto px-1 rounded text-[10px]"
            style={{ backgroundColor: theme.bgHover, color: theme.textDim }}
          >
            {node.components.length}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onContextMenu={onContextMenu}
              onSelect={onSelect}
              onStartRename={onStartRename}
              renamingId={renamingId}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              selectedIds={selectedIds}
              allNodes={allNodes}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Menu
// ─────────────────────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number
  y: number
  nodeId: string
  onClose: () => void
  onAddChild: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRename: () => void
  onCopy: () => void
  onPaste: () => void
  onPasteAsChild: () => void
  canPaste: boolean
  isRoot: boolean
}

function ContextMenu({
  x,
  y,
  onClose,
  onAddChild,
  onDuplicate,
  onDelete,
  onRename,
  onCopy,
  onPaste,
  onPasteAsChild,
  canPaste,
  isRoot,
}: ContextMenuProps) {
  const theme = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const MenuItem = ({
    label,
    shortcut,
    onClick,
    disabled,
    danger,
  }: {
    label: string
    shortcut?: string
    onClick: () => void
    disabled?: boolean
    danger?: boolean
  }) => (
    <button
      onClick={() => {
        if (!disabled) {
          onClick()
          onClose()
        }
      }}
      disabled={disabled}
      className="w-full px-3 py-1.5 text-left text-xs flex justify-between items-center rounded"
      style={{
        color: disabled ? theme.textDim : danger ? theme.error : theme.text,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = theme.bgHover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ color: theme.textDim }}>{shortcut}</span>}
    </button>
  )

  return (
    <div
      ref={menuRef}
      className="fixed z-50 py-1 rounded shadow-lg min-w-[160px]"
      style={{
        left: x,
        top: y,
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
      }}
    >
      <MenuItem label="Add Child" shortcut="Ctrl+N" onClick={onAddChild} />
      <MenuItem label="Rename" shortcut="F2" onClick={onRename} disabled={isRoot} />
      <div className="my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
      <MenuItem label="Copy" shortcut="Ctrl+C" onClick={onCopy} disabled={isRoot} />
      <MenuItem label="Paste" shortcut="Ctrl+V" onClick={onPaste} disabled={!canPaste} />
      <MenuItem label="Paste as Child" shortcut="Ctrl+Shift+V" onClick={onPasteAsChild} disabled={!canPaste} />
      <MenuItem label="Duplicate" shortcut="Ctrl+D" onClick={onDuplicate} disabled={isRoot} />
      <div className="my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
      <MenuItem label="Delete" shortcut="Del" onClick={onDelete} disabled={isRoot} danger />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main NodeTree Component
// ─────────────────────────────────────────────────────────────────────────────

export function NodeTree() {
  const theme = useTheme()
  const {
    rootNode,
    createNode,
    removeNode,
    removeNodes,
    moveNode,
    duplicateNode,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasClipboard,
    renameNode,
    getParent,
  } = useNodes()
  const { selection, selectNode, selectNodes, clearSelection } = useSelection()
  const treeRef = useRef<HTMLDivElement>(null)

  // All nodes flattened for range selection
  const allNodes = useMemo(() => flattenNodes(rootNode), [rootNode])

  // State
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>(['root'])
    rootNode.children.forEach((child) => initial.add(child.id))
    return initial
  })
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  // Toggle expand/collapse
  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Selection handling with Shift and Ctrl support
  const handleSelect = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      if (e.shiftKey && lastSelectedId) {
        // Range selection
        const startIdx = allNodes.findIndex((n) => n.id === lastSelectedId)
        const endIdx = allNodes.findIndex((n) => n.id === nodeId)
        if (startIdx !== -1 && endIdx !== -1) {
          const start = Math.min(startIdx, endIdx)
          const end = Math.max(startIdx, endIdx)
          const range = allNodes.slice(start, end + 1).map((n) => n.id)
          selectNodes(range)
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        if (selection.nodes.includes(nodeId)) {
          selectNodes(selection.nodes.filter((id) => id !== nodeId))
        } else {
          selectNodes([...selection.nodes, nodeId])
        }
        setLastSelectedId(nodeId)
      } else {
        // Single selection
        selectNode(nodeId)
        setLastSelectedId(nodeId)
      }
    },
    [allNodes, lastSelectedId, selection.nodes, selectNode, selectNodes]
  )

  // Drag and drop
  const handleDragStart = useCallback((nodeId: string) => {
    setDragState({ nodeId, dropTarget: null, dropPosition: null })
  }, [])

  const handleDragOver = useCallback((nodeId: string, position: 'before' | 'inside' | 'after') => {
    setDragState((prev) => (prev ? { ...prev, dropTarget: nodeId, dropPosition: position } : null))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
  }, [])

  const handleDrop = useCallback(() => {
    if (!dragState || !dragState.dropTarget || !dragState.dropPosition) {
      setDragState(null)
      return
    }

    const { nodeId, dropTarget, dropPosition } = dragState

    if (dropPosition === 'inside') {
      // Move as child
      moveNode(nodeId, dropTarget)
      // Expand the target so user sees the moved node
      setExpanded((prev) => new Set([...prev, dropTarget]))
    } else {
      // Move as sibling (before or after)
      const targetParent = getParent(dropTarget)
      if (targetParent) {
        const targetIndex = targetParent.children.findIndex((c) => c.id === dropTarget)
        const insertIndex = dropPosition === 'after' ? targetIndex + 1 : targetIndex
        moveNode(nodeId, targetParent.id, insertIndex)
      }
    }

    setDragState(null)
  }, [dragState, moveNode, getParent])

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()

    // Select the node if not already selected
    if (!selection.nodes.includes(nodeId)) {
      selectNode(nodeId)
    }

    setContextMenu({ x: e.clientX, y: e.clientY, nodeId })
  }, [selection.nodes, selectNode])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Actions
  const handleAddChild = useCallback(() => {
    const parentId = contextMenu?.nodeId || (selection.nodes.length > 0 ? selection.nodes[0] : 'root')
    const newNode = createNode(parentId)
    setExpanded((prev) => new Set([...prev, parentId]))
    selectNode(newNode.id)
    setRenamingId(newNode.id)
  }, [contextMenu, selection.nodes, createNode, selectNode])

  const handleDuplicate = useCallback(() => {
    if (selection.nodes.length === 0) return
    const clones = duplicateNodes(selection.nodes.filter((id) => id !== 'root'))
    if (clones.length > 0) {
      selectNodes(clones.map((n) => n.id))
    }
  }, [selection.nodes, duplicateNodes, selectNodes])

  const handleDelete = useCallback(() => {
    if (selection.nodes.length === 0) return
    removeNodes(selection.nodes.filter((id) => id !== 'root'))
    clearSelection()
  }, [selection.nodes, removeNodes, clearSelection])

  const handleCopy = useCallback(() => {
    if (selection.nodes.length === 0) return
    copyNodes(selection.nodes.filter((id) => id !== 'root'))
  }, [selection.nodes, copyNodes])

  // Paste as sibling (beside selected node, under same parent)
  const handlePaste = useCallback(() => {
    if (selection.nodes.length > 0 && selection.nodes[0] !== 'root') {
      // Paste under same parent as selected node
      const parent = getParent(selection.nodes[0])
      const parentId = parent?.id || 'root'
      const pasted = pasteNodes(parentId)
      if (pasted.length > 0) {
        setExpanded((prev) => new Set([...prev, parentId]))
        selectNodes(pasted.map((n) => n.id))
      }
    } else {
      // No selection or root selected - paste under root
      const pasted = pasteNodes('root')
      if (pasted.length > 0) {
        selectNodes(pasted.map((n) => n.id))
      }
    }
  }, [selection.nodes, pasteNodes, selectNodes, getParent])

  // Paste as child of selected node
  const handlePasteAsChild = useCallback(() => {
    const parentId = selection.nodes.length > 0 ? selection.nodes[0] : 'root'
    const pasted = pasteNodes(parentId)
    if (pasted.length > 0) {
      setExpanded((prev) => new Set([...prev, parentId]))
      selectNodes(pasted.map((n) => n.id))
    }
  }, [selection.nodes, pasteNodes, selectNodes])

  const handleStartRename = useCallback((nodeId: string) => {
    if (nodeId !== 'root') {
      setRenamingId(nodeId)
    }
  }, [])

  const handleRenameSubmit = useCallback(
    (newName: string) => {
      if (renamingId && newName.trim()) {
        renameNode(renamingId, newName.trim())
      }
      setRenamingId(null)
    },
    [renamingId, renameNode]
  )

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null)
  }, [])

  // Get visible nodes (respecting expanded state) for arrow key navigation
  const getVisibleNodes = useCallback((): Node[] => {
    const visible: Node[] = []
    const traverse = (node: Node, depth: number) => {
      // Root's children are shown at depth 0
      if (node.id !== 'root') {
        visible.push(node)
      }
      if (node.id === 'root' || expanded.has(node.id)) {
        for (const child of node.children) {
          traverse(child, depth + 1)
        }
      }
    }
    traverse(rootNode, -1)
    return visible
  }, [rootNode, expanded])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if tree or document body has focus (not input fields)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      // Arrow key navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const visible = getVisibleNodes()
        if (visible.length === 0) return

        if (selection.nodes.length === 0) {
          // No selection - select first/last
          const idx = e.key === 'ArrowUp' ? visible.length - 1 : 0
          selectNode(visible[idx].id)
          setLastSelectedId(visible[idx].id)
        } else {
          // Move selection up/down
          const currentIdx = visible.findIndex((n) => n.id === selection.nodes[0])
          if (currentIdx === -1) {
            selectNode(visible[0].id)
            setLastSelectedId(visible[0].id)
          } else {
            const nextIdx = e.key === 'ArrowUp'
              ? Math.max(0, currentIdx - 1)
              : Math.min(visible.length - 1, currentIdx + 1)

            if (e.shiftKey) {
              // Extend selection
              const startIdx = visible.findIndex((n) => n.id === lastSelectedId)
              if (startIdx !== -1) {
                const start = Math.min(startIdx, nextIdx)
                const end = Math.max(startIdx, nextIdx)
                selectNodes(visible.slice(start, end + 1).map((n) => n.id))
              } else {
                selectNode(visible[nextIdx].id)
              }
            } else {
              selectNode(visible[nextIdx].id)
              setLastSelectedId(visible[nextIdx].id)
            }
          }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selection.nodes.length === 1) {
          const nodeId = selection.nodes[0]
          if (expanded.has(nodeId)) {
            // Collapse if expanded
            handleToggle(nodeId)
          } else {
            // Move to parent
            const parent = getParent(nodeId)
            if (parent && parent.id !== 'root') {
              selectNode(parent.id)
              setLastSelectedId(parent.id)
            }
          }
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (selection.nodes.length === 1) {
          const nodeId = selection.nodes[0]
          const node = allNodes.find((n) => n.id === nodeId)
          if (node && node.children.length > 0) {
            if (!expanded.has(nodeId)) {
              // Expand if collapsed
              handleToggle(nodeId)
            } else if (node.children.length > 0) {
              // Move to first child
              selectNode(node.children[0].id)
              setLastSelectedId(node.children[0].id)
            }
          }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDelete()
      } else if (e.key === 'F2') {
        e.preventDefault()
        if (selection.nodes.length === 1 && selection.nodes[0] !== 'root') {
          handleStartRename(selection.nodes[0])
        }
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault()
          handleCopy()
        } else if (e.key === 'v') {
          e.preventDefault()
          if (e.shiftKey) {
            // Ctrl+Shift+V = Paste as Child
            handlePasteAsChild()
          } else {
            handlePaste()
          }
        } else if (e.key === 'd') {
          e.preventDefault()
          handleDuplicate()
        } else if (e.key === 'n') {
          e.preventDefault()
          handleAddChild()
        } else if (e.key === 'a') {
          e.preventDefault()
          selectNodes(allNodes.filter((n) => n.id !== 'root').map((n) => n.id))
        }
      } else if (e.key === 'Escape') {
        clearSelection()
        setRenamingId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selection.nodes,
    handleDelete,
    handleCopy,
    handlePaste,
    handlePasteAsChild,
    handleDuplicate,
    handleAddChild,
    handleStartRename,
    clearSelection,
    selectNodes,
    selectNode,
    allNodes,
    expanded,
    getVisibleNodes,
    handleToggle,
    getParent,
    lastSelectedId,
  ])

  // Click on background to clear selection
  const handleBackgroundClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  return (
    <div
      ref={treeRef}
      className="h-full overflow-y-auto py-1"
      onClick={handleBackgroundClick}
    >
      {/* Scene name header */}
      <div
        className="px-3 py-1.5 text-xs uppercase tracking-wider mb-1 flex items-center justify-between"
        style={{ color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}
      >
        <span>Hierarchy</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleAddChild()
          }}
          className="px-1.5 py-0.5 rounded text-[10px]"
          style={{ backgroundColor: theme.bgHover, color: theme.textDim }}
          title="Add Node (Ctrl+N)"
        >
          + Add
        </button>
      </div>

      {/* Tree */}
      {rootNode.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={0}
          expanded={expanded}
          onToggle={handleToggle}
          dragState={dragState}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          onContextMenu={handleContextMenu}
          onSelect={handleSelect}
          onStartRename={handleStartRename}
          renamingId={renamingId}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={handleRenameCancel}
          selectedIds={selection.nodes}
          allNodes={allNodes}
        />
      ))}

      {/* Empty state */}
      {rootNode.children.length === 0 && (
        <div className="p-4 text-center" style={{ color: theme.textDim }}>
          <div className="text-2xl mb-2">○</div>
          <div className="text-xs">No nodes in scene</div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleAddChild()
            }}
            className="mt-2 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: theme.accent, color: theme.bg }}
          >
            Add Node
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={closeContextMenu}
          onAddChild={handleAddChild}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onRename={() => handleStartRename(contextMenu.nodeId)}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onPasteAsChild={handlePasteAsChild}
          canPaste={hasClipboard()}
          isRoot={contextMenu.nodeId === 'root'}
        />
      )}
    </div>
  )
}
