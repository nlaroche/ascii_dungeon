// ═══════════════════════════════════════════════════════════════════════════
// NodeTree - Unity-like hierarchical tree view for scene nodes
// Features: drag-drop reparenting, multi-select, context menu, keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTheme, useSelection, useNodes, flattenNodes, useEngineState } from '../stores/useEngineState'
import { useDragState, type DropPosition, type DropTarget } from '../stores/useDragState'
import type { Node as SceneNode } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DragState {
  nodeId: string | null  // null when dragging from outside (e.g., palette)
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
  node: SceneNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  dragState: DragState | null
  prefabDropTarget: DropTarget | null  // From global drag state for prefab drops
  onDragStart: (nodeId: string) => void
  onDragOver: (nodeId: string, position: 'before' | 'inside' | 'after') => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent) => void
  onPrefabHover: (nodeId: string, nodeName: string, position: DropPosition) => void  // For prefab drag
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void
  onSelect: (nodeId: string, e: React.MouseEvent) => void
  onStartRename: (nodeId: string) => void
  renamingId: string | null
  onRenameSubmit: (newName: string) => void
  onRenameCancel: () => void
  selectedIds: string[]
  allNodes: SceneNode[]
  onToggleVisibility: (nodeId: string) => void
  isSceneRoot?: boolean  // True if this is the scene root node
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  dragState,
  prefabDropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onPrefabHover,
  onContextMenu,
  onSelect,
  onStartRename,
  renamingId,
  onRenameSubmit,
  onRenameCancel,
  selectedIds,
  allNodes,
  onToggleVisibility,
  isSceneRoot = false,
}: TreeNodeProps) {
  const theme = useTheme()
  const isSelected = selectedIds.includes(node.id)
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const isRenaming = renamingId === node.id
  const isVisible = node.meta?.visible !== false  // Check meta.visible for all nodes
  const renameInputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  // Drag state for this node - combine internal drag and prefab drag
  const isDragging = dragState?.nodeId === node.id
  const isDropTarget = dragState?.dropTarget === node.id || prefabDropTarget?.nodeId === node.id
  const dropPosition = isDropTarget
    ? (dragState?.dropTarget === node.id ? dragState?.dropPosition : prefabDropTarget?.position)
    : null

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  // Calculate drop position from Y offset within row
  const calcDropPosition = useCallback((clientY: number): DropPosition => {
    if (!rowRef.current) return 'inside'
    const rect = rowRef.current.getBoundingClientRect()
    const y = clientY - rect.top
    const height = rect.height
    if (y < height * 0.25) return 'before'
    if (y > height * 0.75) return 'after'
    return 'inside'
  }, [])

  // Handle mouse move for prefab dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const draggedPrefab = useDragState.getState().draggedPrefab
    if (!draggedPrefab) return

    const position = calcDropPosition(e.clientY)
    console.log('[TreeNode] Mouse move over:', node.name, 'position:', position)
    onPrefabHover(node.id, node.name, position)
  }, [node.id, node.name, calcDropPosition, onPrefabHover])

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
    onDragStart(node.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Debug logging
    console.log('[TreeNode] DragOver on', node.name, 'types:', Array.from(e.dataTransfer.types))

    // Check if this is a prefab drop
    const isPrefabDrop = e.dataTransfer.types.includes('application/prefab-id')
    if (isPrefabDrop) {
      e.dataTransfer.dropEffect = 'copy'
      // For prefabs, always drop 'inside' the target node
      onDragOver(node.id, 'inside')
      console.log('[TreeNode] Prefab drop detected for', node.name)
      return
    }

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
    onDrop(e)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isRenaming) {
      onSelect(node.id, e)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isSceneRoot) {
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
        ref={rowRef}
        draggable={!isSceneRoot && !isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        className="flex items-center gap-1 px-2 py-1 cursor-pointer rounded text-xs select-none"
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          backgroundColor: isSelected ? theme.accentBg : (isDropTarget ? `${theme.accent}20` : 'transparent'),
          color: isSelected ? theme.accent : isVisible ? theme.text : theme.textDim,
          opacity: isDragging ? 0.5 : isVisible ? 1 : 0.5,
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
            className="px-1 rounded text-[10px]"
            style={{ backgroundColor: theme.bgHover, color: theme.textDim }}
          >
            {node.components.length}
          </span>
        )}

        {/* Visibility toggle */}
        {!isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleVisibility(node.id)
            }}
            className="ml-auto w-5 h-5 flex items-center justify-center rounded text-[10px] opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: isVisible ? theme.textMuted : theme.textDim }}
            title={isVisible ? 'Hide node' : 'Show node'}
          >
            {isVisible ? '◉' : '○'}
          </button>
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
              prefabDropTarget={prefabDropTarget}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={(e) => onDrop(e)}
              onPrefabHover={onPrefabHover}
              onContextMenu={onContextMenu}
              onSelect={onSelect}
              onStartRename={onStartRename}
              renamingId={renamingId}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              selectedIds={selectedIds}
              allNodes={allNodes}
              onToggleVisibility={onToggleVisibility}
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
  onCenterView: () => void
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
  onCenterView,
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
      <MenuItem label="Center View" onClick={onCenterView} />
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
  const setPath = useEngineState((s) => s.setPath)
  const {
    rootNode,
    createNode,
    removeNodes,
    moveNode,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasClipboard,
    renameNode,
    getParent,
    toggleVisibility,
  } = useNodes()
  const { selection, selectNode, selectNodes, clearSelection } = useSelection()
  const treeRef = useRef<HTMLDivElement>(null)
  const [isDraggingPrefab, setIsDraggingPrefab] = useState(false)

  // State-based prefab dragging (bypasses rc-dock)
  const {
    draggedPrefab,
    dropTarget: prefabDropTarget,
    setDropTarget,
    endDrag,
  } = useDragState()

  // Handle prefab hover on tree nodes
  const handlePrefabHover = useCallback((nodeId: string, nodeName: string, position: DropPosition) => {
    console.log('[NodeTree] handlePrefabHover:', nodeName, position)
    setDropTarget({ nodeId, nodeName, position })
  }, [setDropTarget])

  // Global drag event listeners to bypass rc-dock's drag interception
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('application/prefab-id')) return

      // Check if we're over the NodeTree element
      if (treeRef.current && treeRef.current.contains(e.target as Node)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setIsDraggingPrefab(true)
      }
    }

    const handleGlobalDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('application/prefab-id')) return
      if (!treeRef.current?.contains(e.target as Node)) return

      e.preventDefault()
      setIsDraggingPrefab(false)

      const prefabId = e.dataTransfer.getData('application/prefab-id')
      if (!prefabId) return

      const prefab = useEngineState.getState().palette.prefabs[prefabId]
      if (!prefab) return

      // Clone the prefab template with new ID
      const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const currentRootNode = useEngineState.getState().scene.rootNode

      const cloneNode = (node: SceneNode, newId: string): SceneNode => {
        return {
          ...node,
          id: newId,
          name: node.name,
          children: node.children.map((child, i) =>
            cloneNode(child, `${newId}_child_${i}`)
          ),
          components: node.components.map(comp => ({
            ...comp,
            id: `${newId}_${comp.script}_${Math.random().toString(36).slice(2, 5)}`,
            properties: { ...comp.properties }
          })),
        }
      }

      const newNode = cloneNode(prefab.template, newNodeId)
      setPath(['scene', 'rootNode', 'children'], [...currentRootNode.children, newNode], `Add prefab ${prefab.name}`)
      selectNode(newNodeId)

      console.log(`[NodeTree] Global drop handler: Added prefab '${prefab.name}'`)
    }

    const handleGlobalDragEnd = () => {
      setIsDraggingPrefab(false)
    }

    document.addEventListener('dragover', handleGlobalDragOver)
    document.addEventListener('drop', handleGlobalDrop)
    document.addEventListener('dragend', handleGlobalDragEnd)

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver)
      document.removeEventListener('drop', handleGlobalDrop)
      document.removeEventListener('dragend', handleGlobalDragEnd)
    }
  }, [setPath, selectNode])

  // All nodes flattened for range selection
  const allNodes = useMemo(() => flattenNodes(rootNode), [rootNode])

  // State - defined before callbacks that use them
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Include both common root ids and the actual rootNode.id
    const initial = new Set<string>(['root', 'scene-root', rootNode.id])
    // Expand first level children by default
    rootNode.children.forEach((child) => initial.add(child.id))
    return initial
  })
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  // Clone a prefab template to create a new node
  const clonePrefabAsNode = useCallback((prefab: typeof draggedPrefab, newId: string): SceneNode | null => {
    if (!prefab) return null

    const cloneNode = (node: SceneNode, id: string): SceneNode => {
      return {
        ...node,
        id,
        name: node.name,
        children: node.children.map((child, i) =>
          cloneNode(child, `${id}_child_${i}`)
        ),
        components: node.components.map(comp => ({
          ...comp,
          id: `${id}_${comp.script}_${Math.random().toString(36).slice(2, 5)}`,
          properties: { ...comp.properties }
        })),
      }
    }

    return cloneNode(prefab.template, newId)
  }, [])

  // Handle mouse up for state-based prefab dropping
  const handleMouseUp = useCallback(() => {
    if (!draggedPrefab) return

    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const newNode = clonePrefabAsNode(draggedPrefab, newNodeId)
    if (!newNode) {
      endDrag()
      return
    }

    // If we have a drop target, insert at that location
    if (prefabDropTarget) {
      const { nodeId: targetId, position } = prefabDropTarget
      console.log(`[NodeTree] Dropping prefab '${draggedPrefab.name}' ${position} node ${targetId}`)

      if (position === 'inside') {
        // Add as child of target
        const insertAsChild = (node: SceneNode): SceneNode => {
          if (node.id === targetId) {
            return { ...node, children: [...node.children, newNode] }
          }
          return { ...node, children: node.children.map(insertAsChild) }
        }
        const updatedRoot = insertAsChild(rootNode)
        setPath(['scene', 'rootNode'], updatedRoot, `Add prefab ${draggedPrefab.name} as child of ${targetId}`)
        setExpanded(prev => new Set([...prev, targetId]))
      } else {
        // Insert as sibling (before or after)
        const parentNode = getParent(targetId)
        if (parentNode) {
          const insertAsSibling = (node: SceneNode): SceneNode => {
            if (node.id === parentNode.id) {
              const targetIndex = node.children.findIndex(c => c.id === targetId)
              const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex
              const newChildren = [...node.children]
              newChildren.splice(insertIndex, 0, newNode)
              return { ...node, children: newChildren }
            }
            return { ...node, children: node.children.map(insertAsSibling) }
          }
          const updatedRoot = insertAsSibling(rootNode)
          setPath(['scene', 'rootNode'], updatedRoot, `Add prefab ${draggedPrefab.name} ${position} ${targetId}`)
        } else {
          // Parent is root - insert into root.children
          const targetIndex = rootNode.children.findIndex(c => c.id === targetId)
          const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex
          const newChildren = [...rootNode.children]
          newChildren.splice(insertIndex, 0, newNode)
          setPath(['scene', 'rootNode', 'children'], newChildren, `Add prefab ${draggedPrefab.name}`)
        }
      }
    } else {
      // No drop target - add to root
      setPath(['scene', 'rootNode', 'children'], [...rootNode.children, newNode], `Add prefab ${draggedPrefab.name}`)
    }

    selectNode(newNodeId)
    endDrag()

    console.log(`[NodeTree] Added prefab '${draggedPrefab.name}'`)
  }, [draggedPrefab, prefabDropTarget, rootNode, setPath, selectNode, endDrag, clonePrefabAsNode, getParent])

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
    setDragState((prev) => {
      // If no prior drag state (e.g., dragging from palette), create one with null nodeId
      if (!prev) {
        return { nodeId: null, dropTarget: nodeId, dropPosition: position }
      }
      return { ...prev, dropTarget: nodeId, dropPosition: position }
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    // Check if this is a prefab drop
    const prefabId = e.dataTransfer.getData('application/prefab-id')
    if (prefabId) {
      // Get the prefab from store
      const prefab = useEngineState.getState().palette.prefabs[prefabId]
      if (!prefab || !dragState?.dropTarget) {
        setDragState(null)
        return
      }

      // Clone the prefab template with new ID
      const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const cloneNode = (node: SceneNode, newId: string): SceneNode => {
        return {
          ...node,
          id: newId,
          name: node.name,
          children: node.children.map((child, i) =>
            cloneNode(child, `${newId}_child_${i}`)
          ),
          components: node.components.map(comp => ({
            ...comp,
            properties: { ...comp.properties }
          })),
        }
      }

      const newNode = cloneNode(prefab.template, newNodeId)
      const targetId = dragState.dropTarget

      // Find the target node and add the prefab as a child
      const findAndAddChild = (node: SceneNode): SceneNode => {
        if (node.id === targetId) {
          return {
            ...node,
            children: [...node.children, newNode]
          }
        }
        return {
          ...node,
          children: node.children.map(findAndAddChild)
        }
      }

      const updatedRoot = findAndAddChild(rootNode)
      setPath(['scene', 'rootNode'], updatedRoot, `Add prefab ${prefab.name} to ${targetId}`)

      // Expand the target and select the new node
      setExpanded((prev) => new Set([...prev, targetId]))
      selectNode(newNodeId)

      console.log(`[NodeTree] Dropped prefab '${prefab.name}' as child of ${targetId}`)
      setDragState(null)
      return
    }

    // Regular node move
    if (!dragState || !dragState.dropTarget || !dragState.dropPosition) {
      setDragState(null)
      return
    }

    const { nodeId, dropTarget, dropPosition } = dragState

    // nodeId is null for external drags (handled above for prefabs)
    // For internal node moves, nodeId must be present
    if (!nodeId || !dropTarget) {
      setDragState(null)
      return
    }

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
  }, [dragState, moveNode, getParent, rootNode, setPath, selectNode])

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
    const clones = duplicateNodes(selection.nodes.filter((id) => id !== rootNode.id))
    if (clones.length > 0) {
      selectNodes(clones.map((n) => n.id))
    }
  }, [selection.nodes, duplicateNodes, selectNodes, rootNode.id])

  const handleDelete = useCallback(() => {
    if (selection.nodes.length === 0) return
    removeNodes(selection.nodes.filter((id) => id !== rootNode.id))
    clearSelection()
  }, [selection.nodes, removeNodes, clearSelection, rootNode.id])

  const handleCopy = useCallback(() => {
    if (selection.nodes.length === 0) return
    copyNodes(selection.nodes.filter((id) => id !== rootNode.id))
  }, [selection.nodes, copyNodes, rootNode.id])

  // Paste as sibling (beside selected node, under same parent)
  const handlePaste = useCallback(() => {
    if (selection.nodes.length > 0 && selection.nodes[0] !== rootNode.id) {
      // Paste under same parent as selected node
      const parent = getParent(selection.nodes[0])
      const parentId = parent?.id || rootNode.id
      const pasted = pasteNodes(parentId)
      if (pasted.length > 0) {
        setExpanded((prev) => new Set([...prev, parentId]))
        selectNodes(pasted.map((n) => n.id))
      }
    } else {
      // No selection or root selected - paste under root
      const pasted = pasteNodes(rootNode.id)
      if (pasted.length > 0) {
        selectNodes(pasted.map((n) => n.id))
      }
    }
  }, [selection.nodes, pasteNodes, selectNodes, getParent, rootNode.id])

  // Paste as child of selected node
  const handlePasteAsChild = useCallback(() => {
    const parentId = selection.nodes.length > 0 ? selection.nodes[0] : rootNode.id
    const pasted = pasteNodes(parentId)
    if (pasted.length > 0) {
      setExpanded((prev) => new Set([...prev, parentId]))
      selectNodes(pasted.map((n) => n.id))
    }
  }, [selection.nodes, pasteNodes, selectNodes, rootNode.id])

  const handleStartRename = useCallback((nodeId: string) => {
    if (nodeId !== rootNode.id) {
      setRenamingId(nodeId)
    }
  }, [rootNode.id])

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

  // Center view on a node
  const handleCenterView = useCallback(() => {
    if (contextMenu?.nodeId) {
      setPath(['editor2D', 'centerOnNodeId'], contextMenu.nodeId, 'Center view on node')
    }
  }, [contextMenu, setPath])

  // Get visible nodes (respecting expanded state) for arrow key navigation
  const getVisibleNodes = useCallback((): SceneNode[] => {
    const visible: SceneNode[] = []
    const traverse = (node: SceneNode, depth: number) => {
      // Root's children are shown at depth 0
      // Include root node in visible list for navigation
      visible.push(node)
      if (expanded.has(node.id)) {
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
            if (parent && parent.id !== rootNode.id) {
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
        if (selection.nodes.length === 1 && selection.nodes[0] !== rootNode.id) {
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
          selectNodes(allNodes.filter((n) => n.id !== rootNode.id).map((n) => n.id))
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

  // Handle dropping prefabs on background (add to root)
  const handleBackgroundDrop = useCallback((e: React.DragEvent) => {
    const prefabId = e.dataTransfer.getData('application/prefab-id')
    if (!prefabId) return

    e.preventDefault()
    e.stopPropagation()

    const prefab = useEngineState.getState().palette.prefabs[prefabId]
    if (!prefab) return

    // Clone the prefab template with new ID
    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const cloneNode = (node: SceneNode, newId: string): SceneNode => {
      return {
        ...node,
        id: newId,
        name: node.name,
        children: node.children.map((child, i) =>
          cloneNode(child, `${newId}_child_${i}`)
        ),
        components: node.components.map(comp => ({
          ...comp,
          properties: { ...comp.properties }
        })),
      }
    }

    const newNode = cloneNode(prefab.template, newNodeId)
    setPath(['scene', 'rootNode', 'children'], [...rootNode.children, newNode], `Add prefab ${prefab.name}`)
    selectNode(newNodeId)

    console.log(`[NodeTree] Dropped prefab '${prefab.name}' to root`)
  }, [rootNode, setPath, selectNode])

  const handleBackgroundDragOver = useCallback((e: React.DragEvent) => {
    // Debug: log all drag types
    console.log('[NodeTree] Background dragOver, types:', Array.from(e.dataTransfer.types))

    if (e.dataTransfer.types.includes('application/prefab-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      console.log('[NodeTree] Prefab drag detected, dropEffect set to copy')
    }
  }, [])

  const handleBackgroundDragEnter = useCallback((e: React.DragEvent) => {
    console.log('[NodeTree] Background dragEnter, types:', Array.from(e.dataTransfer.types))
    if (e.dataTransfer.types.includes('application/prefab-id')) {
      e.preventDefault()
    }
  }, [])

  // Show visual feedback when prefab is being dragged
  const showDropTarget = isDraggingPrefab || draggedPrefab !== null

  return (
    <div
      ref={treeRef}
      className="h-full overflow-y-auto py-1"
      style={{
        outline: showDropTarget ? `2px dashed ${theme.accent}` : 'none',
        outlineOffset: '-2px',
        backgroundColor: showDropTarget ? `${theme.accent}10` : 'transparent',
      }}
      onClick={handleBackgroundClick}
      onMouseUp={handleMouseUp}
      onDrop={handleBackgroundDrop}
      onDragOver={handleBackgroundDragOver}
      onDragEnter={handleBackgroundDragEnter}
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

      {/* Tree - Show root node at top */}
      <TreeNode
        key={rootNode.id}
        node={rootNode}
        depth={0}
        expanded={expanded}
        onToggle={handleToggle}
        dragState={dragState}
        prefabDropTarget={prefabDropTarget}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
        onPrefabHover={handlePrefabHover}
        onContextMenu={handleContextMenu}
        onSelect={handleSelect}
        onStartRename={handleStartRename}
        renamingId={renamingId}
        onRenameSubmit={handleRenameSubmit}
        onRenameCancel={handleRenameCancel}
        selectedIds={selection.nodes}
        allNodes={allNodes}
        onToggleVisibility={toggleVisibility}
        isSceneRoot={true}
      />

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
          onCenterView={handleCenterView}
          canPaste={hasClipboard()}
          isRoot={contextMenu.nodeId === rootNode.id}
        />
      )}
    </div>
  )
}
