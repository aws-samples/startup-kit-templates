"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeListenersByLoadBalancerArn = exports.tagsMatch = exports.describeTags = exports.describeLoadBalancers = exports.LoadBalancerListenerContextProviderPlugin = exports.LoadBalancerContextProviderPlugin = void 0;
const cxapi = require("@aws-cdk/cx-api");
const api_1 = require("../api");
/**
 * Provides load balancer context information.
 */
class LoadBalancerContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(query) {
        var _a;
        const elbv2 = (await this.aws.forEnvironment(cxapi.EnvironmentUtils.make(query.account, query.region), api_1.Mode.ForReading)).elbv2();
        if (!query.loadBalancerArn && !query.loadBalancerTags) {
            throw new Error('The load balancer lookup query must specify either `loadBalancerArn` or `loadBalancerTags`');
        }
        const loadBalancers = await findLoadBalancers(elbv2, query);
        if (loadBalancers.length === 0) {
            throw new Error(`No load balancers found matching ${JSON.stringify(query)}`);
        }
        if (loadBalancers.length > 1) {
            throw new Error(`Multiple load balancers found matching ${JSON.stringify(query)} - please provide more specific criteria`);
        }
        const loadBalancer = loadBalancers[0];
        const ipAddressType = loadBalancer.IpAddressType === 'ipv4'
            ? cxapi.LoadBalancerIpAddressType.IPV4
            : cxapi.LoadBalancerIpAddressType.DUAL_STACK;
        return {
            loadBalancerArn: loadBalancer.LoadBalancerArn,
            loadBalancerCanonicalHostedZoneId: loadBalancer.CanonicalHostedZoneId,
            loadBalancerDnsName: loadBalancer.DNSName,
            vpcId: loadBalancer.VpcId,
            securityGroupIds: (_a = loadBalancer.SecurityGroups) !== null && _a !== void 0 ? _a : [],
            ipAddressType: ipAddressType,
        };
    }
}
exports.LoadBalancerContextProviderPlugin = LoadBalancerContextProviderPlugin;
/**
 * Provides load balancer listener context information
 */
class LoadBalancerListenerContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(query) {
        const elbv2 = (await this.aws.forEnvironment(cxapi.EnvironmentUtils.make(query.account, query.region), api_1.Mode.ForReading)).elbv2();
        if (!query.listenerArn && !query.loadBalancerArn && !query.loadBalancerTags) {
            throw new Error('The load balancer listener query must specify at least one of: `listenerArn`, `loadBalancerArn` or `loadBalancerTags`');
        }
        return query.listenerArn ? this.getListenerByArn(elbv2, query) : this.getListenerByFilteringLoadBalancers(elbv2, query);
    }
    /**
     * Look up a listener by querying listeners for query's listener arn and then
     * resolve its load balancer for the security group information.
     */
    async getListenerByArn(elbv2, query) {
        var _a, _b;
        const listenerArn = query.listenerArn;
        const listenerResults = await elbv2.describeListeners({ ListenerArns: [listenerArn] }).promise();
        const listeners = ((_a = listenerResults.Listeners) !== null && _a !== void 0 ? _a : []);
        if (listeners.length === 0) {
            throw new Error(`No load balancer listeners found matching arn ${listenerArn}`);
        }
        const listener = listeners[0];
        const loadBalancers = await findLoadBalancers(elbv2, {
            ...query,
            loadBalancerArn: listener.LoadBalancerArn,
        });
        if (loadBalancers.length === 0) {
            throw new Error(`No associated load balancer found for listener arn ${listenerArn}`);
        }
        const loadBalancer = loadBalancers[0];
        return {
            listenerArn: listener.ListenerArn,
            listenerPort: listener.Port,
            securityGroupIds: (_b = loadBalancer.SecurityGroups) !== null && _b !== void 0 ? _b : [],
        };
    }
    /**
     * Look up a listener by starting from load balancers, filtering out
     * unmatching load balancers, and then by querying the listeners of each load
     * balancer and filtering out unmatching listeners.
     */
    async getListenerByFilteringLoadBalancers(elbv2, args) {
        // Find matching load balancers
        const loadBalancers = await findLoadBalancers(elbv2, args);
        if (loadBalancers.length === 0) {
            throw new Error(`No associated load balancers found for load balancer listener query ${JSON.stringify(args)}`);
        }
        return this.findMatchingListener(elbv2, loadBalancers, args);
    }
    /**
     * Finds the matching listener from the list of load balancers. This will
     * error unless there is exactly one match so that the user is prompted to
     * provide more specific criteria rather than us providing a nondeterministic
     * result.
     */
    async findMatchingListener(elbv2, loadBalancers, query) {
        var _a;
        const loadBalancersByArn = indexLoadBalancersByArn(loadBalancers);
        const loadBalancerArns = Object.keys(loadBalancersByArn);
        const matches = Array();
        for await (const listener of describeListenersByLoadBalancerArn(elbv2, loadBalancerArns)) {
            const loadBalancer = loadBalancersByArn[listener.LoadBalancerArn];
            if (listenerMatchesQueryFilter(listener, query) && loadBalancer) {
                matches.push({
                    listenerArn: listener.ListenerArn,
                    listenerPort: listener.Port,
                    securityGroupIds: (_a = loadBalancer.SecurityGroups) !== null && _a !== void 0 ? _a : [],
                });
            }
        }
        if (matches.length === 0) {
            throw new Error(`No load balancer listeners found matching ${JSON.stringify(query)}`);
        }
        if (matches.length > 1) {
            throw new Error(`Multiple load balancer listeners found matching ${JSON.stringify(query)} - please provide more specific criteria`);
        }
        return matches[0];
    }
}
exports.LoadBalancerListenerContextProviderPlugin = LoadBalancerListenerContextProviderPlugin;
/**
 * Find load balancers by the given filter args.
 */
async function findLoadBalancers(elbv2, args) {
    // List load balancers
    let loadBalancers = await describeLoadBalancers(elbv2, {
        LoadBalancerArns: args.loadBalancerArn ? [args.loadBalancerArn] : undefined,
    });
    // Filter by load balancer type
    loadBalancers = loadBalancers.filter(lb => lb.Type === args.loadBalancerType);
    // Filter by load balancer tags
    if (args.loadBalancerTags) {
        loadBalancers = await filterLoadBalancersByTags(elbv2, loadBalancers, args.loadBalancerTags);
    }
    return loadBalancers;
}
/**
 * Helper to paginate over describeLoadBalancers
 * @internal
 */
async function describeLoadBalancers(elbv2, request) {
    var _a;
    const loadBalancers = Array();
    let page;
    do {
        page = await elbv2.describeLoadBalancers({
            ...request,
            Marker: page === null || page === void 0 ? void 0 : page.NextMarker,
        }).promise();
        loadBalancers.push(...Array.from((_a = page.LoadBalancers) !== null && _a !== void 0 ? _a : []));
    } while (page.NextMarker);
    return loadBalancers;
}
exports.describeLoadBalancers = describeLoadBalancers;
/**
 * Describes the tags of each load balancer and returns the load balancers that
 * match the given tags.
 */
async function filterLoadBalancersByTags(elbv2, loadBalancers, loadBalancerTags) {
    const loadBalancersByArn = indexLoadBalancersByArn(loadBalancers);
    const loadBalancerArns = Object.keys(loadBalancersByArn);
    const matchingLoadBalancers = Array();
    // Consume the items of async generator.
    for await (const tags of describeTags(elbv2, loadBalancerArns)) {
        if (tagsMatch(tags, loadBalancerTags) && loadBalancersByArn[tags.ResourceArn]) {
            matchingLoadBalancers.push(loadBalancersByArn[tags.ResourceArn]);
        }
    }
    return matchingLoadBalancers;
}
/**
 * Generator function that yields `TagDescriptions`. The API doesn't support
 * pagination, so this generator breaks the resource list into chunks and issues
 * the appropriate requests, yielding each tag description as it receives it.
 * @internal
 */
async function* describeTags(elbv2, resourceArns) {
    var _a;
    // Max of 20 resource arns per request.
    const chunkSize = 20;
    for (let i = 0; i < resourceArns.length; i += chunkSize) {
        const chunk = resourceArns.slice(i, Math.min(i + chunkSize, resourceArns.length));
        const chunkTags = await elbv2.describeTags({
            ResourceArns: chunk,
        }).promise();
        for (const tag of (_a = chunkTags.TagDescriptions) !== null && _a !== void 0 ? _a : []) {
            yield tag;
        }
    }
}
exports.describeTags = describeTags;
/**
 * Determines if the given TagDescription matches the required tags.
 * @internal
 */
function tagsMatch(tagDescription, requiredTags) {
    var _a;
    const tagsByName = {};
    for (const tag of (_a = tagDescription.Tags) !== null && _a !== void 0 ? _a : []) {
        tagsByName[tag.Key] = tag.Value;
    }
    for (const tag of requiredTags) {
        if (tagsByName[tag.key] !== tag.value) {
            return false;
        }
    }
    return true;
}
exports.tagsMatch = tagsMatch;
/**
 * Async generator that produces listener descriptions by traversing the
 * pagination. Because describeListeners only lets you search by one load
 * balancer arn at a time, we request them individually and yield the listeners
 * as they come in.
 * @internal
 */
async function* describeListenersByLoadBalancerArn(elbv2, loadBalancerArns) {
    var _a;
    for (const loadBalancerArn of loadBalancerArns) {
        let page;
        do {
            page = await elbv2.describeListeners({
                LoadBalancerArn: loadBalancerArn,
                Marker: page === null || page === void 0 ? void 0 : page.NextMarker,
            }).promise();
            for (const listener of (_a = page.Listeners) !== null && _a !== void 0 ? _a : []) {
                yield listener;
            }
        } while (page.NextMarker);
    }
}
exports.describeListenersByLoadBalancerArn = describeListenersByLoadBalancerArn;
/**
 * Determines if a listener matches the query filters.
 */
function listenerMatchesQueryFilter(listener, args) {
    if (args.listenerPort && listener.Port !== args.listenerPort) {
        // No match.
        return false;
    }
    if (args.listenerProtocol && listener.Protocol !== args.listenerProtocol) {
        // No match.
        return false;
    }
    return true;
}
/**
 * Returns a record of load balancers indexed by their arns
 */
function indexLoadBalancersByArn(loadBalancers) {
    const loadBalancersByArn = {};
    for (const loadBalancer of loadBalancers) {
        loadBalancersByArn[loadBalancer.LoadBalancerArn] = loadBalancer;
    }
    return loadBalancersByArn;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1iYWxhbmNlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsb2FkLWJhbGFuY2Vycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx5Q0FBeUM7QUFFekMsZ0NBQTJDO0FBRzNDOztHQUVHO0FBQ0gsTUFBYSxpQ0FBaUM7SUFDNUMsWUFBNkIsR0FBZ0I7UUFBaEIsUUFBRyxHQUFILEdBQUcsQ0FBYTtJQUM3QyxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUF3Qzs7UUFDckQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsVUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFakksSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUU7WUFDckQsTUFBTSxJQUFJLEtBQUssQ0FBQyw0RkFBNEYsQ0FBQyxDQUFDO1NBQy9HO1FBRUQsTUFBTSxhQUFhLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFNUQsSUFBSSxhQUFhLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUM5QixNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUM5RTtRQUVELElBQUksYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQywwQ0FBMEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQztTQUM1SDtRQUVELE1BQU0sWUFBWSxHQUFHLGFBQWEsQ0FBQyxDQUFDLENB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cnQgKiBhcyBjeHNjaGVtYSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcbmltcG9ydCB7IE1vZGUsIFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7IENvbnRleHRQcm92aWRlclBsdWdpbiB9IGZyb20gJy4vcHJvdmlkZXInO1xuXG4vKipcbiAqIFByb3ZpZGVzIGxvYWQgYmFsYW5jZXIgY29udGV4dCBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIExvYWRCYWxhbmNlckNvbnRleHRQcm92aWRlclBsdWdpbiBpbXBsZW1lbnRzIENvbnRleHRQcm92aWRlclBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYXdzOiBTZGtQcm92aWRlcikge1xuICB9XG5cbiAgYXN5bmMgZ2V0VmFsdWUocXVlcnk6IGN4c2NoZW1hLkxvYWRCYWxhbmNlckNvbnRleHRRdWVyeSk6IFByb21pc2U8Y3hhcGkuTG9hZEJhbGFuY2VyQ29udGV4dFJlc3BvbnNlPiB7XG4gICAgY29uc3QgZWxidjIgPSAoYXdhaXQgdGhpcy5hd3MuZm9yRW52aXJvbm1lbnQoY3hhcGkuRW52aXJvbm1lbnRVdGlscy5tYWtlKHF1ZXJ5LmFjY291bnQsIHF1ZXJ5LnJlZ2lvbiksIE1vZGUuRm9yUmVhZGluZykpLmVsYnYyKCk7XG5cbiAgICBpZiAoIXF1ZXJ5LmxvYWRCYWxhbmNlckFybiAmJiAhcXVlcnkubG9hZEJhbGFuY2VyVGFncykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbG9hZCBiYWxhbmNlciBsb29rdXAgcXVlcnkgbXVzdCBzcGVjaWZ5IGVpdGhlciBgbG9hZEJhbGFuY2VyQXJuYCBvciBgbG9hZEJhbGFuY2VyVGFnc2AnKTtcbiAgICB9XG5cbiAgICBjb25zdCBsb2FkQmFsYW5jZXJzID0gYXdhaXQgZmluZExvYWRCYWxhbmNlcnMoZWxidjIsIHF1ZXJ5KTtcblxuICAgIGlmIChsb2FkQmFsYW5jZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBsb2FkIGJhbGFuY2VycyBmb3VuZCBtYXRjaGluZyAke0pTT04uc3RyaW5naWZ5KHF1ZXJ5KX1gKTtcbiAgICB9XG5cbiAgICBpZiAobG9hZEJhbGFuY2Vycy5sZW5ndGggPiAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE11bHRpcGxlIGxvYWQgYmFsYW5jZXJzIGZvdW5kIG1hdGNoaW5nICR7SlNPTi5zdHJpbmdpZnkocXVlcnkpfSAtIHBsZWFzZSBwcm92aWRlIG1vcmUgc3BlY2lmaWMgY3JpdGVyaWFgKTtcbiAgICB9XG5cbiAgICBjb25zdCBsb2FkQmFsYW5jZXIgPSBsb2FkQmFsYW5jZXJzWzBdO1xuXG4gICAgY29uc3QgaXBBZGRyZXNzVHlwZSA9IGxvYWRCYWxhbmNlci5JcEFkZHJlc3NUeXBlID09PSAnaXB2NCdcbiAgICAgID8gY3hhcGkuTG9hZEJhbGFuY2VySXBBZGRyZXNzVHlwZS5JUFY0XG4gICAgICA6IGN4YXBpLkxvYWRCYWxhbmNlcklwQWRkcmVzc1R5cGUuRFVBTF9TVEFDSztcblxuICAgIHJldHVybiB7XG4gICAgICBsb2FkQmFsYW5jZXJBcm46IGxvYWRCYWxhbmNlci5Mb2FkQmFsYW5jZXJBcm4hLFxuICAgICAgbG9hZEJhbGFuY2VyQ2Fub25pY2FsSG9zdGVkWm9uZUlkOiBsb2FkQmFsYW5jZXIuQ2Fub25pY2FsSG9zdGVkWm9uZUlkISxcbiAgICAgIGxvYWRCYWxhbmNlckRuc05hbWU6IGxvYWRCYWxhbmNlci5ETlNOYW1lISxcbiAgICAgIHZwY0lkOiBsb2FkQmFsYW5jZXIuVnBjSWQhLFxuICAgICAgc2VjdXJpdHlHcm91cElkczogbG9hZEJhbGFuY2VyLlNlY3VyaXR5R3JvdXBzID8/IFtdLFxuICAgICAgaXBBZGRyZXNzVHlwZTogaXBBZGRyZXNzVHlwZSxcbiAgICB9O1xuICB9XG59XG5cbi8vIERlY3JlYXNlcyBsaW5lIGxlbmd0aFxudHlwZSBMb2FkQmFsYW5jZXJMaXN0ZW5lclF1ZXJ5ID0gY3hzY2hlbWEuTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UXVlcnk7XG50eXBlIExvYWRCYWxhbmNlckxpc3RlbmVyUmVzcG9uc2UgPSBjeGFwaS5Mb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRSZXNwb25zZTtcblxuLyoqXG4gKiBQcm92aWRlcyBsb2FkIGJhbGFuY2VyIGxpc3RlbmVyIGNvbnRleHQgaW5mb3JtYXRpb25cbiAqL1xuZXhwb3J0IGNsYXNzIExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luIGltcGxlbWVudHMgQ29udGV4dFByb3ZpZGVyUGx1Z2luIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBhd3M6IFNka1Byb3ZpZGVyKSB7XG4gIH1cblxuICBhc3luYyBnZXRWYWx1ZShxdWVyeTogTG9hZEJhbGFuY2VyTGlzdGVuZXJRdWVyeSk6IFByb21pc2U8TG9hZEJhbGFuY2VyTGlzdGVuZXJSZXNwb25zZT4ge1xuICAgIGNvbnN0IGVsYnYyID0gKGF3YWl0IHRoaXMuYXdzLmZvckVudmlyb25tZW50KGN4YXBpLkVudmlyb25tZW50VXRpbHMubWFrZShxdWVyeS5hY2NvdW50LCBxdWVyeS5yZWdpb24pLCBNb2RlLkZvclJlYWRpbmcpKS5lbGJ2MigpO1xuXG4gICAgaWYgKCFxdWVyeS5saXN0ZW5lckFybiAmJiAhcXVlcnkubG9hZEJhbGFuY2VyQXJuICYmICFxdWVyeS5sb2FkQmFsYW5jZXJUYWdzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBsb2FkIGJhbGFuY2VyIGxpc3RlbmVyIHF1ZXJ5IG11c3Qgc3BlY2lmeSBhdCBsZWFzdCBvbmUgb2Y6IGBsaXN0ZW5lckFybmAsIGBsb2FkQmFsYW5jZXJBcm5gIG9yIGBsb2FkQmFsYW5jZXJUYWdzYCcpO1xuICAgIH1cblxuICAgIHJldHVybiBxdWVyeS5saXN0ZW5lckFybiA/IHRoaXMuZ2V0TGlzdGVuZXJCeUFybihlbGJ2MiwgcXVlcnkpIDogdGhpcy5nZXRMaXN0ZW5lckJ5RmlsdGVyaW5nTG9hZEJhbGFuY2VycyhlbGJ2MiwgcXVlcnkpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvb2sgdXAgYSBsaXN0ZW5lciBieSBxdWVyeWluZyBsaXN0ZW5lcnMgZm9yIHF1ZXJ5J3MgbGlzdGVuZXIgYXJuIGFuZCB0aGVuXG4gICAqIHJlc29sdmUgaXRzIGxvYWQgYmFsYW5jZXIgZm9yIHRoZSBzZWN1cml0eSBncm91cCBpbmZvcm1hdGlvbi5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZ2V0TGlzdGVuZXJCeUFybihlbGJ2MjogQVdTLkVMQnYyLCBxdWVyeTogTG9hZEJhbGFuY2VyTGlzdGVuZXJRdWVyeSkge1xuICAgIGNvbnN0IGxpc3RlbmVyQXJuID0gcXVlcnkubGlzdGVuZXJBcm4hO1xuICAgIGNvbnN0IGxpc3RlbmVyUmVzdWx0cyA9IGF3YWl0IGVsYnYyLmRlc2NyaWJlTGlzdGVuZXJzKHsgTGlzdGVuZXJBcm5zOiBbbGlzdGVuZXJBcm5dIH0pLnByb21pc2UoKTtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSAobGlzdGVuZXJSZXN1bHRzLkxpc3RlbmVycyA/PyBbXSk7XG5cbiAgICBpZiAobGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBsb2FkIGJhbGFuY2VyIGxpc3RlbmVycyBmb3VuZCBtYXRjaGluZyBhcm4gJHtsaXN0ZW5lckFybn1gKTtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1swXTtcblxuICAgIGNvbnN0IGxvYWRCYWxhbmNlcnMgPSBhd2FpdCBmaW5kTG9hZEJhbGFuY2VycyhlbGJ2Miwge1xuICAgICAgLi4ucXVlcnksXG4gICAgICBsb2FkQmFsYW5jZXJBcm46IGxpc3RlbmVyLkxvYWRCYWxhbmNlckFybiEsXG4gICAgfSk7XG5cbiAgICBpZiAobG9hZEJhbGFuY2Vycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIGZvdW5kIGZvciBsaXN0ZW5lciBhcm4gJHtsaXN0ZW5lckFybn1gKTtcbiAgICB9XG5cbiAgICBjb25zdCBsb2FkQmFsYW5jZXIgPSBsb2FkQmFsYW5jZXJzWzBdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxpc3RlbmVyQXJuOiBsaXN0ZW5lci5MaXN0ZW5lckFybiEsXG4gICAgICBsaXN0ZW5lclBvcnQ6IGxpc3RlbmVyLlBvcnQhLFxuICAgICAgc2VjdXJpdHlHcm91cElkczogbG9hZEJhbGFuY2VyLlNlY3VyaXR5R3JvdXBzID8/IFtdLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogTG9vayB1cCBhIGxpc3RlbmVyIGJ5IHN0YXJ0aW5nIGZyb20gbG9hZCBiYWxhbmNlcnMsIGZpbHRlcmluZyBvdXRcbiAgICogdW5tYXRjaGluZyBsb2FkIGJhbGFuY2VycywgYW5kIHRoZW4gYnkgcXVlcnlpbmcgdGhlIGxpc3RlbmVycyBvZiBlYWNoIGxvYWRcbiAgICogYmFsYW5jZXIgYW5kIGZpbHRlcmluZyBvdXQgdW5tYXRjaGluZyBsaXN0ZW5lcnMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGdldExpc3RlbmVyQnlGaWx0ZXJpbmdMb2FkQmFsYW5jZXJzKGVsYnYyOiBBV1MuRUxCdjIsIGFyZ3M6IExvYWRCYWxhbmNlckxpc3RlbmVyUXVlcnkpIHtcbiAgICAvLyBGaW5kIG1hdGNoaW5nIGxvYWQgYmFsYW5jZXJzXG4gICAgY29uc3QgbG9hZEJhbGFuY2VycyA9IGF3YWl0IGZpbmRMb2FkQmFsYW5jZXJzKGVsYnYyLCBhcmdzKTtcblxuICAgIGlmIChsb2FkQmFsYW5jZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXJzIGZvdW5kIGZvciBsb2FkIGJhbGFuY2VyIGxpc3RlbmVyIHF1ZXJ5ICR7SlNPTi5zdHJpbmdpZnkoYXJncyl9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZmluZE1hdGNoaW5nTGlzdGVuZXIoZWxidjIsIGxvYWRCYWxhbmNlcnMsIGFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmRzIHRoZSBtYXRjaGluZyBsaXN0ZW5lciBmcm9tIHRoZSBsaXN0IG9mIGxvYWQgYmFsYW5jZXJzLiBUaGlzIHdpbGxcbiAgICogZXJyb3IgdW5sZXNzIHRoZXJlIGlzIGV4YWN0bHkgb25lIG1hdGNoIHNvIHRoYXQgdGhlIHVzZXIgaXMgcHJvbXB0ZWQgdG9cbiAgICogcHJvdmlkZSBtb3JlIHNwZWNpZmljIGNyaXRlcmlhIHJhdGhlciB0aGFuIHVzIHByb3ZpZGluZyBhIG5vbmRldGVybWluaXN0aWNcbiAgICogcmVzdWx0LlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBmaW5kTWF0Y2hpbmdMaXN0ZW5lcihlbGJ2MjogQVdTLkVMQnYyLCBsb2FkQmFsYW5jZXJzOiBBV1MuRUxCdjIuTG9hZEJhbGFuY2VycywgcXVlcnk6IExvYWRCYWxhbmNlckxpc3RlbmVyUXVlcnkpIHtcbiAgICBjb25zdCBsb2FkQmFsYW5jZXJzQnlBcm4gPSBpbmRleExvYWRCYWxhbmNlcnNCeUFybihsb2FkQmFsYW5jZXJzKTtcbiAgICBjb25zdCBsb2FkQmFsYW5jZXJBcm5zID0gT2JqZWN0LmtleXMobG9hZEJhbGFuY2Vyc0J5QXJuKTtcblxuICAgIGNvbnN0IG1hdGNoZXMgPSBBcnJheTxjeGFwaS5Mb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRSZXNwb25zZT4oKTtcblxuICAgIGZvciBhd2FpdCAoY29uc3QgbGlzdGVuZXIgb2YgZGVzY3JpYmVMaXN0ZW5lcnNCeUxvYWRCYWxhbmNlckFybihlbGJ2MiwgbG9hZEJhbGFuY2VyQXJucykpIHtcbiAgICAgIGNvbnN0IGxvYWRCYWxhbmNlciA9IGxvYWRCYWxhbmNlcnNCeUFybltsaXN0ZW5lci5Mb2FkQmFsYW5jZXJBcm4hXTtcbiAgICAgIGlmIChsaXN0ZW5lck1hdGNoZXNRdWVyeUZpbHRlcihsaXN0ZW5lciwgcXVlcnkpICYmIGxvYWRCYWxhbmNlcikge1xuICAgICAgICBtYXRjaGVzLnB1c2goe1xuICAgICAgICAgIGxpc3RlbmVyQXJuOiBsaXN0ZW5lci5MaXN0ZW5lckFybiEsXG4gICAgICAgICAgbGlzdGVuZXJQb3J0OiBsaXN0ZW5lci5Qb3J0ISxcbiAgICAgICAgICBzZWN1cml0eUdyb3VwSWRzOiBsb2FkQmFsYW5jZXIuU2VjdXJpdHlHcm91cHMgPz8gW10sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXRjaGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBsb2FkIGJhbGFuY2VyIGxpc3RlbmVycyBmb3VuZCBtYXRjaGluZyAke0pTT04uc3RyaW5naWZ5KHF1ZXJ5KX1gKTtcbiAgICB9XG5cbiAgICBpZiAobWF0Y2hlcy5sZW5ndGggPiAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE11bHRpcGxlIGxvYWQgYmFsYW5jZXIgbGlzdGVuZXJzIGZvdW5kIG1hdGNoaW5nICR7SlNPTi5zdHJpbmdpZnkocXVlcnkpfSAtIHBsZWFzZSBwcm92aWRlIG1vcmUgc3BlY2lmaWMgY3JpdGVyaWFgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWF0Y2hlc1swXTtcbiAgfVxufVxuXG4vKipcbiAqIEZpbmQgbG9hZCBiYWxhbmNlcnMgYnkgdGhlIGdpdmVuIGZpbHRlciBhcmdzLlxuICovXG5hc3luYyBmdW5jdGlvbiBmaW5kTG9hZEJhbGFuY2VycyhlbGJ2MjogQVdTLkVMQnYyLCBhcmdzOiBjeHNjaGVtYS5Mb2FkQmFsYW5jZXJGaWx0ZXIpIHtcbiAgLy8gTGlzdCBsb2FkIGJhbGFuY2Vyc1xuICBsZXQgbG9hZEJhbGFuY2VycyA9IGF3YWl0IGRlc2NyaWJlTG9hZEJhbGFuY2VycyhlbGJ2Miwge1xuICAgIExvYWRCYWxhbmNlckFybnM6IGFyZ3MubG9hZEJhbGFuY2VyQXJuID8gW2FyZ3MubG9hZEJhbGFuY2VyQXJuXSA6IHVuZGVmaW5lZCxcbiAgfSk7XG5cbiAgLy8gRmlsdGVyIGJ5IGxvYWQgYmFsYW5jZXIgdHlwZVxuICBsb2FkQmFsYW5jZXJzID0gbG9hZEJhbGFuY2Vycy5maWx0ZXIobGIgPT4gbGIuVHlwZSA9PT0gYXJncy5sb2FkQmFsYW5jZXJUeXBlKTtcblxuICAvLyBGaWx0ZXIgYnkgbG9hZCBiYWxhbmNlciB0YWdzXG4gIGlmIChhcmdzLmxvYWRCYWxhbmNlclRhZ3MpIHtcbiAgICBsb2FkQmFsYW5jZXJzID0gYXdhaXQgZmlsdGVyTG9hZEJhbGFuY2Vyc0J5VGFncyhlbGJ2MiwgbG9hZEJhbGFuY2VycywgYXJncy5sb2FkQmFsYW5jZXJUYWdzKTtcbiAgfVxuXG4gIHJldHVybiBsb2FkQmFsYW5jZXJzO1xufVxuXG4vKipcbiAqIEhlbHBlciB0byBwYWdpbmF0ZSBvdmVyIGRlc2NyaWJlTG9hZEJhbGFuY2Vyc1xuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZXNjcmliZUxvYWRCYWxhbmNlcnMoZWxidjI6IEFXUy5FTEJ2MiwgcmVxdWVzdDogQVdTLkVMQnYyLkRlc2NyaWJlTG9hZEJhbGFuY2Vyc0lucHV0KSB7XG4gIGNvbnN0IGxvYWRCYWxhbmNlcnMgPSBBcnJheTxBV1MuRUxCdjIuTG9hZEJhbGFuY2VyPigpO1xuICBsZXQgcGFnZTogQVdTLkVMQnYyLkRlc2NyaWJlTG9hZEJhbGFuY2Vyc091dHB1dCB8IHVuZGVmaW5lZDtcbiAgZG8ge1xuICAgIHBhZ2UgPSBhd2FpdCBlbGJ2Mi5kZXNjcmliZUxvYWRCYWxhbmNlcnMoe1xuICAgICAgLi4ucmVxdWVzdCxcbiAgICAgIE1hcmtlcjogcGFnZT8uTmV4dE1hcmtlcixcbiAgICB9KS5wcm9taXNlKCk7XG5cbiAgICBsb2FkQmFsYW5jZXJzLnB1c2goLi4uQXJyYXkuZnJvbShwYWdlLkxvYWRCYWxhbmNlcnMgPz8gW10pKTtcbiAgfSB3aGlsZSAocGFnZS5OZXh0TWFya2VyKTtcblxuICByZXR1cm4gbG9hZEJhbGFuY2Vycztcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgdGhlIHRhZ3Mgb2YgZWFjaCBsb2FkIGJhbGFuY2VyIGFuZCByZXR1cm5zIHRoZSBsb2FkIGJhbGFuY2VycyB0aGF0XG4gKiBtYXRjaCB0aGUgZ2l2ZW4gdGFncy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZmlsdGVyTG9hZEJhbGFuY2Vyc0J5VGFncyhlbGJ2MjogQVdTLkVMQnYyLCBsb2FkQmFsYW5jZXJzOiBBV1MuRUxCdjIuTG9hZEJhbGFuY2VycywgbG9hZEJhbGFuY2VyVGFnczogY3hzY2hlbWEuVGFnW10pIHtcbiAgY29uc3QgbG9hZEJhbGFuY2Vyc0J5QXJuID0gaW5kZXhMb2FkQmFsYW5jZXJzQnlBcm4obG9hZEJhbGFuY2Vycyk7XG4gIGNvbnN0IGxvYWRCYWxhbmNlckFybnMgPSBPYmplY3Qua2V5cyhsb2FkQmFsYW5jZXJzQnlBcm4pO1xuICBjb25zdCBtYXRjaGluZ0xvYWRCYWxhbmNlcnMgPSBBcnJheTxBV1MuRUxCdjIuTG9hZEJhbGFuY2VyPigpO1xuXG4gIC8vIENvbnN1bWUgdGhlIGl0ZW1zIG9mIGFzeW5jIGdlbmVyYXRvci5cbiAgZm9yIGF3YWl0IChjb25zdCB0YWdzIG9mIGRlc2NyaWJlVGFncyhlbGJ2MiwgbG9hZEJhbGFuY2VyQXJucykpIHtcbiAgICBpZiAodGFnc01hdGNoKHRhZ3MsIGxvYWRCYWxhbmNlclRhZ3MpICYmIGxvYWRCYWxhbmNlcnNCeUFyblt0YWdzLlJlc291cmNlQXJuIV0pIHtcbiAgICAgIG1hdGNoaW5nTG9hZEJhbGFuY2Vycy5wdXNoKGxvYWRCYWxhbmNlcnNCeUFyblt0YWdzLlJlc291cmNlQXJuIV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXRjaGluZ0xvYWRCYWxhbmNlcnM7XG59XG5cbi8qKlxuICogR2VuZXJhdG9yIGZ1bmN0aW9uIHRoYXQgeWllbGRzIGBUYWdEZXNjcmlwdGlvbnNgLiBUaGUgQVBJIGRvZXNuJ3Qgc3VwcG9ydFxuICogcGFnaW5hdGlvbiwgc28gdGhpcyBnZW5lcmF0b3IgYnJlYWtzIHRoZSByZXNvdXJjZSBsaXN0IGludG8gY2h1bmtzIGFuZCBpc3N1ZXNcbiAqIHRoZSBhcHByb3ByaWF0ZSByZXF1ZXN0cywgeWllbGRpbmcgZWFjaCB0YWcgZGVzY3JpcHRpb24gYXMgaXQgcmVjZWl2ZXMgaXQuXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBkZXNjcmliZVRhZ3MoZWxidjI6IEFXUy5FTEJ2MiwgcmVzb3VyY2VBcm5zOiBzdHJpbmdbXSkge1xuICAvLyBNYXggb2YgMjAgcmVzb3VyY2UgYXJucyBwZXIgcmVxdWVzdC5cbiAgY29uc3QgY2h1bmtTaXplID0gMjA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzb3VyY2VBcm5zLmxlbmd0aDsgaSArPSBjaHVua1NpemUpIHtcbiAgICBjb25zdCBjaHVuayA9IHJlc291cmNlQXJucy5zbGljZShpLCBNYXRoLm1pbihpICsgY2h1bmtTaXplLCByZXNvdXJjZUFybnMubGVuZ3RoKSk7XG4gICAgY29uc3QgY2h1bmtUYWdzID0gYXdhaXQgZWxidjIuZGVzY3JpYmVUYWdzKHtcbiAgICAgIFJlc291cmNlQXJuczogY2h1bmssXG4gICAgfSkucHJvbWlzZSgpO1xuXG4gICAgZm9yIChjb25zdCB0YWcgb2YgY2h1bmtUYWdzLlRhZ0Rlc2NyaXB0aW9ucyA/PyBbXSkge1xuICAgICAgeWllbGQgdGFnO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERldGVybWluZXMgaWYgdGhlIGdpdmVuIFRhZ0Rlc2NyaXB0aW9uIG1hdGNoZXMgdGhlIHJlcXVpcmVkIHRhZ3MuXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRhZ3NNYXRjaCh0YWdEZXNjcmlwdGlvbjogQVdTLkVMQnYyLlRhZ0Rlc2NyaXB0aW9uLCByZXF1aXJlZFRhZ3M6IGN4c2NoZW1hLlRhZ1tdKSB7XG4gIGNvbnN0IHRhZ3NCeU5hbWU6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHVuZGVmaW5lZD4gPSB7fTtcbiAgZm9yIChjb25zdCB0YWcgb2YgdGFnRGVzY3JpcHRpb24uVGFncyA/PyBbXSkge1xuICAgIHRhZ3NCeU5hbWVbdGFnLktleSFdID0gdGFnLlZhbHVlO1xuICB9XG5cbiAgZm9yIChjb25zdCB0YWcgb2YgcmVxdWlyZWRUYWdzKSB7XG4gICAgaWYgKHRhZ3NCeU5hbWVbdGFnLmtleV0gIT09IHRhZy52YWx1ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIEFzeW5jIGdlbmVyYXRvciB0aGF0IHByb2R1Y2VzIGxpc3RlbmVyIGRlc2NyaXB0aW9ucyBieSB0cmF2ZXJzaW5nIHRoZVxuICogcGFnaW5hdGlvbi4gQmVjYXVzZSBkZXNjcmliZUxpc3RlbmVycyBvbmx5IGxldHMgeW91IHNlYXJjaCBieSBvbmUgbG9hZFxuICogYmFsYW5jZXIgYXJuIGF0IGEgdGltZSwgd2UgcmVxdWVzdCB0aGVtIGluZGl2aWR1YWxseSBhbmQgeWllbGQgdGhlIGxpc3RlbmVyc1xuICogYXMgdGhleSBjb21lIGluLlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogZGVzY3JpYmVMaXN0ZW5lcnNCeUxvYWRCYWxhbmNlckFybihlbGJ2MjogQVdTLkVMQnYyLCBsb2FkQmFsYW5jZXJBcm5zOiBzdHJpbmdbXSkge1xuICBmb3IgKGNvbnN0IGxvYWRCYWxhbmNlckFybiBvZiBsb2FkQmFsYW5jZXJBcm5zKSB7XG4gICAgbGV0IHBhZ2U6IEFXUy5FTEJ2Mi5EZXNjcmliZUxpc3RlbmVyc091dHB1dCB8IHVuZGVmaW5lZDtcbiAgICBkbyB7XG4gICAgICBwYWdlID0gYXdhaXQgZWxidjIuZGVzY3JpYmVMaXN0ZW5lcnMoe1xuICAgICAgICBMb2FkQmFsYW5jZXJBcm46IGxvYWRCYWxhbmNlckFybixcbiAgICAgICAgTWFya2VyOiBwYWdlPy5OZXh0TWFya2VyLFxuICAgICAgfSkucHJvbWlzZSgpO1xuXG4gICAgICBmb3IgKGNvbnN0IGxpc3RlbmVyIG9mIHBhZ2UuTGlzdGVuZXJzID8/IFtdKSB7XG4gICAgICAgIHlpZWxkIGxpc3RlbmVyO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKHBhZ2UuTmV4dE1hcmtlcik7XG4gIH1cbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIGEgbGlzdGVuZXIgbWF0Y2hlcyB0aGUgcXVlcnkgZmlsdGVycy5cbiAqL1xuZnVuY3Rpb24gbGlzdGVuZXJNYXRjaGVzUXVlcnlGaWx0ZXIobGlzdGVuZXI6IEFXUy5FTEJ2Mi5MaXN0ZW5lciwgYXJnczogY3hzY2hlbWEuTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UXVlcnkpOiBib29sZWFuIHtcbiAgaWYgKGFyZ3MubGlzdGVuZXJQb3J0ICYmIGxpc3RlbmVyLlBvcnQgIT09IGFyZ3MubGlzdGVuZXJQb3J0KSB7XG4gICAgLy8gTm8gbWF0Y2guXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGFyZ3MubGlzdGVuZXJQcm90b2NvbCAmJiBsaXN0ZW5lci5Qcm90b2NvbCAhPT0gYXJncy5saXN0ZW5lclByb3RvY29sKSB7XG4gICAgLy8gTm8gbWF0Y2guXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogUmV0dXJucyBhIHJlY29yZCBvZiBsb2FkIGJhbGFuY2VycyBpbmRleGVkIGJ5IHRoZWlyIGFybnNcbiAqL1xuZnVuY3Rpb24gaW5kZXhMb2FkQmFsYW5jZXJzQnlBcm4obG9hZEJhbGFuY2VyczogQVdTLkVMQnYyLkxvYWRCYWxhbmNlcltdKTogUmVjb3JkPHN0cmluZywgQVdTLkVMQnYyLkxvYWRCYWxhbmNlcj4ge1xuICBjb25zdCBsb2FkQmFsYW5jZXJzQnlBcm46IFJlY29yZDxzdHJpbmcsIEFXUy5FTEJ2Mi5Mb2FkQmFsYW5jZXI+ID0ge307XG5cbiAgZm9yIChjb25zdCBsb2FkQmFsYW5jZXIgb2YgbG9hZEJhbGFuY2Vycykge1xuICAgIGxvYWRCYWxhbmNlcnNCeUFybltsb2FkQmFsYW5jZXIuTG9hZEJhbGFuY2VyQXJuIV0gPSBsb2FkQmFsYW5jZXI7XG4gIH1cblxuICByZXR1cm4gbG9hZEJhbGFuY2Vyc0J5QXJuO1xufVxuIl19