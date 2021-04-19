import { Mode } from './credentials';
/**
 * Cache for credential providers.
 *
 * Given an account and an operating mode (read or write) will return an
 * appropriate credential provider for credentials for the given account. The
 * credential provider will be cached so that multiple AWS clients for the same
 * environment will not make multiple network calls to obtain credentials.
 *
 * Will use default credentials if they are for the right account; otherwise,
 * all loaded credential provider plugins will be tried to obtain credentials
 * for the given account.
 */
export declare class CredentialPlugins {
    private readonly cache;
    fetchCredentialsFor(awsAccountId: string, mode: Mode): Promise<PluginCredentials | undefined>;
    get availablePluginNames(): string[];
    private lookupCredentials;
}
export interface PluginCredentials {
    readonly credentials: AWS.Credentials;
    readonly pluginName: string;
}
