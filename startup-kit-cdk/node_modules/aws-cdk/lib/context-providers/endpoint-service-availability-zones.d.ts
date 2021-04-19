import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
/**
 * Plugin to retrieve the Availability Zones for an endpoint service
 */
export declare class EndpointServiceAZContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: {
        [key: string]: any;
    }): Promise<import("aws-sdk/clients/ec2").ValueStringList | undefined>;
}
