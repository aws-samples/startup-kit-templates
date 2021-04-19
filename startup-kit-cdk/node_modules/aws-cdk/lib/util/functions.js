"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cached = void 0;
/**
 * Cache the result of a function on an object
 *
 * We could have used @decorators to make this nicer but we don't use them anywhere yet,
 * so let's keep it simple and readable.
 */
function cached(obj, sym, fn) {
    if (!(sym in obj)) {
        obj[sym] = fn();
    }
    return obj[sym];
}
exports.cached = cached;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnVuY3Rpb25zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZnVuY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7OztHQUtHO0FBQ0gsU0FBZ0IsTUFBTSxDQUFzQixHQUFNLEVBQUUsR0FBVyxFQUFFLEVBQVc7SUFDMUUsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxFQUFFO1FBQ2hCLEdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztLQUMxQjtJQUNELE9BQVEsR0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzNCLENBQUM7QUFMRCx3QkFLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2FjaGUgdGhlIHJlc3VsdCBvZiBhIGZ1bmN0aW9uIG9uIGFuIG9iamVjdFxuICpcbiAqIFdlIGNvdWxkIGhhdmUgdXNlZCBAZGVjb3JhdG9ycyB0byBtYWtlIHRoaXMgbmljZXIgYnV0IHdlIGRvbid0IHVzZSB0aGVtIGFueXdoZXJlIHlldCxcbiAqIHNvIGxldCdzIGtlZXAgaXQgc2ltcGxlIGFuZCByZWFkYWJsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhY2hlZDxBIGV4dGVuZHMgb2JqZWN0LCBCPihvYmo6IEEsIHN5bTogc3ltYm9sLCBmbjogKCkgPT4gQik6IEIge1xuICBpZiAoIShzeW0gaW4gb2JqKSkge1xuICAgIChvYmogYXMgYW55KVtzeW1dID0gZm4oKTtcbiAgfVxuICByZXR1cm4gKG9iaiBhcyBhbnkpW3N5bV07XG59Il19