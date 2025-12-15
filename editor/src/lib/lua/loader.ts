// ═══════════════════════════════════════════════════════════════════════════
// Lua File Loader - Load and execute Lua files from the project
// ═══════════════════════════════════════════════════════════════════════════

import { getFileSystem } from '../filesystem';
import { runLuaUI, UIDefinition } from './bindings';

export interface LoadedLuaFile {
  path: string;
  name: string;
  content: string;
  uiDefinition: UIDefinition | null;
  error: string | null;
}

/**
 * Load a Lua file and optionally execute it as UI
 */
export async function loadLuaFile(path: string, executeAsUI = true): Promise<LoadedLuaFile> {
  const fs = await getFileSystem();
  const name = path.split('/').pop() || path;

  try {
    const content = await fs.readFile(path);

    if (!executeAsUI) {
      return { path, name, content, uiDefinition: null, error: null };
    }

    try {
      const uiDefinition = runLuaUI(content);
      return { path, name, content, uiDefinition, error: null };
    } catch (e) {
      return { path, name, content, uiDefinition: null, error: (e as Error).message };
    }
  } catch (e) {
    return {
      path,
      name,
      content: '',
      uiDefinition: null,
      error: `Failed to load file: ${(e as Error).message}`,
    };
  }
}

/**
 * Find all Lua files in a directory (non-recursive by default)
 */
export async function findLuaFiles(
  basePath: string,
  recursive = false
): Promise<string[]> {
  const fs = await getFileSystem();
  const luaFiles: string[] = [];

  async function scanDir(dirPath: string) {
    try {
      const entries = await fs.readDirectory(dirPath);

      for (const entry of entries) {
        if (entry.isDirectory && recursive) {
          await scanDir(entry.path);
        } else if (!entry.isDirectory && entry.name.endsWith('.lua')) {
          luaFiles.push(entry.path);
        }
      }
    } catch {
      // Directory might not exist or be inaccessible
    }
  }

  await scanDir(basePath);
  return luaFiles;
}

/**
 * Find Lua UI template files in common locations
 */
export async function findUITemplates(projectRoot: string): Promise<string[]> {
  const possiblePaths = [
    `${projectRoot}/templates`,
    `${projectRoot}/ui`,
    `${projectRoot}/views`,
    `${projectRoot}/panels`,
    `${projectRoot}/lua`,
  ];

  const allFiles: string[] = [];

  for (const path of possiblePaths) {
    const files = await findLuaFiles(path, true);
    allFiles.push(...files);
  }

  return allFiles;
}
