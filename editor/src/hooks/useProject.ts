// ═══════════════════════════════════════════════════════════════════════════
// useProject - Project management hook
// Handles opening, saving, creating projects and browsing files
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react';
import { getFileSystem, FileSystem, FileEntry, createProjectFromTemplate } from '../lib/filesystem';
import { useEngineState } from '../stores/useEngineState';

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

      log('success', `Opened project: ${config.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open project';
      setError(message);
      log('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [fs, loadDirectory, setPath, log, addToRecentProjects]);

  // Create a new project
  const createProject = useCallback(async () => {
    console.log('[useProject] createProject called, fs:', !!fs);
    if (!fs) {
      log('error', 'File system not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Pick directory
      console.log('[useProject] Picking directory...');
      const projectDir = await fs.pickDirectory();
      console.log('[useProject] Directory picked:', projectDir);
      if (!projectDir) {
        setIsLoading(false);
        log('info', 'Project creation cancelled');
        return;
      }

      // Create project from template
      console.log('[useProject] Creating project from template...');
      await createProjectFromTemplate(fs, projectDir);
      console.log('[useProject] Template files created');

      // Load the new project
      console.log('[useProject] Opening project...');
      await openProject(projectDir);

      log('success', `Created new project at: ${projectDir}`);
    } catch (err) {
      console.error('[useProject] Error creating project:', err);
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      log('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [fs, openProject, log]);

  // Save project configuration
  const saveProject = useCallback(async () => {
    if (!fs || !projectPath || !projectConfig) return;

    try {
      await fs.writeFile(
        `${projectPath}/project.json`,
        JSON.stringify(projectConfig, null, 2)
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
