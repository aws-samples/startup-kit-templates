import * as cxapi from '@aws-cdk/cx-api';
import { SdkProvider } from '../aws-auth';
import { StackCollection } from './cloud-assembly';
export declare function looksLikeGlob(environment: string): boolean;
export declare function globEnvironmentsFromStacks(stacks: StackCollection, environmentGlobs: string[], sdk: SdkProvider): Promise<cxapi.Environment[]>;
/**
 * Given a set of "<account>/<region>" strings, construct environments for them
 */
export declare function environmentsFromDescriptors(envSpecs: string[]): cxapi.Environment[];
