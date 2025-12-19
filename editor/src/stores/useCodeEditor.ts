// ═══════════════════════════════════════════════════════════════════════════
// Code Editor Store
// Manages open files, tabs, and dirty state for the integrated code editor
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'

export interface EditorTab {
  path: string           // Full file path
  fileName: string       // Just the filename (for display)
  content: string        // Current content in editor
  originalContent: string // Content when last saved (for dirty detection)
  language: string       // Monaco language ID
}

interface CodeEditorState {
  // Open tabs
  tabs: EditorTab[]

  // Currently active tab path
  activeTabPath: string | null

  // Open a file (creates tab if not already open, switches to it)
  openFile: (path: string, content: string) => void

  // Close a tab
  closeTab: (path: string) => void

  // Set active tab
  setActiveTab: (path: string) => void

  // Update content for a tab
  updateContent: (path: string, content: string) => void

  // Mark a file as saved (updates originalContent)
  markSaved: (path: string) => void

  // Check if a tab is dirty
  isDirty: (path: string) => boolean

  // Get active tab
  getActiveTab: () => EditorTab | undefined
}

// Get language from file extension
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript'
    case 'js': case 'jsx': return 'javascript'
    case 'json': return 'json'
    case 'lua': return 'lua'
    case 'md': return 'markdown'
    case 'css': return 'css'
    case 'html': return 'html'
    case 'xml': return 'xml'
    case 'yaml': case 'yml': return 'yaml'
    case 'wgsl': return 'wgsl'
    case 'glsl': return 'glsl'
    default: return 'plaintext'
  }
}

// Get just the filename from path
function getFileName(path: string): string {
  return path.split('/').pop() || path.split('\\').pop() || path
}

export const useCodeEditor = create<CodeEditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,

  openFile: (path, content) => {
    const state = get()
    const existingTab = state.tabs.find(t => t.path === path)

    if (existingTab) {
      // Tab already open, just switch to it
      set({ activeTabPath: path })
    } else {
      // Create new tab
      const newTab: EditorTab = {
        path,
        fileName: getFileName(path),
        content,
        originalContent: content,
        language: getLanguageFromPath(path),
      }
      set({
        tabs: [...state.tabs, newTab],
        activeTabPath: path,
      })
    }
  },

  closeTab: (path) => {
    const state = get()
    const tabIndex = state.tabs.findIndex(t => t.path === path)
    if (tabIndex === -1) return

    const newTabs = state.tabs.filter(t => t.path !== path)

    // If closing active tab, switch to adjacent tab
    let newActiveTab = state.activeTabPath
    if (state.activeTabPath === path) {
      if (newTabs.length === 0) {
        newActiveTab = null
      } else if (tabIndex >= newTabs.length) {
        newActiveTab = newTabs[newTabs.length - 1].path
      } else {
        newActiveTab = newTabs[tabIndex].path
      }
    }

    set({
      tabs: newTabs,
      activeTabPath: newActiveTab,
    })
  },

  setActiveTab: (path) => {
    set({ activeTabPath: path })
  },

  updateContent: (path, content) => {
    set(state => ({
      tabs: state.tabs.map(t =>
        t.path === path ? { ...t, content } : t
      )
    }))
  },

  markSaved: (path) => {
    set(state => ({
      tabs: state.tabs.map(t =>
        t.path === path ? { ...t, originalContent: t.content } : t
      )
    }))
  },

  isDirty: (path) => {
    const tab = get().tabs.find(t => t.path === path)
    return tab ? tab.content !== tab.originalContent : false
  },

  getActiveTab: () => {
    const state = get()
    return state.tabs.find(t => t.path === state.activeTabPath)
  },
}))
