"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.external = void 0;
const https = require("https");
const url = require("url");
// for unit tests
exports.external = {
    sendHttpRequest: defaultSendHttpRequest,
    log: defaultLog,
    includeStackTraces: true,
    userHandlerIndex: './index',
};
const CREATE_FAILED_PHYSICAL_ID_MARKER = 'AWSCDK::CustomResourceProviderFramework::CREATE_FAILED';
const MISSING_PHYSICAL_ID_MARKER = 'AWSCDK::CustomResourceProviderFramework::MISSING_PHYSICAL_ID';
async function handler(event) {
    exports.external.log(JSON.stringify(event, undefined, 2));
    // ignore DELETE event when the physical resource ID is the marker that
    // indicates that this DELETE is a subsequent DELETE to a failed CREATE
    // operation.
    if (event.RequestType === 'Delete' && event.PhysicalResourceId === CREATE_FAILED_PHYSICAL_ID_MARKER) {
        exports.external.log('ignoring DELETE event caused by a failed CREATE event');
        await submitResponse('SUCCESS', event);
        return;
    }
    try {
        // invoke the user handler. this is intentionally inside the try-catch to
        // ensure that if there is an error it's reported as a failure to
        // cloudformation (otherwise cfn waits).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const userHandler = require(exports.external.userHandlerIndex).handler;
        const result = await userHandler(event);
        // validate user response and create the combined event
        const responseEvent = renderResponse(event, result);
        // submit to cfn as success
        await submitResponse('SUCCESS', responseEvent);
    }
    catch (e) {
        const resp = {
            ...event,
            Reason: exports.external.includeStackTraces ? e.stack : e.message,
        };
        if (!resp.PhysicalResourceId) {
            // special case: if CREATE fails, which usually implies, we usually don't
            // have a physical resource id. in this case, the subsequent DELETE
            // operation does not have any meaning, and will likely fail as well. to
            // address this, we use a marker so the provider framework can simply
            // ignore the subsequent DELETE.
            if (event.RequestType === 'Create') {
                exports.external.log('CREATE failed, responding with a marker physical resource id so that the subsequent DELETE will be ignored');
                resp.PhysicalResourceId = CREATE_FAILED_PHYSICAL_ID_MARKER;
            }
            else {
                // otherwise, if PhysicalResourceId is not specified, something is
                // terribly wrong because all other events should have an ID.
                exports.external.log(`ERROR: Malformed event. "PhysicalResourceId" is required: ${JSON.stringify(event)}`);
            }
        }
        // this is an actual error, fail the activity altogether and exist.
        await submitResponse('FAILED', resp);
    }
}
exports.handler = handler;
function renderResponse(cfnRequest, handlerResponse = {}) {
    var _a, _b;
    // if physical ID is not returned, we have some defaults for you based
    // on the request type.
    const physicalResourceId = (_b = (_a = handlerResponse.PhysicalResourceId) !== null && _a !== void 0 ? _a : cfnRequest.PhysicalResourceId) !== null && _b !== void 0 ? _b : cfnRequest.RequestId;
    // if we are in DELETE and physical ID was changed, it's an error.
    if (cfnRequest.RequestType === 'Delete' && physicalResourceId !== cfnRequest.PhysicalResourceId) {
        throw new Error(`DELETE: cannot change the physical resource ID from "${cfnRequest.PhysicalResourceId}" to "${handlerResponse.PhysicalResourceId}" during deletion`);
    }
    // merge request event and result event (result prevails).
    return {
        ...cfnRequest,
        ...handlerResponse,
        PhysicalResourceId: physicalResourceId,
    };
}
async function submitResponse(status, event) {
    var _a;
    const json = {
        Status: status,
        Reason: (_a = event.Reason) !== null && _a !== void 0 ? _a : status,
        StackId: event.StackId,
        RequestId: event.RequestId,
        PhysicalResourceId: event.PhysicalResourceId || MISSING_PHYSICAL_ID_MARKER,
        LogicalResourceId: event.LogicalResourceId,
        NoEcho: event.NoEcho,
        Data: event.Data,
    };
    exports.external.log('submit response to cloudformation', json);
    const responseBody = JSON.stringify(json);
    const parsedUrl = url.parse(event.ResponseURL);
    const req = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'PUT',
        headers: { 'content-type': '', 'content-length': responseBody.length },
    };
    await exports.external.sendHttpRequest(req, responseBody);
}
async function defaultSendHttpRequest(options, responseBody) {
    return new Promise((resolve, reject) => {
        try {
            const request = https.request(options, _ => resolve());
            request.on('error', reject);
            request.write(responseBody);
            request.end();
        }
        catch (e) {
            reject(e);
        }
    });
}
function defaultLog(fmt, ...params) {
    // eslint-disable-next-line no-console
    console.log(fmt, ...params);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzLWVudHJ5cG9pbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJub2RlanMtZW50cnlwb2ludC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBK0I7QUFDL0IsMkJBQTJCO0FBRTNCLGlCQUFpQjtBQUNKLFFBQUEsUUFBUSxHQUFHO0lBQ3RCLGVBQWUsRUFBRSxzQkFBc0I7SUFDdkMsR0FBRyxFQUFFLFVBQVU7SUFDZixrQkFBa0IsRUFBRSxJQUFJO0lBQ3hCLGdCQUFnQixFQUFFLFNBQVM7Q0FDNUIsQ0FBQztBQUVGLE1BQU0sZ0NBQWdDLEdBQUcsd0RBQXdELENBQUM7QUFDbEcsTUFBTSwwQkFBMEIsR0FBRyw4REFBOEQsQ0FBQztBQVczRixLQUFLLFVBQVUsT0FBTyxDQUFDLEtBQWtEO0lBQzlFLGdCQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRWxELHVFQUF1RTtJQUN2RSx1RUFBdUU7SUFDdkUsYUFBYTtJQUNiLElBQUksS0FBSyxDQUFDLFdBQVcsS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLGtCQUFrQixLQUFLLGdDQUFnQyxFQUFFO1FBQ25HLGdCQUFRLENBQUMsR0FBRyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDdEUsTUFBTSxjQUFjLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLE9BQU87S0FDUjtJQUVELElBQUk7UUFDRix5RUFBeUU7UUFDekUsaUVBQWlFO1FBQ2pFLHdDQUF3QztRQUN4QyxpRUFBaUU7UUFDakUsTUFBTSxXQUFXLEdBQVksT0FBTyxDQUFDLGdCQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUM7UUFDeEUsTUFBTSxNQUFNLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFeEMsdURBQXVEO1FBQ3ZELE1BQU0sYUFBYSxHQUFHLGNB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QUUsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFFO0tBQ3ZFLENBQUM7SUFFRixNQUFNLGdCQUFRLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsQ0FBQztBQUNwRCxDQUFDO0FBRUQsS0FBSyxVQUFVLHNCQUFzQixDQUFDLE9BQTZCLEVBQUUsWUFBb0I7SUFDdkYsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNyQyxJQUFJO1lBQ0YsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzVCLE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDNUIsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ2Y7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNWLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNYO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsR0FBVyxFQUFFLEdBQUcsTUFBYTtJQUMvQyxzQ0FBc0M7SUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5cbi8vIGZvciB1bml0IHRlc3RzXG5leHBvcnQgY29uc3QgZXh0ZXJuYWwgPSB7XG4gIHNlbmRIdHRwUmVxdWVzdDogZGVmYXVsdFNlbmRIdHRwUmVxdWVzdCxcbiAgbG9nOiBkZWZhdWx0TG9nLFxuICBpbmNsdWRlU3RhY2tUcmFjZXM6IHRydWUsXG4gIHVzZXJIYW5kbGVySW5kZXg6ICcuL2luZGV4Jyxcbn07XG5cbmNvbnN0IENSRUFURV9GQUlMRURfUEhZU0lDQUxfSURfTUFSS0VSID0gJ0FXU0NESzo6Q3VzdG9tUmVzb3VyY2VQcm92aWRlckZyYW1ld29yazo6Q1JFQVRFX0ZBSUxFRCc7XG5jb25zdCBNSVNTSU5HX1BIWVNJQ0FMX0lEX01BUktFUiA9ICdBV1NDREs6OkN1c3RvbVJlc291cmNlUHJvdmlkZXJGcmFtZXdvcms6Ok1JU1NJTkdfUEhZU0lDQUxfSUQnO1xuXG5leHBvcnQgdHlwZSBSZXNwb25zZSA9IEFXU0xhbWJkYS5DbG91ZEZvcm1hdGlvbkN1c3RvbVJlc291cmNlRXZlbnQgJiBIYW5kbGVyUmVzcG9uc2U7XG5leHBvcnQgdHlwZSBIYW5kbGVyID0gKGV2ZW50OiBBV1NMYW1iZGEuQ2xvdWRGb3JtYXRpb25DdXN0b21SZXNvdXJjZUV2ZW50KSA9PiBQcm9taXNlPEhhbmRsZXJSZXNwb25zZSB8IHZvaWQ+O1xuZXhwb3J0IHR5cGUgSGFuZGxlclJlc3BvbnNlID0gdW5kZWZpbmVkIHwge1xuICBEYXRhPzogYW55O1xuICBQaHlzaWNhbFJlc291cmNlSWQ/OiBzdHJpbmc7XG4gIFJlYXNvbj86IHN0cmluZztcbiAgTm9FY2hvPzogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50OiBBV1NMYW1iZGEuQ2xvdWRGb3JtYXRpb25DdXN0b21SZXNvdXJjZUV2ZW50KSB7XG4gIGV4dGVybmFsLmxvZyhKU09OLnN0cmluZ2lmeShldmVudCwgdW5kZWZpbmVkLCAyKSk7XG5cbiAgLy8gaWdub3JlIERFTEVURSBldmVudCB3aGVuIHRoZSBwaHlzaWNhbCByZXNvdXJjZSBJRCBpcyB0aGUgbWFya2VyIHRoYXRcbiAgLy8gaW5kaWNhdGVzIHRoYXQgdGhpcyBERUxFVEUgaXMgYSBzdWJzZXF1ZW50IERFTEVURSB0byBhIGZhaWxlZCBDUkVBVEVcbiAgLy8gb3BlcmF0aW9uLlxuICBpZiAoZXZlbnQuUmVxdWVzdFR5cGUgPT09ICdEZWxldGUnICYmIGV2ZW50LlBoeXNpY2FsUmVzb3VyY2VJZCA9PT0gQ1JFQVRFX0ZBSUxFRF9QSFlTSUNBTF9JRF9NQVJLRVIpIHtcbiAgICBleHRlcm5hbC5sb2coJ2lnbm9yaW5nIERFTEVURSBldmVudCBjYXVzZWQgYnkgYSBmYWlsZWQgQ1JFQVRFIGV2ZW50Jyk7XG4gICAgYXdhaXQgc3VibWl0UmVzcG9uc2UoJ1NVQ0NFU1MnLCBldmVudCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICAvLyBpbnZva2UgdGhlIHVzZXIgaGFuZGxlci4gdGhpcyBpcyBpbnRlbnRpb25hbGx5IGluc2lkZSB0aGUgdHJ5LWNhdGNoIHRvXG4gICAgLy8gZW5zdXJlIHRoYXQgaWYgdGhlcmUgaXMgYW4gZXJyb3IgaXQncyByZXBvcnRlZCBhcyBhIGZhaWx1cmUgdG9cbiAgICAvLyBjbG91ZGZvcm1hdGlvbiAob3RoZXJ3aXNlIGNmbiB3YWl0cykuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHNcbiAgICBjb25zdCB1c2VySGFuZGxlcjogSGFuZGxlciA9IHJlcXVpcmUoZXh0ZXJuYWwudXNlckhhbmRsZXJJbmRleCkuaGFuZGxlcjtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VySGFuZGxlcihldmVudCk7XG5cbiAgICAvLyB2YWxpZGF0ZSB1c2VyIHJlc3BvbnNlIGFuZCBjcmVhdGUgdGhlIGNvbWJpbmVkIGV2ZW50XG4gICAgY29uc3QgcmVzcG9uc2VFdmVudCA9IHJlbmRlclJlc3BvbnNlKGV2ZW50LCByZXN1bHQpO1xuXG4gICAgLy8gc3VibWl0IHRvIGNmbiBhcyBzdWNjZXNzXG4gICAgYXdhaXQgc3VibWl0UmVzcG9uc2UoJ1NVQ0NFU1MnLCByZXNwb25zZUV2ZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnN0IHJlc3A6IFJlc3BvbnNlID0ge1xuICAgICAgLi4uZXZlbnQsXG4gICAgICBSZWFzb246IGV4dGVybmFsLmluY2x1ZGVTdGFja1RyYWNlcyA/IGUuc3RhY2sgOiBlLm1lc3NhZ2UsXG4gICAgfTtcblxuICAgIGlmICghcmVzcC5QaHlzaWNhbFJlc291cmNlSWQpIHtcbiAgICAgIC8vIHNwZWNpYWwgY2FzZTogaWYgQ1JFQVRFIGZhaWxzLCB3aGljaCB1c3VhbGx5IGltcGxpZXMsIHdlIHVzdWFsbHkgZG9uJ3RcbiAgICAgIC8vIGhhdmUgYSBwaHlzaWNhbCByZXNvdXJjZSBpZC4gaW4gdGhpcyBjYXNlLCB0aGUgc3Vic2VxdWVudCBERUxFVEVcbiAgICAgIC8vIG9wZXJhdGlvbiBkb2VzIG5vdCBoYXZlIGFueSBtZWFuaW5nLCBhbmQgd2lsbCBsaWtlbHkgZmFpbCBhcyB3ZWxsLiB0b1xuICAgICAgLy8gYWRkcmVzcyB0aGlzLCB3ZSB1c2UgYSBtYXJrZXIgc28gdGhlIHByb3ZpZGVyIGZyYW1ld29yayBjYW4gc2ltcGx5XG4gICAgICAvLyBpZ25vcmUgdGhlIHN1YnNlcXVlbnQgREVMRVRFLlxuICAgICAgaWYgKGV2ZW50LlJlcXVlc3RUeXBlID09PSAnQ3JlYXRlJykge1xuICAgICAgICBleHRlcm5hbC5sb2coJ0NSRUFURSBmYWlsZWQsIHJlc3BvbmRpbmcgd2l0aCBhIG1hcmtlciBwaHlzaWNhbCByZXNvdXJjZSBpZCBzbyB0aGF0IHRoZSBzdWJzZXF1ZW50IERFTEVURSB3aWxsIGJlIGlnbm9yZWQnKTtcbiAgICAgICAgcmVzcC5QaHlzaWNhbFJlc291cmNlSWQgPSBDUkVBVEVfRkFJTEVEX1BIWVNJQ0FMX0lEX01BUktFUjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG90aGVyd2lzZSwgaWYgUGh5c2ljYWxSZXNvdXJjZUlkIGlzIG5vdCBzcGVjaWZpZWQsIHNvbWV0aGluZyBpc1xuICAgICAgICAvLyB0ZXJyaWJseSB3cm9uZyBiZWNhdXNlIGFsbCBvdGhlciBldmVudHMgc2hvdWxkIGhhdmUgYW4gSUQuXG4gICAgICAgIGV4dGVybmFsLmxvZyhgRVJST1I6IE1hbGZvcm1lZCBldmVudC4gXCJQaHlzaWNhbFJlc291cmNlSWRcIiBpcyByZXF1aXJlZDogJHtKU09OLnN0cmluZ2lmeShldmVudCl9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGhpcyBpcyBhbiBhY3R1YWwgZXJyb3IsIGZhaWwgdGhlIGFjdGl2aXR5IGFsdG9nZXRoZXIgYW5kIGV4aXN0LlxuICAgIGF3YWl0IHN1Ym1pdFJlc3BvbnNlKCdGQUlMRUQnLCByZXNwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXJSZXNwb25zZShcbiAgY2ZuUmVxdWVzdDogQVdTTGFtYmRhLkNsb3VkRm9ybWF0aW9uQ3VzdG9tUmVzb3VyY2VFdmVudCAmIHsgUGh5c2ljYWxSZXNvdXJjZUlkPzogc3RyaW5nIH0sXG4gIGhhbmRsZXJSZXNwb25zZTogdm9pZCB8IEhhbmRsZXJSZXNwb25zZSA9IHsgfSk6IFJlc3BvbnNlIHtcblxuICAvLyBpZiBwaHlzaWNhbCBJRCBpcyBub3QgcmV0dXJuZWQsIHdlIGhhdmUgc29tZSBkZWZhdWx0cyBmb3IgeW91IGJhc2VkXG4gIC8vIG9uIHRoZSByZXF1ZXN0IHR5cGUuXG4gIGNvbnN0IHBoeXNpY2FsUmVzb3VyY2VJZCA9IGhhbmRsZXJSZXNwb25zZS5QaHlzaWNhbFJlc291cmNlSWQgPz8gY2ZuUmVxdWVzdC5QaHlzaWNhbFJlc291cmNlSWQgPz8gY2ZuUmVxdWVzdC5SZXF1ZXN0SWQ7XG5cbiAgLy8gaWYgd2UgYXJlIGluIERFTEVURSBhbmQgcGh5c2ljYWwgSUQgd2FzIGNoYW5nZWQsIGl0J3MgYW4gZXJyb3IuXG4gIGlmIChjZm5SZXF1ZXN0LlJlcXVlc3RUeXBlID09PSAnRGVsZXRlJyAmJiBwaHlzaWNhbFJlc291cmNlSWQgIT09IGNmblJlcXVlc3QuUGh5c2ljYWxSZXNvdXJjZUlkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBERUxFVEU6IGNhbm5vdCBjaGFuZ2UgdGhlIHBoeXNpY2FsIHJlc291cmNlIElEIGZyb20gXCIke2NmblJlcXVlc3QuUGh5c2ljYWxSZXNvdXJjZUlkfVwiIHRvIFwiJHtoYW5kbGVyUmVzcG9uc2UuUGh5c2ljYWxSZXNvdXJjZUlkfVwiIGR1cmluZyBkZWxldGlvbmApO1xuICB9XG5cbiAgLy8gbWVyZ2UgcmVxdWVzdCBldmVudCBhbmQgcmVzdWx0IGV2ZW50IChyZXN1bHQgcHJldmFpbHMpLlxuICByZXR1cm4ge1xuICAgIC4uLmNmblJlcXVlc3QsXG4gICAgLi4uaGFuZGxlclJlc3BvbnNlLFxuICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogcGh5c2ljYWxSZXNvdXJjZUlkLFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBzdWJtaXRSZXNwb25zZShzdGF0dXM6ICdTVUNDRVNTJyB8ICdGQUlMRUQnLCBldmVudDogUmVzcG9uc2UpIHtcbiAgY29uc3QganNvbjogQVdTTGFtYmRhLkNsb3VkRm9ybWF0aW9uQ3VzdG9tUmVzb3VyY2VSZXNwb25zZSA9IHtcbiAgICBTdGF0dXM6IHN0YXR1cyxcbiAgICBSZWFzb246IGV2ZW50LlJlYXNvbiA/PyBzdGF0dXMsXG4gICAgU3RhY2tJZDogZXZlbnQuU3RhY2tJZCxcbiAgICBSZXF1ZXN0SWQ6IGV2ZW50LlJlcXVlc3RJZCxcbiAgICBQaHlzaWNhbFJlc291cmNlSWQ6IGV2ZW50LlBoeXNpY2FsUmVzb3VyY2VJZCB8fCBNSVNTSU5HX1BIWVNJQ0FMX0lEX01BUktFUixcbiAgICBMb2dpY2FsUmVzb3VyY2VJZDogZXZlbnQuTG9naWNhbFJlc291cmNlSWQsXG4gICAgTm9FY2hvOiBldmVudC5Ob0VjaG8sXG4gICAgRGF0YTogZXZlbnQuRGF0YSxcbiAgfTtcblxuICBleHRlcm5hbC5sb2coJ3N1Ym1pdCByZXNwb25zZSB0byBjbG91ZGZvcm1hdGlvbicsIGpzb24pO1xuXG4gIGNvbnN0IHJlc3BvbnNlQm9keSA9IEpTT04uc3RyaW5naWZ5KGpzb24pO1xuICBjb25zdCBwYXJzZWRVcmwgPSB1cmwucGFyc2UoZXZlbnQuUmVzcG9uc2VVUkwpO1xuICBjb25zdCByZXEgPSB7XG4gICAgaG9zdG5hbWU6IHBhcnNlZFVybC5ob3N0bmFtZSxcbiAgICBwYXRoOiBwYXJzZWRVcmwucGF0aCxcbiAgICBtZXRob2Q6ICdQVVQnLFxuICAgIGhlYWRlcnM6IHsgJ2NvbnRlbnQtdHlwZSc6ICcnLCAnY29udGVudC1sZW5ndGgnOiByZXNwb25zZUJvZHkubGVuZ3RoIH0sXG4gIH07XG5cbiAgYXdhaXQgZXh0ZXJuYWwuc2VuZEh0dHBSZXF1ZXN0KHJlcSwgcmVzcG9uc2VCb2R5KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVmYXVsdFNlbmRIdHRwUmVxdWVzdChvcHRpb25zOiBodHRwcy5SZXF1ZXN0T3B0aW9ucywgcmVzcG9uc2VCb2R5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVxdWVzdCA9IGh0dHBzLnJlcXVlc3Qob3B0aW9ucywgXyA9PiByZXNvbHZlKCkpO1xuICAgICAgcmVxdWVzdC5vbignZXJyb3InLCByZWplY3QpO1xuICAgICAgcmVxdWVzdC53cml0ZShyZXNwb25zZUJvZHkpO1xuICAgICAgcmVxdWVzdC5lbmQoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZWplY3QoZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gZGVmYXVsdExvZyhmbXQ6IHN0cmluZywgLi4ucGFyYW1zOiBhbnlbXSkge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICBjb25zb2xlLmxvZyhmbXQsIC4uLnBhcmFtcyk7XG59XG4iXX0=