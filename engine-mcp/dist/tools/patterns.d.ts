export interface NamingConventions {
    filePatterns: string[];
    classPatterns: string[];
    functionPatterns: string[];
    variablePatterns: string[];
}
export interface DecoratorPattern {
    name: string;
    usage: string;
    example: string;
    count: number;
}
export interface DirectoryInfo {
    name: string;
    purpose: string;
    fileCount: number;
    patterns: string[];
}
export interface FileOrganization {
    directories: DirectoryInfo[];
    commonImports: string[];
    indexExports: string[];
}
export interface CodePattern {
    name: string;
    description: string;
    example: string;
    occurrences: number;
}
export interface PatternSummary {
    naming: NamingConventions;
    decorators: DecoratorPattern[];
    organization: FileOrganization;
    codePatterns: CodePattern[];
}
export declare const DEFAULT_BASE_PATH: string;
export declare function extractNamingConventions(basePath?: string): Promise<NamingConventions>;
export declare function extractDecoratorPatterns(basePath?: string): Promise<DecoratorPattern[]>;
export declare function extractFileOrganization(basePath?: string): Promise<FileOrganization>;
export declare function extractCodePatterns(basePath?: string): Promise<CodePattern[]>;
export declare function getPatternSummary(basePath?: string): Promise<PatternSummary>;
