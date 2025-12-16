// ═══════════════════════════════════════════════════════════════════════════
// NodeTree - Hierarchical tree view for scene nodes
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { useTheme, useSelection, useNodes } from '../stores/useEngineState';
import type { Node } from '../stores/engineState';

// ─────────────────────────────────────────────────────────────────────────────
// Node Type Icons
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
};

function getNodeIcon(type: string): string {
  return NODE_ICONS[type] || '○';
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Node Item
// ─────────────────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: Node;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

function TreeNode({ node, depth, expanded, onToggle }: TreeNodeProps) {
  const theme = useTheme();
  const { selection, selectNode } = useSelection();
  const isSelected = selection.nodes.includes(node.id);
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id);
  }, [node.id, selectNode]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  }, [node.id, onToggle]);

  return (
    <div>
      {/* Node row */}
      <div
        className="flex items-center gap-1 px-2 py-1 cursor-pointer rounded text-xs"
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          backgroundColor: isSelected ? theme.accentBg : 'transparent',
          color: isSelected ? theme.accent : theme.text,
        }}
        onClick={handleClick}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = theme.bgHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
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
        <span style={{ color: node.visual?.color ? `rgb(${node.visual.color.map(c => c * 255).join(',')})` : theme.textMuted }}>
          {node.visual?.glyph || getNodeIcon(node.type)}
        </span>

        {/* Name */}
        <span className="truncate">{node.name}</span>

        {/* Component count badge */}
        {node.components.length > 0 && (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main NodeTree Component
// ─────────────────────────────────────────────────────────────────────────────

export function NodeTree() {
  const theme = useTheme();
  const { rootNode } = useNodes();
  const { clearSelection } = useSelection();

  // Track expanded nodes
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Expand root and first level by default
    const initial = new Set<string>(['root']);
    rootNode.children.forEach(child => initial.add(child.id));
    return initial;
  });

  const handleToggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBackgroundClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div
      className="h-full overflow-y-auto py-1"
      onClick={handleBackgroundClick}
    >
      {/* Scene name header */}
      <div
        className="px-3 py-1.5 text-xs uppercase tracking-wider mb-1"
        style={{ color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}
      >
        Scene Hierarchy
      </div>

      {/* Tree */}
      {rootNode.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={0}
          expanded={expanded}
          onToggle={handleToggle}
        />
      ))}

      {/* Empty state */}
      {rootNode.children.length === 0 && (
        <div className="p-4 text-center" style={{ color: theme.textDim }}>
          <div className="text-2xl mb-2">○</div>
          <div className="text-xs">No nodes in scene</div>
        </div>
      )}
    </div>
  );
}
