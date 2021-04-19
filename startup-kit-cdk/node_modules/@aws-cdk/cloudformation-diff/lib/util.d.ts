/**
 * Turn a (multi-key) extraction function into a comparator for use in Array.sort()
 */
export declare function makeComparator<T, U>(keyFn: (x: T) => U[]): (a: T, b: T) => number;
export declare function dropIfEmpty<T>(xs: T[]): T[] | undefined;
export declare function deepRemoveUndefined(x: any): any;
export declare function flatMap<T, U>(xs: T[], f: (x: T) => U[]): U[];
