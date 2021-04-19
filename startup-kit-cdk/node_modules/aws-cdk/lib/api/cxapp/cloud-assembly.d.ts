import * as cxapi from '@aws-cdk/cx-api';
export declare enum DefaultSelection {
    /**
     * Returns an empty selection in case there are no selectors.
     */
    None = "none",
    /**
     * If the app includes a single stack, returns it. Otherwise throws an exception.
     * This behavior is used by "deploy".
     */
    OnlySingle = "single",
    /**
     * If no selectors are provided, returns all stacks in the app.
     */
    AllStacks = "all"
}
export interface SelectStacksOptions {
    /**
     * Extend the selection to upstread/downstream stacks
     * @default ExtendedStackSelection.None only select the specified stacks.
     */
    extend?: ExtendedStackSelection;
    /**
     * The behavior if if no selectors are privided.
     */
    defaultBehavior: DefaultSelection;
}
/**
 * When selecting stacks, what other stacks to include because of dependencies
 */
export declare enum ExtendedStackSelection {
    /**
     * Don't select any extra stacks
     */
    None = 0,
    /**
     * Include stacks that this stack depends on
     */
    Upstream = 1,
    /**
     * Include stacks that depend on this stack
     */
    Downstream = 2
}
/**
 * A single Cloud Assembly and the operations we do on it to deploy the artifacts inside
 */
export declare class CloudAssembly {
    readonly assembly: cxapi.CloudAssembly;
    /**
     * The directory this CloudAssembly was read from
     */
    readonly directory: string;
    constructor(assembly: cxapi.CloudAssembly);
    selectStacks(selectors: string[], options: SelectStacksOptions): Promise<StackCollection>;
    /**
     * Select a single stack by its ID
     */
    stackById(stackId: string): StackCollection;
}
/**
 * A collection of stacks and related artifacts
 *
 * In practice, not all artifacts in the CloudAssembly are created equal;
 * stacks can be selected independently, but other artifacts such as asset
 * bundles cannot.
 */
export declare class StackCollection {
    readonly assembly: CloudAssembly;
    readonly stackArtifacts: cxapi.CloudFormationStackArtifact[];
    constructor(assembly: CloudAssembly, stackArtifacts: cxapi.CloudFormationStackArtifact[]);
    get stackCount(): number;
    get firstStack(): cxapi.CloudFormationStackArtifact;
    get stackIds(): string[];
    reversed(): StackCollection;
    /**
     * Extracts 'aws:cdk:warning|info|error' metadata entries from the stack synthesis
     */
    processMetadataMessages(options?: MetadataMessageOptions): void;
}
export interface MetadataMessageOptions {
    /**
     * Whether to be verbose
     *
     * @default false
     */
    verbose?: boolean;
    /**
     * Don't stop on error metadata
     *
     * @default false
     */
    ignoreErrors?: boolean;
    /**
     * Treat warnings in metadata as errors
     *
     * @default false
     */
    strict?: boolean;
}
