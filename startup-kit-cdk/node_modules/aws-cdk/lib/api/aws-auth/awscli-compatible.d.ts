import * as AWS from 'aws-sdk';
/**
 * Behaviors to match AWS CLI
 *
 * See these links:
 *
 * https://docs.aws.amazon.com/cli/latest/topic/config-vars.html
 * https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
 */
export declare class AwsCliCompatible {
    /**
     * Build an AWS CLI-compatible credential chain provider
     *
     * This is similar to the default credential provider chain created by the SDK
     * except:
     *
     * 1. Accepts profile argument in the constructor (the SDK must have it prepopulated
     *    in the environment).
     * 2. Conditionally checks EC2 credentials, because checking for EC2
     *    credentials on a non-EC2 machine may lead to long delays (in the best case)
     *    or an exception (in the worst case).
     * 3. Respects $AWS_SHARED_CREDENTIALS_FILE.
     * 4. Respects $AWS_DEFAULT_PROFILE in addition to $AWS_PROFILE.
     */
    static credentialChain(options?: CredentialChainOptions): Promise<AWS.CredentialProviderChain>;
    /**
     * Return the default region in a CLI-compatible way
     *
     * Mostly copied from node_loader.js, but with the following differences to make it
     * AWS CLI compatible:
     *
     * 1. Takes a profile name as an argument (instead of forcing it to be taken from $AWS_PROFILE).
     *    This requires having made a copy of the SDK's `SharedIniFile` (the original
     *    does not take an argument).
     * 2. $AWS_DEFAULT_PROFILE and $AWS_DEFAULT_REGION are also respected.
     *
     * Lambda and CodeBuild set the $AWS_REGION variable.
     */
    static region(options?: RegionOptions): Promise<string>;
}
export interface CredentialChainOptions {
    readonly profile?: string;
    readonly ec2instance?: boolean;
    readonly containerCreds?: boolean;
    readonly httpOptions?: AWS.HTTPOptions;
}
export interface RegionOptions {
    readonly profile?: string;
    readonly ec2instance?: boolean;
}
