interface LogEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    source?: string;
}
/**
 * Run npm command in the editor directory
 */
export declare function runNpmCommand(command: string): Promise<{
    success: boolean;
    output: string;
    error?: string;
}>;
/**
 * Build the editor project
 */
export declare function buildProject(): Promise<{
    success: boolean;
    output: string;
    errors?: string[];
}>;
/**
 * Run TypeScript type checking without building
 */
export declare function typeCheck(): Promise<{
    success: boolean;
    errors: string[];
}>;
/**
 * Run the development server
 */
export declare function startDevServer(): Promise<{
    success: boolean;
    pid?: number;
    message: string;
}>;
/**
 * Stop the development server
 */
export declare function stopDevServer(): {
    success: boolean;
    message: string;
};
/**
 * Run tests
 */
export declare function runTests(pattern?: string): Promise<{
    success: boolean;
    output: string;
    summary?: string;
}>;
/**
 * Get recent logs
 */
export declare function getLogs(options?: {
    level?: LogEntry['level'];
    source?: string;
    limit?: number;
    since?: Date;
}): LogEntry[];
/**
 * Clear logs
 */
export declare function clearLogs(): {
    cleared: number;
};
/**
 * Get running processes
 */
export declare function getRunningProcesses(): Array<{
    name: string;
    pid?: number;
}>;
/**
 * Get recently modified files
 */
export declare function getRecentlyModifiedFiles(options?: {
    directory?: string;
    extension?: string;
    since?: number;
}): Promise<Array<{
    path: string;
    modified: Date;
}>>;
/**
 * Evaluate TypeScript code snippet (dry-run analysis)
 * This doesn't actually execute - it type-checks the code
 */
export declare function analyzeCode(code: string): Promise<{
    valid: boolean;
    errors: string[];
    suggestions: string[];
}>;
/**
 * Get project status overview
 */
export declare function getProjectStatus(): Promise<{
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
    processes: Array<{
        name: string;
        pid?: number;
    }>;
    recentErrors: LogEntry[];
}>;
/**
 * Read a specific log file
 */
export declare function readLogFile(logPath: string, lines?: number): Promise<{
    success: boolean;
    content?: string;
    error?: string;
}>;
/**
 * Search for errors in source files
 */
export declare function findErrorPatterns(): Promise<Array<{
    file: string;
    line: number;
    pattern: string;
    context: string;
}>>;
export {};
