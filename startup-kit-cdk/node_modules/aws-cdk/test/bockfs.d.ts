declare function bockfs(files: Record<string, string>): void;
declare namespace bockfs {
    /**
     * Write contents to a fake file
     */
    function write(fakeFilename: string, contents: string): void;
    /**
     * Turn a fake path into a real path
     */
    function path(fakePath: string): string;
    /**
     * Change to a fake directory
     */
    function workingDirectory(fakePath: string): void;
    function executable(...fakePaths: string[]): void;
    /**
     * Remove all files and restore working directory
     */
    function restore(): void;
}
export = bockfs;
