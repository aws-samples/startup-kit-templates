"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publish = void 0;
const os = require("os");
const lib_1 = require("../lib");
const logging_1 = require("./logging");
async function publish(args) {
    let manifest = lib_1.AssetManifest.fromPath(args.path);
    logging_1.log('verbose', `Loaded manifest from ${args.path}: ${manifest.entries.length} assets found`);
    if (args.assets && args.assets.length > 0) {
        const selection = args.assets.map(a => lib_1.DestinationPattern.parse(a));
        manifest = manifest.select(selection);
        logging_1.log('verbose', `Applied selection: ${manifest.entries.length} assets selected.`);
    }
    const pub = new lib_1.AssetPublishing(manifest, {
        aws: new DefaultAwsClient(args.profile),
        progressListener: new ConsoleProgress(),
        throwOnError: false,
    });
    await pub.publish();
    if (pub.hasFailures) {
        for (const failure of pub.failures) {
            // eslint-disable-next-line no-console
            console.error('Failure:', failure.error.stack);
        }
        process.exitCode = 1;
    }
}
exports.publish = publish;
const EVENT_TO_LEVEL = {
    build: 'verbose',
    cached: 'verbose',
    check: 'verbose',
    debug: 'verbose',
    fail: 'error',
    found: 'verbose',
    start: 'info',
    success: 'info',
    upload: 'verbose',
};
class ConsoleProgress {
    onPublishEvent(type, event) {
        logging_1.log(EVENT_TO_LEVEL[type], `[${event.percentComplete}%] ${type}: ${event.message}`);
    }
}
/**
 * AWS client using the AWS SDK for JS with no special configuration
 */
class DefaultAwsClient {
    constructor(profile) {
        // Force AWS SDK to look in ~/.aws/credentials and potentially use the configured profile.
        process.env.AWS_SDK_LOAD_CONFIG = '1';
        process.env.AWS_STS_REGIONAL_ENDPOINTS = 'regional';
        process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = '1';
        if (profile) {
            process.env.AWS_PROFILE = profile;
        }
        // We need to set the environment before we load this library for the first time.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        this.AWS = require('aws-sdk');
    }
    async s3Client(options) {
        return new this.AWS.S3(await this.awsOptions(options));
    }
    async ecrClient(options) {
        return new this.AWS.ECR(await this.awsOptions(options));
    }
    async discoverPartition() {
        return (await this.discoverCurrentAccount()).partition;
    }
    async discoverDefaultRegion() {
        return this.AWS.config.region || 'us-east-1';
    }
    async discoverCurrentAccount() {
        if (this.account === undefined) {
            const sts = new this.AWS.STS();
            const response = await sts.getCallerIdentity().promise();
            if (!response.Account || !response.Arn) {
                logging_1.log('error', `Unrecognized reponse from STS: '${JSON.stringify(response)}'`);
                throw new Error('Unrecognized reponse from STS');
            }
            this.account = {
                accountId: response.Account,
                partition: response.Arn.split(':')[1],
            };
        }
        return this.account;
    }
    async awsOptions(options) {
        let credentials;
        if (options.assumeRoleArn) {
            credentials = await this.assumeRole(options.region, options.assumeRoleArn, options.assumeRoleExternalId);
        }
        return {
            region: options.region,
            customUserAgent: `cdk-assets/${logging_1.VERSION}`,
            credentials,
        };
    }
    /**
     * Explicit manual AssumeRole call
     *
     * Necessary since I can't seem to get the built-in support for ChainableTemporaryCredentials to work.
     *
     * It needs an explicit configuration of `masterCredentials`, we need to put
     * a `DefaultCredentialProverChain()` in there but that is not possible.
     */
    async assumeRole(region, roleArn, externalId) {
        const msg = [
            `Assume ${roleArn}`,
            ...externalId ? [`(ExternalId ${externalId})`] : [],
        ];
        logging_1.log('verbose', msg.join(' '));
        return new this.AWS.ChainableTemporaryCredentials({
            params: {
                RoleArn: roleArn,
                ExternalId: externalId,
                RoleSessionName: `cdk-assets-${safeUsername()}`,
            },
            stsConfig: {
                region,
                customUserAgent: `cdk-assets/${logging_1.VERSION}`,
            },
        });
    }
}
/**
 * Return the username with characters invalid for a RoleSessionName removed
 *
 * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters
 */
function safeUsername() {
    return os.userInfo().username.replace(/[^\w+=,.@-]/g, '@');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInB1Ymxpc2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUJBQXlCO0FBQ3pCLGdDQUdnQjtBQUVoQix1Q0FBbUQ7QUFFNUMsS0FBSyxVQUFVLE9BQU8sQ0FBQyxJQUk3QjtJQUVDLElBQUksUUFBUSxHQUFHLG1CQUFhLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqRCxhQUFHLENBQUMsU0FBUyxFQUFFLHdCQUF3QixJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxlQUFlLENBQUMsQ0FBQztJQUU3RixJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3pDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsd0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEUsUUFBUSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdEMsYUFBRyxDQUFDLFNBQVMsRUFBRSxzQkFBc0IsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLG1CQUFtQixDQUFDLENBQUM7S0FDbEY7SUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLHFCQUFlLENBQUMsUUFBUSxFQUFFO1FBQ3hDLEdBQUcsRUFBRSxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDdkMsZ0JBQWdCLEVBQUUsSUFBSSxlQUFlLEVBQUU7UUFDdkMsWUFBWSxFQUFFLEtBQUs7S0FDcEIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFcEIsSUFBSSxHQUFHLENBQUMsV0FBVyxFQUFFO1FBQ25CLEtBQUssTUFBTSxPQUFP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QUUsY0FBYyxpQkFBTyxFQUFFO2FBQ3pDO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsWUFBWTtJQUNuQixPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM3RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHtcbiAgQXNzZXRNYW5pZmVzdCwgQXNzZXRQdWJsaXNoaW5nLCBDbGllbnRPcHRpb25zLCBEZXN0aW5hdGlvblBhdHRlcm4sIEV2ZW50VHlwZSwgSUF3cyxcbiAgSVB1Ymxpc2hQcm9ncmVzcywgSVB1Ymxpc2hQcm9ncmVzc0xpc3RlbmVyLFxufSBmcm9tICcuLi9saWInO1xuaW1wb3J0IHsgQWNjb3VudCB9IGZyb20gJy4uL2xpYi9hd3MnO1xuaW1wb3J0IHsgbG9nLCBMb2dMZXZlbCwgVkVSU0lPTiB9IGZyb20gJy4vbG9nZ2luZyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwdWJsaXNoKGFyZ3M6IHtcbiAgcGF0aDogc3RyaW5nO1xuICBhc3NldHM/OiBzdHJpbmdbXTtcbiAgcHJvZmlsZT86IHN0cmluZztcbn0pIHtcblxuICBsZXQgbWFuaWZlc3QgPSBBc3NldE1hbmlmZXN0LmZyb21QYXRoKGFyZ3MucGF0aCk7XG4gIGxvZygndmVyYm9zZScsIGBMb2FkZWQgbWFuaWZlc3QgZnJvbSAke2FyZ3MucGF0aH06ICR7bWFuaWZlc3QuZW50cmllcy5sZW5ndGh9IGFzc2V0cyBmb3VuZGApO1xuXG4gIGlmIChhcmdzLmFzc2V0cyAmJiBhcmdzLmFzc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc2VsZWN0aW9uID0gYXJncy5hc3NldHMubWFwKGEgPT4gRGVzdGluYXRpb25QYXR0ZXJuLnBhcnNlKGEpKTtcbiAgICBtYW5pZmVzdCA9IG1hbmlmZXN0LnNlbGVjdChzZWxlY3Rpb24pO1xuICAgIGxvZygndmVyYm9zZScsIGBBcHBsaWVkIHNlbGVjdGlvbjogJHttYW5pZmVzdC5lbnRyaWVzLmxlbmd0aH0gYXNzZXRzIHNlbGVjdGVkLmApO1xuICB9XG5cbiAgY29uc3QgcHViID0gbmV3IEFzc2V0UHVibGlzaGluZyhtYW5pZmVzdCwge1xuICAgIGF3czogbmV3IERlZmF1bHRBd3NDbGllbnQoYXJncy5wcm9maWxlKSxcbiAgICBwcm9ncmVzc0xpc3RlbmVyOiBuZXcgQ29uc29sZVByb2dyZXNzKCksXG4gICAgdGhyb3dPbkVycm9yOiBmYWxzZSxcbiAgfSk7XG5cbiAgYXdhaXQgcHViLnB1Ymxpc2goKTtcblxuICBpZiAocHViLmhhc0ZhaWx1cmVzKSB7XG4gICAgZm9yIChjb25zdCBmYWlsdXJlIG9mIHB1Yi5mYWlsdXJlcykge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWx1cmU6JywgZmFpbHVyZS5lcnJvci5zdGFjayk7XG4gICAgfVxuXG4gICAgcHJvY2Vzcy5leGl0Q29kZSA9IDE7XG4gIH1cbn1cblxuY29uc3QgRVZFTlRfVE9fTEVWRUw6IFJlY29yZDxFdmVudFR5cGUsIExvZ0xldmVsPiA9IHtcbiAgYnVpbGQ6ICd2ZXJib3NlJyxcbiAgY2FjaGVkOiAndmVyYm9zZScsXG4gIGNoZWNrOiAndmVyYm9zZScsXG4gIGRlYnVnOiAndmVyYm9zZScsXG4gIGZhaWw6ICdlcnJvcicsXG4gIGZvdW5kOiAndmVyYm9zZScsXG4gIHN0YXJ0OiAnaW5mbycsXG4gIHN1Y2Nlc3M6ICdpbmZvJyxcbiAgdXBsb2FkOiAndmVyYm9zZScsXG59O1xuXG5jbGFzcyBDb25zb2xlUHJvZ3Jlc3MgaW1wbGVtZW50cyBJUHVibGlzaFByb2dyZXNzTGlzdGVuZXIge1xuICBwdWJsaWMgb25QdWJsaXNoRXZlbnQodHlwZTogRXZlbnRUeXBlLCBldmVudDogSVB1Ymxpc2hQcm9ncmVzcyk6IHZvaWQge1xuICAgIGxvZyhFVkVOVF9UT19MRVZFTFt0eXBlXSwgYFske2V2ZW50LnBlcmNlbnRDb21wbGV0ZX0lXSAke3R5cGV9OiAke2V2ZW50Lm1lc3NhZ2V9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBV1MgY2xpZW50IHVzaW5nIHRoZSBBV1MgU0RLIGZvciBKUyB3aXRoIG5vIHNwZWNpYWwgY29uZmlndXJhdGlvblxuICovXG5jbGFzcyBEZWZhdWx0QXdzQ2xpZW50IGltcGxlbWVudHMgSUF3cyB7XG4gIHByaXZhdGUgcmVhZG9ubHkgQVdTOiB0eXBlb2YgaW1wb3J0KCdhd3Mtc2RrJyk7XG4gIHByaXZhdGUgYWNjb3VudD86IEFjY291bnQ7XG5cbiAgY29uc3RydWN0b3IocHJvZmlsZT86IHN0cmluZykge1xuICAgIC8vIEZvcmNlIEFXUyBTREsgdG8gbG9vayBpbiB+Ly5hd3MvY3JlZGVudGlhbHMgYW5kIHBvdGVudGlhbGx5IHVzZSB0aGUgY29uZmlndXJlZCBwcm9maWxlLlxuICAgIHByb2Nlc3MuZW52LkFXU19TREtfTE9BRF9DT05GSUcgPSAnMSc7XG4gICAgcHJvY2Vzcy5lbnYuQVdTX1NUU19SRUdJT05BTF9FTkRQT0lOVFMgPSAncmVnaW9uYWwnO1xuICAgIHByb2Nlc3MuZW52LkFXU19OT0RFSlNfQ09OTkVDVElPTl9SRVVTRV9FTkFCTEVEID0gJzEnO1xuICAgIGlmIChwcm9maWxlKSB7XG4gICAgICBwcm9jZXNzLmVudi5BV1NfUFJPRklMRSA9IHByb2ZpbGU7XG4gICAgfVxuXG4gICAgLy8gV2UgbmVlZCB0byBzZXQgdGhlIGVudmlyb25tZW50IGJlZm9yZSB3ZSBsb2FkIHRoaXMgbGlicmFyeSBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHNcbiAgICB0aGlzLkFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBzM0NsaWVudChvcHRpb25zOiBDbGllbnRPcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLkFXUy5TMyhhd2FpdCB0aGlzLmF3c09wdGlvbnMob3B0aW9ucykpO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGVjckNsaWVudChvcHRpb25zOiBDbGllbnRPcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLkFXUy5FQ1IoYXdhaXQgdGhpcy5hd3NPcHRpb25zKG9wdGlvbnMpKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkaXNjb3ZlclBhcnRpdGlvbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5kaXNjb3ZlckN1cnJlbnRBY2NvdW50KCkpLnBhcnRpdGlvbjtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkaXNjb3ZlckRlZmF1bHRSZWdpb24oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gdGhpcy5BV1MuY29uZmlnLnJlZ2lvbiB8fCAndXMtZWFzdC0xJztcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkaXNjb3ZlckN1cnJlbnRBY2NvdW50KCk6IFByb21pc2U8QWNjb3VudD4ge1xuICAgIGlmICh0aGlzLmFjY291bnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3Qgc3RzID0gbmV3IHRoaXMuQVdTLlNUUygpO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzdHMuZ2V0Q2FsbGVySWRlbnRpdHkoKS5wcm9taXNlKCk7XG4gICAgICBpZiAoIXJlc3BvbnNlLkFjY291bnQgfHwgIXJlc3BvbnNlLkFybikge1xuICAgICAgICBsb2coJ2Vycm9yJywgYFVucmVjb2duaXplZCByZXBvbnNlIGZyb20gU1RTOiAnJHtKU09OLnN0cmluZ2lmeShyZXNwb25zZSl9J2ApO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VucmVjb2duaXplZCByZXBvbnNlIGZyb20gU1RTJyk7XG4gICAgICB9XG4gICAgICB0aGlzLmFjY291bnQgPSB7XG4gICAgICAgIGFjY291bnRJZDogcmVzcG9uc2UuQWNjb3VudCEsXG4gICAgICAgIHBhcnRpdGlvbjogcmVzcG9uc2UuQXJuIS5zcGxpdCgnOicpWzFdLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hY2NvdW50O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhd3NPcHRpb25zKG9wdGlvbnM6IENsaWVudE9wdGlvbnMpIHtcbiAgICBsZXQgY3JlZGVudGlhbHM7XG5cbiAgICBpZiAob3B0aW9ucy5hc3N1bWVSb2xlQXJuKSB7XG4gICAgICBjcmVkZW50aWFscyA9IGF3YWl0IHRoaXMuYXNzdW1lUm9sZShvcHRpb25zLnJlZ2lvbiwgb3B0aW9ucy5hc3N1bWVSb2xlQXJuLCBvcHRpb25zLmFzc3VtZVJvbGVFeHRlcm5hbElkKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgcmVnaW9uOiBvcHRpb25zLnJlZ2lvbixcbiAgICAgIGN1c3RvbVVzZXJBZ2VudDogYGNkay1hc3NldHMvJHtWRVJTSU9OfWAsXG4gICAgICBjcmVkZW50aWFscyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4cGxpY2l0IG1hbnVhbCBBc3N1bWVSb2xlIGNhbGxcbiAgICpcbiAgICogTmVjZXNzYXJ5IHNpbmNlIEkgY2FuJ3Qgc2VlbSB0byBnZXQgdGhlIGJ1aWx0LWluIHN1cHBvcnQgZm9yIENoYWluYWJsZVRlbXBvcmFyeUNyZWRlbnRpYWxzIHRvIHdvcmsuXG4gICAqXG4gICAqIEl0IG5lZWRzIGFuIGV4cGxpY2l0IGNvbmZpZ3VyYXRpb24gb2YgYG1hc3RlckNyZWRlbnRpYWxzYCwgd2UgbmVlZCB0byBwdXRcbiAgICogYSBgRGVmYXVsdENyZWRlbnRpYWxQcm92ZXJDaGFpbigpYCBpbiB0aGVyZSBidXQgdGhhdCBpcyBub3QgcG9zc2libGUuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGFzc3VtZVJvbGUocmVnaW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsIHJvbGVBcm46IHN0cmluZywgZXh0ZXJuYWxJZD86IHN0cmluZyk6IFByb21pc2U8QVdTLkNyZWRlbnRpYWxzPiB7XG4gICAgY29uc3QgbXNnID0gW1xuICAgICAgYEFzc3VtZSAke3JvbGVBcm59YCxcbiAgICAgIC4uLmV4dGVybmFsSWQgPyBbYChFeHRlcm5hbElkICR7ZXh0ZXJuYWxJZH0pYF0gOiBbXSxcbiAgICBdO1xuICAgIGxvZygndmVyYm9zZScsIG1zZy5qb2luKCcgJykpO1xuXG4gICAgcmV0dXJuIG5ldyB0aGlzLkFXUy5DaGFpbmFibGVUZW1wb3JhcnlDcmVkZW50aWFscyh7XG4gICAgICBwYXJhbXM6IHtcbiAgICAgICAgUm9sZUFybjogcm9sZUFybixcbiAgICAgICAgRXh0ZXJuYWxJZDogZXh0ZXJuYWxJZCxcbiAgICAgICAgUm9sZVNlc3Npb25OYW1lOiBgY2RrLWFzc2V0cy0ke3NhZmVVc2VybmFtZSgpfWAsXG4gICAgICB9LFxuICAgICAgc3RzQ29uZmlnOiB7XG4gICAgICAgIHJlZ2lvbixcbiAgICAgICAgY3VzdG9tVXNlckFnZW50OiBgY2RrLWFzc2V0cy8ke1ZFUlNJT059YCxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIHVzZXJuYW1lIHdpdGggY2hhcmFjdGVycyBpbnZhbGlkIGZvciBhIFJvbGVTZXNzaW9uTmFtZSByZW1vdmVkXG4gKlxuICogQHNlZSBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vU1RTL2xhdGVzdC9BUElSZWZlcmVuY2UvQVBJX0Fzc3VtZVJvbGUuaHRtbCNBUElfQXNzdW1lUm9sZV9SZXF1ZXN0UGFyYW1ldGVyc1xuICovXG5mdW5jdGlvbiBzYWZlVXNlcm5hbWUoKSB7XG4gIHJldHVybiBvcy51c2VySW5mbygpLnVzZXJuYW1lLnJlcGxhY2UoL1teXFx3Kz0sLkAtXS9nLCAnQCcpO1xufSJdfQ==