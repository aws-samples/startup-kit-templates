"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishAssets = void 0;
const cxapi = require("@aws-cdk/cx-api");
const cdk_assets = require("cdk-assets");
const api_1 = require("../api");
const logging_1 = require("../logging");
/**
 * Use cdk-assets to publish all assets in the given manifest.
 */
async function publishAssets(manifest, sdk, targetEnv) {
    // This shouldn't really happen (it's a programming error), but we don't have
    // the types here to guide us. Do an runtime validation to be super super sure.
    if (targetEnv.account === undefined || targetEnv.account === cxapi.UNKNOWN_ACCOUNT
        || targetEnv.region === undefined || targetEnv.account === cxapi.UNKNOWN_REGION) {
        throw new Error(`Asset publishing requires resolved account and region, got ${JSON.stringify(targetEnv)}`);
    }
    const publisher = new cdk_assets.AssetPublishing(manifest, {
        aws: new PublishingAws(sdk, targetEnv),
        progressListener: new PublishingProgressListener(),
        throwOnError: false,
    });
    await publisher.publish();
    if (publisher.hasFailures) {
        throw new Error('Failed to publish one or more assets. See the error messages above for more information.');
    }
}
exports.publishAssets = publishAssets;
class PublishingAws {
    constructor(
    /**
     * The base SDK to work with
     */
    aws, 
    /**
     * Environment where the stack we're deploying is going
     */
    targetEnv) {
        this.aws = aws;
        this.targetEnv = targetEnv;
    }
    async discoverPartition() {
        var _a;
        return (_a = (await this.aws.baseCredentialsPartition(this.targetEnv, api_1.Mode.ForWriting))) !== null && _a !== void 0 ? _a : 'aws';
    }
    async discoverDefaultRegion() {
        return this.targetEnv.region;
    }
    async discoverCurrentAccount() {
        return (await this.sdk({})).currentAccount();
    }
    async s3Client(options) {
        return (await this.sdk(options)).s3();
    }
    async ecrClient(options) {
        return (await this.sdk(options)).ecr();
    }
    /**
     * Get an SDK appropriate for the given client options
     */
    sdk(options) {
        var _a;
        const env = {
            ...this.targetEnv,
            region: (_a = options.region) !== null && _a !== void 0 ? _a : this.targetEnv.region,
        };
        return this.aws.forEnvironment(env, api_1.Mode.ForWriting, {
            assumeRoleArn: options.assumeRoleArn,
            assumeRoleExternalId: options.assumeRoleExternalId,
        });
    }
}
const EVENT_TO_LOGGER = {
    build: logging_1.debug,
    cached: logging_1.debug,
    check: logging_1.debug,
    debug: logging_1.debug,
    fail: logging_1.error,
    found: logging_1.debug,
    start: logging_1.print,
    success: logging_1.print,
    upload: logging_1.debug,
};
class PublishingProgressListener {
    onPublishEvent(type, event) {
        EVENT_TO_LOGGER[type](`[${event.percentComplete}%] ${type}: ${event.message}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcHVibGlzaGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFzc2V0LXB1Ymxpc2hpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUNBQXlDO0FBRXpDLHlDQUF5QztBQUN6QyxnQ0FBaUQ7QUFDakQsd0NBQWlEO0FBRWpEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGFBQWEsQ0FBQyxRQUFrQyxFQUFFLEdBQWdCLEVBQUUsU0FBNEI7SUFDcEgsNkVBQTZFO0lBQzdFLCtFQUErRTtJQUMvRSxJQUFJLFNBQVMsQ0FBQyxPQUFPLEtBQUssU0FBUyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEtBQUssS0FBSyxDQUFDLGVBQWU7V0FDN0UsU0FBUyxDQUFDLE1BQU0sS0FBSyxTQUFTLElBQUksU0FBUyxDQUFDLE9BQU8sS0FBSyxLQUFLLENBQUMsY0FBYyxFQUFFO1FBQ2pGLE1BQU0sSUFBSSxLQUFLLENBQUMsOERBQThELElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQzVHO0lBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRTtRQUN6RCxHQUFHLEVBQUUsSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQztRQUN0QyxnQkFBZ0IsRUFBRSxJQUFJLDBCQUEwQixFQUFFO1FBQ2xELFlBQVksRUFBRSxLQUFLO0tBQ3BCLENBQUMsQ0FBQztJQUNILE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzFCLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRTtRQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLDBGQUEwRixDQUFDLENBQUM7S0FDN0c7QUFDSCxDQUFDO0FBakJELHNDQWlCQztBQUVELE1BQU0sYUFBYTtJQUNqQjtJQUNFOztPQUVHO0lBQ2MsR0FBZ0I7SUFFakM7O09BRUc7SUFDYyxTQUE0QjtRQUw1QixRQUFHLEdBQUgsR0FBRyxDQUFhO1FBS2hCLGNBQVMsR0FBVCxTQUFTLENBQW1CO0lBQy9DLENBQUM7SUFFTSxLQUFLLENBQUMsaUJBQWlCOztRQUM1QixhQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsVUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLG1DQUFJLEtBQUssQ0FBQztJQUM3RixDQUFDO0lBRU0sS0FBSyxDQUFDLHFCQUFxQjtRQUNoQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBQy9CLENBQUM7SUFFTSxLQUFLLENBQUMsc0JBQXNCO1FBQ2pDLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUMvQyxDQUFDO0lBRU0sS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFpQztRQUNyRCxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7SUFDeEMsQ0FBQztJQUVNLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBaUM7UUFDdEQsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNLLEdBQUcsQ0FBQyxPQUFpQzs7UUFDM0MsTUFBTSxHQUFHLEdBQUc7WUFDVixHQUFHLElBQUksQ0FBQyxTQUFTO1lBQ2pCLE1BQU0sUUFBRSxPQUFPLENBQUMsTUFBTSxtQ0FBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU07U0FDaEQsQ0FBQztRQUVGLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLFVBQUksQ0FBQyxVQUFVLEVBQUU7WUFDbkQsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1lBQ3BDLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxvQkFBb0I7U0FDbkQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQsTUFBTSxlQUFlLEdBQXNEO0lBQ3pFLEtBQUssRUFBRSxlQUFLO0lBQ1osTUFBTSxFQUFFLGVBQUs7SUFDYixLQUFLLEVBQUUsZUFBSztJQUNaLEtBQUssRUFBTCxlQUFLO0lBQ0wsSUFBSSxFQUFFLGVBQUs7SUFDWCxLQUFLLEVBQUUsZUFBSztJQUNaLEtBQUssRUFBRSxlQUFLO0lBQ1osT0FBTyxFQUFFLGVBQUs7SUFDZCxNQUFNLEVBQUUsZUFBSztDQUNkLENBQUM7QUFFRixNQUFNLDBCQUEwQjtJQUN2QixjQUFjLENBQUMsSUFBMEIsRUFBRSxLQUFrQztRQUNsRixlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsZUFBZSxNQUFNLElBQUksS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUNqRixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0ICogYXMgQVdTIGZyb20gJ2F3cy1zZGsnO1xuaW1wb3J0ICogYXMgY2RrX2Fzc2V0cyBmcm9tICdjZGstYXNzZXRzJztcbmltcG9ydCB7IElTREssIE1vZGUsIFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7IGRlYnVnLCBlcnJvciwgcHJpbnQgfSBmcm9tICcuLi9sb2dnaW5nJztcblxuLyoqXG4gKiBVc2UgY2RrLWFzc2V0cyB0byBwdWJsaXNoIGFsbCBhc3NldHMgaW4gdGhlIGdpdmVuIG1hbmlmZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHVibGlzaEFzc2V0cyhtYW5pZmVzdDogY2RrX2Fzc2V0cy5Bc3NldE1hbmlmZXN0LCBzZGs6IFNka1Byb3ZpZGVyLCB0YXJnZXRFbnY6IGN4YXBpLkVudmlyb25tZW50KSB7XG4gIC8vIFRoaXMgc2hvdWxkbid0IHJlYWxseSBoYXBwZW4gKGl0J3MgYSBwcm9ncmFtbWluZyBlcnJvciksIGJ1dCB3ZSBkb24ndCBoYXZlXG4gIC8vIHRoZSB0eXBlcyBoZXJlIHRvIGd1aWRlIHVzLiBEbyBhbiBydW50aW1lIHZhbGlkYXRpb24gdG8gYmUgc3VwZXIgc3VwZXIgc3VyZS5cbiAgaWYgKHRhcmdldEVudi5hY2NvdW50ID09PSB1bmRlZmluZWQgfHwgdGFyZ2V0RW52LmFjY291bnQgPT09IGN4YXBpLlVOS05PV05fQUNDT1VOVFxuICAgIHx8IHRhcmdldEVudi5yZWdpb24gPT09IHVuZGVmaW5lZCB8fCB0YXJnZXRFbnYuYWNjb3VudCA9PT0gY3hhcGkuVU5LTk9XTl9SRUdJT04pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2V0IHB1Ymxpc2hpbmcgcmVxdWlyZXMgcmVzb2x2ZWQgYWNjb3VudCBhbmQgcmVnaW9uLCBnb3QgJHtKU09OLnN0cmluZ2lmeSh0YXJnZXRFbnYpfWApO1xuICB9XG5cbiAgY29uc3QgcHVibGlzaGVyID0gbmV3IGNka19hc3NldHMuQXNzZXRQdWJsaXNoaW5nKG1hbmlmZXN0LCB7XG4gICAgYXdzOiBuZXcgUHVibGlzaGluZ0F3cyhzZGssIHRhcmdldEVudiksXG4gICAgcHJvZ3Jlc3NMaXN0ZW5lcjogbmV3IFB1Ymxpc2hpbmdQcm9ncmVzc0xpc3RlbmVyKCksXG4gICAgdGhyb3dPbkVycm9yOiBmYWxzZSxcbiAgfSk7XG4gIGF3YWl0IHB1Ymxpc2hlci5wdWJsaXNoKCk7XG4gIGlmIChwdWJsaXNoZXIuaGFzRmFpbHVyZXMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBwdWJsaXNoIG9uZSBvciBtb3JlIGFzc2V0cy4gU2VlIHRoZSBlcnJvciBtZXNzYWdlcyBhYm92ZSBmb3IgbW9yZSBpbmZvcm1hdGlvbi4nKTtcbiAgfVxufVxuXG5jbGFzcyBQdWJsaXNoaW5nQXdzIGltcGxlbWVudHMgY2RrX2Fzc2V0cy5JQXdzIHtcbiAgY29uc3RydWN0b3IoXG4gICAgLyoqXG4gICAgICogVGhlIGJhc2UgU0RLIHRvIHdvcmsgd2l0aFxuICAgICAqL1xuICAgIHByaXZhdGUgcmVhZG9ubHkgYXdzOiBTZGtQcm92aWRlcixcblxuICAgIC8qKlxuICAgICAqIEVudmlyb25tZW50IHdoZXJlIHRoZSBzdGFjayB3ZSdyZSBkZXBsb3lpbmcgaXMgZ29pbmdcbiAgICAgKi9cbiAgICBwcml2YXRlIHJlYWRvbmx5IHRhcmdldEVudjogY3hhcGkuRW52aXJvbm1lbnQpIHtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkaXNjb3ZlclBhcnRpdGlvbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5hd3MuYmFzZUNyZWRlbnRpYWxzUGFydGl0aW9uKHRoaXMudGFyZ2V0RW52LCBNb2RlLkZvcldyaXRpbmcpKSA/PyAnYXdzJztcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkaXNjb3ZlckRlZmF1bHRSZWdpb24oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gdGhpcy50YXJnZXRFbnYucmVnaW9uO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGRpc2NvdmVyQ3VycmVudEFjY291bnQoKTogUHJvbWlzZTxjZGtfYXNzZXRzLkFjY291bnQ+IHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuc2RrKHt9KSkuY3VycmVudEFjY291bnQoKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBzM0NsaWVudChvcHRpb25zOiBjZGtfYXNzZXRzLkNsaWVudE9wdGlvbnMpOiBQcm9taXNlPEFXUy5TMz4ge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5zZGsob3B0aW9ucykpLnMzKCk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZWNyQ2xpZW50KG9wdGlvbnM6IGNka19hc3NldHMuQ2xpZW50T3B0aW9ucyk6IFByb21pc2U8QVdTLkVDUj4ge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5zZGsob3B0aW9ucykpLmVjcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhbiBTREsgYXBwcm9wcmlhdGUgZm9yIHRoZSBnaXZlbiBjbGllbnQgb3B0aW9uc1xuICAgKi9cbiAgcHJpdmF0ZSBzZGsob3B0aW9uczogY2RrX2Fzc2V0cy5DbGllbnRPcHRpb25zKTogUHJvbWlzZTxJU0RLPiB7XG4gICAgY29uc3QgZW52ID0ge1xuICAgICAgLi4udGhpcy50YXJnZXRFbnYsXG4gICAgICByZWdpb246IG9wdGlvbnMucmVnaW9uID8/IHRoaXMudGFyZ2V0RW52LnJlZ2lvbiwgLy8gRGVmYXVsdDogc2FtZSByZWdpb24gYXMgdGhlIHN0YWNrXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLmF3cy5mb3JFbnZpcm9ubWVudChlbnYsIE1vZGUuRm9yV3JpdGluZywge1xuICAgICAgYXNzdW1lUm9sZUFybjogb3B0aW9ucy5hc3N1bWVSb2xlQXJuLFxuICAgICAgYXNzdW1lUm9sZUV4dGVybmFsSWQ6IG9wdGlvbnMuYXNzdW1lUm9sZUV4dGVybmFsSWQsXG4gICAgfSk7XG4gIH1cbn1cblxuY29uc3QgRVZFTlRfVE9fTE9HR0VSOiBSZWNvcmQ8Y2RrX2Fzc2V0cy5FdmVudFR5cGUsICh4OiBzdHJpbmcpID0+IHZvaWQ+ID0ge1xuICBidWlsZDogZGVidWcsXG4gIGNhY2hlZDogZGVidWcsXG4gIGNoZWNrOiBkZWJ1ZyxcbiAgZGVidWcsXG4gIGZhaWw6IGVycm9yLFxuICBmb3VuZDogZGVidWcsXG4gIHN0YXJ0OiBwcmludCxcbiAgc3VjY2VzczogcHJpbnQsXG4gIHVwbG9hZDogZGVidWcsXG59O1xuXG5jbGFzcyBQdWJsaXNoaW5nUHJvZ3Jlc3NMaXN0ZW5lciBpbXBsZW1lbnRzIGNka19hc3NldHMuSVB1Ymxpc2hQcm9ncmVzc0xpc3RlbmVyIHtcbiAgcHVibGljIG9uUHVibGlzaEV2ZW50KHR5cGU6IGNka19hc3NldHMuRXZlbnRUeXBlLCBldmVudDogY2RrX2Fzc2V0cy5JUHVibGlzaFByb2dyZXNzKTogdm9pZCB7XG4gICAgRVZFTlRfVE9fTE9HR0VSW3R5cGVdKGBbJHtldmVudC5wZXJjZW50Q29tcGxldGV9JV0gJHt0eXBlfTogJHtldmVudC5tZXNzYWdlfWApO1xuICB9XG59XG4iXX0=