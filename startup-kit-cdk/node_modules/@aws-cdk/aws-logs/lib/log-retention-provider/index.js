"use strict";
/* eslint-disable no-console */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require("aws-sdk");
/**
 * Creates a log group and doesn't throw if it exists.
 *
 * @param logGroupName the name of the log group to create.
 * @param region to create the log group in
 * @param options CloudWatch API SDK options.
 */
async function createLogGroupSafe(logGroupName, region, options) {
    try { // Try to create the log group
        const cloudwatchlogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28', region, ...options });
        await cloudwatchlogs.createLogGroup({ logGroupName }).promise();
    }
    catch (e) {
        if (e.code !== 'ResourceAlreadyExistsException') {
            throw e;
        }
    }
}
/**
 * Puts or deletes a retention policy on a log group.
 *
 * @param logGroupName the name of the log group to create
 * @param region the region of the log group
 * @param options CloudWatch API SDK options.
 * @param retentionInDays the number of days to retain the log events in the specified log group.
 */
async function setRetentionPolicy(logGroupName, region, options, retentionInDays) {
    const cloudwatchlogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28', region, ...options });
    if (!retentionInDays) {
        await cloudwatchlogs.deleteRetentionPolicy({ logGroupName }).promise();
    }
    else {
        await cloudwatchlogs.putRetentionPolicy({ logGroupName, retentionInDays }).promise();
    }
}
async function handler(event, context) {
    try {
        console.log(JSON.stringify(event));
        // The target log group
        const logGroupName = event.ResourceProperties.LogGroupName;
        // The region of the target log group
        const logGroupRegion = event.ResourceProperties.LogGroupRegion;
        // Parse to AWS SDK retry options
        const retryOptions = parseRetryOptions(event.ResourceProperties.SdkRetry);
        if (event.RequestType === 'Create' || event.RequestType === 'Update') {
            // Act on the target log group
            await createLogGroupSafe(logGroupName, logGroupRegion, retryOptions);
            await setRetentionPolicy(logGroupName, logGroupRegion, retryOptions, parseInt(event.ResourceProperties.RetentionInDays, 10));
            if (event.RequestType === 'Create') {
                // Set a retention policy of 1 day on the logs of this function. The log
                // group for this function should already exist at this stage because we
                // already logged the event but due to the async nature of Lambda logging
                // there could be a race condition. So we also try to create the log group
                // of this function first. If multiple LogRetention constructs are present
                // in the stack, they will try to act on this function's log group at the
                // same time. This can sometime result in an OperationAbortedException. To
                // avoid this and because this operation is not critical we catch all errors.
                try {
                    const region = process.env.AWS_REGION;
                    await createLogGroupSafe(`/aws/lambda/${context.functionName}`, region, retryOptions);
                    await setRetentionPolicy(`/aws/lambda/${context.functionName}`, region, retryOptions, 1);
                }
                catch (e) {
                    console.log(e);
                }
            }
        }
        await respond('SUCCESS', 'OK', logGroupName);
    }
    catch (e) {
        console.log(e);
        await respond('FAILED', e.message, event.ResourceProperties.LogGroupName);
    }
    function respond(responseStatus, reason, physicalResourceId) {
        const responseBody = JSON.stringify({
            Status: responseStatus,
            Reason: reason,
            PhysicalResourceId: physicalResourceId,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: {
                // Add log group name as part of the response so that it's available via Fn::GetAtt
                LogGroupName: event.ResourceProperties.LogGroupName,
            },
        });
        console.log('Responding', responseBody);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const parsedUrl = require('url').parse(event.ResponseURL);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'PUT',
            headers: { 'content-type': '', 'content-length': responseBody.length },
        };
        return new Promise((resolve, reject) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const request = require('https').request(requestOptions, resolve);
                request.on('error', reject);
                request.write(responseBody);
                request.end();
            }
            catch (e) {
                reject(e);
            }
        });
    }
    function parseRetryOptions(rawOptions) {
        const retryOptions = {};
        if (rawOptions) {
            if (rawOptions.maxRetries) {
                retryOptions.maxRetries = parseInt(rawOptions.maxRetries, 10);
            }
            if (rawOptions.base) {
                retryOptions.retryOptions = {
                    base: parseInt(rawOptions.base, 10),
                };
            }
        }
        return retryOptions;
    }
}
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsK0JBQStCOzs7QUFFL0IsNkRBQTZEO0FBQzdELCtCQUErQjtBQVMvQjs7Ozs7O0dBTUc7QUFDSCxLQUFLLFVBQVUsa0JBQWtCLENBQUMsWUFBb0IsRUFBRSxNQUFlLEVBQUUsT0FBeUI7SUFDaEcsSUFBSSxFQUFFLDhCQUE4QjtRQUNsQyxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDaEcsTUFBTSxjQUFjLENBQUMsY0FBYyxDQUFDLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUNqRTtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGdDQUFnQyxFQUFFO1lBQy9DLE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7S0FDRjtBQUNILENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsS0FBSyxVQUFVLGtCQUFrQixDQUFDLFlBQW9CLEVBQUUsTUFBZSxFQUFFLE9BQXlCLEVBQUUsZUFBd0I7SUFDMUgsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsR0FBRyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ2hHLElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDcEIsTUFBTSxjQUFjLENBQUMscUJBQXFCLENBQUMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3hFO1NBQU07UUFDTCxNQUFNLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3RGO0FB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QztBQWhHRCwwQkFnR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCB0eXBlIHsgUmV0cnlEZWxheU9wdGlvbnMgfSBmcm9tICdhd3Mtc2RrL2xpYi9jb25maWctYmFzZSc7XG5cbmludGVyZmFjZSBTZGtSZXRyeU9wdGlvbnMge1xuICBtYXhSZXRyaWVzPzogbnVtYmVyO1xuICByZXRyeU9wdGlvbnM/OiBSZXRyeURlbGF5T3B0aW9ucztcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbG9nIGdyb3VwIGFuZCBkb2Vzbid0IHRocm93IGlmIGl0IGV4aXN0cy5cbiAqXG4gKiBAcGFyYW0gbG9nR3JvdXBOYW1lIHRoZSBuYW1lIG9mIHRoZSBsb2cgZ3JvdXAgdG8gY3JlYXRlLlxuICogQHBhcmFtIHJlZ2lvbiB0byBjcmVhdGUgdGhlIGxvZyBncm91cCBpblxuICogQHBhcmFtIG9wdGlvbnMgQ2xvdWRXYXRjaCBBUEkgU0RLIG9wdGlvbnMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUxvZ0dyb3VwU2FmZShsb2dHcm91cE5hbWU6IHN0cmluZywgcmVnaW9uPzogc3RyaW5nLCBvcHRpb25zPzogU2RrUmV0cnlPcHRpb25zKSB7XG4gIHRyeSB7IC8vIFRyeSB0byBjcmVhdGUgdGhlIGxvZyBncm91cFxuICAgIGNvbnN0IGNsb3Vkd2F0Y2hsb2dzID0gbmV3IEFXUy5DbG91ZFdhdGNoTG9ncyh7IGFwaVZlcnNpb246ICcyMDE0LTAzLTI4JywgcmVnaW9uLCAuLi5vcHRpb25zIH0pO1xuICAgIGF3YWl0IGNsb3Vkd2F0Y2hsb2dzLmNyZWF0ZUxvZ0dyb3VwKHsgbG9nR3JvdXBOYW1lIH0pLnByb21pc2UoKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChlLmNvZGUgIT09ICdSZXNvdXJjZUFscmVhZHlFeGlzdHNFeGNlcHRpb24nKSB7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFB1dHMgb3IgZGVsZXRlcyBhIHJldGVudGlvbiBwb2xpY3kgb24gYSBsb2cgZ3JvdXAuXG4gKlxuICogQHBhcmFtIGxvZ0dyb3VwTmFtZSB0aGUgbmFtZSBvZiB0aGUgbG9nIGdyb3VwIHRvIGNyZWF0ZVxuICogQHBhcmFtIHJlZ2lvbiB0aGUgcmVnaW9uIG9mIHRoZSBsb2cgZ3JvdXBcbiAqIEBwYXJhbSBvcHRpb25zIENsb3VkV2F0Y2ggQVBJIFNESyBvcHRpb25zLlxuICogQHBhcmFtIHJldGVudGlvbkluRGF5cyB0aGUgbnVtYmVyIG9mIGRheXMgdG8gcmV0YWluIHRoZSBsb2cgZXZlbnRzIGluIHRoZSBzcGVjaWZpZWQgbG9nIGdyb3VwLlxuICovXG5hc3luYyBmdW5jdGlvbiBzZXRSZXRlbnRpb25Qb2xpY3kobG9nR3JvdXBOYW1lOiBzdHJpbmcsIHJlZ2lvbj86IHN0cmluZywgb3B0aW9ucz86IFNka1JldHJ5T3B0aW9ucywgcmV0ZW50aW9uSW5EYXlzPzogbnVtYmVyKSB7XG4gIGNvbnN0IGNsb3Vkd2F0Y2hsb2dzID0gbmV3IEFXUy5DbG91ZFdhdGNoTG9ncyh7IGFwaVZlcnNpb246ICcyMDE0LTAzLTI4JywgcmVnaW9uLCAuLi5vcHRpb25zIH0pO1xuICBpZiAoIXJldGVudGlvbkluRGF5cykge1xuICAgIGF3YWl0IGNsb3Vkd2F0Y2hsb2dzLmRlbGV0ZVJldGVudGlvblBvbGljeSh7IGxvZ0dyb3VwTmFtZSB9KS5wcm9taXNlKCk7XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgY2xvdWR3YXRjaGxvZ3MucHV0UmV0ZW50aW9uUG9saWN5KHsgbG9nR3JvdXBOYW1lLCByZXRlbnRpb25JbkRheXMgfSkucHJvbWlzZSgpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50OiBBV1NMYW1iZGEuQ2xvdWRGb3JtYXRpb25DdXN0b21SZXNvdXJjZUV2ZW50LCBjb250ZXh0OiBBV1NMYW1iZGEuQ29udGV4dCkge1xuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XG5cbiAgICAvLyBUaGUgdGFyZ2V0IGxvZyBncm91cFxuICAgIGNvbnN0IGxvZ0dyb3VwTmFtZSA9IGV2ZW50LlJlc291cmNlUHJvcGVydGllcy5Mb2dHcm91cE5hbWU7XG5cbiAgICAvLyBUaGUgcmVnaW9uIG9mIHRoZSB0YXJnZXQgbG9nIGdyb3VwXG4gICAgY29uc3QgbG9nR3JvdXBSZWdpb24gPSBldmVudC5SZXNvdXJjZVByb3BlcnRpZXMuTG9nR3JvdXBSZWdpb247XG5cbiAgICAvLyBQYXJzZSB0byBBV1MgU0RLIHJldHJ5IG9wdGlvbnNcbiAgICBjb25zdCByZXRyeU9wdGlvbnMgPSBwYXJzZVJldHJ5T3B0aW9ucyhldmVudC5SZXNvdXJjZVByb3BlcnRpZXMuU2RrUmV0cnkpO1xuXG4gICAgaWYgKGV2ZW50LlJlcXVlc3RUeXBlID09PSAnQ3JlYXRlJyB8fCBldmVudC5SZXF1ZXN0VHlwZSA9PT0gJ1VwZGF0ZScpIHtcbiAgICAgIC8vIEFjdCBvbiB0aGUgdGFyZ2V0IGxvZyBncm91cFxuICAgICAgYXdhaXQgY3JlYXRlTG9nR3JvdXBTYWZlKGxvZ0dyb3VwTmFtZSwgbG9nR3JvdXBSZWdpb24sIHJldHJ5T3B0aW9ucyk7XG4gICAgICBhd2FpdCBzZXRSZXRlbnRpb25Qb2xpY3kobG9nR3JvdXBOYW1lLCBsb2dHcm91cFJlZ2lvbiwgcmV0cnlPcHRpb25zLCBwYXJzZUludChldmVudC5SZXNvdXJjZVByb3BlcnRpZXMuUmV0ZW50aW9uSW5EYXlzLCAxMCkpO1xuXG4gICAgICBpZiAoZXZlbnQuUmVxdWVzdFR5cGUgPT09ICdDcmVhdGUnKSB7XG4gICAgICAgIC8vIFNldCBhIHJldGVudGlvbiBwb2xpY3kgb2YgMSBkYXkgb24gdGhlIGxvZ3Mgb2YgdGhpcyBmdW5jdGlvbi4gVGhlIGxvZ1xuICAgICAgICAvLyBncm91cCBmb3IgdGhpcyBmdW5jdGlvbiBzaG91bGQgYWxyZWFkeSBleGlzdCBhdCB0aGlzIHN0YWdlIGJlY2F1c2Ugd2VcbiAgICAgICAgLy8gYWxyZWFkeSBsb2dnZWQgdGhlIGV2ZW50IGJ1dCBkdWUgdG8gdGhlIGFzeW5jIG5hdHVyZSBvZiBMYW1iZGEgbG9nZ2luZ1xuICAgICAgICAvLyB0aGVyZSBjb3VsZCBiZSBhIHJhY2UgY29uZGl0aW9uLiBTbyB3ZSBhbHNvIHRyeSB0byBjcmVhdGUgdGhlIGxvZyBncm91cFxuICAgICAgICAvLyBvZiB0aGlzIGZ1bmN0aW9uIGZpcnN0LiBJZiBtdWx0aXBsZSBMb2dSZXRlbnRpb24gY29uc3RydWN0cyBhcmUgcHJlc2VudFxuICAgICAgICAvLyBpbiB0aGUgc3RhY2ssIHRoZXkgd2lsbCB0cnkgdG8gYWN0IG9uIHRoaXMgZnVuY3Rpb24ncyBsb2cgZ3JvdXAgYXQgdGhlXG4gICAgICAgIC8vIHNhbWUgdGltZS4gVGhpcyBjYW4gc29tZXRpbWUgcmVzdWx0IGluIGFuIE9wZXJhdGlvbkFib3J0ZWRFeGNlcHRpb24uIFRvXG4gICAgICAgIC8vIGF2b2lkIHRoaXMgYW5kIGJlY2F1c2UgdGhpcyBvcGVyYXRpb24gaXMgbm90IGNyaXRpY2FsIHdlIGNhdGNoIGFsbCBlcnJvcnMuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVnaW9uID0gcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTjtcbiAgICAgICAgICBhd2FpdCBjcmVhdGVMb2dHcm91cFNhZmUoYC9hd3MvbGFtYmRhLyR7Y29udGV4dC5mdW5jdGlvbk5hbWV9YCwgcmVnaW9uLCByZXRyeU9wdGlvbnMpO1xuICAgICAgICAgIGF3YWl0IHNldFJldGVudGlvblBvbGljeShgL2F3cy9sYW1iZGEvJHtjb250ZXh0LmZ1bmN0aW9uTmFtZX1gLCByZWdpb24sIHJldHJ5T3B0aW9ucywgMSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHJlc3BvbmQoJ1NVQ0NFU1MnLCAnT0snLCBsb2dHcm91cE5hbWUpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5sb2coZSk7XG5cbiAgICBhd2FpdCByZXNwb25kKCdGQUlMRUQnLCBlLm1lc3NhZ2UsIGV2ZW50LlJlc291cmNlUHJvcGVydGllcy5Mb2dHcm91cE5hbWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVzcG9uZChyZXNwb25zZVN0YXR1czogc3RyaW5nLCByZWFzb246IHN0cmluZywgcGh5c2ljYWxSZXNvdXJjZUlkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXNwb25zZUJvZHkgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBTdGF0dXM6IHJlc3BvbnNlU3RhdHVzLFxuICAgICAgUmVhc29uOiByZWFzb24sXG4gICAgICBQaHlzaWNhbFJlc291cmNlSWQ6IHBoeXNpY2FsUmVzb3VyY2VJZCxcbiAgICAgIFN0YWNrSWQ6IGV2ZW50LlN0YWNrSWQsXG4gICAgICBSZXF1ZXN0SWQ6IGV2ZW50LlJlcXVlc3RJZCxcbiAgICAgIExvZ2ljYWxSZXNvdXJjZUlkOiBldmVudC5Mb2dpY2FsUmVzb3VyY2VJZCxcbiAgICAgIERhdGE6IHtcbiAgICAgICAgLy8gQWRkIGxvZyBncm91cCBuYW1lIGFzIHBhcnQgb2YgdGhlIHJlc3BvbnNlIHNvIHRoYXQgaXQncyBhdmFpbGFibGUgdmlhIEZuOjpHZXRBdHRcbiAgICAgICAgTG9nR3JvdXBOYW1lOiBldmVudC5SZXNvdXJjZVByb3BlcnRpZXMuTG9nR3JvdXBOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKCdSZXNwb25kaW5nJywgcmVzcG9uc2VCb2R5KTtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzXG4gICAgY29uc3QgcGFyc2VkVXJsID0gcmVxdWlyZSgndXJsJykucGFyc2UoZXZlbnQuUmVzcG9uc2VVUkwpO1xuICAgIGNvbnN0IHJlcXVlc3RPcHRpb25zID0ge1xuICAgICAgaG9zdG5hbWU6IHBhcnNlZFVybC5ob3N0bmFtZSxcbiAgICAgIHBhdGg6IHBhcnNlZFVybC5wYXRoLFxuICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgIGhlYWRlcnM6IHsgJ2NvbnRlbnQtdHlwZSc6ICcnLCAnY29udGVudC1sZW5ndGgnOiByZXNwb25zZUJvZHkubGVuZ3RoIH0sXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gcmVxdWlyZSgnaHR0cHMnKS5yZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCByZXNvbHZlKTtcbiAgICAgICAgcmVxdWVzdC5vbignZXJyb3InLCByZWplY3QpO1xuICAgICAgICByZXF1ZXN0LndyaXRlKHJlc3BvbnNlQm9keSk7XG4gICAgICAgIHJlcXVlc3QuZW5kKCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlUmV0cnlPcHRpb25zKHJhd09wdGlvbnM6IGFueSk6IFNka1JldHJ5T3B0aW9ucyB7XG4gICAgY29uc3QgcmV0cnlPcHRpb25zOiBTZGtSZXRyeU9wdGlvbnMgPSB7fTtcbiAgICBpZiAocmF3T3B0aW9ucykge1xuICAgICAgaWYgKHJhd09wdGlvbnMubWF4UmV0cmllcykge1xuICAgICAgICByZXRyeU9wdGlvbnMubWF4UmV0cmllcyA9IHBhcnNlSW50KHJhd09wdGlvbnMubWF4UmV0cmllcywgMTApO1xuICAgICAgfVxuICAgICAgaWYgKHJhd09wdGlvbnMuYmFzZSkge1xuICAgICAgICByZXRyeU9wdGlvbnMucmV0cnlPcHRpb25zID0ge1xuICAgICAgICAgIGJhc2U6IHBhcnNlSW50KHJhd09wdGlvbnMuYmFzZSwgMTApLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmV0cnlPcHRpb25zO1xuICB9XG59XG4iXX0=