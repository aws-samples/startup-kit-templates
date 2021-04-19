/**
 * A class that holds a pool of resources and gives them out and returns them on-demand
 *
 * The resources will be given out front to back, when they are returned
 * the most recently returned version will be given out again (for best
 * cache coherency).
 *
 * If there are multiple consumers waiting for a resource, consumers are serviced
 * in FIFO order for most fairness.
 */
export declare class ResourcePool<A> {
    private readonly resources;
    private readonly waiters;
    constructor(resources: A[]);
    /**
     * Take one value from the resource pool
     *
     * If no such value is currently available, wait until it is.
     */
    take(): Promise<ILease<A>>;
    /**
     * Execute a block using a single resource from the pool
     */
    using<B>(block: (x: A) => B | Promise<B>): Promise<B>;
    private makeLease;
    /**
     * When a value is returned:
     *
     * - If someone's waiting for it, give it to them
     * - Otherwise put it back into the pool
     */
    private returnValue;
}
/**
 * A single value taken from the pool
 */
export interface ILease<A> {
    /**
     * The value obtained by the lease
     */
    readonly value: A;
    /**
     * Return the leased value to the pool
     */
    dispose(): void;
}
