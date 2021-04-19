/**
 * Map a function over an array and concatenate the results
 */
export declare function flatMap<T, U>(xs: T[], fn: ((x: T, i: number) => U[])): U[];
/**
 * Flatten a list of lists into a list of elements
 */
export declare function flatten<T>(xs: T[][]): T[];
/**
 * Partition a collection by removing and returning all elements that match a predicate
 *
 * Note: the input collection is modified in-place!
 */
export declare function partition<T>(collection: T[], pred: (x: T) => boolean): T[];
