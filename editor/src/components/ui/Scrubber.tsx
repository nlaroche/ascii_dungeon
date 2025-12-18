// ═══════════════════════════════════════════════════════════════════════════
// Scrubber - Drag-to-adjust number input
// Drag on label to adjust value, input box for direct editing
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../stores/useEngineState'

// Drag direction determines cursor and which mouse axis affects value
type DragDirection = 'horizontal' | 'vertical' | 'both'

interface ScrubberProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  precision?: number
  label?: string
  suffix?: string
  disabled?: boolean
  className?: string
  dragDirection?: DragDirection
  sensitivity?: number  // Pixels per step (higher = less sensitive)
}

export function Scrubber({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  label,
  suffix = '',
  disabled = false,
  className = '',
  dragDirection = 'horizontal',
  sensitivity = 4,  // 4 pixels per step (less sensitive)
}: ScrubberProps) {
  const theme = useTheme()
  const [isDragging, setIsDragging] = useState(false)
  const [inputText, setInputText] = useState(String(value))
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; value: number } | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  // Sync inputText when value changes externally (and not focused)
  useEffect(() => {
    if (!isFocused) {
      setInputText(String(value))
    }
  }, [value, isFocused])

  // Get cursor based on drag direction
  const getCursor = () => {
    if (disabled) return 'not-allowed'
    if (dragDirection === 'vertical') return 'ns-resize'
    if (dragDirection === 'both') return 'move'
    return 'ew-resize'
  }

  // Handle drag start on label
  const handleLabelMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, value }
    document.body.style.cursor = getCursor()
  }, [disabled, value, getCursor])

  // Handle drag
  useEffect(() => {
    if (!isDragging || !dragStartRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return

      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = dragStartRef.current.y - e.clientY  // Inverted: up = increase

      let delta = 0
      if (dragDirection === 'horizontal') {
        delta = deltaX
      } else if (dragDirection === 'vertical') {
        delta = deltaY
      } else {
        delta = deltaX + deltaY
      }

      // Apply sensitivity and step
      const steps = delta / sensitivity
      const newValue = clamp(dragStartRef.current.value + steps * step)
      onChange(newValue)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onChange, dragDirection, sensitivity, step, clamp])

  // Handle input change - allow typing freely
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)
  }, [])

  // Commit value on blur or Enter
  const commitValue = useCallback(() => {
    const parsed = parseFloat(inputText)
    if (!isNaN(parsed)) {
      onChange(clamp(parsed))
      setInputText(String(clamp(parsed)))
    } else {
      // Reset to current value if invalid
      setInputText(String(value))
    }
  }, [inputText, onChange, clamp, value])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    // Select all on focus for easy replacement
    inputRef.current?.select()
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    commitValue()
  }, [commitValue])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      setInputText(String(value))
      inputRef.current?.blur()
    }
  }, [commitValue, value])

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {label && (
        <span
          className="text-[10px] font-medium select-none rounded"
          style={{
            color: isDragging ? theme.text : theme.textMuted,
            cursor: disabled ? 'not-allowed' : getCursor(),
            backgroundColor: isDragging ? theme.accent + '40' : 'transparent',
            width: '12px',
            textAlign: 'center',
          }}
          onMouseDown={handleLabelMouseDown}
          title={`Drag to adjust ${label}`}
        >
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={inputText}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="px-1 rounded text-xs"
        style={{
          backgroundColor: theme.bg,
          color: disabled ? theme.textDim : theme.text,
          border: `1px solid ${isFocused ? theme.accent : theme.border}`,
          width: '48px',
          height: '20px',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      {suffix && (
        <span className="text-[10px]" style={{ color: theme.textDim }}>
          {suffix}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Color Scrubber - Full-featured color picker with palette and swatches
// ─────────────────────────────────────────────────────────────────────────────

// Default engine palette - common colors for ASCII dungeon art
const ENGINE_PALETTE: [number, number, number][] = [
  // Grays
  [0.0, 0.0, 0.0],       // Black
  [0.15, 0.15, 0.15],    // Dark gray
  [0.3, 0.3, 0.3],       // Gray
  [0.5, 0.5, 0.5],       // Medium gray
  [0.7, 0.7, 0.7],       // Light gray
  [1.0, 1.0, 1.0],       // White
  // Warm colors
  [0.8, 0.2, 0.1],       // Red
  [0.9, 0.4, 0.1],       // Orange
  [0.95, 0.8, 0.2],      // Yellow
  [0.6, 0.4, 0.2],       // Brown
  [0.4, 0.25, 0.15],     // Dark brown
  [0.9, 0.7, 0.5],       // Tan
  // Cool colors
  [0.2, 0.6, 0.3],       // Green
  [0.1, 0.4, 0.2],       // Dark green
  [0.3, 0.7, 0.9],       // Cyan
  [0.2, 0.4, 0.8],       // Blue
  [0.1, 0.2, 0.5],       // Dark blue
  [0.6, 0.3, 0.7],       // Purple
  // Special
  [0.02, 0.03, 0.06],    // Night sky
  [0.08, 0.12, 0.18],    // Horizon
  [0.03, 0.04, 0.03],    // Ground
  [1.0, 0.95, 0.85],     // Sunlight
  [0.6, 0.7, 0.9],       // Moonlight
  [0.18, 0.25, 0.35],    // Ambient
]

interface ColorScrubberProps {
  value: [number, number, number]
  onChange: (value: [number, number, number]) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function ColorScrubber({
  value,
  onChange,
  label,
  disabled = false,
  className = '',
}: ColorScrubberProps) {
  const theme = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [hexInput, setHexInput] = useState('')
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const toHex = (rgb: [number, number, number]) => {
    const r = Math.round(rgb[0] * 255).toString(16).padStart(2, '0')
    const g = Math.round(rgb[1] * 255).toString(16).padStart(2, '0')
    const b = Math.round(rgb[2] * 255).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }

  const fromHex = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
      return [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    }
    return null
  }

  // Update hex input when value changes
  useEffect(() => {
    if (!isOpen) return
    setHexInput(toHex(value))
  }, [value, isOpen])

  // Calculate popup position synchronously (called when opening)
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return null

    const rect = containerRef.current.getBoundingClientRect()
    const popupHeight = 320 // Approximate popup height
    const popupWidth = 230 // Approximate popup width (minWidth + padding)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const margin = 10 // Margin from edges

    // Vertical positioning - prefer below, but go above if not enough space
    let top: number
    if (spaceBelow >= popupHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom + 4
    } else {
      top = rect.top - popupHeight - 4
    }
    // Clamp to viewport
    top = Math.max(margin, Math.min(window.innerHeight - popupHeight - margin, top))

    // Horizontal positioning - align with container, but don't overflow
    let left = rect.left
    if (left + popupWidth > window.innerWidth - margin) {
      left = window.innerWidth - popupWidth - margin
    }
    left = Math.max(margin, left)

    return { top, left }
  }, [])

  // Open popup and calculate position synchronously
  const handleOpen = useCallback(() => {
    if (disabled) return
    const pos = calculatePosition()
    if (pos) {
      setPopupPosition(pos)
      setIsOpen(true)
    }
  }, [disabled, calculatePosition])

  // Close popup
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setPopupPosition(null)
  }, [])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        handleClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleClose])

  const handleHexSubmit = () => {
    const rgb = fromHex(hexInput)
    if (rgb) {
      onChange(rgb)
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {label && (
          <span
            className="text-xs min-w-[60px]"
            style={{ color: theme.textMuted }}
          >
            {label}
          </span>
        )}
        <div
          className="flex-1 h-6 rounded cursor-pointer flex items-center gap-2 px-2"
          style={{ backgroundColor: theme.bgHover }}
          onClick={() => isOpen ? handleClose() : handleOpen()}
        >
          <div
            className="w-4 h-4 rounded border"
            style={{
              backgroundColor: toHex(value),
              borderColor: theme.border,
            }}
          />
          <span className="text-xs" style={{ color: theme.text }}>
            {toHex(value)}
          </span>
        </div>
      </div>

      {/* Popup color picker - rendered in portal to avoid clipping */}
      {isOpen && popupPosition && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[10000] py-2 px-3 rounded shadow-lg"
          style={{
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            minWidth: '220px',
          }}
        >
          {/* Large color preview */}
          <div
            className="w-full h-12 rounded mb-3"
            style={{
              backgroundColor: toHex(value),
              border: `1px solid ${theme.border}`,
            }}
          />

          {/* Hex input */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs" style={{ color: theme.textMuted }}>Hex</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={handleHexSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
              className="flex-1 h-6 px-2 rounded text-xs font-mono"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
            />
          </div>

          {/* RGB sliders using Scrubber for consistent drag behavior */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs w-4 font-bold" style={{ color: '#ef4444' }}>R</span>
              <div className="flex-1">
                <Scrubber
                  value={value[0]}
                  onChange={(v) => onChange([v, value[1], value[2]])}
                  min={0}
                  max={1}
                  step={0.004}
                  precision={2}
                />
              </div>
              <span className="text-xs w-8 text-right font-mono" style={{ color: theme.text }}>
                {Math.round(value[0] * 255)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-4 font-bold" style={{ color: '#22c55e' }}>G</span>
              <div className="flex-1">
                <Scrubber
                  value={value[1]}
                  onChange={(v) => onChange([value[0], v, value[2]])}
                  min={0}
                  max={1}
                  step={0.004}
                  precision={2}
                />
              </div>
              <span className="text-xs w-8 text-right font-mono" style={{ color: theme.text }}>
                {Math.round(value[1] * 255)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-4 font-bold" style={{ color: '#3b82f6' }}>B</span>
              <div className="flex-1">
                <Scrubber
                  value={value[2]}
                  onChange={(v) => onChange([value[0], value[1], v])}
                  min={0}
                  max={1}
                  step={0.004}
                  precision={2}
                />
              </div>
              <span className="text-xs w-8 text-right font-mono" style={{ color: theme.text }}>
                {Math.round(value[2] * 255)}
              </span>
            </div>
          </div>

          {/* Palette swatches */}
          <div className="border-t pt-2" style={{ borderColor: theme.border }}>
            <span className="text-xs block mb-2" style={{ color: theme.textMuted }}>
              Engine Palette
            </span>
            <div className="grid grid-cols-6 gap-1">
              {ENGINE_PALETTE.map((color, i) => (
                <button
                  key={i}
                  className="w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: toHex(color),
                    borderColor: theme.border,
                  }}
                  onClick={() => {
                    onChange(color)
                    setHexInput(toHex(color))
                  }}
                  title={toHex(color)}
                />
              ))}
            </div>
          </div>

          {/* Close button */}
          <button
            className="w-full mt-3 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.accent,
              color: theme.bg,
            }}
            onClick={handleClose}
          >
            Done
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Vec3 Scrubber - For 3D vectors (position, direction, etc.)
// ─────────────────────────────────────────────────────────────────────────────

interface Vec3ScrubberProps {
  value: [number, number, number]
  onChange: (value: [number, number, number]) => void
  label?: string
  min?: number
  max?: number
  step?: number
  precision?: number
  labels?: [string, string, string]
  disabled?: boolean
  className?: string
}

export function Vec3Scrubber({
  value,
  onChange,
  label,
  min = -Infinity,
  max = Infinity,
  step = 0.1,
  precision = 2,
  labels = ['X', 'Y', 'Z'],
  disabled = false,
  className = '',
}: Vec3ScrubberProps) {
  const theme = useTheme()

  return (
    <div className={`${className}`}>
      {label && (
        <div
          className="text-xs mb-1"
          style={{ color: theme.textMuted }}
        >
          {label}
        </div>
      )}
      <div className="flex gap-1">
        <Scrubber
          label={labels[0]}
          value={value[0]}
          onChange={(v) => onChange([v, value[1], value[2]])}
          min={min}
          max={max}
          step={step}
          precision={precision}
          disabled={disabled}
          dragDirection="horizontal"
          className="flex-1"
        />
        <Scrubber
          label={labels[1]}
          value={value[1]}
          onChange={(v) => onChange([value[0], v, value[2]])}
          min={min}
          max={max}
          step={step}
          precision={precision}
          disabled={disabled}
          dragDirection="horizontal"
          className="flex-1"
        />
        <Scrubber
          label={labels[2]}
          value={value[2]}
          onChange={(v) => onChange([value[0], value[1], v])}
          min={min}
          max={max}
          step={step}
          precision={precision}
          disabled={disabled}
          dragDirection="horizontal"
          className="flex-1"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Vec2 Scrubber - For 2D vectors (position, size, etc.)
// Main label supports freeform drag to adjust both values at once
// ─────────────────────────────────────────────────────────────────────────────

interface Vec2ScrubberProps {
  value: [number, number]
  onChange: (value: [number, number]) => void
  label?: string
  min?: number
  max?: number
  step?: number
  precision?: number
  labels?: [string, string]
  disabled?: boolean
  className?: string
  sensitivity?: number
}

export function Vec2Scrubber({
  value,
  onChange,
  label,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  labels = ['X', 'Y'],
  disabled = false,
  className = '',
  sensitivity = 4,  // 4 pixels per step
}: Vec2ScrubberProps) {
  const theme = useTheme()
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; value: [number, number] } | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  // Handle freeform drag on main label
  const handleLabelMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, value: [...value] as [number, number] }
    document.body.style.cursor = 'move'
  }, [disabled, value])

  // Handle drag
  useEffect(() => {
    if (!isDragging || !dragStartRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = dragStartRef.current.y - e.clientY  // Inverted: up = increase

      // Apply delta with sensitivity (X follows horizontal, Y follows vertical)
      const stepsX = deltaX / sensitivity
      const stepsY = deltaY / sensitivity
      const newX = clamp(dragStartRef.current.value[0] + stepsX * step)
      const newY = clamp(dragStartRef.current.value[1] + stepsY * step)
      onChange([newX, newY])
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onChange, step, sensitivity, clamp])

  return (
    <div className={`flex items-center ${className}`}>
      {label && (
        <span
          className="text-xs select-none rounded shrink-0"
          style={{
            color: isDragging ? theme.text : theme.textMuted,
            cursor: disabled ? 'not-allowed' : 'move',
            backgroundColor: isDragging ? theme.accent + '40' : 'transparent',
            width: '55px',
          }}
          onMouseDown={handleLabelMouseDown}
          title="Drag to adjust both values"
        >
          {label}
        </span>
      )}
      <div className="flex gap-1">
        <Scrubber
          label={labels[0]}
          value={value[0]}
          onChange={(v) => onChange([v, value[1]])}
          min={min}
          max={max}
          step={step}
          precision={precision}
          disabled={disabled}
          dragDirection="horizontal"
          sensitivity={sensitivity}
        />
        <Scrubber
          label={labels[1]}
          value={value[1]}
          onChange={(v) => onChange([value[0], v])}
          min={min}
          max={max}
          step={step}
          precision={precision}
          disabled={disabled}
          dragDirection="vertical"
          sensitivity={sensitivity}
        />
      </div>
    </div>
  )
}
