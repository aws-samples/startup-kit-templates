"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountAccessKeyCache = void 0;
const path = require("path");
const fs = require("fs-extra");
const logging_1 = require("../../logging");
const directories_1 = require("../../util/directories");
/**
 * Disk cache which maps access key IDs to account IDs.
 * Usage:
 *   cache.get(accessKey) => accountId | undefined
 *   cache.put(accessKey, accountId)
 */
class AccountAccessKeyCache {
    /**
     * @param filePath Path to the cache file
     */
    constructor(filePath) {
        this.cacheFile = filePath || path.join(directories_1.cdkCacheDir(), 'accounts_partitions.json');
    }
    /**
     * Tries to fetch the account ID from cache. If it's not in the cache, invokes
     * the resolver function which should retrieve the account ID and return it.
     * Then, it will be stored into disk cache returned.
     *
     * Example:
     *
     *    const accountId = cache.fetch(accessKey, async () => {
     *      return await fetchAccountIdFromSomewhere(accessKey);
     *    });
     *
     * @param accessKeyId
     * @param resolver
     */
    async fetch(accessKeyId, resolver) {
        // try to get account ID based on this access key ID from disk.
        const cached = await this.get(accessKeyId);
        if (cached) {
            logging_1.debug(`Retrieved account ID ${cached.accountId} from disk cache`);
            return cached;
        }
        // if it's not in the cache, resolve and put in cache.
        const account = await resolver();
        if (account) {
            await this.put(accessKeyId, account);
        }
        return account;
    }
    /** Get the account ID from an access key or undefined if not in cache */
    async get(accessKeyId) {
        const map = await this.loadMap();
        return map[accessKeyId];
    }
    /** Put a mapping betweenn access key and account ID */
    async put(accessKeyId, account) {
        let map = await this.loadMap();
        // nuke cache if it's too big.
        if (Object.keys(map).length >= AccountAccessKeyCache.MAX_ENTRIES) {
            map = {};
        }
        map[accessKeyId] = account;
        await this.saveMap(map);
    }
    async loadMap() {
        try {
            return await fs.readJson(this.cacheFile);
        }
        catch (e) {
            // File doesn't exist or is not readable. This is a cache,
            // pretend we successfully loaded an empty map.
            if (e.code === 'ENOENT' || e.code === 'EACCES') {
                return {};
            }
            // File is not JSON, could be corrupted because of concurrent writes.
            // Again, an empty cache is fine.
            if (e instanceof SyntaxError) {
                return {};
            }
            throw e;
        }
    }
    async saveMap(map) {
        try {
            await fs.ensureFile(this.cacheFile);
            await fs.writeJson(this.cacheFile, map, { spaces: 2 });
        }
        catch (e) {
            // File doesn't exist or file/dir isn't writable. This is a cache,
            // if we can't write it then too bad.
            if (e.code === 'ENOENT' || e.code === 'EACCES' || e.code === 'EROFS') {
                return;
            }
            throw e;
        }
    }
}
exports.AccountAccessKeyCache = AccountAccessKeyCache;
/**
 * Max number of entries in the cache, after which the cache will be reset.
 */
AccountAccessKeyCache.MAX_ENTRIES = 1000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjb3VudC1jYWNoZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFjY291bnQtY2FjaGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkJBQTZCO0FBQzdCLCtCQUErQjtBQUMvQiwyQ0FBc0M7QUFDdEMsd0RBQXFEO0FBR3JEOzs7OztHQUtHO0FBQ0gsTUFBYSxxQkFBcUI7SUFRaEM7O09BRUc7SUFDSCxZQUFZLFFBQWlCO1FBQzNCLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMseUJBQVcsRUFBRSxFQUFFLDBCQUEwQixDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7O09BYUc7SUFDSSxLQUFLLENBQUMsS0FBSyxDQUFvQixXQUFtQixFQUFFLFFBQTBCO1FBQ25GLCtEQUErRDtRQUMvRCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDM0MsSUFBSSxNQUFNLEVBQUU7WUFDVixlQUFLLENBQUMsd0JBQXdCLE1BQU0sQ0FBQyxTQUFTLGtCQUFrQixDQUFDLENBQUM7WUFDbEUsT0FBTyxNQUFNLENBQUM7U0FDZjtRQUVELHNEQUFzRDtRQUN0RCxNQUFNLE9BQU8sR0FBRyxNQUFNLFFBQVEsRUFBRSxDQUFDO1FBQ2pDLElBQUksT0FBTyxFQUFFO1lBQ1gsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN0QztRQUVELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCx5RUFBeUU7SUFDbEUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxXQUFtQjtRQUNsQyxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQyxPQUFPLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQsdURBQXVEO0lBQ2hELEtBQUssQ0FBQyxHQUFHLENBQUMsV0FBbUIsRUFBRSxPQUFnQjtRQUNwRCxJQUFJLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUUvQiw4QkFBOEI7UUFDOUIsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sSUFBSSxxQkFBcUIsQ0FBQyxXQUFXLEVBQUU7WUFDaEUsR0FBRyxHQUFHLEVBQUcsQ0FBQztTQUNYO1FBRUQsR0FBRyxDQUFDLFdBQVcsQ0FBQyxHQUFHLE9BQU8sQ0FBQztRQUMzQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVPLEtBQUssQ0FBQyxPQUFPO1FBQ25CLElBQUk7WUFDRixPQUFPLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDMUM7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNWLDBEQUEwRDtZQUMxRCwrQ0FBK0M7WUFDL0MsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFBRSxPQUFPLEVBQUUsQ0FBQzthQUFFO1lBQzlELHFFQUFxRTtZQUNyRSxpQ0FBaUM7WUFDakMsSUFBSSxDQUFDLFlBQVksV0FBVyxFQUFFO2dCQUFFLE9BQU8sRUFBRSxDQUFDO2FBQUU7WUFDNUMsTUFBTSxDQUFDLENBQUM7U0FDVDtJQUNILENBQUM7SUFFTyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQXVDO1FBQzNELElBQUk7WUFDRixNQUFNLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3BDLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ3hEO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixrRUFBa0U7WUFDbEUscUNBQXFDO1lBQ3JDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7Z0JBQUUsT0FBTzthQUFFO1lBQ2pGLE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7SUFDSCxDQUFDOztBQXpGSCxzREEwRkM7QUF6RkM7O0dBRUc7QUFDb0IsaUNBQVcsR0FBRyxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IHsgZGVidWcgfSBmcm9tICcuLi8uLi9sb2dnaW5nJztcbmltcG9ydCB7IGNka0NhY2hlRGlyIH0gZnJvbSAnLi4vLi4vdXRpbC9kaXJlY3Rvcmllcyc7XG5pbXBvcnQgeyBBY2NvdW50IH0gZnJvbSAnLi9zZGstcHJvdmlkZXInO1xuXG4vKipcbiAqIERpc2sgY2FjaGUgd2hpY2ggbWFwcyBhY2Nlc3Mga2V5IElEcyB0byBhY2NvdW50IElEcy5cbiAqIFVzYWdlOlxuICogICBjYWNoZS5nZXQoYWNjZXNzS2V5KSA9PiBhY2NvdW50SWQgfCB1bmRlZmluZWRcbiAqICAgY2FjaGUucHV0KGFjY2Vzc0tleSwgYWNjb3VudElkKVxuICovXG5leHBvcnQgY2xhc3MgQWNjb3VudEFjY2Vzc0tleUNhY2hlIHtcbiAgLyoqXG4gICAqIE1heCBudW1iZXIgb2YgZW50cmllcyBpbiB0aGUgY2FjaGUsIGFmdGVyIHdoaWNoIHRoZSBjYWNoZSB3aWxsIGJlIHJlc2V0LlxuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZWFkb25seSBNQVhfRU5UUklFUyA9IDEwMDA7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBjYWNoZUZpbGU6IHN0cmluZztcblxuICAvKipcbiAgICogQHBhcmFtIGZpbGVQYXRoIFBhdGggdG8gdGhlIGNhY2hlIGZpbGVcbiAgICovXG4gIGNvbnN0cnVjdG9yKGZpbGVQYXRoPzogc3RyaW5nKSB7XG4gICAgdGhpcy5jYWNoZUZpbGUgPSBmaWxlUGF0aCB8fCBwYXRoLmpvaW4oY2RrQ2FjaGVEaXIoKSwgJ2FjY291bnRzX3BhcnRpdGlvbnMuanNvbicpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaWVzIHRvIGZldGNoIHRoZSBhY2NvdW50IElEIGZyb20gY2FjaGUuIElmIGl0J3Mgbm90IGluIHRoZSBjYWNoZSwgaW52b2tlc1xuICAgKiB0aGUgcmVzb2x2ZXIgZnVuY3Rpb24gd2hpY2ggc2hvdWxkIHJldHJpZXZlIHRoZSBhY2NvdW50IElEIGFuZCByZXR1cm4gaXQuXG4gICAqIFRoZW4sIGl0IHdpbGwgYmUgc3RvcmVkIGludG8gZGlzayBjYWNoZSByZXR1cm5lZC5cbiAgICpcbiAgICogRXhhbXBsZTpcbiAgICpcbiAgICogICAgY29uc3QgYWNjb3VudElkID0gY2FjaGUuZmV0Y2goYWNjZXNzS2V5LCBhc3luYyAoKSA9PiB7XG4gICAqICAgICAgcmV0dXJuIGF3YWl0IGZldGNoQWNjb3VudElkRnJvbVNvbWV3aGVyZShhY2Nlc3NLZXkpO1xuICAgKiAgICB9KTtcbiAgICpcbiAgICogQHBhcmFtIGFjY2Vzc0tleUlkXG4gICAqIEBwYXJhbSByZXNvbHZlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGZldGNoPEEgZXh0ZW5kcyBBY2NvdW50PihhY2Nlc3NLZXlJZDogc3RyaW5nLCByZXNvbHZlcjogKCkgPT4gUHJvbWlzZTxBPikge1xuICAgIC8vIHRyeSB0byBnZXQgYWNjb3VudCBJRCBiYXNlZCBvbiB0aGlzIGFjY2VzcyBrZXkgSUQgZnJvbSBkaXNrLlxuICAgIGNvbnN0IGNhY2hlZCA9IGF3YWl0IHRoaXMuZ2V0KGFjY2Vzc0tleUlkKTtcbiAgICBpZiAoY2FjaGVkKSB7XG4gICAgICBkZWJ1ZyhgUmV0cmlldmVkIGFjY291bnQgSUQgJHtjYWNoZWQuYWNjb3VudElkfSBmcm9tIGRpc2sgY2FjaGVgKTtcbiAgICAgIHJldHVybiBjYWNoZWQ7XG4gICAgfVxuXG4gICAgLy8gaWYgaXQncyBub3QgaW4gdGhlIGNhY2hlLCByZXNvbHZlIGFuZCBwdXQgaW4gY2FjaGUuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IHJlc29sdmVyKCk7XG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIGF3YWl0IHRoaXMucHV0KGFjY2Vzc0tleUlkLCBhY2NvdW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWNjb3VudDtcbiAgfVxuXG4gIC8qKiBHZXQgdGhlIGFjY291bnQgSUQgZnJvbSBhbiBhY2Nlc3Mga2V5IG9yIHVuZGVmaW5lZCBpZiBub3QgaW4gY2FjaGUgKi9cbiAgcHVibGljIGFzeW5jIGdldChhY2Nlc3NLZXlJZDogc3RyaW5nKTogUHJvbWlzZTxBY2NvdW50IHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3QgbWFwID0gYXdhaXQgdGhpcy5sb2FkTWFwKCk7XG4gICAgcmV0dXJuIG1hcFthY2Nlc3NLZXlJZF07XG4gIH1cblxuICAvKiogUHV0IGEgbWFwcGluZyBiZXR3ZWVubiBhY2Nlc3Mga2V5IGFuZCBhY2NvdW50IElEICovXG4gIHB1YmxpYyBhc3luYyBwdXQoYWNjZXNzS2V5SWQ6IHN0cmluZywgYWNjb3VudDogQWNjb3VudCkge1xuICAgIGxldCBtYXAgPSBhd2FpdCB0aGlzLmxvYWRNYXAoKTtcblxuICAgIC8vIG51a2UgY2FjaGUgaWYgaXQncyB0b28gYmlnLlxuICAgIGlmIChPYmplY3Qua2V5cyhtYXApLmxlbmd0aCA+PSBBY2NvdW50QWNjZXNzS2V5Q2FjaGUuTUFYX0VOVFJJRVMpIHtcbiAgICAgIG1hcCA9IHsgfTtcbiAgICB9XG5cbiAgICBtYXBbYWNjZXNzS2V5SWRdID0gYWNjb3VudDtcbiAgICBhd2FpdCB0aGlzLnNhdmVNYXAobWFwKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZE1hcCgpOiBQcm9taXNlPHsgW2FjY2Vzc0tleUlkOiBzdHJpbmddOiBBY2NvdW50IH0+IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGZzLnJlYWRKc29uKHRoaXMuY2FjaGVGaWxlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBGaWxlIGRvZXNuJ3QgZXhpc3Qgb3IgaXMgbm90IHJlYWRhYmxlLiBUaGlzIGlzIGEgY2FjaGUsXG4gICAgICAvLyBwcmV0ZW5kIHdlIHN1Y2Nlc3NmdWxseSBsb2FkZWQgYW4gZW1wdHkgbWFwLlxuICAgICAgaWYgKGUuY29kZSA9PT0gJ0VOT0VOVCcgfHwgZS5jb2RlID09PSAnRUFDQ0VTJykgeyByZXR1cm4ge307IH1cbiAgICAgIC8vIEZpbGUgaXMgbm90IEpTT04sIGNvdWxkIGJlIGNvcnJ1cHRlZCBiZWNhdXNlIG9mIGNvbmN1cnJlbnQgd3JpdGVzLlxuICAgICAgLy8gQWdhaW4sIGFuIGVtcHR5IGNhY2hlIGlzIGZpbmUuXG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7IHJldHVybiB7fTsgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHNhdmVNYXAobWFwOiB7IFthY2Nlc3NLZXlJZDogc3RyaW5nXTogQWNjb3VudCB9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLmVuc3VyZUZpbGUodGhpcy5jYWNoZUZpbGUpO1xuICAgICAgYXdhaXQgZnMud3JpdGVKc29uKHRoaXMuY2FjaGVGaWxlLCBtYXAsIHsgc3BhY2VzOiAyIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIEZpbGUgZG9lc24ndCBleGlzdCBvciBmaWxlL2RpciBpc24ndCB3cml0YWJsZS4gVGhpcyBpcyBhIGNhY2hlLFxuICAgICAgLy8gaWYgd2UgY2FuJ3Qgd3JpdGUgaXQgdGhlbiB0b28gYmFkLlxuICAgICAgaWYgKGUuY29kZSA9PT0gJ0VOT0VOVCcgfHwgZS5jb2RlID09PSAnRUFDQ0VTJyB8fCBlLmNvZGUgPT09ICdFUk9GUycpIHsgcmV0dXJuOyB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxufVxuIl19