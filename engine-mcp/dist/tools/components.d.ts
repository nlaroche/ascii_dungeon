interface PropertyMetadata {
    type: string;
    label?: string;
    group?: string;
    min?: number;
    max?: number;
    step?: number;
    tooltip?: string;
    options?: string[];
}
interface ActionMetadata {
    methodName: string;
    displayName?: string;
    category?: string;
    description?: string;
    outputs?: string[];
}
interface SignalMetadata {
    propertyName: string;
    displayName?: string;
    description?: string;
}
interface ComponentInfo {
    name: string;
    icon?: string;
    description?: string;
    category?: string;
    properties: Record<string, PropertyMetadata>;
    actions: Record<string, ActionMetadata>;
    signals: Record<string, SignalMetadata>;
    filePath: string;
}
/**
 * List all components in the engine
 */
export declare function listComponents(): Promise<ComponentInfo[]>;
/**
 * Get detailed schema for a specific component
 */
export declare function getComponentSchema(name: string): Promise<ComponentInfo | null>;
/**
 * Search components by name or description
 */
export declare function searchComponents(query: string): Promise<ComponentInfo[]>;
/**
 * Get component creation pattern/template
 */
export declare function getComponentPattern(): string;
export {};
