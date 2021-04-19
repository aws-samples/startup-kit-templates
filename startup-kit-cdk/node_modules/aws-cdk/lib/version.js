"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayVersionMessage = exports.latestVersionIfHigher = exports.VersionCheckTTL = exports.versionNumber = exports.DISPLAY_VERSION = void 0;
const child_process_1 = require("child_process");
const path = require("path");
const util_1 = require("util");
const colors = require("colors/safe");
const fs = require("fs-extra");
const semver = require("semver");
const logging_1 = require("../lib/logging");
const console_formatters_1 = require("../lib/util/console-formatters");
const directories_1 = require("./util/directories");
const ONE_DAY_IN_SECONDS = 1 * 24 * 60 * 60;
const exec = util_1.promisify(child_process_1.exec);
exports.DISPLAY_VERSION = `${versionNumber()} (build ${commit()})`;
function versionNumber() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../package.json').version.replace(/\+[0-9a-f]+$/, '');
}
exports.versionNumber = versionNumber;
function commit() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../build-info.json').commit;
}
class VersionCheckTTL {
    constructor(file, ttlSecs) {
        this.file = file || VersionCheckTTL.timestampFilePath();
        try {
            fs.mkdirsSync(path.dirname(this.file));
            fs.accessSync(path.dirname(this.file), fs.constants.W_OK);
        }
        catch (_a) {
            throw new Error(`Directory (${path.dirname(this.file)}) is not writable.`);
        }
        this.ttlSecs = ttlSecs || ONE_DAY_IN_SECONDS;
    }
    static timestampFilePath() {
        // Using the same path from account-cache.ts
        return path.join(directories_1.cdkCacheDir(), 'repo-version-ttl');
    }
    async hasExpired() {
        try {
            const lastCheckTime = (await fs.stat(this.file)).mtimeMs;
            const today = new Date().getTime();
            if ((today - lastCheckTime) / 1000 > this.ttlSecs) { // convert ms to sec
                return true;
            }
            return false;
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return true;
            }
            else {
                throw err;
            }
        }
    }
    async update(latestVersion) {
        if (!latestVersion) {
            latestVersion = '';
        }
        await fs.writeFile(this.file, latestVersion);
    }
}
exports.VersionCheckTTL = VersionCheckTTL;
// Export for unit testing only.
// Don't use directly, use displayVersionMessage() instead.
async function latestVersionIfHigher(currentVersion, cacheFile) {
    if (!(await cacheFile.hasExpired())) {
        return null;
    }
    const { stdout, stderr } = await exec('npm view aws-cdk version');
    if (stderr && stderr.trim().length > 0) {
        logging_1.debug(`The 'npm view' command generated an error stream with content [${stderr.trim()}]`);
    }
    const latestVersion = stdout.trim();
    if (!semver.valid(latestVersion)) {
        throw new Error(`npm returned an invalid semver ${latestVersion}`);
    }
    const isNewer = semver.gt(latestVersion, currentVersion);
    await cacheFile.update(latestVersion);
    if (isNewer) {
        return latestVersion;
    }
    else {
        return null;
    }
}
exports.latestVersionIfHigher = latestVersionIfHigher;
async function displayVersionMessage() {
    if (!process.stdout.isTTY || process.env.CDK_DISABLE_VERSION_CHECK) {
        return;
    }
    try {
        const versionCheckCache = new VersionCheckTTL();
        const laterVersion = await latestVersionIfHigher(versionNumber(), versionCheckCache);
        if (laterVersion) {
            const bannerMsg = console_formatters_1.formatAsBanner([
                `Newer version of CDK is available [${colors.green(laterVersion)}]`,
                'Upgrade recommended',
            ]);
            bannerMsg.forEach((e) => logging_1.print(e));
        }
    }
    catch (err) {
        logging_1.debug(`Could not run version check - ${err.message}`);
    }
}
exports.displayVersionMessage = displayVersionMessage;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVyc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZlcnNpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsaURBQThDO0FBQzlDLDZCQUE2QjtBQUM3QiwrQkFBaUM7QUFDakMsc0NBQXNDO0FBQ3RDLCtCQUErQjtBQUMvQixpQ0FBaUM7QUFDakMsNENBQThDO0FBQzlDLHVFQUFnRTtBQUNoRSxvREFBaUQ7QUFFakQsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFFNUMsTUFBTSxJQUFJLEdBQUcsZ0JBQVMsQ0FBQyxvQkFBSyxDQUFDLENBQUM7QUFFakIsUUFBQSxlQUFlLEdBQUcsR0FBRyxhQUFhLEVBQUUsV0FBVyxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBRXhFLFNBQWdCLGFBQWE7SUFDM0IsaUVBQWlFO0lBQ2pFLE9BQU8sT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDeEUsQ0FBQztBQUhELHNDQUdDO0FBRUQsU0FBUyxNQUFNO0lBQ2IsaUVBQWlFO0lBQ2pFLE9BQU8sT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsTUFBTSxDQUFDO0FBQzlDLENBQUM7QUFFRCxNQUFhLGVBQWU7SUFXMUIsWUFBWSxJQUFhLEVBQUUsT0FBZ0I7UUFDekMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksZUFBZSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDeEQsSUFBSTtZQUNGLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN2QyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFD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QztRQUNoRCxNQUFNLFlBQVksR0FBRyxNQUFNLHFCQUFxQixDQUFDLGFBQWEsRUFBRSxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDckYsSUFBSSxZQUFZLEVBQUU7WUFDaEIsTUFBTSxTQUFTLEdBQUcsbUNBQWMsQ0FBQztnQkFDL0Isc0NBQXNDLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBc0IsQ0FBQyxHQUFHO2dCQUM3RSxxQkFBcUI7YUFDdEIsQ0FBQyxDQUFDO1lBQ0gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsZUFBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDcEM7S0FDRjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osZUFBSyxDQUFDLGlDQUFpQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztLQUN2RDtBQUNILENBQUM7QUFsQkQsc0RBa0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXhlYyBhcyBfZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycy9zYWZlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCAqIGFzIHNlbXZlciBmcm9tICdzZW12ZXInO1xuaW1wb3J0IHsgZGVidWcsIHByaW50IH0gZnJvbSAnLi4vbGliL2xvZ2dpbmcnO1xuaW1wb3J0IHsgZm9ybWF0QXNCYW5uZXIgfSBmcm9tICcuLi9saWIvdXRpbC9jb25zb2xlLWZvcm1hdHRlcnMnO1xuaW1wb3J0IHsgY2RrQ2FjaGVEaXIgfSBmcm9tICcuL3V0aWwvZGlyZWN0b3JpZXMnO1xuXG5jb25zdCBPTkVfREFZX0lOX1NFQ09ORFMgPSAxICogMjQgKiA2MCAqIDYwO1xuXG5jb25zdCBleGVjID0gcHJvbWlzaWZ5KF9leGVjKTtcblxuZXhwb3J0IGNvbnN0IERJU1BMQVlfVkVSU0lPTiA9IGAke3ZlcnNpb25OdW1iZXIoKX0gKGJ1aWxkICR7Y29tbWl0KCl9KWA7XG5cbmV4cG9ydCBmdW5jdGlvbiB2ZXJzaW9uTnVtYmVyKCk6IHN0cmluZyB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzXG4gIHJldHVybiByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLnJlcGxhY2UoL1xcK1swLTlhLWZdKyQvLCAnJyk7XG59XG5cbmZ1bmN0aW9uIGNvbW1pdCgpOiBzdHJpbmcge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICByZXR1cm4gcmVxdWlyZSgnLi4vYnVpbGQtaW5mby5qc29uJykuY29tbWl0O1xufVxuXG5leHBvcnQgY2xhc3MgVmVyc2lvbkNoZWNrVFRMIHtcbiAgcHVibGljIHN0YXRpYyB0aW1lc3RhbXBGaWxlUGF0aCgpOiBzdHJpbmcge1xuICAgIC8vIFVzaW5nIHRoZSBzYW1lIHBhdGggZnJvbSBhY2NvdW50LWNhY2hlLnRzXG4gICAgcmV0dXJuIHBhdGguam9pbihjZGtDYWNoZURpcigpLCAncmVwby12ZXJzaW9uLXR0bCcpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWFkb25seSBmaWxlOiBzdHJpbmc7XG5cbiAgLy8gRmlsZSBtb2RpZnkgdGltZXMgYXJlIGFjY3VyYXRlIG9ubHkgdG8gdGhlIHNlY29uZFxuICBwcml2YXRlIHJlYWRvbmx5IHR0bFNlY3M6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihmaWxlPzogc3RyaW5nLCB0dGxTZWNzPzogbnVtYmVyKSB7XG4gICAgdGhpcy5maWxlID0gZmlsZSB8fCBWZXJzaW9uQ2hlY2tUVEwudGltZXN0YW1wRmlsZVBhdGgoKTtcbiAgICB0cnkge1xuICAgICAgZnMubWtkaXJzU3luYyhwYXRoLmRpcm5hbWUodGhpcy5maWxlKSk7XG4gICAgICBmcy5hY2Nlc3NTeW5jKHBhdGguZGlybmFtZSh0aGlzLmZpbGUpLCBmcy5jb25zdGFudHMuV19PSyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYERpcmVjdG9yeSAoJHtwYXRoLmRpcm5hbWUodGhpcy5maWxlKX0pIGlzIG5vdCB3cml0YWJsZS5gKTtcbiAgICB9XG4gICAgdGhpcy50dGxTZWNzID0gdHRsU2VjcyB8fCBPTkVfREFZX0lOX1NFQ09ORFM7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgaGFzRXhwaXJlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbGFzdENoZWNrVGltZSA9IChhd2FpdCBmcy5zdGF0KHRoaXMuZmlsZSkpLm10aW1lTXM7XG4gICAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXG4gICAgICBpZiAoKHRvZGF5IC0gbGFzdENoZWNrVGltZSkgLyAxMDAwID4gdGhpcy50dGxTZWNzKSB7IC8vIGNvbnZlcnQgbXMgdG8gc2VjXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyci5jb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgdXBkYXRlKGxhdGVzdFZlcnNpb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIWxhdGVzdFZlcnNpb24pIHtcbiAgICAgIGxhdGVzdFZlcnNpb24gPSAnJztcbiAgICB9XG4gICAgYXdhaXQgZnMud3JpdGVGaWxlKHRoaXMuZmlsZSwgbGF0ZXN0VmVyc2lvbik7XG4gIH1cbn1cblxuLy8gRXhwb3J0IGZvciB1bml0IHRlc3Rpbmcgb25seS5cbi8vIERvbid0IHVzZSBkaXJlY3RseSwgdXNlIGRpc3BsYXlWZXJzaW9uTWVzc2FnZSgpIGluc3RlYWQuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGF0ZXN0VmVyc2lvbklmSGlnaGVyKGN1cnJlbnRWZXJzaW9uOiBzdHJpbmcsIGNhY2hlRmlsZTogVmVyc2lvbkNoZWNrVFRMKTogUHJvbWlzZTxzdHJpbmd8bnVsbD4ge1xuICBpZiAoIShhd2FpdCBjYWNoZUZpbGUuaGFzRXhwaXJlZCgpKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgeyBzdGRvdXQsIHN0ZGVyciB9ID0gYXdhaXQgZXhlYygnbnBtIHZpZXcgYXdzLWNkayB2ZXJzaW9uJyk7XG4gIGlmIChzdGRlcnIgJiYgc3RkZXJyLnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgZGVidWcoYFRoZSAnbnBtIHZpZXcnIGNvbW1hbmQgZ2VuZXJhdGVkIGFuIGVycm9yIHN0cmVhbSB3aXRoIGNvbnRlbnQgWyR7c3RkZXJyLnRyaW0oKX1dYCk7XG4gIH1cbiAgY29uc3QgbGF0ZXN0VmVyc2lvbiA9IHN0ZG91dC50cmltKCk7XG4gIGlmICghc2VtdmVyLnZhbGlkKGxhdGVzdFZlcnNpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBucG0gcmV0dXJuZWQgYW4gaW52YWxpZCBzZW12ZXIgJHtsYXRlc3RWZXJzaW9ufWApO1xuICB9XG4gIGNvbnN0IGlzTmV3ZXIgPSBzZW12ZXIuZ3QobGF0ZXN0VmVyc2lvbiwgY3VycmVudFZlcnNpb24pO1xuICBhd2FpdCBjYWNoZUZpbGUudXBkYXRlKGxhdGVzdFZlcnNpb24pO1xuXG4gIGlmIChpc05ld2VyKSB7XG4gICAgcmV0dXJuIGxhdGVzdFZlcnNpb247XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRpc3BsYXlWZXJzaW9uTWVzc2FnZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCFwcm9jZXNzLnN0ZG91dC5pc1RUWSB8fCBwcm9jZXNzLmVudi5DREtfRElTQUJMRV9WRVJTSU9OX0NIRUNLKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB2ZXJzaW9uQ2hlY2tDYWNoZSA9IG5ldyBWZXJzaW9uQ2hlY2tUVEwoKTtcbiAgICBjb25zdCBsYXRlclZlcnNpb24gPSBhd2FpdCBsYXRlc3RWZXJzaW9uSWZIaWdoZXIodmVyc2lvbk51bWJlcigpLCB2ZXJzaW9uQ2hlY2tDYWNoZSk7XG4gICAgaWYgKGxhdGVyVmVyc2lvbikge1xuICAgICAgY29uc3QgYmFubmVyTXNnID0gZm9ybWF0QXNCYW5uZXIoW1xuICAgICAgICBgTmV3ZXIgdmVyc2lvbiBvZiBDREsgaXMgYXZhaWxhYmxlIFske2NvbG9ycy5ncmVlbihsYXRlclZlcnNpb24gYXMgc3RyaW5nKX1dYCxcbiAgICAgICAgJ1VwZ3JhZGUgcmVjb21tZW5kZWQnLFxuICAgICAgXSk7XG4gICAgICBiYW5uZXJNc2cuZm9yRWFjaCgoZSkgPT4gcHJpbnQoZSkpO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgZGVidWcoYENvdWxkIG5vdCBydW4gdmVyc2lvbiBjaGVjayAtICR7ZXJyLm1lc3NhZ2V9YCk7XG4gIH1cbn1cbiJdfQ==