"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetManifestBuilder = void 0;
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cdk_assets = require("cdk-assets");
class AssetManifestBuilder {
    constructor() {
        this.manifest = {
            version: cxschema.Manifest.version(),
            files: {},
            dockerImages: {},
        };
    }
    addFileAsset(id, source, destination) {
        this.manifest.files[id] = {
            source,
            destinations: {
                current: destination,
            },
        };
    }
    addDockerImageAsset(id, source, destination) {
        this.manifest.dockerImages[id] = {
            source,
            destinations: {
                current: destination,
            },
        };
    }
    toManifest(directory) {
        return new cdk_assets.AssetManifest(directory, this.manifest);
    }
}
exports.AssetManifestBuilder = AssetManifestBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtbWFuaWZlc3QtYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFzc2V0LW1hbmlmZXN0LWJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkRBQTJEO0FBQzNELHlDQUF5QztBQUV6QyxNQUFhLG9CQUFvQjtJQUFqQztRQUNtQixhQUFRLEdBQTJCO1lBQ2xELE9BQU8sRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRTtZQUNwQyxLQUFLLEVBQUUsRUFBRTtZQUNULFlBQVksRUFBRSxFQUFFO1NBQ2pCLENBQUM7SUF1QkosQ0FBQztJQXJCUSxZQUFZLENBQUMsRUFBVSxFQUFFLE1BQTJCLEVBQUUsV0FBcUM7UUFDaEcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFNLENBQUMsRUFBRSxDQUFDLEdBQUc7WUFDekIsTUFBTTtZQUNOLFlBQVksRUFBRTtnQkFDWixPQUFPLEVBQUUsV0FBVzthQUNyQjtTQUNGLENBQUM7SUFDSixDQUFDO0lBRU0sbUJBQW1CLENBQUMsRUFBVSxFQUFFLE1BQWtDLEVBQUUsV0FBNEM7UUFDckgsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFhLENBQUMsRUFBRSxDQUFDLEdBQUc7WUFDaEMsTUFBTTtZQUNOLFlBQVksRUFBRTtnQkFDWixPQUFPLEVBQUUsV0FBVzthQUNyQjtTQUNGLENBQUM7SUFDSixDQUFDO0lBRU0sVUFBVSxDQUFDLFNBQWlCO1FBQ2pDLE9BQU8sSUFBSSxVQUFVLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEUsQ0FBQztDQUNGO0FBNUJELG9EQTRCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGN4c2NoZW1hIGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgKiBhcyBjZGtfYXNzZXRzIGZyb20gJ2Nkay1hc3NldHMnO1xuXG5leHBvcnQgY2xhc3MgQXNzZXRNYW5pZmVzdEJ1aWxkZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IG1hbmlmZXN0OiBjeHNjaGVtYS5Bc3NldE1hbmlmZXN0ID0ge1xuICAgIHZlcnNpb246IGN4c2NoZW1hLk1hbmlmZXN0LnZlcnNpb24oKSxcbiAgICBmaWxlczoge30sXG4gICAgZG9ja2VySW1hZ2VzOiB7fSxcbiAgfTtcblxuICBwdWJsaWMgYWRkRmlsZUFzc2V0KGlkOiBzdHJpbmcsIHNvdXJjZTogY3hzY2hlbWEuRmlsZVNvdXJjZSwgZGVzdGluYXRpb246IGN4c2NoZW1hLkZpbGVEZXN0aW5hdGlvbikge1xuICAgIHRoaXMubWFuaWZlc3QuZmlsZXMhW2lkXSA9IHtcbiAgICAgIHNvdXJjZSxcbiAgICAgIGRlc3RpbmF0aW9uczoge1xuICAgICAgICBjdXJyZW50OiBkZXN0aW5hdGlvbixcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHB1YmxpYyBhZGREb2NrZXJJbWFnZUFzc2V0KGlkOiBzdHJpbmcsIHNvdXJjZTogY3hzY2hlbWEuRG9ja2VySW1hZ2VTb3VyY2UsIGRlc3RpbmF0aW9uOiBjeHNjaGVtYS5Eb2NrZXJJbWFnZURlc3RpbmF0aW9uKSB7XG4gICAgdGhpcy5tYW5pZmVzdC5kb2NrZXJJbWFnZXMhW2lkXSA9IHtcbiAgICAgIHNvdXJjZSxcbiAgICAgIGRlc3RpbmF0aW9uczoge1xuICAgICAgICBjdXJyZW50OiBkZXN0aW5hdGlvbixcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHB1YmxpYyB0b01hbmlmZXN0KGRpcmVjdG9yeTogc3RyaW5nKTogY2RrX2Fzc2V0cy5Bc3NldE1hbmlmZXN0IHtcbiAgICByZXR1cm4gbmV3IGNka19hc3NldHMuQXNzZXRNYW5pZmVzdChkaXJlY3RvcnksIHRoaXMubWFuaWZlc3QpO1xuICB9XG59XG4iXX0=