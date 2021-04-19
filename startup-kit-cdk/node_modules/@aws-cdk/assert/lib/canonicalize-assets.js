"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalizeTemplate = void 0;
/**
 * Reduce template to a normal form where asset references have been normalized
 *
 * This makes it possible to compare templates if all that's different between
 * them is the hashes of the asset values.
 *
 * Currently only handles parameterized assets, but can (and should)
 * be adapted to handle convention-mode assets as well when we start using
 * more of those.
 */
function canonicalizeTemplate(template) {
    // For the weird case where we have an array of templates...
    if (Array.isArray(template)) {
        return template.map(canonicalizeTemplate);
    }
    // Find assets via parameters
    const stringSubstitutions = new Array();
    const paramRe = /^AssetParameters([a-zA-Z0-9]{64})(S3Bucket|S3VersionKey|ArtifactHash)([a-zA-Z0-9]{8})$/;
    const assetsSeen = new Set();
    for (const paramName of Object.keys((template === null || template === void 0 ? void 0 : template.Parameters) || {})) {
        const m = paramRe.exec(paramName);
        if (!m) {
            continue;
        }
        if (assetsSeen.has(m[1])) {
            continue;
        }
        assetsSeen.add(m[1]);
        const ix = assetsSeen.size;
        // Full parameter reference
        stringSubstitutions.push([
            new RegExp(`AssetParameters${m[1]}(S3Bucket|S3VersionKey|ArtifactHash)([a-zA-Z0-9]{8})`),
            `Asset${ix}$1`,
        ]);
        // Substring asset hash reference
        stringSubstitutions.push([
            new RegExp(`${m[1]}`),
            `Asset${ix}Hash`,
        ]);
    }
    // Substitute them out
    return substitute(template);
    function substitute(what) {
        if (Array.isArray(what)) {
            return what.map(substitute);
        }
        if (typeof what === 'object' && what !== null) {
            const ret = {};
            for (const [k, v] of Object.entries(what)) {
                ret[stringSub(k)] = substitute(v);
            }
            return ret;
        }
        if (typeof what === 'string') {
            return stringSub(what);
        }
        return what;
    }
    function stringSub(x) {
        for (const [re, replacement] of stringSubstitutions) {
            x = x.replace(re, replacement);
        }
        return x;
    }
}
exports.canonicalizeTemplate = canonicalizeTemplate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2Fub25pY2FsaXplLWFzc2V0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNhbm9uaWNhbGl6ZS1hc3NldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7Ozs7OztHQVNHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQUMsUUFBYTtJQUNoRCw0REFBNEQ7SUFDNUQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQzNCLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0tBQzNDO0lBRUQsNkJBQTZCO0lBQzdCLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxLQUFLLEVBQW9CLENBQUM7SUFDMUQsTUFBTSxPQUFPLEdBQUcsd0ZBQXdGLENBQUM7SUFFekcsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUNyQyxLQUFLLE1BQU0sU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQSxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUUsVUFBVSxLQUFJLEVBQUUsQ0FBQyxFQUFFO1FBQy9ELE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLENBQUMsRUFBRTtZQUFFLFNBQVM7U0FBRTtRQUNyQixJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFBRSxTQUFTO1NBQUU7UUFFdkMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQixNQUFNLEVBQUUsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBRTNCLDJCQUEyQjtRQUMzQixtQkFBbUIsQ0FBQyxJQUFJLENBQUM7WUFDdkIsSUFBSSxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsc0RBQXNELENBQUM7WUFDeEYsUUFBUSxFQUFFLElBQUk7U0FDZixDQUFDLENBQUM7UUFDSCxpQ0FBaUM7UUFDakMsbUJBQW1CLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDckIsUUFBUSxFQUFFLE1BQU07U0FDakIsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxzQkFBc0I7SUFDdEIsT0FBTyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFNUIsU0FBUyxVQUFVLENBQUMsSUFBUztRQUMzQixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdkIsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQzdCO1FBRUQsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtZQUM3QyxNQUFNLEdBQUcsR0FBUSxFQUFFLENBQUM7WUFDcEIsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3pDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbkM7WUFDRCxPQUFPLEdBQUcsQ0FBQztTQUNaO1FBRUQsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7WUFDNUIsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEI7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxTQUFTLFNBQVMsQ0FBQyxDQUFTO1FBQzFCLEtBQUssTUFBTSxDQUFDLEVBQUUsRUFBRSxXQUFXLENBQUMsSUFBSSxtQkFBbUIsRUFBRTtZQUNuRCxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUM7U0FDaEM7UUFDRCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7QUFDSCxDQUFDO0FBNURELG9EQTREQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVkdWNlIHRlbXBsYXRlIHRvIGEgbm9ybWFsIGZvcm0gd2hlcmUgYXNzZXQgcmVmZXJlbmNlcyBoYXZlIGJlZW4gbm9ybWFsaXplZFxuICpcbiAqIFRoaXMgbWFrZXMgaXQgcG9zc2libGUgdG8gY29tcGFyZSB0ZW1wbGF0ZXMgaWYgYWxsIHRoYXQncyBkaWZmZXJlbnQgYmV0d2VlblxuICogdGhlbSBpcyB0aGUgaGFzaGVzIG9mIHRoZSBhc3NldCB2YWx1ZXMuXG4gKlxuICogQ3VycmVudGx5IG9ubHkgaGFuZGxlcyBwYXJhbWV0ZXJpemVkIGFzc2V0cywgYnV0IGNhbiAoYW5kIHNob3VsZClcbiAqIGJlIGFkYXB0ZWQgdG8gaGFuZGxlIGNvbnZlbnRpb24tbW9kZSBhc3NldHMgYXMgd2VsbCB3aGVuIHdlIHN0YXJ0IHVzaW5nXG4gKiBtb3JlIG9mIHRob3NlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2Fub25pY2FsaXplVGVtcGxhdGUodGVtcGxhdGU6IGFueSk6IGFueSB7XG4gIC8vIEZvciB0aGUgd2VpcmQgY2FzZSB3aGVyZSB3ZSBoYXZlIGFuIGFycmF5IG9mIHRlbXBsYXRlcy4uLlxuICBpZiAoQXJyYXkuaXNBcnJheSh0ZW1wbGF0ZSkpIHtcbiAgICByZXR1cm4gdGVtcGxhdGUubWFwKGNhbm9uaWNhbGl6ZVRlbXBsYXRlKTtcbiAgfVxuXG4gIC8vIEZpbmQgYXNzZXRzIHZpYSBwYXJhbWV0ZXJzXG4gIGNvbnN0IHN0cmluZ1N1YnN0aXR1dGlvbnMgPSBuZXcgQXJyYXk8W1JlZ0V4cCwgc3RyaW5nXT4oKTtcbiAgY29uc3QgcGFyYW1SZSA9IC9eQXNzZXRQYXJhbWV0ZXJzKFthLXpBLVowLTldezY0fSkoUzNCdWNrZXR8UzNWZXJzaW9uS2V5fEFydGlmYWN0SGFzaCkoW2EtekEtWjAtOV17OH0pJC87XG5cbiAgY29uc3QgYXNzZXRzU2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IHBhcmFtTmFtZSBvZiBPYmplY3Qua2V5cyh0ZW1wbGF0ZT8uUGFyYW1ldGVycyB8fCB7fSkpIHtcbiAgICBjb25zdCBtID0gcGFyYW1SZS5leGVjKHBhcmFtTmFtZSk7XG4gICAgaWYgKCFtKSB7IGNvbnRpbnVlOyB9XG4gICAgaWYgKGFzc2V0c1NlZW4uaGFzKG1bMV0pKSB7IGNvbnRpbnVlOyB9XG5cbiAgICBhc3NldHNTZWVuLmFkZChtWzFdKTtcbiAgICBjb25zdCBpeCA9IGFzc2V0c1NlZW4uc2l6ZTtcblxuICAgIC8vIEZ1bGwgcGFyYW1ldGVyIHJlZmVyZW5jZVxuICAgIHN0cmluZ1N1YnN0aXR1dGlvbnMucHVzaChbXG4gICAgICBuZXcgUmVnRXhwKGBBc3NldFBhcmFtZXRlcnMke21bMV19KFMzQnVja2V0fFMzVmVyc2lvbktleXxBcnRpZmFjdEhhc2gpKFthLXpBLVowLTldezh9KWApLFxuICAgICAgYEFzc2V0JHtpeH0kMWAsXG4gICAgXSk7XG4gICAgLy8gU3Vic3RyaW5nIGFzc2V0IGhhc2ggcmVmZXJlbmNlXG4gICAgc3RyaW5nU3Vic3RpdHV0aW9ucy5wdXNoKFtcbiAgICAgIG5ldyBSZWdFeHAoYCR7bVsxXX1gKSxcbiAgICAgIGBBc3NldCR7aXh9SGFzaGAsXG4gICAgXSk7XG4gIH1cblxuICAvLyBTdWJzdGl0dXRlIHRoZW0gb3V0XG4gIHJldHVybiBzdWJzdGl0dXRlKHRlbXBsYXRlKTtcblxuICBmdW5jdGlvbiBzdWJzdGl0dXRlKHdoYXQ6IGFueSk6IGFueSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkod2hhdCkpIHtcbiAgICAgIHJldHVybiB3aGF0Lm1hcChzdWJzdGl0dXRlKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHdoYXQgPT09ICdvYmplY3QnICYmIHdoYXQgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHJldDogYW55ID0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyh3aGF0KSkge1xuICAgICAgICByZXRbc3RyaW5nU3ViKGspXSA9IHN1YnN0aXR1dGUodik7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygd2hhdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBzdHJpbmdTdWIod2hhdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdoYXQ7XG4gIH1cblxuICBmdW5jdGlvbiBzdHJpbmdTdWIoeDogc3RyaW5nKSB7XG4gICAgZm9yIChjb25zdCBbcmUsIHJlcGxhY2VtZW50XSBvZiBzdHJpbmdTdWJzdGl0dXRpb25zKSB7XG4gICAgICB4ID0geC5yZXBsYWNlKHJlLCByZXBsYWNlbWVudCk7XG4gICAgfVxuICAgIHJldHVybiB4O1xuICB9XG59XG4iXX0=