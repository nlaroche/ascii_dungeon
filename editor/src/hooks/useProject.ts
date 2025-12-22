// ═══════════════════════════════════════════════════════════════════════════
// useProject - Project management hook
// Handles opening, saving, creating projects and browsing files
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { getFileSystem, FileSystem, FileEntry } from '../lib/filesystem';
import { getDemoProject } from '../lib/demoProjects';
import { useEngineState } from '../stores/useEngineState';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface FileChangeEvent {
  event_type: string;
  path: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectConfig {
  name: string;
  version: string;
  engine: string;
  settings: {
    targetFPS: number;
    resolution: [number, number];
  };
}

export interface RecentProject {
  name: string;
  path: string;
  lastOpened: number;
}

const RECENT_PROJECTS_KEY = 'ascii-dungeon-recent-projects';
const MAX_RECENT_PROJECTS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useProject() {
  const [fs, setFs] = useState<FileSystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const setPath = useEngineState((s) => s.setPath);
  const log = useEngineState((s) => s.log);

  // Track if we've attempted auto-open
  const autoOpenAttempted = useRef(false);

  // Initialize filesystem
  useEffect(() => {
    getFileSystem().then(setFs);

    // Load recent projects from localStorage
    try {
      const saved = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (saved) {
        setRecentProjects(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save recent projects to localStorage
  const saveRecentProjects = useCallback((projects: RecentProject[]) => {
    setRecentProjects(projects);
    try {
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects));
    } catch {
      // Ignore
    }
  }, []);

  // Add to recent projects
  const addToRecentProjects = useCallback((name: string, path: string) => {
    const now = Date.now();
    const filtered = recentProjects.filter((p) => p.path !== path);
    const updated = [{ name, path, lastOpened: now }, ...filtered].slice(0, MAX_RECENT_PROJECTS);
    saveRecentProjects(updated);
  }, [recentProjects, saveRecentProjects]);

  // Load file tree for a directory
  const loadDirectory = useCallback(async (path: string): Promise<FileEntry[]> => {
    if (!fs) return [];
    try {
      return await fs.readDirectory(path);
    } catch (err) {
      console.error('Failed to load directory:', err);
      return [];
    }
  }, [fs]);

  // Refresh file tree
  const refreshFileTree = useCallback(async () => {
    if (!projectPath || !fs) return;

    const entries = await loadDirectory(projectPath);
    setFileTree(entries);

    // Also load expanded directories
    const loadExpanded = async (entries: FileEntry[], expanded: Set<string>): Promise<FileEntry[]> => {
      const result: FileEntry[] = [];
      for (const entry of entries) {
        if (entry.isDirectory && expanded.has(entry.path)) {
          const children = await loadDirectory(entry.path);
          result.push({ ...entry, children: await loadExpanded(children, expanded) });
        } else {
          result.push(entry);
        }
      }
      return result;
    };

    const treeWithExpanded = await loadExpanded(entries, expandedDirs);
    setFileTree(treeWithExpanded);
  }, [projectPath, fs, expandedDirs, loadDirectory]);

  // Toggle directory expansion
  const toggleDirectory = useCallback(async (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  }, [expandedDirs]);

  // Refresh when expandedDirs changes
  useEffect(() => {
    if (projectPath) {
      refreshFileTree();
    }
  }, [expandedDirs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Store refreshFileTree in a ref for the file watcher callback
  const refreshFileTreeRef = useRef(refreshFileTree);
  useEffect(() => {
    refreshFileTreeRef.current = refreshFileTree;
  }, [refreshFileTree]);

  // File system watching
  useEffect(() => {
    if (!projectPath) return;

    let unlisten: UnlistenFn | null = null;
    let mounted = true;

    const setupWatcher = async () => {
      try {
        // Start the native file watcher
        await invoke('start_file_watcher', { path: projectPath });

        // Listen for file change events
        unlisten = await listen<FileChangeEvent>('file-change', () => {
          // Debounce refresh - use the ref to get latest function
          if (mounted) {
            refreshFileTreeRef.current();
          }
        });
      } catch (err) {
        console.error('[useProject] Failed to start file watcher:', err);
        // File watching is optional, don't block on this
      }
    };

    setupWatcher();

    return () => {
      mounted = false;
      // Stop the watcher and unlisten
      if (unlisten) {
        unlisten();
      }
      invoke('stop_file_watcher').catch(console.error);
    };
  }, [projectPath]);

  // Open a project
  const openProject = useCallback(async (path?: string) => {
    if (!fs) return;

    setIsLoading(true);
    setError(null);

    try {
      // If no path provided, show directory picker
      const projectDir = path || await fs.pickDirectory();
      if (!projectDir) {
        setIsLoading(false);
        return;
      }

      // Try to load project.json
      let config: ProjectConfig;
      try {
        const configContent = await fs.readFile(`${projectDir}/project.json`);
        config = JSON.parse(configContent);
      } catch {
        // No project.json, use defaults
        config = {
          name: projectDir.split('/').pop() || 'Untitled',
          version: '1.0.0',
          engine: 'ascii-dungeon',
          settings: {
            targetFPS: 60,
            resolution: [1280, 720],
          },
        };
      }

      setProjectPath(projectDir);
      setProjectConfig(config);
      setExpandedDirs(new Set());

      // Load file tree
      const entries = await loadDirectory(projectDir);
      setFileTree(entries);

      // Update engine state
      setPath(['project', 'name'], config.name, 'Open project');
      setPath(['project', 'root'], projectDir, 'Set project root');

      // Add to recent projects
      addToRecentProjects(config.name, projectDir);

      // Try to load scene.json if it exists
      try {
        const sceneContent = await fs.readFile(`${projectDir}/scene.json`);
        const sceneData = JSON.parse(sceneContent);
        if (sceneData.rootNode) {
          setPath(['scene', 'rootNode'], sceneData.rootNode, 'Load scene');
          log('info', 'Scene loaded');
        }
      } catch {
        // No scene.json yet, that's fine - use default empty scene
        log('info', 'No saved scene found, starting fresh');
      }

      // Note: Graph files are loaded from graphs/ folder by PlayModeManager when play mode starts
      log('success', `Opened project: ${config.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open project';
      setError(message);
      log('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [fs, loadDirectory, setPath, log, addToRecentProjects]);

  // Auto-open last project on startup
  useEffect(() => {
    if (!fs || autoOpenAttempted.current || projectPath) return;

    // Only attempt once
    autoOpenAttempted.current = true;

    // Get recent projects from localStorage directly (state might not be set yet)
    try {
      const saved = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (saved) {
        const recent = JSON.parse(saved) as RecentProject[];
        if (recent.length > 0) {
          const lastProject = recent[0];
          // Check if path exists before opening
          fs.exists(lastProject.path).then((exists) => {
            if (exists) {
              openProject(lastProject.path);
            }
          });
        }
      }
    } catch {
      // Ignore
    }
  }, [fs, projectPath, openProject]);

  // Create a new project
  const createProject = useCallback(async () => {
    if (!fs) {
      const errMsg = 'File system not initialized. Please wait and try again.';
      log('error', errMsg);
      setError(errMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check fs availability
      const fsAvailable = await fs.isAvailable();
      if (!fsAvailable) {
        throw new Error('File system is not available on this platform');
      }

      // Pick directory
      const projectDir = await fs.pickDirectory();

      if (!projectDir) {
        setIsLoading(false);
        log('info', 'Project creation cancelled');
        return;
      }

      // Create project from template
      log('info', `Creating project at: ${projectDir}`);

      await createProjectFromTemplate(fs, projectDir);

      // Load the new project
      await openProject(projectDir);

      log('success', `Created new project at: ${projectDir}`);
    } catch (err) {
      console.error('[useProject] Error creating project:', err);
      // Extract detailed error message
      let message: string;
      if (err instanceof Error) {
        message = err.message;
        // Log full stack for debugging
        console.error('[useProject] Stack:', err.stack);
      } else if (typeof err === 'string') {
        message = err;
      } else {
        message = `Failed to create project: ${JSON.stringify(err)}`;
      }
      setError(message);
      log('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [fs, openProject, log]);

  // Create a new project from a demo template
  const createProjectFromDemo = useCallback(async (demoId: string | null, demoName: string, forceOverwrite = false) => {
    if (!fs) {
      const errMsg = 'File system not initialized. Please wait and try again.';
      log('error', errMsg);
      setError(errMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fsAvailable = await fs.isAvailable();
      if (!fsAvailable) {
        throw new Error('File system is not available on this platform');
      }

      // Get demo data
      const demo = getDemoProject(demoId || 'empty');
      if (!demo) {
        throw new Error(`Demo project not found: ${demoId}`);
      }

      // Pick destination directory
      const projectDir = await fs.pickDirectory();
      if (!projectDir) {
        setIsLoading(false);
        log('info', 'Project creation cancelled');
        return;
      }

      // Check if folder has existing content
      if (!forceOverwrite) {
        try {
          const entries = await fs.readDirectory(projectDir);
          // Filter out hidden files like .git, .DS_Store
          const visibleEntries = entries.filter(e => !e.name.startsWith('.'));

          if (visibleEntries.length > 0) {
            setIsLoading(false);
            // Return special value to trigger confirmation dialog
            return { needsConfirmation: true, projectDir, demoId, demoName };
          }
        } catch {
          // If we can't read the directory, assume it's empty or new
        }
      }

      log('info', `Creating project "${demoName}" at: ${projectDir}`);

      // If overwriting, clear existing project files (preserve hidden files like .git)
      if (forceOverwrite) {
        try {
          const entries = await fs.readDirectory(projectDir);
          const { remove } = await import('@tauri-apps/plugin-fs');
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue; // Skip hidden files
            const fullPath = `${projectDir}/${entry.name}`;
            try {
              // Use Tauri's remove with recursive option for directories
              await remove(fullPath, { recursive: true });
            } catch {
              // Ignore delete errors
            }
          }
        } catch {
          // Ignore directory clearing errors
        }
      }

      // Write project.json
      const projectConfig = { ...demo.projectJson, name: demoName };
      await fs.writeFile(
        `${projectDir}/project.json`,
        JSON.stringify(projectConfig, null, 2)
      );

      // Write scene.json
      await fs.writeFile(
        `${projectDir}/scene.json`,
        JSON.stringify(demo.sceneJson, null, 2)
      );

      // Create palettes directory and write palette files
      if (Object.keys(demo.palettes).length > 0) {
        await fs.createDirectory(`${projectDir}/palettes`);

        for (const [relativePath, content] of Object.entries(demo.palettes)) {
          const fullPath = `${projectDir}/palettes/${relativePath}`;
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

          // Create subdirectory if needed
          try {
            await fs.createDirectory(dir);
          } catch {
            // Directory might already exist
          }

          await fs.writeFile(fullPath, JSON.stringify(content, null, 2));
        }
      }

      // Create scripts directory and write script files
      if (demo.scripts && Object.keys(demo.scripts).length > 0) {
        await fs.createDirectory(`${projectDir}/scripts`);

        for (const [relativePath, content] of Object.entries(demo.scripts)) {
          const fullPath = `${projectDir}/scripts/${relativePath}`;
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

          // Create subdirectory if needed (for nested script folders)
          if (dir !== `${projectDir}/scripts`) {
            try {
              await fs.createDirectory(dir);
            } catch {
              // Directory might already exist
            }
          }

          // Write script file as plain text (not JSON)
          await fs.writeFile(fullPath, content);
        }
      }

      // Open the new project
      await openProject(projectDir);

      // Set minimal post-processing preset for demo scenes
      if (demoId && demoId !== 'empty') {
        const { DEFAULT_CRT_SETTINGS } = await import('../stores/engineState');
        useEngineState.getState().setPath(['renderPipeline', 'globalPostProcess'], {
          enabled: true,
          crtEnabled: true,
          crtSettings: { ...DEFAULT_CRT_SETTINGS, scanlines: 0.2, bloom: 0.2, vignette: 0.2 },
          effects: [],
          preset: 'minimal',
        });
      }

      log('success', `Created project: ${demoName}`);
    } catch (err) {
      console.error('[useProject] Error creating project from demo:', err);
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      log('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [fs, openProject, log]);

  // Save project configuration and scene
  const saveProject = useCallback(async () => {
    if (!fs || !projectPath || !projectConfig) return;

    try {
      // Save project config
      await fs.writeFile(
        `${projectPath}/project.json`,
        JSON.stringify(projectConfig, null, 2)
      );

      // Save scene data
      const rootNode = useEngineState.getState().scene.rootNode;
      const sceneData = {
        version: '1.0.0',
        rootNode,
        savedAt: new Date().toISOString(),
      };
      await fs.writeFile(
        `${projectPath}/scene.json`,
        JSON.stringify(sceneData, null, 2)
      );

      log('success', 'Project saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save project';
      setError(message);
      log('error', message);
    }
  }, [fs, projectPath, projectConfig, log]);

  // Read a file
  const readFile = useCallback(async (path: string): Promise<string | null> => {
    if (!fs) return null;
    try {
      return await fs.readFile(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read file';
      log('error', message);
      return null;
    }
  }, [fs, log]);

  // Write a file
  const writeFile = useCallback(async (path: string, content: string): Promise<boolean> => {
    if (!fs) return false;
    try {
      await fs.writeFile(path, content);
      log('info', `Saved: ${path.split('/').pop()}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to write file';
      log('error', message);
      return false;
    }
  }, [fs, log]);

  // Create a new file
  const createFile = useCallback(async (path: string, content: string = ''): Promise<boolean> => {
    if (!fs) return false;
    try {
      await fs.writeFile(path, content);
      await refreshFileTree();
      log('success', `Created: ${path.split('/').pop()}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create file';
      log('error', message);
      return false;
    }
  }, [fs, refreshFileTree, log]);

  // Create a new directory
  const createDirectory = useCallback(async (path: string): Promise<boolean> => {
    if (!fs) return false;
    try {
      await fs.createDirectory(path);
      await refreshFileTree();
      log('success', `Created folder: ${path.split('/').pop()}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create folder';
      log('error', message);
      return false;
    }
  }, [fs, refreshFileTree, log]);

  // Delete a file or directory
  const deleteEntry = useCallback(async (path: string): Promise<boolean> => {
    if (!fs) return false;
    try {
      await fs.deleteFile(path);
      await refreshFileTree();
      log('info', `Deleted: ${path.split('/').pop()}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      log('error', message);
      return false;
    }
  }, [fs, refreshFileTree, log]);

  // Clear recent projects
  const clearRecentProjects = useCallback(() => {
    saveRecentProjects([]);
  }, [saveRecentProjects]);

  // Auto-save: watch for scene changes and save after a delay
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!fs || !projectPath || !projectConfig) return;

    // Subscribe to scene changes
    const unsubscribe = useEngineState.subscribe(
      (state) => state.scene.rootNode,
      (rootNode) => {
        // Serialize to compare
        const serialized = JSON.stringify(rootNode);

        // Skip if unchanged
        if (serialized === lastSavedRef.current) return;

        // Clear existing timer
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }

        // Set new timer for auto-save (2 second delay)
        autoSaveTimerRef.current = setTimeout(async () => {
          try {
            const sceneData = {
              version: '1.0.0',
              rootNode,
              savedAt: new Date().toISOString(),
            };
            await fs.writeFile(
              `${projectPath}/scene.json`,
              JSON.stringify(sceneData, null, 2)
            );
            lastSavedRef.current = serialized;
          } catch {
            // Auto-save failed silently
          }
        }, 2000);
      }
    );

    return () => {
      unsubscribe();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [fs, projectPath, projectConfig]);

  // Create a project in a specific folder (after confirmation)
  const createProjectInFolder = useCallback(async (projectDir: string, demoId: string | null, demoName: string) => {
    if (!fs) {
      const errMsg = 'File system not initialized.';
      log('error', errMsg);
      setError(errMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const demo = getDemoProject(demoId || 'empty');
      if (!demo) {
        throw new Error(`Demo project not found: ${demoId}`);
      }

      log('info', `Replacing contents and creating project "${demoName}" at: ${projectDir}`);

      // Write project.json
      const projectConfig = { ...demo.projectJson, name: demoName };
      await fs.writeFile(
        `${projectDir}/project.json`,
        JSON.stringify(projectConfig, null, 2)
      );

      // Write scene.json
      await fs.writeFile(
        `${projectDir}/scene.json`,
        JSON.stringify(demo.sceneJson, null, 2)
      );

      // Create palettes directory and write palette files
      if (Object.keys(demo.palettes).length > 0) {
        try {
          await fs.createDirectory(`${projectDir}/palettes`);
        } catch {
          // Directory might already exist
        }

        for (const [relativePath, content] of Object.entries(demo.palettes)) {
          const fullPath = `${projectDir}/palettes/${relativePath}`;
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

          try {
            await fs.createDirectory(dir);
          } catch {
            // Directory might already exist
          }

          await fs.writeFile(fullPath, JSON.stringify(content, null, 2));
        }
      }

      // Clear old directories that shouldn't exist (like graphs/)
      try {
        const { remove } = await import('@tauri-apps/plugin-fs');
        const entries = await fs.readDirectory(projectDir);
        const foldersToRemove = ['graphs']; // Old folders to clean up
        for (const entry of entries) {
          if (entry.isDirectory && foldersToRemove.includes(entry.name)) {
            await remove(`${projectDir}/${entry.name}`, { recursive: true });
          }
        }
      } catch {
        // Ignore old folder cleanup errors
      }

      // Create scripts directory and write script files
      if (demo.scripts && Object.keys(demo.scripts).length > 0) {
        try {
          await fs.createDirectory(`${projectDir}/scripts`);
        } catch {
          // Directory might already exist
        }

        for (const [relativePath, content] of Object.entries(demo.scripts)) {
          const fullPath = `${projectDir}/scripts/${relativePath}`;
          await fs.writeFile(fullPath, content);
        }
      }

      // Open the new project
      await openProject(projectDir);

      // Set minimal post-processing preset for demo scenes
      if (demoId && demoId !== 'empty') {
        const { DEFAULT_CRT_SETTINGS } = await import('../stores/engineState');
        useEngineState.getState().setPath(['renderPipeline', 'globalPostProcess'], {
          enabled: true,
          crtEnabled: true,
          crtSettings: { ...DEFAULT_CRT_SETTINGS, scanlines: 0.2, bloom: 0.2, vignette: 0.2 },
          effects: [],
          preset: 'minimal',
        });
      }

      log('success', `Created project: ${demoName}`);
    } catch (err) {
      console.error('[useProject] Error creating project in folder:', err);
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      log('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [fs, openProject, log]);

  return {
    // State
    isLoading,
    error,
    projectPath,
    projectConfig,
    fileTree,
    expandedDirs,
    recentProjects,
    hasProject: !!projectPath,

    // Project operations
    openProject,
    createProject,
    createProjectFromDemo,
    createProjectInFolder,
    saveProject,

    // File operations
    readFile,
    writeFile,
    createFile,
    createDirectory,
    deleteEntry,

    // Tree operations
    toggleDirectory,
    refreshFileTree,

    // Recent projects
    clearRecentProjects,
  };
}
