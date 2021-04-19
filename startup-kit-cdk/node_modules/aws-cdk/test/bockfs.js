"use strict";
// A not-so-fake filesystem mock similar to mock-fs
//
// mock-fs is super convenient but we can't always use it:
// - When you use console.log() jest wants to load things from the filesystem (which fails).
// - When you make AWS calls the SDK wants to load things from the filesystem (which fails).
//
// Therefore, something similar which uses tempdirs on your actual disk.
//
// The big downside compared to mockfs is that you need to use bockfs.path() to translate
// fake paths to real paths.
const os = require("os");
const path_ = require("path");
const fs = require("fs-extra");
const bockFsRoot = fs.mkdtempSync(path_.join(os.tmpdir(), 'bockfs'));
let oldCwd;
function bockfs(files) {
    oldCwd = process.cwd();
    for (const [fileName, contents] of Object.entries(files)) {
        bockfs.write(fileName, contents);
    }
}
(function (bockfs) {
    /**
     * Write contents to a fake file
     */
    function write(fakeFilename, contents) {
        const fullPath = path(fakeFilename);
        fs.mkdirSync(path_.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, contents, { encoding: 'utf-8' });
    }
    bockfs.write = write;
    /**
     * Turn a fake path into a real path
     */
    function path(fakePath) {
        if (fakePath.startsWith('/')) {
            fakePath = fakePath.substr(1);
        } // Force path to be non-absolute
        return path_.join(bockFsRoot, fakePath);
    }
    bockfs.path = path;
    /**
     * Change to a fake directory
     */
    function workingDirectory(fakePath) {
        process.chdir(path(fakePath));
    }
    bockfs.workingDirectory = workingDirectory;
    function executable(...fakePaths) {
        for (const fakepath of fakePaths) {
            fs.chmodSync(path(fakepath), '755');
        }
    }
    bockfs.executable = executable;
    /**
     * Remove all files and restore working directory
     */
    function restore() {
        if (oldCwd) {
            process.chdir(oldCwd);
        }
        fs.removeSync(bockFsRoot);
    }
    bockfs.restore = restore;
})(bockfs || (bockfs = {}));
module.exports = bockfs;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9ja2ZzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9ja2ZzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxtREFBbUQ7QUFDbkQsRUFBRTtBQUNGLDBEQUEwRDtBQUMxRCw0RkFBNEY7QUFDNUYsNEZBQTRGO0FBQzVGLEVBQUU7QUFDRix3RUFBd0U7QUFDeEUsRUFBRTtBQUNGLHlGQUF5RjtBQUN6Riw0QkFBNEI7QUFDNUIseUJBQXlCO0FBQ3pCLDhCQUE4QjtBQUM5QiwrQkFBK0I7QUFFL0IsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3JFLElBQUksTUFBMEIsQ0FBQztBQUUvQixTQUFTLE1BQU0sQ0FBQyxLQUE2QjtJQUMzQyxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3hELE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0tBQ2xDO0FBQ0gsQ0FBQztBQUVELFdBQVUsTUFBTTtJQUNkOztPQUVHO0lBQ0gsU0FBZ0IsS0FBSyxDQUFDLFlBQW9CLEVBQUUsUUFBZ0I7UUFDMUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3BDLEVBQUUsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzNELEVBQUUsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFKZSxZQUFLLFFBSXBCLENBQUE7SUFFRDs7T0FFRztJQUNILFNBQWdCLElBQUksQ0FBQyxRQUFnQjtRQUNuQyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFBRSxRQUFRLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUFFLENBQUMsZ0NBQWdDO1FBQ2pHLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUhlLFdBQUksT0FHbkIsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsUUFBZ0I7UUFDL0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRmUsdUJBQWdCLG1CQUUvQixDQUFBO0lBRUQsU0FBZ0IsVUFBVSxDQUFDLEdBQUcsU0FBbUI7UUFDL0MsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUU7WUFDaEMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDckM7SUFDSCxDQUFDO0lBSmUsaUJBQVUsYUFJekIsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsT0FBTztRQUNyQixJQUFJLE1BQU0sRUFBRTtZQUNWLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDdkI7UUFDRCxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFMZSxjQUFPLFVBS3RCLENBQUE7QUFDSCxDQUFDLEVBeENTLE1BQU0sS0FBTixNQUFNLFFBd0NmO0FBRUQsaUJBQVMsTUFBTSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQSBub3Qtc28tZmFrZSBmaWxlc3lzdGVtIG1vY2sgc2ltaWxhciB0byBtb2NrLWZzXG4vL1xuLy8gbW9jay1mcyBpcyBzdXBlciBjb252ZW5pZW50IGJ1dCB3ZSBjYW4ndCBhbHdheXMgdXNlIGl0OlxuLy8gLSBXaGVuIHlvdSB1c2UgY29uc29sZS5sb2coKSBqZXN0IHdhbnRzIHRvIGxvYWQgdGhpbmdzIGZyb20gdGhlIGZpbGVzeXN0ZW0gKHdoaWNoIGZhaWxzKS5cbi8vIC0gV2hlbiB5b3UgbWFrZSBBV1MgY2FsbHMgdGhlIFNESyB3YW50cyB0byBsb2FkIHRoaW5ncyBmcm9tIHRoZSBmaWxlc3lzdGVtICh3aGljaCBmYWlscykuXG4vL1xuLy8gVGhlcmVmb3JlLCBzb21ldGhpbmcgc2ltaWxhciB3aGljaCB1c2VzIHRlbXBkaXJzIG9uIHlvdXIgYWN0dWFsIGRpc2suXG4vL1xuLy8gVGhlIGJpZyBkb3duc2lkZSBjb21wYXJlZCB0byBtb2NrZnMgaXMgdGhhdCB5b3UgbmVlZCB0byB1c2UgYm9ja2ZzLnBhdGgoKSB0byB0cmFuc2xhdGVcbi8vIGZha2UgcGF0aHMgdG8gcmVhbCBwYXRocy5cbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCAqIGFzIHBhdGhfIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMtZXh0cmEnO1xuXG5jb25zdCBib2NrRnNSb290ID0gZnMubWtkdGVtcFN5bmMocGF0aF8uam9pbihvcy50bXBkaXIoKSwgJ2JvY2tmcycpKTtcbmxldCBvbGRDd2Q6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuZnVuY3Rpb24gYm9ja2ZzKGZpbGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KSB7XG4gIG9sZEN3ZCA9IHByb2Nlc3MuY3dkKCk7XG4gIGZvciAoY29uc3QgW2ZpbGVOYW1lLCBjb250ZW50c10gb2YgT2JqZWN0LmVudHJpZXMoZmlsZXMpKSB7XG4gICAgYm9ja2ZzLndyaXRlKGZpbGVOYW1lLCBjb250ZW50cyk7XG4gIH1cbn1cblxubmFtZXNwYWNlIGJvY2tmcyB7XG4gIC8qKlxuICAgKiBXcml0ZSBjb250ZW50cyB0byBhIGZha2UgZmlsZVxuICAgKi9cbiAgZXhwb3J0IGZ1bmN0aW9uIHdyaXRlKGZha2VGaWxlbmFtZTogc3RyaW5nLCBjb250ZW50czogc3RyaW5nKSB7XG4gICAgY29uc3QgZnVsbFBhdGggPSBwYXRoKGZha2VGaWxlbmFtZSk7XG4gICAgZnMubWtkaXJTeW5jKHBhdGhfLmRpcm5hbWUoZnVsbFBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKGZ1bGxQYXRoLCBjb250ZW50cywgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUdXJuIGEgZmFrZSBwYXRoIGludG8gYSByZWFsIHBhdGhcbiAgICovXG4gIGV4cG9ydCBmdW5jdGlvbiBwYXRoKGZha2VQYXRoOiBzdHJpbmcpIHtcbiAgICBpZiAoZmFrZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7IGZha2VQYXRoID0gZmFrZVBhdGguc3Vic3RyKDEpOyB9IC8vIEZvcmNlIHBhdGggdG8gYmUgbm9uLWFic29sdXRlXG4gICAgcmV0dXJuIHBhdGhfLmpvaW4oYm9ja0ZzUm9vdCwgZmFrZVBhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSB0byBhIGZha2UgZGlyZWN0b3J5XG4gICAqL1xuICBleHBvcnQgZnVuY3Rpb24gd29ya2luZ0RpcmVjdG9yeShmYWtlUGF0aDogc3RyaW5nKSB7XG4gICAgcHJvY2Vzcy5jaGRpcihwYXRoKGZha2VQYXRoKSk7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gZXhlY3V0YWJsZSguLi5mYWtlUGF0aHM6IHN0cmluZ1tdKSB7XG4gICAgZm9yIChjb25zdCBmYWtlcGF0aCBvZiBmYWtlUGF0aHMpIHtcbiAgICAgIGZzLmNobW9kU3luYyhwYXRoKGZha2VwYXRoKSwgJzc1NScpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGZpbGVzIGFuZCByZXN0b3JlIHdvcmtpbmcgZGlyZWN0b3J5XG4gICAqL1xuICBleHBvcnQgZnVuY3Rpb24gcmVzdG9yZSgpIHtcbiAgICBpZiAob2xkQ3dkKSB7XG4gICAgICBwcm9jZXNzLmNoZGlyKG9sZEN3ZCk7XG4gICAgfVxuICAgIGZzLnJlbW92ZVN5bmMoYm9ja0ZzUm9vdCk7XG4gIH1cbn1cblxuZXhwb3J0ID0gYm9ja2ZzOyJdfQ==