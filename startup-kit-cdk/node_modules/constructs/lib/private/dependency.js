"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependableTrait = exports.ConcreteDependable = void 0;
/**
 * A set of constructs to be used as a dependable
 *
 * This class can be used when a set of constructs which are disjoint in the
 * construct tree needs to be combined to be used as a single dependable.
 *
 * @experimental
 */
class ConcreteDependable {
    constructor() {
        this._dependencyRoots = new Array();
        const self = this;
        DependableTrait.implement(this, {
            get dependencyRoots() { return self._dependencyRoots; },
        });
    }
    /**
     * Add a construct to the dependency roots
     */
    add(construct) {
        this._dependencyRoots.push(construct);
    }
}
exports.ConcreteDependable = ConcreteDependable;
const DEPENDABLE_SYMBOL = Symbol.for('@aws-cdk/core.DependableTrait');
/**
 * Trait for IDependable
 *
 * Traits are interfaces that are privately implemented by objects. Instead of
 * showing up in the public interface of a class, they need to be queried
 * explicitly. This is used to implement certain framework features that are
 * not intended to be used by Construct consumers, and so should be hidden
 * from accidental use.
 *
 * @example
 *
 * // Usage
 * const roots = DependableTrait.get(construct).dependencyRoots;
 *
 * // Definition
 * DependableTrait.implement(construct, {
 *   get dependencyRoots() { return []; }
 * });
 *
 * @experimental
 */
class DependableTrait {
    /**
     * Register `instance` to have the given DependableTrait
     *
     * Should be called in the class constructor.
     */
    static implement(instance, trait) {
        // I would also like to reference classes (to cut down on the list of objects
        // we need to manage), but we can't do that either since jsii doesn't have the
        // concept of a class reference.
        instance[DEPENDABLE_SYMBOL] = trait;
    }
    /**
     * Return the matching DependableTrait for the given class instance.
     */
    static get(instance) {
        const ret = instance[DEPENDABLE_SYMBOL];
        if (!ret) {
            throw new Error(`${instance} does not implement DependableTrait`);
        }
        return ret;
    }
}
exports.DependableTrait = DependableTrait;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwZW5kZW5jeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9wcml2YXRlL2RlcGVuZGVuY3kudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBaUJBOzs7Ozs7O0dBT0c7QUFDSCxNQUFhLGtCQUFrQjtJQUc3QjtRQUZpQixxQkFBZ0IsR0FBRyxJQUFJLEtBQUssRUFBYyxDQUFDO1FBRzFELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztRQUNsQixlQUFlLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRTtZQUM5QixJQUFJLGVBQWUsS0FBSyxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7U0FDeEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksR0FBRyxDQUFDLFNBQXFCO1FBQzlCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDeEMsQ0FBQztDQUNGO0FBaEJELGdEQWdCQztBQUVELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBRXRFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9CRztBQUNILE1BQXNCLGVBQWU7SUFDbkM7Ozs7T0FJRztJQUNJLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBcUIsRUFBRSxLQUFzQjtRQUNuRSw2RUFBNkU7UUFDN0UsOEVBQThFO1FBQzlFLGdDQUFnQztRQUMvQixRQUFnQixDQUFDLGlCQUFpQixDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQy9DLENBQUM7SUFFRDs7T0FFRztJQUNJLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBcUI7UUFDckMsTUFBTSxHQUFHLEdBQUksUUFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2pELElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDUixNQUFNLElBQUksS0FBSyxDQUFDLEdBQUcsUUFBUSxxQ0FBcUMsQ0FBQyxDQUFDO1NBQ25FO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0NBU0Y7QUEvQkQsMENBK0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSUNvbnN0cnVjdCB9IGZyb20gJy4uL2NvbnN0cnVjdCc7XG5cbi8qKlxuICogVHJhaXQgbWFya2VyIGZvciBjbGFzc2VzIHRoYXQgY2FuIGJlIGRlcGVuZGVkIHVwb25cbiAqXG4gKiBUaGUgcHJlc2VuY2Ugb2YgdGhpcyBpbnRlcmZhY2UgaW5kaWNhdGVzIHRoYXQgYW4gb2JqZWN0IGhhc1xuICogYW4gYElEZXBlbmRhYmxlVHJhaXRgIGltcGxlbWVudGF0aW9uLlxuICpcbiAqIFRoaXMgaW50ZXJmYWNlIGNhbiBiZSB1c2VkIHRvIHRha2UgYW4gKG9yZGVyaW5nKSBkZXBlbmRlbmN5IG9uIGEgc2V0IG9mXG4gKiBjb25zdHJ1Y3RzLiBBbiBvcmRlcmluZyBkZXBlbmRlbmN5IGltcGxpZXMgdGhhdCB0aGUgcmVzb3VyY2VzIHJlcHJlc2VudGVkIGJ5XG4gKiB0aG9zZSBjb25zdHJ1Y3RzIGFyZSBkZXBsb3llZCBiZWZvcmUgdGhlIHJlc291cmNlcyBkZXBlbmRpbmcgT04gdGhlbSBhcmVcbiAqIGRlcGxveWVkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElEZXBlbmRhYmxlIHtcbiAgLy8gRW1wdHksIHRoaXMgaW50ZXJmYWNlIGlzIGEgdHJhaXQgbWFya2VyXG59XG5cbi8qKlxuICogQSBzZXQgb2YgY29uc3RydWN0cyB0byBiZSB1c2VkIGFzIGEgZGVwZW5kYWJsZVxuICpcbiAqIFRoaXMgY2xhc3MgY2FuIGJlIHVzZWQgd2hlbiBhIHNldCBvZiBjb25zdHJ1Y3RzIHdoaWNoIGFyZSBkaXNqb2ludCBpbiB0aGVcbiAqIGNvbnN0cnVjdCB0cmVlIG5lZWRzIHRvIGJlIGNvbWJpbmVkIHRvIGJlIHVzZWQgYXMgYSBzaW5nbGUgZGVwZW5kYWJsZS5cbiAqXG4gKiBAZXhwZXJpbWVudGFsXG4gKi9cbmV4cG9ydCBjbGFzcyBDb25jcmV0ZURlcGVuZGFibGUgaW1wbGVtZW50cyBJRGVwZW5kYWJsZSB7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2RlcGVuZGVuY3lSb290cyA9IG5ldyBBcnJheTxJQ29uc3RydWN0PigpO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIERlcGVuZGFibGVUcmFpdC5pbXBsZW1lbnQodGhpcywge1xuICAgICAgZ2V0IGRlcGVuZGVuY3lSb290cygpIHsgcmV0dXJuIHNlbGYuX2RlcGVuZGVuY3lSb290czsgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBjb25zdHJ1Y3QgdG8gdGhlIGRlcGVuZGVuY3kgcm9vdHNcbiAgICovXG4gIHB1YmxpYyBhZGQoY29uc3RydWN0OiBJQ29uc3RydWN0KSB7XG4gICAgdGhpcy5fZGVwZW5kZW5jeVJvb3RzLnB1c2goY29uc3RydWN0KTtcbiAgfVxufVxuXG5jb25zdCBERVBFTkRBQkxFX1NZTUJPTCA9IFN5bWJvbC5mb3IoJ0Bhd3MtY2RrL2NvcmUuRGVwZW5kYWJsZVRyYWl0Jyk7XG5cbi8qKlxuICogVHJhaXQgZm9yIElEZXBlbmRhYmxlXG4gKlxuICogVHJhaXRzIGFyZSBpbnRlcmZhY2VzIHRoYXQgYXJlIHByaXZhdGVseSBpbXBsZW1lbnRlZCBieSBvYmplY3RzLiBJbnN0ZWFkIG9mXG4gKiBzaG93aW5nIHVwIGluIHRoZSBwdWJsaWMgaW50ZXJmYWNlIG9mIGEgY2xhc3MsIHRoZXkgbmVlZCB0byBiZSBxdWVyaWVkXG4gKiBleHBsaWNpdGx5LiBUaGlzIGlzIHVzZWQgdG8gaW1wbGVtZW50IGNlcnRhaW4gZnJhbWV3b3JrIGZlYXR1cmVzIHRoYXQgYXJlXG4gKiBub3QgaW50ZW5kZWQgdG8gYmUgdXNlZCBieSBDb25zdHJ1Y3QgY29uc3VtZXJzLCBhbmQgc28gc2hvdWxkIGJlIGhpZGRlblxuICogZnJvbSBhY2NpZGVudGFsIHVzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIC8vIFVzYWdlXG4gKiBjb25zdCByb290cyA9IERlcGVuZGFibGVUcmFpdC5nZXQoY29uc3RydWN0KS5kZXBlbmRlbmN5Um9vdHM7XG4gKlxuICogLy8gRGVmaW5pdGlvblxuICogRGVwZW5kYWJsZVRyYWl0LmltcGxlbWVudChjb25zdHJ1Y3QsIHtcbiAqICAgZ2V0IGRlcGVuZGVuY3lSb290cygpIHsgcmV0dXJuIFtdOyB9XG4gKiB9KTtcbiAqXG4gKiBAZXhwZXJpbWVudGFsXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBEZXBlbmRhYmxlVHJhaXQge1xuICAvKipcbiAgICogUmVnaXN0ZXIgYGluc3RhbmNlYCB0byBoYXZlIHRoZSBnaXZlbiBEZXBlbmRhYmxlVHJhaXRcbiAgICpcbiAgICogU2hvdWxkIGJlIGNhbGxlZCBpbiB0aGUgY2xhc3MgY29uc3RydWN0b3IuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGltcGxlbWVudChpbnN0YW5jZTogSURlcGVuZGFibGUsIHRyYWl0OiBEZXBlbmRhYmxlVHJhaXQpIHtcbiAgICAvLyBJIHdvdWxkIGFsc28gbGlrZSB0byByZWZlcmVuY2UgY2xhc3NlcyAodG8gY3V0IGRvd24gb24gdGhlIGxpc3Qgb2Ygb2JqZWN0c1xuICAgIC8vIHdlIG5lZWQgdG8gbWFuYWdlKSwgYnV0IHdlIGNhbid0IGRvIHRoYXQgZWl0aGVyIHNpbmNlIGpzaWkgZG9lc24ndCBoYXZlIHRoZVxuICAgIC8vIGNvbmNlcHQgb2YgYSBjbGFzcyByZWZlcmVuY2UuXG4gICAgKGluc3RhbmNlIGFzIGFueSlbREVQRU5EQUJMRV9TWU1CT0xdID0gdHJhaXQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBtYXRjaGluZyBEZXBlbmRhYmxlVHJhaXQgZm9yIHRoZSBnaXZlbiBjbGFzcyBpbnN0YW5jZS5cbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZ2V0KGluc3RhbmNlOiBJRGVwZW5kYWJsZSk6IERlcGVuZGFibGVUcmFpdCB7XG4gICAgY29uc3QgcmV0ID0gKGluc3RhbmNlIGFzIGFueSlbREVQRU5EQUJMRV9TWU1CT0xdO1xuICAgIGlmICghcmV0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7aW5zdGFuY2V9IGRvZXMgbm90IGltcGxlbWVudCBEZXBlbmRhYmxlVHJhaXRgKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc2V0IG9mIGNvbnN0cnVjdHMgdGhhdCBmb3JtIHRoZSByb290IG9mIHRoaXMgZGVwZW5kYWJsZVxuICAgKlxuICAgKiBBbGwgcmVzb3VyY2VzIHVuZGVyIGFsbCByZXR1cm5lZCBjb25zdHJ1Y3RzIGFyZSBpbmNsdWRlZCBpbiB0aGUgb3JkZXJpbmdcbiAgICogZGVwZW5kZW5jeS5cbiAgICovXG4gIHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSBkZXBlbmRlbmN5Um9vdHM6IElDb25zdHJ1Y3RbXTtcbn1cbiJdfQ==