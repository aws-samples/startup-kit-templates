import * as AWS from 'aws-sdk';
import type { ConfigurationOptions } from 'aws-sdk/lib/config-base';
import { Account } from './sdk-provider';
/** @experimental */
export interface ISDK {
    /**
     * The region this SDK has been instantiated for
     *
     * (As distinct from the `defaultRegion()` on SdkProvider which
     * represents the region configured in the default config).
     */
    readonly currentRegion: string;
    /**
     * The Account this SDK has been instantiated for
     *
     * (As distinct from the `defaultAccount()` on SdkProvider which
     * represents the account available by using default credentials).
     */
    currentAccount(): Promise<Account>;
    cloudFormation(): AWS.CloudFormation;
    ec2(): AWS.EC2;
    ssm(): AWS.SSM;
    s3(): AWS.S3;
    route53(): AWS.Route53;
    ecr(): AWS.ECR;
    elbv2(): AWS.ELBv2;
}
/**
 * Additional SDK configuration options
 */
export interface SdkOptions {
    /**
     * Additional descriptive strings that indicate where the "AssumeRole" credentials are coming from
     *
     * Will be printed in an error message to help users diagnose auth problems.
     */
    readonly assumeRoleCredentialsSourceDescription?: string;
}
/**
 * Base functionality of SDK without credential fetching
 */
export declare class SDK implements ISDK {
    private readonly _credentials;
    private readonly sdkOptions;
    private static readonly accountCache;
    readonly currentRegion: string;
    private readonly config;
    /**
     * Default retry options for SDK clients.
     */
    private readonly retryOptions;
    /**
     * The more generous retry policy for CloudFormation, which has a 1 TPM limit on certain APIs,
     * which are abundantly used for deployment tracking, ...
     *
     * So we're allowing way more retries, but waiting a bit more.
     */
    private readonly cloudFormationRetryOptions;
    constructor(_credentials: AWS.Credentials, region: string, httpOptions?: ConfigurationOptions, sdkOptions?: SdkOptions);
    cloudFormation(): AWS.CloudFormation;
    ec2(): AWS.EC2;
    ssm(): AWS.SSM;
    s3(): AWS.S3;
    route53(): AWS.Route53;
    ecr(): AWS.ECR;
    elbv2(): AWS.ELBv2;
    currentAccount(): Promise<Account>;
    /**
     * Return the current credentials
     *
     * Don't use -- only used to write tests around assuming roles.
     */
    currentCredentials(): Promise<AWS.Credentials>;
    /**
     * Force retrieval of the current credentials
     *
     * Relevant if the current credentials are AssumeRole credentials -- do the actual
     * lookup, and translate any error into a useful error message (taking into
     * account credential provenance).
     */
    forceCredentialRetrieval(): Promise<void>;
    /**
     * Return a wrapping object for the underlying service object
     *
     * Responds to failures in the underlying service calls, in two different
     * ways:
     *
     * - When errors are encountered, log the failing call and the error that
     *   it triggered (at debug level). This is necessary because the lack of
     *   stack traces in NodeJS otherwise makes it very hard to suss out where
     *   a certain AWS error occurred.
     * - The JS SDK has a funny business of wrapping any credential-based error
     *   in a super-generic (and in our case wrong) exception. If we then use a
     *   'ChainableTemporaryCredentials' and the target role doesn't exist,
     *   the error message that shows up by default is super misleading
     *   (https://github.com/aws/aws-sdk-js/issues/3272). We can fix this because
     *   the exception contains the "inner exception", so we unwrap and throw
     *   the correct error ("cannot assume role").
     *
     * The wrapping business below is slightly more complicated than you'd think
     * because we must hook into the `promise()` method of the object that's being
     * returned from the methods of the object that we wrap, so there's two
     * levels of wrapping going on, and also some exceptions to the wrapping magic.
     */
    private wrapServiceErrorHandling;
    /**
     * Extract a more detailed error out of a generic error if we can
     *
     * If this is an error about Assuming Roles, add in the context showing the
     * chain of credentials we used to try to assume the role.
     */
    private makeDetailedException;
}
