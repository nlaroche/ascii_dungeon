export interface SystemDoc {
    name: string;
    overview: string;
    coreFiles: string[];
    concepts: string[];
    executionModel?: string;
    examples?: string[];
    commonPatterns?: string[];
    pitfalls?: string[];
}
export declare const ENGINE_DOCS: Record<string, SystemDoc>;
/**
 * Get documentation for a specific system
 */
export declare function getSystemDoc(system: string): SystemDoc | null;
/**
 * List all available documentation topics
 */
export declare function listDocTopics(): Array<{
    id: string;
    name: string;
    overview: string;
}>;
/**
 * Search documentation for a term
 */
export declare function searchDocs(query: string): Array<{
    topic: string;
    matches: string[];
}>;
/**
 * Get a quick reference for common tasks
 */
export declare function getQuickReference(task: string): string | null;
/**
 * List available quick references
 */
export declare function listQuickReferences(): string[];
