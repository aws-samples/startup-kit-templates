"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialPlugins = void 0;
const logging_1 = require("../../logging");
const plugin_1 = require("../../plugin");
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
class CredentialPlugins {
    constructor() {
        this.cache = {};
    }
    async fetchCredentialsFor(awsAccountId, mode) {
        const key = `${awsAccountId}-${mode}`;
        if (!(key in this.cache)) {
            this.cache[key] = await this.lookupCredentials(awsAccountId, mode);
        }
        return this.cache[key];
    }
    get availablePluginNames() {
        return plugin_1.PluginHost.instance.credentialProviderSources.map(s => s.name);
    }
    async lookupCredentials(awsAccountId, mode) {
        const triedSources = [];
        // Otherwise, inspect the various credential sources we have
        for (const source of plugin_1.PluginHost.instance.credentialProviderSources) {
            if (!(await source.isAvailable())) {
                logging_1.debug('Credentials source %s is not available, ignoring it.', source.name);
                continue;
            }
            triedSources.push(source);
            if (!(await source.canProvideCredentials(awsAccountId))) {
                continue;
            }
            logging_1.debug(`Using ${source.name} credentials for account ${awsAccountId}`);
            const providerOrCreds = await source.getProvider(awsAccountId, mode);
            // Backwards compatibility: if the plugin returns a ProviderChain, resolve that chain.
            // Otherwise it must have returned credentials.
            const credentials = providerOrCreds.resolvePromise ? await providerOrCreds.resolvePromise() : providerOrCreds;
            return { credentials, pluginName: source.name };
        }
        return undefined;
    }
}
exports.CredentialPlugins = CredentialPlugins;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlZGVudGlhbC1wbHVnaW5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY3JlZGVudGlhbC1wbHVnaW5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJDQUFzQztBQUN0Qyx5Q0FBMEM7QUFHMUM7Ozs7Ozs7Ozs7O0dBV0c7QUFDSCxNQUFhLGlCQUFpQjtJQUE5QjtRQUNtQixVQUFLLEdBQW1ELEVBQUUsQ0FBQztJQW1DOUUsQ0FBQztJQWpDUSxLQUFLLENBQUMsbUJBQW1CLENBQUMsWUFBb0IsRUFBRSxJQUFVO1FBQy9ELE1BQU0sR0FBRyxHQUFHLEdBQUcsWUFBWSxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDcEU7UUFDRCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUVELElBQVcsb0JBQW9CO1FBQzdCLE9BQU8sbUJBQVUsQ0FBQyxRQUFRLENBQUMseUJBQXlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsWUFBb0IsRUFBRSxJQUFVO1FBQzlELE1BQU0sWUFBWSxHQUErQixFQUFFLENBQUM7UUFDcEQsNERBQTREO1FBQzVELEtBQUssTUFBTSxNQUFNLElBQUksbUJBQVUsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUU7WUFDbEUsSUFBSSxDQUFDLENBQUMsTUFBTSxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRTtnQkFDakMsZUFBSyxDQUFDLHNEQUFzRCxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDM0UsU0FBUzthQUNWO1lBQ0QsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxQixJQUFJLENBQUMsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFO2dCQUFFLFNBQVM7YUFBRTtZQUN0RSxlQUFLLENBQUMsU0FBUyxNQUFNLENBQUMsSUFBSSw0QkFBNEIsWUFBWSxFQUFFLENBQUMsQ0FBQztZQUN0RSxNQUFNLGVBQWUsR0FBRyxNQUFNLE1BQU0sQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRXJFLHNGQUFzRjtZQUN0RiwrQ0FBK0M7WUFDL0MsTUFBTSxXQUFXLEdBQUksZUFBdUIsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE1BQU8sZUFBdUIsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDO1lBRWhJLE9BQU8sRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUNqRDtRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7Q0FDRjtBQXBDRCw4Q0FvQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWJ1ZyB9IGZyb20gJy4uLy4uL2xvZ2dpbmcnO1xuaW1wb3J0IHsgUGx1Z2luSG9zdCB9IGZyb20gJy4uLy4uL3BsdWdpbic7XG5pbXBvcnQgeyBDcmVkZW50aWFsUHJvdmlkZXJTb3VyY2UsIE1vZGUgfSBmcm9tICcuL2NyZWRlbnRpYWxzJztcblxuLyoqXG4gKiBDYWNoZSBmb3IgY3JlZGVudGlhbCBwcm92aWRlcnMuXG4gKlxuICogR2l2ZW4gYW4gYWNjb3VudCBhbmQgYW4gb3BlcmF0aW5nIG1vZGUgKHJlYWQgb3Igd3JpdGUpIHdpbGwgcmV0dXJuIGFuXG4gKiBhcHByb3ByaWF0ZSBjcmVkZW50aWFsIHByb3ZpZGVyIGZvciBjcmVkZW50aWFscyBmb3IgdGhlIGdpdmVuIGFjY291bnQuIFRoZVxuICogY3JlZGVudGlhbCBwcm92aWRlciB3aWxsIGJlIGNhY2hlZCBzbyB0aGF0IG11bHRpcGxlIEFXUyBjbGllbnRzIGZvciB0aGUgc2FtZVxuICogZW52aXJvbm1lbnQgd2lsbCBub3QgbWFrZSBtdWx0aXBsZSBuZXR3b3JrIGNhbGxzIHRvIG9idGFpbiBjcmVkZW50aWFscy5cbiAqXG4gKiBXaWxsIHVzZSBkZWZhdWx0IGNyZWRlbnRpYWxzIGlmIHRoZXkgYXJlIGZvciB0aGUgcmlnaHQgYWNjb3VudDsgb3RoZXJ3aXNlLFxuICogYWxsIGxvYWRlZCBjcmVkZW50aWFsIHByb3ZpZGVyIHBsdWdpbnMgd2lsbCBiZSB0cmllZCB0byBvYnRhaW4gY3JlZGVudGlhbHNcbiAqIGZvciB0aGUgZ2l2ZW4gYWNjb3VudC5cbiAqL1xuZXhwb3J0IGNsYXNzIENyZWRlbnRpYWxQbHVnaW5zIHtcbiAgcHJpdmF0ZSByZWFkb25seSBjYWNoZToge1trZXk6IHN0cmluZ106IFBsdWdpbkNyZWRlbnRpYWxzIHwgdW5kZWZpbmVkfSA9IHt9O1xuXG4gIHB1YmxpYyBhc3luYyBmZXRjaENyZWRlbnRpYWxzRm9yKGF3c0FjY291bnRJZDogc3RyaW5nLCBtb2RlOiBNb2RlKTogUHJvbWlzZTxQbHVnaW5DcmVkZW50aWFscyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IGtleSA9IGAke2F3c0FjY291bnRJZH0tJHttb2RlfWA7XG4gICAgaWYgKCEoa2V5IGluIHRoaXMuY2FjaGUpKSB7XG4gICAgICB0aGlzLmNhY2hlW2tleV0gPSBhd2FpdCB0aGlzLmxvb2t1cENyZWRlbnRpYWxzKGF3c0FjY291bnRJZCwgbW9kZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNhY2hlW2tleV07XG4gIH1cblxuICBwdWJsaWMgZ2V0IGF2YWlsYWJsZVBsdWdpbk5hbWVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gUGx1Z2luSG9zdC5pbnN0YW5jZS5jcmVkZW50aWFsUHJvdmlkZXJTb3VyY2VzLm1hcChzID0+IHMubmFtZSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvb2t1cENyZWRlbnRpYWxzKGF3c0FjY291bnRJZDogc3RyaW5nLCBtb2RlOiBNb2RlKTogUHJvbWlzZTxQbHVnaW5DcmVkZW50aWFscyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHRyaWVkU291cmNlczogQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlW10gPSBbXTtcbiAgICAvLyBPdGhlcndpc2UsIGluc3BlY3QgdGhlIHZhcmlvdXMgY3JlZGVudGlhbCBzb3VyY2VzIHdlIGhhdmVcbiAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBQbHVnaW5Ib3N0Lmluc3RhbmNlLmNyZWRlbnRpYWxQcm92aWRlclNvdXJjZXMpIHtcbiAgICAgIGlmICghKGF3YWl0IHNvdXJjZS5pc0F2YWlsYWJsZSgpKSkge1xuICAgICAgICBkZWJ1ZygnQ3JlZGVudGlhbHMgc291cmNlICVzIGlzIG5vdCBhdmFpbGFibGUsIGlnbm9yaW5nIGl0LicsIHNvdXJjZS5uYW1lKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB0cmllZFNvdXJjZXMucHVzaChzb3VyY2UpO1xuICAgICAgaWYgKCEoYXdhaXQgc291cmNlLmNhblByb3ZpZGVDcmVkZW50aWFscyhhd3NBY2NvdW50SWQpKSkgeyBjb250aW51ZTsgfVxuICAgICAgZGVidWcoYFVzaW5nICR7c291cmNlLm5hbWV9IGNyZWRlbnRpYWxzIGZvciBhY2NvdW50ICR7YXdzQWNjb3VudElkfWApO1xuICAgICAgY29uc3QgcHJvdmlkZXJPckNyZWRzID0gYXdhaXQgc291cmNlLmdldFByb3ZpZGVyKGF3c0FjY291bnRJZCwgbW9kZSk7XG5cbiAgICAgIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5OiBpZiB0aGUgcGx1Z2luIHJldHVybnMgYSBQcm92aWRlckNoYWluLCByZXNvbHZlIHRoYXQgY2hhaW4uXG4gICAgICAvLyBPdGhlcndpc2UgaXQgbXVzdCBoYXZlIHJldHVybmVkIGNyZWRlbnRpYWxzLlxuICAgICAgY29uc3QgY3JlZGVudGlhbHMgPSAocHJvdmlkZXJPckNyZWRzIGFzIGFueSkucmVzb2x2ZVByb21pc2UgPyBhd2FpdCAocHJvdmlkZXJPckNyZWRzIGFzIGFueSkucmVzb2x2ZVByb21pc2UoKSA6IHByb3ZpZGVyT3JDcmVkcztcblxuICAgICAgcmV0dXJuIHsgY3JlZGVudGlhbHMsIHBsdWdpbk5hbWU6IHNvdXJjZS5uYW1lIH07XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5DcmVkZW50aWFscyB7XG4gIHJlYWRvbmx5IGNyZWRlbnRpYWxzOiBBV1MuQ3JlZGVudGlhbHM7XG4gIHJlYWRvbmx5IHBsdWdpbk5hbWU6IHN0cmluZztcbn0iXX0=