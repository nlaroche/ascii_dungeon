// ═══════════════════════════════════════════════════════════════════════════
// Scrubber - Drag-to-adjust number input
// Drag left/right to decrease/increase value, click to type directly
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useTheme } from '../../stores/useEngineState'

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
}

export function Scrubber({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 0.01,
  precision = 2,
  label,
  suffix = '',
  disabled = false,
  className = '',
}: ScrubberProps) {
  const theme = useTheme()
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const format = (v: number) => v.toFixed(precision)

  // Check if we have bounded range (can use absolute positioning)
  const hasBounds = min !== -Infinity && max !== Infinity

  // Convert mouse X to value
  const mouseToValue = useCallback((clientX: number) => {
    if (!sliderRef.current || !hasBounds) return value
    const rect = sliderRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const rawValue = min + ratio * (max - min)
    // Snap to step
    const snapped = Math.round(rawValue / step) * step
    return clamp(snapped)
  }, [hasBounds, min, max, step, value, clamp])

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || isEditing) return
    e.preventDefault()
    setIsDragging(true)
    document.body.style.cursor = 'ew-resize'

    // If bounded, immediately set value to mouse position
    if (hasBounds) {
      const newValue = mouseToValue(e.clientX)
      onChange(newValue)
    }
  }, [disabled, isEditing, hasBounds, mouseToValue, onChange])

  // Handle drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (hasBounds) {
        // Absolute positioning mode - value follows mouse
        const newValue = mouseToValue(e.clientX)
        onChange(newValue)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, hasBounds, mouseToValue, onChange])

  // Handle double-click to edit
  const handleDoubleClick = useCallback(() => {
    if (disabled) return
    setIsEditing(true)
    setEditValue(format(value))
    setTimeout(() => inputRef.current?.select(), 0)
  }, [disabled, value, format])

  // Handle edit submit
  const handleEditSubmit = useCallback(() => {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed)) {
      onChange(clamp(parsed))
    }
    setIsEditing(false)
  }, [editValue, onChange, clamp])

  // Handle edit key
  const handleEditKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }, [handleEditSubmit])

  // Handle edit blur
  const handleEditBlur = useCallback(() => {
    handleEditSubmit()
  }, [handleEditSubmit])

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-2 ${className}`}
    >
      {label && (
        <span
          className="text-xs min-w-[60px]"
          style={{ color: theme.textMuted }}
        >
          {label}
        </span>
      )}
      <div
        ref={sliderRef}
        className="relative flex-1 h-6 rounded overflow-hidden select-none"
        style={{
          backgroundColor: theme.bgHover,
          cursor: disabled ? 'not-allowed' : 'ew-resize',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Value fill indicator */}
        {min !== -Infinity && max !== Infinity && (
          <div
            className="absolute inset-y-0 left-0 pointer-events-none"
            style={{
              width: `${((value - min) / (max - min)) * 100}%`,
              backgroundColor: theme.accent,
              opacity: 0.2,
            }}
          />
        )}

        {/* Value display / Edit input */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKey}
            onBlur={handleEditBlur}
            className="absolute inset-0 w-full h-full px-2 text-xs text-center bg-transparent outline-none"
            style={{ color: theme.text }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ color: theme.text }}
          >
            {format(value)}{suffix}
          </div>
        )}

        {/* Drag hint arrows */}
        {!isEditing && !isDragging && (
          <>
            <div
              className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] opacity-30"
              style={{ color: theme.textMuted }}
            >
              ◀
            </div>
            <div
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] opacity-30"
              style={{ color: theme.textMuted }}
            >
              ▶
            </div>
          </>
        )}
      </div>
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
  const [popupPosition, setPopupPosition] = useState<'below' | 'above'>('below')
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

  // Calculate popup position to avoid overflow
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const popupHeight = 320 // Approximate popup height
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
      setPopupPosition('above')
    } else {
      setPopupPosition('below')
    }
  }, [isOpen])

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
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

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
          onClick={() => !disabled && setIsOpen(!isOpen)}
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

      {/* Popup color picker - matches context menu styling */}
      {isOpen && (
        <div
          ref={popupRef}
          className="absolute z-50 py-2 px-3 rounded shadow-lg"
          style={{
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            left: label ? '68px' : '0',
            minWidth: '220px',
            ...(popupPosition === 'above'
              ? { bottom: '100%', marginBottom: '4px' }
              : { top: '100%', marginTop: '4px' }),
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
            onClick={() => setIsOpen(false)}
          >
            Done
          </button>
        </div>
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
          className="flex-1"
        />
      </div>
    </div>
  )
}
