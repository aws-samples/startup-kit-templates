/// <reference types="jest" />
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import { CloudExecutable } from '../lib/api/cxapp/cloud-executable';
import { Configuration } from '../lib/settings';
import { MockSdkProvider } from './util/mock-sdk';
export declare const DEFAULT_FAKE_TEMPLATE: {
    No: string;
};
export interface TestStackArtifact {
    stackName: string;
    template?: any;
    env?: string;
    depends?: string[];
    metadata?: cxapi.StackMetadata;
    assets?: cxschema.AssetMetadataEntry[];
    properties?: Partial<cxschema.AwsCloudFormationStackProperties>;
    terminationProtection?: boolean;
}
export interface TestAssembly {
    stacks: TestStackArtifact[];
    missing?: cxschema.MissingContext[];
}
export declare class MockCloudExecutable extends CloudExecutable {
    readonly configuration: Configuration;
    readonly sdkProvider: MockSdkProvider;
    constructor(assembly: TestAssembly);
}
export declare function testAssembly(assembly: TestAssembly): cxapi.CloudAssembly;
export declare function testStack(stack: TestStackArtifact): cxapi.CloudFormationStackArtifact;
/**
 * Return a mocked instance of a class, given its constructor
 *
 * I don't understand why jest doesn't provide this by default,
 * but there you go.
 *
 * FIXME: Currently very limited. Doesn't support inheritance, getters or
 * automatic detection of properties (as those exist on instances, not
 * classes).
 */
export declare function instanceMockFrom<A>(ctr: new (...args: any[]) => A): jest.Mocked<A>;
/**
 * Run an async block with a class (constructor) replaced with a mock
 *
 * The class constructor will be replaced with a constructor that returns
 * a singleton, and the singleton will be passed to the block so that its
 * methods can be mocked individually.
 *
 * Uses `instanceMockFrom` so is subject to the same limitations that hold
 * for that function.
 */
export declare function withMockedClassSingleton<A extends object, K extends keyof A, B>(obj: A, key: K, cb: (mock: A[K] extends jest.Constructable ? jest.Mocked<InstanceType<A[K]>> : never) => Promise<B>): Promise<B>;
export declare function withMocked<A extends object, K extends keyof A, B>(obj: A, key: K, block: (fn: jest.Mocked<A>[K]) => B): B;
