"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const AWS = require("aws-sdk-mock");
const load_balancers_1 = require("../../lib/context-providers/load-balancers");
const mock_sdk_1 = require("../util/mock-sdk");
AWS.setSDK(require.resolve('aws-sdk'));
const mockSDK = new mock_sdk_1.MockSdkProvider();
afterEach(done => {
    AWS.restore();
    done();
});
describe('utilities', () => {
    test('describeTags yields tags by chunk', async () => {
        const resourceTags = {};
        for (const resourceArn of [...Array(100)].map((_, i) => `arn:load-balancer-${i}`)) {
            resourceTags[resourceArn] = {
                ResourceArn: resourceArn,
                Tags: [
                    { Key: 'name', Value: resourceArn },
                ],
            };
        }
        ;
        AWS.mock('ELBv2', 'describeTags', (_params, cb) => {
            expect(_params.ResourceArns.length).toBeLessThanOrEqual(20);
            cb(null, {
                TagDescriptions: _params.ResourceArns.map(resourceArn => ({
                    ResourceArn: resourceArn,
                    Tags: [
                        { Key: 'name', Value: resourceArn },
                    ],
                })),
            });
        });
        const elbv2 = await (await mockSDK.forEnvironment()).elbv2();
        const resourceTagsOut = {};
        for await (const tagDescription of load_balancers_1.describeTags(elbv2, Object.keys(resourceTags))) {
            resourceTagsOut[tagDescription.ResourceArn] = tagDescription;
        }
        expect(resourceTagsOut).toEqual(resourceTags);
    });
    test('describeListenersByLoadBalancerArn traverses pages', async () => {
        // arn:listener-0, arn:listener-1, ..., arn:listener-99
        const listenerArns = [...Array(100)].map((_, i) => `arn:listener-${i}`);
        expect(listenerArns[0]).toEqual('arn:listener-0');
        AWS.mock('ELBv2', 'describeListeners', (_params, cb) => {
            var _a;
            const start = parseInt((_a = _params.Marker) !== null && _a !== void 0 ? _a : '0');
            const end = start + 10;
            const slice = listenerArns.slice(start, end);
            cb(null, {
                Listeners: slice.map(arn => ({
                    ListenerArn: arn,
                })),
                NextMarker: end < listenerArns.length ? end.toString() : undefined,
            });
        });
        const elbv2 = await (await mockSDK.forEnvironment()).elbv2();
        const listenerArnsFromPages = Array();
        for await (const listener of load_balancers_1.describeListenersByLoadBalancerArn(elbv2, ['arn:load-balancer'])) {
            listenerArnsFromPages.push(listener.ListenerArn);
        }
        expect(listenerArnsFromPages).toEqual(listenerArns);
    });
    test('describeLoadBalancers traverses pages', async () => {
        const loadBalancerArns = [...Array(100)].map((_, i) => `arn:load-balancer-${i}`);
        expect(loadBalancerArns[0]).toEqual('arn:load-balancer-0');
        AWS.mock('ELBv2', 'describeLoadBalancers', (_params, cb) => {
            var _a;
            const start = parseInt((_a = _params.Marker) !== null && _a !== void 0 ? _a : '0');
            const end = start + 10;
            const slice = loadBalancerArns.slice(start, end);
            cb(null, {
                LoadBalancers: slice.map(loadBalancerArn => ({
                    LoadBalancerArn: loadBalancerArn,
                })),
                NextMarker: end < loadBalancerArns.length ? end.toString() : undefined,
            });
        });
        const elbv2 = await (await mockSDK.forEnvironment()).elbv2();
        const loadBalancerArnsFromPages = (await load_balancers_1.describeLoadBalancers(elbv2, {})).map(l => l.LoadBalancerArn);
        expect(loadBalancerArnsFromPages).toEqual(loadBalancerArns);
    });
    describe('tagsMatch', () => {
        test('all tags match', () => {
            const tagDescription = {
                ResourceArn: 'arn:whatever',
                Tags: [{ Key: 'some', Value: 'tag' }],
            };
            const requiredTags = [
                { key: 'some', value: 'tag' },
            ];
            expect(load_balancers_1.tagsMatch(tagDescription, requiredTags)).toEqual(true);
        });
        test('extra tags match', () => {
            const tagDescription = {
                ResourceArn: 'arn:whatever',
                Tags: [
                    { Key: 'some', Value: 'tag' },
                    { Key: 'other', Value: 'tag2' },
                ],
            };
            const requiredTags = [
                { key: 'some', value: 'tag' },
            ];
            expect(load_balancers_1.tagsMatch(tagDescription, requiredTags)).toEqual(true);
        });
        test('no tags matches no tags', () => {
            const tagDescription = {
                ResourceArn: 'arn:whatever',
                Tags: [],
            };
            expect(load_balancers_1.tagsMatch(tagDescription, [])).toEqual(true);
        });
        test('one tag matches of several', () => {
            const tagDescription = {
                ResourceArn: 'arn:whatever',
                Tags: [{ Key: 'some', Value: 'tag' }],
            };
            const requiredTags = [
                { key: 'some', value: 'tag' },
                { key: 'other', value: 'value' },
            ];
            expect(load_balancers_1.tagsMatch(tagDescription, requiredTags)).toEqual(false);
        });
        test('undefined tag does not error', () => {
            const tagDescription = {
                ResourceArn: 'arn:whatever',
                Tags: [{ Key: 'some' }],
            };
            const requiredTags = [
                { key: 'some', value: 'tag' },
                { key: 'other', value: 'value' },
            ];
            expect(load_balancers_1.tagsMatch(tagDescription, requiredTags)).toEqual(false);
        });
    });
});
describe('load balancer context provider plugin', () => {
    test('errors when no matches are found', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        mockALBLookup({
            loadBalancers: [],
        });
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer1',
        })).rejects.toThrow(/No load balancers found/i);
    });
    test('errors when multiple load balancers match', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        mockALBLookup({
            loadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns1.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
            describeTagsExpected: { ResourceArns: ['arn:load-balancer1', 'arn:load-balancer2'] },
            tagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [
                        { Key: 'some', Value: 'tag' },
                    ],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [
                        { Key: 'some', Value: 'tag' },
                    ],
                },
            ],
        });
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerTags: [
                { key: 'some', value: 'tag' },
            ],
        })).rejects.toThrow(/Multiple load balancers found/i);
    });
    test('looks up by arn', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        mockALBLookup({
            describeLoadBalancersExpected: { LoadBalancerArns: ['arn:load-balancer1'] },
            loadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
        });
        // WHEN
        const result = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer1',
        });
        // THEN
        expect(result.ipAddressType).toEqual('ipv4');
        expect(result.loadBalancerArn).toEqual('arn:load-balancer1');
        expect(result.loadBalancerCanonicalHostedZoneId).toEqual('Z1234');
        expect(result.loadBalancerDnsName).toEqual('dns.example.com');
        expect(result.securityGroupIds).toEqual(['sg-1234']);
        expect(result.vpcId).toEqual('vpc-1234');
    });
    test('looks up by tags', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        mockALBLookup({
            loadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns1.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
            describeTagsExpected: { ResourceArns: ['arn:load-balancer1', 'arn:load-balancer2'] },
            tagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [
                        { Key: 'some', Value: 'tag' },
                    ],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [
                        { Key: 'some', Value: 'tag' },
                        { Key: 'second', Value: 'tag2' },
                    ],
                },
            ],
        });
        // WHEN
        const result = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerTags: [
                { key: 'some', value: 'tag' },
                { key: 'second', value: 'tag2' },
            ],
        });
        expect(result.loadBalancerArn).toEqual('arn:load-balancer2');
    });
    test('filters by type', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        mockALBLookup({
            loadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    Type: 'network',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns1.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                },
                {
                    IpAddressType: 'ipv4',
                    Type: 'application',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                },
            ],
            tagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        });
        // WHEN
        const loadBalancer = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
        });
        expect(loadBalancer.loadBalancerArn).toEqual('arn:load-balancer2');
    });
});
describe('load balancer listener context provider plugin', () => {
    test('errors when no associated load balancers match', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            loadBalancers: [],
        });
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
        })).rejects.toThrow(/No associated load balancers found/i);
    });
    test('errors when no listeners match', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            loadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    Type: 'application',
                },
            ],
            listeners: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    ListenerArn: 'arn:listener',
                    Port: 80,
                    Protocol: 'HTTP',
                },
            ],
        });
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer',
            listenerPort: 443,
            listenerProtocol: cxschema.LoadBalancerListenerProtocol.HTTPS,
        })).rejects.toThrow(/No load balancer listeners found/i);
    });
    test('errors when multiple listeners match', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            loadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    Type: 'application',
                },
                {
                    LoadBalancerArn: 'arn:load-balancer2',
                    Type: 'application',
                },
            ],
            tagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
            listeners: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    ListenerArn: 'arn:listener',
                    Port: 80,
                    Protocol: 'HTTP',
                },
                {
                    LoadBalancerArn: 'arn:load-balancer2',
                    ListenerArn: 'arn:listener2',
                    Port: 80,
                    Protocol: 'HTTP',
                },
            ],
        });
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            listenerPort: 80,
            listenerProtocol: cxschema.LoadBalancerListenerProtocol.HTTP,
        })).rejects.toThrow(/Multiple load balancer listeners/i);
    });
    test('looks up by listener arn', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            describeListenersExpected: { ListenerArns: ['arn:listener-arn'] },
            listeners: [
                {
                    ListenerArn: 'arn:listener-arn',
                    LoadBalancerArn: 'arn:load-balancer-arn',
                    Port: 999,
                },
            ],
            describeLoadBalancersExpected: { LoadBalancerArns: ['arn:load-balancer-arn'] },
            loadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer-arn',
                    SecurityGroups: ['sg-1234', 'sg-2345'],
                    Type: 'application',
                },
            ],
        });
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            listenerArn: 'arn:listener-arn',
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn');
        expect(listener.listenerPort).toEqual(999);
        expect(listener.securityGroupIds).toEqual(['sg-1234', 'sg-2345']);
    });
    test('looks up by associated load balancer arn', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            describeLoadBalancersExpected: { LoadBalancerArns: ['arn:load-balancer-arn1'] },
            loadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: ['sg-1234'],
                    Type: 'application',
                },
            ],
            describeListenersExpected: { LoadBalancerArn: 'arn:load-balancer-arn1' },
            listeners: [
                {
                    // This one
                    ListenerArn: 'arn:listener-arn1',
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    Port: 80,
                },
            ],
        });
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer-arn1',
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn1');
        expect(listener.listenerPort).toEqual(80);
        expect(listener.securityGroupIds).toEqual(['sg-1234']);
    });
    test('looks up by associated load balancer tags', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            describeLoadBalancersExpected: { LoadBalancerArns: undefined },
            loadBalancers: [
                {
                    // This one should have the wrong tags
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: ['sg-1234', 'sg-2345'],
                    Type: 'application',
                },
                {
                    // Expecting this one
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    SecurityGroups: ['sg-3456', 'sg-4567'],
                    Type: 'application',
                },
            ],
            describeTagsExpected: { ResourceArns: ['arn:load-balancer-arn1', 'arn:load-balancer-arn2'] },
            tagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer-arn1',
                    Tags: [],
                },
                {
                    // Expecting this one
                    ResourceArn: 'arn:load-balancer-arn2',
                    Tags: [
                        { Key: 'some', Value: 'tag' },
                    ],
                },
            ],
            describeListenersExpected: { LoadBalancerArn: 'arn:load-balancer-arn2' },
            listeners: [
                {
                    // This one
                    ListenerArn: 'arn:listener-arn1',
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    Port: 80,
                },
                {
                    ListenerArn: 'arn:listener-arn2',
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    Port: 999,
                },
            ],
        });
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerTags: [
                { key: 'some', value: 'tag' },
            ],
            listenerPort: 999,
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn2');
        expect(listener.listenerPort).toEqual(999);
        expect(listener.securityGroupIds).toEqual(['sg-3456', 'sg-4567']);
    });
    test('looks up by listener port and proto', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        AWS.mock('ELBv2', 'describeLoadBalancers', (_params, cb) => {
            expect(_params).toEqual({});
            cb(null, {
                LoadBalancers: [
                    {
                        // Shouldn't have any matching listeners
                        IpAddressType: 'ipv4',
                        LoadBalancerArn: 'arn:load-balancer1',
                        DNSName: 'dns1.example.com',
                        CanonicalHostedZoneId: 'Z1234',
                        SecurityGroups: ['sg-1234'],
                        VpcId: 'vpc-1234',
                        Type: 'application',
                    },
                    {
                        // Should have a matching listener
                        IpAddressType: 'ipv4',
                        LoadBalancerArn: 'arn:load-balancer2',
                        DNSName: 'dns2.example.com',
                        CanonicalHostedZoneId: 'Z1234',
                        SecurityGroups: ['sg-2345'],
                        VpcId: 'vpc-1234',
                        Type: 'application',
                    },
                ],
            });
        });
        AWS.mock('ELBv2', 'describeTags', (_params, cb) => {
            cb(null, {
                TagDescriptions: [
                    {
                        ResourceArn: 'arn:load-balancer1',
                        Tags: [{ Key: 'some', Value: 'tag' }],
                    },
                    {
                        ResourceArn: 'arn:load-balancer2',
                        Tags: [{ Key: 'some', Value: 'tag' }],
                    },
                ],
            });
        });
        AWS.mock('ELBv2', 'describeListeners', (params, cb) => {
            if (params.LoadBalancerArn === 'arn:load-balancer1') {
                cb(null, {
                    Listeners: [
                        {
                            // Wrong port, wrong protocol => no match
                            ListenerArn: 'arn:listener-arn1',
                            LoadBalancerArn: 'arn:load-balancer1',
                            Protocol: 'HTTP',
                            Port: 80,
                        },
                        {
                            // Wrong protocol, right port => no match
                            ListenerArn: 'arn:listener-arn3',
                            LoadBalancerArn: 'arn:load-balancer1',
                            Protocol: 'HTTPS',
                            Port: 443,
                        },
                        {
                            // Wrong port, right protocol => no match
                            ListenerArn: 'arn:listener-arn4',
                            LoadBalancerArn: 'arn:load-balancer1',
                            Protocol: 'TCP',
                            Port: 999,
                        },
                    ],
                });
            }
            else if (params.LoadBalancerArn === 'arn:load-balancer2') {
                cb(null, {
                    Listeners: [
                        {
                            // Wrong port, wrong protocol => no match
                            ListenerArn: 'arn:listener-arn5',
                            LoadBalancerArn: 'arn:load-balancer2',
                            Protocol: 'HTTP',
                            Port: 80,
                        },
                        {
                            // Right port, right protocol => match
                            ListenerArn: 'arn:listener-arn6',
                            LoadBalancerArn: 'arn:load-balancer2',
                            Port: 443,
                            Protocol: 'TCP',
                        },
                    ],
                });
            }
            else {
                cb(new Error(`Unexpected request: ${JSON.stringify(params)}'`), {});
            }
        });
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            listenerProtocol: cxschema.LoadBalancerListenerProtocol.TCP,
            listenerPort: 443,
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn6');
        expect(listener.listenerPort).toEqual(443);
        expect(listener.securityGroupIds).toEqual(['sg-2345']);
    });
    test('filters by associated load balancer type', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            describeLoadBalancersExpected: { LoadBalancerArns: undefined },
            loadBalancers: [
                {
                    // This one has wrong type => no match
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: [],
                    Type: 'application',
                },
                {
                    // Right type => match
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    SecurityGroups: [],
                    Type: 'network',
                },
            ],
            tagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer-arn1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer-arn2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
            describeListenersExpected: { LoadBalancerArn: 'arn:load-balancer-arn2' },
            listeners: [
                {
                    ListenerArn: 'arn:listener-arn2',
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    Port: 443,
                },
            ],
        });
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.NETWORK,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            listenerPort: 443,
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn2');
        expect(listener.listenerPort).toEqual(443);
    });
    test('errors when associated load balancer is wrong type', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        mockALBLookup({
            describeListenersExpected: { ListenerArns: ['arn:listener-arn1'] },
            listeners: [
                {
                    ListenerArn: 'arn:listener-arn1',
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    Port: 443,
                },
            ],
            describeLoadBalancersExpected: { LoadBalancerArns: ['arn:load-balancer-arn1'] },
            loadBalancers: [
                {
                    // This one has wrong type => no match
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: [],
                    Type: 'application',
                },
            ],
        });
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cxschema.LoadBalancerType.NETWORK,
            listenerArn: 'arn:listener-arn1',
        })).rejects.toThrow(/no associated load balancer found/i);
    });
});
function mockALBLookup(options) {
    AWS.mock('ELBv2', 'describeLoadBalancers', (_params, cb) => {
        if (options.describeLoadBalancersExpected !== undefined) {
            expect(_params).toEqual(options.describeLoadBalancersExpected);
        }
        cb(null, { LoadBalancers: options.loadBalancers });
    });
    AWS.mock('ELBv2', 'describeTags', (_params, cb) => {
        if (options.describeTagsExpected !== undefined) {
            expect(_params).toEqual(options.describeTagsExpected);
        }
        cb(null, { TagDescriptions: options.tagDescriptions });
    });
    AWS.mock('ELBv2', 'describeListeners', (_params, cb) => {
        if (options.describeListenersExpected !== undefined) {
            expect(_params).toEqual(options.describeListenersExpected);
        }
        cb(null, { Listeners: options.listeners });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1iYWxhbmNlcnMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxvYWQtYmFsYW5jZXJzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyREFBMkQ7QUFFM0Qsb0NBQW9DO0FBQ3BDLCtFQUE4TjtBQUM5TiwrQ0FBbUQ7QUFFbkQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFFdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSwwQkFBZSxFQUFFLENBQUM7QUFJdEMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQ2YsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2QsSUFBSSxFQUFFLENBQUM7QUFDVCxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO0lBQ3pCLElBQUksQ0FBQyxtQ0FBbUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNuRCxNQUFNLFlBQVksR0FBNkMsRUFBRSxDQUFDO1FBQ2xFLEtBQUssTUFBTSxXQUFXLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ2pGLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRztnQkFDMUIsV0FBVyxFQUFFLFdBQVc7Z0JBQ3hCLElBQUksRUFBRTtvQkFDSixFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRTtpQkFDcEM7YUFDRixDQUFDO1NBQ0g7UUFBQSxDQUFDO1FBRUYsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFLENBQUMsT0FBb0MsRUFBRSxFQUE2QyxFQUFFLEVBQUU7WUFDeEgsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsTUFB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QUFFLENBQUMsQ0FBQztJQUNyRCxDQUFDLENBQUMsQ0FBQztJQUVILEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRSxDQUFDLE9BQW9DLEVBQUUsRUFBNkMsRUFBRSxFQUFFO1FBQ3hILElBQUksT0FBTyxDQUFDLG9CQUFvQixLQUFLLFNBQVMsRUFBRTtZQUM5QyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ3ZEO1FBQ0QsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUMsQ0FBQztJQUVILEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLENBQUMsT0FBeUMsRUFBRSxFQUFrRCxFQUFFLEVBQUU7UUFDdkksSUFBSSxPQUFPLENBQUMseUJBQXlCLEtBQUssU0FBUyxFQUFFO1lBQ25ELE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHlCQUF5QixDQUFDLENBQUM7U0FDNUQ7UUFDRCxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzdDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGN4c2NoZW1hIGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgKiBhcyBhd3MgZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgKiBhcyBBV1MgZnJvbSAnYXdzLXNkay1tb2NrJztcbmltcG9ydCB7IExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luLCBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4sIHRhZ3NNYXRjaCwgZGVzY3JpYmVMaXN0ZW5lcnNCeUxvYWRCYWxhbmNlckFybiwgZGVzY3JpYmVUYWdzLCBkZXNjcmliZUxvYWRCYWxhbmNlcnMgfSBmcm9tICcuLi8uLi9saWIvY29udGV4dC1wcm92aWRlcnMvbG9hZC1iYWxhbmNlcnMnO1xuaW1wb3J0IHsgTW9ja1Nka1Byb3ZpZGVyIH0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5cbkFXUy5zZXRTREsocmVxdWlyZS5yZXNvbHZlKCdhd3Mtc2RrJykpO1xuXG5jb25zdCBtb2NrU0RLID0gbmV3IE1vY2tTZGtQcm92aWRlcigpO1xuXG50eXBlIEF3c0NhbGxiYWNrPFQ+ID0gKGVycjogRXJyb3IgfCBudWxsLCB2YWw6IFQpID0+IHZvaWQ7XG5cbmFmdGVyRWFjaChkb25lID0+IHtcbiAgQVdTLnJlc3RvcmUoKTtcbiAgZG9uZSgpO1xufSk7XG5cbmRlc2NyaWJlKCd1dGlsaXRpZXMnLCAoKSA9PiB7XG4gIHRlc3QoJ2Rlc2NyaWJlVGFncyB5aWVsZHMgdGFncyBieSBjaHVuaycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByZXNvdXJjZVRhZ3M6IFJlY29yZDxzdHJpbmcsIGF3cy5FTEJ2Mi5UYWdEZXNjcmlwdGlvbj4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IHJlc291cmNlQXJuIG9mIFsuLi5BcnJheSgxMDApXS5tYXAoKF8sIGkpID0+IGBhcm46bG9hZC1iYWxhbmNlci0ke2l9YCkpIHtcbiAgICAgIHJlc291cmNlVGFnc1tyZXNvdXJjZUFybl0gPSB7XG4gICAgICAgIFJlc291cmNlQXJuOiByZXNvdXJjZUFybixcbiAgICAgICAgVGFnczogW1xuICAgICAgICAgIHsgS2V5OiAnbmFtZScsIFZhbHVlOiByZXNvdXJjZUFybiB9LFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgQVdTLm1vY2soJ0VMQnYyJywgJ2Rlc2NyaWJlVGFncycsIChfcGFyYW1zOiBhd3MuRUxCdjIuRGVzY3JpYmVUYWdzSW5wdXQsIGNiOiBBd3NDYWxsYmFjazxhd3MuRUxCdjIuRGVzY3JpYmVUYWdzT3V0cHV0PikgPT4ge1xuICAgICAgZXhwZWN0KF9wYXJhbXMuUmVzb3VyY2VBcm5zLmxlbmd0aCkudG9CZUxlc3NUaGFuT3JFcXVhbCgyMCk7XG5cbiAgICAgIGNiKG51bGwsIHtcbiAgICAgICAgVGFnRGVzY3JpcHRpb25zOiBfcGFyYW1zLlJlc291cmNlQXJucy5tYXAocmVzb3VyY2VBcm4gPT4gKHtcbiAgICAgICAgICBSZXNvdXJjZUFybjogcmVzb3VyY2VBcm4sXG4gICAgICAgICAgVGFnczogW1xuICAgICAgICAgICAgeyBLZXk6ICduYW1lJywgVmFsdWU6IHJlc291cmNlQXJuIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSkpLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBlbGJ2MiA9IGF3YWl0IChhd2FpdCBtb2NrU0RLLmZvckVudmlyb25tZW50KCkpLmVsYnYyKCk7XG5cbiAgICBjb25zdCByZXNvdXJjZVRhZ3NPdXQ6IFJlY29yZDxzdHJpbmcsIGF3cy5FTEJ2Mi5UYWdEZXNjcmlwdGlvbj4gPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHRhZ0Rlc2NyaXB0aW9uIG9mIGRlc2NyaWJlVGFncyhlbGJ2MiwgT2JqZWN0LmtleXMocmVzb3VyY2VUYWdzKSkpIHtcbiAgICAgIHJlc291cmNlVGFnc091dFt0YWdEZXNjcmlwdGlvbi5SZXNvdXJjZUFybiFdID0gdGFnRGVzY3JpcHRpb247XG4gICAgfVxuXG4gICAgZXhwZWN0KHJlc291cmNlVGFnc091dCkudG9FcXVhbChyZXNvdXJjZVRhZ3MpO1xuICB9KTtcblxuICB0ZXN0KCdkZXNjcmliZUxpc3RlbmVyc0J5TG9hZEJhbGFuY2VyQXJuIHRyYXZlcnNlcyBwYWdlcycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBhcm46bGlzdGVuZXItMCwgYXJuOmxpc3RlbmVyLTEsIC4uLiwgYXJuOmxpc3RlbmVyLTk5XG4gICAgY29uc3QgbGlzdGVuZXJBcm5zID0gWy4uLkFycmF5KDEwMCldLm1hcCgoXywgaSkgPT4gYGFybjpsaXN0ZW5lci0ke2l9YCk7XG4gICAgZXhwZWN0KGxpc3RlbmVyQXJuc1swXSkudG9FcXVhbCgnYXJuOmxpc3RlbmVyLTAnKTtcblxuICAgIEFXUy5tb2NrKCdFTEJ2MicsICdkZXNjcmliZUxpc3RlbmVycycsIChfcGFyYW1zOiBhd3MuRUxCdjIuRGVzY3JpYmVMaXN0ZW5lcnNJbnB1dCwgY2I6IEF3c0NhbGxiYWNrPGF3cy5FTEJ2Mi5EZXNjcmliZUxpc3RlbmVyc091dHB1dD4pID0+IHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gcGFyc2VJbnQoX3BhcmFtcy5NYXJrZXIgPz8gJzAnKTtcbiAgICAgIGNvbnN0IGVuZCA9IHN0YXJ0ICsgMTA7XG4gICAgICBjb25zdCBzbGljZSA9IGxpc3RlbmVyQXJucy5zbGljZShzdGFydCwgZW5kKTtcblxuICAgICAgY2IobnVsbCwge1xuICAgICAgICBMaXN0ZW5lcnM6IHNsaWNlLm1hcChhcm4gPT4gKHtcbiAgICAgICAgICBMaXN0ZW5lckFybjogYXJuLFxuICAgICAgICB9KSksXG4gICAgICAgIE5leHRNYXJrZXI6IGVuZCA8IGxpc3RlbmVyQXJucy5sZW5ndGggPyBlbmQudG9TdHJpbmcoKSA6IHVuZGVmaW5lZCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZWxidjIgPSBhd2FpdCAoYXdhaXQgbW9ja1NESy5mb3JFbnZpcm9ubWVudCgpKS5lbGJ2MigpO1xuXG4gICAgY29uc3QgbGlzdGVuZXJBcm5zRnJvbVBhZ2VzID0gQXJyYXk8c3RyaW5nPigpO1xuICAgIGZvciBhd2FpdCAoY29uc3QgbGlzdGVuZXIgb2YgZGVzY3JpYmVMaXN0ZW5lcnNCeUxvYWRCYWxhbmNlckFybihlbGJ2MiwgWydhcm46bG9hZC1iYWxhbmNlciddKSkge1xuICAgICAgbGlzdGVuZXJBcm5zRnJvbVBhZ2VzLnB1c2gobGlzdGVuZXIuTGlzdGVuZXJBcm4hKTtcbiAgICB9XG5cbiAgICBleHBlY3QobGlzdGVuZXJBcm5zRnJvbVBhZ2VzKS50b0VxdWFsKGxpc3RlbmVyQXJucyk7XG4gIH0pO1xuXG4gIHRlc3QoJ2Rlc2NyaWJlTG9hZEJhbGFuY2VycyB0cmF2ZXJzZXMgcGFnZXMnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbG9hZEJhbGFuY2VyQXJucyA9IFsuLi5BcnJheSgxMDApXS5tYXAoKF8sIGkpID0+IGBhcm46bG9hZC1iYWxhbmNlci0ke2l9YCk7XG4gICAgZXhwZWN0KGxvYWRCYWxhbmNlckFybnNbMF0pLnRvRXF1YWwoJ2Fybjpsb2FkLWJhbGFuY2VyLTAnKTtcblxuICAgIEFXUy5tb2NrKCdFTEJ2MicsICdkZXNjcmliZUxvYWRCYWxhbmNlcnMnLCAoX3BhcmFtczogYXdzLkVMQnYyLkRlc2NyaWJlTG9hZEJhbGFuY2Vyc0lucHV0LCBjYjogQXdzQ2FsbGJhY2s8YXdzLkVMQnYyLkRlc2NyaWJlTG9hZEJhbGFuY2Vyc091dHB1dD4pID0+IHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gcGFyc2VJbnQoX3BhcmFtcy5NYXJrZXIgPz8gJzAnKTtcbiAgICAgIGNvbnN0IGVuZCA9IHN0YXJ0ICsgMTA7XG4gICAgICBjb25zdCBzbGljZSA9IGxvYWRCYWxhbmNlckFybnMuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cbiAgICAgIGNiKG51bGwsIHtcbiAgICAgICAgTG9hZEJhbGFuY2Vyczogc2xpY2UubWFwKGxvYWRCYWxhbmNlckFybiA9PiAoe1xuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogbG9hZEJhbGFuY2VyQXJuLFxuICAgICAgICB9KSksXG4gICAgICAgIE5leHRNYXJrZXI6IGVuZCA8IGxvYWRCYWxhbmNlckFybnMubGVuZ3RoID8gZW5kLnRvU3RyaW5nKCkgOiB1bmRlZmluZWQsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGVsYnYyID0gYXdhaXQgKGF3YWl0IG1vY2tTREsuZm9yRW52aXJvbm1lbnQoKSkuZWxidjIoKTtcbiAgICBjb25zdCBsb2FkQmFsYW5jZXJBcm5zRnJvbVBhZ2VzID0gKGF3YWl0IGRlc2NyaWJlTG9hZEJhbGFuY2VycyhlbGJ2Miwge30pKS5tYXAobCA9PiBsLkxvYWRCYWxhbmNlckFybiEpO1xuXG4gICAgZXhwZWN0KGxvYWRCYWxhbmNlckFybnNGcm9tUGFnZXMpLnRvRXF1YWwobG9hZEJhbGFuY2VyQXJucyk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCd0YWdzTWF0Y2gnLCAoKSA9PiB7XG4gICAgdGVzdCgnYWxsIHRhZ3MgbWF0Y2gnLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YWdEZXNjcmlwdGlvbiA9IHtcbiAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46d2hhdGV2ZXInLFxuICAgICAgICBUYWdzOiBbeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH1dLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgcmVxdWlyZWRUYWdzID0gW1xuICAgICAgICB7IGtleTogJ3NvbWUnLCB2YWx1ZTogJ3RhZycgfSxcbiAgICAgIF07XG5cbiAgICAgIGV4cGVjdCh0YWdzTWF0Y2godGFnRGVzY3JpcHRpb24sIHJlcXVpcmVkVGFncykpLnRvRXF1YWwodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdleHRyYSB0YWdzIG1hdGNoJywgKCkgPT4ge1xuICAgICAgY29uc3QgdGFnRGVzY3JpcHRpb24gPSB7XG4gICAgICAgIFJlc291cmNlQXJuOiAnYXJuOndoYXRldmVyJyxcbiAgICAgICAgVGFnczogW1xuICAgICAgICAgIHsgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9LFxuICAgICAgICAgIHsgS2V5OiAnb3RoZXInLCBWYWx1ZTogJ3RhZzInIH0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuXG4gICAgICBjb25zdCByZXF1aXJlZFRhZ3MgPSBbXG4gICAgICAgIHsga2V5OiAnc29tZScsIHZhbHVlOiAndGFnJyB9LFxuICAgICAgXTtcblxuICAgICAgZXhwZWN0KHRhZ3NNYXRjaCh0YWdEZXNjcmlwdGlvbiwgcmVxdWlyZWRUYWdzKSkudG9FcXVhbCh0cnVlKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ25vIHRhZ3MgbWF0Y2hlcyBubyB0YWdzJywgKCkgPT4ge1xuICAgICAgY29uc3QgdGFnRGVzY3JpcHRpb24gPSB7XG4gICAgICAgIFJlc291cmNlQXJuOiAnYXJuOndoYXRldmVyJyxcbiAgICAgICAgVGFnczogW10sXG4gICAgICB9O1xuXG4gICAgICBleHBlY3QodGFnc01hdGNoKHRhZ0Rlc2NyaXB0aW9uLCBbXSkpLnRvRXF1YWwodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdvbmUgdGFnIG1hdGNoZXMgb2Ygc2V2ZXJhbCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHRhZ0Rlc2NyaXB0aW9uID0ge1xuICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjp3aGF0ZXZlcicsXG4gICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICB9O1xuXG4gICAgICBjb25zdCByZXF1aXJlZFRhZ3MgPSBbXG4gICAgICAgIHsga2V5OiAnc29tZScsIHZhbHVlOiAndGFnJyB9LFxuICAgICAgICB7IGtleTogJ290aGVyJywgdmFsdWU6ICd2YWx1ZScgfSxcbiAgICAgIF07XG5cbiAgICAgIGV4cGVjdCh0YWdzTWF0Y2godGFnRGVzY3JpcHRpb24sIHJlcXVpcmVkVGFncykpLnRvRXF1YWwoZmFsc2UpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndW5kZWZpbmVkIHRhZyBkb2VzIG5vdCBlcnJvcicsICgpID0+IHtcbiAgICAgIGNvbnN0IHRhZ0Rlc2NyaXB0aW9uID0ge1xuICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjp3aGF0ZXZlcicsXG4gICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnIH1dLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgcmVxdWlyZWRUYWdzID0gW1xuICAgICAgICB7IGtleTogJ3NvbWUnLCB2YWx1ZTogJ3RhZycgfSxcbiAgICAgICAgeyBrZXk6ICdvdGhlcicsIHZhbHVlOiAndmFsdWUnIH0sXG4gICAgICBdO1xuXG4gICAgICBleHBlY3QodGFnc01hdGNoKHRhZ0Rlc2NyaXB0aW9uLCByZXF1aXJlZFRhZ3MpKS50b0VxdWFsKGZhbHNlKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ2xvYWQgYmFsYW5jZXIgY29udGV4dCBwcm92aWRlciBwbHVnaW4nLCAoKSA9PiB7XG4gIHRlc3QoJ2Vycm9ycyB3aGVuIG5vIG1hdGNoZXMgYXJlIGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgbW9ja0FMQkxvb2t1cCh7XG4gICAgICBsb2FkQmFsYW5jZXJzOiBbXSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBleHBlY3QoXG4gICAgICBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgbG9hZEJhbGFuY2VyVHlwZTogY3hzY2hlbWEuTG9hZEJhbGFuY2VyVHlwZS5BUFBMSUNBVElPTixcbiAgICAgICAgbG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KC9ObyBsb2FkIGJhbGFuY2VycyBmb3VuZC9pKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gbXVsdGlwbGUgbG9hZCBiYWxhbmNlcnMgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICBtb2NrQUxCTG9va3VwKHtcbiAgICAgIGxvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIElwQWRkcmVzc1R5cGU6ICdpcHY0JyxcbiAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgIEROU05hbWU6ICdkbnMxLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCddLFxuICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBJcEFkZHJlc3NUeXBlOiAnaXB2NCcsXG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICBETlNOYW1lOiAnZG5zMi5leGFtcGxlLmNvbScsXG4gICAgICAgICAgQ2Fub25pY2FsSG9zdGVkWm9uZUlkOiAnWjEyMzQnLFxuICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTEyMzQnXSxcbiAgICAgICAgICBWcGNJZDogJ3ZwYy0xMjM0JyxcbiAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGRlc2NyaWJlVGFnc0V4cGVjdGVkOiB7IFJlc291cmNlQXJuczogWydhcm46bG9hZC1iYWxhbmNlcjEnLCAnYXJuOmxvYWQtYmFsYW5jZXIyJ10gfSxcbiAgICAgIHRhZ0Rlc2NyaXB0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgIFRhZ3M6IFtcbiAgICAgICAgICAgIHsgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMicsXG4gICAgICAgICAgVGFnczogW1xuICAgICAgICAgICAgeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICAgIGxvYWRCYWxhbmNlclR5cGU6IGN4c2NoZW1hLkxvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICAgIGxvYWRCYWxhbmNlclRhZ3M6IFtcbiAgICAgICAgICB7IGtleTogJ3NvbWUnLCB2YWx1ZTogJ3RhZycgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KC9NdWx0aXBsZSBsb2FkIGJhbGFuY2VycyBmb3VuZC9pKTtcbiAgfSk7XG5cbiAgdGVzdCgnbG9va3MgdXAgYnkgYXJuJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgbW9ja0FMQkxvb2t1cCh7XG4gICAgICBkZXNjcmliZUxvYWRCYWxhbmNlcnNFeHBlY3RlZDogeyBMb2FkQmFsYW5jZXJBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyMSddIH0sXG4gICAgICBsb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBJcEFkZHJlc3NUeXBlOiAnaXB2NCcsXG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICBETlNOYW1lOiAnZG5zLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCddLFxuICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBsb2FkQmFsYW5jZXJUeXBlOiBjeHNjaGVtYS5Mb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgbG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QocmVzdWx0LmlwQWRkcmVzc1R5cGUpLnRvRXF1YWwoJ2lwdjQnKTtcbiAgICBleHBlY3QocmVzdWx0LmxvYWRCYWxhbmNlckFybikudG9FcXVhbCgnYXJuOmxvYWQtYmFsYW5jZXIxJyk7XG4gICAgZXhwZWN0KHJlc3VsdC5sb2FkQmFsYW5jZXJDYW5vbmljYWxIb3N0ZWRab25lSWQpLnRvRXF1YWwoJ1oxMjM0Jyk7XG4gICAgZXhwZWN0KHJlc3VsdC5sb2FkQmFsYW5jZXJEbnNOYW1lKS50b0VxdWFsKCdkbnMuZXhhbXBsZS5jb20nKTtcbiAgICBleHBlY3QocmVzdWx0LnNlY3VyaXR5R3JvdXBJZHMpLnRvRXF1YWwoWydzZy0xMjM0J10pO1xuICAgIGV4cGVjdChyZXN1bHQudnBjSWQpLnRvRXF1YWwoJ3ZwYy0xMjM0Jyk7XG4gIH0pO1xuXG4gIHRlc3QoJ2xvb2tzIHVwIGJ5IHRhZ3MnLCBhc3luYygpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIG1vY2tBTEJMb29rdXAoe1xuICAgICAgbG9hZEJhbGFuY2VyczogW1xuICAgICAgICB7XG4gICAgICAgICAgSXBBZGRyZXNzVHlwZTogJ2lwdjQnLFxuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgICAgICAgRE5TTmFtZTogJ2RuczEuZXhhbXBsZS5jb20nLFxuICAgICAgICAgIENhbm9uaWNhbEhvc3RlZFpvbmVJZDogJ1oxMjM0JyxcbiAgICAgICAgICBTZWN1cml0eUdyb3VwczogWydzZy0xMjM0J10sXG4gICAgICAgICAgVnBjSWQ6ICd2cGMtMTIzNCcsXG4gICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIElwQWRkcmVzc1R5cGU6ICdpcHY0JyxcbiAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgIEROU05hbWU6ICdkbnMyLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCddLFxuICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgZGVzY3JpYmVUYWdzRXhwZWN0ZWQ6IHsgUmVzb3VyY2VBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyMScsICdhcm46bG9hZC1iYWxhbmNlcjInXSB9LFxuICAgICAgdGFnRGVzY3JpcHRpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgICAgICAgVGFnczogW1xuICAgICAgICAgICAgeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICBUYWdzOiBbXG4gICAgICAgICAgICB7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfSxcbiAgICAgICAgICAgIHsgS2V5OiAnc2Vjb25kJywgVmFsdWU6ICd0YWcyJyB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBsb2FkQmFsYW5jZXJUeXBlOiBjeHNjaGVtYS5Mb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgbG9hZEJhbGFuY2VyVGFnczogW1xuICAgICAgICB7IGtleTogJ3NvbWUnLCB2YWx1ZTogJ3RhZycgfSxcbiAgICAgICAgeyBrZXk6ICdzZWNvbmQnLCB2YWx1ZTogJ3RhZzInIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgZXhwZWN0KHJlc3VsdC5sb2FkQmFsYW5jZXJBcm4pLnRvRXF1YWwoJ2Fybjpsb2FkLWJhbGFuY2VyMicpO1xuICB9KTtcblxuICB0ZXN0KCdmaWx0ZXJzIGJ5IHR5cGUnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICBtb2NrQUxCTG9va3VwKHtcbiAgICAgIGxvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIElwQWRkcmVzc1R5cGU6ICdpcHY0JyxcbiAgICAgICAgICBUeXBlOiAnbmV0d29yaycsXG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICBETlNOYW1lOiAnZG5zMS5leGFtcGxlLmNvbScsXG4gICAgICAgICAgQ2Fub25pY2FsSG9zdGVkWm9uZUlkOiAnWjEyMzQnLFxuICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTEyMzQnXSxcbiAgICAgICAgICBWcGNJZDogJ3ZwYy0xMjM0JyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIElwQWRkcmVzc1R5cGU6ICdpcHY0JyxcbiAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMicsXG4gICAgICAgICAgRE5TTmFtZTogJ2RuczIuZXhhbXBsZS5jb20nLFxuICAgICAgICAgIENhbm9uaWNhbEhvc3RlZFpvbmVJZDogJ1oxMjM0JyxcbiAgICAgICAgICBTZWN1cml0eUdyb3VwczogWydzZy0xMjM0J10sXG4gICAgICAgICAgVnBjSWQ6ICd2cGMtMTIzNCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuXG4gICAgICB0YWdEZXNjcmlwdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGxvYWRCYWxhbmNlciA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBsb2FkQmFsYW5jZXJUYWdzOiBbeyBrZXk6ICdzb21lJywgdmFsdWU6ICd0YWcnIH1dLFxuICAgICAgbG9hZEJhbGFuY2VyVHlwZTogY3hzY2hlbWEuTG9hZEJhbGFuY2VyVHlwZS5BUFBMSUNBVElPTixcbiAgICB9KTtcblxuICAgIGV4cGVjdChsb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyQXJuKS50b0VxdWFsKCdhcm46bG9hZC1iYWxhbmNlcjInKTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ2xvYWQgYmFsYW5jZXIgbGlzdGVuZXIgY29udGV4dCBwcm92aWRlciBwbHVnaW4nLCAoKSA9PiB7XG4gIHRlc3QoJ2Vycm9ycyB3aGVuIG5vIGFzc29jaWF0ZWQgbG9hZCBiYWxhbmNlcnMgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIG1vY2tBTEJMb29rdXAoe1xuICAgICAgbG9hZEJhbGFuY2VyczogW10sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICAgIGxvYWRCYWxhbmNlclR5cGU6IGN4c2NoZW1hLkxvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICAgIGxvYWRCYWxhbmNlclRhZ3M6IFt7IGtleTogJ3NvbWUnLCB2YWx1ZTogJ3RhZycgfV0sXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdygvTm8gYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VycyBmb3VuZC9pKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gbm8gbGlzdGVuZXJzIG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICBtb2NrQUxCTG9va3VwKHtcbiAgICAgIGxvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyJyxcbiAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpc3RlbmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXInLFxuICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyJyxcbiAgICAgICAgICBQb3J0OiA4MCxcbiAgICAgICAgICBQcm90b2NvbDogJ0hUVFAnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBleHBlY3QoXG4gICAgICBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgbG9hZEJhbGFuY2VyVHlwZTogY3hzY2hlbWEuTG9hZEJhbGFuY2VyVHlwZS5BUFBMSUNBVElPTixcbiAgICAgICAgbG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXInLFxuICAgICAgICBsaXN0ZW5lclBvcnQ6IDQ0MyxcbiAgICAgICAgbGlzdGVuZXJQcm90b2NvbDogY3hzY2hlbWEuTG9hZEJhbGFuY2VyTGlzdGVuZXJQcm90b2NvbC5IVFRQUyxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KC9ObyBsb2FkIGJhbGFuY2VyIGxpc3RlbmVycyBmb3VuZC9pKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gbXVsdGlwbGUgbGlzdGVuZXJzIG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICBtb2NrQUxCTG9va3VwKHtcbiAgICAgIGxvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyJyxcbiAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHRhZ0Rlc2NyaXB0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcicsXG4gICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpc3RlbmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXInLFxuICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyJyxcbiAgICAgICAgICBQb3J0OiA4MCxcbiAgICAgICAgICBQcm90b2NvbDogJ0hUVFAnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lcjInLFxuICAgICAgICAgIFBvcnQ6IDgwLFxuICAgICAgICAgIFByb3RvY29sOiAnSFRUUCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChcbiAgICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICBsb2FkQmFsYW5jZXJUeXBlOiBjeHNjaGVtYS5Mb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgICBsb2FkQmFsYW5jZXJUYWdzOiBbeyBrZXk6ICdzb21lJywgdmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICBsaXN0ZW5lclBvcnQ6IDgwLFxuICAgICAgICBsaXN0ZW5lclByb3RvY29sOiBjeHNjaGVtYS5Mb2FkQmFsYW5jZXJMaXN0ZW5lclByb3RvY29sLkhUVFAsXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdygvTXVsdGlwbGUgbG9hZCBiYWxhbmNlciBsaXN0ZW5lcnMvaSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2xvb2tzIHVwIGJ5IGxpc3RlbmVyIGFybicsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgbW9ja0FMQkxvb2t1cCh7XG4gICAgICBkZXNjcmliZUxpc3RlbmVyc0V4cGVjdGVkOiB7IExpc3RlbmVyQXJuczogWydhcm46bGlzdGVuZXItYXJuJ10gfSxcbiAgICAgIGxpc3RlbmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuJyxcbiAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4nLFxuICAgICAgICAgIFBvcnQ6IDk5OSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBkZXNjcmliZUxvYWRCYWxhbmNlcnNFeHBlY3RlZDogeyBMb2FkQmFsYW5jZXJBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyLWFybiddIH0sXG4gICAgICBsb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4nLFxuICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTEyMzQnLCAnc2ctMjM0NSddLFxuICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGxpc3RlbmVyID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIGxvYWRCYWxhbmNlclR5cGU6IGN4c2NoZW1hLkxvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICBsaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4nLFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lckFybikudG9FcXVhbCgnYXJuOmxpc3RlbmVyLWFybicpO1xuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lclBvcnQpLnRvRXF1YWwoOTk5KTtcbiAgICBleHBlY3QobGlzdGVuZXIuc2VjdXJpdHlHcm91cElkcykudG9FcXVhbChbJ3NnLTEyMzQnLCAnc2ctMjM0NSddKTtcbiAgfSk7XG5cbiAgdGVzdCgnbG9va3MgdXAgYnkgYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIGFybicsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgbW9ja0FMQkxvb2t1cCh7XG4gICAgICBkZXNjcmliZUxvYWRCYWxhbmNlcnNFeHBlY3RlZDogeyBMb2FkQmFsYW5jZXJBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnXSB9LFxuICAgICAgbG9hZEJhbGFuY2VyczogW1xuICAgICAgICB7XG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsXG4gICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCddLFxuICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuXG4gICAgICBkZXNjcmliZUxpc3RlbmVyc0V4cGVjdGVkOiB7IExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnIH0sXG4gICAgICBsaXN0ZW5lcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIC8vIFRoaXMgb25lXG4gICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuMScsXG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsXG4gICAgICAgICAgUG9ydDogODAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGxpc3RlbmVyID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIGxvYWRCYWxhbmNlclR5cGU6IGN4c2NoZW1hLkxvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICBsb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4xJyxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QobGlzdGVuZXIubGlzdGVuZXJBcm4pLnRvRXF1YWwoJ2FybjpsaXN0ZW5lci1hcm4xJyk7XG4gICAgZXhwZWN0KGxpc3RlbmVyLmxpc3RlbmVyUG9ydCkudG9FcXVhbCg4MCk7XG4gICAgZXhwZWN0KGxpc3RlbmVyLnNlY3VyaXR5R3JvdXBJZHMpLnRvRXF1YWwoWydzZy0xMjM0J10pO1xuICB9KTtcblxuICB0ZXN0KCdsb29rcyB1cCBieSBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXIgdGFncycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgbW9ja0FMQkxvb2t1cCh7XG4gICAgICBkZXNjcmliZUxvYWRCYWxhbmNlcnNFeHBlY3RlZDogeyBMb2FkQmFsYW5jZXJBcm5zOiB1bmRlZmluZWQgfSxcbiAgICAgIGxvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIC8vIFRoaXMgb25lIHNob3VsZCBoYXZlIHRoZSB3cm9uZyB0YWdzXG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsXG4gICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCcsICdzZy0yMzQ1J10sXG4gICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIEV4cGVjdGluZyB0aGlzIG9uZVxuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjInLFxuICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTM0NTYnLCAnc2ctNDU2NyddLFxuICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuXG4gICAgICBkZXNjcmliZVRhZ3NFeHBlY3RlZDogeyBSZXNvdXJjZUFybnM6IFsnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsICdhcm46bG9hZC1iYWxhbmNlci1hcm4yJ10gfSxcbiAgICAgIHRhZ0Rlc2NyaXB0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4xJyxcbiAgICAgICAgICBUYWdzOiBbXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIEV4cGVjdGluZyB0aGlzIG9uZVxuICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMicsXG4gICAgICAgICAgVGFnczogW1xuICAgICAgICAgICAgeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG5cbiAgICAgIGRlc2NyaWJlTGlzdGVuZXJzRXhwZWN0ZWQ6IHsgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMicgfSxcbiAgICAgIGxpc3RlbmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgLy8gVGhpcyBvbmVcbiAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4xJyxcbiAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4yJyxcbiAgICAgICAgICBQb3J0OiA4MCxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyLWFybjInLFxuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjInLFxuICAgICAgICAgIFBvcnQ6IDk5OSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgbGlzdGVuZXIgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgbG9hZEJhbGFuY2VyVHlwZTogY3hzY2hlbWEuTG9hZEJhbGFuY2VyVHlwZS5BUFBMSUNBVElPTixcbiAgICAgIGxvYWRCYWxhbmNlclRhZ3M6IFtcbiAgICAgICAgeyBrZXk6ICdzb21lJywgdmFsdWU6ICd0YWcnIH0sXG4gICAgICBdLFxuICAgICAgbGlzdGVuZXJQb3J0OiA5OTksXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGxpc3RlbmVyLmxpc3RlbmVyQXJuKS50b0VxdWFsKCdhcm46bGlzdGVuZXItYXJuMicpO1xuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lclBvcnQpLnRvRXF1YWwoOTk5KTtcbiAgICBleHBlY3QobGlzdGVuZXIuc2VjdXJpdHlHcm91cElkcykudG9FcXVhbChbJ3NnLTM0NTYnLCAnc2ctNDU2NyddKTtcbiAgfSk7XG5cbiAgdGVzdCgnbG9va3MgdXAgYnkgbGlzdGVuZXIgcG9ydCBhbmQgcHJvdG8nLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIEFXUy5tb2NrKCdFTEJ2MicsICdkZXNjcmliZUxvYWRCYWxhbmNlcnMnLCAoX3BhcmFtczogYXdzLkVMQnYyLkRlc2NyaWJlTG9hZEJhbGFuY2Vyc0lucHV0LCBjYjogQXdzQ2FsbGJhY2s8YXdzLkVMQnYyLkRlc2NyaWJlTG9hZEJhbGFuY2Vyc091dHB1dD4pID0+IHtcbiAgICAgIGV4cGVjdChfcGFyYW1zKS50b0VxdWFsKHt9KTtcbiAgICAgIGNiKG51bGwsIHtcbiAgICAgICAgTG9hZEJhbGFuY2VyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFNob3VsZG4ndCBoYXZlIGFueSBtYXRjaGluZyBsaXN0ZW5lcnNcbiAgICAgICAgICAgIElwQWRkcmVzc1R5cGU6ICdpcHY0JyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgICAgICAgICBETlNOYW1lOiAnZG5zMS5leGFtcGxlLmNvbScsXG4gICAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgICBTZWN1cml0eUdyb3VwczogWydzZy0xMjM0J10sXG4gICAgICAgICAgICBWcGNJZDogJ3ZwYy0xMjM0JyxcbiAgICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBTaG91bGQgaGF2ZSBhIG1hdGNoaW5nIGxpc3RlbmVyXG4gICAgICAgICAgICBJcEFkZHJlc3NUeXBlOiAnaXB2NCcsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgICAgRE5TTmFtZTogJ2RuczIuZXhhbXBsZS5jb20nLFxuICAgICAgICAgICAgQ2Fub25pY2FsSG9zdGVkWm9uZUlkOiAnWjEyMzQnLFxuICAgICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMjM0NSddLFxuICAgICAgICAgICAgVnBjSWQ6ICd2cGMtMTIzNCcsXG4gICAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIEFXUy5tb2NrKCdFTEJ2MicsICdkZXNjcmliZVRhZ3MnLCAoX3BhcmFtczogYXdzLkVMQnYyLkRlc2NyaWJlVGFnc0lucHV0LCBjYjogQXdzQ2FsbGJhY2s8YXdzLkVMQnYyLkRlc2NyaWJlVGFnc091dHB1dD4pID0+IHtcbiAgICAgIGNiKG51bGwsIHtcbiAgICAgICAgVGFnRGVzY3JpcHRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgQVdTLm1vY2soJ0VMQnYyJywgJ2Rlc2NyaWJlTGlzdGVuZXJzJywgKHBhcmFtczogYXdzLkVMQnYyLkRlc2NyaWJlTGlzdGVuZXJzSW5wdXQsIGNiOiBBd3NDYWxsYmFjazxhd3MuRUxCdjIuRGVzY3JpYmVMaXN0ZW5lcnNPdXRwdXQ+KSA9PiB7XG4gICAgICBpZiAocGFyYW1zLkxvYWRCYWxhbmNlckFybiA9PT0gJ2Fybjpsb2FkLWJhbGFuY2VyMScpIHtcbiAgICAgICAgY2IobnVsbCwge1xuICAgICAgICAgIExpc3RlbmVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgLy8gV3JvbmcgcG9ydCwgd3JvbmcgcHJvdG9jb2wgPT4gbm8gbWF0Y2hcbiAgICAgICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuMScsXG4gICAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgICAgICAgICAgIFByb3RvY29sOiAnSFRUUCcsXG4gICAgICAgICAgICAgIFBvcnQ6IDgwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFdyb25nIHByb3RvY29sLCByaWdodCBwb3J0ID0+IG5vIG1hdGNoXG4gICAgICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyLWFybjMnLFxuICAgICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgICBQcm90b2NvbDogJ0hUVFBTJyxcbiAgICAgICAgICAgICAgUG9ydDogNDQzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFdyb25nIHBvcnQsIHJpZ2h0IHByb3RvY29sID0+IG5vIG1hdGNoXG4gICAgICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyLWFybjQnLFxuICAgICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgICBQcm90b2NvbDogJ1RDUCcsXG4gICAgICAgICAgICAgIFBvcnQ6IDk5OSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmFtcy5Mb2FkQmFsYW5jZXJBcm4gPT09ICdhcm46bG9hZC1iYWxhbmNlcjInKSB7XG4gICAgICAgIGNiKG51bGwsIHtcbiAgICAgICAgICBMaXN0ZW5lcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFdyb25nIHBvcnQsIHdyb25nIHByb3RvY29sID0+IG5vIG1hdGNoXG4gICAgICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyLWFybjUnLFxuICAgICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgICAgICBQcm90b2NvbDogJ0hUVFAnLFxuICAgICAgICAgICAgICBQb3J0OiA4MCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBSaWdodCBwb3J0LCByaWdodCBwcm90b2NvbCA9PiBtYXRjaFxuICAgICAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm42JyxcbiAgICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgICAgUG9ydDogNDQzLFxuICAgICAgICAgICAgICBQcm90b2NvbDogJ1RDUCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2IobmV3IEVycm9yKGBVbmV4cGVjdGVkIHJlcXVlc3Q6ICR7SlNPTi5zdHJpbmdpZnkocGFyYW1zKX0nYCksIHt9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBsaXN0ZW5lciA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBsb2FkQmFsYW5jZXJUeXBlOiBjeHNjaGVtYS5Mb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgbG9hZEJhbGFuY2VyVGFnczogW3sga2V5OiAnc29tZScsIHZhbHVlOiAndGFnJyB9XSxcbiAgICAgIGxpc3RlbmVyUHJvdG9jb2w6IGN4c2NoZW1hLkxvYWRCYWxhbmNlckxpc3RlbmVyUHJvdG9jb2wuVENQLFxuICAgICAgbGlzdGVuZXJQb3J0OiA0NDMsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGxpc3RlbmVyLmxpc3RlbmVyQXJuKS50b0VxdWFsKCdhcm46bGlzdGVuZXItYXJuNicpO1xuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lclBvcnQpLnRvRXF1YWwoNDQzKTtcbiAgICBleHBlY3QobGlzdGVuZXIuc2VjdXJpdHlHcm91cElkcykudG9FcXVhbChbJ3NnLTIzNDUnXSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2ZpbHRlcnMgYnkgYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIHR5cGUnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIG1vY2tBTEJMb29rdXAoe1xuICAgICAgZGVzY3JpYmVMb2FkQmFsYW5jZXJzRXhwZWN0ZWQ6IHsgTG9hZEJhbGFuY2VyQXJuczogdW5kZWZpbmVkIH0sXG4gICAgICBsb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBUaGlzIG9uZSBoYXMgd3JvbmcgdHlwZSA9PiBubyBtYXRjaFxuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnLFxuICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbXSxcbiAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gUmlnaHQgdHlwZSA9PiBtYXRjaFxuICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjInLFxuICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbXSxcbiAgICAgICAgICBUeXBlOiAnbmV0d29yaycsXG4gICAgICAgIH0sXG4gICAgICBdLFxuXG4gICAgICB0YWdEZXNjcmlwdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsXG4gICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMicsXG4gICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG5cbiAgICAgIGRlc2NyaWJlTGlzdGVuZXJzRXhwZWN0ZWQ6IHsgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMicgfSxcbiAgICAgIGxpc3RlbmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuMicsXG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMicsXG4gICAgICAgICAgUG9ydDogNDQzLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBsaXN0ZW5lciA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBsb2FkQmFsYW5jZXJUeXBlOiBjeHNjaGVtYS5Mb2FkQmFsYW5jZXJUeXBlLk5FVFdPUkssXG4gICAgICBsb2FkQmFsYW5jZXJUYWdzOiBbeyBrZXk6ICdzb21lJywgdmFsdWU6ICd0YWcnIH1dLFxuICAgICAgbGlzdGVuZXJQb3J0OiA0NDMsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGxpc3RlbmVyLmxpc3RlbmVyQXJuKS50b0VxdWFsKCdhcm46bGlzdGVuZXItYXJuMicpO1xuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lclBvcnQpLnRvRXF1YWwoNDQzKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIGlzIHdyb25nIHR5cGUnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIG1vY2tBTEJMb29rdXAoe1xuICAgICAgZGVzY3JpYmVMaXN0ZW5lcnNFeHBlY3RlZDogeyBMaXN0ZW5lckFybnM6IFsnYXJuOmxpc3RlbmVyLWFybjEnXSB9LFxuICAgICAgbGlzdGVuZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4xJyxcbiAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4xJyxcbiAgICAgICAgICBQb3J0OiA0NDMsXG4gICAgICAgIH0sXG4gICAgICBdLFxuXG4gICAgICBkZXNjcmliZUxvYWRCYWxhbmNlcnNFeHBlY3RlZDogeyBMb2FkQmFsYW5jZXJBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnXSB9LFxuICAgICAgbG9hZEJhbGFuY2VyczogW1xuICAgICAgICB7XG4gICAgICAgICAgLy8gVGhpcyBvbmUgaGFzIHdyb25nIHR5cGUgPT4gbm8gbWF0Y2hcbiAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4xJyxcbiAgICAgICAgICBTZWN1cml0eUdyb3VwczogW10sXG4gICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICAgIGxvYWRCYWxhbmNlclR5cGU6IGN4c2NoZW1hLkxvYWRCYWxhbmNlclR5cGUuTkVUV09SSyxcbiAgICAgICAgbGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuMScsXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdygvbm8gYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIGZvdW5kL2kpO1xuICB9KTtcbn0pO1xuXG5pbnRlcmZhY2UgQUxCTG9va3VwT3B0aW9ucyB7XG4gIGRlc2NyaWJlTG9hZEJhbGFuY2Vyc0V4cGVjdGVkPzogYW55O1xuICBsb2FkQmFsYW5jZXJzPzogYXdzLkVMQnYyLkxvYWRCYWxhbmNlcnM7XG4gIGRlc2NyaWJlVGFnc0V4cGVjdGVkPzogYW55O1xuICB0YWdEZXNjcmlwdGlvbnM/OiBhd3MuRUxCdjIuVGFnRGVzY3JpcHRpb25zO1xuICBkZXNjcmliZUxpc3RlbmVyc0V4cGVjdGVkPzogYW55O1xuICBsaXN0ZW5lcnM/OiBhd3MuRUxCdjIuTGlzdGVuZXJzO1xufVxuXG5mdW5jdGlvbiBtb2NrQUxCTG9va3VwKG9wdGlvbnM6IEFMQkxvb2t1cE9wdGlvbnMpIHtcbiAgQVdTLm1vY2soJ0VMQnYyJywgJ2Rlc2NyaWJlTG9hZEJhbGFuY2VycycsIChfcGFyYW1zOiBhd3MuRUxCdjIuRGVzY3JpYmVMb2FkQmFsYW5jZXJzSW5wdXQsIGNiOiBBd3NDYWxsYmFjazxhd3MuRUxCdjIuRGVzY3JpYmVMb2FkQmFsYW5jZXJzT3V0cHV0PikgPT4ge1xuICAgIGlmIChvcHRpb25zLmRlc2NyaWJlTG9hZEJhbGFuY2Vyc0V4cGVjdGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGV4cGVjdChfcGFyYW1zKS50b0VxdWFsKG9wdGlvbnMuZGVzY3JpYmVMb2FkQmFsYW5jZXJzRXhwZWN0ZWQpO1xuICAgIH1cbiAgICBjYihudWxsLCB7IExvYWRCYWxhbmNlcnM6IG9wdGlvbnMubG9hZEJhbGFuY2VycyB9KTtcbiAgfSk7XG5cbiAgQVdTLm1vY2soJ0VMQnYyJywgJ2Rlc2NyaWJlVGFncycsIChfcGFyYW1zOiBhd3MuRUxCdjIuRGVzY3JpYmVUYWdzSW5wdXQsIGNiOiBBd3NDYWxsYmFjazxhd3MuRUxCdjIuRGVzY3JpYmVUYWdzT3V0cHV0PikgPT4ge1xuICAgIGlmIChvcHRpb25zLmRlc2NyaWJlVGFnc0V4cGVjdGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGV4cGVjdChfcGFyYW1zKS50b0VxdWFsKG9wdGlvbnMuZGVzY3JpYmVUYWdzRXhwZWN0ZWQpO1xuICAgIH1cbiAgICBjYihudWxsLCB7IFRhZ0Rlc2NyaXB0aW9uczogb3B0aW9ucy50YWdEZXNjcmlwdGlvbnMgfSk7XG4gIH0pO1xuXG4gIEFXUy5tb2NrKCdFTEJ2MicsICdkZXNjcmliZUxpc3RlbmVycycsIChfcGFyYW1zOiBhd3MuRUxCdjIuRGVzY3JpYmVMaXN0ZW5lcnNJbnB1dCwgY2I6IEF3c0NhbGxiYWNrPGF3cy5FTEJ2Mi5EZXNjcmliZUxpc3RlbmVyc091dHB1dD4pID0+IHtcbiAgICBpZiAob3B0aW9ucy5kZXNjcmliZUxpc3RlbmVyc0V4cGVjdGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGV4cGVjdChfcGFyYW1zKS50b0VxdWFsKG9wdGlvbnMuZGVzY3JpYmVMaXN0ZW5lcnNFeHBlY3RlZCk7XG4gICAgfVxuICAgIGNiKG51bGwsIHsgTGlzdGVuZXJzOiBvcHRpb25zLmxpc3RlbmVycyB9KTtcbiAgfSk7XG59XG4iXX0=