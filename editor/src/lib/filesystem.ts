// ═══════════════════════════════════════════════════════════════════════════
// File System Abstraction Layer
// Works on Tauri (native fs) and Web (File System Access API + fallback)
// ═══════════════════════════════════════════════════════════════════════════

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: number;
  children?: FileEntry[];
}

export interface FileSystem {
  // Check if this FS implementation is available
  isAvailable(): Promise<boolean>;

  // Directory operations
  pickDirectory(): Promise<string | null>;
  readDirectory(path: string): Promise<FileEntry[]>;
  createDirectory(path: string): Promise<void>;

  // File operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;

  // Watching (optional)
  watch?(path: string, callback: (event: FileWatchEvent) => void): () => void;
}

export interface FileWatchEvent {
  type: 'create' | 'modify' | 'delete';
  path: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tauri File System (Native)
// ─────────────────────────────────────────────────────────────────────────────

class TauriFileSystem implements FileSystem {
  private fs: typeof import('@tauri-apps/plugin-fs') | null = null;
  private dialog: typeof import('@tauri-apps/plugin-dialog') | null = null;

  async init() {
    if (this.fs) return;
    try {
      this.fs = await import('@tauri-apps/plugin-fs');
      this.dialog = await import('@tauri-apps/plugin-dialog');
    } catch {
      // Not in Tauri environment
    }
  }

  async isAvailable(): Promise<boolean> {
    await this.init();
    return this.fs !== null;
  }

  async pickDirectory(): Promise<string | null> {
    await this.init();
    if (!this.dialog) return null;

    const result = await this.dialog.open({
      directory: true,
      multiple: false,
      title: 'Select Project Directory',
    });

    return result as string | null;
  }

  async readDirectory(path: string): Promise<FileEntry[]> {
    await this.init();
    if (!this.fs) throw new Error('Tauri FS not available');

    const entries = await this.fs.readDir(path);
    const result: FileEntry[] = [];

    for (const entry of entries) {
      const fullPath = `${path}/${entry.name}`;
      result.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory,
      });
    }

    // Sort: directories first, then alphabetically
    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async createDirectory(path: string): Promise<void> {
    await this.init();
    if (!this.fs) throw new Error('Tauri FS not available');
    await this.fs.mkdir(path, { recursive: true });
  }

  async readFile(path: string): Promise<string> {
    await this.init();
    if (!this.fs) throw new Error('Tauri FS not available');
    return await this.fs.readTextFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.init();
    if (!this.fs) throw new Error('Tauri FS not available');
    await this.fs.writeTextFile(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    await this.init();
    if (!this.fs) throw new Error('Tauri FS not available');
    await this.fs.remove(path);
  }

  async exists(path: string): Promise<boolean> {
    await this.init();
    if (!this.fs) return false;
    return await this.fs.exists(path);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Web File System (File System Access API)
// ─────────────────────────────────────────────────────────────────────────────

class WebFileSystem implements FileSystem {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private rootPath: string = '';

  async isAvailable(): Promise<boolean> {
    return 'showDirectoryPicker' in window;
  }

  async pickDirectory(): Promise<string | null> {
    try {
      // @ts-expect-error - showDirectoryPicker is not in all TS libs
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      this.rootHandle = handle;
      this.rootPath = handle.name;
      return this.rootPath;
    } catch {
      return null;
    }
  }

  private async getHandle(path: string): Promise<FileSystemHandle | null> {
    if (!this.rootHandle) return null;

    const parts = path.split('/').filter(Boolean);
    if (parts[0] === this.rootPath) parts.shift();

    let current: FileSystemDirectoryHandle = this.rootHandle;

    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i]);
      } catch {
        return null;
      }
    }

    if (parts.length === 0) return current;

    const lastName = parts[parts.length - 1];
    try {
      return await current.getFileHandle(lastName);
    } catch {
      try {
        return await current.getDirectoryHandle(lastName);
      } catch {
        return null;
      }
    }
  }

  async readDirectory(path: string): Promise<FileEntry[]> {
    if (!this.rootHandle) throw new Error('No directory selected');

    const parts = path.split('/').filter(Boolean);
    if (parts[0] === this.rootPath) parts.shift();

    let current: FileSystemDirectoryHandle = this.rootHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }

    const entries: FileEntry[] = [];
    // @ts-expect-error - entries() iterator
    for await (const [name, handle] of current.entries()) {
      entries.push({
        name,
        path: path ? `${path}/${name}` : name,
        isDirectory: handle.kind === 'directory',
      });
    }

    return entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async createDirectory(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No directory selected');

    const parts = path.split('/').filter(Boolean);
    if (parts[0] === this.rootPath) parts.shift();

    let current = this.rootHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }

  async readFile(path: string): Promise<string> {
    const handle = await this.getHandle(path);
    if (!handle || handle.kind !== 'file') {
      throw new Error(`File not found: ${path}`);
    }
    const file = await (handle as FileSystemFileHandle).getFile();
    return await file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No directory selected');

    const parts = path.split('/').filter(Boolean);
    if (parts[0] === this.rootPath) parts.shift();

    let current: FileSystemDirectoryHandle = this.rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i], { create: true });
    }

    const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No directory selected');

    const parts = path.split('/').filter(Boolean);
    if (parts[0] === this.rootPath) parts.shift();

    let current: FileSystemDirectoryHandle = this.rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }

    await current.removeEntry(parts[parts.length - 1], { recursive: true });
  }

  async exists(path: string): Promise<boolean> {
    const handle = await this.getHandle(path);
    return handle !== null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Virtual File System (IndexedDB fallback for browsers without FS Access)
// ─────────────────────────────────────────────────────────────────────────────

class VirtualFileSystem implements FileSystem {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'ascii-dungeon-vfs';
  private readonly STORE_NAME = 'files';

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'path' });
        }
      };
    });
  }

  async isAvailable(): Promise<boolean> {
    return 'indexedDB' in window;
  }

  async pickDirectory(): Promise<string | null> {
    // For virtual FS, we just create a virtual project
    const projectName = prompt('Enter project name:', 'my-project');
    if (!projectName) return null;

    const path = `/${projectName}`;
    await this.createDirectory(path);
    return path;
  }

  async readDirectory(path: string): Promise<FileEntry[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allFiles = request.result as Array<{ path: string; isDirectory: boolean; content?: string }>;
        const normalizedPath = path.endsWith('/') ? path : path + '/';

        const entries: FileEntry[] = [];
        const seen = new Set<string>();

        for (const file of allFiles) {
          if (!file.path.startsWith(normalizedPath)) continue;

          const relative = file.path.slice(normalizedPath.length);
          const parts = relative.split('/');
          const name = parts[0];

          if (!name || seen.has(name)) continue;
          seen.add(name);

          entries.push({
            name,
            path: normalizedPath + name,
            isDirectory: parts.length > 1 || file.isDirectory,
          });
        }

        resolve(entries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        }));
      };
    });
  }

  async createDirectory(path: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put({ path, isDirectory: true });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async readFile(path: string): Promise<string> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result?.content !== undefined) {
          resolve(request.result.content);
        } else {
          reject(new Error(`File not found: ${path}`));
        }
      };
    });
  }

  async writeFile(path: string, content: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put({ path, isDirectory: false, content });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteFile(path: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async exists(path: string): Promise<boolean> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result !== undefined);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File System Factory - Returns the best available implementation
// ─────────────────────────────────────────────────────────────────────────────

let cachedFS: FileSystem | null = null;

export async function getFileSystem(): Promise<FileSystem> {
  if (cachedFS) return cachedFS;

  // Try Tauri first (native desktop)
  const tauriFS = new TauriFileSystem();
  if (await tauriFS.isAvailable()) {
    cachedFS = tauriFS;
    console.log('Using Tauri native file system');
    return cachedFS;
  }

  // Try Web File System Access API (modern browsers)
  const webFS = new WebFileSystem();
  if (await webFS.isAvailable()) {
    cachedFS = webFS;
    console.log('Using Web File System Access API');
    return cachedFS;
  }

  // Fall back to virtual file system (IndexedDB)
  const virtualFS = new VirtualFileSystem();
  cachedFS = virtualFS;
  console.log('Using virtual file system (IndexedDB)');
  return cachedFS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Template
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT_TEMPLATE = {
  'project.json': JSON.stringify({
    name: 'New Project',
    version: '1.0.0',
    engine: 'ascii-dungeon',
    settings: {
      targetFPS: 60,
      resolution: [1280, 720],
    },
  }, null, 2),

  'src/main.ts': `// Main entry point
import { Game } from './game';

const game = new Game();

export function init(): void {
  game.init();
}

export function update(dt: number): void {
  game.update(dt);
}

export function draw(): void {
  game.draw();
}
`,

  'src/game.ts': `// Game module
export class Game {
  init(): void {
    console.log('Game initialized!');
  }

  update(dt: number): void {
    // Update game logic
  }

  draw(): void {
    // Draw game
  }
}
`,

  'src/entities/Player.ts': `// Player entity
export class Player {
  x: number;
  y: number;
  glyph: string = '@';
  color: [number, number, number] = [0.2, 0.9, 0.4];
  health: number = 100;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    // Player update logic
  }
}
`,

  'src/maps/level1.ts': `// Level 1 map data
export const level1 = {
  width: 40,
  height: 30,
  tiles: [] as number[][],
  entities: [
    { type: 'player', x: 5, y: 5 },
  ],
};
`,

  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
  }, null, 2),

  // Palette folder structure
  'palettes/characters/_category.json': JSON.stringify({
    name: 'Characters',
    icon: '@',
    description: 'Player characters, NPCs, and enemies',
  }, null, 2),

  'palettes/environment/_category.json': JSON.stringify({
    name: 'Environment',
    icon: '#',
    description: 'Walls, floors, and terrain',
  }, null, 2),

  'palettes/items/_category.json': JSON.stringify({
    name: 'Items',
    icon: '!',
    description: 'Pickups, equipment, and consumables',
  }, null, 2),

  'palettes/props/_category.json': JSON.stringify({
    name: 'Props',
    icon: '+',
    description: 'Doors, chests, furniture, and decorations',
  }, null, 2),

  // Sample player prefab
  'palettes/characters/player.prefab.json': JSON.stringify({
    id: 'prefab_player',
    name: 'Player',
    category: ['characters'],
    tags: ['player', 'controllable'],
    description: 'The player character',
    template: {
      id: 'player_template',
      name: 'Player',
      type: 'Node',
      children: [],
      components: [
        {
          id: 'comp_rect2d',
          script: 'Rect2D',
          enabled: true,
          properties: { x: 0, y: 0, width: 1, height: 1 },
        },
        {
          id: 'comp_glyph',
          script: 'Glyph',
          enabled: true,
          properties: {
            char: '@',
            fg: [0.2, 0.9, 0.4],
            bg: [0, 0, 0],
          },
        },
      ],
      meta: {},
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  }, null, 2),

  // Sample wall prefab
  'palettes/environment/wall.prefab.json': JSON.stringify({
    id: 'prefab_wall',
    name: 'Wall',
    category: ['environment'],
    tags: ['blocking', 'solid'],
    description: 'A basic wall tile',
    template: {
      id: 'wall_template',
      name: 'Wall',
      type: 'Node',
      children: [],
      components: [
        {
          id: 'comp_rect2d',
          script: 'Rect2D',
          enabled: true,
          properties: { x: 0, y: 0, width: 1, height: 1 },
        },
        {
          id: 'comp_glyph',
          script: 'Glyph',
          enabled: true,
          properties: {
            char: '#',
            fg: [0.4, 0.4, 0.4],
            bg: [0.1, 0.1, 0.1],
          },
        },
      ],
      meta: { blocking: true },
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  }, null, 2),
};

/**
 * Normalize path for cross-platform compatibility
 * Converts backslashes to forward slashes and removes trailing slashes
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

export async function createProjectFromTemplate(fs: FileSystem, basePath: string): Promise<void> {
  // Normalize the base path
  const normalizedBase = normalizePath(basePath);
  console.log('[filesystem] Creating project from template at:', normalizedBase);
  console.log('[filesystem] Original path:', basePath);

  // First, check if the directory exists and is accessible
  try {
    const exists = await fs.exists(normalizedBase);
    console.log('[filesystem] Base path exists:', exists);
  } catch (err) {
    console.error('[filesystem] Error checking base path:', err);
    throw new Error(`Cannot access directory: ${normalizedBase}. Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Process each template file
  for (const [relativePath, content] of Object.entries(PROJECT_TEMPLATE)) {
    const fullPath = `${normalizedBase}/${relativePath}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

    console.log('[filesystem] Processing:', relativePath);
    console.log('[filesystem] Full path:', fullPath);
    console.log('[filesystem] Directory:', dir);

    // Create directory if needed
    if (dir !== normalizedBase) {
      console.log('[filesystem] Creating directory:', dir);
      try {
        await fs.createDirectory(dir);
        console.log('[filesystem] Directory created successfully');
      } catch (err) {
        // Directory might already exist, which is fine
        const errMsg = err instanceof Error ? err.message : String(err);
        if (!errMsg.includes('already exists') && !errMsg.includes('AlreadyExists')) {
          console.error('[filesystem] Failed to create directory:', dir, err);
          throw new Error(`Failed to create directory ${dir}: ${errMsg}`);
        }
        console.log('[filesystem] Directory already exists, continuing...');
      }
    }

    // Write file
    console.log('[filesystem] Writing file:', fullPath);
    try {
      await fs.writeFile(fullPath, content);
      console.log('[filesystem] File written successfully');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[filesystem] Failed to write file:', fullPath, err);
      throw new Error(`Failed to write file ${fullPath}: ${errMsg}`);
    }
  }
  console.log('[filesystem] Project template created successfully');
}
