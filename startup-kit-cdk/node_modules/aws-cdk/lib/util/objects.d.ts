import { Obj } from './types';
/**
 * Return a new object by adding missing keys into another object
 */
export declare function applyDefaults(hash: any, defaults: any): any;
/**
 * Return whether the given parameter is an empty object or empty list.
 */
export declare function isEmpty(x: any): boolean;
/**
 * Deep clone a tree of objects, lists or scalars
 *
 * Does not support cycles.
 */
export declare function deepClone(x: any): any;
/**
 * Map over an object, treating it as a dictionary
 */
export declare function mapObject<T, U>(x: Obj<T>, fn: (key: string, value: T) => U): U[];
/**
 * Construct an object from a list of (k, v) pairs
 */
export declare function makeObject<T>(pairs: Array<[string, T]>): Obj<T>;
/**
 * Deep get a value from a tree of nested objects
 *
 * Returns undefined if any part of the path was unset or
 * not an object.
 */
export declare function deepGet(x: any, path: string[]): any;
/**
 * Deep set a value in a tree of nested objects
 *
 * Throws an error if any part of the path is not an object.
 */
export declare function deepSet(x: any, path: string[], value: any): void;
/**
 * Recursively merge objects together
 *
 * The leftmost object is mutated and returned. Arrays are not merged
 * but overwritten just like scalars.
 *
 * If an object is merged into a non-object, the non-object is lost.
 */
export declare function deepMerge(...objects: Array<Obj<any> | undefined>): Obj<any>;
