"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasAllTrafficEgress = exports.SecurityGroupContextProviderPlugin = void 0;
const cxapi = require("@aws-cdk/cx-api");
const api_1 = require("../api");
class SecurityGroupContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(args) {
        var _a;
        const account = args.account;
        const region = args.region;
        const ec2 = (await this.aws.forEnvironment(cxapi.EnvironmentUtils.make(account, region), api_1.Mode.ForReading)).ec2();
        const response = await ec2.describeSecurityGroups({
            GroupIds: [args.securityGroupId],
        }).promise();
        const securityGroups = (_a = response.SecurityGroups) !== null && _a !== void 0 ? _a : [];
        if (securityGroups.length === 0) {
            throw new Error(`No security groups found matching ${JSON.stringify(args)}`);
        }
        const [securityGroup] = securityGroups;
        return {
            securityGroupId: securityGroup.GroupId,
            allowAllOutbound: hasAllTrafficEgress(securityGroup),
        };
    }
}
exports.SecurityGroupContextProviderPlugin = SecurityGroupContextProviderPlugin;
/**
 * @internal
 */
function hasAllTrafficEgress(securityGroup) {
    var _a, _b, _c;
    let hasAllTrafficCidrV4 = false;
    let hasAllTrafficCidrV6 = false;
    for (const ipPermission of (_a = securityGroup.IpPermissionsEgress) !== null && _a !== void 0 ? _a : []) {
        const isAllProtocols = ipPermission.IpProtocol === '-1';
        if (isAllProtocols && ((_b = ipPermission.IpRanges) === null || _b === void 0 ? void 0 : _b.some(m => m.CidrIp === '0.0.0.0/0'))) {
            hasAllTrafficCidrV4 = true;
        }
        if (isAllProtocols && ((_c = ipPermission.Ipv6Ranges) === null || _c === void 0 ? void 0 : _c.some(m => m.CidrIpv6 === '::/0'))) {
            hasAllTrafficCidrV6 = true;
        }
    }
    return hasAllTrafficCidrV4 && hasAllTrafficCidrV6;
}
exports.hasAllTrafficEgress = hasAllTrafficEgress;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktZ3JvdXBzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VjdXJpdHktZ3JvdXBzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHlDQUF5QztBQUV6QyxnQ0FBMkM7QUFHM0MsTUFBYSxrQ0FBa0M7SUFDN0MsWUFBNkIsR0FBZ0I7UUFBaEIsUUFBRyxHQUFILEdBQUcsQ0FBYTtJQUM3QyxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUF3Qzs7UUFDckQsTUFBTSxPQUFPLEdBQVcsSUFBSSxDQUFDLE9BQVEsQ0FBQztRQUN0QyxNQUFNLE1BQU0sR0FBVyxJQUFJLENBQUMsTUFBTyxDQUFDO1FBRXBDLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxVQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUVqSCxNQUFNLFFBQVEsR0FBRyxNQUFNLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQztZQUNoRCxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO1NBQ2pDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUViLE1BQU0sY0FBYyxTQUFHLFFBQVEsQ0FBQyxjQUFjLG1DQUFJLEVBQUUsQ0FBQztRQUNyRCxJQUFJLGNBQWMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQy9CLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQzlFO1FBRUQsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHLGNBQWMsQ0FBQztRQUV2QyxPQUFPO1lBQ0wsZUFBZSxFQUFFLGFBQWEsQ0FBQyxPQUFRO1lBQ3ZDLGdCQUFnQixFQUFFLG1CQUFtQixDQUFDLGFBQWEsQ0FBQztTQUNyRCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBMUJELGdGQTBCQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CLENBQUMsYUFBb0M7O0lBQ3RFLElBQUksbUJBQW1CLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLElBQUksbUJBQW1CLEdBQUcsS0FBSyxDQUFDO0lBRWhDLEtBQUssTUFBTSxZQUFZLFVBQUksYUFBYSxDQUFDLG1CQUFtQixtQ0FBSSxFQUFFLEVBQUU7UUFDbEUsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUM7UUFFeEQsSUFBSSxjQUFjLFdBQUksWUFBWSxDQUFDLFFBQVEsMENBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUMsRUFBRTtZQUNoRixtQkFBbUIsR0FBRyxJQUFJLENBQUM7U0FDNUI7UUFFRCxJQUFJLGNBQWMsV0FBSSxZQUFZLENBQUMsVUFBVSwwQ0FBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLE1BQU0sRUFBQyxFQUFFO1lBQy9FLG1CQUFtQixHQUFHLElBQUksQ0FBQztTQUM1QjtLQUNGO0lBRUQsT0FBTyxtQkFBbUIsSUFBSSxtQkFBbUIsQ0FBQztBQUNwRCxDQUFDO0FBakJELGtEQWlCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGN4c2NoZW1hIGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0ICogYXMgQVdTIGZyb20gJ2F3cy1zZGsnO1xuaW1wb3J0IHsgTW9kZSwgU2RrUHJvdmlkZXIgfSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHsgQ29udGV4dFByb3ZpZGVyUGx1Z2luIH0gZnJvbSAnLi9wcm92aWRlcic7XG5cbmV4cG9ydCBjbGFzcyBTZWN1cml0eUdyb3VwQ29udGV4dFByb3ZpZGVyUGx1Z2luIGltcGxlbWVudHMgQ29udGV4dFByb3ZpZGVyUGx1Z2luIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBhd3M6IFNka1Byb3ZpZGVyKSB7XG4gIH1cblxuICBhc3luYyBnZXRWYWx1ZShhcmdzOiBjeHNjaGVtYS5TZWN1cml0eUdyb3VwQ29udGV4dFF1ZXJ5KTogUHJvbWlzZTxjeGFwaS5TZWN1cml0eUdyb3VwQ29udGV4dFJlc3BvbnNlPiB7XG4gICAgY29uc3QgYWNjb3VudDogc3RyaW5nID0gYXJncy5hY2NvdW50ITtcbiAgICBjb25zdCByZWdpb246IHN0cmluZyA9IGFyZ3MucmVnaW9uITtcblxuICAgIGNvbnN0IGVjMiA9IChhd2FpdCB0aGlzLmF3cy5mb3JFbnZpcm9ubWVudChjeGFwaS5FbnZpcm9ubWVudFV0aWxzLm1ha2UoYWNjb3VudCwgcmVnaW9uKSwgTW9kZS5Gb3JSZWFkaW5nKSkuZWMyKCk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGVjMi5kZXNjcmliZVNlY3VyaXR5R3JvdXBzKHtcbiAgICAgIEdyb3VwSWRzOiBbYXJncy5zZWN1cml0eUdyb3VwSWRdLFxuICAgIH0pLnByb21pc2UoKTtcblxuICAgIGNvbnN0IHNlY3VyaXR5R3JvdXBzID0gcmVzcG9uc2UuU2VjdXJpdHlHcm91cHMgPz8gW107XG4gICAgaWYgKHNlY3VyaXR5R3JvdXBzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBzZWN1cml0eSBncm91cHMgZm91bmQgbWF0Y2hpbmcgJHtKU09OLnN0cmluZ2lmeShhcmdzKX1gKTtcbiAgICB9XG5cbiAgICBjb25zdCBbc2VjdXJpdHlHcm91cF0gPSBzZWN1cml0eUdyb3VwcztcblxuICAgIHJldHVybiB7XG4gICAgICBzZWN1cml0eUdyb3VwSWQ6IHNlY3VyaXR5R3JvdXAuR3JvdXBJZCEsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBoYXNBbGxUcmFmZmljRWdyZXNzKHNlY3VyaXR5R3JvdXApLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc0FsbFRyYWZmaWNFZ3Jlc3Moc2VjdXJpdHlHcm91cDogQVdTLkVDMi5TZWN1cml0eUdyb3VwKSB7XG4gIGxldCBoYXNBbGxUcmFmZmljQ2lkclY0ID0gZmFsc2U7XG4gIGxldCBoYXNBbGxUcmFmZmljQ2lkclY2ID0gZmFsc2U7XG5cbiAgZm9yIChjb25zdCBpcFBlcm1pc3Npb24gb2Ygc2VjdXJpdHlHcm91cC5JcFBlcm1pc3Npb25zRWdyZXNzID8/IFtdKSB7XG4gICAgY29uc3QgaXNBbGxQcm90b2NvbHMgPSBpcFBlcm1pc3Npb24uSXBQcm90b2NvbCA9PT0gJy0xJztcblxuICAgIGlmIChpc0FsbFByb3RvY29scyAmJiBpcFBlcm1pc3Npb24uSXBSYW5nZXM/LnNvbWUobSA9PiBtLkNpZHJJcCA9PT0gJzAuMC4wLjAvMCcpKSB7XG4gICAgICBoYXNBbGxUcmFmZmljQ2lkclY0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNBbGxQcm90b2NvbHMgJiYgaXBQZXJtaXNzaW9uLklwdjZSYW5nZXM/LnNvbWUobSA9PiBtLkNpZHJJcHY2ID09PSAnOjovMCcpKSB7XG4gICAgICBoYXNBbGxUcmFmZmljQ2lkclY2ID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaGFzQWxsVHJhZmZpY0NpZHJWNCAmJiBoYXNBbGxUcmFmZmljQ2lkclY2O1xufVxuIl19