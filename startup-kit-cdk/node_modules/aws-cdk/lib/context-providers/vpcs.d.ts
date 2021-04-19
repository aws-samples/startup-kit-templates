import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
export declare class VpcNetworkContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: cxschema.VpcContextQuery): Promise<cxapi.VpcContextResponse>;
    private findVpc;
    private readVpcProps;
}
