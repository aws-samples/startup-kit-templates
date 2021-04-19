import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
export declare class HostedZoneContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: cxschema.HostedZoneContextQuery): Promise<object>;
    private filterZones;
    private isHostedZoneQuery;
}
