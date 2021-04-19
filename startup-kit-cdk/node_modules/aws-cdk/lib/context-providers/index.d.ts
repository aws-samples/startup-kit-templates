import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { SdkProvider } from '../api';
import { Context } from '../settings';
import { ContextProviderPlugin } from './provider';
declare type ProviderConstructor = (new (sdk: SdkProvider) => ContextProviderPlugin);
export declare type ProviderMap = {
    [name: string]: ProviderConstructor;
};
/**
 * Iterate over the list of missing context values and invoke the appropriate providers from the map to retrieve them
 */
export declare function provideContextValues(missingValues: cxschema.MissingContext[], context: Context, sdk: SdkProvider): Promise<void>;
/**
 * Register a context provider
 *
 * (Only available for testing right now).
 */
export declare function registerContextProvider(name: string, provider: ProviderConstructor): void;
export {};
