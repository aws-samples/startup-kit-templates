import * as AWS from 'aws-sdk';
/**
 * Hack-fix
 *
 * There are a number of issues in the upstream version of SharedIniFileCredentials
 * that need fixing:
 *
 *  1. The upstream aws-sdk contains an incorrect instantiation of an `AWS.STS`
 *     client, which *should* have taken the region from the requested profile
 *     but doesn't. It will use the region from the default profile, which
 *     may not exist, defaulting to `us-east-1` (since we switched to
 *     AWS_STS_REGIONAL_ENDPOINTS=regional, that default is not even allowed anymore
 *     and the absence of a default region will lead to an error).
 *
 *  2. The simple fix is to get the region from the `config` file. profiles
 *     are made up of a combination of `credentials` and `config`, and the region is
 *     generally in `config` with the rest in `credentials`. However, a bug in
 *     `getProfilesFromSharedConfig` overwrites ALL `config` data with `credentials`
 *     data, so we also need to do extra work to fish the `region` out of the config.
 *
 * 3.  The 'credential_source' option is not supported. Meaning credentials
 *     for assume-role cannot be fetched using EC2/ESC metadata.
 *
 * See https://github.com/aws/aws-sdk-js/issues/3418 for all the gory details.
 * See https://github.com/aws/aws-sdk-js/issues/1916 for some more glory details.
 */
export declare class PatchedSharedIniFileCredentials extends AWS.SharedIniFileCredentials {
    private profile;
    private filename;
    private disableAssumeRole;
    private options;
    private roleArn;
    private httpOptions?;
    private tokenCodeFn?;
    loadRoleProfile(creds: Record<string, Record<string, string>>, roleProfile: Record<string, string>, callback: (err?: Error, data?: any) => void): void;
    private sourceProfileCredentials;
    private credentialSourceCredentials;
}
