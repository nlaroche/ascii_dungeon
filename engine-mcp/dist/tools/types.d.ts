export interface PropertyInfo {
    name: string;
    type: string;
    isOptional: boolean;
    jsdoc?: string;
}
export interface InterfaceInfo {
    name: string;
    properties: PropertyInfo[];
    extends: string[];
    jsdoc?: string;
}
export interface TypeAliasInfo {
    name: string;
    type: string;
    jsdoc?: string;
}
export interface UsageInfo {
    filePath: string;
    line: number;
    character: number;
    context: string;
}
export declare function extractInterfaces(filePath: string): InterfaceInfo[];
export declare function extractTypes(filePath: string): TypeAliasInfo[];
export declare function extractExports(filePath: string): string[];
export declare function getTypeUsages(typeName: string, basePath: string): UsageInfo[];
