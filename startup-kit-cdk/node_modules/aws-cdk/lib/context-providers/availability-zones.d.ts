import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
/**
 * Plugin to retrieve the Availability Zones for the current account
 */
export declare class AZContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: cxschema.AvailabilityZonesContextQuery): Promise<(string | undefined)[]>;
}
