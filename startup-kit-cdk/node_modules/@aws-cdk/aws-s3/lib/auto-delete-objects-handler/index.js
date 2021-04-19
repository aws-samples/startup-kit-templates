"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const aws_sdk_1 = require("aws-sdk");
const s3 = new aws_sdk_1.S3();
async function handler(event) {
    switch (event.RequestType) {
        case 'Create':
        case 'Update':
            return;
        case 'Delete':
            return onDelete(event);
    }
}
exports.handler = handler;
/**
 * Recursively delete all items in the bucket
 *
 * @param bucketName the bucket name
 */
async function emptyBucket(bucketName) {
    var _a, _b;
    const listedObjects = await s3.listObjectVersions({ Bucket: bucketName }).promise();
    const contents = [...(_a = listedObjects.Versions) !== null && _a !== void 0 ? _a : [], ...(_b = listedObjects.DeleteMarkers) !== null && _b !== void 0 ? _b : []];
    if (contents.length === 0) {
        return;
    }
    ;
    const records = contents.map((record) => ({ Key: record.Key, VersionId: record.VersionId }));
    await s3.deleteObjects({ Bucket: bucketName, Delete: { Objects: records } }).promise();
    if (listedObjects === null || listedObjects === void 0 ? void 0 : listedObjects.IsTruncated) {
        await emptyBucket(bucketName);
    }
}
async function onDelete(deleteEvent) {
    var _a;
    const bucketName = (_a = deleteEvent.ResourceProperties) === null || _a === void 0 ? void 0 : _a.BucketName;
    if (!bucketName) {
        throw new Error('No BucketName was provided.');
    }
    await emptyBucket(bucketName);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2REFBNkQ7QUFDN0QscUNBQTZCO0FBRTdCLE1BQU0sRUFBRSxHQUFHLElBQUksWUFBRSxFQUFFLENBQUM7QUFFYixLQUFLLFVBQVUsT0FBTyxDQUFDLEtBQWtEO0lBQzlFLFFBQVEsS0FBSyxDQUFDLFdBQVcsRUFBRTtRQUN6QixLQUFLLFFBQVEsQ0FBQztRQUNkLEtBQUssUUFBUTtZQUNYLE9BQU87UUFDVCxLQUFLLFFBQVE7WUFDWCxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUMxQjtBQUNILENBQUM7QUFSRCwwQkFRQztBQUVEOzs7O0dBSUc7QUFDSCxLQUFLLFVBQVUsV0FBVyxDQUFDLFVBQWtCOztJQUMzQyxNQUFNLGFBQWEsR0FBRyxNQUFNLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3BGLE1BQU0sUUFBUSxHQUFHLENBQUMsU0FBRyxhQUFhLENBQUMsUUFBUSxtQ0FBSSxFQUFFLEVBQUUsU0FBRyxhQUFhLENBQUMsYUFBYSxtQ0FBSSxFQUFFLENBQUMsQ0FBQztJQUN6RixJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLE9BQU87S0FDUjtJQUFBLENBQUM7SUFFRixNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbEcsTUFBTSxFQUFFLENBQUMsYUFBYSxDQUFDLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRXZGLElBQUksYUFBYSxhQUFiLGFBQWEsdUJBQWIsYUFBYSxDQUFFLFdBQVcsRUFBRTtRQUM5QixNQUFNLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUMvQjtBQUNILENBQUM7QUFFRCxLQUFLLFVBQVUsUUFBUSxDQUFDLFdBQThEOztJQUNwRixNQUFNLFVBQVUsU0FBRyxXQUFXLENBQUMsa0JBQWtCLDBDQUFFLFVBQVUsQ0FBQztJQUM5RCxJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0tBQ2hEO0lBQ0QsTUFBTSxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDaEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IFMzIH0gZnJvbSAnYXdzLXNkayc7XG5cbmNvbnN0IHMzID0gbmV3IFMzKCk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50OiBBV1NMYW1iZGEuQ2xvdWRGb3JtYXRpb25DdXN0b21SZXNvdXJjZUV2ZW50KSB7XG4gIHN3aXRjaCAoZXZlbnQuUmVxdWVzdFR5cGUpIHtcbiAgICBjYXNlICdDcmVhdGUnOlxuICAgIGNhc2UgJ1VwZGF0ZSc6XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAnRGVsZXRlJzpcbiAgICAgIHJldHVybiBvbkRlbGV0ZShldmVudCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBkZWxldGUgYWxsIGl0ZW1zIGluIHRoZSBidWNrZXRcbiAqXG4gKiBAcGFyYW0gYnVja2V0TmFtZSB0aGUgYnVja2V0IG5hbWVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZW1wdHlCdWNrZXQoYnVja2V0TmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGxpc3RlZE9iamVjdHMgPSBhd2FpdCBzMy5saXN0T2JqZWN0VmVyc2lvbnMoeyBCdWNrZXQ6IGJ1Y2tldE5hbWUgfSkucHJvbWlzZSgpO1xuICBjb25zdCBjb250ZW50cyA9IFsuLi5saXN0ZWRPYmplY3RzLlZlcnNpb25zID8/IFtdLCAuLi5saXN0ZWRPYmplY3RzLkRlbGV0ZU1hcmtlcnMgPz8gW11dO1xuICBpZiAoY29udGVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9O1xuXG4gIGNvbnN0IHJlY29yZHMgPSBjb250ZW50cy5tYXAoKHJlY29yZDogYW55KSA9PiAoeyBLZXk6IHJlY29yZC5LZXksIFZlcnNpb25JZDogcmVjb3JkLlZlcnNpb25JZCB9KSk7XG4gIGF3YWl0IHMzLmRlbGV0ZU9iamVjdHMoeyBCdWNrZXQ6IGJ1Y2tldE5hbWUsIERlbGV0ZTogeyBPYmplY3RzOiByZWNvcmRzIH0gfSkucHJvbWlzZSgpO1xuXG4gIGlmIChsaXN0ZWRPYmplY3RzPy5Jc1RydW5jYXRlZCkge1xuICAgIGF3YWl0IGVtcHR5QnVja2V0KGJ1Y2tldE5hbWUpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9uRGVsZXRlKGRlbGV0ZUV2ZW50OiBBV1NMYW1iZGEuQ2xvdWRGb3JtYXRpb25DdXN0b21SZXNvdXJjZURlbGV0ZUV2ZW50KSB7XG4gIGNvbnN0IGJ1Y2tldE5hbWUgPSBkZWxldGVFdmVudC5SZXNvdXJjZVByb3BlcnRpZXM/LkJ1Y2tldE5hbWU7XG4gIGlmICghYnVja2V0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignTm8gQnVja2V0TmFtZSB3YXMgcHJvdmlkZWQuJyk7XG4gIH1cbiAgYXdhaXQgZW1wdHlCdWNrZXQoYnVja2V0TmFtZSk7XG59XG4iXX0=