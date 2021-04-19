"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyBootstrapTemplate = void 0;
const bootstrap_props_1 = require("./bootstrap-props");
function legacyBootstrapTemplate(params) {
    return {
        Description: 'The CDK Toolkit Stack. It was created by `cdk bootstrap` and manages resources necessary for managing your Cloud Applications with AWS CDK.',
        Conditions: {
            UsePublicAccessBlockConfiguration: {
                'Fn::Equals': [
                    params.publicAccessBlockConfiguration || params.publicAccessBlockConfiguration === undefined ? 'true' : 'false',
                    'true',
                ],
            },
        },
        Resources: {
            StagingBucket: {
                Type: 'AWS::S3::Bucket',
                Properties: {
                    BucketName: params.bucketName,
                    AccessControl: 'Private',
                    BucketEncryption: {
                        ServerSideEncryptionConfiguration: [{
                                ServerSideEncryptionByDefault: {
                                    SSEAlgorithm: 'aws:kms',
                                    KMSMasterKeyID: params.kmsKeyId,
                                },
                            }],
                    },
                    PublicAccessBlockConfiguration: {
                        'Fn::If': [
                            'UsePublicAccessBlockConfiguration',
                            {
                                BlockPublicAcls: true,
                                BlockPublicPolicy: true,
                                IgnorePublicAcls: true,
                                RestrictPublicBuckets: true,
                            },
                            { Ref: 'AWS::NoValue' },
                        ],
                    },
                },
            },
            StagingBucketPolicy: {
                Type: 'AWS::S3::BucketPolicy',
                Properties: {
                    Bucket: { Ref: 'StagingBucket' },
                    PolicyDocument: {
                        Id: 'AccessControl',
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Sid: 'AllowSSLRequestsOnly',
                                Action: 's3:*',
                                Effect: 'Deny',
                                Resource: [
                                    { 'Fn::Sub': '${StagingBucket.Arn}' },
                                    { 'Fn::Sub': '${StagingBucket.Arn}/*' },
                                ],
                                Condition: {
                                    Bool: { 'aws:SecureTransport': 'false' },
                                },
                                Principal: '*',
                            },
                        ],
                    },
                },
            },
        },
        Outputs: {
            [bootstrap_props_1.BUCKET_NAME_OUTPUT]: {
                Description: 'The name of the S3 bucket owned by the CDK toolkit stack',
                Value: { Ref: 'StagingBucket' },
            },
            [bootstrap_props_1.BUCKET_DOMAIN_NAME_OUTPUT]: {
                Description: 'The domain name of the S3 bucket owned by the CDK toolkit stack',
                Value: { 'Fn::GetAtt': ['StagingBucket', 'RegionalDomainName'] },
            },
        },
    };
}
exports.legacyBootstrapTemplate = legacyBootstrapTemplate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVnYWN5LXRlbXBsYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGVnYWN5LXRlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHVEQUEyRztBQUUzRyxTQUFnQix1QkFBdUIsQ0FBQyxNQUErQjtJQUNyRSxPQUFPO1FBQ0wsV0FBVyxFQUFFLDZJQUE2STtRQUMxSixVQUFVLEVBQUU7WUFDVixpQ0FBaUMsRUFBRTtnQkFDakMsWUFBWSxFQUFFO29CQUNaLE1BQU0sQ0FBQyw4QkFBOEIsSUFBSSxNQUFNLENBQUMsOEJBQThCLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU87b0JBQy9HLE1BQU07aUJBQ1A7YUFDRjtTQUNGO1FBQ0QsU0FBUyxFQUFFO1lBQ1QsYUFBYSxFQUFFO2dCQUNiLElBQUksRUFBRSxpQkFBaUI7Z0JBQ3ZCLFVBQVUsRUFBRTtvQkFDVixVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7b0JBQzdCLGFBQWEsRUFBRSxTQUFTO29CQUN4QixnQkFBZ0IsRUFBRTt3QkFDaEIsaUNBQWlDLEVBQUUsQ0FBQztnQ0FDbEMsNkJBQTZCLEVBQUU7b0NBQzdCLFlBQVksRUFBRSxTQUFTO29DQUN2QixjQUFjLEVBQUUsTUFBTSxDQUFDLFFBQVE7aUNBQ2hDOzZCQUNGLENBQUM7cUJBQ0g7b0JBQ0QsOEJBQThCLEVBQUU7d0JBQzlCLFFBQVEsRUFBRTs0QkFDUixtQ0FBbUM7NEJBQ25DO2dDQUNFLGVBQWUsRUFBRSxJQUFJO2dDQUNyQixpQkFBaUIsRUFBRSxJQUFJO2dDQUN2QixnQkFBZ0IsRUFBRSxJQUFJO2dDQUN0QixxQkFBcUIsRUFBRSxJQUFJOzZCQUM1Qjs0QkFDRCxFQUFFLEdBQUcsRUFBRSxjQUFjLEVBQUU7eUJBQ3hCO3FCQUNGO2lCQUNGO2FBQ0Y7WUFDRCxtQkFBbUIsRUFBRTtnQkFDbkIsSUFBSSxFQUFFLHVCQUF1QjtnQkFDN0IsVUFBVSxFQUFFO29CQUNWLE1BQU0sRUFBRSxFQUFFLEdBQUcsRUFBRSxlQUFlLEVBQUU7b0JBQ2hDLGNBQWMsRUFBRTt3QkFDZCxFQUFFLEVBQUUsZUFBZTt3QkFDbkIsT0FBTyxFQUFFLFlBQVk7d0JBQ3JCLFNBQVMsRUFBRTs0QkFDVDtnQ0FDRSxHQUFHLEVBQUUsc0JBQXNCO2dDQUMzQixNQUFNLEVBQUUsTUFBTTtnQ0FDZCxNQUFNLEVBQUUsTUFBTTtnQ0FDZCxRQUFRLEVBQUU7b0NBQ1IsRUFBRSxTQUFTLEVBQUUsc0JBQXNCLEVBQUU7b0NBQ3JDLEVBQUUsU0FBUyxFQUFFLHdCQUF3QixFQUFFO2lDQUN4QztnQ0FDRCxTQUFTLEVBQUU7b0NBQ1QsSUFBSSxFQUFFLEVBQUUscUJBQXFCLEVBQUUsT0FBTyxFQUFFO2lDQUN6QztnQ0FDRCxTQUFTLEVBQUUsR0FBRzs2QkFDZjt5QkFDRjtxQkFDRjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUU7WUFDUCxDQUFDLG9DQUFrQixDQUFDLEVBQUU7Z0JBQ3BCLFdBQVcsRUFBRSwwREFBMEQ7Z0JBQ3ZFLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxlQUFlLEVBQUU7YUFDaEM7WUFDRCxDQUFDLDJDQUF5QixDQUFDLEVBQUU7Z0JBQzNCLFdBQVcsRUFBRSxpRUFBaUU7Z0JBQzlFLEtBQUssRUFBRSxFQUFFLFlBQVksRUFBRSxDQUFDLGVBQWUsRUFBRSxvQkFBb0IsQ0FBQyxFQUFFO2FBQ2pFO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTVFRCwwREE0RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCb290c3RyYXBwaW5nUGFyYW1ldGVycywgQlVDS0VUX0RPTUFJTl9OQU1FX09VVFBVVCwgQlVDS0VUX05BTUVfT1VUUFVUIH0gZnJvbSAnLi9ib290c3RyYXAtcHJvcHMnO1xuXG5leHBvcnQgZnVuY3Rpb24gbGVnYWN5Qm9vdHN0cmFwVGVtcGxhdGUocGFyYW1zOiBCb290c3RyYXBwaW5nUGFyYW1ldGVycyk6IGFueSB7XG4gIHJldHVybiB7XG4gICAgRGVzY3JpcHRpb246ICdUaGUgQ0RLIFRvb2xraXQgU3RhY2suIEl0IHdhcyBjcmVhdGVkIGJ5IGBjZGsgYm9vdHN0cmFwYCBhbmQgbWFuYWdlcyByZXNvdXJjZXMgbmVjZXNzYXJ5IGZvciBtYW5hZ2luZyB5b3VyIENsb3VkIEFwcGxpY2F0aW9ucyB3aXRoIEFXUyBDREsuJyxcbiAgICBDb25kaXRpb25zOiB7XG4gICAgICBVc2VQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgJ0ZuOjpFcXVhbHMnOiBbXG4gICAgICAgICAgcGFyYW1zLnB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbiB8fCBwYXJhbXMucHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uID09PSB1bmRlZmluZWQgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgICAgICAgICd0cnVlJyxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBSZXNvdXJjZXM6IHtcbiAgICAgIFN0YWdpbmdCdWNrZXQ6IHtcbiAgICAgICAgVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICBCdWNrZXROYW1lOiBwYXJhbXMuYnVja2V0TmFtZSxcbiAgICAgICAgICBBY2Nlc3NDb250cm9sOiAnUHJpdmF0ZScsXG4gICAgICAgICAgQnVja2V0RW5jcnlwdGlvbjoge1xuICAgICAgICAgICAgU2VydmVyU2lkZUVuY3J5cHRpb25Db25maWd1cmF0aW9uOiBbe1xuICAgICAgICAgICAgICBTZXJ2ZXJTaWRlRW5jcnlwdGlvbkJ5RGVmYXVsdDoge1xuICAgICAgICAgICAgICAgIFNTRUFsZ29yaXRobTogJ2F3czprbXMnLFxuICAgICAgICAgICAgICAgIEtNU01hc3RlcktleUlEOiBwYXJhbXMua21zS2V5SWQsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgJ0ZuOjpJZic6IFtcbiAgICAgICAgICAgICAgJ1VzZVB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBCbG9ja1B1YmxpY0FjbHM6IHRydWUsXG4gICAgICAgICAgICAgICAgQmxvY2tQdWJsaWNQb2xpY3k6IHRydWUsXG4gICAgICAgICAgICAgICAgSWdub3JlUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBSZXN0cmljdFB1YmxpY0J1Y2tldHM6IHRydWUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHsgUmVmOiAnQVdTOjpOb1ZhbHVlJyB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIFN0YWdpbmdCdWNrZXRQb2xpY3k6IHtcbiAgICAgICAgVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldFBvbGljeScsXG4gICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICBCdWNrZXQ6IHsgUmVmOiAnU3RhZ2luZ0J1Y2tldCcgfSxcbiAgICAgICAgICBQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgSWQ6ICdBY2Nlc3NDb250cm9sJyxcbiAgICAgICAgICAgIFZlcnNpb246ICcyMDEyLTEwLTE3JyxcbiAgICAgICAgICAgIFN0YXRlbWVudDogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgU2lkOiAnQWxsb3dTU0xSZXF1ZXN0c09ubHknLFxuICAgICAgICAgICAgICAgIEFjdGlvbjogJ3MzOionLFxuICAgICAgICAgICAgICAgIEVmZmVjdDogJ0RlbnknLFxuICAgICAgICAgICAgICAgIFJlc291cmNlOiBbXG4gICAgICAgICAgICAgICAgICB7ICdGbjo6U3ViJzogJyR7U3RhZ2luZ0J1Y2tldC5Bcm59JyB9LFxuICAgICAgICAgICAgICAgICAgeyAnRm46OlN1Yic6ICcke1N0YWdpbmdCdWNrZXQuQXJufS8qJyB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgQ29uZGl0aW9uOiB7XG4gICAgICAgICAgICAgICAgICBCb29sOiB7ICdhd3M6U2VjdXJlVHJhbnNwb3J0JzogJ2ZhbHNlJyB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgUHJpbmNpcGFsOiAnKicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgT3V0cHV0czoge1xuICAgICAgW0JVQ0tFVF9OQU1FX09VVFBVVF06IHtcbiAgICAgICAgRGVzY3JpcHRpb246ICdUaGUgbmFtZSBvZiB0aGUgUzMgYnVja2V0IG93bmVkIGJ5IHRoZSBDREsgdG9vbGtpdCBzdGFjaycsXG4gICAgICAgIFZhbHVlOiB7IFJlZjogJ1N0YWdpbmdCdWNrZXQnIH0sXG4gICAgICB9LFxuICAgICAgW0JVQ0tFVF9ET01BSU5fTkFNRV9PVVRQVVRdOiB7XG4gICAgICAgIERlc2NyaXB0aW9uOiAnVGhlIGRvbWFpbiBuYW1lIG9mIHRoZSBTMyBidWNrZXQgb3duZWQgYnkgdGhlIENESyB0b29sa2l0IHN0YWNrJyxcbiAgICAgICAgVmFsdWU6IHsgJ0ZuOjpHZXRBdHQnOiBbJ1N0YWdpbmdCdWNrZXQnLCAnUmVnaW9uYWxEb21haW5OYW1lJ10gfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0iXX0=