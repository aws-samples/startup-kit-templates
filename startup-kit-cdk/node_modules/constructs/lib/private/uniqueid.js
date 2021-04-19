"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeLegacyUniqueId = exports.addressOf = void 0;
// tslint:disable-next-line:no-var-requires
const crypto = require("crypto");
/**
 * Resources with this ID are hidden from humans
 *
 * They do not appear in the human-readable part of the logical ID,
 * but they are included in the hash calculation.
 */
const HIDDEN_FROM_HUMAN_ID = 'Resource';
/**
 * Resources with this ID are complete hidden from the logical ID calculation.
 */
const HIDDEN_ID = 'Default';
const PATH_SEP = '/';
const HASH_LEN = 8;
const MAX_HUMAN_LEN = 240; // max ID len is 255
const MAX_ID_LEN = 255;
/**
 * Calculates the construct uid based on path components.
 *
 * Components named `Default` (case sensitive) are excluded from uid calculation
 * to allow tree refactorings.
 *
 * @param components path components
 */
function addressOf(components) {
    const hash = crypto.createHash('sha1');
    for (const c of components) {
        // skip components called "Default" to enable refactorings
        if (c === HIDDEN_ID) {
            continue;
        }
        hash.update(c);
        hash.update('\n');
    }
    // prefix with "c8" so to ensure it starts with non-digit.
    return 'c8' + hash.digest('hex');
}
exports.addressOf = addressOf;
/**
 * Calculates a unique ID for a set of textual components.
 *
 * This is done by calculating a hash on the full path and using it as a suffix
 * of a length-limited "human" rendition of the path components.
 *
 * @param components The path components
 * @returns a unique alpha-numeric identifier with a maximum length of 255
 */
function makeLegacyUniqueId(components) {
    components = components.filter(x => x !== HIDDEN_ID);
    if (components.length === 0) {
        throw new Error('Unable to calculate a unique id for an empty set of components');
    }
    // top-level resources will simply use the `name` as-is in order to support
    // transparent migration of cloudformation templates to the CDK without the
    // need to rename all resources.
    if (components.length === 1) {
        // we filter out non-alpha characters but that is actually a bad idea
        // because it could create conflicts ("A-B" and "AB" will render the same
        // logical ID). sadly, changing it in the 1.x version line is impossible
        // because it will be a breaking change. we should consider for v2.0.
        // https://github.com/aws/aws-cdk/issues/6421
        const candidate = removeNonAlphanumeric(components[0]);
        // if our candidate is short enough, use it as is. otherwise, fall back to
        // the normal mode.
        if (candidate.length <= MAX_ID_LEN) {
            return candidate;
        }
    }
    const hash = legacyPathHash(components);
    const human = removeDupes(components)
        .filter(x => x !== HIDDEN_FROM_HUMAN_ID)
        .map(removeNonAlphanumeric)
        .join('')
        .slice(0, MAX_HUMAN_LEN);
    return human + hash;
}
exports.makeLegacyUniqueId = makeLegacyUniqueId;
/**
 * Take a hash of the given path.
 *
 * The hash is limited in size.
 */
function legacyPathHash(path) {
    const md5 = crypto.createHash('md5').update(path.join(PATH_SEP)).digest('hex');
    return md5.slice(0, HASH_LEN).toUpperCase();
}
/**
 * Removes all non-alphanumeric characters in a string.
 */
function removeNonAlphanumeric(s) {
    return s.replace(/[^A-Za-z0-9]/g, '');
}
/**
 * Remove duplicate "terms" from the path list
 *
 * If the previous path component name ends with this component name, skip the
 * current component.
 */
function removeDupes(path) {
    const ret = new Array();
    for (const component of path) {
        if (ret.length === 0 || !ret[ret.length - 1].endsWith(component)) {
            ret.push(component);
        }
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pcXVlaWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcHJpdmF0ZS91bmlxdWVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwyQ0FBMkM7QUFDM0MsaUNBQWlDO0FBRWpDOzs7OztHQUtHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxVQUFVLENBQUM7QUFFeEM7O0dBRUc7QUFDSCxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUM7QUFFNUIsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDO0FBRXJCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQztBQUNuQixNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsQ0FBQyxvQkFBb0I7QUFDL0MsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO0FBRXZCOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQixTQUFTLENBQUMsVUFBb0I7SUFDNUMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2QyxLQUFLLE1BQU0sQ0FBQyxJQUFJLFVBQVUsRUFBRTtRQUMxQiwwREFBMEQ7UUFDMUQsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQUUsU0FBUztTQUFFO1FBRWxDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ25CO0lBRUQsMERBQTBEO0lBQzFELE9BQU8sSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDbkMsQ0FBQztBQVpELDhCQVlDO0FBRUQ7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFnQixrQkFBa0IsQ0FBQyxVQUFvQjtJQUNyRCxVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQztJQUVyRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0VBQWdFLENBQUMsQ0FBQztLQUNuRjtJQUVELDJFQUEyRTtJQUMzRSwyRUFBMkU7SUFDM0UsZ0NBQWdDO0lBQ2hDLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDM0IscUVBQXFFO1FBQ3JFLHlFQUF5RTtRQUN6RSx3RUFBd0U7UUFDeEUscUVBQXFFO1FBQ3JFLDZDQUE2QztRQUM3QyxNQUFNLFNBQVMsR0FBRyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV2RCwwRUFBMEU7UUFDMUUsbUJBQW1CO1FBQ25CLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxVQUFVLEVBQUU7WUFDbEMsT0FBTyxTQUFTLENBQUM7U0FDbEI7S0FDRjtJQUVELE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN4QyxNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFDO1NBQ2xDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxvQkFBb0IsQ0FBQztTQUN2QyxHQUFHLENBQUMscUJBQXFCLENBQUM7U0FDMUIsSUFBSSxDQUFDLEVBQUUsQ0FBQztTQUNSLEtBQUssQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFM0IsT0FBTyxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLENBQUM7QUFqQ0QsZ0RBaUNDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsY0FBYyxDQUFDLElBQWM7SUFDcEMsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvRSxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQzlDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMscUJBQXFCLENBQUMsQ0FBUztJQUN0QyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3hDLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQVMsV0FBVyxDQUFDLElBQWM7SUFDakMsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLEVBQVUsQ0FBQztJQUVoQyxLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksRUFBRTtRQUM1QixJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ2hFLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDckI7S0FDRjtJQUVELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby12YXItcmVxdWlyZXNcbmltcG9ydCAqIGFzIGNyeXB0byBmcm9tICdjcnlwdG8nO1xuXG4vKipcbiAqIFJlc291cmNlcyB3aXRoIHRoaXMgSUQgYXJlIGhpZGRlbiBmcm9tIGh1bWFuc1xuICpcbiAqIFRoZXkgZG8gbm90IGFwcGVhciBpbiB0aGUgaHVtYW4tcmVhZGFibGUgcGFydCBvZiB0aGUgbG9naWNhbCBJRCxcbiAqIGJ1dCB0aGV5IGFyZSBpbmNsdWRlZCBpbiB0aGUgaGFzaCBjYWxjdWxhdGlvbi5cbiAqL1xuY29uc3QgSElEREVOX0ZST01fSFVNQU5fSUQgPSAnUmVzb3VyY2UnO1xuXG4vKipcbiAqIFJlc291cmNlcyB3aXRoIHRoaXMgSUQgYXJlIGNvbXBsZXRlIGhpZGRlbiBmcm9tIHRoZSBsb2dpY2FsIElEIGNhbGN1bGF0aW9uLlxuICovXG5jb25zdCBISURERU5fSUQgPSAnRGVmYXVsdCc7XG5cbmNvbnN0IFBBVEhfU0VQID0gJy8nO1xuXG5jb25zdCBIQVNIX0xFTiA9IDg7XG5jb25zdCBNQVhfSFVNQU5fTEVOID0gMjQwOyAvLyBtYXggSUQgbGVuIGlzIDI1NVxuY29uc3QgTUFYX0lEX0xFTiA9IDI1NTtcblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBjb25zdHJ1Y3QgdWlkIGJhc2VkIG9uIHBhdGggY29tcG9uZW50cy5cbiAqXG4gKiBDb21wb25lbnRzIG5hbWVkIGBEZWZhdWx0YCAoY2FzZSBzZW5zaXRpdmUpIGFyZSBleGNsdWRlZCBmcm9tIHVpZCBjYWxjdWxhdGlvblxuICogdG8gYWxsb3cgdHJlZSByZWZhY3RvcmluZ3MuXG4gKlxuICogQHBhcmFtIGNvbXBvbmVudHMgcGF0aCBjb21wb25lbnRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRyZXNzT2YoY29tcG9uZW50czogc3RyaW5nW10pIHtcbiAgY29uc3QgaGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdzaGExJyk7XG4gIGZvciAoY29uc3QgYyBvZiBjb21wb25lbnRzKSB7XG4gICAgLy8gc2tpcCBjb21wb25lbnRzIGNhbGxlZCBcIkRlZmF1bHRcIiB0byBlbmFibGUgcmVmYWN0b3JpbmdzXG4gICAgaWYgKGMgPT09IEhJRERFTl9JRCkgeyBjb250aW51ZTsgfVxuXG4gICAgaGFzaC51cGRhdGUoYyk7XG4gICAgaGFzaC51cGRhdGUoJ1xcbicpO1xuICB9XG5cbiAgLy8gcHJlZml4IHdpdGggXCJjOFwiIHNvIHRvIGVuc3VyZSBpdCBzdGFydHMgd2l0aCBub24tZGlnaXQuXG4gIHJldHVybiAnYzgnICsgaGFzaC5kaWdlc3QoJ2hleCcpO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZXMgYSB1bmlxdWUgSUQgZm9yIGEgc2V0IG9mIHRleHR1YWwgY29tcG9uZW50cy5cbiAqXG4gKiBUaGlzIGlzIGRvbmUgYnkgY2FsY3VsYXRpbmcgYSBoYXNoIG9uIHRoZSBmdWxsIHBhdGggYW5kIHVzaW5nIGl0IGFzIGEgc3VmZml4XG4gKiBvZiBhIGxlbmd0aC1saW1pdGVkIFwiaHVtYW5cIiByZW5kaXRpb24gb2YgdGhlIHBhdGggY29tcG9uZW50cy5cbiAqXG4gKiBAcGFyYW0gY29tcG9uZW50cyBUaGUgcGF0aCBjb21wb25lbnRzXG4gKiBAcmV0dXJucyBhIHVuaXF1ZSBhbHBoYS1udW1lcmljIGlkZW50aWZpZXIgd2l0aCBhIG1heGltdW0gbGVuZ3RoIG9mIDI1NVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUxlZ2FjeVVuaXF1ZUlkKGNvbXBvbmVudHM6IHN0cmluZ1tdKSB7XG4gIGNvbXBvbmVudHMgPSBjb21wb25lbnRzLmZpbHRlcih4ID0+IHggIT09IEhJRERFTl9JRCk7XG5cbiAgaWYgKGNvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gY2FsY3VsYXRlIGEgdW5pcXVlIGlkIGZvciBhbiBlbXB0eSBzZXQgb2YgY29tcG9uZW50cycpO1xuICB9XG5cbiAgLy8gdG9wLWxldmVsIHJlc291cmNlcyB3aWxsIHNpbXBseSB1c2UgdGhlIGBuYW1lYCBhcy1pcyBpbiBvcmRlciB0byBzdXBwb3J0XG4gIC8vIHRyYW5zcGFyZW50IG1pZ3JhdGlvbiBvZiBjbG91ZGZvcm1hdGlvbiB0ZW1wbGF0ZXMgdG8gdGhlIENESyB3aXRob3V0IHRoZVxuICAvLyBuZWVkIHRvIHJlbmFtZSBhbGwgcmVzb3VyY2VzLlxuICBpZiAoY29tcG9uZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAvLyB3ZSBmaWx0ZXIgb3V0IG5vbi1hbHBoYSBjaGFyYWN0ZXJzIGJ1dCB0aGF0IGlzIGFjdHVhbGx5IGEgYmFkIGlkZWFcbiAgICAvLyBiZWNhdXNlIGl0IGNvdWxkIGNyZWF0ZSBjb25mbGljdHMgKFwiQS1CXCIgYW5kIFwiQUJcIiB3aWxsIHJlbmRlciB0aGUgc2FtZVxuICAgIC8vIGxvZ2ljYWwgSUQpLiBzYWRseSwgY2hhbmdpbmcgaXQgaW4gdGhlIDEueCB2ZXJzaW9uIGxpbmUgaXMgaW1wb3NzaWJsZVxuICAgIC8vIGJlY2F1c2UgaXQgd2lsbCBiZSBhIGJyZWFraW5nIGNoYW5nZS4gd2Ugc2hvdWxkIGNvbnNpZGVyIGZvciB2Mi4wLlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLWNkay9pc3N1ZXMvNjQyMVxuICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHJlbW92ZU5vbkFscGhhbnVtZXJpYyhjb21wb25lbnRzWzBdKTtcblxuICAgIC8vIGlmIG91ciBjYW5kaWRhdGUgaXMgc2hvcnQgZW5vdWdoLCB1c2UgaXQgYXMgaXMuIG90aGVyd2lzZSwgZmFsbCBiYWNrIHRvXG4gICAgLy8gdGhlIG5vcm1hbCBtb2RlLlxuICAgIGlmIChjYW5kaWRhdGUubGVuZ3RoIDw9IE1BWF9JRF9MRU4pIHtcbiAgICAgIHJldHVybiBjYW5kaWRhdGU7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaGFzaCA9IGxlZ2FjeVBhdGhIYXNoKGNvbXBvbmVudHMpO1xuICBjb25zdCBodW1hbiA9IHJlbW92ZUR1cGVzKGNvbXBvbmVudHMpXG4gICAgLmZpbHRlcih4ID0+IHggIT09IEhJRERFTl9GUk9NX0hVTUFOX0lEKVxuICAgIC5tYXAocmVtb3ZlTm9uQWxwaGFudW1lcmljKVxuICAgIC5qb2luKCcnKVxuICAgIC5zbGljZSgwLCBNQVhfSFVNQU5fTEVOKTtcblxuICByZXR1cm4gaHVtYW4gKyBoYXNoO1xufVxuXG4vKipcbiAqIFRha2UgYSBoYXNoIG9mIHRoZSBnaXZlbiBwYXRoLlxuICpcbiAqIFRoZSBoYXNoIGlzIGxpbWl0ZWQgaW4gc2l6ZS5cbiAqL1xuZnVuY3Rpb24gbGVnYWN5UGF0aEhhc2gocGF0aDogc3RyaW5nW10pOiBzdHJpbmcge1xuICBjb25zdCBtZDUgPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKHBhdGguam9pbihQQVRIX1NFUCkpLmRpZ2VzdCgnaGV4Jyk7XG4gIHJldHVybiBtZDUuc2xpY2UoMCwgSEFTSF9MRU4pLnRvVXBwZXJDYXNlKCk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyBhbGwgbm9uLWFscGhhbnVtZXJpYyBjaGFyYWN0ZXJzIGluIGEgc3RyaW5nLlxuICovXG5mdW5jdGlvbiByZW1vdmVOb25BbHBoYW51bWVyaWMoczogc3RyaW5nKSB7XG4gIHJldHVybiBzLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnJyk7XG59XG5cbi8qKlxuICogUmVtb3ZlIGR1cGxpY2F0ZSBcInRlcm1zXCIgZnJvbSB0aGUgcGF0aCBsaXN0XG4gKlxuICogSWYgdGhlIHByZXZpb3VzIHBhdGggY29tcG9uZW50IG5hbWUgZW5kcyB3aXRoIHRoaXMgY29tcG9uZW50IG5hbWUsIHNraXAgdGhlXG4gKiBjdXJyZW50IGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gcmVtb3ZlRHVwZXMocGF0aDogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHJldCA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBjb21wb25lbnQgb2YgcGF0aCkge1xuICAgIGlmIChyZXQubGVuZ3RoID09PSAwIHx8ICFyZXRbcmV0Lmxlbmd0aCAtIDFdLmVuZHNXaXRoKGNvbXBvbmVudCkpIHtcbiAgICAgIHJldC5wdXNoKGNvbXBvbmVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cbiJdfQ==