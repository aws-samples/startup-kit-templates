import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
export declare class SecurityGroupContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: cxschema.SecurityGroupContextQuery): Promise<cxapi.SecurityGroupContextResponse>;
}
/**
 * @internal
 */
export declare function hasAllTrafficEgress(securityGroup: AWS.EC2.SecurityGroup): boolean;
