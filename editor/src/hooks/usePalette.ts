// usePalette - File-based palette loading hook
// Scans palette folders, loads prefabs, and watches for changes

import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEngineState } from '../stores/useEngineState'
import type { Prefab, PaletteCategory, Node } from '../stores/engineState'

// Types matching Rust structs
interface ScannedCategory {
  id: string
  path: string
  name: string
  icon: string | null
  children: string[]
  prefabs: string[]  // Relative paths to .prefab.json files
}

interface PaletteScanResult {
  categories: ScannedCategory[]
  root_categories: string[]
}

interface PrefabFile {
  name: string
  description?: string
  tags?: string[]
  template: Node
}

export interface UsePaletteOptions {
  palettePath: string  // Path to the palettes folder
  autoLoad?: boolean   // Auto-load on mount (default: true)
  watchForChanges?: boolean  // Watch for file changes (default: true)
}

export function usePalette(options: UsePaletteOptions) {
  const { palettePath, autoLoad = true, watchForChanges = true } = options

  const setPath = useEngineState((s) => s.setPath)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<Date | null>(null)

  // Load palette from file system
  const loadPalette = useCallback(async () => {
    if (!palettePath) return

    setLoading(true)
    setError(null)

    try {
      console.log('[usePalette] Scanning palette folder:', palettePath)

      // Scan the palette folder structure
      const scanResult = await invoke<PaletteScanResult>('scan_palette_folder', {
        path: palettePath
      })

      console.log('[usePalette] Scan result:', scanResult)

      // Convert scanned categories to store format
      const categories: Record<string, PaletteCategory> = {}
      const prefabs: Record<string, Prefab> = {}

      for (const scanned of scanResult.categories) {
        categories[scanned.id] = {
          id: scanned.id,
          name: scanned.name,
          icon: scanned.icon || undefined,
          children: scanned.children,
          prefabs: []  // Will be populated after loading prefab files
        }
      }

      // Load all prefab files
      for (const scanned of scanResult.categories) {
        const categoryPrefabIds: string[] = []

        for (const prefabRelPath of scanned.prefabs) {
          const fullPath = `${palettePath}/${prefabRelPath}`

          try {
            const prefabData = await invoke<PrefabFile>('read_prefab_file', {
              path: fullPath
            })

            // Generate prefab ID from file path
            const prefabId = prefabRelPath
              .replace(/\.prefab\.json$/, '')
              .replace(/[\/\\]/g, '_')

            const prefab: Prefab = {
              id: prefabId,
              name: prefabData.name,
              description: prefabData.description,
              category: [scanned.id],
              tags: prefabData.tags || [],
              template: prefabData.template,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              // Store file path for saving
              _filePath: fullPath,
            } as Prefab & { _filePath: string }

            prefabs[prefabId] = prefab
            categoryPrefabIds.push(prefabId)
          } catch (err) {
            console.warn(`[usePalette] Failed to load prefab ${prefabRelPath}:`, err)
          }
        }

        // Update category with loaded prefab IDs
        if (categories[scanned.id]) {
          categories[scanned.id].prefabs = categoryPrefabIds
        }
      }

      // Update store
      setPath(['palette', 'categories'], categories, 'Load palette categories')
      setPath(['palette', 'prefabs'], prefabs, 'Load palette prefabs')
      setPath(['palette', 'rootCategories'], scanResult.root_categories, 'Load root categories')

      setLastScan(new Date())
      console.log('[usePalette] Loaded', Object.keys(prefabs).length, 'prefabs in',
                  Object.keys(categories).length, 'categories')

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[usePalette] Error loading palette:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [palettePath, setPath])

  // Save a prefab to file
  const savePrefab = useCallback(async (
    prefab: Prefab,
    categoryId: string,
    fileName?: string
  ) => {
    const safeName = fileName || prefab.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const category = useEngineState.getState().palette.categories[categoryId]

    if (!category) {
      throw new Error(`Category ${categoryId} not found`)
    }

    // Find the category path from scanned data
    // For now, use palettePath + categoryId as folder
    const categoryPath = `${palettePath}/${categoryId.replace(/_/g, '/')}`
    const filePath = `${categoryPath}/${safeName}.prefab.json`

    const prefabFile: PrefabFile = {
      name: prefab.name,
      description: prefab.description,
      tags: prefab.tags,
      template: prefab.template,
    }

    await invoke('write_prefab_file', {
      path: filePath,
      prefab: prefabFile
    })

    console.log('[usePalette] Saved prefab to:', filePath)

    // Reload palette to pick up new file
    await loadPalette()

    return filePath
  }, [palettePath, loadPalette])

  // Delete a prefab file
  const deletePrefab = useCallback(async (prefabId: string) => {
    const prefab = useEngineState.getState().palette.prefabs[prefabId] as Prefab & { _filePath?: string }

    if (!prefab?._filePath) {
      throw new Error(`Prefab ${prefabId} has no file path`)
    }

    await invoke('delete_prefab_file', {
      path: prefab._filePath
    })

    console.log('[usePalette] Deleted prefab:', prefab._filePath)

    // Reload palette
    await loadPalette()
  }, [loadPalette])

  // Create a new category folder
  const createCategory = useCallback(async (
    parentCategoryId: string | null,
    folderName: string,
    displayName: string,
    icon?: string
  ) => {
    const parentPath = parentCategoryId
      ? `${palettePath}/${parentCategoryId.replace(/_/g, '/')}`
      : palettePath

    const folderPath = `${parentPath}/${folderName}`

    await invoke('create_category_folder', {
      path: folderPath,
      name: displayName,
      icon: icon || null
    })

    console.log('[usePalette] Created category folder:', folderPath)

    // Reload palette
    await loadPalette()
  }, [palettePath, loadPalette])

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && palettePath) {
      loadPalette()
    }
  }, [autoLoad, palettePath, loadPalette])

  // Watch for file changes
  useEffect(() => {
    if (!watchForChanges || !palettePath) return

    let unsubscribe: (() => void) | undefined

    const setupWatcher = async () => {
      try {
        // Start the file watcher
        await invoke('start_file_watcher', { path: palettePath })

        // Listen for file change events
        const unlisten = await listen<{ path: string }>('file-change', (event) => {
          console.log('[usePalette] File changed:', event.payload.path)

          // Reload palette on any change
          loadPalette()
        })

        unsubscribe = () => {
          unlisten()
          invoke('stop_file_watcher').catch(console.error)
        }
      } catch (err) {
        console.warn('[usePalette] Failed to setup file watcher:', err)
      }
    }

    setupWatcher()

    return () => {
      unsubscribe?.()
    }
  }, [watchForChanges, palettePath, loadPalette])

  return {
    loading,
    error,
    lastScan,
    loadPalette,
    savePrefab,
    deletePrefab,
    createCategory,
  }
}
