import { AssetManifest, IManifestEntry } from '../../asset-manifest';
import { IAssetHandler, IHandlerHost } from '../asset-handler';
export declare function makeAssetHandler(manifest: AssetManifest, asset: IManifestEntry, host: IHandlerHost): IAssetHandler;
