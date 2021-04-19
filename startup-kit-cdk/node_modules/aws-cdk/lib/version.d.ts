export declare const DISPLAY_VERSION: string;
export declare function versionNumber(): string;
export declare class VersionCheckTTL {
    static timestampFilePath(): string;
    private readonly file;
    private readonly ttlSecs;
    constructor(file?: string, ttlSecs?: number);
    hasExpired(): Promise<boolean>;
    update(latestVersion?: string): Promise<void>;
}
export declare function latestVersionIfHigher(currentVersion: string, cacheFile: VersionCheckTTL): Promise<string | null>;
export declare function displayVersionMessage(): Promise<void>;
