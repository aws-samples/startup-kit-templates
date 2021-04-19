"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partition = exports.flatten = exports.flatMap = void 0;
/**
 * Map a function over an array and concatenate the results
 */
function flatMap(xs, fn) {
    return flatten(xs.map(fn));
}
exports.flatMap = flatMap;
/**
 * Flatten a list of lists into a list of elements
 */
function flatten(xs) {
    return Array.prototype.concat.apply([], xs);
}
exports.flatten = flatten;
/**
 * Partition a collection by removing and returning all elements that match a predicate
 *
 * Note: the input collection is modified in-place!
 */
function partition(collection, pred) {
    const ret = [];
    let i = 0;
    while (i < collection.length) {
        if (pred(collection[i])) {
            ret.push(collection.splice(i, 1)[0]);
        }
        else {
            i++;
        }
    }
    return ret;
}
exports.partition = partition;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyYXlzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXJyYXlzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOztHQUVHO0FBQ0gsU0FBZ0IsT0FBTyxDQUFPLEVBQU8sRUFBRSxFQUE4QjtJQUNuRSxPQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUZELDBCQUVDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixPQUFPLENBQUksRUFBUztJQUNsQyxPQUFPLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUZELDBCQUVDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLFNBQVMsQ0FBSSxVQUFlLEVBQUUsSUFBdUI7SUFDbkUsTUFBTSxHQUFHLEdBQVEsRUFBRSxDQUFDO0lBQ3BCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLE9BQU8sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUU7UUFDNUIsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDdkIsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3RDO2FBQU07WUFDTCxDQUFDLEVBQUUsQ0FBQztTQUNMO0tBQ0Y7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFYRCw4QkFXQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTWFwIGEgZnVuY3Rpb24gb3ZlciBhbiBhcnJheSBhbmQgY29uY2F0ZW5hdGUgdGhlIHJlc3VsdHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZsYXRNYXA8VCwgVT4oeHM6IFRbXSwgZm46ICgoeDogVCwgaTogbnVtYmVyKSA9PiBVW10pKTogVVtdIHtcbiAgcmV0dXJuIGZsYXR0ZW4oeHMubWFwKGZuKSk7XG59XG5cbi8qKlxuICogRmxhdHRlbiBhIGxpc3Qgb2YgbGlzdHMgaW50byBhIGxpc3Qgb2YgZWxlbWVudHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW48VD4oeHM6IFRbXVtdKTogVFtdIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoW10sIHhzKTtcbn1cblxuLyoqXG4gKiBQYXJ0aXRpb24gYSBjb2xsZWN0aW9uIGJ5IHJlbW92aW5nIGFuZCByZXR1cm5pbmcgYWxsIGVsZW1lbnRzIHRoYXQgbWF0Y2ggYSBwcmVkaWNhdGVcbiAqXG4gKiBOb3RlOiB0aGUgaW5wdXQgY29sbGVjdGlvbiBpcyBtb2RpZmllZCBpbi1wbGFjZSFcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnRpdGlvbjxUPihjb2xsZWN0aW9uOiBUW10sIHByZWQ6ICh4OiBUKSA9PiBib29sZWFuKTogVFtdIHtcbiAgY29uc3QgcmV0OiBUW10gPSBbXTtcbiAgbGV0IGkgPSAwO1xuICB3aGlsZSAoaSA8IGNvbGxlY3Rpb24ubGVuZ3RoKSB7XG4gICAgaWYgKHByZWQoY29sbGVjdGlvbltpXSkpIHtcbiAgICAgIHJldC5wdXNoKGNvbGxlY3Rpb24uc3BsaWNlKGksIDEpWzBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaSsrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmV0O1xufVxuIl19