export interface ConsistencyIssue {
    file: string;
    line?: number;
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
    suggestion?: string;
}
export interface ConsistencyReport {
    issues: ConsistencyIssue[];
    summary: {
        errors: number;
        warnings: number;
        info: number;
    };
    passed: boolean;
}
export declare const DEFAULT_BASE_PATH: string;
export declare function checkComponentConsistency(basePath?: string): Promise<ConsistencyIssue[]>;
export declare function checkNamingConsistency(basePath?: string): Promise<ConsistencyIssue[]>;
export declare function checkImportConsistency(basePath?: string): Promise<ConsistencyIssue[]>;
export declare function checkDecoratorConsistency(basePath?: string): Promise<ConsistencyIssue[]>;
export declare function runAllChecks(basePath?: string): Promise<ConsistencyReport>;
/**
 * Get a formatted report string
 */
export declare function formatReport(report: ConsistencyReport): string;
