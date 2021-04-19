/**
 * Calculate differences of immutable elements
 */
export declare class DiffableCollection<T extends Eq<T>> {
    readonly additions: T[];
    readonly removals: T[];
    private readonly oldElements;
    private readonly newElements;
    addOld(...elements: T[]): void;
    addNew(...elements: T[]): void;
    calculateDiff(): void;
    get hasChanges(): boolean;
    get hasAdditions(): boolean;
    get hasRemovals(): boolean;
}
/**
 * Things that can be compared to themselves (by value)
 */
interface Eq<T> {
    equal(other: T): boolean;
}
export {};
