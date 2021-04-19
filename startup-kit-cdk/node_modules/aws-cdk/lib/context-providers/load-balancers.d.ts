import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
/**
 * Provides load balancer context information.
 */
export declare class LoadBalancerContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(query: cxschema.LoadBalancerContextQuery): Promise<cxapi.LoadBalancerContextResponse>;
}
declare type LoadBalancerListenerQuery = cxschema.LoadBalancerListenerContextQuery;
declare type LoadBalancerListenerResponse = cxapi.LoadBalancerListenerContextResponse;
/**
 * Provides load balancer listener context information
 */
export declare class LoadBalancerListenerContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(query: LoadBalancerListenerQuery): Promise<LoadBalancerListenerResponse>;
    /**
     * Look up a listener by querying listeners for query's listener arn and then
     * resolve its load balancer for the security group information.
     */
    private getListenerByArn;
    /**
     * Look up a listener by starting from load balancers, filtering out
     * unmatching load balancers, and then by querying the listeners of each load
     * balancer and filtering out unmatching listeners.
     */
    private getListenerByFilteringLoadBalancers;
    /**
     * Finds the matching listener from the list of load balancers. This will
     * error unless there is exactly one match so that the user is prompted to
     * provide more specific criteria rather than us providing a nondeterministic
     * result.
     */
    private findMatchingListener;
}
/**
 * Helper to paginate over describeLoadBalancers
 * @internal
 */
export declare function describeLoadBalancers(elbv2: AWS.ELBv2, request: AWS.ELBv2.DescribeLoadBalancersInput): Promise<AWS.ELBv2.LoadBalancer[]>;
/**
 * Generator function that yields `TagDescriptions`. The API doesn't support
 * pagination, so this generator breaks the resource list into chunks and issues
 * the appropriate requests, yielding each tag description as it receives it.
 * @internal
 */
export declare function describeTags(elbv2: AWS.ELBv2, resourceArns: string[]): AsyncGenerator<AWS.ELBv2.TagDescription, void, unknown>;
/**
 * Determines if the given TagDescription matches the required tags.
 * @internal
 */
export declare function tagsMatch(tagDescription: AWS.ELBv2.TagDescription, requiredTags: cxschema.Tag[]): boolean;
/**
 * Async generator that produces listener descriptions by traversing the
 * pagination. Because describeListeners only lets you search by one load
 * balancer arn at a time, we request them individually and yield the listeners
 * as they come in.
 * @internal
 */
export declare function describeListenersByLoadBalancerArn(elbv2: AWS.ELBv2, loadBalancerArns: string[]): AsyncGenerator<AWS.ELBv2.Listener, void, unknown>;
export {};
