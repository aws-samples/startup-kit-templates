"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmiContextProviderPlugin = void 0;
const cxapi = require("@aws-cdk/cx-api");
const api_1 = require("../api");
const logging_1 = require("../logging");
/**
 * Plugin to search AMIs for the current account
 */
class AmiContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(args) {
        const region = args.region;
        const account = args.account;
        // Normally we'd do this only as 'debug', but searching AMIs typically takes dozens
        // of seconds, so be little more verbose about it so users know what is going on.
        logging_1.print(`Searching for AMI in ${account}:${region}`);
        logging_1.debug(`AMI search parameters: ${JSON.stringify(args)}`);
        const ec2 = (await this.aws.forEnvironment(cxapi.EnvironmentUtils.make(account, region), api_1.Mode.ForReading)).ec2();
        const response = await ec2.describeImages({
            Owners: args.owners,
            Filters: Object.entries(args.filters).map(([key, values]) => ({
                Name: key,
                Values: values,
            })),
        }).promise();
        const images = [...response.Images || []].filter(i => i.ImageId !== undefined);
        if (images.length === 0) {
            throw new Error('No AMI found that matched the search criteria');
        }
        // Return the most recent one
        // Note: Date.parse() is not going to respect the timezone of the string,
        // but since we only care about the relative values that is okay.
        images.sort(descending(i => Date.parse(i.CreationDate || '1970')));
        logging_1.debug(`Selected image '${images[0].ImageId}' created at '${images[0].CreationDate}'`);
        return images[0].ImageId;
    }
}
exports.AmiContextProviderPlugin = AmiContextProviderPlugin;
/**
 * Make a comparator that sorts in descending order given a sort key extractor
 */
function descending(valueOf) {
    return (a, b) => {
        return valueOf(b) - valueOf(a);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1pLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYW1pLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHlDQUF5QztBQUN6QyxnQ0FBMkM7QUFDM0Msd0NBQTBDO0FBRzFDOztHQUVHO0FBQ0gsTUFBYSx3QkFBd0I7SUFDbkMsWUFBNkIsR0FBZ0I7UUFBaEIsUUFBRyxHQUFILEdBQUcsQ0FBYTtJQUM3QyxDQUFDO0lBRU0sS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUE4QjtRQUNsRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzNCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFN0IsbUZBQW1GO1FBQ25GLGlGQUFpRjtRQUNqRixlQUFLLENBQUMsd0JBQXdCLE9BQU8sSUFBSSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ25ELGVBQUssQ0FBQywwQkFBMEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFeEQsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxFQUFFLFVBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2pILE1BQU0sUUFBUSxHQUFHLE1BQU0sR0FBRyxDQUFDLGNBQWMsQ0FBQztZQUN4QyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDbkIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM1RCxJQUFJLEVBQUUsR0FBRztnQkFDVCxNQUFNLEVBQUUsTUFBTTthQUNmLENBQUMsQ0FBQztTQUNKLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUViLE1BQU0sTUFBTSxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUM7UUFFL0UsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLCtDQUErQyxDQUFDLENBQUM7U0FDbEU7UUFFRCw2QkFBNkI7UUFDN0IseUVBQXlFO1FBQ3pFLGlFQUFpRTtRQUNqRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFbkUsZUFBSyxDQUFDLG1CQUFtQixNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxpQkFBaUIsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7UUFDdEYsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBUSxDQUFDO0lBQzVCLENBQUM7Q0FDRjtBQXBDRCw0REFvQ0M7QUFFRDs7R0FFRztBQUNILFNBQVMsVUFBVSxDQUFJLE9BQXlCO0lBQzlDLE9BQU8sQ0FBQyxDQUFJLEVBQUUsQ0FBSSxFQUFFLEVBQUU7UUFDcEIsT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeHNjaGVtYSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCB7IE1vZGUsIFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7IGRlYnVnLCBwcmludCB9IGZyb20gJy4uL2xvZ2dpbmcnO1xuaW1wb3J0IHsgQ29udGV4dFByb3ZpZGVyUGx1Z2luIH0gZnJvbSAnLi9wcm92aWRlcic7XG5cbi8qKlxuICogUGx1Z2luIHRvIHNlYXJjaCBBTUlzIGZvciB0aGUgY3VycmVudCBhY2NvdW50XG4gKi9cbmV4cG9ydCBjbGFzcyBBbWlDb250ZXh0UHJvdmlkZXJQbHVnaW4gaW1wbGVtZW50cyBDb250ZXh0UHJvdmlkZXJQbHVnaW4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGF3czogU2RrUHJvdmlkZXIpIHtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRWYWx1ZShhcmdzOiBjeHNjaGVtYS5BbWlDb250ZXh0UXVlcnkpIHtcbiAgICBjb25zdCByZWdpb24gPSBhcmdzLnJlZ2lvbjtcbiAgICBjb25zdCBhY2NvdW50ID0gYXJncy5hY2NvdW50O1xuXG4gICAgLy8gTm9ybWFsbHkgd2UnZCBkbyB0aGlzIG9ubHkgYXMgJ2RlYnVnJywgYnV0IHNlYXJjaGluZyBBTUlzIHR5cGljYWxseSB0YWtlcyBkb3plbnNcbiAgICAvLyBvZiBzZWNvbmRzLCBzbyBiZSBsaXR0bGUgbW9yZSB2ZXJib3NlIGFib3V0IGl0IHNvIHVzZXJzIGtub3cgd2hhdCBpcyBnb2luZyBvbi5cbiAgICBwcmludChgU2VhcmNoaW5nIGZvciBBTUkgaW4gJHthY2NvdW50fToke3JlZ2lvbn1gKTtcbiAgICBkZWJ1ZyhgQU1JIHNlYXJjaCBwYXJhbWV0ZXJzOiAke0pTT04uc3RyaW5naWZ5KGFyZ3MpfWApO1xuXG4gICAgY29uc3QgZWMyID0gKGF3YWl0IHRoaXMuYXdzLmZvckVudmlyb25tZW50KGN4YXBpLkVudmlyb25tZW50VXRpbHMubWFrZShhY2NvdW50LCByZWdpb24pLCBNb2RlLkZvclJlYWRpbmcpKS5lYzIoKTtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGVjMi5kZXNjcmliZUltYWdlcyh7XG4gICAgICBPd25lcnM6IGFyZ3Mub3duZXJzLFxuICAgICAgRmlsdGVyczogT2JqZWN0LmVudHJpZXMoYXJncy5maWx0ZXJzKS5tYXAoKFtrZXksIHZhbHVlc10pID0+ICh7XG4gICAgICAgIE5hbWU6IGtleSxcbiAgICAgICAgVmFsdWVzOiB2YWx1ZXMsXG4gICAgICB9KSksXG4gICAgfSkucHJvbWlzZSgpO1xuXG4gICAgY29uc3QgaW1hZ2VzID0gWy4uLnJlc3BvbnNlLkltYWdlcyB8fCBbXV0uZmlsdGVyKGkgPT4gaS5JbWFnZUlkICE9PSB1bmRlZmluZWQpO1xuXG4gICAgaWYgKGltYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gQU1JIGZvdW5kIHRoYXQgbWF0Y2hlZCB0aGUgc2VhcmNoIGNyaXRlcmlhJyk7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBtb3N0IHJlY2VudCBvbmVcbiAgICAvLyBOb3RlOiBEYXRlLnBhcnNlKCkgaXMgbm90IGdvaW5nIHRvIHJlc3BlY3QgdGhlIHRpbWV6b25lIG9mIHRoZSBzdHJpbmcsXG4gICAgLy8gYnV0IHNpbmNlIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgcmVsYXRpdmUgdmFsdWVzIHRoYXQgaXMgb2theS5cbiAgICBpbWFnZXMuc29ydChkZXNjZW5kaW5nKGkgPT4gRGF0ZS5wYXJzZShpLkNyZWF0aW9uRGF0ZSB8fCAnMTk3MCcpKSk7XG5cbiAgICBkZWJ1ZyhgU2VsZWN0ZWQgaW1hZ2UgJyR7aW1hZ2VzWzBdLkltYWdlSWR9JyBjcmVhdGVkIGF0ICcke2ltYWdlc1swXS5DcmVhdGlvbkRhdGV9J2ApO1xuICAgIHJldHVybiBpbWFnZXNbMF0uSW1hZ2VJZCE7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGEgY29tcGFyYXRvciB0aGF0IHNvcnRzIGluIGRlc2NlbmRpbmcgb3JkZXIgZ2l2ZW4gYSBzb3J0IGtleSBleHRyYWN0b3JcbiAqL1xuZnVuY3Rpb24gZGVzY2VuZGluZzxBPih2YWx1ZU9mOiAoeDogQSkgPT4gbnVtYmVyKSB7XG4gIHJldHVybiAoYTogQSwgYjogQSkgPT4ge1xuICAgIHJldHVybiB2YWx1ZU9mKGIpIC0gdmFsdWVPZihhKTtcbiAgfTtcbn1cbiJdfQ==