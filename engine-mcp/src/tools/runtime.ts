// src/tools/runtime.ts
// Runtime, debugging, and execution tools for the ASCII Dungeon engine MCP server

import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const EDITOR_ROOT = path.resolve(PROJECT_ROOT, 'editor');

// Store for running processes
const runningProcesses = new Map<string, ChildProcess>();

// Log buffer for capturing output
interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

const logBuffer: LogEntry[] = [];
const MAX_LOG_ENTRIES = 1000;

function addLog(level: LogEntry['level'], message: string, source?: string) {
  logBuffer.push({
    timestamp: new Date(),
    level,
    message,
    source
  });
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build & Run Tools
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run npm command in the editor directory
 */
export function runNpmCommand(command: string): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    exec(`npm ${command}`, { cwd: EDITOR_ROOT, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        addLog('error', stderr || error.message, 'npm');
        resolve({ success: false, output: stdout, error: stderr || error.message });
      } else {
        addLog('info', stdout, 'npm');
        resolve({ success: true, output: stdout });
      }
    });
  });
}

/**
 * Build the editor project
 */
export async function buildProject(): Promise<{ success: boolean; output: string; errors?: string[] }> {
  const result = await runNpmCommand('run build');

  // Parse TypeScript errors if any
  const errors: string[] = [];
  if (!result.success && result.error) {
    const errorLines = result.error.split('\n').filter(line =>
      line.includes('error TS') || line.includes('Error:')
    );
    errors.push(...errorLines);
  }

  return {
    success: result.success,
    output: result.output,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Run TypeScript type checking without building
 */
export async function typeCheck(): Promise<{ success: boolean; errors: string[] }> {
  const result = await runNpmCommand('run typecheck 2>&1 || npx tsc --noEmit 2>&1');

  const errors: string[] = [];
  const combined = result.output + (result.error || '');
  const lines = combined.split('\n');

  for (const line of lines) {
    if (line.includes('error TS') || line.match(/\.tsx?:\d+:\d+/)) {
      errors.push(line.trim());
    }
  }

  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Run the development server
 */
export function startDevServer(): Promise<{ success: boolean; pid?: number; message: string }> {
  return new Promise((resolve) => {
    if (runningProcesses.has('dev-server')) {
      resolve({ success: false, message: 'Dev server is already running' });
      return;
    }

    const child = spawn('npm', ['run', 'dev'], {
      cwd: EDITOR_ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    runningProcesses.set('dev-server', child);

    child.stdout?.on('data', (data) => {
      addLog('info', data.toString(), 'dev-server');
    });

    child.stderr?.on('data', (data) => {
      addLog('error', data.toString(), 'dev-server');
    });

    child.on('exit', (code) => {
      runningProcesses.delete('dev-server');
      addLog('info', `Dev server exited with code ${code}`, 'dev-server');
    });

    // Give it a moment to start
    setTimeout(() => {
      resolve({
        success: true,
        pid: child.pid,
        message: 'Dev server started. Check logs for output.'
      });
    }, 2000);
  });
}

/**
 * Stop the development server
 */
export function stopDevServer(): { success: boolean; message: string } {
  const child = runningProcesses.get('dev-server');
  if (child) {
    child.kill();
    runningProcesses.delete('dev-server');
    return { success: true, message: 'Dev server stopped' };
  }
  return { success: false, message: 'Dev server is not running' };
}

/**
 * Run tests
 */
export async function runTests(pattern?: string): Promise<{ success: boolean; output: string; summary?: string }> {
  const command = pattern ? `run test -- --grep "${pattern}"` : 'run test';
  const result = await runNpmCommand(command);

  // Extract test summary
  const lines = result.output.split('\n');
  const summaryLine = lines.find(l => l.includes('passed') || l.includes('failed'));

  return {
    success: result.success,
    output: result.output,
    summary: summaryLine
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging & Debugging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recent logs
 */
export function getLogs(options?: {
  level?: LogEntry['level'];
  source?: string;
  limit?: number;
  since?: Date;
}): LogEntry[] {
  let logs = [...logBuffer];

  if (options?.level) {
    logs = logs.filter(l => l.level === options.level);
  }
  if (options?.source) {
    logs = logs.filter(l => l.source === options.source);
  }
  if (options?.since) {
    const sinceDate = options.since;
    logs = logs.filter(l => l.timestamp >= sinceDate);
  }

  const limit = options?.limit || 50;
  return logs.slice(-limit);
}

/**
 * Clear logs
 */
export function clearLogs(): { cleared: number } {
  const count = logBuffer.length;
  logBuffer.length = 0;
  return { cleared: count };
}

/**
 * Get running processes
 */
export function getRunningProcesses(): Array<{ name: string; pid?: number }> {
  return Array.from(runningProcesses.entries()).map(([name, proc]) => ({
    name,
    pid: proc.pid
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// File Watching & Live Reload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recently modified files
 */
export async function getRecentlyModifiedFiles(options?: {
  directory?: string;
  extension?: string;
  since?: number; // minutes ago
}): Promise<Array<{ path: string; modified: Date }>> {
  const dir = options?.directory || path.join(EDITOR_ROOT, 'src');
  const sinceMs = (options?.since || 30) * 60 * 1000;
  const cutoff = Date.now() - sinceMs;
  const results: Array<{ path: string; modified: Date }> = [];

  async function walk(d: string) {
    try {
      const entries = await fs.promises.readdir(d, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;

        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          if (options?.extension && !entry.name.endsWith(options.extension)) continue;

          const stat = await fs.promises.stat(fullPath);
          if (stat.mtimeMs > cutoff) {
            results.push({ path: fullPath, modified: stat.mtime });
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  await walk(dir);
  return results.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Execution & Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate TypeScript code snippet (dry-run analysis)
 * This doesn't actually execute - it type-checks the code
 */
export async function analyzeCode(code: string): Promise<{
  valid: boolean;
  errors: string[];
  suggestions: string[];
}> {
  // Write temp file
  const tempFile = path.join(EDITOR_ROOT, '.temp-eval.ts');

  // Wrap code with common imports
  const wrappedCode = `
import { Component } from './src/scripting/Component';
import { component, property, action, signal, lifecycle } from './src/scripting/decorators';

// User code:
${code}
`;

  try {
    await fs.promises.writeFile(tempFile, wrappedCode);

    // Type check with tsc
    const result = await runNpmCommand(`exec tsc -- --noEmit ${tempFile} 2>&1`);

    const errors: string[] = [];
    const lines = (result.output + (result.error || '')).split('\n');

    for (const line of lines) {
      if (line.includes('error TS')) {
        errors.push(line.replace(tempFile, '<code>').trim());
      }
    }

    // Clean up
    await fs.promises.unlink(tempFile).catch(() => {});

    return {
      valid: errors.length === 0,
      errors,
      suggestions: errors.length > 0 ? ['Check for typos and missing imports'] : []
    };
  } catch (e) {
    await fs.promises.unlink(tempFile).catch(() => {});
    return {
      valid: false,
      errors: [String(e)],
      suggestions: []
    };
  }
}

/**
 * Get project status overview
 */
export async function getProjectStatus(): Promise<{
  editor: {
    hasNodeModules: boolean;
    hasDistFolder: boolean;
    packageVersion: string;
  };
  git: {
    branch: string;
    hasChanges: boolean;
    uncommittedFiles: number;
  };
  processes: Array<{ name: string; pid?: number }>;
  recentErrors: LogEntry[];
}> {
  // Check editor status
  const hasNodeModules = fs.existsSync(path.join(EDITOR_ROOT, 'node_modules'));
  const hasDistFolder = fs.existsSync(path.join(EDITOR_ROOT, 'dist'));

  let packageVersion = 'unknown';
  try {
    const pkg = JSON.parse(await fs.promises.readFile(path.join(EDITOR_ROOT, 'package.json'), 'utf-8'));
    packageVersion = pkg.version;
  } catch (e) {}

  // Check git status
  let branch = 'unknown';
  let hasChanges = false;
  let uncommittedFiles = 0;

  try {
    const gitResult = await new Promise<string>((resolve) => {
      exec('git status --porcelain -b', { cwd: PROJECT_ROOT }, (err, stdout) => {
        resolve(stdout || '');
      });
    });

    const lines = gitResult.split('\n').filter(l => l.trim());
    if (lines[0]) {
      const branchMatch = lines[0].match(/## (.+?)(?:\.\.\.|$)/);
      if (branchMatch) branch = branchMatch[1];
    }
    uncommittedFiles = lines.length - 1;
    hasChanges = uncommittedFiles > 0;
  } catch (e) {}

  return {
    editor: {
      hasNodeModules,
      hasDistFolder,
      packageVersion
    },
    git: {
      branch,
      hasChanges,
      uncommittedFiles
    },
    processes: getRunningProcesses(),
    recentErrors: getLogs({ level: 'error', limit: 5 })
  };
}

/**
 * Read a specific log file
 */
export async function readLogFile(logPath: string, lines: number = 100): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  try {
    const fullPath = path.isAbsolute(logPath) ? logPath : path.join(PROJECT_ROOT, logPath);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const allLines = content.split('\n');
    return {
      success: true,
      content: allLines.slice(-lines).join('\n')
    };
  } catch (e) {
    return {
      success: false,
      error: String(e)
    };
  }
}

/**
 * Search for errors in source files
 */
export async function findErrorPatterns(): Promise<Array<{
  file: string;
  line: number;
  pattern: string;
  context: string;
}>> {
  const results: Array<{ file: string; line: number; pattern: string; context: string }> = [];
  const srcDir = path.join(EDITOR_ROOT, 'src');

  const patterns = [
    /console\.error\(/g,
    /throw new Error/g,
    /TODO:/gi,
    /FIXME:/gi,
    /HACK:/gi,
    /BUG:/gi,
  ];

  async function walkAndSearch(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkAndSearch(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of patterns) {
            if (pattern.test(lines[i])) {
              results.push({
                file: path.relative(PROJECT_ROOT, fullPath),
                line: i + 1,
                pattern: pattern.source,
                context: lines[i].trim().slice(0, 100)
              });
              pattern.lastIndex = 0; // Reset regex
            }
          }
        }
      }
    }
  }

  await walkAndSearch(srcDir);
  return results;
}
