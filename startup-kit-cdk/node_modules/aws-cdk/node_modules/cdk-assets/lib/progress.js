"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventType = void 0;
/**
 * A single event for an asset
 */
var EventType;
(function (EventType) {
    /**
     * Just starting on an asset
     */
    EventType["START"] = "start";
    /**
     * When an asset is successfully finished
     */
    EventType["SUCCESS"] = "success";
    /**
     * When an asset failed
     */
    EventType["FAIL"] = "fail";
    /**
     * Checking whether an asset has already been published
     */
    EventType["CHECK"] = "check";
    /**
     * The asset was already published
     */
    EventType["FOUND"] = "found";
    /**
     * The asset was reused locally from a cached version
     */
    EventType["CACHED"] = "cached";
    /**
     * The asset will be built
     */
    EventType["BUILD"] = "build";
    /**
     * The asset will be uploaded
     */
    EventType["UPLOAD"] = "upload";
    /**
     * Another type of detail message
     */
    EventType["DEBUG"] = "debug";
})(EventType = exports.EventType || (exports.EventType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3Jlc3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwcm9ncmVzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFZQTs7R0FFRztBQUNILElBQVksU0E2Q1g7QUE3Q0QsV0FBWSxTQUFTO0lBQ25COztPQUVHO0lBQ0gsNEJBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsZ0NBQW1CLENBQUE7SUFFbkI7O09BRUc7SUFDSCwwQkFBYSxDQUFBO0lBRWI7O09BRUc7SUFDSCw0QkFBZSxDQUFBO0lBRWY7O09BRUc7SUFDSCw0QkFBZSxDQUFBO0lBRWY7O09BRUc7SUFDSCw4QkFBaUIsQ0FBQTtJQUVqQjs7T0FFRztJQUNILDRCQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILDhCQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsNEJBQWUsQ0FBQTtBQUNqQixDQUFDLEVBN0NXLFNBQVMsR0FBVCxpQkFBUyxLQUFULGlCQUFTLFFBNkNwQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IElNYW5pZmVzdEVudHJ5IH0gZnJvbSAnLi9hc3NldC1tYW5pZmVzdCc7XG5cbi8qKlxuICogQSBsaXN0ZW5lciBmb3IgcHJvZ3Jlc3MgZXZlbnRzIGZyb20gdGhlIHB1Ymxpc2hlclxuICovXG5leHBvcnQgaW50ZXJmYWNlIElQdWJsaXNoUHJvZ3Jlc3NMaXN0ZW5lciB7XG4gIC8qKlxuICAgKiBBc3NldCBidWlsZCBldmVudFxuICAgKi9cbiAgb25QdWJsaXNoRXZlbnQodHlwZTogRXZlbnRUeXBlLCBldmVudDogSVB1Ymxpc2hQcm9ncmVzcyk6IHZvaWQ7XG59XG5cbi8qKlxuICogQSBzaW5nbGUgZXZlbnQgZm9yIGFuIGFzc2V0XG4gKi9cbmV4cG9ydCBlbnVtIEV2ZW50VHlwZSB7XG4gIC8qKlxuICAgKiBKdXN0IHN0YXJ0aW5nIG9uIGFuIGFzc2V0XG4gICAqL1xuICBTVEFSVCA9ICdzdGFydCcsXG5cbiAgLyoqXG4gICAqIFdoZW4gYW4gYXNzZXQgaXMgc3VjY2Vzc2Z1bGx5IGZpbmlzaGVkXG4gICAqL1xuICBTVUNDRVNTID0gJ3N1Y2Nlc3MnLFxuXG4gIC8qKlxuICAgKiBXaGVuIGFuIGFzc2V0IGZhaWxlZFxuICAgKi9cbiAgRkFJTCA9ICdmYWlsJyxcblxuICAvKipcbiAgICogQ2hlY2tpbmcgd2hldGhlciBhbiBhc3NldCBoYXMgYWxyZWFkeSBiZWVuIHB1Ymxpc2hlZFxuICAgKi9cbiAgQ0hFQ0sgPSAnY2hlY2snLFxuXG4gIC8qKlxuICAgKiBUaGUgYXNzZXQgd2FzIGFscmVhZHkgcHVibGlzaGVkXG4gICAqL1xuICBGT1VORCA9ICdmb3VuZCcsXG5cbiAgLyoqXG4gICAqIFRoZSBhc3NldCB3YXMgcmV1c2VkIGxvY2FsbHkgZnJvbSBhIGNhY2hlZCB2ZXJzaW9uXG4gICAqL1xuICBDQUNIRUQgPSAnY2FjaGVkJyxcblxuICAvKipcbiAgICogVGhlIGFzc2V0IHdpbGwgYmUgYnVpbHRcbiAgICovXG4gIEJVSUxEID0gJ2J1aWxkJyxcblxuICAvKipcbiAgICogVGhlIGFzc2V0IHdpbGwgYmUgdXBsb2FkZWRcbiAgICovXG4gIFVQTE9BRCA9ICd1cGxvYWQnLFxuXG4gIC8qKlxuICAgKiBBbm90aGVyIHR5cGUgb2YgZGV0YWlsIG1lc3NhZ2VcbiAgICovXG4gIERFQlVHID0gJ2RlYnVnJyxcbn1cblxuLyoqXG4gKiBDb250ZXh0IG9iamVjdCBmb3IgcHVibGlzaGluZyBwcm9ncmVzc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIElQdWJsaXNoUHJvZ3Jlc3Mge1xuICAvKipcbiAgICogQ3VycmVudCBldmVudCBtZXNzYWdlXG4gICAqL1xuICByZWFkb25seSBtZXNzYWdlOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFzc2V0IGN1cnJlbnRseSBiZWluZyBwYWNrYWdlZCAoaWYgYW55KVxuICAgKi9cbiAgcmVhZG9ubHkgY3VycmVudEFzc2V0PzogSU1hbmlmZXN0RW50cnk7XG5cbiAgLyoqXG4gICAqIEhvdyBmYXIgYWxvbmcgYXJlIHdlP1xuICAgKi9cbiAgcmVhZG9ubHkgcGVyY2VudENvbXBsZXRlOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEFib3J0IHRoZSBjdXJyZW50IHB1Ymxpc2hpbmcgb3BlcmF0aW9uXG4gICAqL1xuICBhYm9ydCgpOiB2b2lkO1xufVxuIl19