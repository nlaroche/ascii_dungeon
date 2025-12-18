// ═══════════════════════════════════════════════════════════════════════════
// Popup - Reusable popup component with smart positioning
// Used for color pickers, component selectors, context menus, etc.
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../stores/useEngineState'

export interface PopupPosition {
  top: number
  left: number
}

export interface PopupProps {
  /** Anchor element ref for positioning */
  anchorRef: React.RefObject<HTMLElement>
  /** Whether the popup is open */
  isOpen: boolean
  /** Called when popup should close */
  onClose: () => void
  /** Popup content */
  children: React.ReactNode
  /** Approximate width for positioning calculations */
  width?: number
  /** Approximate height for positioning calculations */
  height?: number
  /** Additional className */
  className?: string
  /** Z-index (default 10000) */
  zIndex?: number
}

/**
 * Calculate position for a popup relative to an anchor element
 */
export function calculatePopupPosition(
  anchor: HTMLElement,
  popupWidth: number,
  popupHeight: number,
  margin: number = 10
): PopupPosition {
  const rect = anchor.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  // Vertical positioning - prefer below, but go above if not enough space
  let top: number
  if (spaceBelow >= popupHeight || spaceBelow >= spaceAbove) {
    top = rect.bottom + 4
  } else {
    top = rect.top - popupHeight - 4
  }
  // Clamp to viewport
  top = Math.max(margin, Math.min(window.innerHeight - popupHeight - margin, top))

  // Horizontal positioning - align with anchor, but don't overflow
  let left = rect.left
  if (left + popupWidth > window.innerWidth - margin) {
    left = window.innerWidth - popupWidth - margin
  }
  left = Math.max(margin, left)

  return { top, left }
}

/**
 * Reusable popup component with portal rendering and smart positioning
 */
export function Popup({
  anchorRef,
  isOpen,
  onClose,
  children,
  width = 220,
  height = 300,
  className = '',
  zIndex = 10000,
}: PopupProps) {
  const theme = useTheme()
  const popupRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PopupPosition | null>(null)

  // Calculate position when opening
  useEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setPosition(null)
      return
    }

    const pos = calculatePopupPosition(anchorRef.current, width, height)
    setPosition(pos)
  }, [isOpen, anchorRef, width, height])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node) &&
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
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
  }, [isOpen, onClose, anchorRef])

  if (!isOpen || !position) return null

  return createPortal(
    <div
      ref={popupRef}
      className={`fixed rounded shadow-lg ${className}`}
      style={{
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex,
      }}
    >
      {children}
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchablePopup - Popup with search input and filterable list
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchableItem {
  id: string
  label: string
  icon?: string
  description?: string
  category?: string
}

export interface SearchablePopupProps {
  anchorRef: React.RefObject<HTMLElement>
  isOpen: boolean
  onClose: () => void
  onSelect: (item: SearchableItem) => void
  items: SearchableItem[]
  placeholder?: string
  title?: string
  width?: number
}

export function SearchablePopup({
  anchorRef,
  isOpen,
  onClose,
  onSelect,
  items,
  placeholder = 'Search...',
  title,
  width = 240,
}: SearchablePopupProps) {
  const theme = useTheme()
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter items by search
  const filteredItems = items.filter(item => {
    if (!search) return true
    const query = search.toLowerCase()
    return (
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    )
  })

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      // Focus input after a tick to ensure popup is rendered
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex])
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filteredItems, selectedIndex, onSelect, onClose])

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1))
    }
  }, [filteredItems.length, selectedIndex])

  // Estimate height based on items
  const estimatedHeight = Math.min(350, 44 + (title ? 24 : 0) + filteredItems.length * 32 + 8)

  return (
    <Popup
      anchorRef={anchorRef}
      isOpen={isOpen}
      onClose={onClose}
      width={width}
      height={estimatedHeight}
    >
      <div className="p-2" style={{ width: `${width}px` }}>
        {/* Title */}
        {title && (
          <div
            className="text-xs mb-2 px-1"
            style={{ color: theme.textMuted }}
          >
            {title}
          </div>
        )}

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-7 px-2 rounded text-xs mb-2"
          style={{
            backgroundColor: theme.bgHover,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            outline: 'none',
          }}
        />

        {/* Items list */}
        <div
          className="overflow-auto"
          style={{ maxHeight: '250px' }}
        >
          {filteredItems.length === 0 ? (
            <div
              className="text-xs py-4 text-center"
              style={{ color: theme.textDim }}
            >
              No items found
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item)
                  onClose()
                }}
                className="w-full h-8 px-2 text-left flex items-center gap-2 rounded text-xs transition-colors"
                style={{
                  backgroundColor: index === selectedIndex ? theme.accent + '30' : 'transparent',
                  color: theme.text,
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {item.icon && (
                  <span style={{ color: theme.accent }}>{item.icon}</span>
                )}
                <span className="flex-1 truncate">{item.label}</span>
                {item.category && (
                  <span
                    className="text-[10px]"
                    style={{ color: theme.textDim }}
                  >
                    {item.category}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Popup>
  )
}
