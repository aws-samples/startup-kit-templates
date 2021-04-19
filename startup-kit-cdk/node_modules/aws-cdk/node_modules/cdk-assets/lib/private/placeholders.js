"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceAwsPlaceholders = void 0;
const cx_api_1 = require("@aws-cdk/cx-api");
/**
 * Replace the {ACCOUNT} and {REGION} placeholders in all strings found in a complex object.
 *
 * Duplicated between cdk-assets and aws-cdk CLI because we don't have a good single place to put it
 * (they're nominally independent tools).
 */
async function replaceAwsPlaceholders(object, aws) {
    let partition = async () => {
        const p = await aws.discoverPartition();
        partition = () => Promise.resolve(p);
        return p;
    };
    let account = async () => {
        const a = await aws.discoverCurrentAccount();
        account = () => Promise.resolve(a);
        return a;
    };
    return cx_api_1.EnvironmentPlaceholders.replaceAsync(object, {
        async region() {
            var _a;
            return (_a = object.region) !== null && _a !== void 0 ? _a : aws.discoverDefaultRegion();
        },
        async accountId() {
            return (await account()).accountId;
        },
        async partition() {
            return partition();
        },
    });
}
exports.replaceAwsPlaceholders = replaceAwsPlaceholders;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDRDQUEwRDtBQUcxRDs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxzQkFBc0IsQ0FBZ0MsTUFBUyxFQUFFLEdBQVM7SUFDOUYsSUFBSSxTQUFTLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDekIsTUFBTSxDQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN4QyxTQUFTLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQyxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUMsQ0FBQztJQUVGLElBQUksT0FBTyxHQUFHLEtBQUssSUFBSSxFQUFFO1FBQ3ZCLE1BQU0sQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDN0MsT0FBTyxHQUFHLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkMsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDLENBQUM7SUFFRixPQUFPLGdDQUF1QixDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7UUFDbEQsS0FBSyxDQUFDLE1BQU07O1lBQ1YsYUFBTyxNQUFNLENBQUMsTUFBTSxtQ0FBSSxHQUFHLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUN0RCxDQUFDO1FBQ0QsS0FBSyxDQUFDLFNBQVM7WUFDYixPQUFPLENBQUMsTUFBTSxPQUFPLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsS0FBSyxDQUFDLFNBQVM7WUFDYixPQUFPLFNBQVMsRUFBRSxDQUFDO1FBQ3JCLENBQUM7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBeEJELHdEQXdCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVudmlyb25tZW50UGxhY2Vob2xkZXJzIH0gZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCB7IElBd3MgfSBmcm9tICcuLi9hd3MnO1xuXG4vKipcbiAqIFJlcGxhY2UgdGhlIHtBQ0NPVU5UfSBhbmQge1JFR0lPTn0gcGxhY2Vob2xkZXJzIGluIGFsbCBzdHJpbmdzIGZvdW5kIGluIGEgY29tcGxleCBvYmplY3QuXG4gKlxuICogRHVwbGljYXRlZCBiZXR3ZWVuIGNkay1hc3NldHMgYW5kIGF3cy1jZGsgQ0xJIGJlY2F1c2Ugd2UgZG9uJ3QgaGF2ZSBhIGdvb2Qgc2luZ2xlIHBsYWNlIHRvIHB1dCBpdFxuICogKHRoZXkncmUgbm9taW5hbGx5IGluZGVwZW5kZW50IHRvb2xzKS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcGxhY2VBd3NQbGFjZWhvbGRlcnM8QSBleHRlbmRzIHsgcmVnaW9uPzogc3RyaW5nIH0+KG9iamVjdDogQSwgYXdzOiBJQXdzKTogUHJvbWlzZTxBPiB7XG4gIGxldCBwYXJ0aXRpb24gPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcCA9IGF3YWl0IGF3cy5kaXNjb3ZlclBhcnRpdGlvbigpO1xuICAgIHBhcnRpdGlvbiA9ICgpID0+IFByb21pc2UucmVzb2x2ZShwKTtcbiAgICByZXR1cm4gcDtcbiAgfTtcblxuICBsZXQgYWNjb3VudCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBhID0gYXdhaXQgYXdzLmRpc2NvdmVyQ3VycmVudEFjY291bnQoKTtcbiAgICBhY2NvdW50ID0gKCkgPT4gUHJvbWlzZS5yZXNvbHZlKGEpO1xuICAgIHJldHVybiBhO1xuICB9O1xuXG4gIHJldHVybiBFbnZpcm9ubWVudFBsYWNlaG9sZGVycy5yZXBsYWNlQXN5bmMob2JqZWN0LCB7XG4gICAgYXN5bmMgcmVnaW9uKCkge1xuICAgICAgcmV0dXJuIG9iamVjdC5yZWdpb24gPz8gYXdzLmRpc2NvdmVyRGVmYXVsdFJlZ2lvbigpO1xuICAgIH0sXG4gICAgYXN5bmMgYWNjb3VudElkKCkge1xuICAgICAgcmV0dXJuIChhd2FpdCBhY2NvdW50KCkpLmFjY291bnRJZDtcbiAgICB9LFxuICAgIGFzeW5jIHBhcnRpdGlvbigpIHtcbiAgICAgIHJldHVybiBwYXJ0aXRpb24oKTtcbiAgICB9LFxuICB9KTtcbn0iXX0=