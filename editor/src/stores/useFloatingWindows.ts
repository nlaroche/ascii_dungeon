// ═══════════════════════════════════════════════════════════════════════════
// Floating Windows Store
// Manages native floating panel windows in Tauri
// Falls back to rc-dock's div-based floating in web mode
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// Check if we're running in Tauri
export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Get floating panel ID from URL (for child windows)
export function getFloatingPanelId(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('floating_panel')
}

// Check if this window is a floating panel
export function isFloatingPanelWindow(): boolean {
  return getFloatingPanelId() !== null
}

interface FloatingWindow {
  tabId: string
  windowLabel: string
  title: string
}

interface FloatingWindowsState {
  // Map of tabId -> window info
  windows: Map<string, FloatingWindow>

  // Create a native floating window for a tab
  // Optional graphPath and projectRoot are for opening node-editor with a specific graph
  createFloatingWindow: (
    tabId: string,
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
    graphPath?: string,
    projectRoot?: string
  ) => Promise<void>

  // Close a floating window
  closeFloatingWindow: (tabId: string) => Promise<void>

  // Check if a tab is floating
  isFloating: (tabId: string) => boolean

  // Initialize (set up event listeners)
  initialize: () => void
}

export const useFloatingWindows = create<FloatingWindowsState>((set, get) => ({
  windows: new Map(),

  createFloatingWindow: async (tabId, title, x, y, width, height, graphPath, projectRoot) => {
    if (!isTauri()) {
      console.warn('[FloatingWindows] Not in Tauri, cannot create native window')
      return
    }

    try {
      const result = await invoke<{ window_label: string; tab_id: string }>('create_floating_window', {
        tabId,
        title,
        x,
        y,
        width: Math.max(200, width),
        height: Math.max(150, height),
        graphPath: graphPath || null,
        projectRoot: projectRoot || null,
      })

      set(state => {
        const newWindows = new Map(state.windows)
        newWindows.set(tabId, {
          tabId,
          windowLabel: result.window_label,
          title,
        })
        return { windows: newWindows }
      })

      console.log('[FloatingWindows] Created window:', result.window_label)
    } catch (error) {
      console.error('[FloatingWindows] Failed to create window:', error)
    }
  },

  closeFloatingWindow: async (tabId) => {
    if (!isTauri()) return

    try {
      await invoke('close_floating_window', { tabId })

      set(state => {
        const newWindows = new Map(state.windows)
        newWindows.delete(tabId)
        return { windows: newWindows }
      })

      console.log('[FloatingWindows] Closed window for tab:', tabId)
    } catch (error) {
      console.error('[FloatingWindows] Failed to close window:', error)
    }
  },

  isFloating: (tabId) => {
    return get().windows.has(tabId)
  },

  initialize: () => {
    if (!isTauri()) return

    // Prevent double initialization
    if ((window as any).__floatingWindowsInitialized) return
    ;(window as any).__floatingWindowsInitialized = true

    console.log('[FloatingWindows] Setting up Tauri event listener...')

    // Listen for redock requests from floating windows (includes close events)
    listen<{ tab_id: string; x: number; y: number }>('floating-panel-redock', (event) => {
      console.log('[FloatingWindows] *** RECEIVED Tauri event ***', event)
      const { tab_id } = event.payload
      console.log('[FloatingWindows] Redock requested for tab:', tab_id)

      // Remove from our tracking - the DockLayout will handle re-adding
      set(state => {
        const newWindows = new Map(state.windows)
        newWindows.delete(tab_id)
        return { windows: newWindows }
      })

      // Emit a custom event for the DockLayout to handle
      console.log('[FloatingWindows] Dispatching DOM event for DockLayout...')
      window.dispatchEvent(new CustomEvent('floating-panel-redock', {
        detail: { tabId: tab_id }
      }))
      console.log('[FloatingWindows] DOM event dispatched')
    }).then(() => {
      console.log('[FloatingWindows] Tauri event listener registered successfully')
    }).catch(err => {
      console.error('[FloatingWindows] Failed to register event listener:', err)
    })

    console.log('[FloatingWindows] Initialized')
  },
}))
