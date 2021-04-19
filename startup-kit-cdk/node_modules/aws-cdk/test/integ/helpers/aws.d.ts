/// <reference types="node" />
import * as AWS from 'aws-sdk';
export declare class AwsClients {
    readonly region: string;
    private readonly output;
    static default(output: NodeJS.WritableStream): Promise<AwsClients>;
    static forRegion(region: string, output: NodeJS.WritableStream): Promise<AwsClients>;
    private readonly config;
    readonly cloudFormation: AwsCaller<AWS.CloudFormation>;
    readonly s3: AwsCaller<AWS.S3>;
    readonly ecr: AwsCaller<AWS.ECR>;
    readonly sns: AwsCaller<AWS.SNS>;
    readonly iam: AwsCaller<AWS.IAM>;
    readonly lambda: AwsCaller<AWS.Lambda>;
    readonly sts: AwsCaller<AWS.STS>;
    constructor(region: string, output: NodeJS.WritableStream);
    account(): Promise<string>;
    deleteStacks(...stackNames: string[]): Promise<void>;
    stackStatus(stackName: string): Promise<string | undefined>;
    emptyBucket(bucketName: string): Promise<void | AWS.S3.DeleteObjectsOutput>;
    deleteImageRepository(repositoryName: string): Promise<void>;
    deleteBucket(bucketName: string): Promise<void>;
}
declare type AwsCaller<A> = <B extends keyof ServiceCalls<A>>(call: B, request: First<ServiceCalls<A>[B]>) => Promise<Second<ServiceCalls<A>[B]>>;
declare type ServiceCalls<T> = NoNayNever<SimplifiedService<T>>;
declare type SimplifiedService<T> = {
    [k in keyof T]: AwsCallIO<T[k]>;
};
declare type NoNayNever<T> = Pick<T, {
    [k in keyof T]: T[k] extends never ? never : k;
}[keyof T]>;
declare type AwsCallIO<T> = T extends {
    (args: infer INPUT, callback?: ((err: AWS.AWSError, data: any) => void) | undefined): AWS.Request<infer OUTPUT, AWS.AWSError>;
    (callback?: ((err: AWS.AWSError, data: {}) => void) | undefined): AWS.Request<any, any>;
} ? [INPUT, OUTPUT] : never;
declare type First<T> = T extends [any, any] ? T[0] : never;
declare type Second<T> = T extends [any, any] ? T[1] : never;
export declare function isStackMissingError(e: Error): boolean;
export declare function isBucketMissingError(e: Error): boolean;
/**
 * Retry an async operation until a deadline is hit.
 *
 * Use `retry.forSeconds()` to construct a deadline relative to right now.
 *
 * Exceptions will cause the operation to retry. Use `retry.abort` to annotate an exception
 * to stop the retry and end in a failure.
 */
export declare function retry<A>(output: NodeJS.WritableStream, operation: string, deadline: Date, block: () => Promise<A>): Promise<A>;
export declare namespace retry {
    var forSeconds: (seconds: number) => Date;
    var abort: (e: Error) => Error;
}
export declare function sleep(ms: number): Promise<unknown>;
export declare function outputFromStack(key: string, stack: AWS.CloudFormation.Stack): string | undefined;
export {};
