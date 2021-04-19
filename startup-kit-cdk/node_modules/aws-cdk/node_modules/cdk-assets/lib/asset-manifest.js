"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DestinationPattern = exports.DestinationIdentifier = exports.DockerImageManifestEntry = exports.FileManifestEntry = exports.AssetManifest = void 0;
const fs = require("fs");
const path = require("path");
const cloud_assembly_schema_1 = require("@aws-cdk/cloud-assembly-schema");
/**
 * A manifest of assets
 */
class AssetManifest {
    constructor(directory, manifest) {
        this.manifest = manifest;
        this.directory = directory;
    }
    /**
     * Load an asset manifest from the given file
     */
    static fromFile(fileName) {
        try {
            const obj = cloud_assembly_schema_1.Manifest.loadAssetManifest(fileName);
            return new AssetManifest(path.dirname(fileName), obj);
        }
        catch (e) {
            throw new Error(`Canot read asset manifest '${fileName}': ${e.message}`);
        }
    }
    /**
     * Load an asset manifest from the given file or directory
     *
     * If the argument given is a directoy, the default asset file name will be used.
     */
    static fromPath(filePath) {
        let st;
        try {
            st = fs.statSync(filePath);
        }
        catch (e) {
            throw new Error(`Cannot read asset manifest at '${filePath}': ${e.message}`);
        }
        if (st.isDirectory()) {
            return AssetManifest.fromFile(path.join(filePath, AssetManifest.DEFAULT_FILENAME));
        }
        return AssetManifest.fromFile(filePath);
    }
    /**
     * Select a subset of assets and destinations from this manifest.
     *
     * Only assets with at least 1 selected destination are retained.
     *
     * If selection is not given, everything is returned.
     */
    select(selection) {
        if (selection === undefined) {
            return this;
        }
        const ret = { version: this.manifest.version, dockerImages: {}, files: {} };
        for (const assetType of ASSET_TYPES) {
            for (const [assetId, asset] of Object.entries(this.manifest[assetType] || {})) {
                const filteredDestinations = filterDict(asset.destinations, (_, destId) => selection.some(sel => sel.matches(new DestinationIdentifier(assetId, destId))));
                if (Object.keys(filteredDestinations).length > 0) {
                    ret[assetType][assetId] = {
                        ...asset,
                        destinations: filteredDestinations,
                    };
                }
            }
        }
        return new AssetManifest(this.directory, ret);
    }
    /**
     * Describe the asset manifest as a list of strings
     */
    list() {
        return [
            ...describeAssets('file', this.manifest.files || {}),
            ...describeAssets('docker-image', this.manifest.dockerImages || {}),
        ];
        function describeAssets(type, assets) {
            const ret = new Array();
            for (const [assetId, asset] of Object.entries(assets || {})) {
                ret.push(`${assetId} ${type} ${JSON.stringify(asset.source)}`);
                const destStrings = Object.entries(asset.destinations).map(([destId, dest]) => ` ${assetId}:${destId} ${JSON.stringify(dest)}`);
                ret.push(...prefixTreeChars(destStrings, '  '));
            }
            return ret;
        }
    }
    /**
     * List of assets, splat out to destinations
     */
    get entries() {
        return [
            ...makeEntries(this.manifest.files || {}, FileManifestEntry),
            ...makeEntries(this.manifest.dockerImages || {}, DockerImageManifestEntry),
        ];
        function makeEntries(assets, ctor) {
            const ret = new Array();
            for (const [assetId, asset] of Object.entries(assets)) {
                for (const [destId, destination] of Object.entries(asset.destinations)) {
                    ret.push(new ctor(new DestinationIdentifier(assetId, destId), asset.source, destination));
                }
            }
            return ret;
        }
    }
}
exports.AssetManifest = AssetManifest;
/**
 * The default name of the asset manifest in a cdk.out directory
 */
AssetManifest.DEFAULT_FILENAME = 'assets.json';
const ASSET_TYPES = ['files', 'dockerImages'];
/**
 * A manifest entry for a file asset
 */
class FileManifestEntry {
    constructor(
    /** Identifier for this asset */
    id, 
    /** Source of the file asset */
    source, 
    /** Destination for the file asset */
    destination) {
        this.id = id;
        this.source = source;
        this.destination = destination;
        this.type = 'file';
        this.genericSource = source;
        this.genericDestination = destination;
    }
}
exports.FileManifestEntry = FileManifestEntry;
/**
 * A manifest entry for a docker image asset
 */
class DockerImageManifestEntry {
    constructor(
    /** Identifier for this asset */
    id, 
    /** Source of the file asset */
    source, 
    /** Destination for the file asset */
    destination) {
        this.id = id;
        this.source = source;
        this.destination = destination;
        this.type = 'docker-image';
        this.genericSource = source;
        this.genericDestination = destination;
    }
}
exports.DockerImageManifestEntry = DockerImageManifestEntry;
/**
 * Identify an asset destination in an asset manifest
 */
class DestinationIdentifier {
    constructor(assetId, destinationId) {
        this.assetId = assetId;
        this.destinationId = destinationId;
    }
    /**
     * Return a string representation for this asset identifier
     */
    toString() {
        return this.destinationId ? `${this.assetId}:${this.destinationId}` : this.assetId;
    }
}
exports.DestinationIdentifier = DestinationIdentifier;
function filterDict(xs, pred) {
    const ret = {};
    for (const [key, value] of Object.entries(xs)) {
        if (pred(value, key)) {
            ret[key] = value;
        }
    }
    return ret;
}
/**
 * A filter pattern for an destination identifier
 */
class DestinationPattern {
    constructor(assetId, destinationId) {
        this.assetId = assetId;
        this.destinationId = destinationId;
    }
    /**
     * Parse a ':'-separated string into an asset/destination identifier
     */
    static parse(s) {
        if (!s) {
            throw new Error('Empty string is not a valid destination identifier');
        }
        const parts = s.split(':').map(x => x !== '*' ? x : undefined);
        if (parts.length === 1) {
            return new DestinationPattern(parts[0]);
        }
        if (parts.length === 2) {
            return new DestinationPattern(parts[0] || undefined, parts[1] || undefined);
        }
        throw new Error(`Asset identifier must contain at most 2 ':'-separated parts, got '${s}'`);
    }
    /**
     * Whether or not this pattern matches the given identifier
     */
    matches(id) {
        return (this.assetId === undefined || this.assetId === id.assetId)
            && (this.destinationId === undefined || this.destinationId === id.destinationId);
    }
    /**
     * Return a string representation for this asset identifier
     */
    toString() {
        var _a, _b;
        return `${(_a = this.assetId) !== null && _a !== void 0 ? _a : '*'}:${(_b = this.destinationId) !== null && _b !== void 0 ? _b : '*'}`;
    }
}
exports.DestinationPattern = DestinationPattern;
/**
 * Prefix box-drawing characters to make lines look like a hanging tree
 */
function prefixTreeChars(xs, prefix = '') {
    const ret = new Array();
    for (let i = 0; i < xs.length; i++) {
        const isLast = i === xs.length - 1;
        const boxChar = isLast ? '└' : '├';
        ret.push(`${prefix}${boxChar}${xs[i]}`);
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtbWFuaWZlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhc3NldC1tYW5pZmVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLDBFQUd3QztBQUV4Qzs7R0FFRztBQUNILE1BQWEsYUFBYTtJQXlDeEIsWUFBWSxTQUFpQixFQUFtQixRQUE2QjtRQUE3QixhQUFRLEdBQVIsUUFBUSxDQUFxQjtRQUMzRSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUM3QixDQUFDO0lBckNEOztPQUVHO0lBQ0ksTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFnQjtRQUNyQyxJQUFJO1lBQ0YsTUFBTSxHQUFHLEdBQUcsZ0NBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNqRCxPQUFPLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDdkQ7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQThCLFFBQVEsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztTQUMxRTtJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFnQjtRQUNyQyxJQUFJLEVBQUUsQ0FBQztRQUNQLElBQUk7WUFDRixFQUFFLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUM1QjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsUUFBUSxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQzlFO1FBQ0QsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDcEIsT0FBTyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7U0FDcEY7UUFDRCxPQUFPLGFBQWEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQVdEOzs7Ozs7T0FNRztJQUNJLE1BQU0sQ0FBQyxTQUFnQztRQUM1QyxJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUU7WUFBRSxPQUFPLElBQUksQ0FBQztTQUFFO1FBRTdDLE1BQU0sR0FBRyxHQUNOLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxDQUFDO1FBRW5FLEtBQUssTUFBTSxTQUFTLElBQUksV0FBVyxFQUFFO1lBQ25DLEtBQUssTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUU7Z0JBQzdFLE1BQU0sb0JBQW9CLEdBQUcsVUFBVSxDQUNyQyxLQUFLLENBQUMsWUFBWSxFQUNsQixDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUkscUJBQXFCLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVqRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUNoRCxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUc7d0JBQ3hCLEdBQUcsS0FBSzt3QkFDUixZQUFZLEVBQUUsb0JBQW9CO3FCQUNuQyxDQUFDO2lCQUNIO2FBQ0Y7U0FDRjtRQUVELE9BQU8sSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxJQUFJO1FBQ1QsT0FBTztZQUNMLEdBQUcsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDcEQsR0FBRyxjQUFjLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQztTQUNwRSxDQUFDO1FBRUYsU0FBUyxjQUFjLENBQUMsSUFBWSxFQUFFLE1BQTBFO1lBQzlHLE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxFQUFVLENBQUM7WUFDaEMsS0FBSyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxFQUFFO2dCQUMzRCxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBRS9ELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLE9BQU8sSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2hJLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxlQUFlLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDakQ7WUFDRCxPQUFPLEdBQUcsQ0FBQztRQUNiLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFXLE9BQU87UUFDaEIsT0FBTztZQUNMLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxJQUFJLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQztZQUM1RCxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksSUFBSSxFQUFFLEVBQUUsd0JBQXdCLENBQUM7U0FDM0UsQ0FBQztRQUVGLFNBQVMsV0FBVyxDQUNsQixNQUFzRSxFQUN0RSxJQUFxRTtZQUVyRSxNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssRUFBSyxDQUFDO1lBQzNCLEtBQUssTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUNyRCxLQUFLLE1BQU0sQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUU7b0JBQ3RFLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO2lCQUMzRjthQUNGO1lBQ0QsT0FBTyxHQUFHLENBQUM7UUFDYixDQUFDO0lBQ0gsQ0FBQzs7QUF0SEgsc0NBdUhDO0FBdEhDOztHQUVHO0FBQ29CLDhCQUFnQixHQUFHLGFBQWEsQ0FBQztBQXVIMUQsTUFBTSxXQUFXLEdBQWdCLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0FBMkIzRDs7R0FFRztBQUNILE1BQWEsaUJBQWlCO0lBSzVCO0lBQ0UsZ0NBQWdDO0lBQ2hCLEVBQXlCO0lBQ3pDLCtCQUErQjtJQUNmLE1BQWtCO0lBQ2xDLHFDQUFxQztJQUNyQixXQUE0QjtRQUo1QixPQUFFLEdBQUYsRUFBRSxDQUF1QjtRQUV6QixXQUFNLEdBQU4sTUFBTSxDQUFZO1FBRWxCLGdCQUFXLEdBQVgsV0FBVyxDQUFpQjtRQVI5QixTQUFJLEdBQUcsTUFBTSxDQUFDO1FBVTVCLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDO1FBQzVCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxXQUFXLENBQUM7SUFDeEMsQ0FBQztDQUNGO0FBaEJELDhDQWdCQztBQUVEOztHQUVHO0FBQ0gsTUFBYSx3QkFBd0I7SUFLbkM7SUFDRSxnQ0FBZ0M7SUFDaEIsRUFBeUI7SUFDekMsK0JBQStCO0lBQ2YsTUFBeUI7SUFDekMscUNBQXFDO0lBQ3JCLFdBQW1DO1FBSm5DLE9BQUUsR0FBRixFQUFFLENBQXVCO1FBRXpCLFdBQU0sR0FBTixNQUFNLENBQW1CO1FBRXpCLGdCQUFXLEdBQVgsV0FBVyxDQUF3QjtRQVJyQyxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBVXBDLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDO1FBQzVCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxXQUFXLENBQUM7SUFDeEMsQ0FBQztDQUNGO0FBaEJELDREQWdCQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxxQkFBcUI7SUFXaEMsWUFBWSxPQUFlLEVBQUUsYUFBcUI7UUFDaEQsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7SUFDckMsQ0FBQztJQUVEOztPQUVHO0lBQ0ksUUFBUTtRQUNiLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUNyRixDQUFDO0NBQ0Y7QUF0QkQsc0RBc0JDO0FBRUQsU0FBUyxVQUFVLENBQUksRUFBcUIsRUFBRSxJQUFvQztJQUNoRixNQUFNLEdBQUcsR0FBc0IsRUFBRSxDQUFDO0lBQ2xDLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1FBQzdDLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsRUFBRTtZQUNwQixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO1NBQ2xCO0tBQ0Y7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQWEsa0JBQWtCO0lBc0I3QixZQUFZLE9BQWdCLEVBQUUsYUFBc0I7UUFDbEQsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7SUFDckMsQ0FBQztJQXhCRDs7T0FFRztJQUNJLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBUztRQUMzQixJQUFJLENBQUMsQ0FBQyxFQUFFO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO1NBQUU7UUFDbEYsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQy9ELElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFBRSxPQUFPLElBQUksa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FBRTtRQUNwRSxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQUUsT0FBTyxJQUFJLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDO1NBQUU7UUFDeEcsTUFBTSxJQUFJLEtBQUssQ0FBQyxxRUFBcUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM3RixDQUFDO0lBaUJEOztPQUVHO0lBQ0ksT0FBTyxDQUFDLEVBQXlCO1FBQ3RDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUM7ZUFDL0QsQ0FBQyxJQUFJLENBQUMsYUFBYSxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBRUQ7O09BRUc7SUFDSSxRQUFROztRQUNiLE9BQU8sR0FBRyxNQUFBLElBQUksQ0FBQyxPQUFPLG1DQUFJLEdBQUcsSUFBSSxNQUFBLElBQUksQ0FBQyxhQUFhLG1DQUFJLEdBQUcsRUFBRSxDQUFDO0lBQy9ELENBQUM7Q0FDRjtBQXpDRCxnREF5Q0M7QUFFRDs7R0FFRztBQUNILFNBQVMsZUFBZSxDQUFDLEVBQVksRUFBRSxNQUFNLEdBQUcsRUFBRTtJQUNoRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssRUFBVSxDQUFDO0lBQ2hDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ2xDLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNuQyxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ25DLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLEdBQUcsT0FBTyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDekM7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtcbiAgQXNzZXRNYW5pZmVzdCBhcyBBc3NldE1hbmlmZXN0U2NoZW1hLCBEb2NrZXJJbWFnZURlc3RpbmF0aW9uLCBEb2NrZXJJbWFnZVNvdXJjZSxcbiAgRmlsZURlc3RpbmF0aW9uLCBGaWxlU291cmNlLCBNYW5pZmVzdCxcbn0gZnJvbSAnQGF3cy1jZGsvY2xvdWQtYXNzZW1ibHktc2NoZW1hJztcblxuLyoqXG4gKiBBIG1hbmlmZXN0IG9mIGFzc2V0c1xuICovXG5leHBvcnQgY2xhc3MgQXNzZXRNYW5pZmVzdCB7XG4gIC8qKlxuICAgKiBUaGUgZGVmYXVsdCBuYW1lIG9mIHRoZSBhc3NldCBtYW5pZmVzdCBpbiBhIGNkay5vdXQgZGlyZWN0b3J5XG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfRklMRU5BTUUgPSAnYXNzZXRzLmpzb24nO1xuXG4gIC8qKlxuICAgKiBMb2FkIGFuIGFzc2V0IG1hbmlmZXN0IGZyb20gdGhlIGdpdmVuIGZpbGVcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZnJvbUZpbGUoZmlsZU5hbWU6IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvYmogPSBNYW5pZmVzdC5sb2FkQXNzZXRNYW5pZmVzdChmaWxlTmFtZSk7XG4gICAgICByZXR1cm4gbmV3IEFzc2V0TWFuaWZlc3QocGF0aC5kaXJuYW1lKGZpbGVOYW1lKSwgb2JqKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm90IHJlYWQgYXNzZXQgbWFuaWZlc3QgJyR7ZmlsZU5hbWV9JzogJHtlLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYW4gYXNzZXQgbWFuaWZlc3QgZnJvbSB0aGUgZ2l2ZW4gZmlsZSBvciBkaXJlY3RvcnlcbiAgICpcbiAgICogSWYgdGhlIGFyZ3VtZW50IGdpdmVuIGlzIGEgZGlyZWN0b3ksIHRoZSBkZWZhdWx0IGFzc2V0IGZpbGUgbmFtZSB3aWxsIGJlIHVzZWQuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGZyb21QYXRoKGZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgICBsZXQgc3Q7XG4gICAgdHJ5IHtcbiAgICAgIHN0ID0gZnMuc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlYWQgYXNzZXQgbWFuaWZlc3QgYXQgJyR7ZmlsZVBhdGh9JzogJHtlLm1lc3NhZ2V9YCk7XG4gICAgfVxuICAgIGlmIChzdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICByZXR1cm4gQXNzZXRNYW5pZmVzdC5mcm9tRmlsZShwYXRoLmpvaW4oZmlsZVBhdGgsIEFzc2V0TWFuaWZlc3QuREVGQVVMVF9GSUxFTkFNRSkpO1xuICAgIH1cbiAgICByZXR1cm4gQXNzZXRNYW5pZmVzdC5mcm9tRmlsZShmaWxlUGF0aCk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGRpcmVjdG9yeSB3aGVyZSB0aGUgbWFuaWZlc3Qgd2FzIGZvdW5kXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZGlyZWN0b3J5OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoZGlyZWN0b3J5OiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgbWFuaWZlc3Q6IEFzc2V0TWFuaWZlc3RTY2hlbWEpIHtcbiAgICB0aGlzLmRpcmVjdG9yeSA9IGRpcmVjdG9yeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWxlY3QgYSBzdWJzZXQgb2YgYXNzZXRzIGFuZCBkZXN0aW5hdGlvbnMgZnJvbSB0aGlzIG1hbmlmZXN0LlxuICAgKlxuICAgKiBPbmx5IGFzc2V0cyB3aXRoIGF0IGxlYXN0IDEgc2VsZWN0ZWQgZGVzdGluYXRpb24gYXJlIHJldGFpbmVkLlxuICAgKlxuICAgKiBJZiBzZWxlY3Rpb24gaXMgbm90IGdpdmVuLCBldmVyeXRoaW5nIGlzIHJldHVybmVkLlxuICAgKi9cbiAgcHVibGljIHNlbGVjdChzZWxlY3Rpb24/OiBEZXN0aW5hdGlvblBhdHRlcm5bXSk6IEFzc2V0TWFuaWZlc3Qge1xuICAgIGlmIChzZWxlY3Rpb24gPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gdGhpczsgfVxuXG4gICAgY29uc3QgcmV0OiBBc3NldE1hbmlmZXN0U2NoZW1hICYgUmVxdWlyZWQ8UGljazxBc3NldE1hbmlmZXN0U2NoZW1hLCBBc3NldFR5cGU+PlxuICAgICA9IHsgdmVyc2lvbjogdGhpcy5tYW5pZmVzdC52ZXJzaW9uLCBkb2NrZXJJbWFnZXM6IHt9LCBmaWxlczoge30gfTtcblxuICAgIGZvciAoY29uc3QgYXNzZXRUeXBlIG9mIEFTU0VUX1RZUEVTKSB7XG4gICAgICBmb3IgKGNvbnN0IFthc3NldElkLCBhc3NldF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tYW5pZmVzdFthc3NldFR5cGVdIHx8IHt9KSkge1xuICAgICAgICBjb25zdCBmaWx0ZXJlZERlc3RpbmF0aW9ucyA9IGZpbHRlckRpY3QoXG4gICAgICAgICAgYXNzZXQuZGVzdGluYXRpb25zLFxuICAgICAgICAgIChfLCBkZXN0SWQpID0+IHNlbGVjdGlvbi5zb21lKHNlbCA9PiBzZWwubWF0Y2hlcyhuZXcgRGVzdGluYXRpb25JZGVudGlmaWVyKGFzc2V0SWQsIGRlc3RJZCkpKSk7XG5cbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKGZpbHRlcmVkRGVzdGluYXRpb25zKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmV0W2Fzc2V0VHlwZV1bYXNzZXRJZF0gPSB7XG4gICAgICAgICAgICAuLi5hc3NldCxcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uczogZmlsdGVyZWREZXN0aW5hdGlvbnMsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXcgQXNzZXRNYW5pZmVzdCh0aGlzLmRpcmVjdG9yeSwgcmV0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNjcmliZSB0aGUgYXNzZXQgbWFuaWZlc3QgYXMgYSBsaXN0IG9mIHN0cmluZ3NcbiAgICovXG4gIHB1YmxpYyBsaXN0KCkge1xuICAgIHJldHVybiBbXG4gICAgICAuLi5kZXNjcmliZUFzc2V0cygnZmlsZScsIHRoaXMubWFuaWZlc3QuZmlsZXMgfHwge30pLFxuICAgICAgLi4uZGVzY3JpYmVBc3NldHMoJ2RvY2tlci1pbWFnZScsIHRoaXMubWFuaWZlc3QuZG9ja2VySW1hZ2VzIHx8IHt9KSxcbiAgICBdO1xuXG4gICAgZnVuY3Rpb24gZGVzY3JpYmVBc3NldHModHlwZTogc3RyaW5nLCBhc3NldHM6IFJlY29yZDxzdHJpbmcsIHsgc291cmNlOiBhbnksIGRlc3RpbmF0aW9uczogUmVjb3JkPHN0cmluZywgYW55PiB9Pikge1xuICAgICAgY29uc3QgcmV0ID0gbmV3IEFycmF5PHN0cmluZz4oKTtcbiAgICAgIGZvciAoY29uc3QgW2Fzc2V0SWQsIGFzc2V0XSBvZiBPYmplY3QuZW50cmllcyhhc3NldHMgfHwge30pKSB7XG4gICAgICAgIHJldC5wdXNoKGAke2Fzc2V0SWR9ICR7dHlwZX0gJHtKU09OLnN0cmluZ2lmeShhc3NldC5zb3VyY2UpfWApO1xuXG4gICAgICAgIGNvbnN0IGRlc3RTdHJpbmdzID0gT2JqZWN0LmVudHJpZXMoYXNzZXQuZGVzdGluYXRpb25zKS5tYXAoKFtkZXN0SWQsIGRlc3RdKSA9PiBgICR7YXNzZXRJZH06JHtkZXN0SWR9ICR7SlNPTi5zdHJpbmdpZnkoZGVzdCl9YCk7XG4gICAgICAgIHJldC5wdXNoKC4uLnByZWZpeFRyZWVDaGFycyhkZXN0U3RyaW5ncywgJyAgJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTGlzdCBvZiBhc3NldHMsIHNwbGF0IG91dCB0byBkZXN0aW5hdGlvbnNcbiAgICovXG4gIHB1YmxpYyBnZXQgZW50cmllcygpOiBJTWFuaWZlc3RFbnRyeVtdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4ubWFrZUVudHJpZXModGhpcy5tYW5pZmVzdC5maWxlcyB8fCB7fSwgRmlsZU1hbmlmZXN0RW50cnkpLFxuICAgICAgLi4ubWFrZUVudHJpZXModGhpcy5tYW5pZmVzdC5kb2NrZXJJbWFnZXMgfHwge30sIERvY2tlckltYWdlTWFuaWZlc3RFbnRyeSksXG4gICAgXTtcblxuICAgIGZ1bmN0aW9uIG1ha2VFbnRyaWVzPEEsIEIsIEM+KFxuICAgICAgYXNzZXRzOiBSZWNvcmQ8c3RyaW5nLCB7IHNvdXJjZTogQSwgZGVzdGluYXRpb25zOiBSZWNvcmQ8c3RyaW5nLCBCPiB9PixcbiAgICAgIGN0b3I6IG5ldyAoaWQ6IERlc3RpbmF0aW9uSWRlbnRpZmllciwgc291cmNlOiBBLCBkZXN0aW5hdGlvbjogQikgPT4gQyk6IENbXSB7XG5cbiAgICAgIGNvbnN0IHJldCA9IG5ldyBBcnJheTxDPigpO1xuICAgICAgZm9yIChjb25zdCBbYXNzZXRJZCwgYXNzZXRdIG9mIE9iamVjdC5lbnRyaWVzKGFzc2V0cykpIHtcbiAgICAgICAgZm9yIChjb25zdCBbZGVzdElkLCBkZXN0aW5hdGlvbl0gb2YgT2JqZWN0LmVudHJpZXMoYXNzZXQuZGVzdGluYXRpb25zKSkge1xuICAgICAgICAgIHJldC5wdXNoKG5ldyBjdG9yKG5ldyBEZXN0aW5hdGlvbklkZW50aWZpZXIoYXNzZXRJZCwgZGVzdElkKSwgYXNzZXQuc291cmNlLCBkZXN0aW5hdGlvbikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH1cbiAgfVxufVxuXG50eXBlIEFzc2V0VHlwZSA9ICdmaWxlcycgfCAnZG9ja2VySW1hZ2VzJztcblxuY29uc3QgQVNTRVRfVFlQRVM6IEFzc2V0VHlwZVtdID0gWydmaWxlcycsICdkb2NrZXJJbWFnZXMnXTtcblxuLyoqXG4gKiBBIHNpbmdsZSBhc3NldCBmcm9tIGFuIGFzc2V0IG1hbmlmZXN0J1xuICovXG5leHBvcnQgaW50ZXJmYWNlIElNYW5pZmVzdEVudHJ5IHtcbiAgLyoqXG4gICAqIFRoZSBpZGVudGlmaWVyIG9mIHRoZSBhc3NldFxuICAgKi9cbiAgcmVhZG9ubHkgaWQ6IERlc3RpbmF0aW9uSWRlbnRpZmllcjtcblxuICAvKipcbiAgICogVGhlIHR5cGUgb2YgYXNzZXRcbiAgICovXG4gIHJlYWRvbmx5IHR5cGU6IHN0cmluZztcblxuICAvKipcbiAgICogVHlwZS1kZXBlbmRlbnQgc291cmNlIGRhdGFcbiAgICovXG4gIHJlYWRvbmx5IGdlbmVyaWNTb3VyY2U6IHVua25vd247XG5cbiAgLyoqXG4gICAqIFR5cGUtZGVwZW5kZW50IGRlc3RpbmF0aW9uIGRhdGFcbiAgICovXG4gIHJlYWRvbmx5IGdlbmVyaWNEZXN0aW5hdGlvbjogdW5rbm93bjtcbn1cblxuLyoqXG4gKiBBIG1hbmlmZXN0IGVudHJ5IGZvciBhIGZpbGUgYXNzZXRcbiAqL1xuZXhwb3J0IGNsYXNzIEZpbGVNYW5pZmVzdEVudHJ5IGltcGxlbWVudHMgSU1hbmlmZXN0RW50cnkge1xuICBwdWJsaWMgcmVhZG9ubHkgZ2VuZXJpY1NvdXJjZTogdW5rbm93bjtcbiAgcHVibGljIHJlYWRvbmx5IGdlbmVyaWNEZXN0aW5hdGlvbjogdW5rbm93bjtcbiAgcHVibGljIHJlYWRvbmx5IHR5cGUgPSAnZmlsZSc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgLyoqIElkZW50aWZpZXIgZm9yIHRoaXMgYXNzZXQgKi9cbiAgICBwdWJsaWMgcmVhZG9ubHkgaWQ6IERlc3RpbmF0aW9uSWRlbnRpZmllcixcbiAgICAvKiogU291cmNlIG9mIHRoZSBmaWxlIGFzc2V0ICovXG4gICAgcHVibGljIHJlYWRvbmx5IHNvdXJjZTogRmlsZVNvdXJjZSxcbiAgICAvKiogRGVzdGluYXRpb24gZm9yIHRoZSBmaWxlIGFzc2V0ICovXG4gICAgcHVibGljIHJlYWRvbmx5IGRlc3RpbmF0aW9uOiBGaWxlRGVzdGluYXRpb24sXG4gICkge1xuICAgIHRoaXMuZ2VuZXJpY1NvdXJjZSA9IHNvdXJjZTtcbiAgICB0aGlzLmdlbmVyaWNEZXN0aW5hdGlvbiA9IGRlc3RpbmF0aW9uO1xuICB9XG59XG5cbi8qKlxuICogQSBtYW5pZmVzdCBlbnRyeSBmb3IgYSBkb2NrZXIgaW1hZ2UgYXNzZXRcbiAqL1xuZXhwb3J0IGNsYXNzIERvY2tlckltYWdlTWFuaWZlc3RFbnRyeSBpbXBsZW1lbnRzIElNYW5pZmVzdEVudHJ5IHtcbiAgcHVibGljIHJlYWRvbmx5IGdlbmVyaWNTb3VyY2U6IHVua25vd247XG4gIHB1YmxpYyByZWFkb25seSBnZW5lcmljRGVzdGluYXRpb246IHVua25vd247XG4gIHB1YmxpYyByZWFkb25seSB0eXBlID0gJ2RvY2tlci1pbWFnZSc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgLyoqIElkZW50aWZpZXIgZm9yIHRoaXMgYXNzZXQgKi9cbiAgICBwdWJsaWMgcmVhZG9ubHkgaWQ6IERlc3RpbmF0aW9uSWRlbnRpZmllcixcbiAgICAvKiogU291cmNlIG9mIHRoZSBmaWxlIGFzc2V0ICovXG4gICAgcHVibGljIHJlYWRvbmx5IHNvdXJjZTogRG9ja2VySW1hZ2VTb3VyY2UsXG4gICAgLyoqIERlc3RpbmF0aW9uIGZvciB0aGUgZmlsZSBhc3NldCAqL1xuICAgIHB1YmxpYyByZWFkb25seSBkZXN0aW5hdGlvbjogRG9ja2VySW1hZ2VEZXN0aW5hdGlvbixcbiAgKSB7XG4gICAgdGhpcy5nZW5lcmljU291cmNlID0gc291cmNlO1xuICAgIHRoaXMuZ2VuZXJpY0Rlc3RpbmF0aW9uID0gZGVzdGluYXRpb247XG4gIH1cbn1cblxuLyoqXG4gKiBJZGVudGlmeSBhbiBhc3NldCBkZXN0aW5hdGlvbiBpbiBhbiBhc3NldCBtYW5pZmVzdFxuICovXG5leHBvcnQgY2xhc3MgRGVzdGluYXRpb25JZGVudGlmaWVyIHtcbiAgLyoqXG4gICAqIElkZW50aWZpZXMgdGhlIGFzc2V0LCBieSBzb3VyY2UuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYXNzZXRJZDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHRoZSBkZXN0aW5hdGlvbiB3aGVyZSB0aGlzIGFzc2V0IHdpbGwgYmUgcHVibGlzaGVkXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZGVzdGluYXRpb25JZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKGFzc2V0SWQ6IHN0cmluZywgZGVzdGluYXRpb25JZDogc3RyaW5nKSB7XG4gICAgdGhpcy5hc3NldElkID0gYXNzZXRJZDtcbiAgICB0aGlzLmRlc3RpbmF0aW9uSWQgPSBkZXN0aW5hdGlvbklkO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBmb3IgdGhpcyBhc3NldCBpZGVudGlmaWVyXG4gICAqL1xuICBwdWJsaWMgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGVzdGluYXRpb25JZCA/IGAke3RoaXMuYXNzZXRJZH06JHt0aGlzLmRlc3RpbmF0aW9uSWR9YCA6IHRoaXMuYXNzZXRJZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaWx0ZXJEaWN0PEE+KHhzOiBSZWNvcmQ8c3RyaW5nLCBBPiwgcHJlZDogKHg6IEEsIGtleTogc3RyaW5nKSA9PiBib29sZWFuKTogUmVjb3JkPHN0cmluZywgQT4ge1xuICBjb25zdCByZXQ6IFJlY29yZDxzdHJpbmcsIEE+ID0ge307XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHhzKSkge1xuICAgIGlmIChwcmVkKHZhbHVlLCBrZXkpKSB7XG4gICAgICByZXRba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIEEgZmlsdGVyIHBhdHRlcm4gZm9yIGFuIGRlc3RpbmF0aW9uIGlkZW50aWZpZXJcbiAqL1xuZXhwb3J0IGNsYXNzIERlc3RpbmF0aW9uUGF0dGVybiB7XG4gIC8qKlxuICAgKiBQYXJzZSBhICc6Jy1zZXBhcmF0ZWQgc3RyaW5nIGludG8gYW4gYXNzZXQvZGVzdGluYXRpb24gaWRlbnRpZmllclxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBwYXJzZShzOiBzdHJpbmcpIHtcbiAgICBpZiAoIXMpIHsgdGhyb3cgbmV3IEVycm9yKCdFbXB0eSBzdHJpbmcgaXMgbm90IGEgdmFsaWQgZGVzdGluYXRpb24gaWRlbnRpZmllcicpOyB9XG4gICAgY29uc3QgcGFydHMgPSBzLnNwbGl0KCc6JykubWFwKHggPT4geCAhPT0gJyonID8geCA6IHVuZGVmaW5lZCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMSkgeyByZXR1cm4gbmV3IERlc3RpbmF0aW9uUGF0dGVybihwYXJ0c1swXSk7IH1cbiAgICBpZiAocGFydHMubGVuZ3RoID09PSAyKSB7IHJldHVybiBuZXcgRGVzdGluYXRpb25QYXR0ZXJuKHBhcnRzWzBdIHx8IHVuZGVmaW5lZCwgcGFydHNbMV0gfHwgdW5kZWZpbmVkKTsgfVxuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXQgaWRlbnRpZmllciBtdXN0IGNvbnRhaW4gYXQgbW9zdCAyICc6Jy1zZXBhcmF0ZWQgcGFydHMsIGdvdCAnJHtzfSdgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHRoZSBhc3NldCwgYnkgc291cmNlLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGFzc2V0SWQ/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIElkZW50aWZpZXMgdGhlIGRlc3RpbmF0aW9uIHdoZXJlIHRoaXMgYXNzZXQgd2lsbCBiZSBwdWJsaXNoZWRcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBkZXN0aW5hdGlvbklkPzogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKGFzc2V0SWQ/OiBzdHJpbmcsIGRlc3RpbmF0aW9uSWQ/OiBzdHJpbmcpIHtcbiAgICB0aGlzLmFzc2V0SWQgPSBhc3NldElkO1xuICAgIHRoaXMuZGVzdGluYXRpb25JZCA9IGRlc3RpbmF0aW9uSWQ7XG4gIH1cblxuICAvKipcbiAgICogV2hldGhlciBvciBub3QgdGhpcyBwYXR0ZXJuIG1hdGNoZXMgdGhlIGdpdmVuIGlkZW50aWZpZXJcbiAgICovXG4gIHB1YmxpYyBtYXRjaGVzKGlkOiBEZXN0aW5hdGlvbklkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gKHRoaXMuYXNzZXRJZCA9PT0gdW5kZWZpbmVkIHx8IHRoaXMuYXNzZXRJZCA9PT0gaWQuYXNzZXRJZClcbiAgICAmJiAodGhpcy5kZXN0aW5hdGlvbklkID09PSB1bmRlZmluZWQgfHwgdGhpcy5kZXN0aW5hdGlvbklkID09PSBpZC5kZXN0aW5hdGlvbklkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gZm9yIHRoaXMgYXNzZXQgaWRlbnRpZmllclxuICAgKi9cbiAgcHVibGljIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmFzc2V0SWQgPz8gJyonfToke3RoaXMuZGVzdGluYXRpb25JZCA/PyAnKid9YDtcbiAgfVxufVxuXG4vKipcbiAqIFByZWZpeCBib3gtZHJhd2luZyBjaGFyYWN0ZXJzIHRvIG1ha2UgbGluZXMgbG9vayBsaWtlIGEgaGFuZ2luZyB0cmVlXG4gKi9cbmZ1bmN0aW9uIHByZWZpeFRyZWVDaGFycyh4czogc3RyaW5nW10sIHByZWZpeCA9ICcnKSB7XG4gIGNvbnN0IHJldCA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpc0xhc3QgPSBpID09PSB4cy5sZW5ndGggLSAxO1xuICAgIGNvbnN0IGJveENoYXIgPSBpc0xhc3QgPyAn4pSUJyA6ICfilJwnO1xuICAgIHJldC5wdXNoKGAke3ByZWZpeH0ke2JveENoYXJ9JHt4c1tpXX1gKTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuIl19