// Data-driven Layout component
// Renders panels based on state.ui.layout configuration

import { ReactNode, useState, useRef, useCallback } from 'react';
import { useEngineState, useTheme } from '../../stores/useEngineState';
import type { LayoutSlot } from '../../stores/engineState';

interface LayoutProps {
  renderPanel: (panelId: string, slot: LayoutSlot) => ReactNode;
}

export function Layout({ renderPanel }: LayoutProps) {
  const layout = useEngineState((state) => state.ui.layout);
  const theme = useTheme();
  const setPath = useEngineState((state) => state.setPath);

  // Track resize state
  const [resizing, setResizing] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((index: number) => {
    setResizing(index);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (resizing === null || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const slot = layout.children[resizing];
      const nextSlot = layout.children[resizing + 1];

      if (!slot || !nextSlot) return;

      if (layout.type === 'horizontal') {
        // Calculate new width based on mouse position
        let newSize = e.clientX - rect.left;

        // Sum previous slots
        for (let i = 0; i < resizing; i++) {
          const prevSlot = layout.children[i];
          if (typeof prevSlot.size === 'number') {
            newSize -= prevSlot.size;
          }
        }

        // Clamp to min/max
        const minSize = slot.minSize || 100;
        const maxSize = slot.maxSize || 600;
        newSize = Math.max(minSize, Math.min(maxSize, newSize));

        if (typeof slot.size === 'number' && slot.size !== newSize) {
          setPath(
            ['ui', 'layout', 'children', resizing, 'size'],
            Math.round(newSize),
            `Resize ${slot.id} panel`
          );
        }
      }
    },
    [resizing, layout, setPath]
  );

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  const isHorizontal = layout.type === 'horizontal';

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex ${isHorizontal ? 'flex-row' : 'flex-col'} overflow-hidden`}
      style={{ backgroundColor: theme.bg }}
      onMouseMove={resizing !== null ? handleMouseMove : undefined}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {layout.children.map((slot, index) => (
        <LayoutSlotView
          key={slot.id}
          slot={slot}
          index={index}
          isLast={index === layout.children.length - 1}
          isHorizontal={isHorizontal}
          onResizeStart={handleMouseDown}
          isResizing={resizing !== null}
        >
          {renderPanel(slot.id, slot)}
        </LayoutSlotView>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Slot View
// ─────────────────────────────────────────────────────────────────────────────

interface LayoutSlotViewProps {
  slot: LayoutSlot;
  index: number;
  isLast: boolean;
  isHorizontal: boolean;
  children: ReactNode;
  onResizeStart: (index: number) => void;
  isResizing: boolean;
}

function LayoutSlotView({
  slot,
  index,
  isLast,
  isHorizontal,
  children,
  onResizeStart,
  isResizing,
}: LayoutSlotViewProps) {
  const theme = useTheme();

  const style: React.CSSProperties = {
    backgroundColor: theme.bgPanel,
  };

  if (slot.size === 'flex') {
    style.flex = 1;
  } else if (isHorizontal) {
    style.width = slot.size;
    style.flexShrink = 0;
  } else {
    style.height = slot.size;
    style.flexShrink = 0;
  }

  return (
    <>
      <div className="flex flex-col overflow-hidden h-full" style={style}>
        {children}
      </div>

      {/* Resize handle */}
      {slot.resizable && !isLast && (
        <ResizeHandle
          isHorizontal={isHorizontal}
          onMouseDown={() => onResizeStart(index)}
          isActive={isResizing}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resize Handle
// ─────────────────────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  isHorizontal: boolean;
  onMouseDown: () => void;
  isActive: boolean;
}

function ResizeHandle({ isHorizontal, onMouseDown, isActive }: ResizeHandleProps) {
  const theme = useTheme();

  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        hover:bg-accent/50 transition-colors
        ${isActive ? 'bg-accent/30' : ''}
      `}
      style={{
        backgroundColor: theme.border,
        flexShrink: 0,
      }}
    />
  );
}
