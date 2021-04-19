/**
 * A reimplementation of JS AWS SDK's SharedIniFile class
 *
 * We need that class to parse the ~/.aws/config file to determine the correct
 * region at runtime, but unfortunately it is private upstream.
 */
export interface SharedIniFileOptions {
    isConfig?: boolean;
    filename?: string;
}
export declare class SharedIniFile {
    private readonly isConfig;
    private readonly filename;
    private parsedContents?;
    constructor(options?: SharedIniFileOptions);
    getProfile(profile: string): Promise<{
        [key: string]: string;
    }>;
    private getDefaultFilepath;
    private ensureFileLoaded;
}
