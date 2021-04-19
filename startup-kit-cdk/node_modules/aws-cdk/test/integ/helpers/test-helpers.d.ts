/// <reference types="node" />
export declare type TestContext = {
    readonly output: NodeJS.WritableStream;
};
/**
 * A wrapper for jest's 'test' which takes regression-disabled tests into account and prints a banner
 */
export declare function integTest(name: string, callback: (context: TestContext) => Promise<void>): void;
