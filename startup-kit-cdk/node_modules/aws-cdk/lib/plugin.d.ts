import { CredentialProviderSource } from './api/aws-auth/credentials';
/**
 * The basic contract for plug-ins to adhere to::
 *
 *   import { Plugin, PluginHost } from 'aws-cdk';
 *   import { CustomCredentialProviderSource } from './custom-credential-provider-source';
 *
 *   export default class FooCDKPlugIn implements PluginHost {
 *     public readonly version = '1';
 *
 *     public init(host: PluginHost) {
 *     host.registerCredentialProviderSource(new CustomCredentialProviderSource());
 *     }
 *   }
 *
 * @experimental
 */
export interface Plugin {
    /**
     * The version of the plug-in interface used by the plug-in. This will be used by
     * the plug-in host to handle version changes.
     */
    version: '1';
    /**
     * When defined, this function is invoked right after the plug-in has been loaded,
     * so that the plug-in is able to initialize itself. It may call methods of the
     * ``PluginHost`` instance it receives to register new ``CredentialProviderSource``
     * instances.
     */
    init?: (host: PluginHost) => void;
}
/**
 * A utility to manage plug-ins.
 *
 * @experimental
 */
export declare class PluginHost {
    static instance: PluginHost;
    /**
     * Access the currently registered CredentialProviderSources. New sources can
     * be registered using the +registerCredentialProviderSource+ method.
     */
    readonly credentialProviderSources: CredentialProviderSource[];
    constructor();
    /**
     * Loads a plug-in into this PluginHost.
     *
     * @param moduleSpec the specification (path or name) of the plug-in module to be loaded.
     */
    load(moduleSpec: string): void;
    /**
     * Allows plug-ins to register new CredentialProviderSources.
     *
     * @param source a new CredentialProviderSource to register.
     */
    registerCredentialProviderSource(source: CredentialProviderSource): void;
}
