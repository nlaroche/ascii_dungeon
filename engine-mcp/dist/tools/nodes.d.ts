type NodeCategory = 'event' | 'action' | 'condition' | 'data' | 'flow' | 'custom';
interface NodePortDefinition {
    id: string;
    label: string;
    type: 'flow' | 'string' | 'number' | 'boolean' | 'any' | 'entity' | 'position';
    required?: boolean;
}
interface NodeTypeDefinition {
    id: string;
    name: string;
    category: NodeCategory;
    description: string;
    icon: string;
    color: string;
    inputs: NodePortDefinition[];
    outputs: NodePortDefinition[];
}
/**
 * List all node types
 */
export declare function listNodeTypes(): Promise<NodeTypeDefinition[]>;
/**
 * Get nodes filtered by category
 */
export declare function getNodesByCategory(category: NodeCategory): Promise<NodeTypeDefinition[]>;
/**
 * Search nodes by name or description
 */
export declare function searchNodes(query: string): Promise<NodeTypeDefinition[]>;
/**
 * Get node by ID
 */
export declare function getNodeType(id: string): Promise<NodeTypeDefinition | null>;
/**
 * Get statistics about node types
 */
export declare function getNodeStats(): Promise<Record<string, number>>;
/**
 * Get the pattern for creating new node executors
 */
export declare function getNodeExecutorPattern(): string;
/**
 * Get categories with descriptions
 */
export declare function getNodeCategories(): Array<{
    id: NodeCategory;
    name: string;
    color: string;
    description: string;
}>;
export {};
