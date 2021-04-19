"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkProvider = void 0;
const https = require("https");
const os = require("os");
const path = require("path");
const cxapi = require("@aws-cdk/cx-api");
const AWS = require("aws-sdk");
const fs = require("fs-extra");
const logging_1 = require("../../logging");
const functions_1 = require("../../util/functions");
const credential_plugins_1 = require("../aws-auth/credential-plugins");
const awscli_compatible_1 = require("./awscli-compatible");
const sdk_1 = require("./sdk");
// Some configuration that can only be achieved by setting
// environment variables.
process.env.AWS_STS_REGIONAL_ENDPOINTS = 'regional';
process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = '1';
const CACHED_ACCOUNT = Symbol('cached_account');
const CACHED_DEFAULT_CREDENTIALS = Symbol('cached_default_credentials');
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
class SdkProvider {
    constructor(defaultChain, 
    /**
     * Default region
     */
    defaultRegion, sdkOptions = {}) {
        this.defaultChain = defaultChain;
        this.defaultRegion = defaultRegion;
        this.sdkOptions = sdkOptions;
        this.plugins = new credential_plugins_1.CredentialPlugins();
    }
    /**
     * Create a new SdkProvider which gets its defaults in a way that behaves like the AWS CLI does
     *
     * The AWS SDK for JS behaves slightly differently from the AWS CLI in a number of ways; see the
     * class `AwsCliCompatible` for the details.
     */
    static async withAwsCliCompatibleDefaults(options = {}) {
        var _a;
        const sdkOptions = parseHttpOptions((_a = options.httpOptions) !== null && _a !== void 0 ? _a : {});
        const chain = await awscli_compatible_1.AwsCliCompatible.credentialChain({
            profile: options.profile,
            ec2instance: options.ec2creds,
            containerCreds: options.containerCreds,
            httpOptions: sdkOptions.httpOptions,
        });
        const region = await awscli_compatible_1.AwsCliCompatible.region({
            profile: options.profile,
            ec2instance: options.ec2creds,
        });
        return new SdkProvider(chain, region, sdkOptions);
    }
    /**
     * Return an SDK which can do operations in the given environment
     *
     * The `environment` parameter is resolved first (see `resolveEnvironment()`).
     */
    async forEnvironment(environment, mode, options) {
        const env = await this.resolveEnvironment(environment);
        const baseCreds = await this.obtainBaseCredentials(env.account, mode);
        // At this point, we need at least SOME credentials
        if (baseCreds.source === 'none') {
            throw new Error(fmtObtainCredentialsError(env.account, baseCreds));
        }
        // Simple case is if we don't need to "assumeRole" here. If so, we must now have credentials for the right
        // account.
        if ((options === null || options === void 0 ? void 0 : options.assumeRoleArn) === undefined) {
            if (baseCreds.source === 'incorrectDefault') {
                throw new Error(fmtObtainCredentialsError(env.account, baseCreds));
            }
            return new sdk_1.SDK(baseCreds.credentials, env.region, this.sdkOptions);
        }
        // We will proceed to AssumeRole using whatever we've been given.
        const sdk = await this.withAssumedRole(baseCreds, options.assumeRoleArn, options.assumeRoleExternalId, env.region);
        // Exercise the AssumeRoleCredentialsProvider we've gotten at least once so
        // we can determine whether the AssumeRole call succeeds or not.
        try {
            await sdk.forceCredentialRetrieval();
            return sdk;
        }
        catch (e) {
            // AssumeRole failed. Proceed and warn *if and only if* the baseCredentials were already for the right account
            // or returned from a plugin. This is to cover some current setups for people using plugins or preferring to
            // feed the CLI credentials which are sufficient by themselves. Prefer to assume the correct role if we can,
            // but if we can't then let's just try with available credentials anyway.
            if (baseCreds.source === 'correctDefault' || baseCreds.source === 'plugin') {
                logging_1.debug(e.message);
                logging_1.warning(`${fmtObtainedCredentials(baseCreds)} could not be used to assume '${options.assumeRoleArn}', but are for the right account. Proceeding anyway.`);
                return new sdk_1.SDK(baseCreds.credentials, env.region, this.sdkOptions);
            }
            throw e;
        }
    }
    /**
     * Return the partition that base credentials are for
     *
     * Returns `undefined` if there are no base credentials.
     */
    async baseCredentialsPartition(environment, mode) {
        const env = await this.resolveEnvironment(environment);
        const baseCreds = await this.obtainBaseCredentials(env.account, mode);
        if (baseCreds.source === 'none') {
            return undefined;
        }
        return (await new sdk_1.SDK(baseCreds.credentials, env.region, this.sdkOptions).currentAccount()).partition;
    }
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
    async resolveEnvironment(env) {
        var _a;
        const region = env.region !== cxapi.UNKNOWN_REGION ? env.region : this.defaultRegion;
        const account = env.account !== cxapi.UNKNOWN_ACCOUNT ? env.account : (_a = (await this.defaultAccount())) === null || _a === void 0 ? void 0 : _a.accountId;
        if (!account) {
            throw new Error('Unable to resolve AWS account to use. It must be either configured when you define your CDK or through the environment');
        }
        return {
            region,
            account,
            name: cxapi.EnvironmentUtils.format(account, region),
        };
    }
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
    defaultAccount() {
        return functions_1.cached(this, CACHED_ACCOUNT, async () => {
            try {
                const creds = await this.defaultCredentials();
                const accessKeyId = creds.accessKeyId;
                if (!accessKeyId) {
                    throw new Error('Unable to resolve AWS credentials (setup with "aws configure")');
                }
                return await new sdk_1.SDK(creds, this.defaultRegion, this.sdkOptions).currentAccount();
            }
            catch (e) {
                logging_1.debug('Unable to determine the default AWS account:', e);
                return undefined;
            }
        });
    }
    /**
     * Get credentials for the given account ID in the given mode
     *
     * 1. Use the default credentials if the destination account matches the
     *    current credentials' account.
     * 2. Otherwise try all credential plugins.
     * 3. Fail if neither of these yield any credentials.
     * 4. Return a failure if any of them returned credentials
     */
    async obtainBaseCredentials(accountId, mode) {
        var _a;
        // First try 'current' credentials
        const defaultAccountId = (_a = (await this.defaultAccount())) === null || _a === void 0 ? void 0 : _a.accountId;
        if (defaultAccountId === accountId) {
            return { source: 'correctDefault', credentials: await this.defaultCredentials() };
        }
        // Then try the plugins
        const pluginCreds = await this.plugins.fetchCredentialsFor(accountId, mode);
        if (pluginCreds) {
            return { source: 'plugin', ...pluginCreds };
        }
        // Fall back to default credentials with a note that they're not the right ones yet
        if (defaultAccountId !== undefined) {
            return {
                source: 'incorrectDefault',
                accountId: defaultAccountId,
                credentials: await this.defaultCredentials(),
                unusedPlugins: this.plugins.availablePluginNames,
            };
        }
        // Apparently we didn't find any at all
        return {
            source: 'none',
            unusedPlugins: this.plugins.availablePluginNames,
        };
    }
    /**
     * Resolve the default chain to the first set of credentials that is available
     */
    defaultCredentials() {
        return functions_1.cached(this, CACHED_DEFAULT_CREDENTIALS, () => {
            logging_1.debug('Resolving default credentials');
            return this.defaultChain.resolvePromise();
        });
    }
    /**
     * Return an SDK which uses assumed role credentials
     *
     * The base credentials used to retrieve the assumed role credentials will be the
     * same credentials returned by obtainCredentials if an environment and mode is passed,
     * otherwise it will be the current credentials.
     */
    async withAssumedRole(masterCredentials, roleArn, externalId, region) {
        logging_1.debug(`Assuming role '${roleArn}'.`);
        region = region !== null && region !== void 0 ? region : this.defaultRegion;
        const creds = new AWS.ChainableTemporaryCredentials({
            params: {
                RoleArn: roleArn,
                ...externalId ? { ExternalId: externalId } : {},
                RoleSessionName: `aws-cdk-${safeUsername()}`,
            },
            stsConfig: {
                region,
                ...this.sdkOptions,
            },
            masterCredentials: masterCredentials.credentials,
        });
        return new sdk_1.SDK(creds, region, this.sdkOptions, {
            assumeRoleCredentialsSourceDescription: fmtObtainedCredentials(masterCredentials),
        });
    }
}
exports.SdkProvider = SdkProvider;
/**
 * Get HTTP options for the SDK
 *
 * Read from user input or environment variables.
 *
 * Returns a complete `ConfigurationOptions` object because that's where
 * `customUserAgent` lives, but `httpOptions` is the most important attribute.
 */
function parseHttpOptions(options) {
    var _a;
    const config = {};
    config.httpOptions = {};
    let userAgent = options.userAgent;
    if (userAgent == null) {
        // Find the package.json from the main toolkit
        const pkg = JSON.parse((_a = readIfPossible(path.join(__dirname, '..', '..', '..', 'package.json'))) !== null && _a !== void 0 ? _a : '{}');
        userAgent = `${pkg.name}/${pkg.version}`;
    }
    config.customUserAgent = userAgent;
    const proxyAddress = options.proxyAddress || httpsProxyFromEnvironment();
    const caBundlePath = options.caBundlePath || caBundlePathFromEnvironment();
    if (proxyAddress && caBundlePath) {
        throw new Error(`At the moment, cannot specify Proxy (${proxyAddress}) and CA Bundle (${caBundlePath}) at the same time. See https://github.com/aws/aws-cdk/issues/5804`);
        // Maybe it's possible after all, but I've been staring at
        // https://github.com/TooTallNate/node-proxy-agent/blob/master/index.js#L79
        // a while now trying to figure out what to pass in so that the underlying Agent
        // object will get the 'ca' argument. It's not trivial and I don't want to risk it.
    }
    if (proxyAddress) { // Ignore empty string on purpose
        // https://aws.amazon.com/blogs/developer/using-the-aws-sdk-for-javascript-from-behind-a-proxy/
        logging_1.debug('Using proxy server: %s', proxyAddress);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ProxyAgent = require('proxy-agent');
        config.httpOptions.agent = new ProxyAgent(proxyAddress);
    }
    if (caBundlePath) {
        logging_1.debug('Using CA bundle path: %s', caBundlePath);
        config.httpOptions.agent = new https.Agent({
            ca: readIfPossible(caBundlePath),
            keepAlive: true,
        });
    }
    return config;
}
/**
 * Find and return the configured HTTPS proxy address
 */
function httpsProxyFromEnvironment() {
    if (process.env.https_proxy) {
        return process.env.https_proxy;
    }
    if (process.env.HTTPS_PROXY) {
        return process.env.HTTPS_PROXY;
    }
    return undefined;
}
/**
 * Find and return a CA certificate bundle path to be passed into the SDK.
 */
function caBundlePathFromEnvironment() {
    if (process.env.aws_ca_bundle) {
        return process.env.aws_ca_bundle;
    }
    if (process.env.AWS_CA_BUNDLE) {
        return process.env.AWS_CA_BUNDLE;
    }
    return undefined;
}
/**
 * Read a file if it exists, or return undefined
 *
 * Not async because it is used in the constructor
 */
function readIfPossible(filename) {
    try {
        if (!fs.pathExistsSync(filename)) {
            return undefined;
        }
        return fs.readFileSync(filename, { encoding: 'utf-8' });
    }
    catch (e) {
        logging_1.debug(e);
        return undefined;
    }
}
/**
 * Return the username with characters invalid for a RoleSessionName removed
 *
 * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters
 */
function safeUsername() {
    return os.userInfo().username.replace(/[^\w+=,.@-]/g, '@');
}
/**
 * Isolating the code that translates calculation errors into human error messages
 *
 * We cover the following cases:
 *
 * - No credentials are available at all
 * - Default credentials are for the wrong account
 */
function fmtObtainCredentialsError(targetAccountId, obtainResult) {
    const msg = [`Need to perform AWS calls for account ${targetAccountId}`];
    switch (obtainResult.source) {
        case 'incorrectDefault':
            msg.push(`but the current credentials are for ${obtainResult.accountId}`);
            break;
        case 'none':
            msg.push('but no credentials have been configured');
    }
    if (obtainResult.unusedPlugins.length > 0) {
        msg.push(`and none of these plugins found any: ${obtainResult.unusedPlugins.join(', ')}`);
    }
    return msg.join(', ');
}
/**
 * Format a message indicating where we got base credentials for the assume role
 *
 * We cover the following cases:
 *
 * - Default credentials for the right account
 * - Default credentials for the wrong account
 * - Credentials returned from a plugin
 */
function fmtObtainedCredentials(obtainResult) {
    switch (obtainResult.source) {
        case 'correctDefault':
            return 'current credentials';
        case 'plugin':
            return `credentials returned by plugin '${obtainResult.pluginName}'`;
        case 'incorrectDefault':
            const msg = [];
            msg.push(`current credentials (which are for account ${obtainResult.accountId}`);
            if (obtainResult.unusedPlugins.length > 0) {
                msg.push(`, and none of the following plugins provided credentials: ${obtainResult.unusedPlugins.join(', ')}`);
            }
            msg.push(')');
            return msg.join('');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2RrLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUErQjtBQUMvQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLHlDQUF5QztBQUN6QywrQkFBK0I7QUFFL0IsK0JBQStCO0FBQy9CLDJDQUErQztBQUMvQyxvREFBOEM7QUFDOUMsdUVBQW1FO0FBRW5FLDJEQUF1RDtBQUN2RCwrQkFBa0M7QUFHbEMsMERBQTBEO0FBQzFELHlCQUF5QjtBQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixHQUFHLFVBQVUsQ0FBQztBQUNwRCxPQUFPLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxHQUFHLEdBQUcsQ0FBQztBQTJEdEQsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDaEQsTUFBTSwwQkFBMEIsR0FBRyxNQUFNLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUV4RTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNCRztBQUNILE1BQWEsV0FBVztJQTBCdEIsWUFDbUIsWUFBeUM7SUFDMUQ7O09BRUc7SUFDYSxhQUFxQixFQUNwQixhQUFtQyxFQUFFO1FBTHJDLGlCQUFZLEdBQVosWUFBWSxDQUE2QjtRQUkxQyxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUNwQixlQUFVLEdBQVYsVUFBVSxDQUEyQjtRQVJ2QyxZQUFPLEdBQUcsSUFBSSxzQ0FBaUIsRUFBRSxDQUFDO0lBU25ELENBQUM7SUFoQ0Q7Ozs7O09BS0c7SUFDSSxNQUFNLENBQUMsS0FBSyxDQUFDLDRCQUE0QixDQUFDLFVBQThCLEVBQUU7O1FBQy9FLE1BQU0sVUFBVSxHQUFHLGdCQUFnQixPQUFDLE9BQU8sQ0FBQyxXQUFXLG1DQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRS9ELE1BQU0sS0FBSyxHQUFHLE1BQU0sb0NBQWdCLENBQUMsZUFBZSxDQUFDO1lBQ25ELE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztZQUN4QixXQUFXLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDN0IsY0FBYyxFQUFFLE9BQU8sQ0FBQyxjQUFjO1lBQ3RDLFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVztTQUNwQyxDQUFDLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLG9DQUFnQixDQUFDLE1BQU0sQ0FBQztZQUMzQyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87WUFDeEIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxRQUFRO1NBQzlCLENBQUMsQ0FBQztRQUVILE9BQU8sSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBYUQ7Ozs7T0FJRztJQUNJLEtBQUssQ0FBQyxjQUFjLENBQUMsV0FBOEIsRUFBRSxJQUFVLEVBQUUsT0FBNEI7UUFDbEcsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdkQsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV0RSxtREFBbUQ7UUFDbkQsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1NBQUU7UUFFeEcsMEdBQTBHO1FBQzFHLFdBQVc7UUFDWCxJQUFJLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLGFBQWEsTUFBSyxTQUFTLEVBQUU7WUFDeEMsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLGtCQUFrQixFQUFFO2dCQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO2FBQUU7WUFDcEgsT0FBTyxJQUFJLFNBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ3BFO1FBRUQsaUVBQWlFO1FBQ2pFLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRW5ILDJFQUEyRTtRQUMzRSxnRUFBZ0U7UUFDaEUsSUFBSTtZQUNGLE1BQU0sR0FBRyxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDckMsT0FBTyxHQUFHLENBQUM7U0FDWjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsOEdBQThHO1lBQzlHLDRHQUE0RztZQUM1Ryw0R0FBNEc7WUFDNUcseUVBQXlFO1lBQ3pFLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxnQkFBZ0IsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLFFBQVEsRUFBRTtnQkFDMUUsZUFBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDakIsaUJBQU8sQ0FBQyxHQUFHLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxpQ0FBaUMsT0FBTyxDQUFDLGFBQWEsc0RBQXNELENBQUMsQ0FBQztnQkFDMUosT0FBTyxJQUFJLFNBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ3BFO1lBRUQsTUFBTSxDQUFDLENBQUM7U0FDVDtJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLHdCQUF3QixDQUFDLFdBQThCLEVBQUUsSUFBVTtRQUM5RSxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN2RCxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3RFLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUU7WUFBRSxPQUFPLFNBQVMsQ0FBQztTQUFFO1FBQ3RELE9BQU8sQ0FBQyxNQUFNLElBQUksU0FBRyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDeEcsQ0FBQztJQUVEOzs7Ozs7Ozs7T0FTRztJQUNJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxHQUFzQjs7UUFDcEQsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ3JGLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLEtBQUssS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQywwQ0FBRSxTQUFTLENBQUM7UUFFL0csSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsd0hBQXdILENBQUMsQ0FBQztTQUMzSTtRQUVELE9BQU87WUFDTCxNQUFNO1lBQ04sT0FBTztZQUNQLElBQUksRUFBRSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUM7U0FDckQsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7O09BWUc7SUFDSSxjQUFjO1FBQ25CLE9BQU8sa0JBQU0sQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzdDLElBQUk7Z0JBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFFOUMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLFdBQVcsRUFBRTtvQkFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDO2lCQUNuRjtnQkFFRCxPQUFPLE1BQU0sSUFBSSxTQUFHLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO2FBQ25GO1lBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ1YsZUFBSyxDQUFDLDhDQUE4QyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxPQUFPLFNBQVMsQ0FBQzthQUNsQjtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0ssS0FBSyxDQUFDLHFCQUFxQixDQUFDLFNBQWlCLEVBQUUsSUFBVTs7UUFDL0Qsa0NBQWtDO1FBQ2xDLE1BQU0sZ0JBQWdCLFNBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQywwQ0FBRSxTQUFTLENBQUM7UUFDbEUsSUFBSSxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7WUFDbEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUsTUFBTSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDO1NBQ25GO1FBRUQsdUJBQXVCO1FBQ3ZCLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUUsSUFBSSxXQUFXLEVBQUU7WUFDZixPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxHQUFHLFdBQVcsRUFBRSxDQUFDO1NBQzdDO1FBRUQsbUZBQW1GO1FBQ25GLElBQUksZ0JBQWdCLEtBQUssU0FBUyxFQUFFO1lBQ2xDLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLGtCQUFrQjtnQkFDMUIsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsV0FBVyxFQUFFLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUM1QyxhQUFhLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0I7YUFDakQsQ0FBQztTQUNIO1FBRUQsdUNBQXVDO1FBQ3ZDLE9BQU87WUFDTCxNQUFNLEVBQUUsTUFBTTtZQUNkLGFBQWEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLG9CQUFvQjtTQUNqRCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ssa0JBQWtCO1FBQ3hCLE9BQU8sa0JBQU0sQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUUsR0FBRyxFQUFFO1lBQ25ELGVBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1lBQ3ZDLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSyxLQUFLLENBQUMsZUFBZSxDQUMzQixpQkFBMkUsRUFDM0UsT0FBZSxFQUNmLFVBQThCLEVBQzlCLE1BQTBCO1FBQzFCLGVBQUssQ0FBQyxrQkFBa0IsT0FBTyxJQUFJLENBQUMsQ0FBQztRQUVyQyxNQUFNLEdBQUcsTUFBTSxhQUFOLE1BQU0sY0FBTixNQUFNLEdBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQztRQUV0QyxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQztZQUNsRCxNQUFNLEVBQUU7Z0JBQ04sT0FBTyxFQUFFLE9BQU87Z0JBQ2hCLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDL0MsZUFBZSxFQUFFLFdBQVcsWUFBWSxFQUFFLEVBQUU7YUFDN0M7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsTUFBTTtnQkFDTixHQUFHLElBQUksQ0FBQyxVQUFVO2FBQ25CO1lBQ0QsaUJBQWlCLEVBQUUsaUJBQWlCLENBQUMsV0FBVztTQUNqRCxDQUFDLENBQUM7UUFFSCxPQUFPLElBQUksU0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUM3QyxzQ0FBc0MsRUFBRSxzQkFBc0IsQ0FBQyxpQkFBaUIsQ0FBQztTQUNsRixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFuT0Qsa0NBbU9DO0FBb0JEOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLGdCQUFnQixDQUFDLE9BQXVCOztJQUMvQyxNQUFNLE1BQU0sR0FBeUIsRUFBRSxDQUFDO0lBQ3hDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO0lBRXhCLElBQUksU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDbEMsSUFBSSxTQUFTLElBQUksSUFBSSxFQUFFO1FBQ3JCLDhDQUE4QztRQUM5QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxPQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxtQ0FBSSxJQUFJLENBQUMsQ0FBQztRQUN2RyxTQUFTLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUMxQztJQUNELE1BQU0sQ0FBQyxlQUFlLEdBQUcsU0FBUyxDQUFDO0lBRW5DLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLElBQUkseUJBQXlCLEVBQUUsQ0FBQztJQUN6RSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxJQUFJLDJCQUEyQixFQUFFLENBQUM7SUFFM0UsSUFBSSxZQUFZLElBQUksWUFBWSxFQUFFO1FBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLFlBQVksb0JBQW9CLFlBQVksb0VBQW9FLENBQUMsQ0FBQztRQUMxSywwREFBMEQ7UUFDMUQsMkVBQTJFO1FBQzNFLGdGQUFnRjtRQUNoRixtRkFBbUY7S0FDcEY7SUFFRCxJQUFJLFlBQVksRUFBRSxFQUFFLGlDQUFpQztRQUNuRCwrRkFBK0Y7UUFDL0YsZUFBSyxDQUFDLHdCQUF3QixFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzlDLGlFQUFpRTtRQUNqRSxNQUFNLFVBQVUsR0FBUSxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDL0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUM7S0FDekQ7SUFDRCxJQUFJLFlBQVksRUFBRTtRQUNoQixlQUFLLENBQUMsMEJBQTBCLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDaEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDO1lBQ3pDLEVBQUUsRUFBRSxjQUFjLENBQUMsWUFBWSxDQUFDO1lBQ2hDLFNBQVMsRUFBRSxJQUFJO1NBQ2hCLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyx5QkFBeUI7SUFDaEMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRTtRQUMzQixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDO0tBQ2hDO0lBQ0QsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRTtRQUMzQixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDO0tBQ2hDO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUywyQkFBMkI7SUFDbEMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRTtRQUM3QixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO0tBQ2xDO0lBQ0QsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRTtRQUM3QixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO0tBQ2xDO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLGNBQWMsQ0FBQyxRQUFnQjtJQUN0QyxJQUFJO1FBQ0YsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFBRSxPQUFPLFNBQVMsQ0FBQztTQUFFO1FBQ3ZELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztLQUN6RDtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1YsZUFBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsT0FBTyxTQUFTLENBQUM7S0FDbEI7QUFDSCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsWUFBWTtJQUNuQixPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM3RCxDQUFDO0FBMEJEOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLHlCQUF5QixDQUFDLGVBQXVCLEVBQUUsWUFBbUY7SUFDN0ksTUFBTSxHQUFHLEdBQUcsQ0FBQyx5Q0FBeUMsZUFBZSxFQUFFLENBQUMsQ0FBQztJQUN6RSxRQUFRLFlBQVksQ0FBQyxNQUFNLEVBQUU7UUFDM0IsS0FBSyxrQkFBa0I7WUFDckIsR0FBRyxDQUFDLElBQUksQ0FBQyx1Q0FBdUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDMUUsTUFBTTtRQUNSLEtBQUssTUFBTTtZQUNULEdBQUcsQ0FBQyxJQUFJLENBQUMseUNBQXlDLENBQUMsQ0FBQztLQUN2RDtJQUNELElBQUksWUFBWSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3pDLEdBQUcsQ0FBQyxJQUFJLENBQUMsd0NBQXdDLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUMzRjtJQUNELE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN4QixDQUFDO0FBRUQ7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFTLHNCQUFzQixDQUM3QixZQUFzRTtJQUN0RSxRQUFRLFlBQVksQ0FBQyxNQUFNLEVBQUU7UUFDM0IsS0FBSyxnQkFBZ0I7WUFDbkIsT0FBTyxxQkFBcUIsQ0FBQztRQUMvQixLQUFLLFFBQVE7WUFDWCxPQUFPLG1DQUFtQyxZQUFZLENBQUMsVUFBVSxHQUFHLENBQUM7UUFDdkUsS0FBSyxrQkFBa0I7WUFDckIsTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDO1lBQ2YsR0FBRyxDQUFDLElBQUksQ0FBQyw4Q0FBOEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFFakYsSUFBSSxZQUFZLENBQUMsYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ3pDLEdBQUcsQ0FBQyxJQUFJLENBQUMsNkRBQTZELFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUNoSDtZQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFZCxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDdkI7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgKiBhcyBBV1MgZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb25PcHRpb25zIH0gZnJvbSAnYXdzLXNkay9saWIvY29uZmlnLWJhc2UnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IHsgZGVidWcsIHdhcm5pbmcgfSBmcm9tICcuLi8uLi9sb2dnaW5nJztcbmltcG9ydCB7IGNhY2hlZCB9IGZyb20gJy4uLy4uL3V0aWwvZnVuY3Rpb25zJztcbmltcG9ydCB7IENyZWRlbnRpYWxQbHVnaW5zIH0gZnJvbSAnLi4vYXdzLWF1dGgvY3JlZGVudGlhbC1wbHVnaW5zJztcbmltcG9ydCB7IE1vZGUgfSBmcm9tICcuLi9hd3MtYXV0aC9jcmVkZW50aWFscyc7XG5pbXBvcnQgeyBBd3NDbGlDb21wYXRpYmxlIH0gZnJvbSAnLi9hd3NjbGktY29tcGF0aWJsZSc7XG5pbXBvcnQgeyBJU0RLLCBTREsgfSBmcm9tICcuL3Nkayc7XG5cblxuLy8gU29tZSBjb25maWd1cmF0aW9uIHRoYXQgY2FuIG9ubHkgYmUgYWNoaWV2ZWQgYnkgc2V0dGluZ1xuLy8gZW52aXJvbm1lbnQgdmFyaWFibGVzLlxucHJvY2Vzcy5lbnYuQVdTX1NUU19SRUdJT05BTF9FTkRQT0lOVFMgPSAncmVnaW9uYWwnO1xucHJvY2Vzcy5lbnYuQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQgPSAnMSc7XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgdGhlIGRlZmF1bHQgU0RLIHByb3ZpZGVyXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2RrUHJvdmlkZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIFByb2ZpbGUgdG8gcmVhZCBmcm9tIH4vLmF3c1xuICAgKlxuICAgKiBAZGVmYXVsdCAtIE5vIHByb2ZpbGVcbiAgICovXG4gIHJlYWRvbmx5IHByb2ZpbGU/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgd2Ugc2hvdWxkIGNoZWNrIGZvciBFQzIgY3JlZGVudGlhbHNcbiAgICpcbiAgICogQGRlZmF1bHQgLSBBdXRvZGV0ZWN0XG4gICAqL1xuICByZWFkb25seSBlYzJjcmVkcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgd2Ugc2hvdWxkIGNoZWNrIGZvciBjb250YWluZXIgY3JlZGVudGlhbHNcbiAgICpcbiAgICogQGRlZmF1bHQgLSBBdXRvZGV0ZWN0XG4gICAqL1xuICByZWFkb25seSBjb250YWluZXJDcmVkcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEhUVFAgb3B0aW9ucyBmb3IgU0RLXG4gICAqL1xuICByZWFkb25seSBodHRwT3B0aW9ucz86IFNka0h0dHBPcHRpb25zO1xufVxuXG4vKipcbiAqIE9wdGlvbnMgZm9yIGluZGl2aWR1YWwgU0RLc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFNka0h0dHBPcHRpb25zIHtcbiAgLyoqXG4gICAqIFByb3h5IGFkZHJlc3MgdG8gdXNlXG4gICAqXG4gICAqIEBkZWZhdWx0IE5vIHByb3h5XG4gICAqL1xuICByZWFkb25seSBwcm94eUFkZHJlc3M/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEEgcGF0aCB0byBhIGNlcnRpZmljYXRlIGJ1bmRsZSB0aGF0IGNvbnRhaW5zIGEgY2VydCB0byBiZSB0cnVzdGVkLlxuICAgKlxuICAgKiBAZGVmYXVsdCBObyBjZXJ0aWZpY2F0ZSBidW5kbGVcbiAgICovXG4gIHJlYWRvbmx5IGNhQnVuZGxlUGF0aD86IHN0cmluZztcblxuICAvKipcbiAgICogVGhlIGN1c3RvbSB1c2VyIGFnZW50IHRvIHVzZS5cbiAgICpcbiAgICogQGRlZmF1bHQgLSA8cGFja2FnZS1uYW1lPi88cGFja2FnZS12ZXJzaW9uPlxuICAgKi9cbiAgcmVhZG9ubHkgdXNlckFnZW50Pzogc3RyaW5nO1xufVxuXG5jb25zdCBDQUNIRURfQUNDT1VOVCA9IFN5bWJvbCgnY2FjaGVkX2FjY291bnQnKTtcbmNvbnN0IENBQ0hFRF9ERUZBVUxUX0NSRURFTlRJQUxTID0gU3ltYm9sKCdjYWNoZWRfZGVmYXVsdF9jcmVkZW50aWFscycpO1xuXG4vKipcbiAqIENyZWF0ZXMgaW5zdGFuY2VzIG9mIHRoZSBBV1MgU0RLIGFwcHJvcHJpYXRlIGZvciBhIGdpdmVuIGFjY291bnQvcmVnaW9uLlxuICpcbiAqIEJlaGF2aW9yIGlzIGFzIGZvbGxvd3M6XG4gKlxuICogLSBGaXJzdCwgYSBzZXQgb2YgXCJiYXNlXCIgY3JlZGVudGlhbHMgYXJlIGVzdGFibGlzaGVkXG4gKiAgIC0gSWYgYSB0YXJnZXQgZW52aXJvbm1lbnQgaXMgZ2l2ZW4gYW5kIHRoZSBkZWZhdWx0IChcImN1cnJlbnRcIikgU0RLIGNyZWRlbnRpYWxzIGFyZSBmb3JcbiAqICAgICB0aGF0IGFjY291bnQsIHJldHVybiB0aG9zZTsgb3RoZXJ3aXNlXG4gKiAgIC0gSWYgYSB0YXJnZXQgZW52aXJvbm1lbnQgaXMgZ2l2ZW4sIHNjYW4gYWxsIGNyZWRlbnRpYWwgcHJvdmlkZXIgcGx1Z2luc1xuICogICAgIGZvciBjcmVkZW50aWFscywgYW5kIHJldHVybiB0aG9zZSBpZiBmb3VuZDsgb3RoZXJ3aXNlXG4gKiAgIC0gUmV0dXJuIGRlZmF1bHQgKFwiY3VycmVudFwiKSBTREsgY3JlZGVudGlhbHMsIG5vdGluZyB0aGF0IHRoZXkgbWlnaHQgYmUgd3JvbmcuXG4gKlxuICogLSBTZWNvbmQsIGEgcm9sZSBtYXkgb3B0aW9uYWxseSBuZWVkIHRvIGJlIGFzc3VtZWQuIFVzZSB0aGUgYmFzZSBjcmVkZW50aWFsc1xuICogICBlc3RhYmxpc2hlZCBpbiB0aGUgcHJldmlvdXMgcHJvY2VzcyB0byBhc3N1bWUgdGhhdCByb2xlLlxuICogICAtIElmIGFzc3VtaW5nIHRoZSByb2xlIGZhaWxzIGFuZCB0aGUgYmFzZSBjcmVkZW50aWFscyBhcmUgZm9yIHRoZSBjb3JyZWN0XG4gKiAgICAgYWNjb3VudCwgcmV0dXJuIHRob3NlLiBUaGlzIGlzIGEgZmFsbGJhY2sgZm9yIHBlb3BsZSB3aG8gYXJlIHRyeWluZyB0byBpbnRlcmFjdFxuICogICAgIHdpdGggYSBEZWZhdWx0IFN5bnRoZXNpemVkIHN0YWNrIGFuZCBhbHJlYWR5IGhhdmUgcmlnaHQgY3JlZGVudGlhbHMgc2V0dXAuXG4gKlxuICogICAgIFR5cGljYWwgY2FzZXMgd2Ugc2VlIGluIHRoZSB3aWxkOlxuICogICAgIC0gQ3JlZGVudGlhbCBwbHVnaW4gc2V0dXAgdGhhdCwgYWx0aG91Z2ggbm90IHJlY29tbWVuZGVkLCB3b3JrcyBmb3IgdGhlbVxuICogICAgIC0gU2VlZGVkIHRlcm1pbmFsIHdpdGggYFJlYWRPbmx5YCBjcmVkZW50aWFscyBpbiBvcmRlciB0byBkbyBgY2RrIGRpZmZgLS10aGUgYFJlYWRPbmx5YFxuICogICAgICAgcm9sZSBkb2Vzbid0IGhhdmUgYHN0czpBc3N1bWVSb2xlYCBhbmQgd2lsbCBmYWlsIGZvciBubyByZWFsIGdvb2QgcmVhc29uLlxuICovXG5leHBvcnQgY2xhc3MgU2RrUHJvdmlkZXIge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFNka1Byb3ZpZGVyIHdoaWNoIGdldHMgaXRzIGRlZmF1bHRzIGluIGEgd2F5IHRoYXQgYmVoYXZlcyBsaWtlIHRoZSBBV1MgQ0xJIGRvZXNcbiAgICpcbiAgICogVGhlIEFXUyBTREsgZm9yIEpTIGJlaGF2ZXMgc2xpZ2h0bHkgZGlmZmVyZW50bHkgZnJvbSB0aGUgQVdTIENMSSBpbiBhIG51bWJlciBvZiB3YXlzOyBzZWUgdGhlXG4gICAqIGNsYXNzIGBBd3NDbGlDb21wYXRpYmxlYCBmb3IgdGhlIGRldGFpbHMuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIHdpdGhBd3NDbGlDb21wYXRpYmxlRGVmYXVsdHMob3B0aW9uczogU2RrUHJvdmlkZXJPcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBzZGtPcHRpb25zID0gcGFyc2VIdHRwT3B0aW9ucyhvcHRpb25zLmh0dHBPcHRpb25zID8/IHt9KTtcblxuICAgIGNvbnN0IGNoYWluID0gYXdhaXQgQXdzQ2xpQ29tcGF0aWJsZS5jcmVkZW50aWFsQ2hhaW4oe1xuICAgICAgcHJvZmlsZTogb3B0aW9ucy5wcm9maWxlLFxuICAgICAgZWMyaW5zdGFuY2U6IG9wdGlvbnMuZWMyY3JlZHMsXG4gICAgICBjb250YWluZXJDcmVkczogb3B0aW9ucy5jb250YWluZXJDcmVkcyxcbiAgICAgIGh0dHBPcHRpb25zOiBzZGtPcHRpb25zLmh0dHBPcHRpb25zLFxuICAgIH0pO1xuICAgIGNvbnN0IHJlZ2lvbiA9IGF3YWl0IEF3c0NsaUNvbXBhdGlibGUucmVnaW9uKHtcbiAgICAgIHByb2ZpbGU6IG9wdGlvbnMucHJvZmlsZSxcbiAgICAgIGVjMmluc3RhbmNlOiBvcHRpb25zLmVjMmNyZWRzLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBTZGtQcm92aWRlcihjaGFpbiwgcmVnaW9uLCBzZGtPcHRpb25zKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2lucyA9IG5ldyBDcmVkZW50aWFsUGx1Z2lucygpO1xuXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRDaGFpbjogQVdTLkNyZWRlbnRpYWxQcm92aWRlckNoYWluLFxuICAgIC8qKlxuICAgICAqIERlZmF1bHQgcmVnaW9uXG4gICAgICovXG4gICAgcHVibGljIHJlYWRvbmx5IGRlZmF1bHRSZWdpb246IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNka09wdGlvbnM6IENvbmZpZ3VyYXRpb25PcHRpb25zID0ge30pIHtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYW4gU0RLIHdoaWNoIGNhbiBkbyBvcGVyYXRpb25zIGluIHRoZSBnaXZlbiBlbnZpcm9ubWVudFxuICAgKlxuICAgKiBUaGUgYGVudmlyb25tZW50YCBwYXJhbWV0ZXIgaXMgcmVzb2x2ZWQgZmlyc3QgKHNlZSBgcmVzb2x2ZUVudmlyb25tZW50KClgKS5cbiAgICovXG4gIHB1YmxpYyBhc3luYyBmb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQsIG1vZGU6IE1vZGUsIG9wdGlvbnM/OiBDcmVkZW50aWFsc09wdGlvbnMpOiBQcm9taXNlPElTREs+IHtcbiAgICBjb25zdCBlbnYgPSBhd2FpdCB0aGlzLnJlc29sdmVFbnZpcm9ubWVudChlbnZpcm9ubWVudCk7XG4gICAgY29uc3QgYmFzZUNyZWRzID0gYXdhaXQgdGhpcy5vYnRhaW5CYXNlQ3JlZGVudGlhbHMoZW52LmFjY291bnQsIG1vZGUpO1xuXG4gICAgLy8gQXQgdGhpcyBwb2ludCwgd2UgbmVlZCBhdCBsZWFzdCBTT01FIGNyZWRlbnRpYWxzXG4gICAgaWYgKGJhc2VDcmVkcy5zb3VyY2UgPT09ICdub25lJykgeyB0aHJvdyBuZXcgRXJyb3IoZm10T2J0YWluQ3JlZGVudGlhbHNFcnJvcihlbnYuYWNjb3VudCwgYmFzZUNyZWRzKSk7IH1cblxuICAgIC8vIFNpbXBsZSBjYXNlIGlzIGlmIHdlIGRvbid0IG5lZWQgdG8gXCJhc3N1bWVSb2xlXCIgaGVyZS4gSWYgc28sIHdlIG11c3Qgbm93IGhhdmUgY3JlZGVudGlhbHMgZm9yIHRoZSByaWdodFxuICAgIC8vIGFjY291bnQuXG4gICAgaWYgKG9wdGlvbnM/LmFzc3VtZVJvbGVBcm4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGJhc2VDcmVkcy5zb3VyY2UgPT09ICdpbmNvcnJlY3REZWZhdWx0JykgeyB0aHJvdyBuZXcgRXJyb3IoZm10T2J0YWluQ3JlZGVudGlhbHNFcnJvcihlbnYuYWNjb3VudCwgYmFzZUNyZWRzKSk7IH1cbiAgICAgIHJldHVybiBuZXcgU0RLKGJhc2VDcmVkcy5jcmVkZW50aWFscywgZW52LnJlZ2lvbiwgdGhpcy5zZGtPcHRpb25zKTtcbiAgICB9XG5cbiAgICAvLyBXZSB3aWxsIHByb2NlZWQgdG8gQXNzdW1lUm9sZSB1c2luZyB3aGF0ZXZlciB3ZSd2ZSBiZWVuIGdpdmVuLlxuICAgIGNvbnN0IHNkayA9IGF3YWl0IHRoaXMud2l0aEFzc3VtZWRSb2xlKGJhc2VDcmVkcywgb3B0aW9ucy5hc3N1bWVSb2xlQXJuLCBvcHRpb25zLmFzc3VtZVJvbGVFeHRlcm5hbElkLCBlbnYucmVnaW9uKTtcblxuICAgIC8vIEV4ZXJjaXNlIHRoZSBBc3N1bWVSb2xlQ3JlZGVudGlhbHNQcm92aWRlciB3ZSd2ZSBnb3R0ZW4gYXQgbGVhc3Qgb25jZSBzb1xuICAgIC8vIHdlIGNhbiBkZXRlcm1pbmUgd2hldGhlciB0aGUgQXNzdW1lUm9sZSBjYWxsIHN1Y2NlZWRzIG9yIG5vdC5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgc2RrLmZvcmNlQ3JlZGVudGlhbFJldHJpZXZhbCgpO1xuICAgICAgcmV0dXJuIHNkaztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBBc3N1bWVSb2xlIGZhaWxlZC4gUHJvY2VlZCBhbmQgd2FybiAqaWYgYW5kIG9ubHkgaWYqIHRoZSBiYXNlQ3JlZGVudGlhbHMgd2VyZSBhbHJlYWR5IGZvciB0aGUgcmlnaHQgYWNjb3VudFxuICAgICAgLy8gb3IgcmV0dXJuZWQgZnJvbSBhIHBsdWdpbi4gVGhpcyBpcyB0byBjb3ZlciBzb21lIGN1cnJlbnQgc2V0dXBzIGZvciBwZW9wbGUgdXNpbmcgcGx1Z2lucyBvciBwcmVmZXJyaW5nIHRvXG4gICAgICAvLyBmZWVkIHRoZSBDTEkgY3JlZGVudGlhbHMgd2hpY2ggYXJlIHN1ZmZpY2llbnQgYnkgdGhlbXNlbHZlcy4gUHJlZmVyIHRvIGFzc3VtZSB0aGUgY29ycmVjdCByb2xlIGlmIHdlIGNhbixcbiAgICAgIC8vIGJ1dCBpZiB3ZSBjYW4ndCB0aGVuIGxldCdzIGp1c3QgdHJ5IHdpdGggYXZhaWxhYmxlIGNyZWRlbnRpYWxzIGFueXdheS5cbiAgICAgIGlmIChiYXNlQ3JlZHMuc291cmNlID09PSAnY29ycmVjdERlZmF1bHQnIHx8IGJhc2VDcmVkcy5zb3VyY2UgPT09ICdwbHVnaW4nKSB7XG4gICAgICAgIGRlYnVnKGUubWVzc2FnZSk7XG4gICAgICAgIHdhcm5pbmcoYCR7Zm10T2J0YWluZWRDcmVkZW50aWFscyhiYXNlQ3JlZHMpfSBjb3VsZCBub3QgYmUgdXNlZCB0byBhc3N1bWUgJyR7b3B0aW9ucy5hc3N1bWVSb2xlQXJufScsIGJ1dCBhcmUgZm9yIHRoZSByaWdodCBhY2NvdW50LiBQcm9jZWVkaW5nIGFueXdheS5gKTtcbiAgICAgICAgcmV0dXJuIG5ldyBTREsoYmFzZUNyZWRzLmNyZWRlbnRpYWxzLCBlbnYucmVnaW9uLCB0aGlzLnNka09wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHBhcnRpdGlvbiB0aGF0IGJhc2UgY3JlZGVudGlhbHMgYXJlIGZvclxuICAgKlxuICAgKiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIHRoZXJlIGFyZSBubyBiYXNlIGNyZWRlbnRpYWxzLlxuICAgKi9cbiAgcHVibGljIGFzeW5jIGJhc2VDcmVkZW50aWFsc1BhcnRpdGlvbihlbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQsIG1vZGU6IE1vZGUpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IGVudiA9IGF3YWl0IHRoaXMucmVzb2x2ZUVudmlyb25tZW50KGVudmlyb25tZW50KTtcbiAgICBjb25zdCBiYXNlQ3JlZHMgPSBhd2FpdCB0aGlzLm9idGFpbkJhc2VDcmVkZW50aWFscyhlbnYuYWNjb3VudCwgbW9kZSk7XG4gICAgaWYgKGJhc2VDcmVkcy5zb3VyY2UgPT09ICdub25lJykgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG4gICAgcmV0dXJuIChhd2FpdCBuZXcgU0RLKGJhc2VDcmVkcy5jcmVkZW50aWFscywgZW52LnJlZ2lvbiwgdGhpcy5zZGtPcHRpb25zKS5jdXJyZW50QWNjb3VudCgpKS5wYXJ0aXRpb247XG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZSB0aGUgZW52aXJvbm1lbnQgZm9yIGEgc3RhY2tcbiAgICpcbiAgICogUmVwbGFjZXMgdGhlIG1hZ2ljIHZhbHVlcyBgVU5LTk9XTl9SRUdJT05gIGFuZCBgVU5LTk9XTl9BQ0NPVU5UYFxuICAgKiB3aXRoIHRoZSBkZWZhdWx0cyBmb3IgdGhlIGN1cnJlbnQgU0RLIGNvbmZpZ3VyYXRpb24gKGB+Ly5hd3MvY29uZmlnYCBvclxuICAgKiBvdGhlcndpc2UpLlxuICAgKlxuICAgKiBJdCBpcyBhbiBlcnJvciBpZiBgVU5LTk9XTl9BQ0NPVU5UYCBpcyB1c2VkIGJ1dCB0aGUgdXNlciBoYXNuJ3QgY29uZmlndXJlZFxuICAgKiBhbnkgU0RLIGNyZWRlbnRpYWxzLlxuICAgKi9cbiAgcHVibGljIGFzeW5jIHJlc29sdmVFbnZpcm9ubWVudChlbnY6IGN4YXBpLkVudmlyb25tZW50KTogUHJvbWlzZTxjeGFwaS5FbnZpcm9ubWVudD4ge1xuICAgIGNvbnN0IHJlZ2lvbiA9IGVudi5yZWdpb24gIT09IGN4YXBpLlVOS05PV05fUkVHSU9OID8gZW52LnJlZ2lvbiA6IHRoaXMuZGVmYXVsdFJlZ2lvbjtcbiAgICBjb25zdCBhY2NvdW50ID0gZW52LmFjY291bnQgIT09IGN4YXBpLlVOS05PV05fQUNDT1VOVCA/IGVudi5hY2NvdW50IDogKGF3YWl0IHRoaXMuZGVmYXVsdEFjY291bnQoKSk/LmFjY291bnRJZDtcblxuICAgIGlmICghYWNjb3VudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVzb2x2ZSBBV1MgYWNjb3VudCB0byB1c2UuIEl0IG11c3QgYmUgZWl0aGVyIGNvbmZpZ3VyZWQgd2hlbiB5b3UgZGVmaW5lIHlvdXIgQ0RLIG9yIHRocm91Z2ggdGhlIGVudmlyb25tZW50Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlZ2lvbixcbiAgICAgIGFjY291bnQsXG4gICAgICBuYW1lOiBjeGFwaS5FbnZpcm9ubWVudFV0aWxzLmZvcm1hdChhY2NvdW50LCByZWdpb24pLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogVGhlIGFjY291bnQgd2UnZCBhdXRoIGludG8gaWYgd2UgdXNlZCBkZWZhdWx0IGNyZWRlbnRpYWxzLlxuICAgKlxuICAgKiBEZWZhdWx0IGNyZWRlbnRpYWxzIGFyZSB0aGUgc2V0IG9mIGFtYmllbnRseSBjb25maWd1cmVkIGNyZWRlbnRpYWxzIHVzaW5nXG4gICAqIG9uZSBvZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGVzLCBvciB+Ly5hd3MvY3JlZGVudGlhbHMsIG9yIHRoZSAqb25lKlxuICAgKiBwcm9maWxlIHRoYXQgd2FzIHBhc3NlZCBpbnRvIHRoZSBDTEkuXG4gICAqXG4gICAqIE1pZ2h0IHJldHVybiB1bmRlZmluZWQgaWYgdGhlcmUgYXJlIG5vIGRlZmF1bHQvYW1iaWVudCBjcmVkZW50aWFsc1xuICAgKiBhdmFpbGFibGUgKGluIHdoaWNoIGNhc2UgdGhlIHVzZXIgc2hvdWxkIGJldHRlciBob3BlIHRoZXkgaGF2ZVxuICAgKiBjcmVkZW50aWFsIHBsdWdpbnMgY29uZmlndXJlZCkuXG4gICAqXG4gICAqIFVzZXMgYSBjYWNoZSB0byBhdm9pZCBTVFMgY2FsbHMgaWYgd2UgZG9uJ3QgbmVlZCAnZW0uXG4gICAqL1xuICBwdWJsaWMgZGVmYXVsdEFjY291bnQoKTogUHJvbWlzZTxBY2NvdW50IHwgdW5kZWZpbmVkPiB7XG4gICAgcmV0dXJuIGNhY2hlZCh0aGlzLCBDQUNIRURfQUNDT1VOVCwgYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY3JlZHMgPSBhd2FpdCB0aGlzLmRlZmF1bHRDcmVkZW50aWFscygpO1xuXG4gICAgICAgIGNvbnN0IGFjY2Vzc0tleUlkID0gY3JlZHMuYWNjZXNzS2V5SWQ7XG4gICAgICAgIGlmICghYWNjZXNzS2V5SWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byByZXNvbHZlIEFXUyBjcmVkZW50aWFscyAoc2V0dXAgd2l0aCBcImF3cyBjb25maWd1cmVcIiknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhd2FpdCBuZXcgU0RLKGNyZWRzLCB0aGlzLmRlZmF1bHRSZWdpb24sIHRoaXMuc2RrT3B0aW9ucykuY3VycmVudEFjY291bnQoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZGVidWcoJ1VuYWJsZSB0byBkZXRlcm1pbmUgdGhlIGRlZmF1bHQgQVdTIGFjY291bnQ6JywgZSk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGNyZWRlbnRpYWxzIGZvciB0aGUgZ2l2ZW4gYWNjb3VudCBJRCBpbiB0aGUgZ2l2ZW4gbW9kZVxuICAgKlxuICAgKiAxLiBVc2UgdGhlIGRlZmF1bHQgY3JlZGVudGlhbHMgaWYgdGhlIGRlc3RpbmF0aW9uIGFjY291bnQgbWF0Y2hlcyB0aGVcbiAgICogICAgY3VycmVudCBjcmVkZW50aWFscycgYWNjb3VudC5cbiAgICogMi4gT3RoZXJ3aXNlIHRyeSBhbGwgY3JlZGVudGlhbCBwbHVnaW5zLlxuICAgKiAzLiBGYWlsIGlmIG5laXRoZXIgb2YgdGhlc2UgeWllbGQgYW55IGNyZWRlbnRpYWxzLlxuICAgKiA0LiBSZXR1cm4gYSBmYWlsdXJlIGlmIGFueSBvZiB0aGVtIHJldHVybmVkIGNyZWRlbnRpYWxzXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIG9idGFpbkJhc2VDcmVkZW50aWFscyhhY2NvdW50SWQ6IHN0cmluZywgbW9kZTogTW9kZSk6IFByb21pc2U8T2J0YWluQmFzZUNyZWRlbnRpYWxzUmVzdWx0PiB7XG4gICAgLy8gRmlyc3QgdHJ5ICdjdXJyZW50JyBjcmVkZW50aWFsc1xuICAgIGNvbnN0IGRlZmF1bHRBY2NvdW50SWQgPSAoYXdhaXQgdGhpcy5kZWZhdWx0QWNjb3VudCgpKT8uYWNjb3VudElkO1xuICAgIGlmIChkZWZhdWx0QWNjb3VudElkID09PSBhY2NvdW50SWQpIHtcbiAgICAgIHJldHVybiB7IHNvdXJjZTogJ2NvcnJlY3REZWZhdWx0JywgY3JlZGVudGlhbHM6IGF3YWl0IHRoaXMuZGVmYXVsdENyZWRlbnRpYWxzKCkgfTtcbiAgICB9XG5cbiAgICAvLyBUaGVuIHRyeSB0aGUgcGx1Z2luc1xuICAgIGNvbnN0IHBsdWdpbkNyZWRzID0gYXdhaXQgdGhpcy5wbHVnaW5zLmZldGNoQ3JlZGVudGlhbHNGb3IoYWNjb3VudElkLCBtb2RlKTtcbiAgICBpZiAocGx1Z2luQ3JlZHMpIHtcbiAgICAgIHJldHVybiB7IHNvdXJjZTogJ3BsdWdpbicsIC4uLnBsdWdpbkNyZWRzIH07XG4gICAgfVxuXG4gICAgLy8gRmFsbCBiYWNrIHRvIGRlZmF1bHQgY3JlZGVudGlhbHMgd2l0aCBhIG5vdGUgdGhhdCB0aGV5J3JlIG5vdCB0aGUgcmlnaHQgb25lcyB5ZXRcbiAgICBpZiAoZGVmYXVsdEFjY291bnRJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2U6ICdpbmNvcnJlY3REZWZhdWx0JyxcbiAgICAgICAgYWNjb3VudElkOiBkZWZhdWx0QWNjb3VudElkLFxuICAgICAgICBjcmVkZW50aWFsczogYXdhaXQgdGhpcy5kZWZhdWx0Q3JlZGVudGlhbHMoKSxcbiAgICAgICAgdW51c2VkUGx1Z2luczogdGhpcy5wbHVnaW5zLmF2YWlsYWJsZVBsdWdpbk5hbWVzLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBBcHBhcmVudGx5IHdlIGRpZG4ndCBmaW5kIGFueSBhdCBhbGxcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlOiAnbm9uZScsXG4gICAgICB1bnVzZWRQbHVnaW5zOiB0aGlzLnBsdWdpbnMuYXZhaWxhYmxlUGx1Z2luTmFtZXMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlIHRoZSBkZWZhdWx0IGNoYWluIHRvIHRoZSBmaXJzdCBzZXQgb2YgY3JlZGVudGlhbHMgdGhhdCBpcyBhdmFpbGFibGVcbiAgICovXG4gIHByaXZhdGUgZGVmYXVsdENyZWRlbnRpYWxzKCk6IFByb21pc2U8QVdTLkNyZWRlbnRpYWxzPiB7XG4gICAgcmV0dXJuIGNhY2hlZCh0aGlzLCBDQUNIRURfREVGQVVMVF9DUkVERU5USUFMUywgKCkgPT4ge1xuICAgICAgZGVidWcoJ1Jlc29sdmluZyBkZWZhdWx0IGNyZWRlbnRpYWxzJyk7XG4gICAgICByZXR1cm4gdGhpcy5kZWZhdWx0Q2hhaW4ucmVzb2x2ZVByb21pc2UoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYW4gU0RLIHdoaWNoIHVzZXMgYXNzdW1lZCByb2xlIGNyZWRlbnRpYWxzXG4gICAqXG4gICAqIFRoZSBiYXNlIGNyZWRlbnRpYWxzIHVzZWQgdG8gcmV0cmlldmUgdGhlIGFzc3VtZWQgcm9sZSBjcmVkZW50aWFscyB3aWxsIGJlIHRoZVxuICAgKiBzYW1lIGNyZWRlbnRpYWxzIHJldHVybmVkIGJ5IG9idGFpbkNyZWRlbnRpYWxzIGlmIGFuIGVudmlyb25tZW50IGFuZCBtb2RlIGlzIHBhc3NlZCxcbiAgICogb3RoZXJ3aXNlIGl0IHdpbGwgYmUgdGhlIGN1cnJlbnQgY3JlZGVudGlhbHMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHdpdGhBc3N1bWVkUm9sZShcbiAgICBtYXN0ZXJDcmVkZW50aWFsczogRXhjbHVkZTxPYnRhaW5CYXNlQ3JlZGVudGlhbHNSZXN1bHQsIHsgc291cmNlOiAnbm9uZScgfT4sXG4gICAgcm9sZUFybjogc3RyaW5nLFxuICAgIGV4dGVybmFsSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICByZWdpb246IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuICAgIGRlYnVnKGBBc3N1bWluZyByb2xlICcke3JvbGVBcm59Jy5gKTtcblxuICAgIHJlZ2lvbiA9IHJlZ2lvbiA/PyB0aGlzLmRlZmF1bHRSZWdpb247XG5cbiAgICBjb25zdCBjcmVkcyA9IG5ldyBBV1MuQ2hhaW5hYmxlVGVtcG9yYXJ5Q3JlZGVudGlhbHMoe1xuICAgICAgcGFyYW1zOiB7XG4gICAgICAgIFJvbGVBcm46IHJvbGVBcm4sXG4gICAgICAgIC4uLmV4dGVybmFsSWQgPyB7IEV4dGVybmFsSWQ6IGV4dGVybmFsSWQgfSA6IHt9LFxuICAgICAgICBSb2xlU2Vzc2lvbk5hbWU6IGBhd3MtY2RrLSR7c2FmZVVzZXJuYW1lKCl9YCxcbiAgICAgIH0sXG4gICAgICBzdHNDb25maWc6IHtcbiAgICAgICAgcmVnaW9uLFxuICAgICAgICAuLi50aGlzLnNka09wdGlvbnMsXG4gICAgICB9LFxuICAgICAgbWFzdGVyQ3JlZGVudGlhbHM6IG1hc3RlckNyZWRlbnRpYWxzLmNyZWRlbnRpYWxzLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBTREsoY3JlZHMsIHJlZ2lvbiwgdGhpcy5zZGtPcHRpb25zLCB7XG4gICAgICBhc3N1bWVSb2xlQ3JlZGVudGlhbHNTb3VyY2VEZXNjcmlwdGlvbjogZm10T2J0YWluZWRDcmVkZW50aWFscyhtYXN0ZXJDcmVkZW50aWFscyksXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBBV1MgYWNjb3VudFxuICpcbiAqIEFuIEFXUyBhY2NvdW50IGFsd2F5cyBleGlzdHMgaW4gb25seSBvbmUgcGFydGl0aW9uLiBVc3VhbGx5IHdlIGRvbid0IGNhcmUgYWJvdXRcbiAqIHRoZSBwYXJ0aXRpb24sIGJ1dCB3aGVuIHdlIG5lZWQgdG8gZm9ybSBBUk5zIHdlIGRvLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFjY291bnQge1xuICAvKipcbiAgICogVGhlIGFjY291bnQgbnVtYmVyXG4gICAqL1xuICByZWFkb25seSBhY2NvdW50SWQ6IHN0cmluZztcblxuICAvKipcbiAgICogVGhlIHBhcnRpdGlvbiAoJ2F3cycgb3IgJ2F3cy1jbicgb3Igb3RoZXJ3aXNlKVxuICAgKi9cbiAgcmVhZG9ubHkgcGFydGl0aW9uOiBzdHJpbmc7XG59XG5cbi8qKlxuICogR2V0IEhUVFAgb3B0aW9ucyBmb3IgdGhlIFNES1xuICpcbiAqIFJlYWQgZnJvbSB1c2VyIGlucHV0IG9yIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAqXG4gKiBSZXR1cm5zIGEgY29tcGxldGUgYENvbmZpZ3VyYXRpb25PcHRpb25zYCBvYmplY3QgYmVjYXVzZSB0aGF0J3Mgd2hlcmVcbiAqIGBjdXN0b21Vc2VyQWdlbnRgIGxpdmVzLCBidXQgYGh0dHBPcHRpb25zYCBpcyB0aGUgbW9zdCBpbXBvcnRhbnQgYXR0cmlidXRlLlxuICovXG5mdW5jdGlvbiBwYXJzZUh0dHBPcHRpb25zKG9wdGlvbnM6IFNka0h0dHBPcHRpb25zKSB7XG4gIGNvbnN0IGNvbmZpZzogQ29uZmlndXJhdGlvbk9wdGlvbnMgPSB7fTtcbiAgY29uZmlnLmh0dHBPcHRpb25zID0ge307XG5cbiAgbGV0IHVzZXJBZ2VudCA9IG9wdGlvbnMudXNlckFnZW50O1xuICBpZiAodXNlckFnZW50ID09IG51bGwpIHtcbiAgICAvLyBGaW5kIHRoZSBwYWNrYWdlLmpzb24gZnJvbSB0aGUgbWFpbiB0b29sa2l0XG4gICAgY29uc3QgcGtnID0gSlNPTi5wYXJzZShyZWFkSWZQb3NzaWJsZShwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAnLi4nLCAncGFja2FnZS5qc29uJykpID8/ICd7fScpO1xuICAgIHVzZXJBZ2VudCA9IGAke3BrZy5uYW1lfS8ke3BrZy52ZXJzaW9ufWA7XG4gIH1cbiAgY29uZmlnLmN1c3RvbVVzZXJBZ2VudCA9IHVzZXJBZ2VudDtcblxuICBjb25zdCBwcm94eUFkZHJlc3MgPSBvcHRpb25zLnByb3h5QWRkcmVzcyB8fCBodHRwc1Byb3h5RnJvbUVudmlyb25tZW50KCk7XG4gIGNvbnN0IGNhQnVuZGxlUGF0aCA9IG9wdGlvbnMuY2FCdW5kbGVQYXRoIHx8IGNhQnVuZGxlUGF0aEZyb21FbnZpcm9ubWVudCgpO1xuXG4gIGlmIChwcm94eUFkZHJlc3MgJiYgY2FCdW5kbGVQYXRoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBdCB0aGUgbW9tZW50LCBjYW5ub3Qgc3BlY2lmeSBQcm94eSAoJHtwcm94eUFkZHJlc3N9KSBhbmQgQ0EgQnVuZGxlICgke2NhQnVuZGxlUGF0aH0pIGF0IHRoZSBzYW1lIHRpbWUuIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1jZGsvaXNzdWVzLzU4MDRgKTtcbiAgICAvLyBNYXliZSBpdCdzIHBvc3NpYmxlIGFmdGVyIGFsbCwgYnV0IEkndmUgYmVlbiBzdGFyaW5nIGF0XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL1Rvb1RhbGxOYXRlL25vZGUtcHJveHktYWdlbnQvYmxvYi9tYXN0ZXIvaW5kZXguanMjTDc5XG4gICAgLy8gYSB3aGlsZSBub3cgdHJ5aW5nIHRvIGZpZ3VyZSBvdXQgd2hhdCB0byBwYXNzIGluIHNvIHRoYXQgdGhlIHVuZGVybHlpbmcgQWdlbnRcbiAgICAvLyBvYmplY3Qgd2lsbCBnZXQgdGhlICdjYScgYXJndW1lbnQuIEl0J3Mgbm90IHRyaXZpYWwgYW5kIEkgZG9uJ3Qgd2FudCB0byByaXNrIGl0LlxuICB9XG5cbiAgaWYgKHByb3h5QWRkcmVzcykgeyAvLyBJZ25vcmUgZW1wdHkgc3RyaW5nIG9uIHB1cnBvc2VcbiAgICAvLyBodHRwczovL2F3cy5hbWF6b24uY29tL2Jsb2dzL2RldmVsb3Blci91c2luZy10aGUtYXdzLXNkay1mb3ItamF2YXNjcmlwdC1mcm9tLWJlaGluZC1hLXByb3h5L1xuICAgIGRlYnVnKCdVc2luZyBwcm94eSBzZXJ2ZXI6ICVzJywgcHJveHlBZGRyZXNzKTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICAgIGNvbnN0IFByb3h5QWdlbnQ6IGFueSA9IHJlcXVpcmUoJ3Byb3h5LWFnZW50Jyk7XG4gICAgY29uZmlnLmh0dHBPcHRpb25zLmFnZW50ID0gbmV3IFByb3h5QWdlbnQocHJveHlBZGRyZXNzKTtcbiAgfVxuICBpZiAoY2FCdW5kbGVQYXRoKSB7XG4gICAgZGVidWcoJ1VzaW5nIENBIGJ1bmRsZSBwYXRoOiAlcycsIGNhQnVuZGxlUGF0aCk7XG4gICAgY29uZmlnLmh0dHBPcHRpb25zLmFnZW50ID0gbmV3IGh0dHBzLkFnZW50KHtcbiAgICAgIGNhOiByZWFkSWZQb3NzaWJsZShjYUJ1bmRsZVBhdGgpLFxuICAgICAga2VlcEFsaXZlOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGNvbmZpZztcbn1cblxuLyoqXG4gKiBGaW5kIGFuZCByZXR1cm4gdGhlIGNvbmZpZ3VyZWQgSFRUUFMgcHJveHkgYWRkcmVzc1xuICovXG5mdW5jdGlvbiBodHRwc1Byb3h5RnJvbUVudmlyb25tZW50KCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmIChwcm9jZXNzLmVudi5odHRwc19wcm94eSkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudi5odHRwc19wcm94eTtcbiAgfVxuICBpZiAocHJvY2Vzcy5lbnYuSFRUUFNfUFJPWFkpIHtcbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuSFRUUFNfUFJPWFk7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBGaW5kIGFuZCByZXR1cm4gYSBDQSBjZXJ0aWZpY2F0ZSBidW5kbGUgcGF0aCB0byBiZSBwYXNzZWQgaW50byB0aGUgU0RLLlxuICovXG5mdW5jdGlvbiBjYUJ1bmRsZVBhdGhGcm9tRW52aXJvbm1lbnQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHByb2Nlc3MuZW52LmF3c19jYV9idW5kbGUpIHtcbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuYXdzX2NhX2J1bmRsZTtcbiAgfVxuICBpZiAocHJvY2Vzcy5lbnYuQVdTX0NBX0JVTkRMRSkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudi5BV1NfQ0FfQlVORExFO1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogUmVhZCBhIGZpbGUgaWYgaXQgZXhpc3RzLCBvciByZXR1cm4gdW5kZWZpbmVkXG4gKlxuICogTm90IGFzeW5jIGJlY2F1c2UgaXQgaXMgdXNlZCBpbiB0aGUgY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gcmVhZElmUG9zc2libGUoZmlsZW5hbWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIHRyeSB7XG4gICAgaWYgKCFmcy5wYXRoRXhpc3RzU3luYyhmaWxlbmFtZSkpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuICAgIHJldHVybiBmcy5yZWFkRmlsZVN5bmMoZmlsZW5hbWUsIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBkZWJ1ZyhlKTtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSB1c2VybmFtZSB3aXRoIGNoYXJhY3RlcnMgaW52YWxpZCBmb3IgYSBSb2xlU2Vzc2lvbk5hbWUgcmVtb3ZlZFxuICpcbiAqIEBzZWUgaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL1NUUy9sYXRlc3QvQVBJUmVmZXJlbmNlL0FQSV9Bc3N1bWVSb2xlLmh0bWwjQVBJX0Fzc3VtZVJvbGVfUmVxdWVzdFBhcmFtZXRlcnNcbiAqL1xuZnVuY3Rpb24gc2FmZVVzZXJuYW1lKCkge1xuICByZXR1cm4gb3MudXNlckluZm8oKS51c2VybmFtZS5yZXBsYWNlKC9bXlxcdys9LC5ALV0vZywgJ0AnKTtcbn1cblxuLyoqXG4gKiBPcHRpb25zIGZvciBvYnRhaW5pbmcgY3JlZGVudGlhbHMgZm9yIGFuIGVudmlyb25tZW50XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ3JlZGVudGlhbHNPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBBUk4gb2YgdGhlIHJvbGUgdGhhdCBuZWVkcyB0byBiZSBhc3N1bWVkLCBpZiBhbnlcbiAgICovXG4gIHJlYWRvbmx5IGFzc3VtZVJvbGVBcm4/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEV4dGVybmFsIElEIHJlcXVpcmVkIHRvIGFzc3VtZSB0aGUgZ2l2ZW4gcm9sZS5cbiAgICovXG4gIHJlYWRvbmx5IGFzc3VtZVJvbGVFeHRlcm5hbElkPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFJlc3VsdCBvZiBvYnRhaW5pbmcgYmFzZSBjcmVkZW50aWFsc1xuICovXG50eXBlIE9idGFpbkJhc2VDcmVkZW50aWFsc1Jlc3VsdCA9XG4gIHsgc291cmNlOiAnY29ycmVjdERlZmF1bHQnOyBjcmVkZW50aWFsczogQVdTLkNyZWRlbnRpYWxzIH1cbiAgfCB7IHNvdXJjZTogJ3BsdWdpbic7IHBsdWdpbk5hbWU6IHN0cmluZywgY3JlZGVudGlhbHM6IEFXUy5DcmVkZW50aWFscyB9XG4gIHwgeyBzb3VyY2U6ICdpbmNvcnJlY3REZWZhdWx0JzsgY3JlZGVudGlhbHM6IEFXUy5DcmVkZW50aWFsczsgYWNjb3VudElkOiBzdHJpbmc7IHVudXNlZFBsdWdpbnM6IHN0cmluZ1tdIH1cbiAgfCB7IHNvdXJjZTogJ25vbmUnOyB1bnVzZWRQbHVnaW5zOiBzdHJpbmdbXSB9O1xuXG4vKipcbiAqIElzb2xhdGluZyB0aGUgY29kZSB0aGF0IHRyYW5zbGF0ZXMgY2FsY3VsYXRpb24gZXJyb3JzIGludG8gaHVtYW4gZXJyb3IgbWVzc2FnZXNcbiAqXG4gKiBXZSBjb3ZlciB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICpcbiAqIC0gTm8gY3JlZGVudGlhbHMgYXJlIGF2YWlsYWJsZSBhdCBhbGxcbiAqIC0gRGVmYXVsdCBjcmVkZW50aWFscyBhcmUgZm9yIHRoZSB3cm9uZyBhY2NvdW50XG4gKi9cbmZ1bmN0aW9uIGZtdE9idGFpbkNyZWRlbnRpYWxzRXJyb3IodGFyZ2V0QWNjb3VudElkOiBzdHJpbmcsIG9idGFpblJlc3VsdDogT2J0YWluQmFzZUNyZWRlbnRpYWxzUmVzdWx0ICYgeyBzb3VyY2U6ICdub25lJyB8ICdpbmNvcnJlY3REZWZhdWx0JyB9KTogc3RyaW5nIHtcbiAgY29uc3QgbXNnID0gW2BOZWVkIHRvIHBlcmZvcm0gQVdTIGNhbGxzIGZvciBhY2NvdW50ICR7dGFyZ2V0QWNjb3VudElkfWBdO1xuICBzd2l0Y2ggKG9idGFpblJlc3VsdC5zb3VyY2UpIHtcbiAgICBjYXNlICdpbmNvcnJlY3REZWZhdWx0JzpcbiAgICAgIG1zZy5wdXNoKGBidXQgdGhlIGN1cnJlbnQgY3JlZGVudGlhbHMgYXJlIGZvciAke29idGFpblJlc3VsdC5hY2NvdW50SWR9YCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdub25lJzpcbiAgICAgIG1zZy5wdXNoKCdidXQgbm8gY3JlZGVudGlhbHMgaGF2ZSBiZWVuIGNvbmZpZ3VyZWQnKTtcbiAgfVxuICBpZiAob2J0YWluUmVzdWx0LnVudXNlZFBsdWdpbnMubGVuZ3RoID4gMCkge1xuICAgIG1zZy5wdXNoKGBhbmQgbm9uZSBvZiB0aGVzZSBwbHVnaW5zIGZvdW5kIGFueTogJHtvYnRhaW5SZXN1bHQudW51c2VkUGx1Z2lucy5qb2luKCcsICcpfWApO1xuICB9XG4gIHJldHVybiBtc2cuam9pbignLCAnKTtcbn1cblxuLyoqXG4gKiBGb3JtYXQgYSBtZXNzYWdlIGluZGljYXRpbmcgd2hlcmUgd2UgZ290IGJhc2UgY3JlZGVudGlhbHMgZm9yIHRoZSBhc3N1bWUgcm9sZVxuICpcbiAqIFdlIGNvdmVyIHRoZSBmb2xsb3dpbmcgY2FzZXM6XG4gKlxuICogLSBEZWZhdWx0IGNyZWRlbnRpYWxzIGZvciB0aGUgcmlnaHQgYWNjb3VudFxuICogLSBEZWZhdWx0IGNyZWRlbnRpYWxzIGZvciB0aGUgd3JvbmcgYWNjb3VudFxuICogLSBDcmVkZW50aWFscyByZXR1cm5lZCBmcm9tIGEgcGx1Z2luXG4gKi9cbmZ1bmN0aW9uIGZtdE9idGFpbmVkQ3JlZGVudGlhbHMoXG4gIG9idGFpblJlc3VsdDogRXhjbHVkZTxPYnRhaW5CYXNlQ3JlZGVudGlhbHNSZXN1bHQsIHsgc291cmNlOiAnbm9uZScgfT4pOiBzdHJpbmcge1xuICBzd2l0Y2ggKG9idGFpblJlc3VsdC5zb3VyY2UpIHtcbiAgICBjYXNlICdjb3JyZWN0RGVmYXVsdCc6XG4gICAgICByZXR1cm4gJ2N1cnJlbnQgY3JlZGVudGlhbHMnO1xuICAgIGNhc2UgJ3BsdWdpbic6XG4gICAgICByZXR1cm4gYGNyZWRlbnRpYWxzIHJldHVybmVkIGJ5IHBsdWdpbiAnJHtvYnRhaW5SZXN1bHQucGx1Z2luTmFtZX0nYDtcbiAgICBjYXNlICdpbmNvcnJlY3REZWZhdWx0JzpcbiAgICAgIGNvbnN0IG1zZyA9IFtdO1xuICAgICAgbXNnLnB1c2goYGN1cnJlbnQgY3JlZGVudGlhbHMgKHdoaWNoIGFyZSBmb3IgYWNjb3VudCAke29idGFpblJlc3VsdC5hY2NvdW50SWR9YCk7XG5cbiAgICAgIGlmIChvYnRhaW5SZXN1bHQudW51c2VkUGx1Z2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIG1zZy5wdXNoKGAsIGFuZCBub25lIG9mIHRoZSBmb2xsb3dpbmcgcGx1Z2lucyBwcm92aWRlZCBjcmVkZW50aWFsczogJHtvYnRhaW5SZXN1bHQudW51c2VkUGx1Z2lucy5qb2luKCcsICcpfWApO1xuICAgICAgfVxuICAgICAgbXNnLnB1c2goJyknKTtcblxuICAgICAgcmV0dXJuIG1zZy5qb2luKCcnKTtcbiAgfVxufVxuIl19