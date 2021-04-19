"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aws = require("aws-sdk");
const AWS = require("aws-sdk-mock");
const vpcs_1 = require("../../lib/context-providers/vpcs");
const mock_sdk_1 = require("../util/mock-sdk");
AWS.setSDKInstance(aws);
afterEach(done => {
    AWS.restore();
    done();
});
const mockSDK = new mock_sdk_1.MockSdkProvider();
test('looks up the requested (symmetric) VPC', async () => {
    mockVpcLookup({
        subnets: [
            { SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: true, CidrBlock: '1.1.1.1/24' },
            { SubnetId: 'sub-789012', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false, CidrBlock: '1.1.2.1/24' },
        ],
        routeTables: [
            { Associations: [{ SubnetId: 'sub-123456' }], RouteTableId: 'rtb-123456' },
            { Associations: [{ SubnetId: 'sub-789012' }], RouteTableId: 'rtb-789012' },
        ],
        vpnGateways: [{ VpnGatewayId: 'gw-abcdef' }],
    });
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        isolatedSubnetIds: undefined,
        isolatedSubnetNames: undefined,
        isolatedSubnetRouteTableIds: undefined,
        privateSubnetIds: undefined,
        privateSubnetNames: undefined,
        privateSubnetRouteTableIds: undefined,
        publicSubnetIds: undefined,
        publicSubnetNames: undefined,
        publicSubnetRouteTableIds: undefined,
        subnetGroups: [
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: '1.1.1.1/24',
                    },
                ],
            },
            {
                name: 'Private',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'sub-789012',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-789012',
                        cidr: '1.1.2.1/24',
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: 'gw-abcdef',
    });
});
test('throws when no such VPC is found', async () => {
    AWS.mock('EC2', 'describeVpcs', (params, cb) => {
        expect(params.Filters).toEqual([{ Name: 'foo', Values: ['bar'] }]);
        return cb(null, {});
    });
    await expect(new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    })).rejects.toThrow(/Could not find any VPCs matching/);
});
test('throws when multiple VPCs are found', async () => {
    // GIVEN
    AWS.mock('EC2', 'describeVpcs', (params, cb) => {
        expect(params.Filters).toEqual([{ Name: 'foo', Values: ['bar'] }]);
        return cb(null, { Vpcs: [{ VpcId: 'vpc-1' }, { VpcId: 'vpc-2' }] });
    });
    // WHEN
    await expect(new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    })).rejects.toThrow(/Found 2 VPCs matching/);
});
test('uses the VPC main route table when a subnet has no specific association', async () => {
    mockVpcLookup({
        subnets: [
            { SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: true, CidrBlock: '1.1.1.1/24' },
            { SubnetId: 'sub-789012', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false, CidrBlock: '1.1.2.1/24' },
        ],
        routeTables: [
            { Associations: [{ SubnetId: 'sub-123456' }], RouteTableId: 'rtb-123456' },
            { Associations: [{ Main: true }], RouteTableId: 'rtb-789012' },
        ],
        vpnGateways: [{ VpnGatewayId: 'gw-abcdef' }],
    });
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        isolatedSubnetIds: undefined,
        isolatedSubnetNames: undefined,
        isolatedSubnetRouteTableIds: undefined,
        privateSubnetIds: undefined,
        privateSubnetNames: undefined,
        privateSubnetRouteTableIds: undefined,
        publicSubnetIds: undefined,
        publicSubnetNames: undefined,
        publicSubnetRouteTableIds: undefined,
        subnetGroups: [
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: '1.1.1.1/24',
                    },
                ],
            },
            {
                name: 'Private',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'sub-789012',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-789012',
                        cidr: '1.1.2.1/24',
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: 'gw-abcdef',
    });
});
test('Recognize public subnet by route table', async () => {
    // GIVEN
    mockVpcLookup({
        subnets: [
            { SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false },
        ],
        routeTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '10.0.2.0/26',
                        Origin: 'CreateRoute',
                        State: 'active',
                        VpcPeeringConnectionId: 'pcx-xxxxxx',
                    },
                    {
                        DestinationCidrBlock: '10.0.1.0/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        GatewayId: 'igw-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    });
    // WHEN
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    // THEN
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        isolatedSubnetIds: undefined,
        isolatedSubnetNames: undefined,
        isolatedSubnetRouteTableIds: undefined,
        privateSubnetIds: undefined,
        privateSubnetNames: undefined,
        privateSubnetRouteTableIds: undefined,
        publicSubnetIds: undefined,
        publicSubnetNames: undefined,
        publicSubnetRouteTableIds: undefined,
        subnetGroups: [
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: undefined,
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
test('works for asymmetric subnets (not spanning the same Availability Zones)', async () => {
    // GIVEN
    mockVpcLookup({
        subnets: [
            { SubnetId: 'pri-sub-in-1b', AvailabilityZone: 'us-west-1b', MapPublicIpOnLaunch: false, CidrBlock: '1.1.1.1/24' },
            { SubnetId: 'pub-sub-in-1c', AvailabilityZone: 'us-west-1c', MapPublicIpOnLaunch: true, CidrBlock: '1.1.2.1/24' },
            { SubnetId: 'pub-sub-in-1b', AvailabilityZone: 'us-west-1b', MapPublicIpOnLaunch: true, CidrBlock: '1.1.3.1/24' },
            { SubnetId: 'pub-sub-in-1a', AvailabilityZone: 'us-west-1a', MapPublicIpOnLaunch: true, CidrBlock: '1.1.4.1/24' },
        ],
        routeTables: [
            { Associations: [{ Main: true }], RouteTableId: 'rtb-123' },
        ],
    });
    // WHEN
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    // THEN
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        isolatedSubnetIds: undefined,
        isolatedSubnetNames: undefined,
        isolatedSubnetRouteTableIds: undefined,
        privateSubnetIds: undefined,
        privateSubnetNames: undefined,
        privateSubnetRouteTableIds: undefined,
        publicSubnetIds: undefined,
        publicSubnetNames: undefined,
        publicSubnetRouteTableIds: undefined,
        subnetGroups: [
            {
                name: 'Private',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'pri-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-123',
                        cidr: '1.1.1.1/24',
                    },
                ],
            },
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'pub-sub-in-1a',
                        availabilityZone: 'us-west-1a',
                        routeTableId: 'rtb-123',
                        cidr: '1.1.4.1/24',
                    },
                    {
                        subnetId: 'pub-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-123',
                        cidr: '1.1.3.1/24',
                    },
                    {
                        subnetId: 'pub-sub-in-1c',
                        availabilityZone: 'us-west-1c',
                        routeTableId: 'rtb-123',
                        cidr: '1.1.2.1/24',
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
test('allows specifying the subnet group name tag', async () => {
    // GIVEN
    mockVpcLookup({
        subnets: [
            {
                SubnetId: 'pri-sub-in-1b',
                AvailabilityZone: 'us-west-1b',
                MapPublicIpOnLaunch: false,
                Tags: [
                    { Key: 'Tier', Value: 'restricted' },
                ],
            },
            {
                SubnetId: 'pub-sub-in-1c',
                AvailabilityZone: 'us-west-1c',
                MapPublicIpOnLaunch: true,
                Tags: [
                    { Key: 'Tier', Value: 'connectivity' },
                ],
            },
            {
                SubnetId: 'pub-sub-in-1b',
                AvailabilityZone: 'us-west-1b',
                MapPublicIpOnLaunch: true,
                Tags: [
                    { Key: 'Tier', Value: 'connectivity' },
                ],
            },
            {
                SubnetId: 'pub-sub-in-1a',
                AvailabilityZone: 'us-west-1a',
                MapPublicIpOnLaunch: true,
                Tags: [
                    { Key: 'Tier', Value: 'connectivity' },
                ],
            },
        ],
        routeTables: [
            { Associations: [{ Main: true }], RouteTableId: 'rtb-123' },
        ],
    });
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
        subnetGroupNameTag: 'Tier',
    });
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        isolatedSubnetIds: undefined,
        isolatedSubnetNames: undefined,
        isolatedSubnetRouteTableIds: undefined,
        privateSubnetIds: undefined,
        privateSubnetNames: undefined,
        privateSubnetRouteTableIds: undefined,
        publicSubnetIds: undefined,
        publicSubnetNames: undefined,
        publicSubnetRouteTableIds: undefined,
        subnetGroups: [
            {
                name: 'restricted',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'pri-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-123',
                        cidr: undefined,
                    },
                ],
            },
            {
                name: 'connectivity',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'pub-sub-in-1a',
                        availabilityZone: 'us-west-1a',
                        routeTableId: 'rtb-123',
                        cidr: undefined,
                    },
                    {
                        subnetId: 'pub-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-123',
                        cidr: undefined,
                    },
                    {
                        subnetId: 'pub-sub-in-1c',
                        availabilityZone: 'us-west-1c',
                        routeTableId: 'rtb-123',
                        cidr: undefined,
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
function mockVpcLookup(options) {
    const VpcId = 'vpc-1234567';
    AWS.mock('EC2', 'describeVpcs', (params, cb) => {
        expect(params.Filters).toEqual([{ Name: 'foo', Values: ['bar'] }]);
        return cb(null, { Vpcs: [{ VpcId, CidrBlock: '1.1.1.1/16' }] });
    });
    AWS.mock('EC2', 'describeSubnets', (params, cb) => {
        expect(params.Filters).toEqual([{ Name: 'vpc-id', Values: [VpcId] }]);
        return cb(null, { Subnets: options.subnets });
    });
    AWS.mock('EC2', 'describeRouteTables', (params, cb) => {
        expect(params.Filters).toEqual([{ Name: 'vpc-id', Values: [VpcId] }]);
        return cb(null, { RouteTables: options.routeTables });
    });
    AWS.mock('EC2', 'describeVpnGateways', (params, cb) => {
        expect(params.Filters).toEqual([
            { Name: 'attachment.vpc-id', Values: [VpcId] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ]);
        return cb(null, { VpnGateways: options.vpnGateways });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bW1ldHJpYy12cGNzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhc3ltbWV0cmljLXZwY3MudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLCtCQUErQjtBQUMvQixvQ0FBb0M7QUFDcEMsMkRBQW1GO0FBQ25GLCtDQUFtRDtBQUVuRCxHQUFHLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBRXhCLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUNmLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNkLElBQUksRUFBRSxDQUFDO0FBQ1QsQ0FBQyxDQUFDLENBQUM7QUFFSCxNQUFNLE9BQU8sR0FBRyxJQUFJLDBCQUFlLEVBQUUsQ0FBQztBQUl0QyxJQUFJLENBQUMsd0NBQXdDLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDeEQsYUFBYSxDQUFDO1FBQ1osT0FBTyxFQUFFO1lBQ1AsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixFQUFFLHVCQUF1QixFQUFFLG1CQUFtQixFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFO1lBQ3pILEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSx1QkFBdUIsRUFBRSxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRTtTQUMzSDtRQUNELFdBQVcsRUFBRTtZQUNYLEVBQUUsWUFBWSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLENBQUMsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFO1lBQzFFLEVBQUUsWUFBWSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLENBQUMsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFO1NBQzNFO1FBQ0QsV0FBVyxFQUFFLENBQUMsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLENBQUM7S0FFN0MsQ0FBQyxDQUFDO0lBRUgsTUFBTSxNQUFNLEdBQUcs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TSxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDbEQsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFO1NBQ3pDLENBQUMsQ0FBQztRQUNILE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUN4RCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhd3MgZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgKiBhcyBBV1MgZnJvbSAnYXdzLXNkay1tb2NrJztcbmltcG9ydCB7IFZwY05ldHdvcmtDb250ZXh0UHJvdmlkZXJQbHVnaW4gfSBmcm9tICcuLi8uLi9saWIvY29udGV4dC1wcm92aWRlcnMvdnBjcyc7XG5pbXBvcnQgeyBNb2NrU2RrUHJvdmlkZXIgfSBmcm9tICcuLi91dGlsL21vY2stc2RrJztcblxuQVdTLnNldFNES0luc3RhbmNlKGF3cyk7XG5cbmFmdGVyRWFjaChkb25lID0+IHtcbiAgQVdTLnJlc3RvcmUoKTtcbiAgZG9uZSgpO1xufSk7XG5cbmNvbnN0IG1vY2tTREsgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG5cbnR5cGUgQXdzQ2FsbGJhY2s8VD4gPSAoZXJyOiBFcnJvciB8IG51bGwsIHZhbDogVCkgPT4gdm9pZDtcblxudGVzdCgnbG9va3MgdXAgdGhlIHJlcXVlc3RlZCAoc3ltbWV0cmljKSBWUEMnLCBhc3luYyAoKSA9PiB7XG4gIG1vY2tWcGNMb29rdXAoe1xuICAgIHN1Ym5ldHM6IFtcbiAgICAgIHsgU3VibmV0SWQ6ICdzdWItMTIzNDU2JywgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsIE1hcFB1YmxpY0lwT25MYXVuY2g6IHRydWUsIENpZHJCbG9jazogJzEuMS4xLjEvMjQnIH0sXG4gICAgICB7IFN1Ym5ldElkOiAnc3ViLTc4OTAxMicsIEF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLCBNYXBQdWJsaWNJcE9uTGF1bmNoOiBmYWxzZSwgQ2lkckJsb2NrOiAnMS4xLjIuMS8yNCcgfSxcbiAgICBdLFxuICAgIHJvdXRlVGFibGVzOiBbXG4gICAgICB7IEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JyB9XSwgUm91dGVUYWJsZUlkOiAncnRiLTEyMzQ1NicgfSxcbiAgICAgIHsgQXNzb2NpYXRpb25zOiBbeyBTdWJuZXRJZDogJ3N1Yi03ODkwMTInIH1dLCBSb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyB9LFxuICAgIF0sXG4gICAgdnBuR2F0ZXdheXM6IFt7IFZwbkdhdGV3YXlJZDogJ2d3LWFiY2RlZicgfV0sXG5cbiAgfSk7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFZwY05ldHdvcmtDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESykuZ2V0VmFsdWUoe1xuICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIGZpbHRlcjogeyBmb286ICdiYXInIH0sXG4gICAgcmV0dXJuQXN5bW1ldHJpY1N1Ym5ldHM6IHRydWUsXG4gIH0pO1xuXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBbXSxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBpc29sYXRlZFN1Ym5ldElkczogdW5kZWZpbmVkLFxuICAgIGlzb2xhdGVkU3VibmV0TmFtZXM6IHVuZGVmaW5lZCxcbiAgICBpc29sYXRlZFN1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBwcml2YXRlU3VibmV0SWRzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldE5hbWVzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXRJZHM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXROYW1lczogdW5kZWZpbmVkLFxuICAgIHB1YmxpY1N1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBzdWJuZXRHcm91cHM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1B1YmxpYycsXG4gICAgICAgIHR5cGU6ICdQdWJsaWMnLFxuICAgICAgICBzdWJuZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3VibmV0SWQ6ICdzdWItMTIzNDU2JyxcbiAgICAgICAgICAgIGF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTEyMzQ1NicsXG4gICAgICAgICAgICBjaWRyOiAnMS4xLjEuMS8yNCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdQcml2YXRlJyxcbiAgICAgICAgdHlwZTogJ1ByaXZhdGUnLFxuICAgICAgICBzdWJuZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3VibmV0SWQ6ICdzdWItNzg5MDEyJyxcbiAgICAgICAgICAgIGF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTc4OTAxMicsXG4gICAgICAgICAgICBjaWRyOiAnMS4xLjIuMS8yNCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICB2cGNJZDogJ3ZwYy0xMjM0NTY3JyxcbiAgICB2cG5HYXRld2F5SWQ6ICdndy1hYmNkZWYnLFxuICB9KTtcbn0pO1xuXG50ZXN0KCd0aHJvd3Mgd2hlbiBubyBzdWNoIFZQQyBpcyBmb3VuZCcsIGFzeW5jICgpID0+IHtcbiAgQVdTLm1vY2soJ0VDMicsICdkZXNjcmliZVZwY3MnLCAocGFyYW1zOiBhd3MuRUMyLkRlc2NyaWJlVnBjc1JlcXVlc3QsIGNiOiBBd3NDYWxsYmFjazxhd3MuRUMyLkRlc2NyaWJlVnBjc1Jlc3VsdD4pID0+IHtcbiAgICBleHBlY3QocGFyYW1zLkZpbHRlcnMpLnRvRXF1YWwoW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSk7XG4gICAgcmV0dXJuIGNiKG51bGwsIHt9KTtcbiAgfSk7XG5cbiAgYXdhaXQgZXhwZWN0KG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KSkucmVqZWN0cy50b1Rocm93KC9Db3VsZCBub3QgZmluZCBhbnkgVlBDcyBtYXRjaGluZy8pO1xufSk7XG5cbnRlc3QoJ3Rocm93cyB3aGVuIG11bHRpcGxlIFZQQ3MgYXJlIGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBBV1MubW9jaygnRUMyJywgJ2Rlc2NyaWJlVnBjcycsIChwYXJhbXM6IGF3cy5FQzIuRGVzY3JpYmVWcGNzUmVxdWVzdCwgY2I6IEF3c0NhbGxiYWNrPGF3cy5FQzIuRGVzY3JpYmVWcGNzUmVzdWx0PikgPT4ge1xuICAgIGV4cGVjdChwYXJhbXMuRmlsdGVycykudG9FcXVhbChbeyBOYW1lOiAnZm9vJywgVmFsdWVzOiBbJ2JhciddIH1dKTtcbiAgICByZXR1cm4gY2IobnVsbCwgeyBWcGNzOiBbeyBWcGNJZDogJ3ZwYy0xJyB9LCB7IFZwY0lkOiAndnBjLTInIH1dIH0pO1xuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGV4cGVjdChuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQnLFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgZmlsdGVyOiB7IGZvbzogJ2JhcicgfSxcbiAgICByZXR1cm5Bc3ltbWV0cmljU3VibmV0czogdHJ1ZSxcbiAgfSkpLnJlamVjdHMudG9UaHJvdygvRm91bmQgMiBWUENzIG1hdGNoaW5nLyk7XG59KTtcblxudGVzdCgndXNlcyB0aGUgVlBDIG1haW4gcm91dGUgdGFibGUgd2hlbiBhIHN1Ym5ldCBoYXMgbm8gc3BlY2lmaWMgYXNzb2NpYXRpb24nLCBhc3luYyAoKSA9PiB7XG4gIG1vY2tWcGNMb29rdXAoe1xuICAgIHN1Ym5ldHM6IFtcbiAgICAgIHsgU3VibmV0SWQ6ICdzdWItMTIzNDU2JywgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsIE1hcFB1YmxpY0lwT25MYXVuY2g6IHRydWUsIENpZHJCbG9jazogJzEuMS4xLjEvMjQnIH0sXG4gICAgICB7IFN1Ym5ldElkOiAnc3ViLTc4OTAxMicsIEF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLCBNYXBQdWJsaWNJcE9uTGF1bmNoOiBmYWxzZSwgQ2lkckJsb2NrOiAnMS4xLjIuMS8yNCcgfSxcbiAgICBdLFxuICAgIHJvdXRlVGFibGVzOiBbXG4gICAgICB7IEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JyB9XSwgUm91dGVUYWJsZUlkOiAncnRiLTEyMzQ1NicgfSxcbiAgICAgIHsgQXNzb2NpYXRpb25zOiBbeyBNYWluOiB0cnVlIH1dLCBSb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyB9LFxuICAgIF0sXG4gICAgdnBuR2F0ZXdheXM6IFt7IFZwbkdhdGV3YXlJZDogJ2d3LWFiY2RlZicgfV0sXG4gIH0pO1xuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICBhdmFpbGFiaWxpdHlab25lczogW10sXG4gICAgdnBjQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsXG4gICAgaXNvbGF0ZWRTdWJuZXRJZHM6IHVuZGVmaW5lZCxcbiAgICBpc29sYXRlZFN1Ym5ldE5hbWVzOiB1bmRlZmluZWQsXG4gICAgaXNvbGF0ZWRTdWJuZXRSb3V0ZVRhYmxlSWRzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldElkczogdW5kZWZpbmVkLFxuICAgIHByaXZhdGVTdWJuZXROYW1lczogdW5kZWZpbmVkLFxuICAgIHByaXZhdGVTdWJuZXRSb3V0ZVRhYmxlSWRzOiB1bmRlZmluZWQsXG4gICAgcHVibGljU3VibmV0SWRzOiB1bmRlZmluZWQsXG4gICAgcHVibGljU3VibmV0TmFtZXM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXRSb3V0ZVRhYmxlSWRzOiB1bmRlZmluZWQsXG4gICAgc3VibmV0R3JvdXBzOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICB0eXBlOiAnUHVibGljJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgICAgY2lkcjogJzEuMS4xLjEvMjQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnUHJpdmF0ZScsXG4gICAgICAgIHR5cGU6ICdQcml2YXRlJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTc4OTAxMicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi03ODkwMTInLFxuICAgICAgICAgICAgY2lkcjogJzEuMS4yLjEvMjQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgdnBjSWQ6ICd2cGMtMTIzNDU2NycsXG4gICAgdnBuR2F0ZXdheUlkOiAnZ3ctYWJjZGVmJyxcbiAgfSk7XG59KTtcblxudGVzdCgnUmVjb2duaXplIHB1YmxpYyBzdWJuZXQgYnkgcm91dGUgdGFibGUnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tWcGNMb29rdXAoe1xuICAgIHN1Ym5ldHM6IFtcbiAgICAgIHsgU3VibmV0SWQ6ICdzdWItMTIzNDU2JywgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsIE1hcFB1YmxpY0lwT25MYXVuY2g6IGZhbHNlIH0sXG4gICAgXSxcbiAgICByb3V0ZVRhYmxlczogW1xuICAgICAge1xuICAgICAgICBBc3NvY2lhdGlvbnM6IFt7IFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicgfV0sXG4gICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEwLjAuMi4wLzI2JyxcbiAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICAgIFZwY1BlZXJpbmdDb25uZWN0aW9uSWQ6ICdwY3gteHh4eHh4JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMTAuMC4xLjAvMjQnLFxuICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGVUYWJsZScsXG4gICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzAuMC4wLjAvMCcsXG4gICAgICAgICAgICBHYXRld2F5SWQ6ICdpZ3cteHh4eHh4JyxcbiAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBbXSxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBpc29sYXRlZFN1Ym5ldElkczogdW5kZWZpbmVkLFxuICAgIGlzb2xhdGVkU3VibmV0TmFtZXM6IHVuZGVmaW5lZCxcbiAgICBpc29sYXRlZFN1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBwcml2YXRlU3VibmV0SWRzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldE5hbWVzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXRJZHM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXROYW1lczogdW5kZWZpbmVkLFxuICAgIHB1YmxpY1N1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBzdWJuZXRHcm91cHM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1B1YmxpYycsXG4gICAgICAgIHR5cGU6ICdQdWJsaWMnLFxuICAgICAgICBzdWJuZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3VibmV0SWQ6ICdzdWItMTIzNDU2JyxcbiAgICAgICAgICAgIGF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTEyMzQ1NicsXG4gICAgICAgICAgICBjaWRyOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICB2cGNJZDogJ3ZwYy0xMjM0NTY3JyxcbiAgICB2cG5HYXRld2F5SWQ6IHVuZGVmaW5lZCxcbiAgfSk7XG59KTtcblxudGVzdCgnd29ya3MgZm9yIGFzeW1tZXRyaWMgc3VibmV0cyAobm90IHNwYW5uaW5nIHRoZSBzYW1lIEF2YWlsYWJpbGl0eSBab25lcyknLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tWcGNMb29rdXAoe1xuICAgIHN1Ym5ldHM6IFtcbiAgICAgIHsgU3VibmV0SWQ6ICdwcmktc3ViLWluLTFiJywgQXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWInLCBNYXBQdWJsaWNJcE9uTGF1bmNoOiBmYWxzZSwgQ2lkckJsb2NrOiAnMS4xLjEuMS8yNCcgfSxcbiAgICAgIHsgU3VibmV0SWQ6ICdwdWItc3ViLWluLTFjJywgQXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWMnLCBNYXBQdWJsaWNJcE9uTGF1bmNoOiB0cnVlLCBDaWRyQmxvY2s6ICcxLjEuMi4xLzI0JyB9LFxuICAgICAgeyBTdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWInLCBBdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYicsIE1hcFB1YmxpY0lwT25MYXVuY2g6IHRydWUsIENpZHJCbG9jazogJzEuMS4zLjEvMjQnIH0sXG4gICAgICB7IFN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYScsIEF2YWlsYWJpbGl0eVpvbmU6ICd1cy13ZXN0LTFhJywgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSwgQ2lkckJsb2NrOiAnMS4xLjQuMS8yNCcgfSxcbiAgICBdLFxuICAgIHJvdXRlVGFibGVzOiBbXG4gICAgICB7IEFzc29jaWF0aW9uczogW3sgTWFpbjogdHJ1ZSB9XSwgUm91dGVUYWJsZUlkOiAncnRiLTEyMycgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBbXSxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBpc29sYXRlZFN1Ym5ldElkczogdW5kZWZpbmVkLFxuICAgIGlzb2xhdGVkU3VibmV0TmFtZXM6IHVuZGVmaW5lZCxcbiAgICBpc29sYXRlZFN1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBwcml2YXRlU3VibmV0SWRzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldE5hbWVzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXRJZHM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXROYW1lczogdW5kZWZpbmVkLFxuICAgIHB1YmxpY1N1Ym5ldFJvdXRlVGFibGVJZHM6IHVuZGVmaW5lZCxcbiAgICBzdWJuZXRHcm91cHM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICB0eXBlOiAnUHJpdmF0ZScsXG4gICAgICAgIHN1Ym5ldHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3ByaS1zdWItaW4tMWInLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWInLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTEyMycsXG4gICAgICAgICAgICBjaWRyOiAnMS4xLjEuMS8yNCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICB0eXBlOiAnUHVibGljJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYScsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYScsXG4gICAgICAgICAgICByb3V0ZVRhYmxlSWQ6ICdydGItMTIzJyxcbiAgICAgICAgICAgIGNpZHI6ICcxLjEuNC4xLzI0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYicsXG4gICAgICAgICAgICByb3V0ZVRhYmxlSWQ6ICdydGItMTIzJyxcbiAgICAgICAgICAgIGNpZHI6ICcxLjEuMy4xLzI0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYycsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYycsXG4gICAgICAgICAgICByb3V0ZVRhYmxlSWQ6ICdydGItMTIzJyxcbiAgICAgICAgICAgIGNpZHI6ICcxLjEuMi4xLzI0JyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICAgIHZwY0lkOiAndnBjLTEyMzQ1NjcnLFxuICAgIHZwbkdhdGV3YXlJZDogdW5kZWZpbmVkLFxuICB9KTtcbn0pO1xuXG50ZXN0KCdhbGxvd3Mgc3BlY2lmeWluZyB0aGUgc3VibmV0IGdyb3VwIG5hbWUgdGFnJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrVnBjTG9va3VwKHtcbiAgICBzdWJuZXRzOiBbXG4gICAgICB7XG4gICAgICAgIFN1Ym5ldElkOiAncHJpLXN1Yi1pbi0xYicsXG4gICAgICAgIEF2YWlsYWJpbGl0eVpvbmU6ICd1cy13ZXN0LTFiJyxcbiAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogZmFsc2UsXG4gICAgICAgIFRhZ3M6IFtcbiAgICAgICAgICB7IEtleTogJ1RpZXInLCBWYWx1ZTogJ3Jlc3RyaWN0ZWQnIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBTdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWMnLFxuICAgICAgICBBdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYycsXG4gICAgICAgIE1hcFB1YmxpY0lwT25MYXVuY2g6IHRydWUsXG4gICAgICAgIFRhZ3M6IFtcbiAgICAgICAgICB7IEtleTogJ1RpZXInLCBWYWx1ZTogJ2Nvbm5lY3Rpdml0eScgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIFN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYicsXG4gICAgICAgIEF2YWlsYWJpbGl0eVpvbmU6ICd1cy13ZXN0LTFiJyxcbiAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgVGFnczogW1xuICAgICAgICAgIHsgS2V5OiAnVGllcicsIFZhbHVlOiAnY29ubmVjdGl2aXR5JyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgU3VibmV0SWQ6ICdwdWItc3ViLWluLTFhJyxcbiAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWEnLFxuICAgICAgICBNYXBQdWJsaWNJcE9uTGF1bmNoOiB0cnVlLFxuICAgICAgICBUYWdzOiBbXG4gICAgICAgICAgeyBLZXk6ICdUaWVyJywgVmFsdWU6ICdjb25uZWN0aXZpdHknIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgcm91dGVUYWJsZXM6IFtcbiAgICAgIHsgQXNzb2NpYXRpb25zOiBbeyBNYWluOiB0cnVlIH1dLCBSb3V0ZVRhYmxlSWQ6ICdydGItMTIzJyB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICAgIHN1Ym5ldEdyb3VwTmFtZVRhZzogJ1RpZXInLFxuICB9KTtcblxuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICBhdmFpbGFiaWxpdHlab25lczogW10sXG4gICAgdnBjQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsXG4gICAgaXNvbGF0ZWRTdWJuZXRJZHM6IHVuZGVmaW5lZCxcbiAgICBpc29sYXRlZFN1Ym5ldE5hbWVzOiB1bmRlZmluZWQsXG4gICAgaXNvbGF0ZWRTdWJuZXRSb3V0ZVRhYmxlSWRzOiB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZVN1Ym5ldElkczogdW5kZWZpbmVkLFxuICAgIHByaXZhdGVTdWJuZXROYW1lczogdW5kZWZpbmVkLFxuICAgIHByaXZhdGVTdWJuZXRSb3V0ZVRhYmxlSWRzOiB1bmRlZmluZWQsXG4gICAgcHVibGljU3VibmV0SWRzOiB1bmRlZmluZWQsXG4gICAgcHVibGljU3VibmV0TmFtZXM6IHVuZGVmaW5lZCxcbiAgICBwdWJsaWNTdWJuZXRSb3V0ZVRhYmxlSWRzOiB1bmRlZmluZWQsXG4gICAgc3VibmV0R3JvdXBzOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdyZXN0cmljdGVkJyxcbiAgICAgICAgdHlwZTogJ1ByaXZhdGUnLFxuICAgICAgICBzdWJuZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3VibmV0SWQ6ICdwcmktc3ViLWluLTFiJyxcbiAgICAgICAgICAgIGF2YWlsYWJpbGl0eVpvbmU6ICd1cy13ZXN0LTFiJyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi0xMjMnLFxuICAgICAgICAgICAgY2lkcjogdW5kZWZpbmVkLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnY29ubmVjdGl2aXR5JyxcbiAgICAgICAgdHlwZTogJ1B1YmxpYycsXG4gICAgICAgIHN1Ym5ldHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWEnLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWEnLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTEyMycsXG4gICAgICAgICAgICBjaWRyOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWInLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWInLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTEyMycsXG4gICAgICAgICAgICBjaWRyOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWMnLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWMnLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTEyMycsXG4gICAgICAgICAgICBjaWRyOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICB2cGNJZDogJ3ZwYy0xMjM0NTY3JyxcbiAgICB2cG5HYXRld2F5SWQ6IHVuZGVmaW5lZCxcbiAgfSk7XG59KTtcblxuaW50ZXJmYWNlIFZwY0xvb2t1cE9wdGlvbnMge1xuICBzdWJuZXRzOiBhd3MuRUMyLlN1Ym5ldFtdO1xuICByb3V0ZVRhYmxlczogYXdzLkVDMi5Sb3V0ZVRhYmxlW107XG4gIHZwbkdhdGV3YXlzPzogYXdzLkVDMi5WcG5HYXRld2F5W107XG59XG5cbmZ1bmN0aW9uIG1vY2tWcGNMb29rdXAob3B0aW9uczogVnBjTG9va3VwT3B0aW9ucykge1xuICBjb25zdCBWcGNJZCA9ICd2cGMtMTIzNDU2Nyc7XG5cbiAgQVdTLm1vY2soJ0VDMicsICdkZXNjcmliZVZwY3MnLCAocGFyYW1zOiBhd3MuRUMyLkRlc2NyaWJlVnBjc1JlcXVlc3QsIGNiOiBBd3NDYWxsYmFjazxhd3MuRUMyLkRlc2NyaWJlVnBjc1Jlc3VsdD4pID0+IHtcbiAgICBleHBlY3QocGFyYW1zLkZpbHRlcnMpLnRvRXF1YWwoW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSk7XG4gICAgcmV0dXJuIGNiKG51bGwsIHsgVnBjczogW3sgVnBjSWQsIENpZHJCbG9jazogJzEuMS4xLjEvMTYnIH1dIH0pO1xuICB9KTtcblxuICBBV1MubW9jaygnRUMyJywgJ2Rlc2NyaWJlU3VibmV0cycsIChwYXJhbXM6IGF3cy5FQzIuRGVzY3JpYmVTdWJuZXRzUmVxdWVzdCwgY2I6IEF3c0NhbGxiYWNrPGF3cy5FQzIuRGVzY3JpYmVTdWJuZXRzUmVzdWx0PikgPT4ge1xuICAgIGV4cGVjdChwYXJhbXMuRmlsdGVycykudG9FcXVhbChbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbVnBjSWRdIH1dKTtcbiAgICByZXR1cm4gY2IobnVsbCwgeyBTdWJuZXRzOiBvcHRpb25zLnN1Ym5ldHMgfSk7XG4gIH0pO1xuXG4gIEFXUy5tb2NrKCdFQzInLCAnZGVzY3JpYmVSb3V0ZVRhYmxlcycsIChwYXJhbXM6IGF3cy5FQzIuRGVzY3JpYmVSb3V0ZVRhYmxlc1JlcXVlc3QsIGNiOiBBd3NDYWxsYmFjazxhd3MuRUMyLkRlc2NyaWJlUm91dGVUYWJsZXNSZXN1bHQ+KSA9PiB7XG4gICAgZXhwZWN0KHBhcmFtcy5GaWx0ZXJzKS50b0VxdWFsKFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFtWcGNJZF0gfV0pO1xuICAgIHJldHVybiBjYihudWxsLCB7IFJvdXRlVGFibGVzOiBvcHRpb25zLnJvdXRlVGFibGVzIH0pO1xuICB9KTtcblxuICBBV1MubW9jaygnRUMyJywgJ2Rlc2NyaWJlVnBuR2F0ZXdheXMnLCAocGFyYW1zOiBhd3MuRUMyLkRlc2NyaWJlVnBuR2F0ZXdheXNSZXF1ZXN0LCBjYjogQXdzQ2FsbGJhY2s8YXdzLkVDMi5EZXNjcmliZVZwbkdhdGV3YXlzUmVzdWx0PikgPT4ge1xuICAgIGV4cGVjdChwYXJhbXMuRmlsdGVycykudG9FcXVhbChbXG4gICAgICB7IE5hbWU6ICdhdHRhY2htZW50LnZwYy1pZCcsIFZhbHVlczogW1ZwY0lkXSB9LFxuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC5zdGF0ZScsIFZhbHVlczogWydhdHRhY2hlZCddIH0sXG4gICAgICB7IE5hbWU6ICdzdGF0ZScsIFZhbHVlczogWydhdmFpbGFibGUnXSB9LFxuICAgIF0pO1xuICAgIHJldHVybiBjYihudWxsLCB7IFZwbkdhdGV3YXlzOiBvcHRpb25zLnZwbkdhdGV3YXlzIH0pO1xuICB9KTtcbn1cbiJdfQ==