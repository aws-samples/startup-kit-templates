import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import type { ConfigurationOptions } from 'aws-sdk/lib/config-base';
import { Mode } from '../aws-auth/credentials';
import { ISDK } from './sdk';
/**
 * Options for the default SDK provider
 */
export interface SdkProviderOptions {
    /**
     * Profile to read from ~/.aws
     *
     * @default - No profile
     */
    readonly profile?: string;
    /**
     * Whether we should check for EC2 credentials
     *
     * @default - Autodetect
     */
    readonly ec2creds?: boolean;
    /**
     * Whether we should check for container credentials
     *
     * @default - Autodetect
     */
    readonly containerCreds?: boolean;
    /**
     * HTTP options for SDK
     */
    readonly httpOptions?: SdkHttpOptions;
}
/**
 * Options for individual SDKs
 */
export interface SdkHttpOptions {
    /**
     * Proxy address to use
     *
     * @default No proxy
     */
    readonly proxyAddress?: string;
    /**
     * A path to a certificate bundle that contains a cert to be trusted.
     *
     * @default No certificate bundle
     */
    readonly caBundlePath?: string;
    /**
     * The custom user agent to use.
     *
     * @default - <package-name>/<package-version>
     */
    readonly userAgent?: string;
}
/**
 * Creates instances of the AWS SDK appropriate for a given account/region.
 *
 * Behavior is as follows:
 *
 * - First, a set of "base" credentials are established
 *   - If a target environment is given and the default ("current") SDK credentials are for
 *     that account, return those; otherwise
 *   - If a target environment is given, scan all credential provider plugins
 *     for credentials, and return those if found; otherwise
 *   - Return default ("current") SDK credentials, noting that they might be wrong.
 *
 * - Second, a role may optionally need to be assumed. Use the base credentials
 *   established in the previous process to assume that role.
 *   - If assuming the role fails and the base credentials are for the correct
 *     account, return those. This is a fallback for people who are trying to interact
 *     with a Default Synthesized stack and already have right credentials setup.
 *
 *     Typical cases we see in the wild:
 *     - Credential plugin setup that, although not recommended, works for them
 *     - Seeded terminal with `ReadOnly` credentials in order to do `cdk diff`--the `ReadOnly`
 *       role doesn't have `sts:AssumeRole` and will fail for no real good reason.
 */
export declare class SdkProvider {
    private readonly defaultChain;
    /**
     * Default region
     */
    readonly defaultRegion: string;
    private readonly sdkOptions;
    /**
     * Create a new SdkProvider which gets its defaults in a way that behaves like the AWS CLI does
     *
     * The AWS SDK for JS behaves slightly differently from the AWS CLI in a number of ways; see the
     * class `AwsCliCompatible` for the details.
     */
    static withAwsCliCompatibleDefaults(options?: SdkProviderOptions): Promise<SdkProvider>;
    private readonly plugins;
    constructor(defaultChain: AWS.CredentialProviderChain, 
    /**
     * Default region
     */
    defaultRegion: string, sdkOptions?: ConfigurationOptions);
    /**
     * Return an SDK which can do operations in the given environment
     *
     * The `environment` parameter is resolved first (see `resolveEnvironment()`).
     */
    forEnvironment(environment: cxapi.Environment, mode: Mode, options?: CredentialsOptions): Promise<ISDK>;
    /**
     * Return the partition that base credentials are for
     *
     * Returns `undefined` if there are no base credentials.
     */
    baseCredentialsPartition(environment: cxapi.Environment, mode: Mode): Promise<string | undefined>;
    /**
     * Resolve the environment for a stack
     *
     * Replaces the magic values `UNKNOWN_REGION` and `UNKNOWN_ACCOUNT`
     * with the defaults for the current SDK configuration (`~/.aws/config` or
     * otherwise).
     *
     * It is an error if `UNKNOWN_ACCOUNT` is used but the user hasn't configured
     * any SDK credentials.
     */
    resolveEnvironment(env: cxapi.Environment): Promise<cxapi.Environment>;
    /**
     * The account we'd auth into if we used default credentials.
     *
     * Default credentials are the set of ambiently configured credentials using
     * one of the environment variables, or ~/.aws/credentials, or the *one*
     * profile that was passed into the CLI.
     *
     * Might return undefined if there are no default/ambient credentials
     * available (in which case the user should better hope they have
     * credential plugins configured).
     *
     * Uses a cache to avoid STS calls if we don't need 'em.
     */
    defaultAccount(): Promise<Account | undefined>;
    /**
     * Get credentials for the given account ID in the given mode
     *
     * 1. Use the default credentials if the destination account matches the
     *    current credentials' account.
     * 2. Otherwise try all credential plugins.
     * 3. Fail if neither of these yield any credentials.
     * 4. Return a failure if any of them returned credentials
     */
    private obtainBaseCredentials;
    /**
     * Resolve the default chain to the first set of credentials that is available
     */
    private defaultCredentials;
    /**
     * Return an SDK which uses assumed role credentials
     *
     * The base credentials used to retrieve the assumed role credentials will be the
     * same credentials returned by obtainCredentials if an environment and mode is passed,
     * otherwise it will be the current credentials.
     */
    private withAssumedRole;
}
/**
 * An AWS account
 *
 * An AWS account always exists in only one partition. Usually we don't care about
 * the partition, but when we need to form ARNs we do.
 */
export interface Account {
    /**
     * The account number
     */
    readonly accountId: string;
    /**
     * The partition ('aws' or 'aws-cn' or otherwise)
     */
    readonly partition: string;
}
/**
 * Options for obtaining credentials for an environment
 */
export interface CredentialsOptions {
    /**
     * The ARN of the role that needs to be assumed, if any
     */
    readonly assumeRoleArn?: string;
    /**
     * External ID required to assume the given role.
     */
    readonly assumeRoleExternalId?: string;
}
