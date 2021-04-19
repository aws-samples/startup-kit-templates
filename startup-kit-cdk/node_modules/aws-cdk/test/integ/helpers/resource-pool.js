"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcePool = void 0;
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
class ResourcePool {
    constructor(resources) {
        this.waiters = [];
        if (resources.length === 0) {
            throw new Error('Must have at least one resource in the pool');
        }
        this.resources = [...resources];
    }
    /**
     * Take one value from the resource pool
     *
     * If no such value is currently available, wait until it is.
     */
    take() {
        const next = this.resources.shift();
        if (next !== undefined) {
            return Promise.resolve(this.makeLease(next));
        }
        else {
            return new Promise(ok => {
                this.waiters.push((resource) => ok(this.makeLease(resource)));
            });
        }
    }
    /**
     * Execute a block using a single resource from the pool
     */
    async using(block) {
        const lease = await this.take();
        try {
            return await block(lease.value);
        }
        finally {
            lease.dispose();
        }
    }
    makeLease(value) {
        let disposed = false;
        return {
            value,
            dispose: () => {
                if (disposed) {
                    throw new Error('Calling dispose() on an already-disposed lease.');
                }
                disposed = true;
                this.returnValue(value);
            },
        };
    }
    /**
     * When a value is returned:
     *
     * - If someone's waiting for it, give it to them
     * - Otherwise put it back into the pool
     */
    returnValue(value) {
        const nextWaiter = this.waiters.shift();
        if (nextWaiter !== undefined) {
            // Execute in the next tick, otherwise the call stack is going to get very
            // confusing.
            setImmediate(() => nextWaiter(value));
        }
        else {
            this.resources.unshift(value);
        }
    }
}
exports.ResourcePool = ResourcePool;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2UtcG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlc291cmNlLXBvb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxZQUFZO0lBSXZCLFlBQVksU0FBYztRQUZULFlBQU8sR0FBMEIsRUFBRSxDQUFDO1FBR25ELElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO1NBQ2hFO1FBQ0QsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxJQUFJO1FBQ1QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNwQyxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDdEIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUM5QzthQUFNO1lBQ0wsT0FBTyxJQUFJLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDdEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoRSxDQUFDLENBQUMsQ0FBQztTQUNKO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLEtBQUssQ0FBSSxLQUErQjtRQUNuRCxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNoQyxJQUFJO1lBQ0YsT0FBTyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDakM7Z0JBQVM7WUFDUixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDakI7SUFDSCxDQUFDO0lBRU8sU0FBUyxDQUFDLEtBQVE7UUFDeEIsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLE9BQU87WUFDTCxLQUFLO1lBQ0wsT0FBTyxFQUFFLEdBQUcsRUFBRTtnQkFDWixJQUFJLFFBQVEsRUFBRTtvQkFDWixNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7aUJBQ3BFO2dCQUNELFFBQVEsR0FBRyxJQUFJLENBQUM7Z0JBQ2hCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDMUIsQ0FBQztTQUNGLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSyxXQUFXLENBQUMsS0FBUTtRQUMxQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3hDLElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRTtZQUM1QiwwRUFBMEU7WUFDMUUsYUFBYTtZQUNiLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztTQUN2QzthQUFNO1lBQ0wsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDL0I7SUFDSCxDQUFDO0NBQ0Y7QUFyRUQsb0NBcUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIGNsYXNzIHRoYXQgaG9sZHMgYSBwb29sIG9mIHJlc291cmNlcyBhbmQgZ2l2ZXMgdGhlbSBvdXQgYW5kIHJldHVybnMgdGhlbSBvbi1kZW1hbmRcbiAqXG4gKiBUaGUgcmVzb3VyY2VzIHdpbGwgYmUgZ2l2ZW4gb3V0IGZyb250IHRvIGJhY2ssIHdoZW4gdGhleSBhcmUgcmV0dXJuZWRcbiAqIHRoZSBtb3N0IHJlY2VudGx5IHJldHVybmVkIHZlcnNpb24gd2lsbCBiZSBnaXZlbiBvdXQgYWdhaW4gKGZvciBiZXN0XG4gKiBjYWNoZSBjb2hlcmVuY3kpLlxuICpcbiAqIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBjb25zdW1lcnMgd2FpdGluZyBmb3IgYSByZXNvdXJjZSwgY29uc3VtZXJzIGFyZSBzZXJ2aWNlZFxuICogaW4gRklGTyBvcmRlciBmb3IgbW9zdCBmYWlybmVzcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlc291cmNlUG9vbDxBPiB7XG4gIHByaXZhdGUgcmVhZG9ubHkgcmVzb3VyY2VzOiBBW107XG4gIHByaXZhdGUgcmVhZG9ubHkgd2FpdGVyczogQXJyYXk8KHg6IEEpID0+IHZvaWQ+ID0gW107XG5cbiAgY29uc3RydWN0b3IocmVzb3VyY2VzOiBBW10pIHtcbiAgICBpZiAocmVzb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IGhhdmUgYXQgbGVhc3Qgb25lIHJlc291cmNlIGluIHRoZSBwb29sJyk7XG4gICAgfVxuICAgIHRoaXMucmVzb3VyY2VzID0gWy4uLnJlc291cmNlc107XG4gIH1cblxuICAvKipcbiAgICogVGFrZSBvbmUgdmFsdWUgZnJvbSB0aGUgcmVzb3VyY2UgcG9vbFxuICAgKlxuICAgKiBJZiBubyBzdWNoIHZhbHVlIGlzIGN1cnJlbnRseSBhdmFpbGFibGUsIHdhaXQgdW50aWwgaXQgaXMuXG4gICAqL1xuICBwdWJsaWMgdGFrZSgpOiBQcm9taXNlPElMZWFzZTxBPj4ge1xuICAgIGNvbnN0IG5leHQgPSB0aGlzLnJlc291cmNlcy5zaGlmdCgpO1xuICAgIGlmIChuZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5tYWtlTGVhc2UobmV4dCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2Uob2sgPT4ge1xuICAgICAgICB0aGlzLndhaXRlcnMucHVzaCgocmVzb3VyY2UpID0+IG9rKHRoaXMubWFrZUxlYXNlKHJlc291cmNlKSkpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYSBibG9jayB1c2luZyBhIHNpbmdsZSByZXNvdXJjZSBmcm9tIHRoZSBwb29sXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgdXNpbmc8Qj4oYmxvY2s6ICh4OiBBKSA9PiBCIHwgUHJvbWlzZTxCPik6IFByb21pc2U8Qj4ge1xuICAgIGNvbnN0IGxlYXNlID0gYXdhaXQgdGhpcy50YWtlKCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBibG9jayhsZWFzZS52YWx1ZSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGxlYXNlLmRpc3Bvc2UoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG1ha2VMZWFzZSh2YWx1ZTogQSk6IElMZWFzZTxBPiB7XG4gICAgbGV0IGRpc3Bvc2VkID0gZmFsc2U7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZhbHVlLFxuICAgICAgZGlzcG9zZTogKCkgPT4ge1xuICAgICAgICBpZiAoZGlzcG9zZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbGxpbmcgZGlzcG9zZSgpIG9uIGFuIGFscmVhZHktZGlzcG9zZWQgbGVhc2UuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZGlzcG9zZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLnJldHVyblZhbHVlKHZhbHVlKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGVuIGEgdmFsdWUgaXMgcmV0dXJuZWQ6XG4gICAqXG4gICAqIC0gSWYgc29tZW9uZSdzIHdhaXRpbmcgZm9yIGl0LCBnaXZlIGl0IHRvIHRoZW1cbiAgICogLSBPdGhlcndpc2UgcHV0IGl0IGJhY2sgaW50byB0aGUgcG9vbFxuICAgKi9cbiAgcHJpdmF0ZSByZXR1cm5WYWx1ZSh2YWx1ZTogQSkge1xuICAgIGNvbnN0IG5leHRXYWl0ZXIgPSB0aGlzLndhaXRlcnMuc2hpZnQoKTtcbiAgICBpZiAobmV4dFdhaXRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBFeGVjdXRlIGluIHRoZSBuZXh0IHRpY2ssIG90aGVyd2lzZSB0aGUgY2FsbCBzdGFjayBpcyBnb2luZyB0byBnZXQgdmVyeVxuICAgICAgLy8gY29uZnVzaW5nLlxuICAgICAgc2V0SW1tZWRpYXRlKCgpID0+IG5leHRXYWl0ZXIodmFsdWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZXNvdXJjZXMudW5zaGlmdCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQSBzaW5nbGUgdmFsdWUgdGFrZW4gZnJvbSB0aGUgcG9vbFxuICovXG5leHBvcnQgaW50ZXJmYWNlIElMZWFzZTxBPiB7XG4gIC8qKlxuICAgKiBUaGUgdmFsdWUgb2J0YWluZWQgYnkgdGhlIGxlYXNlXG4gICAqL1xuICByZWFkb25seSB2YWx1ZTogQTtcblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBsZWFzZWQgdmFsdWUgdG8gdGhlIHBvb2xcbiAgICovXG4gIGRpc3Bvc2UoKTogdm9pZDtcbn0iXX0=