"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAsBanner = void 0;
const colors = require("colors/safe");
/**
 * Returns a set of strings when printed on the console produces a banner msg. The message is in the following format -
 * ********************
 * *** msg line x   ***
 * *** msg line xyz ***
 * ********************
 *
 * Spec:
 * - The width of every line is equal, dictated by the longest message string
 * - The first and last lines are '*'s for the full length of the line
 * - Each line in between is prepended with '*** ' and appended with ' ***'
 * - The text is indented left, i.e. whitespace is right-padded when the length is shorter than the longest.
 *
 * @param msgs array of strings containing the message lines to be printed in the banner. Returns empty string if array
 * is empty.
 * @returns array of strings containing the message formatted as a banner
 */
function formatAsBanner(msgs) {
    const printLen = (str) => colors.strip(str).length;
    if (msgs.length === 0) {
        return [];
    }
    const leftPad = '*** ';
    const rightPad = ' ***';
    const bannerWidth = printLen(leftPad) + printLen(rightPad) +
        msgs.reduce((acc, msg) => Math.max(acc, printLen(msg)), 0);
    const bannerLines = [];
    bannerLines.push('*'.repeat(bannerWidth));
    // Improvement: If any 'msg' is wider than the terminal width, wrap message across lines.
    msgs.forEach((msg) => {
        const padding = ' '.repeat(bannerWidth - (printLen(msg) + printLen(leftPad) + printLen(rightPad)));
        bannerLines.push(''.concat(leftPad, msg, padding, rightPad));
    });
    bannerLines.push('*'.repeat(bannerWidth));
    return bannerLines;
}
exports.formatAsBanner = formatAsBanner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc29sZS1mb3JtYXR0ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uc29sZS1mb3JtYXR0ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHNDQUFzQztBQUV0Qzs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxJQUFjO0lBQzNDLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBVyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUUzRCxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUM7SUFDdkIsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDO0lBQ3hCLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDO1FBQ3hELElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUU3RCxNQUFNLFdBQVcsR0FBYSxFQUFFLENBQUM7SUFDakMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFFMUMseUZBQXlGO0lBQ3pGLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUNuQixNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUMvRCxDQUFDLENBQUMsQ0FBQztJQUVILFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBQzFDLE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUF2QkQsd0NBdUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycy9zYWZlJztcblxuLyoqXG4gKiBSZXR1cm5zIGEgc2V0IG9mIHN0cmluZ3Mgd2hlbiBwcmludGVkIG9uIHRoZSBjb25zb2xlIHByb2R1Y2VzIGEgYmFubmVyIG1zZy4gVGhlIG1lc3NhZ2UgaXMgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXQgLVxuICogKioqKioqKioqKioqKioqKioqKipcbiAqICoqKiBtc2cgbGluZSB4ICAgKioqXG4gKiAqKiogbXNnIGxpbmUgeHl6ICoqKlxuICogKioqKioqKioqKioqKioqKioqKipcbiAqXG4gKiBTcGVjOlxuICogLSBUaGUgd2lkdGggb2YgZXZlcnkgbGluZSBpcyBlcXVhbCwgZGljdGF0ZWQgYnkgdGhlIGxvbmdlc3QgbWVzc2FnZSBzdHJpbmdcbiAqIC0gVGhlIGZpcnN0IGFuZCBsYXN0IGxpbmVzIGFyZSAnKidzIGZvciB0aGUgZnVsbCBsZW5ndGggb2YgdGhlIGxpbmVcbiAqIC0gRWFjaCBsaW5lIGluIGJldHdlZW4gaXMgcHJlcGVuZGVkIHdpdGggJyoqKiAnIGFuZCBhcHBlbmRlZCB3aXRoICcgKioqJ1xuICogLSBUaGUgdGV4dCBpcyBpbmRlbnRlZCBsZWZ0LCBpLmUuIHdoaXRlc3BhY2UgaXMgcmlnaHQtcGFkZGVkIHdoZW4gdGhlIGxlbmd0aCBpcyBzaG9ydGVyIHRoYW4gdGhlIGxvbmdlc3QuXG4gKlxuICogQHBhcmFtIG1zZ3MgYXJyYXkgb2Ygc3RyaW5ncyBjb250YWluaW5nIHRoZSBtZXNzYWdlIGxpbmVzIHRvIGJlIHByaW50ZWQgaW4gdGhlIGJhbm5lci4gUmV0dXJucyBlbXB0eSBzdHJpbmcgaWYgYXJyYXlcbiAqIGlzIGVtcHR5LlxuICogQHJldHVybnMgYXJyYXkgb2Ygc3RyaW5ncyBjb250YWluaW5nIHRoZSBtZXNzYWdlIGZvcm1hdHRlZCBhcyBhIGJhbm5lclxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0QXNCYW5uZXIobXNnczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHByaW50TGVuID0gKHN0cjogc3RyaW5nKSA9PiBjb2xvcnMuc3RyaXAoc3RyKS5sZW5ndGg7XG5cbiAgaWYgKG1zZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgY29uc3QgbGVmdFBhZCA9ICcqKiogJztcbiAgY29uc3QgcmlnaHRQYWQgPSAnICoqKic7XG4gIGNvbnN0IGJhbm5lcldpZHRoID0gcHJpbnRMZW4obGVmdFBhZCkgKyBwcmludExlbihyaWdodFBhZCkgK1xuICAgIG1zZ3MucmVkdWNlKChhY2MsIG1zZykgPT4gTWF0aC5tYXgoYWNjLCBwcmludExlbihtc2cpKSwgMCk7XG5cbiAgY29uc3QgYmFubmVyTGluZXM6IHN0cmluZ1tdID0gW107XG4gIGJhbm5lckxpbmVzLnB1c2goJyonLnJlcGVhdChiYW5uZXJXaWR0aCkpO1xuXG4gIC8vIEltcHJvdmVtZW50OiBJZiBhbnkgJ21zZycgaXMgd2lkZXIgdGhhbiB0aGUgdGVybWluYWwgd2lkdGgsIHdyYXAgbWVzc2FnZSBhY3Jvc3MgbGluZXMuXG4gIG1zZ3MuZm9yRWFjaCgobXNnKSA9PiB7XG4gICAgY29uc3QgcGFkZGluZyA9ICcgJy5yZXBlYXQoYmFubmVyV2lkdGggLSAocHJpbnRMZW4obXNnKSArIHByaW50TGVuKGxlZnRQYWQpICsgcHJpbnRMZW4ocmlnaHRQYWQpKSk7XG4gICAgYmFubmVyTGluZXMucHVzaCgnJy5jb25jYXQobGVmdFBhZCwgbXNnLCBwYWRkaW5nLCByaWdodFBhZCkpO1xuICB9KTtcblxuICBiYW5uZXJMaW5lcy5wdXNoKCcqJy5yZXBlYXQoYmFubmVyV2lkdGgpKTtcbiAgcmV0dXJuIGJhbm5lckxpbmVzO1xufVxuIl19