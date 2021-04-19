"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk-mock");
const security_groups_1 = require("../../lib/context-providers/security-groups");
const mock_sdk_1 = require("../util/mock-sdk");
AWS.setSDK(require.resolve('aws-sdk'));
const mockSDK = new mock_sdk_1.MockSdkProvider();
afterEach(done => {
    AWS.restore();
    done();
});
describe('security group context provider plugin', () => {
    test('errors when no matches are found', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        AWS.mock('EC2', 'describeSecurityGroups', (_params, cb) => {
            cb(null, { SecurityGroups: [] });
        });
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
        })).rejects.toThrow(/No security groups found/i);
    });
    test('looks up by security group id', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        AWS.mock('EC2', 'describeSecurityGroups', (_params, cb) => {
            expect(_params).toEqual({ GroupIds: ['sg-1234'] });
            cb(null, {
                SecurityGroups: [
                    {
                        GroupId: 'sg-1234',
                        IpPermissionsEgress: [
                            {
                                IpProtocol: '-1',
                                IpRanges: [
                                    { CidrIp: '0.0.0.0/0' },
                                ],
                            },
                            {
                                IpProtocol: '-1',
                                Ipv6Ranges: [
                                    { CidrIpv6: '::/0' },
                                ],
                            },
                        ],
                    },
                ],
            });
        });
        // WHEN
        const res = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
        });
        // THEN
        expect(res.securityGroupId).toEqual('sg-1234');
        expect(res.allowAllOutbound).toEqual(true);
    });
    test('detects non all-outbound egress', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        AWS.mock('EC2', 'describeSecurityGroups', (_params, cb) => {
            expect(_params).toEqual({ GroupIds: ['sg-1234'] });
            cb(null, {
                SecurityGroups: [
                    {
                        GroupId: 'sg-1234',
                        IpPermissionsEgress: [
                            {
                                IpProtocol: '-1',
                                IpRanges: [
                                    { CidrIp: '10.0.0.0/16' },
                                ],
                            },
                        ],
                    },
                ],
            });
        });
        // WHEN
        const res = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
        });
        // THEN
        expect(res.securityGroupId).toEqual('sg-1234');
        expect(res.allowAllOutbound).toEqual(false);
    });
    test('identifies allTrafficEgress from SecurityGroup permissions', () => {
        expect(security_groups_1.hasAllTrafficEgress({
            IpPermissionsEgress: [
                {
                    IpProtocol: '-1',
                    IpRanges: [
                        { CidrIp: '0.0.0.0/0' },
                    ],
                },
                {
                    IpProtocol: '-1',
                    Ipv6Ranges: [
                        { CidrIpv6: '::/0' },
                    ],
                },
            ],
        })).toBe(true);
    });
    test('identifies allTrafficEgress from SecurityGroup permissions when combined', () => {
        expect(security_groups_1.hasAllTrafficEgress({
            IpPermissionsEgress: [
                {
                    IpProtocol: '-1',
                    IpRanges: [
                        { CidrIp: '0.0.0.0/0' },
                    ],
                    Ipv6Ranges: [
                        { CidrIpv6: '::/0' },
                    ],
                },
            ],
        })).toBe(true);
    });
    test('identifies lacking allTrafficEgress from SecurityGroup permissions', () => {
        expect(security_groups_1.hasAllTrafficEgress({
            IpPermissionsEgress: [
                {
                    IpProtocol: '-1',
                    IpRanges: [
                        { CidrIp: '10.0.0.0/16' },
                    ],
                },
            ],
        })).toBe(false);
        expect(security_groups_1.hasAllTrafficEgress({
            IpPermissions: [
                {
                    IpProtocol: 'TCP',
                    IpRanges: [
                        { CidrIp: '0.0.0.0/0' },
                    ],
                },
            ],
        })).toBe(false);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktZ3JvdXBzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1ncm91cHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLG9DQUFvQztBQUNwQyxpRkFBc0g7QUFDdEgsK0NBQW1EO0FBRW5ELEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBRXZDLE1BQU0sT0FBTyxHQUFHLElBQUksMEJBQWUsRUFBRSxDQUFDO0FBSXRDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUNmLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNkLElBQUksRUFBRSxDQUFDO0FBQ1QsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsd0NBQXdDLEVBQUUsR0FBRyxFQUFFO0lBQ3RELElBQUksQ0FBQyxrQ0FBa0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNsRCxRQUFRO1FBQ1IsTUFBTSxRQUFRLEdBQUcsSUFBSSxvREFBa0MsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVqRSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSx3QkFBd0IsRUFBRSxDQUFDLE9BQThDLEVBQUUsRUFBcUQsRUFBRSxFQUFFO1lBQ2xKLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxjQUFjLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLE1BQU0sQ0FDVixRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ2hCLE9BQU8sRUFBRSxNQUFNO1lBQ2YsTUFBTSxFQUFFLFdBQVc7WUFDbkIsZUFBZSxFQUFFLFNBQVM7U0FDM0IsQ0FBQyxDQUNILENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQ2pELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLCtCQUErQixFQUFFLEtBQUss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QztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXdzIGZyb20gJ2F3cy1zZGsnO1xuaW1wb3J0ICogYXMgQVdTIGZyb20gJ2F3cy1zZGstbW9jayc7XG5pbXBvcnQgeyBoYXNBbGxUcmFmZmljRWdyZXNzLCBTZWN1cml0eUdyb3VwQ29udGV4dFByb3ZpZGVyUGx1Z2luIH0gZnJvbSAnLi4vLi4vbGliL2NvbnRleHQtcHJvdmlkZXJzL3NlY3VyaXR5LWdyb3Vwcyc7XG5pbXBvcnQgeyBNb2NrU2RrUHJvdmlkZXIgfSBmcm9tICcuLi91dGlsL21vY2stc2RrJztcblxuQVdTLnNldFNESyhyZXF1aXJlLnJlc29sdmUoJ2F3cy1zZGsnKSk7XG5cbmNvbnN0IG1vY2tTREsgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG5cbnR5cGUgQXdzQ2FsbGJhY2s8VD4gPSAoZXJyOiBFcnJvciB8IG51bGwsIHZhbDogVCkgPT4gdm9pZDtcblxuYWZ0ZXJFYWNoKGRvbmUgPT4ge1xuICBBV1MucmVzdG9yZSgpO1xuICBkb25lKCk7XG59KTtcblxuZGVzY3JpYmUoJ3NlY3VyaXR5IGdyb3VwIGNvbnRleHQgcHJvdmlkZXIgcGx1Z2luJywgKCkgPT4ge1xuICB0ZXN0KCdlcnJvcnMgd2hlbiBubyBtYXRjaGVzIGFyZSBmb3VuZCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNlY3VyaXR5R3JvdXBDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICBBV1MubW9jaygnRUMyJywgJ2Rlc2NyaWJlU2VjdXJpdHlHcm91cHMnLCAoX3BhcmFtczogYXdzLkVDMi5EZXNjcmliZVNlY3VyaXR5R3JvdXBzUmVxdWVzdCwgY2I6IEF3c0NhbGxiYWNrPGF3cy5FQzIuRGVzY3JpYmVTZWN1cml0eUdyb3Vwc1Jlc3VsdD4pID0+IHtcbiAgICAgIGNiKG51bGwsIHsgU2VjdXJpdHlHcm91cHM6IFtdIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChcbiAgICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICBzZWN1cml0eUdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KC9ObyBzZWN1cml0eSBncm91cHMgZm91bmQvaSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2xvb2tzIHVwIGJ5IHNlY3VyaXR5IGdyb3VwIGlkJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgU2VjdXJpdHlHcm91cENvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIEFXUy5tb2NrKCdFQzInLCAnZGVzY3JpYmVTZWN1cml0eUdyb3VwcycsIChfcGFyYW1zOiBhd3MuRUMyLkRlc2NyaWJlU2VjdXJpdHlHcm91cHNSZXF1ZXN0LCBjYjogQXdzQ2FsbGJhY2s8YXdzLkVDMi5EZXNjcmliZVNlY3VyaXR5R3JvdXBzUmVzdWx0PikgPT4ge1xuICAgICAgZXhwZWN0KF9wYXJhbXMpLnRvRXF1YWwoeyBHcm91cElkczogWydzZy0xMjM0J10gfSk7XG4gICAgICBjYihudWxsLCB7XG4gICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgR3JvdXBJZDogJ3NnLTEyMzQnLFxuICAgICAgICAgICAgSXBQZXJtaXNzaW9uc0VncmVzczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgSXBQcm90b2NvbDogJy0xJyxcbiAgICAgICAgICAgICAgICBJcFJhbmdlczogW1xuICAgICAgICAgICAgICAgICAgeyBDaWRySXA6ICcwLjAuMC4wLzAnIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICAgICAgSXB2NlJhbmdlczogW1xuICAgICAgICAgICAgICAgICAgeyBDaWRySXB2NjogJzo6LzAnIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBzZWN1cml0eUdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QocmVzLnNlY3VyaXR5R3JvdXBJZCkudG9FcXVhbCgnc2ctMTIzNCcpO1xuICAgIGV4cGVjdChyZXMuYWxsb3dBbGxPdXRib3VuZCkudG9FcXVhbCh0cnVlKTtcbiAgfSk7XG5cbiAgdGVzdCgnZGV0ZWN0cyBub24gYWxsLW91dGJvdW5kIGVncmVzcycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNlY3VyaXR5R3JvdXBDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICBBV1MubW9jaygnRUMyJywgJ2Rlc2NyaWJlU2VjdXJpdHlHcm91cHMnLCAoX3BhcmFtczogYXdzLkVDMi5EZXNjcmliZVNlY3VyaXR5R3JvdXBzUmVxdWVzdCwgY2I6IEF3c0NhbGxiYWNrPGF3cy5FQzIuRGVzY3JpYmVTZWN1cml0eUdyb3Vwc1Jlc3VsdD4pID0+IHtcbiAgICAgIGV4cGVjdChfcGFyYW1zKS50b0VxdWFsKHsgR3JvdXBJZHM6IFsnc2ctMTIzNCddIH0pO1xuICAgICAgY2IobnVsbCwge1xuICAgICAgICBTZWN1cml0eUdyb3VwczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIEdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICAgICAgICAgIElwUGVybWlzc2lvbnNFZ3Jlc3M6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICAgICAgSXBSYW5nZXM6IFtcbiAgICAgICAgICAgICAgICAgIHsgQ2lkcklwOiAnMTAuMC4wLjAvMTYnIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBzZWN1cml0eUdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QocmVzLnNlY3VyaXR5R3JvdXBJZCkudG9FcXVhbCgnc2ctMTIzNCcpO1xuICAgIGV4cGVjdChyZXMuYWxsb3dBbGxPdXRib3VuZCkudG9FcXVhbChmYWxzZSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2lkZW50aWZpZXMgYWxsVHJhZmZpY0VncmVzcyBmcm9tIFNlY3VyaXR5R3JvdXAgcGVybWlzc2lvbnMnLCAoKSA9PiB7XG4gICAgZXhwZWN0KFxuICAgICAgaGFzQWxsVHJhZmZpY0VncmVzcyh7XG4gICAgICAgIElwUGVybWlzc2lvbnNFZ3Jlc3M6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBJcFByb3RvY29sOiAnLTEnLFxuICAgICAgICAgICAgSXBSYW5nZXM6IFtcbiAgICAgICAgICAgICAgeyBDaWRySXA6ICcwLjAuMC4wLzAnIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgSXBQcm90b2NvbDogJy0xJyxcbiAgICAgICAgICAgIElwdjZSYW5nZXM6IFtcbiAgICAgICAgICAgICAgeyBDaWRySXB2NjogJzo6LzAnIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICApLnRvQmUodHJ1ZSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2lkZW50aWZpZXMgYWxsVHJhZmZpY0VncmVzcyBmcm9tIFNlY3VyaXR5R3JvdXAgcGVybWlzc2lvbnMgd2hlbiBjb21iaW5lZCcsICgpID0+IHtcbiAgICBleHBlY3QoXG4gICAgICBoYXNBbGxUcmFmZmljRWdyZXNzKHtcbiAgICAgICAgSXBQZXJtaXNzaW9uc0VncmVzczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICBJcFJhbmdlczogW1xuICAgICAgICAgICAgICB7IENpZHJJcDogJzAuMC4wLjAvMCcgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBJcHY2UmFuZ2VzOiBbXG4gICAgICAgICAgICAgIHsgQ2lkcklwdjY6ICc6Oi8wJyB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgKS50b0JlKHRydWUpO1xuICB9KTtcblxuICB0ZXN0KCdpZGVudGlmaWVzIGxhY2tpbmcgYWxsVHJhZmZpY0VncmVzcyBmcm9tIFNlY3VyaXR5R3JvdXAgcGVybWlzc2lvbnMnLCAoKSA9PiB7XG4gICAgZXhwZWN0KFxuICAgICAgaGFzQWxsVHJhZmZpY0VncmVzcyh7XG4gICAgICAgIElwUGVybWlzc2lvbnNFZ3Jlc3M6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBJcFByb3RvY29sOiAnLTEnLFxuICAgICAgICAgICAgSXBSYW5nZXM6IFtcbiAgICAgICAgICAgICAgeyBDaWRySXA6ICcxMC4wLjAuMC8xNicgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICkudG9CZShmYWxzZSk7XG5cbiAgICBleHBlY3QoXG4gICAgICBoYXNBbGxUcmFmZmljRWdyZXNzKHtcbiAgICAgICAgSXBQZXJtaXNzaW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICdUQ1AnLFxuICAgICAgICAgICAgSXBSYW5nZXM6IFtcbiAgICAgICAgICAgICAgeyBDaWRySXA6ICcwLjAuMC4wLzAnIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICApLnRvQmUoZmFsc2UpO1xuICB9KTtcbn0pO1xuIl19