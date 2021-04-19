/**
 * Type of a map mapping strings to some arbitrary type
 *
 * Name is not ideal, but:
 *
 * - Cannot call it Object, that already means something.
 * - Cannot call it Dict or Dictionary, since in other languages
 *   those also allow specifying the key type.
 */
export declare type Obj<T> = {
    [key: string]: T;
};
/**
 * Return whether the given value is an object
 *
 * Even though arrays technically are objects, we usually want to treat them differently,
 * so we return false in those cases.
 */
export declare function isObject(x: any): x is Obj<any>;
/**
 * Return whether the given value is an array
 */
export declare const isArray: (arg: any) => arg is any[];
/**
 * Return the value of the first argument if it's not undefined, otherwise the default
 */
export declare function ifDefined<T>(x: T | undefined, def: T): T;
