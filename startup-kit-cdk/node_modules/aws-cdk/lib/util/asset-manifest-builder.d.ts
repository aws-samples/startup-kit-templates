import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cdk_assets from 'cdk-assets';
export declare class AssetManifestBuilder {
    private readonly manifest;
    addFileAsset(id: string, source: cxschema.FileSource, destination: cxschema.FileDestination): void;
    addDockerImageAsset(id: string, source: cxschema.DockerImageSource, destination: cxschema.DockerImageDestination): void;
    toManifest(directory: string): cdk_assets.AssetManifest;
}
