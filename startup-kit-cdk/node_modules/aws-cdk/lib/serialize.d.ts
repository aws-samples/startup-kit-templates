/**
 * Stringify to YAML
 */
export declare function toYAML(obj: any): string;
/**
 * Parse either YAML or JSON
 */
export declare function deserializeStructure(str: string): any;
/**
 * Serialize to either YAML or JSON
 */
export declare function serializeStructure(object: any, json: boolean): string;
/**
 * Load a YAML or JSON file from disk
 */
export declare function loadStructuredFile(fileName: string): Promise<any>;
