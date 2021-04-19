import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
/**
 * Plugin to search AMIs for the current account
 */
export declare class AmiContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: cxschema.AmiContextQuery): Promise<string>;
}
