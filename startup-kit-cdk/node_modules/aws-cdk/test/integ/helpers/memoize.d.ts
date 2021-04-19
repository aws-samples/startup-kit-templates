/**
 * Return a memoized version of an function with 0 arguments.
 *
 * Async-safe.
 */
export declare function memoize0<A>(fn: () => Promise<A>): () => Promise<A>;
