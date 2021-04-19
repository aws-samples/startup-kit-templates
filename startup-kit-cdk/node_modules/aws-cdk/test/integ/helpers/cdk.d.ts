/// <reference types="node" />
import * as child_process from 'child_process';
import { AwsClients } from './aws';
import { TestContext } from './test-helpers';
export declare type AwsContext = {
    readonly aws: AwsClients;
};
/**
 * Higher order function to execute a block with an AWS client setup
 *
 * Allocate the next region from the REGION pool and dispose it afterwards.
 */
export declare function withAws<A extends TestContext>(block: (context: A & AwsContext) => Promise<void>): (context: A) => Promise<void>;
/**
 * Higher order function to execute a block with a CDK app fixture
 *
 * Requires an AWS client to be passed in.
 *
 * For backwards compatibility with existing tests (so we don't have to change
 * too much) the inner block is expected to take a `TestFixture` object.
 */
export declare function withCdkApp<A extends TestContext & AwsContext>(block: (context: TestFixture) => Promise<void>): (context: A) => Promise<void>;
export declare function withMonolithicCfnIncludeCdkApp<A extends TestContext>(block: (context: TestFixture) => Promise<void>): (context: A) => Promise<void>;
/**
 * Default test fixture for most (all?) integ tests
 *
 * It's a composition of withAws/withCdkApp, expecting the test block to take a `TestFixture`
 * object.
 *
 * We could have put `withAws(withCdkApp(fixture => { /... actual test here.../ }))` in every
 * test declaration but centralizing it is going to make it convenient to modify in the future.
 */
export declare function withDefaultFixture(block: (context: TestFixture) => Promise<void>): (context: TestContext) => Promise<void>;
export interface ShellOptions extends child_process.SpawnOptions {
    /**
     * Properties to add to 'env'
     */
    modEnv?: Record<string, string>;
    /**
     * Don't fail when exiting with an error
     *
     * @default false
     */
    allowErrExit?: boolean;
    /**
     * Whether to capture stderr
     *
     * @default true
     */
    captureStderr?: boolean;
    /**
     * Pass output here
     */
    output?: NodeJS.WritableStream;
}
export interface CdkCliOptions extends ShellOptions {
    options?: string[];
    neverRequireApproval?: boolean;
    verbose?: boolean;
}
/**
 * Prepare a target dir byreplicating a source directory
 */
export declare function cloneDirectory(source: string, target: string, output?: NodeJS.WritableStream): Promise<void>;
export declare class TestFixture {
    readonly integTestDir: string;
    readonly stackNamePrefix: string;
    readonly output: NodeJS.WritableStream;
    readonly aws: AwsClients;
    readonly qualifier: string;
    private readonly bucketsToDelete;
    constructor(integTestDir: string, stackNamePrefix: string, output: NodeJS.WritableStream, aws: AwsClients);
    log(s: string): void;
    shell(command: string[], options?: Omit<ShellOptions, 'cwd' | 'output'>): Promise<string>;
    cdkDeploy(stackNames: string | string[], options?: CdkCliOptions): Promise<string>;
    cdkSynth(options?: CdkCliOptions): Promise<string>;
    cdkDestroy(stackNames: string | string[], options?: CdkCliOptions): Promise<string>;
    cdk(args: string[], options?: CdkCliOptions): Promise<string>;
    fullStackName(stackName: string): string;
    fullStackName(stackNames: string[]): string[];
    /**
     * Append this to the list of buckets to potentially delete
     *
     * At the end of a test, we clean up buckets that may not have gotten destroyed
     * (for whatever reason).
     */
    rememberToDeleteBucket(bucketName: string): void;
    /**
     * Cleanup leftover stacks and buckets
     */
    dispose(success: boolean): Promise<void>;
    /**
     * Return the stacks starting with our testing prefix that should be deleted
     */
    private deleteableStacks;
}
/**
 * A shell command that does what you want
 *
 * Is platform-aware, handles errors nicely.
 */
export declare function shell(command: string[], options?: ShellOptions): Promise<string>;
/**
 * rm -rf reimplementation, don't want to depend on an NPM package for this
 */
export declare function rimraf(fsPath: string): void;
export declare function randomString(): string;
