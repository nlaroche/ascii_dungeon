export interface DependencyNode {
    filePath: string;
    imports: string[];
    importedBy: string[];
}
export interface DependencyGraph {
    nodes: Map<string, DependencyNode>;
    edges: Map<string, Set<string>>;
}
export interface DependencyTreeNode {
    file: string;
    dependencies: DependencyTreeNode[];
}
export declare const DEFAULT_BASE_PATH: string;
export declare function buildDependencyGraph(basePath?: string): Promise<DependencyGraph>;
export declare function getFileDependencies(filePath: string, graph: DependencyGraph): string[];
export declare function getFileDependents(filePath: string, graph: DependencyGraph): string[];
export declare function findCircularDependencies(graph: DependencyGraph): string[][];
export declare function findEntryPoints(graph: DependencyGraph): string[];
export declare function findCoreModules(graph: DependencyGraph, threshold?: number): string[];
export declare function getDependencyTree(filePath: string, graph: DependencyGraph, maxDepth?: number, currentDepth?: number, visited?: Set<string>): DependencyTreeNode;
/**
 * Get a summary of the dependency graph
 */
export declare function getDependencyStats(graph: DependencyGraph): {
    totalFiles: number;
    totalEdges: number;
    avgImports: number;
    avgImportedBy: number;
    circularCount: number;
    entryPoints: number;
    coreModules: number;
};
