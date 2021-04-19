"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const cxapi = require("@aws-cdk/cx-api");
const AWS = require("aws-sdk");
const promptly = require("promptly");
const uuid = require("uuid");
const lib_1 = require("../../lib");
const aws_auth_1 = require("../../lib/api/aws-auth");
const logging = require("../../lib/logging");
const bockfs = require("../bockfs");
const util_1 = require("../util");
const fake_sts_1 = require("./fake-sts");
jest.mock('promptly', () => ({
    prompt: jest.fn().mockResolvedValue('1234'),
}));
const defaultCredOptions = {
    ec2creds: false,
    containerCreds: false,
};
let uid;
let pluginQueried = false;
beforeEach(() => {
    // Cache busters!
    // We prefix everything with UUIDs because:
    //
    // - We have a cache from account# -> credentials
    // - We have a cache from access key -> account
    uid = `(${uuid.v4()})`;
    logging.setLogLevel(2 /* TRACE */);
    lib_1.PluginHost.instance.credentialProviderSources.splice(0);
    lib_1.PluginHost.instance.credentialProviderSources.push({
        isAvailable() { return Promise.resolve(true); },
        canProvideCredentials(account) { return Promise.resolve(account === uniq('99999')); },
        getProvider() {
            pluginQueried = true;
            return Promise.resolve(new AWS.Credentials({
                accessKeyId: `${uid}plugin_key`,
                secretAccessKey: 'plugin_secret',
                sessionToken: 'plugin_token',
            }));
        },
        name: 'test plugin',
    });
    // Make sure these point to nonexistant files to start, if we don't call
    // prepare() then we don't accidentally want to fall back to system config.
    process.env.AWS_CONFIG_FILE = '/dev/null';
    process.env.AWS_SHARED_CREDENTIALS_FILE = '/dev/null';
});
afterEach(() => {
    bockfs.restore();
});
function uniq(account) {
    return `${uid}${account}`;
}
function env(account) {
    return cxapi.EnvironmentUtils.make(account, 'def');
}
describe('with intercepted network calls', () => {
    // Most tests will use intercepted network calls, except one test that tests
    // that the right HTTP `Agent` is used.
    let fakeSts;
    beforeEach(() => {
        fakeSts = new fake_sts_1.FakeSts();
        fakeSts.begin();
        // Make sure the KeyID returned by the plugin is recognized
        fakeSts.registerUser(uniq('99999'), uniq('plugin_key'));
    });
    afterEach(() => {
        fakeSts.restore();
    });
    // Set of tests where the CDK will not trigger assume-role
    // (the INI file might still do assume-role)
    describe('when CDK does not AssumeRole', () => {
        test('uses default credentials by default', async () => {
            // WHEN
            prepareCreds({
                fakeSts,
                credentials: {
                    default: { aws_access_key_id: 'access', $account: '11111', $fakeStsOptions: { partition: 'aws-here' } },
                },
                config: {
                    default: { region: 'eu-bla-5' },
                },
            });
            const provider = await providerFromProfile(undefined);
            // THEN
            expect(provider.defaultRegion).toEqual('eu-bla-5');
            await expect(provider.defaultAccount()).resolves.toEqual({ accountId: uniq('11111'), partition: 'aws-here' });
            // Ask for a different region
            const sdk = await provider.forEnvironment({ ...env(uniq('11111')), region: 'rgn' }, aws_auth_1.Mode.ForReading);
            expect(sdkConfig(sdk).credentials.accessKeyId).toEqual(uniq('access'));
            expect(sdk.currentRegion).toEqual('rgn');
        });
        test('throws if profile credentials are not for the right account', async () => {
            // WHEN
            prepareCreds({
                fakeSts,
                config: {
                    'profile boo': { aws_access_key_id: 'access', $account: '11111' },
                },
            });
            const provider = await providerFromProfile('boo');
            await expect(provider.forEnvironment(env(uniq('some_account_#')), aws_auth_1.Mode.ForReading)).rejects.toThrow('Need to perform AWS calls');
        });
        test('use profile acct/region if agnostic env requested', async () => {
            // WHEN
            prepareCreds({
                fakeSts,
                credentials: {
                    default: { aws_access_key_id: 'access', $account: '11111' },
                },
                config: {
                    default: { region: 'eu-bla-5' },
                },
            });
            const provider = await providerFromProfile(undefined);
            // THEN
            const sdk = await provider.forEnvironment(cxapi.EnvironmentUtils.make(cxapi.UNKNOWN_ACCOUNT, cxapi.UNKNOWN_REGION), aws_auth_1.Mode.ForReading);
            expect(sdkConfig(sdk).credentials.accessKeyId).toEqual(uniq('access'));
            expect((await sdk.currentAccount()).accountId).toEqual(uniq('11111'));
            expect(sdk.currentRegion).toEqual('eu-bla-5');
        });
        test('passing profile skips EnvironmentCredentials', async () => {
            // GIVEN
            prepareCreds({
                fakeSts,
                credentials: {
                    foo: { aws_access_key_id: 'access', $account: '11111' },
                },
            });
            const provider = await providerFromProfile('foo');
            const environmentCredentialsPrototype = (new AWS.EnvironmentCredentials('AWS')).constructor.prototype;
            await util_1.withMocked(environmentCredentialsPrototype, 'refresh', async (refresh) => {
                var _a;
                refresh.mockImplementation((callback) => callback(new Error('This function should not have been called')));
                // WHEN
                expect((_a = (await provider.defaultAccount())) === null || _a === void 0 ? void 0 : _a.accountId).toEqual(uniq('11111'));
                expect(refresh).not.toHaveBeenCalled();
            });
        });
        test('supports profile spread over config_file and credentials_file', async () => {
            // WHEN
            prepareCreds({
                fakeSts,
                credentials: {
                    foo: { aws_access_key_id: 'fooccess', $account: '22222' },
                },
                config: {
                    'default': { region: 'eu-bla-5' },
                    'profile foo': { region: 'eu-west-1' },
                },
            });
            const provider = await aws_auth_1.SdkProvider.withAwsCliCompatibleDefaults({ ...defaultCredOptions, profile: 'foo' });
            // THEN
            expect(provider.defaultRegion).toEqual('eu-west-1');
            await expect(provider.defaultAccount()).resolves.toEqual({ accountId: uniq('22222'), partition: 'aws' });
            const sdk = await provider.forEnvironment(env(uniq('22222')), aws_auth_1.Mode.ForReading);
            expect(sdkConfig(sdk).credentials.accessKeyId).toEqual(uniq('fooccess'));
        });
        test('supports profile only in config_file', async () => {
            // WHEN
            prepareCreds({
                fakeSts,
                config: {
                    'default': { region: 'eu-bla-5' },
                    'profile foo': { aws_access_key_id: 'fooccess', $account: '22222' },
                },
            });
            const provider = await providerFromProfile('foo');
            // THEN
            expect(provider.defaultRegion).toEqual('eu-bla-5'); // Fall back to default config
            await expect(provider.defaultAccount()).resolves.toEqual({ accountId: uniq('22222'), partition: 'aws' });
            const sdk = await provider.forEnvironment(env(uniq('22222')), aws_auth_1.Mode.ForReading);
            expect(sdkConfig(sdk).credentials.accessKeyId).toEqual(uniq('fooccess'));
        });
        test('can assume-role configured in config', async () => {
            // GIVEN
            prepareCreds({
                fakeSts,
                credentials: {
                    assumer: { aws_access_key_id: 'assumer', $account: '11111' },
                },
                config: {
                    'default': { region: 'eu-bla-5' },
                    'profile assumer': { region: 'us-east-2' },
                    'profile assumable': {
                        role_arn: 'arn:aws:iam::66666:role/Assumable',
                        source_profile: 'assumer',
                        $account: '66666',
                        $fakeStsOptions: { allowedAccounts: ['11111'] },
                    },
                },
            });
            const provider = await providerFromProfile('assumable');
            // WHEN
            const sdk = await provider.forEnvironment(env(uniq('66666')), aws_auth_1.Mode.ForReading);
            // THEN
            expect((await sdk.currentAccount()).accountId).toEqual(uniq('66666'));
        });
        test('can assume role even if [default] profile is missing', async () => {
            var _a;
            // GIVEN
            prepareCreds({
                fakeSts,
                credentials: {
                    assumer: { aws_access_key_id: 'assumer', $account: '22222' },
                    assumable: { role_arn: 'arn:aws:iam::12356789012:role/Assumable', source_profile: 'assumer', $account: '22222' },
                },
                config: {
                    'profile assumable': { region: 'eu-bla-5' },
                },
            });
            // WHEN
            const provider = await providerFromProfile('assumable');
            // THEN
            expect((_a = (await provider.defaultAccount())) === null || _a === void 0 ? void 0 : _a.accountId).toEqual(uniq('22222'));
        });
        test('mfa_serial in profile will ask user for token', async () => {
            // GIVEN
            prepareCreds({
                fakeSts,
                credentials: {
                    assumer: { aws_access_key_id: 'assumer', $account: '66666' },
                },
                config: {
                    'default': { region: 'eu-bla-5' },
                    'profile assumer': { region: 'us-east-2' },
                    'profile mfa-role': {
                        role_arn: 'arn:aws:iam::66666:role/Assumable',
                        source_profile: 'assumer',
                        mfa_serial: 'arn:aws:iam::account:mfa/user',
                        $account: '66666',
                    },
                },
            });
            const provider = await providerFromProfile('mfa-role');
            const promptlyMockCalls = promptly.prompt.mock.calls.length;
            // THEN
            const sdk = await provider.forEnvironment(env(uniq('66666')), aws_auth_1.Mode.ForReading);
            expect((await sdk.currentAccount()).accountId).toEqual(uniq('66666'));
            expect(fakeSts.assumedRoles[0]).toEqual(expect.objectContaining({
                roleArn: 'arn:aws:iam::66666:role/Assumable',
                serialNumber: 'arn:aws:iam::account:mfa/user',
                tokenCode: '1234',
            }));
            // Mock response was set to fail to make sure we don't call STS
            // Make sure the MFA mock was called during this test
            expect(promptly.prompt.mock.calls.length).toBe(promptlyMockCalls + 1);
        });
    });
    // For DefaultSynthesis we will do an assume-role after having gotten base credentials
    describe('when CDK AssumeRoles', () => {
        beforeEach(() => {
            // All these tests share that 'arn:aws:role' is a role into account 88888 which can be assumed from 11111
            fakeSts.registerRole(uniq('88888'), 'arn:aws:role', { allowedAccounts: [uniq('11111')] });
        });
        test('error we get from assuming a role is useful', async () => {
            // GIVEN
            prepareCreds({
                fakeSts,
                config: {
                    default: { aws_access_key_id: 'foo' },
                },
            });
            const provider = await providerFromProfile(undefined);
            // WHEN
            const promise = provider.forEnvironment(env(uniq('88888')), aws_auth_1.Mode.ForReading, {
                assumeRoleArn: 'doesnotexist.role.arn',
            });
            // THEN - error message contains both a helpful hint and the underlying AssumeRole message
            await expect(promise).rejects.toThrow('did you bootstrap');
            await expect(promise).rejects.toThrow('doesnotexist.role.arn');
        });
        test('assuming a role sanitizes the username into the session name', async () => {
            // GIVEN
            prepareCreds({
                fakeSts,
                config: {
                    default: { aws_access_key_id: 'foo', $account: '11111' },
                },
            });
            await util_1.withMocked(os, 'userInfo', async (userInfo) => {
                userInfo.mockReturnValue({ username: 'skål', uid: 1, gid: 1, homedir: '/here', shell: '/bin/sh' });
                // WHEN
                const provider = await providerFromProfile(undefined);
                const sdk = await provider.forEnvironment(env(uniq('88888')), aws_auth_1.Mode.ForReading, { assumeRoleArn: 'arn:aws:role' });
                await sdk.currentAccount();
                // THEN
                expect(fakeSts.assumedRoles[0]).toEqual(expect.objectContaining({
                    roleSessionName: 'aws-cdk-sk@l',
                }));
            });
        });
        test('even if current credentials are for the wrong account, we will still use them to AssumeRole', async () => {
            // GIVEN
            prepareCreds({
                fakeSts,
                config: {
                    default: { aws_access_key_id: 'foo', $account: '11111' },
                },
            });
            const provider = await providerFromProfile(undefined);
            // WHEN
            const sdk = await provider.forEnvironment(env(uniq('88888')), aws_auth_1.Mode.ForReading, { assumeRoleArn: 'arn:aws:role' });
            // THEN
            expect((await sdk.currentAccount()).accountId).toEqual(uniq('88888'));
        });
        test('if AssumeRole fails but current credentials are for the right account, we will still use them', async () => {
            // GIVEN
            prepareCreds({
                fakeSts,
                config: {
                    default: { aws_access_key_id: 'foo', $account: '88888' },
                },
            });
            const provider = await providerFromProfile(undefined);
            // WHEN - assumeRole fails because the role can only be assumed from account 11111
            const sdk = await provider.forEnvironment(env(uniq('88888')), aws_auth_1.Mode.ForReading, { assumeRoleArn: 'arn:aws:role' });
            // THEN
            expect((await sdk.currentAccount()).accountId).toEqual(uniq('88888'));
        });
    });
    describe('Plugins', () => {
        test('does not use plugins if current credentials are for expected account', async () => {
            prepareCreds({
                fakeSts,
                config: {
                    default: { aws_access_key_id: 'foo', $account: '11111' },
                },
            });
            const provider = await providerFromProfile(undefined);
            await provider.forEnvironment(env(uniq('11111')), aws_auth_1.Mode.ForReading);
            expect(pluginQueried).toEqual(false);
        });
        test('uses plugin for account 99999', async () => {
            const provider = await providerFromProfile(undefined);
            await provider.forEnvironment(env(uniq('99999')), aws_auth_1.Mode.ForReading);
            expect(pluginQueried).toEqual(true);
        });
        test('can assume role with credentials from plugin', async () => {
            fakeSts.registerRole(uniq('99999'), 'arn:aws:iam::99999:role/Assumable');
            const provider = await providerFromProfile(undefined);
            await provider.forEnvironment(env(uniq('99999')), aws_auth_1.Mode.ForReading, {
                assumeRoleArn: 'arn:aws:iam::99999:role/Assumable',
            });
            expect(fakeSts.assumedRoles[0]).toEqual(expect.objectContaining({
                roleArn: 'arn:aws:iam::99999:role/Assumable',
            }));
            expect(pluginQueried).toEqual(true);
        });
        test('even if AssumeRole fails but current credentials are from a plugin, we will still use them', async () => {
            const provider = await providerFromProfile(undefined);
            const sdk = await provider.forEnvironment(env(uniq('99999')), aws_auth_1.Mode.ForReading, { assumeRoleArn: 'does:not:exist' });
            // THEN
            expect((await sdk.currentAccount()).accountId).toEqual(uniq('99999'));
        });
        test('plugins are still queried even if current credentials are expired (or otherwise invalid)', async () => {
            // GIVEN
            process.env.AWS_ACCESS_KEY_ID = `${uid}akid`;
            process.env.AWS_SECRET_ACCESS_KEY = 'sekrit';
            const provider = await providerFromProfile(undefined);
            // WHEN
            await provider.forEnvironment(env(uniq('99999')), aws_auth_1.Mode.ForReading);
            // THEN
            expect(pluginQueried).toEqual(true);
        });
    });
    describe('support for credential_source', () => {
        test('can assume role with ecs credentials', async () => {
            return util_1.withMocked(AWS.ECSCredentials.prototype, 'needsRefresh', async (needsRefresh) => {
                // GIVEN
                prepareCreds({
                    config: {
                        'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'EcsContainer', $account: '22222' },
                    },
                });
                const provider = await providerFromProfile('ecs');
                // WHEN
                await provider.defaultAccount();
                // THEN
                expect(needsRefresh).toHaveBeenCalled();
            });
        });
        test('can assume role with ec2 credentials', async () => {
            return util_1.withMocked(AWS.EC2MetadataCredentials.prototype, 'needsRefresh', async (needsRefresh) => {
                // GIVEN
                prepareCreds({
                    config: {
                        'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'Ec2InstanceMetadata', $account: '22222' },
                    },
                });
                const provider = await providerFromProfile('ecs');
                // WHEN
                await provider.defaultAccount();
                // THEN
                expect(needsRefresh).toHaveBeenCalled();
            });
        });
        test('can assume role with env credentials', async () => {
            return util_1.withMocked(AWS.EnvironmentCredentials.prototype, 'needsRefresh', async (needsRefresh) => {
                // GIVEN
                prepareCreds({
                    config: {
                        'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'Environment', $account: '22222' },
                    },
                });
                const provider = await providerFromProfile('ecs');
                // WHEN
                await provider.defaultAccount();
                // THEN
                expect(needsRefresh).toHaveBeenCalled();
            });
        });
        test('assume fails with unsupported credential_source', async () => {
            // GIVEN
            prepareCreds({
                config: {
                    'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'unsupported', $account: '22222' },
                },
            });
            const provider = await providerFromProfile('ecs');
            // WHEN
            const account = await provider.defaultAccount();
            // THEN
            expect(account === null || account === void 0 ? void 0 : account.accountId).toEqual(undefined);
        });
    });
    test('defaultAccount returns undefined if STS call fails', async () => {
        // GIVEN
        process.env.AWS_ACCESS_KEY_ID = `${uid}akid`;
        process.env.AWS_SECRET_ACCESS_KEY = 'sekrit';
        // WHEN
        const provider = await providerFromProfile(undefined);
        // THEN
        await expect(provider.defaultAccount()).resolves.toBe(undefined);
    });
});
test('even when using a profile to assume another profile, STS calls goes through the proxy', async () => {
    prepareCreds({
        credentials: {
            assumer: { aws_access_key_id: 'assumer' },
        },
        config: {
            'default': { region: 'eu-bla-5' },
            'profile assumable': { role_arn: 'arn:aws:iam::66666:role/Assumable', source_profile: 'assumer', $account: '66666' },
            'profile assumer': { region: 'us-east-2' },
        },
    });
    // Messy mocking
    let called = false;
    jest.mock('proxy-agent', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        class FakeAgent extends require('https').Agent {
            addRequest(_, __) {
                // FIXME: this error takes 6 seconds to be completely handled. It
                // might be retries in the SDK somewhere, or something about the Node
                // event loop. I've spent an hour trying to figure it out and I can't,
                // and I gave up. We'll just have to live with this until someone gets
                // inspired.
                const error = new Error('ABORTED BY TEST');
                error.code = 'RequestAbortedError';
                error.retryable = false;
                called = true;
                throw error;
            }
        }
        return FakeAgent;
    });
    // WHEN
    const provider = await aws_auth_1.SdkProvider.withAwsCliCompatibleDefaults({
        ...defaultCredOptions,
        profile: 'assumable',
        httpOptions: {
            proxyAddress: 'http://DOESNTMATTER/',
        },
    });
    await provider.defaultAccount();
    // THEN -- the fake proxy agent got called, we don't care about the result
    expect(called).toEqual(true);
});
/**
 * Use object hackery to get the credentials out of the SDK object
 */
function sdkConfig(sdk) {
    return sdk.config;
}
/**
 * Fixture for SDK auth for this test suite
 *
 * Has knowledge of the cache buster, will write proper fake config files and
 * register users and roles in FakeSts at the same time.
 */
function prepareCreds(options) {
    function convertSections(sections) {
        var _a, _b, _c, _d, _e, _f;
        const ret = [];
        for (const [profile, user] of Object.entries(sections !== null && sections !== void 0 ? sections : {})) {
            ret.push(`[${profile}]`);
            if (isProfileRole(user)) {
                ret.push(`role_arn=${user.role_arn}`);
                if ('source_profile' in user) {
                    ret.push(`source_profile=${user.source_profile}`);
                }
                if ('credential_source' in user) {
                    ret.push(`credential_source=${user.credential_source}`);
                }
                if (user.mfa_serial) {
                    ret.push(`mfa_serial=${user.mfa_serial}`);
                }
                (_a = options.fakeSts) === null || _a === void 0 ? void 0 : _a.registerRole(uniq((_b = user.$account) !== null && _b !== void 0 ? _b : '00000'), user.role_arn, {
                    ...user.$fakeStsOptions,
                    allowedAccounts: (_d = (_c = user.$fakeStsOptions) === null || _c === void 0 ? void 0 : _c.allowedAccounts) === null || _d === void 0 ? void 0 : _d.map(uniq),
                });
            }
            else {
                if (user.aws_access_key_id) {
                    ret.push(`aws_access_key_id=${uniq(user.aws_access_key_id)}`);
                    ret.push('aws_secret_access_key=secret');
                    (_e = options.fakeSts) === null || _e === void 0 ? void 0 : _e.registerUser(uniq((_f = user.$account) !== null && _f !== void 0 ? _f : '00000'), uniq(user.aws_access_key_id), user.$fakeStsOptions);
                }
            }
            if (user.region) {
                ret.push(`region=${user.region}`);
            }
        }
        return ret.join('\n');
    }
    bockfs({
        '/home/me/.bxt/credentials': convertSections(options.credentials),
        '/home/me/.bxt/config': convertSections(options.config),
    });
    // Set environment variables that we want
    process.env.AWS_CONFIG_FILE = bockfs.path('/home/me/.bxt/config');
    process.env.AWS_SHARED_CREDENTIALS_FILE = bockfs.path('/home/me/.bxt/credentials');
}
function isProfileRole(x) {
    return 'role_arn' in x;
}
function providerFromProfile(profile) {
    return aws_auth_1.SdkProvider.withAwsCliCompatibleDefaults({ ...defaultCredOptions, profile });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLXByb3ZpZGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZGstcHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHlCQUF5QjtBQUN6Qix5Q0FBeUM7QUFDekMsK0JBQStCO0FBRS9CLHFDQUFxQztBQUNyQyw2QkFBNkI7QUFDN0IsbUNBQXVDO0FBQ3ZDLHFEQUFzRTtBQUN0RSw2Q0FBNkM7QUFDN0Msb0NBQW9DO0FBQ3BDLGtDQUFxQztBQUNyQyx5Q0FBK0U7QUFFL0UsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUMzQixNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQztDQUM1QyxDQUFDLENBQUMsQ0FBQztBQUVKLE1BQU0sa0JBQWtCLEdBQUc7SUFDekIsUUFBUSxFQUFFLEtBQUs7SUFDZixjQUFjLEVBQUUsS0FBSztDQUN0QixDQUFDO0FBRUYsSUFBSSxHQUFXLENBQUM7QUFDaEIsSUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDO0FBRTFCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxpQkFBaUI7SUFDakIsMkNBQTJDO0lBQzNDLEVBQUU7SUFDRixpREFBaUQ7SUFDakQsK0NBQStDO0lBQy9DLEdBQUcsR0FBRyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO0lBRXZCLE9BQU8sQ0FBQyxXQUFXLGVBQXdCLENBQUM7SUFFNUMsZ0JBQVUsQ0FBQyxRQUFRLENBQUMseUJBQXlCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hELGdCQUFVLENBQUMsUUFBUSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQztRQUNqRCxXQUFXLEtBQUssT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvQyxxQkFBcUIsQ0FBQyxPQUFPLElBQUksT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckYsV0FBVztZQUNULGFBQWEsR0FBRyxJQUFJLENBQUM7WUFDckIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLFdBQVcsQ0FBQztnQkFDekMsV0FBVyxFQUFFLEdBQUcsR0FBRyxZQUFZO2dCQUMvQixlQUFlLEVBQUUsZUFBZTtnQkFDaEMsWUFBWSxFQUFFLGNBQWM7YUFDN0IsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDO1FBQ0QsSUFBSSxFQUFFLGFBQWE7S0FDcEIsQ0FBQyxDQUFDO0lBRUgsd0VBQXdFO0lBQ3hFLDJFQUEyRTtJQUMzRSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsR0FBRyxXQUFXLENBQUM7SUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsR0FBRyxXQUFXLENBQUM7QUFDeEQsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLENBQUMsR0FBRyxFQUFFO0lBQ2IsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ25CLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxJQUFJLENBQUMsT0FBZTtJQUMzQixPQUFPLEdBQUcsR0FBRyxHQUFHLE9BQU8sRUFBRSxDQUFDO0FBQzVCLENBQUM7QUFFRCxTQUFTLEdBQUcsQ0FBQyxPQUFlO0lBQzFCLE9BQU8sS0FBSyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDckQsQ0FBQztBQUVELFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSxHQUFHLEVBQUU7SUFDOUMsNEVBQTRFO0lBQzVFLHVDQUF1QztJQUV2QyxJQUFJLE9BQWdCLENBQUM7SUFDckIsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLE9BQU8sR0FBRyxJQUFJLGtCQUFPLEVBQUUsQ0FBQztRQUN4QixPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFaEIsMkRBQTJEO1FBQzNELE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUMsQ0FBQyxDQUFDO0lBRUgsU0FBUyxDQUFDLEdBQUcsRUFBRTtRQUNiLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNwQixDQUFDLENBQUMsQ0FBQztJQUVILDBEQUEwRDtJQUMxRCw0Q0FBNEM7SUFDNUMsUUFBUSxDQUFDLDhCQUE4QixFQUFFLEdBQUcsRUFBRTtRQUM1QyxJQUFJLENBQUMscUNBQXFDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDckQsT0FBTztZQUNQLFlBQVksQ0FBQztnQkFDWCxPQUFPO2dCQUNQLFdBQVcsRUFBRTtvQkFDWCxPQUFPLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLEVBQUU7aUJBQ3hHO2dCQUNELE1BQU0sRUFBRTtvQkFDTixPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFO2lCQUNoQzthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFdEQsT0FBTztZQUNQLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ25ELE1BQU0sTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBRTlHLDZCQUE2QjtZQUM3QixNQUFNLEdBQUcsR0FBRyxNQUFNLFFBQVEsQ0FBQyxjQUFjLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUUsZUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3JHLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsV0FBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUN4RSxNQUFNLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw2REFBNkQsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM3RSxPQUFPO1lBQ1AsWUFBWSxDQUFDO2dCQUNYLE9BQU87Z0JBQ1AsTUFBTSxFQUFFO29CQUNOLGFBQWEsRUFBRSxFQUFFLGlCQUFpQixFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO2lCQUNsRTthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFbEQsTUFBTSxNQUFNLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsRUFBRSxlQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDbkksQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbURBQW1ELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDbkUsT0FBTztZQUNQLFlBQVksQ0FBQztnQkFDWCxPQUFPO2dCQUNQLFdBQVcsRUFBRTtvQkFDWCxPQUFPLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtpQkFDNUQ7Z0JBQ0QsTUFBTSxFQUFFO29CQUNOLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUU7aUJBQ2hDO2FBQ0YsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxRQUFRLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUV0RCxPQUFPO1lBQ1AsTUFBTSxHQUFHLEdBQUcsTUFBTSxRQUFRLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsY0FBYyxDQUFDLEVBQUUsZUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3JJLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsV0FBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUN4RSxNQUFNLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0RSxNQUFNLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw4Q0FBOEMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM5RCxRQUFRO1lBQ1IsWUFBWSxDQUFDO2dCQUNYLE9BQU87Z0JBQ1AsV0FBVyxFQUFFO29CQUNYLEdBQUcsRUFBRSxFQUFFLGlCQUFpQixFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO2lCQUN4RDthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFbEQsTUFBTSwrQkFBK0IsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQztZQUV0RyxNQUFNLGlCQUFVLENBQUMsK0JBQStCLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRTs7Z0JBQzdFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLFFBQStCLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFbEksT0FBTztnQkFDUCxNQUFNLE9BQUMsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQywwQ0FBRSxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBRTVFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN6QyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLCtEQUErRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQy9FLE9BQU87WUFDUCxZQUFZLENBQUM7Z0JBQ1gsT0FBTztnQkFDUCxXQUFXLEVBQUU7b0JBQ1gsR0FBRyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7aUJBQzFEO2dCQUNELE1BQU0sRUFBRTtvQkFDTixTQUFTLEVBQUUsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFO29CQUNqQyxhQUFhLEVBQUUsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO2lCQUN2QzthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sc0JBQVcsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLEdBQUcsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFFM0csT0FBTztZQUNQLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3BELE1BQU0sTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBRXpHLE1BQU0sR0FBRyxHQUFHLE1BQU0sUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsZUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQy9FLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsV0FBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN0RCxPQUFPO1lBQ1AsWUFBWSxDQUFDO2dCQUNYLE9BQU87Z0JBQ1AsTUFBTSxFQUFFO29CQUNOLFNBQVMsRUFBRSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUU7b0JBQ2pDLGFBQWEsRUFBRSxFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO2lCQUNwRTthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFbEQsT0FBTztZQUNQLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsOEJBQThCO1lBQ2xGLE1BQU0sTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBRXpHLE1BQU0sR0FBRyxHQUFHLE1BQU0sUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsZUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQy9FLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsV0FBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN0RCxRQUFRO1lBQ1IsWUFBWSxDQUFDO2dCQUNYLE9BQU87Z0JBQ1AsV0FBVyxFQUFFO29CQUNYLE9BQU8sRUFBRSxFQUFFLGlCQUFpQixFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO2lCQUM3RDtnQkFDRCxNQUFNLEVBQUU7b0JBQ04sU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRTtvQkFDakMsaUJBQWlCLEVBQUUsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO29CQUMxQyxtQkFBbUIsRUFBRTt3QkFDbkIsUUFBUSxFQUFFLG1DQUFtQzt3QkFDN0MsY0FBYyxFQUFFLFNBQVM7d0JBQ3pCLFFBQVEsRUFBRSxPQUFPO3dCQUNqQixlQUFlLEVBQUUsRUFBRSxlQUFlLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRTtxQkFDaEQ7aUJBQ0Y7YUFDRixDQUFDLENBQUM7WUFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBRXhELE9BQU87WUFDUCxNQUFNLEdBQUcsR0FBRyxNQUFNLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLGVBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUUvRSxPQUFPO1lBQ1AsTUFBTSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDeEUsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsc0RBQXNELEVBQUUsS0FBSyxJQUFJLEVBQUU7O1lBQ3RFLFFBQVE7WUFDUixZQUFZLENBQUM7Z0JBQ1gsT0FBTztnQkFDUCxXQUFXLEVBQUU7b0JBQ1gsT0FBTyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7b0JBQzVELFNBQVMsRUFBRSxFQUFFLFFBQVEsRUFBRSx5Q0FBeUMsRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7aUJBQ2pIO2dCQUNELE1BQU0sRUFBRTtvQkFDTixtQkFBbUIsRUFBRSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUU7aUJBQzVDO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsT0FBTztZQUNQLE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUM7WUFFeEQsT0FBTztZQUNQLE1BQU0sT0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDLDBDQUFFLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywrQ0FBK0MsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMvRCxRQUFRO1lBQ1IsWUFBWSxDQUFDO2dCQUNYLE9BQU87Z0JBQ1AsV0FBVyxFQUFFO29CQUNYLE9BQU8sRUFBRSxFQUFFLGlCQUFpQixFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO2lCQUM3RDtnQkFDRCxNQUFNLEVBQUU7b0JBQ04sU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRTtvQkFDakMsaUJBQWlCLEVBQUUsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO29CQUMxQyxrQkFBa0IsRUFBRTt3QkFDbEIsUUFBUSxFQUFFLG1DQUFtQzt3QkFDN0MsY0FBYyxFQUFFLFNBQVM7d0JBQ3pCLFVBQVUsRUFBRSwrQkFBK0I7d0JBQzNDLFFBQVEsRUFBRSxPQUFPO3FCQUNsQjtpQkFDRjthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFdkQsTUFBTSxpQkFBaUIsR0FBSSxRQUFRLENBQUMsTUFBb0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztZQUUzRSxPQUFPO1lBQ1AsTUFBTSxHQUFHLEdBQUcsTUFBTSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxlQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDL0UsTUFBTSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdEUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO2dCQUM5RCxPQUFPLEVBQUUsbUNBQW1DO2dCQUM1QyxZQUFZLEVBQUUsK0JBQStCO2dCQUM3QyxTQUFTLEVBQUUsTUFBTTthQUNsQixDQUFDLENBQUMsQ0FBQztZQUVKLCtEQUErRDtZQUMvRCxxREFBcUQ7WUFDckQsTUFBTSxDQUFFLFFBQVEsQ0FBQyxNQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxzRkFBc0Y7SUFDdEYsUUFBUSxDQUFDLHNCQUFzQixFQUFFLEdBQUcsRUFBRTtRQUNwQyxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ2QseUdBQXlHO1lBQ3pHLE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLGNBQWMsRUFBRSxFQUFFLGVBQWUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM1RixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw2Q0FBNkMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM3RCxRQUFRO1lBQ1IsWUFBWSxDQUFDO2dCQUNYLE9BQU87Z0JBQ1AsTUFBTSxFQUFFO29CQUNOLE9BQU8sRUFBRSxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRTtpQkFDdEM7YUFDRixDQUFDLENBQUM7WUFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRXRELE9BQU87WUFDUCxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxlQUFJLENBQUMsVUFBVSxFQUFFO2dCQUMzRSxhQUFhLEVBQUUsdUJBQXVCO2FBQ3ZDLENBQUMsQ0FBQztZQUVILDBGQUEwRjtZQUMxRixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDM0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ2pFLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDhEQUE4RCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzlFLFFBQVE7WUFDUixZQUFZLENBQUM7Z0JBQ1gsT0FBTztnQkFDUCxNQUFNLEVBQUU7b0JBQ04sT0FBTyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7aUJBQ3pEO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsTUFBTSxpQkFBVSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFO2dCQUNsRCxRQUFRLENBQUMsZUFBZSxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztnQkFFbkcsT0FBTztnQkFDUCxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUV0RCxNQUFNLEdBQUcsR0FBRyxNQUFNLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLGVBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLENBQVEsQ0FBQztnQkFDekgsTUFBTSxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBRTNCLE9BQU87Z0JBQ1AsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO29CQUM5RCxlQUFlLEVBQUUsY0FBYztpQkFDaEMsQ0FBQyxDQUFDLENBQUM7WUFDTixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDZGQUE2RixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzdHLFFBQVE7WUFDUixZQUFZLENBQUM7Z0JBQ1gsT0FBTztnQkFDUCxNQUFNLEVBQUU7b0JBQ04sT0FBTyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7aUJBQ3pEO2FBQ0YsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxRQUFRLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUV0RCxPQUFPO1lBQ1AsTUFBTSxHQUFHLEdBQUcsTUFBTSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxlQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxDQUFRLENBQUM7WUFFekgsT0FBTztZQUNQLE1BQU0sQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3hFLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLCtGQUErRixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQy9HLFFBQVE7WUFDUixZQUFZLENBQUM7Z0JBQ1gsT0FBTztnQkFDUCxNQUFNLEVBQUU7b0JBQ04sT0FBTyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7aUJBQ3pEO2FBQ0YsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxRQUFRLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUV0RCxrRkFBa0Y7WUFDbEYsTUFBTSxHQUFHLEdBQUcsTUFBTSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxlQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxDQUFRLENBQUM7WUFFekgsT0FBTztZQUNQLE1BQU0sQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3hFLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRTtRQUN2QixJQUFJLENBQUMsc0VBQXNFLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDdEYsWUFBWSxDQUFDO2dCQUNYLE9BQU87Z0JBQ1AsTUFBTSxFQUFFO29CQUNOLE9BQU8sRUFBRSxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO2lCQUN6RDthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDdEQsTUFBTSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxlQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbkUsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywrQkFBK0IsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMvQyxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsZUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ25FLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsOENBQThDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDOUQsT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsbUNBQW1DLENBQUMsQ0FBQztZQUV6RSxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsZUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDakUsYUFBYSxFQUFFLG1DQUFtQzthQUNuRCxDQUFDLENBQUM7WUFFSCxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7Z0JBQzlELE9BQU8sRUFBRSxtQ0FBbUM7YUFDN0MsQ0FBQyxDQUFDLENBQUM7WUFDSixNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDRGQUE0RixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzVHLE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDdEQsTUFBTSxHQUFHLEdBQUcsTUFBTSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxlQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsYUFBYSxFQUFFLGdCQUFnQixFQUFFLENBQUMsQ0FBQztZQUVwSCxPQUFPO1lBQ1AsTUFBTSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDeEUsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsMEZBQTBGLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDMUcsUUFBUTtZQUNSLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEdBQUcsR0FBRyxHQUFHLE1BQU0sQ0FBQztZQUM3QyxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixHQUFHLFFBQVEsQ0FBQztZQUM3QyxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRXRELE9BQU87WUFDUCxNQUFNLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLGVBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUVuRSxPQUFPO1lBQ1AsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLCtCQUErQixFQUFFLEdBQUcsRUFBRTtRQUM3QyxJQUFJLENBQUMsc0NBQXNDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDdEQsT0FBTyxpQkFBVSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLEVBQUU7Z0JBQ3JGLFFBQVE7Z0JBQ1IsWUFBWSxDQUFDO29CQUNYLE1BQU0sRUFBRTt3QkFDTixhQUFhLEVBQUUsRUFBRSxRQUFRLEVBQUUseUNBQXlDLEVBQUUsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7cUJBQzdIO2lCQUNGLENBQUMsQ0FBQztnQkFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUVsRCxPQUFPO2dCQUNQLE1BQU0sUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUVoQyxPQUFPO2dCQUNQLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzFDLENBQUMsQ0FBQyxDQUFDO1FBRUwsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsc0NBQXNDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDdEQsT0FBTyxpQkFBVSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsRUFBRTtnQkFDN0YsUUFBUTtnQkFDUixZQUFZLENBQUM7b0JBQ1gsTUFBTSxFQUFFO3dCQUNOLGFBQWEsRUFBRSxFQUFFLFFBQVEsRUFBRSx5Q0FBeUMsRUFBRSxpQkFBaUIsRUFBRSxxQkFBcUIsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO3FCQUNwSTtpQkFDRixDQUFDLENBQUM7Z0JBQ0gsTUFBTSxRQUFRLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFFbEQsT0FBTztnQkFDUCxNQUFNLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFFaEMsT0FBTztnQkFDUCxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUUxQyxDQUFDLENBQUMsQ0FBQztRQUVMLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNDQUFzQyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3RELE9BQU8saUJBQVUsQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLEVBQUU7Z0JBQzdGLFFBQVE7Z0JBQ1IsWUFBWSxDQUFDO29CQUNYLE1BQU0sRUFBRTt3QkFDTixhQUFhLEVBQUUsRUFBRSxRQUFRLEVBQUUseUNBQXlDLEVBQUUsaUJBQWlCLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7cUJBQzVIO2lCQUNGLENBQUMsQ0FBQztnQkFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUVsRCxPQUFPO2dCQUNQLE1BQU0sUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUVoQyxPQUFPO2dCQUNQLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsaURBQWlELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDakUsUUFBUTtZQUNSLFlBQVksQ0FBQztnQkFDWCxNQUFNLEVBQUU7b0JBQ04sYUFBYSxFQUFFLEVBQUUsUUFBUSxFQUFFLHlDQUF5QyxFQUFFLGlCQUFpQixFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO2lCQUM1SDthQUNGLENBQUMsQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFbEQsT0FBTztZQUNQLE1BQU0sT0FBTyxHQUFHLE1BQU0sUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRWhELE9BQU87WUFDUCxNQUFNLENBQUMsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG9EQUFvRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3BFLFFBQVE7UUFDUixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixHQUFHLEdBQUcsR0FBRyxNQUFNLENBQUM7UUFDN0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsR0FBRyxRQUFRLENBQUM7UUFFN0MsT0FBTztRQUNQLE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFdEQsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbkUsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyx1RkFBdUYsRUFBRSxLQUFLLElBQUksRUFBRTtJQUN2RyxZQUFZLENBQUM7UUFDWCxXQUFXLEVBQUU7WUFDWCxPQUFPLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUU7U0FDMUM7UUFDRCxNQUFNLEVBQUU7WUFDTixTQUFTLEVBQUUsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFO1lBQ2pDLG1CQUFtQixFQUFFLEVBQUUsUUFBUSxFQUFFLG1DQUFtQyxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtZQUNwSCxpQkFBaUIsRUFBRSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUU7U0FDM0M7S0FDRixDQUFDLENBQUM7SUFFSCxnQkFBZ0I7SUFDaEIsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO0lBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEdBQUcsRUFBRTtRQUM1QixpRUFBaUU7UUFDakUsTUFBTSxTQUFVLFNBQVEsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUs7WUFDckMsVUFBVSxDQUFDLENBQU0sRUFBRSxFQUFPO2dCQUMvQixpRUFBaUU7Z0JBQ2pFLHFFQUFxRTtnQkFDckUsc0VBQXNFO2dCQUN0RSxzRUFBc0U7Z0JBQ3RFLFlBQVk7Z0JBQ1osTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztnQkFDMUMsS0FBYSxDQUFDLElBQUksR0FBRyxxQkFBcUIsQ0FBQztnQkFDM0MsS0FBYSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7Z0JBQ2pDLE1BQU0sR0FBRyxJQUFJLENBQUM7Z0JBQ2QsTUFBTSxLQUFLLENBQUM7WUFDZCxDQUFDO1NBQ0Y7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDLENBQUMsQ0FBQztJQUVILE9BQU87SUFDUCxNQUFNLFFBQVEsR0FBRyxNQUFNLHNCQUFXLENBQUMsNEJBQTRCLENBQUM7UUFDOUQsR0FBRyxrQkFBa0I7UUFDckIsT0FBTyxFQUFFLFdBQVc7UUFDcEIsV0FBVyxFQUFFO1lBQ1gsWUFBWSxFQUFFLHNCQUFzQjtTQUNyQztLQUNGLENBQUMsQ0FBQztJQUVILE1BQU0sUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBRWhDLDBFQUEwRTtJQUMxRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9CLENBQUMsQ0FBQyxDQUFDO0FBRUg7O0dBRUc7QUFDSCxTQUFTLFNBQVMsQ0FBQyxHQUFTO0lBQzFCLE9BQVEsR0FBVyxDQUFDLE1BQU0sQ0FBQztBQUM3QixDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLFlBQVksQ0FBQyxPQUE0QjtJQUNoRCxTQUFTLGVBQWUsQ0FBQyxRQUFvRDs7UUFDM0UsTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDO1FBQ2YsS0FBSyxNQUFNLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxhQUFSLFFBQVEsY0FBUixRQUFRLEdBQUksRUFBRSxDQUFDLEVBQUU7WUFDNUQsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7WUFFekIsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3ZCLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDdEMsSUFBSSxnQkFBZ0IsSUFBSSxJQUFJLEVBQUU7b0JBQzVCLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO2lCQUNuRDtnQkFDRCxJQUFJLG1CQUFtQixJQUFJLElBQUksRUFBRTtvQkFDL0IsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztpQkFDekQ7Z0JBQ0QsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO29CQUNuQixHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7aUJBQzNDO2dCQUNELE1BQUEsT0FBTyxDQUFDLE9BQU8sMENBQUUsWUFBWSxDQUFDLElBQUksT0FBQyxJQUFJLENBQUMsUUFBUSxtQ0FBSSxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFO29CQUMzRSxHQUFHLElBQUksQ0FBQyxlQUFlO29CQUN2QixlQUFlLGNBQUUsSUFBSSxDQUFDLGVBQWUsMENBQUUsZUFBZSwwQ0FBRSxHQUFHLENBQUMsSUFBSSxDQUFDO2lCQUNsRSxFQUFFO2FBQ0o7aUJBQU07Z0JBQ0wsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUU7b0JBQzFCLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQzlELEdBQUcsQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztvQkFDekMsTUFBQSxPQUFPLENBQUMsT0FBTywwQ0FBRSxZQUFZLENBQUMsSUFBSSxPQUFDLElBQUksQ0FBQyxRQUFRLG1DQUFJLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFO2lCQUNuSDthQUNGO1lBRUQsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQzthQUNuQztTQUNGO1FBQ0QsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxNQUFNLENBQUM7UUFDTCwyQkFBMkIsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUNqRSxzQkFBc0IsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztLQUN4RCxDQUFDLENBQUM7SUFFSCx5Q0FBeUM7SUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ2xFLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkJBQTJCLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0FBQ3JGLENBQUM7QUFrQ0QsU0FBUyxhQUFhLENBQUMsQ0FBNEI7SUFDakQsT0FBTyxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQ3pCLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLE9BQTJCO0lBQ3RELE9BQU8sc0JBQVcsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLEdBQUcsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcbmltcG9ydCB0eXBlIHsgQ29uZmlndXJhdGlvbk9wdGlvbnMgfSBmcm9tICdhd3Mtc2RrL2xpYi9jb25maWctYmFzZSc7XG5pbXBvcnQgKiBhcyBwcm9tcHRseSBmcm9tICdwcm9tcHRseSc7XG5pbXBvcnQgKiBhcyB1dWlkIGZyb20gJ3V1aWQnO1xuaW1wb3J0IHsgUGx1Z2luSG9zdCB9IGZyb20gJy4uLy4uL2xpYic7XG5pbXBvcnQgeyBJU0RLLCBNb2RlLCBTREssIFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vLi4vbGliL2FwaS9hd3MtYXV0aCc7XG5pbXBvcnQgKiBhcyBsb2dnaW5nIGZyb20gJy4uLy4uL2xpYi9sb2dnaW5nJztcbmltcG9ydCAqIGFzIGJvY2tmcyBmcm9tICcuLi9ib2NrZnMnO1xuaW1wb3J0IHsgd2l0aE1vY2tlZCB9IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHsgRmFrZVN0cywgUmVnaXN0ZXJSb2xlT3B0aW9ucywgUmVnaXN0ZXJVc2VyT3B0aW9ucyB9IGZyb20gJy4vZmFrZS1zdHMnO1xuXG5qZXN0Lm1vY2soJ3Byb21wdGx5JywgKCkgPT4gKHtcbiAgcHJvbXB0OiBqZXN0LmZuKCkubW9ja1Jlc29sdmVkVmFsdWUoJzEyMzQnKSxcbn0pKTtcblxuY29uc3QgZGVmYXVsdENyZWRPcHRpb25zID0ge1xuICBlYzJjcmVkczogZmFsc2UsXG4gIGNvbnRhaW5lckNyZWRzOiBmYWxzZSxcbn07XG5cbmxldCB1aWQ6IHN0cmluZztcbmxldCBwbHVnaW5RdWVyaWVkID0gZmFsc2U7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICAvLyBDYWNoZSBidXN0ZXJzIVxuICAvLyBXZSBwcmVmaXggZXZlcnl0aGluZyB3aXRoIFVVSURzIGJlY2F1c2U6XG4gIC8vXG4gIC8vIC0gV2UgaGF2ZSBhIGNhY2hlIGZyb20gYWNjb3VudCMgLT4gY3JlZGVudGlhbHNcbiAgLy8gLSBXZSBoYXZlIGEgY2FjaGUgZnJvbSBhY2Nlc3Mga2V5IC0+IGFjY291bnRcbiAgdWlkID0gYCgke3V1aWQudjQoKX0pYDtcblxuICBsb2dnaW5nLnNldExvZ0xldmVsKGxvZ2dpbmcuTG9nTGV2ZWwuVFJBQ0UpO1xuXG4gIFBsdWdpbkhvc3QuaW5zdGFuY2UuY3JlZGVudGlhbFByb3ZpZGVyU291cmNlcy5zcGxpY2UoMCk7XG4gIFBsdWdpbkhvc3QuaW5zdGFuY2UuY3JlZGVudGlhbFByb3ZpZGVyU291cmNlcy5wdXNoKHtcbiAgICBpc0F2YWlsYWJsZSgpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTsgfSxcbiAgICBjYW5Qcm92aWRlQ3JlZGVudGlhbHMoYWNjb3VudCkgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGFjY291bnQgPT09IHVuaXEoJzk5OTk5JykpOyB9LFxuICAgIGdldFByb3ZpZGVyKCkge1xuICAgICAgcGx1Z2luUXVlcmllZCA9IHRydWU7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBBV1MuQ3JlZGVudGlhbHMoe1xuICAgICAgICBhY2Nlc3NLZXlJZDogYCR7dWlkfXBsdWdpbl9rZXlgLFxuICAgICAgICBzZWNyZXRBY2Nlc3NLZXk6ICdwbHVnaW5fc2VjcmV0JyxcbiAgICAgICAgc2Vzc2lvblRva2VuOiAncGx1Z2luX3Rva2VuJyxcbiAgICAgIH0pKTtcbiAgICB9LFxuICAgIG5hbWU6ICd0ZXN0IHBsdWdpbicsXG4gIH0pO1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGVzZSBwb2ludCB0byBub25leGlzdGFudCBmaWxlcyB0byBzdGFydCwgaWYgd2UgZG9uJ3QgY2FsbFxuICAvLyBwcmVwYXJlKCkgdGhlbiB3ZSBkb24ndCBhY2NpZGVudGFsbHkgd2FudCB0byBmYWxsIGJhY2sgdG8gc3lzdGVtIGNvbmZpZy5cbiAgcHJvY2Vzcy5lbnYuQVdTX0NPTkZJR19GSUxFID0gJy9kZXYvbnVsbCc7XG4gIHByb2Nlc3MuZW52LkFXU19TSEFSRURfQ1JFREVOVElBTFNfRklMRSA9ICcvZGV2L251bGwnO1xufSk7XG5cbmFmdGVyRWFjaCgoKSA9PiB7XG4gIGJvY2tmcy5yZXN0b3JlKCk7XG59KTtcblxuZnVuY3Rpb24gdW5pcShhY2NvdW50OiBzdHJpbmcpIHtcbiAgcmV0dXJuIGAke3VpZH0ke2FjY291bnR9YDtcbn1cblxuZnVuY3Rpb24gZW52KGFjY291bnQ6IHN0cmluZykge1xuICByZXR1cm4gY3hhcGkuRW52aXJvbm1lbnRVdGlscy5tYWtlKGFjY291bnQsICdkZWYnKTtcbn1cblxuZGVzY3JpYmUoJ3dpdGggaW50ZXJjZXB0ZWQgbmV0d29yayBjYWxscycsICgpID0+IHtcbiAgLy8gTW9zdCB0ZXN0cyB3aWxsIHVzZSBpbnRlcmNlcHRlZCBuZXR3b3JrIGNhbGxzLCBleGNlcHQgb25lIHRlc3QgdGhhdCB0ZXN0c1xuICAvLyB0aGF0IHRoZSByaWdodCBIVFRQIGBBZ2VudGAgaXMgdXNlZC5cblxuICBsZXQgZmFrZVN0czogRmFrZVN0cztcbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgZmFrZVN0cyA9IG5ldyBGYWtlU3RzKCk7XG4gICAgZmFrZVN0cy5iZWdpbigpO1xuXG4gICAgLy8gTWFrZSBzdXJlIHRoZSBLZXlJRCByZXR1cm5lZCBieSB0aGUgcGx1Z2luIGlzIHJlY29nbml6ZWRcbiAgICBmYWtlU3RzLnJlZ2lzdGVyVXNlcih1bmlxKCc5OTk5OScpLCB1bmlxKCdwbHVnaW5fa2V5JykpO1xuICB9KTtcblxuICBhZnRlckVhY2goKCkgPT4ge1xuICAgIGZha2VTdHMucmVzdG9yZSgpO1xuICB9KTtcblxuICAvLyBTZXQgb2YgdGVzdHMgd2hlcmUgdGhlIENESyB3aWxsIG5vdCB0cmlnZ2VyIGFzc3VtZS1yb2xlXG4gIC8vICh0aGUgSU5JIGZpbGUgbWlnaHQgc3RpbGwgZG8gYXNzdW1lLXJvbGUpXG4gIGRlc2NyaWJlKCd3aGVuIENESyBkb2VzIG5vdCBBc3N1bWVSb2xlJywgKCkgPT4ge1xuICAgIHRlc3QoJ3VzZXMgZGVmYXVsdCBjcmVkZW50aWFscyBieSBkZWZhdWx0JywgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gV0hFTlxuICAgICAgcHJlcGFyZUNyZWRzKHtcbiAgICAgICAgZmFrZVN0cyxcbiAgICAgICAgY3JlZGVudGlhbHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiB7IGF3c19hY2Nlc3Nfa2V5X2lkOiAnYWNjZXNzJywgJGFjY291bnQ6ICcxMTExMScsICRmYWtlU3RzT3B0aW9uczogeyBwYXJ0aXRpb246ICdhd3MtaGVyZScgfSB9LFxuICAgICAgICB9LFxuICAgICAgICBjb25maWc6IHtcbiAgICAgICAgICBkZWZhdWx0OiB7IHJlZ2lvbjogJ2V1LWJsYS01JyB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUodW5kZWZpbmVkKTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KHByb3ZpZGVyLmRlZmF1bHRSZWdpb24pLnRvRXF1YWwoJ2V1LWJsYS01Jyk7XG4gICAgICBhd2FpdCBleHBlY3QocHJvdmlkZXIuZGVmYXVsdEFjY291bnQoKSkucmVzb2x2ZXMudG9FcXVhbCh7IGFjY291bnRJZDogdW5pcSgnMTExMTEnKSwgcGFydGl0aW9uOiAnYXdzLWhlcmUnIH0pO1xuXG4gICAgICAvLyBBc2sgZm9yIGEgZGlmZmVyZW50IHJlZ2lvblxuICAgICAgY29uc3Qgc2RrID0gYXdhaXQgcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoeyAuLi5lbnYodW5pcSgnMTExMTEnKSksIHJlZ2lvbjogJ3JnbicgfSwgTW9kZS5Gb3JSZWFkaW5nKTtcbiAgICAgIGV4cGVjdChzZGtDb25maWcoc2RrKS5jcmVkZW50aWFscyEuYWNjZXNzS2V5SWQpLnRvRXF1YWwodW5pcSgnYWNjZXNzJykpO1xuICAgICAgZXhwZWN0KHNkay5jdXJyZW50UmVnaW9uKS50b0VxdWFsKCdyZ24nKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ3Rocm93cyBpZiBwcm9maWxlIGNyZWRlbnRpYWxzIGFyZSBub3QgZm9yIHRoZSByaWdodCBhY2NvdW50JywgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gV0hFTlxuICAgICAgcHJlcGFyZUNyZWRzKHtcbiAgICAgICAgZmFrZVN0cyxcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgJ3Byb2ZpbGUgYm9vJzogeyBhd3NfYWNjZXNzX2tleV9pZDogJ2FjY2VzcycsICRhY2NvdW50OiAnMTExMTEnIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSgnYm9vJyk7XG5cbiAgICAgIGF3YWl0IGV4cGVjdChwcm92aWRlci5mb3JFbnZpcm9ubWVudChlbnYodW5pcSgnc29tZV9hY2NvdW50XyMnKSksIE1vZGUuRm9yUmVhZGluZykpLnJlamVjdHMudG9UaHJvdygnTmVlZCB0byBwZXJmb3JtIEFXUyBjYWxscycpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndXNlIHByb2ZpbGUgYWNjdC9yZWdpb24gaWYgYWdub3N0aWMgZW52IHJlcXVlc3RlZCcsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIFdIRU5cbiAgICAgIHByZXBhcmVDcmVkcyh7XG4gICAgICAgIGZha2VTdHMsXG4gICAgICAgIGNyZWRlbnRpYWxzOiB7XG4gICAgICAgICAgZGVmYXVsdDogeyBhd3NfYWNjZXNzX2tleV9pZDogJ2FjY2VzcycsICRhY2NvdW50OiAnMTExMTEnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgIGRlZmF1bHQ6IHsgcmVnaW9uOiAnZXUtYmxhLTUnIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSh1bmRlZmluZWQpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBjb25zdCBzZGsgPSBhd2FpdCBwcm92aWRlci5mb3JFbnZpcm9ubWVudChjeGFwaS5FbnZpcm9ubWVudFV0aWxzLm1ha2UoY3hhcGkuVU5LTk9XTl9BQ0NPVU5ULCBjeGFwaS5VTktOT1dOX1JFR0lPTiksIE1vZGUuRm9yUmVhZGluZyk7XG4gICAgICBleHBlY3Qoc2RrQ29uZmlnKHNkaykuY3JlZGVudGlhbHMhLmFjY2Vzc0tleUlkKS50b0VxdWFsKHVuaXEoJ2FjY2VzcycpKTtcbiAgICAgIGV4cGVjdCgoYXdhaXQgc2RrLmN1cnJlbnRBY2NvdW50KCkpLmFjY291bnRJZCkudG9FcXVhbCh1bmlxKCcxMTExMScpKTtcbiAgICAgIGV4cGVjdChzZGsuY3VycmVudFJlZ2lvbikudG9FcXVhbCgnZXUtYmxhLTUnKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ3Bhc3NpbmcgcHJvZmlsZSBza2lwcyBFbnZpcm9ubWVudENyZWRlbnRpYWxzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHByZXBhcmVDcmVkcyh7XG4gICAgICAgIGZha2VTdHMsXG4gICAgICAgIGNyZWRlbnRpYWxzOiB7XG4gICAgICAgICAgZm9vOiB7IGF3c19hY2Nlc3Nfa2V5X2lkOiAnYWNjZXNzJywgJGFjY291bnQ6ICcxMTExMScgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcHJvdmlkZXIgPSBhd2FpdCBwcm92aWRlckZyb21Qcm9maWxlKCdmb28nKTtcblxuICAgICAgY29uc3QgZW52aXJvbm1lbnRDcmVkZW50aWFsc1Byb3RvdHlwZSA9IChuZXcgQVdTLkVudmlyb25tZW50Q3JlZGVudGlhbHMoJ0FXUycpKS5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG5cbiAgICAgIGF3YWl0IHdpdGhNb2NrZWQoZW52aXJvbm1lbnRDcmVkZW50aWFsc1Byb3RvdHlwZSwgJ3JlZnJlc2gnLCBhc3luYyAocmVmcmVzaCkgPT4ge1xuICAgICAgICByZWZyZXNoLm1vY2tJbXBsZW1lbnRhdGlvbigoY2FsbGJhY2s6IChlcnI/OiBFcnJvcikgPT4gdm9pZCkgPT4gY2FsbGJhY2sobmV3IEVycm9yKCdUaGlzIGZ1bmN0aW9uIHNob3VsZCBub3QgaGF2ZSBiZWVuIGNhbGxlZCcpKSk7XG5cbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBleHBlY3QoKGF3YWl0IHByb3ZpZGVyLmRlZmF1bHRBY2NvdW50KCkpPy5hY2NvdW50SWQpLnRvRXF1YWwodW5pcSgnMTExMTEnKSk7XG5cbiAgICAgICAgZXhwZWN0KHJlZnJlc2gpLm5vdC50b0hhdmVCZWVuQ2FsbGVkKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ3N1cHBvcnRzIHByb2ZpbGUgc3ByZWFkIG92ZXIgY29uZmlnX2ZpbGUgYW5kIGNyZWRlbnRpYWxzX2ZpbGUnLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBXSEVOXG4gICAgICBwcmVwYXJlQ3JlZHMoe1xuICAgICAgICBmYWtlU3RzLFxuICAgICAgICBjcmVkZW50aWFsczoge1xuICAgICAgICAgIGZvbzogeyBhd3NfYWNjZXNzX2tleV9pZDogJ2Zvb2NjZXNzJywgJGFjY291bnQ6ICcyMjIyMicgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgJ2RlZmF1bHQnOiB7IHJlZ2lvbjogJ2V1LWJsYS01JyB9LFxuICAgICAgICAgICdwcm9maWxlIGZvbyc6IHsgcmVnaW9uOiAnZXUtd2VzdC0xJyB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IFNka1Byb3ZpZGVyLndpdGhBd3NDbGlDb21wYXRpYmxlRGVmYXVsdHMoeyAuLi5kZWZhdWx0Q3JlZE9wdGlvbnMsIHByb2ZpbGU6ICdmb28nIH0pO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QocHJvdmlkZXIuZGVmYXVsdFJlZ2lvbikudG9FcXVhbCgnZXUtd2VzdC0xJyk7XG4gICAgICBhd2FpdCBleHBlY3QocHJvdmlkZXIuZGVmYXVsdEFjY291bnQoKSkucmVzb2x2ZXMudG9FcXVhbCh7IGFjY291bnRJZDogdW5pcSgnMjIyMjInKSwgcGFydGl0aW9uOiAnYXdzJyB9KTtcblxuICAgICAgY29uc3Qgc2RrID0gYXdhaXQgcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52KHVuaXEoJzIyMjIyJykpLCBNb2RlLkZvclJlYWRpbmcpO1xuICAgICAgZXhwZWN0KHNka0NvbmZpZyhzZGspLmNyZWRlbnRpYWxzIS5hY2Nlc3NLZXlJZCkudG9FcXVhbCh1bmlxKCdmb29jY2VzcycpKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ3N1cHBvcnRzIHByb2ZpbGUgb25seSBpbiBjb25maWdfZmlsZScsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIFdIRU5cbiAgICAgIHByZXBhcmVDcmVkcyh7XG4gICAgICAgIGZha2VTdHMsXG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgICdkZWZhdWx0JzogeyByZWdpb246ICdldS1ibGEtNScgfSxcbiAgICAgICAgICAncHJvZmlsZSBmb28nOiB7IGF3c19hY2Nlc3Nfa2V5X2lkOiAnZm9vY2Nlc3MnLCAkYWNjb3VudDogJzIyMjIyJyB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUoJ2ZvbycpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QocHJvdmlkZXIuZGVmYXVsdFJlZ2lvbikudG9FcXVhbCgnZXUtYmxhLTUnKTsgLy8gRmFsbCBiYWNrIHRvIGRlZmF1bHQgY29uZmlnXG4gICAgICBhd2FpdCBleHBlY3QocHJvdmlkZXIuZGVmYXVsdEFjY291bnQoKSkucmVzb2x2ZXMudG9FcXVhbCh7IGFjY291bnRJZDogdW5pcSgnMjIyMjInKSwgcGFydGl0aW9uOiAnYXdzJyB9KTtcblxuICAgICAgY29uc3Qgc2RrID0gYXdhaXQgcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52KHVuaXEoJzIyMjIyJykpLCBNb2RlLkZvclJlYWRpbmcpO1xuICAgICAgZXhwZWN0KHNka0NvbmZpZyhzZGspLmNyZWRlbnRpYWxzIS5hY2Nlc3NLZXlJZCkudG9FcXVhbCh1bmlxKCdmb29jY2VzcycpKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ2NhbiBhc3N1bWUtcm9sZSBjb25maWd1cmVkIGluIGNvbmZpZycsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBwcmVwYXJlQ3JlZHMoe1xuICAgICAgICBmYWtlU3RzLFxuICAgICAgICBjcmVkZW50aWFsczoge1xuICAgICAgICAgIGFzc3VtZXI6IHsgYXdzX2FjY2Vzc19rZXlfaWQ6ICdhc3N1bWVyJywgJGFjY291bnQ6ICcxMTExMScgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgJ2RlZmF1bHQnOiB7IHJlZ2lvbjogJ2V1LWJsYS01JyB9LFxuICAgICAgICAgICdwcm9maWxlIGFzc3VtZXInOiB7IHJlZ2lvbjogJ3VzLWVhc3QtMicgfSxcbiAgICAgICAgICAncHJvZmlsZSBhc3N1bWFibGUnOiB7XG4gICAgICAgICAgICByb2xlX2FybjogJ2Fybjphd3M6aWFtOjo2NjY2Njpyb2xlL0Fzc3VtYWJsZScsXG4gICAgICAgICAgICBzb3VyY2VfcHJvZmlsZTogJ2Fzc3VtZXInLFxuICAgICAgICAgICAgJGFjY291bnQ6ICc2NjY2NicsXG4gICAgICAgICAgICAkZmFrZVN0c09wdGlvbnM6IHsgYWxsb3dlZEFjY291bnRzOiBbJzExMTExJ10gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUoJ2Fzc3VtYWJsZScpO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBzZGsgPSBhd2FpdCBwcm92aWRlci5mb3JFbnZpcm9ubWVudChlbnYodW5pcSgnNjY2NjYnKSksIE1vZGUuRm9yUmVhZGluZyk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdCgoYXdhaXQgc2RrLmN1cnJlbnRBY2NvdW50KCkpLmFjY291bnRJZCkudG9FcXVhbCh1bmlxKCc2NjY2NicpKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ2NhbiBhc3N1bWUgcm9sZSBldmVuIGlmIFtkZWZhdWx0XSBwcm9maWxlIGlzIG1pc3NpbmcnLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgcHJlcGFyZUNyZWRzKHtcbiAgICAgICAgZmFrZVN0cyxcbiAgICAgICAgY3JlZGVudGlhbHM6IHtcbiAgICAgICAgICBhc3N1bWVyOiB7IGF3c19hY2Nlc3Nfa2V5X2lkOiAnYXNzdW1lcicsICRhY2NvdW50OiAnMjIyMjInIH0sXG4gICAgICAgICAgYXNzdW1hYmxlOiB7IHJvbGVfYXJuOiAnYXJuOmF3czppYW06OjEyMzU2Nzg5MDEyOnJvbGUvQXNzdW1hYmxlJywgc291cmNlX3Byb2ZpbGU6ICdhc3N1bWVyJywgJGFjY291bnQ6ICcyMjIyMicgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgJ3Byb2ZpbGUgYXNzdW1hYmxlJzogeyByZWdpb246ICdldS1ibGEtNScgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUoJ2Fzc3VtYWJsZScpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoKGF3YWl0IHByb3ZpZGVyLmRlZmF1bHRBY2NvdW50KCkpPy5hY2NvdW50SWQpLnRvRXF1YWwodW5pcSgnMjIyMjInKSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdtZmFfc2VyaWFsIGluIHByb2ZpbGUgd2lsbCBhc2sgdXNlciBmb3IgdG9rZW4nLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgcHJlcGFyZUNyZWRzKHtcbiAgICAgICAgZmFrZVN0cyxcbiAgICAgICAgY3JlZGVudGlhbHM6IHtcbiAgICAgICAgICBhc3N1bWVyOiB7IGF3c19hY2Nlc3Nfa2V5X2lkOiAnYXNzdW1lcicsICRhY2NvdW50OiAnNjY2NjYnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgICdkZWZhdWx0JzogeyByZWdpb246ICdldS1ibGEtNScgfSxcbiAgICAgICAgICAncHJvZmlsZSBhc3N1bWVyJzogeyByZWdpb246ICd1cy1lYXN0LTInIH0sXG4gICAgICAgICAgJ3Byb2ZpbGUgbWZhLXJvbGUnOiB7XG4gICAgICAgICAgICByb2xlX2FybjogJ2Fybjphd3M6aWFtOjo2NjY2Njpyb2xlL0Fzc3VtYWJsZScsXG4gICAgICAgICAgICBzb3VyY2VfcHJvZmlsZTogJ2Fzc3VtZXInLFxuICAgICAgICAgICAgbWZhX3NlcmlhbDogJ2Fybjphd3M6aWFtOjphY2NvdW50Om1mYS91c2VyJyxcbiAgICAgICAgICAgICRhY2NvdW50OiAnNjY2NjYnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSgnbWZhLXJvbGUnKTtcblxuICAgICAgY29uc3QgcHJvbXB0bHlNb2NrQ2FsbHMgPSAocHJvbXB0bHkucHJvbXB0IGFzIGplc3QuTW9jaykubW9jay5jYWxscy5sZW5ndGg7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGNvbnN0IHNkayA9IGF3YWl0IHByb3ZpZGVyLmZvckVudmlyb25tZW50KGVudih1bmlxKCc2NjY2NicpKSwgTW9kZS5Gb3JSZWFkaW5nKTtcbiAgICAgIGV4cGVjdCgoYXdhaXQgc2RrLmN1cnJlbnRBY2NvdW50KCkpLmFjY291bnRJZCkudG9FcXVhbCh1bmlxKCc2NjY2NicpKTtcbiAgICAgIGV4cGVjdChmYWtlU3RzLmFzc3VtZWRSb2xlc1swXSkudG9FcXVhbChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIHJvbGVBcm46ICdhcm46YXdzOmlhbTo6NjY2NjY6cm9sZS9Bc3N1bWFibGUnLFxuICAgICAgICBzZXJpYWxOdW1iZXI6ICdhcm46YXdzOmlhbTo6YWNjb3VudDptZmEvdXNlcicsXG4gICAgICAgIHRva2VuQ29kZTogJzEyMzQnLFxuICAgICAgfSkpO1xuXG4gICAgICAvLyBNb2NrIHJlc3BvbnNlIHdhcyBzZXQgdG8gZmFpbCB0byBtYWtlIHN1cmUgd2UgZG9uJ3QgY2FsbCBTVFNcbiAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgTUZBIG1vY2sgd2FzIGNhbGxlZCBkdXJpbmcgdGhpcyB0ZXN0XG4gICAgICBleHBlY3QoKHByb21wdGx5LnByb21wdCBhcyBqZXN0Lk1vY2spLm1vY2suY2FsbHMubGVuZ3RoKS50b0JlKHByb21wdGx5TW9ja0NhbGxzICsgMSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIEZvciBEZWZhdWx0U3ludGhlc2lzIHdlIHdpbGwgZG8gYW4gYXNzdW1lLXJvbGUgYWZ0ZXIgaGF2aW5nIGdvdHRlbiBiYXNlIGNyZWRlbnRpYWxzXG4gIGRlc2NyaWJlKCd3aGVuIENESyBBc3N1bWVSb2xlcycsICgpID0+IHtcbiAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgIC8vIEFsbCB0aGVzZSB0ZXN0cyBzaGFyZSB0aGF0ICdhcm46YXdzOnJvbGUnIGlzIGEgcm9sZSBpbnRvIGFjY291bnQgODg4ODggd2hpY2ggY2FuIGJlIGFzc3VtZWQgZnJvbSAxMTExMVxuICAgICAgZmFrZVN0cy5yZWdpc3RlclJvbGUodW5pcSgnODg4ODgnKSwgJ2Fybjphd3M6cm9sZScsIHsgYWxsb3dlZEFjY291bnRzOiBbdW5pcSgnMTExMTEnKV0gfSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdlcnJvciB3ZSBnZXQgZnJvbSBhc3N1bWluZyBhIHJvbGUgaXMgdXNlZnVsJywgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHByZXBhcmVDcmVkcyh7XG4gICAgICAgIGZha2VTdHMsXG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgIGRlZmF1bHQ6IHsgYXdzX2FjY2Vzc19rZXlfaWQ6ICdmb28nIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSh1bmRlZmluZWQpO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBwcm9taXNlID0gcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52KHVuaXEoJzg4ODg4JykpLCBNb2RlLkZvclJlYWRpbmcsIHtcbiAgICAgICAgYXNzdW1lUm9sZUFybjogJ2RvZXNub3RleGlzdC5yb2xlLmFybicsXG4gICAgICB9KTtcblxuICAgICAgLy8gVEhFTiAtIGVycm9yIG1lc3NhZ2UgY29udGFpbnMgYm90aCBhIGhlbHBmdWwgaGludCBhbmQgdGhlIHVuZGVybHlpbmcgQXNzdW1lUm9sZSBtZXNzYWdlXG4gICAgICBhd2FpdCBleHBlY3QocHJvbWlzZSkucmVqZWN0cy50b1Rocm93KCdkaWQgeW91IGJvb3RzdHJhcCcpO1xuICAgICAgYXdhaXQgZXhwZWN0KHByb21pc2UpLnJlamVjdHMudG9UaHJvdygnZG9lc25vdGV4aXN0LnJvbGUuYXJuJyk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdhc3N1bWluZyBhIHJvbGUgc2FuaXRpemVzIHRoZSB1c2VybmFtZSBpbnRvIHRoZSBzZXNzaW9uIG5hbWUnLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgcHJlcGFyZUNyZWRzKHtcbiAgICAgICAgZmFrZVN0cyxcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgZGVmYXVsdDogeyBhd3NfYWNjZXNzX2tleV9pZDogJ2ZvbycsICRhY2NvdW50OiAnMTExMTEnIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgYXdhaXQgd2l0aE1vY2tlZChvcywgJ3VzZXJJbmZvJywgYXN5bmMgKHVzZXJJbmZvKSA9PiB7XG4gICAgICAgIHVzZXJJbmZvLm1vY2tSZXR1cm5WYWx1ZSh7IHVzZXJuYW1lOiAnc2vDpWwnLCB1aWQ6IDEsIGdpZDogMSwgaG9tZWRpcjogJy9oZXJlJywgc2hlbGw6ICcvYmluL3NoJyB9KTtcblxuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSh1bmRlZmluZWQpO1xuXG4gICAgICAgIGNvbnN0IHNkayA9IGF3YWl0IHByb3ZpZGVyLmZvckVudmlyb25tZW50KGVudih1bmlxKCc4ODg4OCcpKSwgTW9kZS5Gb3JSZWFkaW5nLCB7IGFzc3VtZVJvbGVBcm46ICdhcm46YXdzOnJvbGUnIH0pIGFzIFNESztcbiAgICAgICAgYXdhaXQgc2RrLmN1cnJlbnRBY2NvdW50KCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZmFrZVN0cy5hc3N1bWVkUm9sZXNbMF0pLnRvRXF1YWwoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICAgIHJvbGVTZXNzaW9uTmFtZTogJ2F3cy1jZGstc2tAbCcsXG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnZXZlbiBpZiBjdXJyZW50IGNyZWRlbnRpYWxzIGFyZSBmb3IgdGhlIHdyb25nIGFjY291bnQsIHdlIHdpbGwgc3RpbGwgdXNlIHRoZW0gdG8gQXNzdW1lUm9sZScsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBwcmVwYXJlQ3JlZHMoe1xuICAgICAgICBmYWtlU3RzLFxuICAgICAgICBjb25maWc6IHtcbiAgICAgICAgICBkZWZhdWx0OiB7IGF3c19hY2Nlc3Nfa2V5X2lkOiAnZm9vJywgJGFjY291bnQ6ICcxMTExMScgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcHJvdmlkZXIgPSBhd2FpdCBwcm92aWRlckZyb21Qcm9maWxlKHVuZGVmaW5lZCk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IHNkayA9IGF3YWl0IHByb3ZpZGVyLmZvckVudmlyb25tZW50KGVudih1bmlxKCc4ODg4OCcpKSwgTW9kZS5Gb3JSZWFkaW5nLCB7IGFzc3VtZVJvbGVBcm46ICdhcm46YXdzOnJvbGUnIH0pIGFzIFNESztcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KChhd2FpdCBzZGsuY3VycmVudEFjY291bnQoKSkuYWNjb3VudElkKS50b0VxdWFsKHVuaXEoJzg4ODg4JykpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnaWYgQXNzdW1lUm9sZSBmYWlscyBidXQgY3VycmVudCBjcmVkZW50aWFscyBhcmUgZm9yIHRoZSByaWdodCBhY2NvdW50LCB3ZSB3aWxsIHN0aWxsIHVzZSB0aGVtJywgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHByZXBhcmVDcmVkcyh7XG4gICAgICAgIGZha2VTdHMsXG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgIGRlZmF1bHQ6IHsgYXdzX2FjY2Vzc19rZXlfaWQ6ICdmb28nLCAkYWNjb3VudDogJzg4ODg4JyB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUodW5kZWZpbmVkKTtcblxuICAgICAgLy8gV0hFTiAtIGFzc3VtZVJvbGUgZmFpbHMgYmVjYXVzZSB0aGUgcm9sZSBjYW4gb25seSBiZSBhc3N1bWVkIGZyb20gYWNjb3VudCAxMTExMVxuICAgICAgY29uc3Qgc2RrID0gYXdhaXQgcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52KHVuaXEoJzg4ODg4JykpLCBNb2RlLkZvclJlYWRpbmcsIHsgYXNzdW1lUm9sZUFybjogJ2Fybjphd3M6cm9sZScgfSkgYXMgU0RLO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoKGF3YWl0IHNkay5jdXJyZW50QWNjb3VudCgpKS5hY2NvdW50SWQpLnRvRXF1YWwodW5pcSgnODg4ODgnKSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdQbHVnaW5zJywgKCkgPT4ge1xuICAgIHRlc3QoJ2RvZXMgbm90IHVzZSBwbHVnaW5zIGlmIGN1cnJlbnQgY3JlZGVudGlhbHMgYXJlIGZvciBleHBlY3RlZCBhY2NvdW50JywgYXN5bmMgKCkgPT4ge1xuICAgICAgcHJlcGFyZUNyZWRzKHtcbiAgICAgICAgZmFrZVN0cyxcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgZGVmYXVsdDogeyBhd3NfYWNjZXNzX2tleV9pZDogJ2ZvbycsICRhY2NvdW50OiAnMTExMTEnIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSh1bmRlZmluZWQpO1xuICAgICAgYXdhaXQgcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52KHVuaXEoJzExMTExJykpLCBNb2RlLkZvclJlYWRpbmcpO1xuICAgICAgZXhwZWN0KHBsdWdpblF1ZXJpZWQpLnRvRXF1YWwoZmFsc2UpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndXNlcyBwbHVnaW4gZm9yIGFjY291bnQgOTk5OTknLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUodW5kZWZpbmVkKTtcbiAgICAgIGF3YWl0IHByb3ZpZGVyLmZvckVudmlyb25tZW50KGVudih1bmlxKCc5OTk5OScpKSwgTW9kZS5Gb3JSZWFkaW5nKTtcbiAgICAgIGV4cGVjdChwbHVnaW5RdWVyaWVkKS50b0VxdWFsKHRydWUpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnY2FuIGFzc3VtZSByb2xlIHdpdGggY3JlZGVudGlhbHMgZnJvbSBwbHVnaW4nLCBhc3luYyAoKSA9PiB7XG4gICAgICBmYWtlU3RzLnJlZ2lzdGVyUm9sZSh1bmlxKCc5OTk5OScpLCAnYXJuOmF3czppYW06Ojk5OTk5OnJvbGUvQXNzdW1hYmxlJyk7XG5cbiAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSh1bmRlZmluZWQpO1xuICAgICAgYXdhaXQgcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52KHVuaXEoJzk5OTk5JykpLCBNb2RlLkZvclJlYWRpbmcsIHtcbiAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Fybjphd3M6aWFtOjo5OTk5OTpyb2xlL0Fzc3VtYWJsZScsXG4gICAgICB9KTtcblxuICAgICAgZXhwZWN0KGZha2VTdHMuYXNzdW1lZFJvbGVzWzBdKS50b0VxdWFsKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgcm9sZUFybjogJ2Fybjphd3M6aWFtOjo5OTk5OTpyb2xlL0Fzc3VtYWJsZScsXG4gICAgICB9KSk7XG4gICAgICBleHBlY3QocGx1Z2luUXVlcmllZCkudG9FcXVhbCh0cnVlKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ2V2ZW4gaWYgQXNzdW1lUm9sZSBmYWlscyBidXQgY3VycmVudCBjcmVkZW50aWFscyBhcmUgZnJvbSBhIHBsdWdpbiwgd2Ugd2lsbCBzdGlsbCB1c2UgdGhlbScsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSh1bmRlZmluZWQpO1xuICAgICAgY29uc3Qgc2RrID0gYXdhaXQgcHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52KHVuaXEoJzk5OTk5JykpLCBNb2RlLkZvclJlYWRpbmcsIHsgYXNzdW1lUm9sZUFybjogJ2RvZXM6bm90OmV4aXN0JyB9KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KChhd2FpdCBzZGsuY3VycmVudEFjY291bnQoKSkuYWNjb3VudElkKS50b0VxdWFsKHVuaXEoJzk5OTk5JykpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgncGx1Z2lucyBhcmUgc3RpbGwgcXVlcmllZCBldmVuIGlmIGN1cnJlbnQgY3JlZGVudGlhbHMgYXJlIGV4cGlyZWQgKG9yIG90aGVyd2lzZSBpbnZhbGlkKScsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBwcm9jZXNzLmVudi5BV1NfQUNDRVNTX0tFWV9JRCA9IGAke3VpZH1ha2lkYDtcbiAgICAgIHByb2Nlc3MuZW52LkFXU19TRUNSRVRfQUNDRVNTX0tFWSA9ICdzZWtyaXQnO1xuICAgICAgY29uc3QgcHJvdmlkZXIgPSBhd2FpdCBwcm92aWRlckZyb21Qcm9maWxlKHVuZGVmaW5lZCk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGF3YWl0IHByb3ZpZGVyLmZvckVudmlyb25tZW50KGVudih1bmlxKCc5OTk5OScpKSwgTW9kZS5Gb3JSZWFkaW5nKTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KHBsdWdpblF1ZXJpZWQpLnRvRXF1YWwodHJ1ZSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdzdXBwb3J0IGZvciBjcmVkZW50aWFsX3NvdXJjZScsICgpID0+IHtcbiAgICB0ZXN0KCdjYW4gYXNzdW1lIHJvbGUgd2l0aCBlY3MgY3JlZGVudGlhbHMnLCBhc3luYyAoKSA9PiB7XG4gICAgICByZXR1cm4gd2l0aE1vY2tlZChBV1MuRUNTQ3JlZGVudGlhbHMucHJvdG90eXBlLCAnbmVlZHNSZWZyZXNoJywgYXN5bmMgKG5lZWRzUmVmcmVzaCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBwcmVwYXJlQ3JlZHMoe1xuICAgICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgICAgJ3Byb2ZpbGUgZWNzJzogeyByb2xlX2FybjogJ2Fybjphd3M6aWFtOjoxMjM1Njc4OTAxMjpyb2xlL0Fzc3VtYWJsZScsIGNyZWRlbnRpYWxfc291cmNlOiAnRWNzQ29udGFpbmVyJywgJGFjY291bnQ6ICcyMjIyMicgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgcHJvdmlkZXIgPSBhd2FpdCBwcm92aWRlckZyb21Qcm9maWxlKCdlY3MnKTtcblxuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGF3YWl0IHByb3ZpZGVyLmRlZmF1bHRBY2NvdW50KCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QobmVlZHNSZWZyZXNoKS50b0hhdmVCZWVuQ2FsbGVkKCk7XG4gICAgICB9KTtcblxuICAgIH0pO1xuXG4gICAgdGVzdCgnY2FuIGFzc3VtZSByb2xlIHdpdGggZWMyIGNyZWRlbnRpYWxzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgcmV0dXJuIHdpdGhNb2NrZWQoQVdTLkVDMk1ldGFkYXRhQ3JlZGVudGlhbHMucHJvdG90eXBlLCAnbmVlZHNSZWZyZXNoJywgYXN5bmMgKG5lZWRzUmVmcmVzaCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBwcmVwYXJlQ3JlZHMoe1xuICAgICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgICAgJ3Byb2ZpbGUgZWNzJzogeyByb2xlX2FybjogJ2Fybjphd3M6aWFtOjoxMjM1Njc4OTAxMjpyb2xlL0Fzc3VtYWJsZScsIGNyZWRlbnRpYWxfc291cmNlOiAnRWMySW5zdGFuY2VNZXRhZGF0YScsICRhY2NvdW50OiAnMjIyMjInIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSgnZWNzJyk7XG5cbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBhd2FpdCBwcm92aWRlci5kZWZhdWx0QWNjb3VudCgpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KG5lZWRzUmVmcmVzaCkudG9IYXZlQmVlbkNhbGxlZCgpO1xuXG4gICAgICB9KTtcblxuICAgIH0pO1xuXG4gICAgdGVzdCgnY2FuIGFzc3VtZSByb2xlIHdpdGggZW52IGNyZWRlbnRpYWxzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgcmV0dXJuIHdpdGhNb2NrZWQoQVdTLkVudmlyb25tZW50Q3JlZGVudGlhbHMucHJvdG90eXBlLCAnbmVlZHNSZWZyZXNoJywgYXN5bmMgKG5lZWRzUmVmcmVzaCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBwcmVwYXJlQ3JlZHMoe1xuICAgICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgICAgJ3Byb2ZpbGUgZWNzJzogeyByb2xlX2FybjogJ2Fybjphd3M6aWFtOjoxMjM1Njc4OTAxMjpyb2xlL0Fzc3VtYWJsZScsIGNyZWRlbnRpYWxfc291cmNlOiAnRW52aXJvbm1lbnQnLCAkYWNjb3VudDogJzIyMjIyJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUoJ2VjcycpO1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgYXdhaXQgcHJvdmlkZXIuZGVmYXVsdEFjY291bnQoKTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChuZWVkc1JlZnJlc2gpLnRvSGF2ZUJlZW5DYWxsZWQoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnYXNzdW1lIGZhaWxzIHdpdGggdW5zdXBwb3J0ZWQgY3JlZGVudGlhbF9zb3VyY2UnLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgcHJlcGFyZUNyZWRzKHtcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgJ3Byb2ZpbGUgZWNzJzogeyByb2xlX2FybjogJ2Fybjphd3M6aWFtOjoxMjM1Njc4OTAxMjpyb2xlL0Fzc3VtYWJsZScsIGNyZWRlbnRpYWxfc291cmNlOiAndW5zdXBwb3J0ZWQnLCAkYWNjb3VudDogJzIyMjIyJyB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHByb3ZpZGVyRnJvbVByb2ZpbGUoJ2VjcycpO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgcHJvdmlkZXIuZGVmYXVsdEFjY291bnQoKTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGFjY291bnQ/LmFjY291bnRJZCkudG9FcXVhbCh1bmRlZmluZWQpO1xuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdkZWZhdWx0QWNjb3VudCByZXR1cm5zIHVuZGVmaW5lZCBpZiBTVFMgY2FsbCBmYWlscycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIHByb2Nlc3MuZW52LkFXU19BQ0NFU1NfS0VZX0lEID0gYCR7dWlkfWFraWRgO1xuICAgIHByb2Nlc3MuZW52LkFXU19TRUNSRVRfQUNDRVNTX0tFWSA9ICdzZWtyaXQnO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgcHJvdmlkZXJGcm9tUHJvZmlsZSh1bmRlZmluZWQpO1xuXG4gICAgLy8gVEhFTlxuICAgIGF3YWl0IGV4cGVjdChwcm92aWRlci5kZWZhdWx0QWNjb3VudCgpKS5yZXNvbHZlcy50b0JlKHVuZGVmaW5lZCk7XG4gIH0pO1xufSk7XG5cbnRlc3QoJ2V2ZW4gd2hlbiB1c2luZyBhIHByb2ZpbGUgdG8gYXNzdW1lIGFub3RoZXIgcHJvZmlsZSwgU1RTIGNhbGxzIGdvZXMgdGhyb3VnaCB0aGUgcHJveHknLCBhc3luYyAoKSA9PiB7XG4gIHByZXBhcmVDcmVkcyh7XG4gICAgY3JlZGVudGlhbHM6IHtcbiAgICAgIGFzc3VtZXI6IHsgYXdzX2FjY2Vzc19rZXlfaWQ6ICdhc3N1bWVyJyB9LFxuICAgIH0sXG4gICAgY29uZmlnOiB7XG4gICAgICAnZGVmYXVsdCc6IHsgcmVnaW9uOiAnZXUtYmxhLTUnIH0sXG4gICAgICAncHJvZmlsZSBhc3N1bWFibGUnOiB7IHJvbGVfYXJuOiAnYXJuOmF3czppYW06OjY2NjY2OnJvbGUvQXNzdW1hYmxlJywgc291cmNlX3Byb2ZpbGU6ICdhc3N1bWVyJywgJGFjY291bnQ6ICc2NjY2NicgfSxcbiAgICAgICdwcm9maWxlIGFzc3VtZXInOiB7IHJlZ2lvbjogJ3VzLWVhc3QtMicgfSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBNZXNzeSBtb2NraW5nXG4gIGxldCBjYWxsZWQgPSBmYWxzZTtcbiAgamVzdC5tb2NrKCdwcm94eS1hZ2VudCcsICgpID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICAgIGNsYXNzIEZha2VBZ2VudCBleHRlbmRzIHJlcXVpcmUoJ2h0dHBzJykuQWdlbnQge1xuICAgICAgcHVibGljIGFkZFJlcXVlc3QoXzogYW55LCBfXzogYW55KSB7XG4gICAgICAgIC8vIEZJWE1FOiB0aGlzIGVycm9yIHRha2VzIDYgc2Vjb25kcyB0byBiZSBjb21wbGV0ZWx5IGhhbmRsZWQuIEl0XG4gICAgICAgIC8vIG1pZ2h0IGJlIHJldHJpZXMgaW4gdGhlIFNESyBzb21ld2hlcmUsIG9yIHNvbWV0aGluZyBhYm91dCB0aGUgTm9kZVxuICAgICAgICAvLyBldmVudCBsb29wLiBJJ3ZlIHNwZW50IGFuIGhvdXIgdHJ5aW5nIHRvIGZpZ3VyZSBpdCBvdXQgYW5kIEkgY2FuJ3QsXG4gICAgICAgIC8vIGFuZCBJIGdhdmUgdXAuIFdlJ2xsIGp1c3QgaGF2ZSB0byBsaXZlIHdpdGggdGhpcyB1bnRpbCBzb21lb25lIGdldHNcbiAgICAgICAgLy8gaW5zcGlyZWQuXG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdBQk9SVEVEIEJZIFRFU1QnKTtcbiAgICAgICAgKGVycm9yIGFzIGFueSkuY29kZSA9ICdSZXF1ZXN0QWJvcnRlZEVycm9yJztcbiAgICAgICAgKGVycm9yIGFzIGFueSkucmV0cnlhYmxlID0gZmFsc2U7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gRmFrZUFnZW50O1xuICB9KTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgU2RrUHJvdmlkZXIud2l0aEF3c0NsaUNvbXBhdGlibGVEZWZhdWx0cyh7XG4gICAgLi4uZGVmYXVsdENyZWRPcHRpb25zLFxuICAgIHByb2ZpbGU6ICdhc3N1bWFibGUnLFxuICAgIGh0dHBPcHRpb25zOiB7XG4gICAgICBwcm94eUFkZHJlc3M6ICdodHRwOi8vRE9FU05UTUFUVEVSLycsXG4gICAgfSxcbiAgfSk7XG5cbiAgYXdhaXQgcHJvdmlkZXIuZGVmYXVsdEFjY291bnQoKTtcblxuICAvLyBUSEVOIC0tIHRoZSBmYWtlIHByb3h5IGFnZW50IGdvdCBjYWxsZWQsIHdlIGRvbid0IGNhcmUgYWJvdXQgdGhlIHJlc3VsdFxuICBleHBlY3QoY2FsbGVkKS50b0VxdWFsKHRydWUpO1xufSk7XG5cbi8qKlxuICogVXNlIG9iamVjdCBoYWNrZXJ5IHRvIGdldCB0aGUgY3JlZGVudGlhbHMgb3V0IG9mIHRoZSBTREsgb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIHNka0NvbmZpZyhzZGs6IElTREspOiBDb25maWd1cmF0aW9uT3B0aW9ucyB7XG4gIHJldHVybiAoc2RrIGFzIGFueSkuY29uZmlnO1xufVxuXG4vKipcbiAqIEZpeHR1cmUgZm9yIFNESyBhdXRoIGZvciB0aGlzIHRlc3Qgc3VpdGVcbiAqXG4gKiBIYXMga25vd2xlZGdlIG9mIHRoZSBjYWNoZSBidXN0ZXIsIHdpbGwgd3JpdGUgcHJvcGVyIGZha2UgY29uZmlnIGZpbGVzIGFuZFxuICogcmVnaXN0ZXIgdXNlcnMgYW5kIHJvbGVzIGluIEZha2VTdHMgYXQgdGhlIHNhbWUgdGltZS5cbiAqL1xuZnVuY3Rpb24gcHJlcGFyZUNyZWRzKG9wdGlvbnM6IFByZXBhcmVDcmVkc09wdGlvbnMpIHtcbiAgZnVuY3Rpb24gY29udmVydFNlY3Rpb25zKHNlY3Rpb25zPzogUmVjb3JkPHN0cmluZywgUHJvZmlsZVVzZXIgfCBQcm9maWxlUm9sZT4pIHtcbiAgICBjb25zdCByZXQgPSBbXTtcbiAgICBmb3IgKGNvbnN0IFtwcm9maWxlLCB1c2VyXSBvZiBPYmplY3QuZW50cmllcyhzZWN0aW9ucyA/PyB7fSkpIHtcbiAgICAgIHJldC5wdXNoKGBbJHtwcm9maWxlfV1gKTtcblxuICAgICAgaWYgKGlzUHJvZmlsZVJvbGUodXNlcikpIHtcbiAgICAgICAgcmV0LnB1c2goYHJvbGVfYXJuPSR7dXNlci5yb2xlX2Fybn1gKTtcbiAgICAgICAgaWYgKCdzb3VyY2VfcHJvZmlsZScgaW4gdXNlcikge1xuICAgICAgICAgIHJldC5wdXNoKGBzb3VyY2VfcHJvZmlsZT0ke3VzZXIuc291cmNlX3Byb2ZpbGV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCdjcmVkZW50aWFsX3NvdXJjZScgaW4gdXNlcikge1xuICAgICAgICAgIHJldC5wdXNoKGBjcmVkZW50aWFsX3NvdXJjZT0ke3VzZXIuY3JlZGVudGlhbF9zb3VyY2V9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVzZXIubWZhX3NlcmlhbCkge1xuICAgICAgICAgIHJldC5wdXNoKGBtZmFfc2VyaWFsPSR7dXNlci5tZmFfc2VyaWFsfWApO1xuICAgICAgICB9XG4gICAgICAgIG9wdGlvbnMuZmFrZVN0cz8ucmVnaXN0ZXJSb2xlKHVuaXEodXNlci4kYWNjb3VudCA/PyAnMDAwMDAnKSwgdXNlci5yb2xlX2Fybiwge1xuICAgICAgICAgIC4uLnVzZXIuJGZha2VTdHNPcHRpb25zLFxuICAgICAgICAgIGFsbG93ZWRBY2NvdW50czogdXNlci4kZmFrZVN0c09wdGlvbnM/LmFsbG93ZWRBY2NvdW50cz8ubWFwKHVuaXEpLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh1c2VyLmF3c19hY2Nlc3Nfa2V5X2lkKSB7XG4gICAgICAgICAgcmV0LnB1c2goYGF3c19hY2Nlc3Nfa2V5X2lkPSR7dW5pcSh1c2VyLmF3c19hY2Nlc3Nfa2V5X2lkKX1gKTtcbiAgICAgICAgICByZXQucHVzaCgnYXdzX3NlY3JldF9hY2Nlc3Nfa2V5PXNlY3JldCcpO1xuICAgICAgICAgIG9wdGlvbnMuZmFrZVN0cz8ucmVnaXN0ZXJVc2VyKHVuaXEodXNlci4kYWNjb3VudCA/PyAnMDAwMDAnKSwgdW5pcSh1c2VyLmF3c19hY2Nlc3Nfa2V5X2lkKSwgdXNlci4kZmFrZVN0c09wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh1c2VyLnJlZ2lvbikge1xuICAgICAgICByZXQucHVzaChgcmVnaW9uPSR7dXNlci5yZWdpb259YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXQuam9pbignXFxuJyk7XG4gIH1cblxuICBib2NrZnMoe1xuICAgICcvaG9tZS9tZS8uYnh0L2NyZWRlbnRpYWxzJzogY29udmVydFNlY3Rpb25zKG9wdGlvbnMuY3JlZGVudGlhbHMpLFxuICAgICcvaG9tZS9tZS8uYnh0L2NvbmZpZyc6IGNvbnZlcnRTZWN0aW9ucyhvcHRpb25zLmNvbmZpZyksXG4gIH0pO1xuXG4gIC8vIFNldCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCB3ZSB3YW50XG4gIHByb2Nlc3MuZW52LkFXU19DT05GSUdfRklMRSA9IGJvY2tmcy5wYXRoKCcvaG9tZS9tZS8uYnh0L2NvbmZpZycpO1xuICBwcm9jZXNzLmVudi5BV1NfU0hBUkVEX0NSRURFTlRJQUxTX0ZJTEUgPSBib2NrZnMucGF0aCgnL2hvbWUvbWUvLmJ4dC9jcmVkZW50aWFscycpO1xufVxuXG5pbnRlcmZhY2UgUHJlcGFyZUNyZWRzT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBXcml0ZSB0aGUgYXdzL2NyZWRlbnRpYWxzIGZpbGVcbiAgICovXG4gIHJlYWRvbmx5IGNyZWRlbnRpYWxzPzogUmVjb3JkPHN0cmluZywgUHJvZmlsZVVzZXIgfCBQcm9maWxlUm9sZT47XG5cbiAgLyoqXG4gICAqIFdyaXRlIHRoZSBhd3MvY29uZmlnIGZpbGVcbiAgICovXG4gIHJlYWRvbmx5IGNvbmZpZz86IFJlY29yZDxzdHJpbmcsIFByb2ZpbGVVc2VyIHwgUHJvZmlsZVJvbGU+O1xuXG4gIC8qKlxuICAgKiBJZiBnaXZlbiwgYWRkIHVzZXJzIHRvIEZha2VTVFNcbiAgICovXG4gIHJlYWRvbmx5IGZha2VTdHM/OiBGYWtlU3RzO1xufVxuXG5pbnRlcmZhY2UgUHJvZmlsZVVzZXIge1xuICByZWFkb25seSBhd3NfYWNjZXNzX2tleV9pZD86IHN0cmluZztcbiAgcmVhZG9ubHkgJGFjY291bnQ/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IHJlZ2lvbj86IHN0cmluZztcbiAgcmVhZG9ubHkgJGZha2VTdHNPcHRpb25zPzogUmVnaXN0ZXJVc2VyT3B0aW9ucztcbn1cblxudHlwZSBQcm9maWxlUm9sZSA9IHtcbiAgcmVhZG9ubHkgcm9sZV9hcm46IHN0cmluZztcbiAgcmVhZG9ubHkgbWZhX3NlcmlhbD86IHN0cmluZztcbiAgcmVhZG9ubHkgJGFjY291bnQ6IHN0cmluZztcbiAgcmVhZG9ubHkgcmVnaW9uPzogc3RyaW5nO1xuICByZWFkb25seSAkZmFrZVN0c09wdGlvbnM/OiBSZWdpc3RlclJvbGVPcHRpb25zO1xufSAmICh7IHJlYWRvbmx5IHNvdXJjZV9wcm9maWxlOiBzdHJpbmcgfSB8IHsgcmVhZG9ubHkgY3JlZGVudGlhbF9zb3VyY2U6IHN0cmluZyB9KTtcblxuZnVuY3Rpb24gaXNQcm9maWxlUm9sZSh4OiBQcm9maWxlVXNlciB8IFByb2ZpbGVSb2xlKTogeCBpcyBQcm9maWxlUm9sZSB7XG4gIHJldHVybiAncm9sZV9hcm4nIGluIHg7XG59XG5cbmZ1bmN0aW9uIHByb3ZpZGVyRnJvbVByb2ZpbGUocHJvZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gIHJldHVybiBTZGtQcm92aWRlci53aXRoQXdzQ2xpQ29tcGF0aWJsZURlZmF1bHRzKHsgLi4uZGVmYXVsdENyZWRPcHRpb25zLCBwcm9maWxlIH0pO1xufSJdfQ==