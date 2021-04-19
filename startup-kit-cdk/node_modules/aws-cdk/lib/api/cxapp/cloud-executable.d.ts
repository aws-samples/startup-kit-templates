import * as cxapi from '@aws-cdk/cx-api';
import { Configuration } from '../../settings';
import { SdkProvider } from '../aws-auth';
import { CloudAssembly } from './cloud-assembly';
/**
 * @returns output directory
 */
declare type Synthesizer = (aws: SdkProvider, config: Configuration) => Promise<cxapi.CloudAssembly>;
export interface CloudExecutableProps {
    /**
     * Application configuration (settings and context)
     */
    configuration: Configuration;
    /**
     * AWS object (used by synthesizer and contextprovider)
     */
    sdkProvider: SdkProvider;
    /**
     * Callback invoked to synthesize the actual stacks
     */
    synthesizer: Synthesizer;
}
/**
 * Represent the Cloud Executable and the synthesis we can do on it
 */
export declare class CloudExecutable {
    private readonly props;
    private _cloudAssembly?;
    constructor(props: CloudExecutableProps);
    /**
     * Return whether there is an app command from the configuration
     */
    get hasApp(): boolean;
    /**
     * Synthesize a set of stacks
     */
    synthesize(): Promise<CloudAssembly>;
    private doSynthesize;
    /**
     * Modify the templates in the assembly in-place to add metadata resource declarations
     */
    private addMetadataResource;
    private get canLookup();
}
export {};
