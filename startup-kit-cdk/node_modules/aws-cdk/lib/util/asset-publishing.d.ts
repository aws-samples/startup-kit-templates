import * as cxapi from '@aws-cdk/cx-api';
import * as cdk_assets from 'cdk-assets';
import { SdkProvider } from '../api';
/**
 * Use cdk-assets to publish all assets in the given manifest.
 */
export declare function publishAssets(manifest: cdk_assets.AssetManifest, sdk: SdkProvider, targetEnv: cxapi.Environment): Promise<void>;
