"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeSts = void 0;
const nock = require("nock");
const uuid = require("uuid");
const xmlJs = require("xml-js");
/**
 * Class for mocking AWS HTTP Requests and pretending to be STS
 *
 * This is necessary for testing our authentication layer. Most other mocking
 * libraries don't consider as they mock functional methods which happen BEFORE
 * the SDK's HTTP/Authentication layer.
 *
 * Instead, we want to validate how we're setting up credentials for the
 * SDK, so we pretend to be the STS server and have an in-memory database
 * of users and roles.
 */
class FakeSts {
    constructor() {
        this.assumedRoles = new Array();
        this.identities = {};
        this.roles = {};
    }
    /**
     * Begin mocking
     */
    begin() {
        const self = this;
        nock.disableNetConnect();
        if (!nock.isActive()) {
            nock.activate();
        }
        nock(/.*/).persist().post(/.*/).reply(function (uri, body, cb) {
            const parsedBody = typeof body === 'string' ? urldecode(body) : body;
            try {
                const response = self.handleRequest({
                    uri,
                    host: this.req.headers.host,
                    parsedBody,
                    headers: this.req.headers,
                });
                cb(null, [200, xmlJs.js2xml(response, { compact: true })]);
            }
            catch (e) {
                cb(null, [400, xmlJs.js2xml({
                        ErrorResponse: {
                            _attributes: { xmlns: 'https://sts.amazonaws.com/doc/2011-06-15/' },
                            Error: {
                                Type: 'Sender',
                                Code: 'Error',
                                Message: e.message,
                            },
                            RequestId: '1',
                        },
                    }, { compact: true })]);
            }
        });
        // Scrub some environment variables that might be set if we're running on CodeBuild which will interfere with the tests.
        delete process.env.AWS_PROFILE;
        delete process.env.AWS_REGION;
        delete process.env.AWS_DEFAULT_REGION;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        delete process.env.AWS_SESSION_TOKEN;
    }
    /**
     * Restore everything to normal
     */
    restore() {
        nock.restore(); // https://github.com/nock/nock/issues/1817
        nock.cleanAll();
        nock.enableNetConnect();
    }
    /**
     * Register a user
     */
    registerUser(account, accessKey, options = {}) {
        var _a, _b;
        const userName = (_a = options.name) !== null && _a !== void 0 ? _a : `User${Object.keys(this.identities).length + 1}`;
        this.identities[accessKey] = {
            account: account,
            arn: `arn:${(_b = options.partition) !== null && _b !== void 0 ? _b : 'aws'}:sts::${account}:user/${userName}`,
            userId: `${accessKey}:${userName}`,
        };
    }
    /**
     * Register an assumable role
     */
    registerRole(account, roleArn, options = {}) {
        var _a, _b;
        const roleName = (_a = options.name) !== null && _a !== void 0 ? _a : `Role${Object.keys(this.roles).length + 1}`;
        this.roles[roleArn] = {
            allowedAccounts: (_b = options.allowedAccounts) !== null && _b !== void 0 ? _b : [account],
            arn: roleArn,
            roleName,
            account,
        };
    }
    handleRequest(mockRequest) {
        const response = (() => {
            switch (mockRequest.parsedBody.Action) {
                case 'GetCallerIdentity':
                    return this.handleGetCallerIdentity(mockRequest);
                case 'AssumeRole':
                    return this.handleAssumeRole(mockRequest);
            }
            throw new Error(`Unrecognized Action in MockAwsHttp: ${mockRequest.parsedBody.Action}`);
        })();
        // console.log(mockRequest.parsedBody, '->', response);
        return response;
    }
    handleGetCallerIdentity(mockRequest) {
        const identity = this.identity(mockRequest);
        return {
            GetCallerIdentityResponse: {
                _attributes: { xmlns: 'https://sts.amazonaws.com/doc/2011-06-15/' },
                GetCallerIdentityResult: {
                    Arn: identity.arn,
                    UserId: identity.userId,
                    Account: identity.account,
                },
                ResponseMetadata: {
                    RequestId: '1',
                },
            },
        };
    }
    handleAssumeRole(mockRequest) {
        const identity = this.identity(mockRequest);
        this.assumedRoles.push({
            roleArn: mockRequest.parsedBody.RoleArn,
            roleSessionName: mockRequest.parsedBody.RoleSessionName,
            serialNumber: mockRequest.parsedBody.SerialNumber,
            tokenCode: mockRequest.parsedBody.TokenCode,
        });
        const roleArn = mockRequest.parsedBody.RoleArn;
        const targetRole = this.roles[roleArn];
        if (!targetRole) {
            throw new Error(`No such role: ${roleArn}`);
        }
        if (!targetRole.allowedAccounts.includes(identity.account)) {
            throw new Error(`Identity from account: ${identity.account} not allowed to assume ${roleArn}, must be one of: ${targetRole.allowedAccounts}`);
        }
        const freshAccessKey = uuid.v4();
        // Register a new "user" (identity) for this access key
        this.registerUser(targetRole.account, freshAccessKey, {
            name: `AssumedRole-${targetRole.roleName}-${identity.userId}`,
        });
        return {
            AssumeRoleResponse: {
                _attributes: { xmlns: 'https://sts.amazonaws.com/doc/2011-06-15/' },
                AssumeRoleResult: {
                    AssumedRoleUser: {
                        Arn: roleArn,
                        AssumedRoleId: `${freshAccessKey}:${targetRole.roleName}`,
                    },
                    Credentials: {
                        AccessKeyId: freshAccessKey,
                        SecretAccessKey: 'Secret',
                        SessionToken: 'Token',
                        Expiration: new Date(Date.now() + 3600 * 1000).toISOString(),
                    },
                    PackedPolicySize: 6,
                },
            },
            ResponseMetadata: {
                RequestId: '1',
            },
        };
    }
    identity(mockRequest) {
        const keyId = this.accessKeyId(mockRequest);
        const ret = this.identities[keyId];
        if (!ret) {
            throw new Error(`Unrecognized access key used: ${keyId}`);
        }
        return ret;
    }
    /**
     * Return the access key from a signed request
     */
    accessKeyId(mockRequest) {
        // "AWS4-HMAC-SHA256 Credential=(ab1a5e4c-ff41-4811-ac5f-6d1230f7aa90)access/20201210/eu-bla-5/sts/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=9b31011173a7842fa372d4ef7c431c08f0b1514fdaf54145560a4db7ecd24529"
        const auth = mockRequest.headers.authorization;
        const m = auth === null || auth === void 0 ? void 0 : auth.match(/Credential=([^\/]+)/);
        if (!m) {
            throw new Error(`No correct authorization header: ${auth}`);
        }
        return m[1];
    }
}
exports.FakeSts = FakeSts;
function urldecode(body) {
    const parts = body.split('&');
    const ret = {};
    for (const part of parts) {
        const [k, v] = part.split('=');
        ret[decodeURIComponent(k)] = decodeURIComponent(v);
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFrZS1zdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmYWtlLXN0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBNkI7QUFDN0IsNkJBQTZCO0FBQzdCLGdDQUFnQztBQXNCaEM7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQWEsT0FBTztJQU1sQjtRQUxnQixpQkFBWSxHQUFHLElBQUksS0FBSyxFQUFlLENBQUM7UUFFaEQsZUFBVSxHQUF1QyxFQUFFLENBQUM7UUFDcEQsVUFBSyxHQUFtQyxFQUFFLENBQUM7SUFHbkQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSztRQUNWLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztRQUVsQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3BCLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNqQjtRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQWdCLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRTtZQUNqRSxNQUFNLFVBQVUsR0FBRyxPQUFPLElBQUksS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBRXJFLElBQUk7Z0JBQ0YsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztvQkFDbEMsR0FBRztvQkFDSCxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSTtvQkFDM0IsVUFBVTtvQkFDVixPQUFPLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPO2lCQUMxQixDQUFDLENBQUM7Z0JBQ0gsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsTUFBTSxD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cnQgKiBhcyBub2NrIGZyb20gJ25vY2snO1xuaW1wb3J0ICogYXMgdXVpZCBmcm9tICd1dWlkJztcbmltcG9ydCAqIGFzIHhtbEpzIGZyb20gJ3htbC1qcyc7XG5cbmludGVyZmFjZSBSZWdpc3RlcmVkSWRlbnRpdHkge1xuICByZWFkb25seSBhY2NvdW50OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGFybjogc3RyaW5nO1xuICByZWFkb25seSB1c2VySWQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFJlZ2lzdGVyZWRSb2xlIHtcbiAgcmVhZG9ubHkgYWNjb3VudDogc3RyaW5nO1xuICByZWFkb25seSBhbGxvd2VkQWNjb3VudHM6IHN0cmluZ1tdO1xuICByZWFkb25seSBhcm46IHN0cmluZztcbiAgcmVhZG9ubHkgcm9sZU5hbWU6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEFzc3VtZWRSb2xlIHtcbiAgcmVhZG9ubHkgcm9sZUFybjogc3RyaW5nO1xuICByZWFkb25seSBzZXJpYWxOdW1iZXI6IHN0cmluZztcbiAgcmVhZG9ubHkgdG9rZW5Db2RlOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHJvbGVTZXNzaW9uTmFtZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIENsYXNzIGZvciBtb2NraW5nIEFXUyBIVFRQIFJlcXVlc3RzIGFuZCBwcmV0ZW5kaW5nIHRvIGJlIFNUU1xuICpcbiAqIFRoaXMgaXMgbmVjZXNzYXJ5IGZvciB0ZXN0aW5nIG91ciBhdXRoZW50aWNhdGlvbiBsYXllci4gTW9zdCBvdGhlciBtb2NraW5nXG4gKiBsaWJyYXJpZXMgZG9uJ3QgY29uc2lkZXIgYXMgdGhleSBtb2NrIGZ1bmN0aW9uYWwgbWV0aG9kcyB3aGljaCBoYXBwZW4gQkVGT1JFXG4gKiB0aGUgU0RLJ3MgSFRUUC9BdXRoZW50aWNhdGlvbiBsYXllci5cbiAqXG4gKiBJbnN0ZWFkLCB3ZSB3YW50IHRvIHZhbGlkYXRlIGhvdyB3ZSdyZSBzZXR0aW5nIHVwIGNyZWRlbnRpYWxzIGZvciB0aGVcbiAqIFNESywgc28gd2UgcHJldGVuZCB0byBiZSB0aGUgU1RTIHNlcnZlciBhbmQgaGF2ZSBhbiBpbi1tZW1vcnkgZGF0YWJhc2VcbiAqIG9mIHVzZXJzIGFuZCByb2xlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIEZha2VTdHMge1xuICBwdWJsaWMgcmVhZG9ubHkgYXNzdW1lZFJvbGVzID0gbmV3IEFycmF5PEFzc3VtZWRSb2xlPigpO1xuXG4gIHByaXZhdGUgaWRlbnRpdGllczogUmVjb3JkPHN0cmluZywgUmVnaXN0ZXJlZElkZW50aXR5PiA9IHt9O1xuICBwcml2YXRlIHJvbGVzOiBSZWNvcmQ8c3RyaW5nLCBSZWdpc3RlcmVkUm9sZT4gPSB7fTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWdpbiBtb2NraW5nXG4gICAqL1xuICBwdWJsaWMgYmVnaW4oKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBub2NrLmRpc2FibGVOZXRDb25uZWN0KCk7XG4gICAgaWYgKCFub2NrLmlzQWN0aXZlKCkpIHtcbiAgICAgIG5vY2suYWN0aXZhdGUoKTtcbiAgICB9XG4gICAgbm9jaygvLiovKS5wZXJzaXN0KCkucG9zdCgvLiovKS5yZXBseShmdW5jdGlvbiAodGhpcywgdXJpLCBib2R5LCBjYikge1xuICAgICAgY29uc3QgcGFyc2VkQm9keSA9IHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJyA/IHVybGRlY29kZShib2R5KSA6IGJvZHk7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gc2VsZi5oYW5kbGVSZXF1ZXN0KHtcbiAgICAgICAgICB1cmksXG4gICAgICAgICAgaG9zdDogdGhpcy5yZXEuaGVhZGVycy5ob3N0LFxuICAgICAgICAgIHBhcnNlZEJvZHksXG4gICAgICAgICAgaGVhZGVyczogdGhpcy5yZXEuaGVhZGVycyxcbiAgICAgICAgfSk7XG4gICAgICAgIGNiKG51bGwsIFsyMDAsIHhtbEpzLmpzMnhtbChyZXNwb25zZSwgeyBjb21wYWN0OiB0cnVlIH0pXSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNiKG51bGwsIFs0MDAsIHhtbEpzLmpzMnhtbCh7XG4gICAgICAgICAgRXJyb3JSZXNwb25zZToge1xuICAgICAgICAgICAgX2F0dHJpYnV0ZXM6IHsgeG1sbnM6ICdodHRwczovL3N0cy5hbWF6b25hd3MuY29tL2RvYy8yMDExLTA2LTE1LycgfSxcbiAgICAgICAgICAgIEVycm9yOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdTZW5kZXInLFxuICAgICAgICAgICAgICBDb2RlOiAnRXJyb3InLFxuICAgICAgICAgICAgICBNZXNzYWdlOiBlLm1lc3NhZ2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgUmVxdWVzdElkOiAnMScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSwgeyBjb21wYWN0OiB0cnVlIH0pXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBTY3J1YiBzb21lIGVudmlyb25tZW50IHZhcmlhYmxlcyB0aGF0IG1pZ2h0IGJlIHNldCBpZiB3ZSdyZSBydW5uaW5nIG9uIENvZGVCdWlsZCB3aGljaCB3aWxsIGludGVyZmVyZSB3aXRoIHRoZSB0ZXN0cy5cbiAgICBkZWxldGUgcHJvY2Vzcy5lbnYuQVdTX1BST0ZJTEU7XG4gICAgZGVsZXRlIHByb2Nlc3MuZW52LkFXU19SRUdJT047XG4gICAgZGVsZXRlIHByb2Nlc3MuZW52LkFXU19ERUZBVUxUX1JFR0lPTjtcbiAgICBkZWxldGUgcHJvY2Vzcy5lbnYuQVdTX0FDQ0VTU19LRVlfSUQ7XG4gICAgZGVsZXRlIHByb2Nlc3MuZW52LkFXU19TRUNSRVRfQUNDRVNTX0tFWTtcbiAgICBkZWxldGUgcHJvY2Vzcy5lbnYuQVdTX1NFU1NJT05fVE9LRU47XG4gIH1cblxuICAvKipcbiAgICogUmVzdG9yZSBldmVyeXRoaW5nIHRvIG5vcm1hbFxuICAgKi9cbiAgcHVibGljIHJlc3RvcmUoKSB7XG4gICAgbm9jay5yZXN0b3JlKCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2NrL25vY2svaXNzdWVzLzE4MTdcbiAgICBub2NrLmNsZWFuQWxsKCk7XG4gICAgbm9jay5lbmFibGVOZXRDb25uZWN0KCk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSB1c2VyXG4gICAqL1xuICBwdWJsaWMgcmVnaXN0ZXJVc2VyKGFjY291bnQ6IHN0cmluZywgYWNjZXNzS2V5OiBzdHJpbmcsIG9wdGlvbnM6IFJlZ2lzdGVyVXNlck9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHVzZXJOYW1lID0gb3B0aW9ucy5uYW1lID8/IGBVc2VyJHtPYmplY3Qua2V5cyh0aGlzLmlkZW50aXRpZXMpLmxlbmd0aCArIDEgfWA7XG5cbiAgICB0aGlzLmlkZW50aXRpZXNbYWNjZXNzS2V5XSA9IHtcbiAgICAgIGFjY291bnQ6IGFjY291bnQsXG4gICAgICBhcm46IGBhcm46JHtvcHRpb25zLnBhcnRpdGlvbiA/PyAnYXdzJ306c3RzOjoke2FjY291bnR9OnVzZXIvJHt1c2VyTmFtZX1gLFxuICAgICAgdXNlcklkOiBgJHthY2Nlc3NLZXl9OiR7dXNlck5hbWV9YCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGFuIGFzc3VtYWJsZSByb2xlXG4gICAqL1xuICBwdWJsaWMgcmVnaXN0ZXJSb2xlKGFjY291bnQ6IHN0cmluZywgcm9sZUFybjogc3RyaW5nLCBvcHRpb25zOiBSZWdpc3RlclJvbGVPcHRpb25zID0ge30pIHtcbiAgICBjb25zdCByb2xlTmFtZSA9IG9wdGlvbnMubmFtZSA/PyBgUm9sZSR7T2JqZWN0LmtleXModGhpcy5yb2xlcykubGVuZ3RoICsgMSB9YDtcblxuICAgIHRoaXMucm9sZXNbcm9sZUFybl0gPSB7XG4gICAgICBhbGxvd2VkQWNjb3VudHM6IG9wdGlvbnMuYWxsb3dlZEFjY291bnRzID8/IFthY2NvdW50XSxcbiAgICAgIGFybjogcm9sZUFybixcbiAgICAgIHJvbGVOYW1lLFxuICAgICAgYWNjb3VudCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVSZXF1ZXN0KG1vY2tSZXF1ZXN0OiBNb2NrUmVxdWVzdCk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gKCgpID0+IHtcbiAgICAgIHN3aXRjaCAobW9ja1JlcXVlc3QucGFyc2VkQm9keS5BY3Rpb24pIHtcbiAgICAgICAgY2FzZSAnR2V0Q2FsbGVySWRlbnRpdHknOlxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUdldENhbGxlcklkZW50aXR5KG1vY2tSZXF1ZXN0KTtcblxuICAgICAgICBjYXNlICdBc3N1bWVSb2xlJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVBc3N1bWVSb2xlKG1vY2tSZXF1ZXN0KTtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgQWN0aW9uIGluIE1vY2tBd3NIdHRwOiAke21vY2tSZXF1ZXN0LnBhcnNlZEJvZHkuQWN0aW9ufWApO1xuICAgIH0pKCk7XG4gICAgLy8gY29uc29sZS5sb2cobW9ja1JlcXVlc3QucGFyc2VkQm9keSwgJy0+JywgcmVzcG9uc2UpO1xuICAgIHJldHVybiByZXNwb25zZTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlR2V0Q2FsbGVySWRlbnRpdHkobW9ja1JlcXVlc3Q6IE1vY2tSZXF1ZXN0KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgY29uc3QgaWRlbnRpdHkgPSB0aGlzLmlkZW50aXR5KG1vY2tSZXF1ZXN0KTtcbiAgICByZXR1cm4ge1xuICAgICAgR2V0Q2FsbGVySWRlbnRpdHlSZXNwb25zZToge1xuICAgICAgICBfYXR0cmlidXRlczogeyB4bWxuczogJ2h0dHBzOi8vc3RzLmFtYXpvbmF3cy5jb20vZG9jLzIwMTEtMDYtMTUvJyB9LFxuICAgICAgICBHZXRDYWxsZXJJZGVudGl0eVJlc3VsdDoge1xuICAgICAgICAgIEFybjogaWRlbnRpdHkuYXJuLFxuICAgICAgICAgIFVzZXJJZDogaWRlbnRpdHkudXNlcklkLFxuICAgICAgICAgIEFjY291bnQ6IGlkZW50aXR5LmFjY291bnQsXG4gICAgICAgIH0sXG4gICAgICAgIFJlc3BvbnNlTWV0YWRhdGE6IHtcbiAgICAgICAgICBSZXF1ZXN0SWQ6ICcxJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlQXNzdW1lUm9sZShtb2NrUmVxdWVzdDogTW9ja1JlcXVlc3QpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICBjb25zdCBpZGVudGl0eSA9IHRoaXMuaWRlbnRpdHkobW9ja1JlcXVlc3QpO1xuXG4gICAgdGhpcy5hc3N1bWVkUm9sZXMucHVzaCh7XG4gICAgICByb2xlQXJuOiBtb2NrUmVxdWVzdC5wYXJzZWRCb2R5LlJvbGVBcm4sXG4gICAgICByb2xlU2Vzc2lvbk5hbWU6IG1vY2tSZXF1ZXN0LnBhcnNlZEJvZHkuUm9sZVNlc3Npb25OYW1lLFxuICAgICAgc2VyaWFsTnVtYmVyOiBtb2NrUmVxdWVzdC5wYXJzZWRCb2R5LlNlcmlhbE51bWJlcixcbiAgICAgIHRva2VuQ29kZTogbW9ja1JlcXVlc3QucGFyc2VkQm9keS5Ub2tlbkNvZGUsXG4gICAgfSk7XG5cbiAgICBjb25zdCByb2xlQXJuID0gbW9ja1JlcXVlc3QucGFyc2VkQm9keS5Sb2xlQXJuO1xuICAgIGNvbnN0IHRhcmdldFJvbGUgPSB0aGlzLnJvbGVzW3JvbGVBcm5dO1xuICAgIGlmICghdGFyZ2V0Um9sZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBzdWNoIHJvbGU6ICR7cm9sZUFybn1gKTtcbiAgICB9XG5cbiAgICBpZiAoIXRhcmdldFJvbGUuYWxsb3dlZEFjY291bnRzLmluY2x1ZGVzKGlkZW50aXR5LmFjY291bnQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYElkZW50aXR5IGZyb20gYWNjb3VudDogJHtpZGVudGl0eS5hY2NvdW50fSBub3QgYWxsb3dlZCB0byBhc3N1bWUgJHtyb2xlQXJufSwgbXVzdCBiZSBvbmUgb2Y6ICR7dGFyZ2V0Um9sZS5hbGxvd2VkQWNjb3VudHN9YCk7XG4gICAgfVxuXG4gICAgY29uc3QgZnJlc2hBY2Nlc3NLZXkgPSB1dWlkLnY0KCk7XG5cbiAgICAvLyBSZWdpc3RlciBhIG5ldyBcInVzZXJcIiAoaWRlbnRpdHkpIGZvciB0aGlzIGFjY2VzcyBrZXlcbiAgICB0aGlzLnJlZ2lzdGVyVXNlcih0YXJnZXRSb2xlLmFjY291bnQsIGZyZXNoQWNjZXNzS2V5LCB7XG4gICAgICBuYW1lOiBgQXNzdW1lZFJvbGUtJHt0YXJnZXRSb2xlLnJvbGVOYW1lfS0ke2lkZW50aXR5LnVzZXJJZH1gLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIEFzc3VtZVJvbGVSZXNwb25zZToge1xuICAgICAgICBfYXR0cmlidXRlczogeyB4bWxuczogJ2h0dHBzOi8vc3RzLmFtYXpvbmF3cy5jb20vZG9jLzIwMTEtMDYtMTUvJyB9LFxuICAgICAgICBBc3N1bWVSb2xlUmVzdWx0OiB7XG4gICAgICAgICAgQXNzdW1lZFJvbGVVc2VyOiB7XG4gICAgICAgICAgICBBcm46IHJvbGVBcm4sXG4gICAgICAgICAgICBBc3N1bWVkUm9sZUlkOiBgJHtmcmVzaEFjY2Vzc0tleX06JHt0YXJnZXRSb2xlLnJvbGVOYW1lfWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBDcmVkZW50aWFsczoge1xuICAgICAgICAgICAgQWNjZXNzS2V5SWQ6IGZyZXNoQWNjZXNzS2V5LFxuICAgICAgICAgICAgU2VjcmV0QWNjZXNzS2V5OiAnU2VjcmV0JyxcbiAgICAgICAgICAgIFNlc3Npb25Ub2tlbjogJ1Rva2VuJyxcbiAgICAgICAgICAgIEV4cGlyYXRpb246IG5ldyBEYXRlKERhdGUubm93KCkgKyAzNjAwICogMTAwMCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFBhY2tlZFBvbGljeVNpemU6IDYsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgUmVzcG9uc2VNZXRhZGF0YToge1xuICAgICAgICBSZXF1ZXN0SWQ6ICcxJyxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgaWRlbnRpdHkobW9ja1JlcXVlc3Q6IE1vY2tSZXF1ZXN0KSB7XG4gICAgY29uc3Qga2V5SWQgPSB0aGlzLmFjY2Vzc0tleUlkKG1vY2tSZXF1ZXN0KTtcbiAgICBjb25zdCByZXQgPSB0aGlzLmlkZW50aXRpZXNba2V5SWRdO1xuICAgIGlmICghcmV0KSB7IHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIGFjY2VzcyBrZXkgdXNlZDogJHtrZXlJZH1gKTsgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBhY2Nlc3Mga2V5IGZyb20gYSBzaWduZWQgcmVxdWVzdFxuICAgKi9cbiAgcHJpdmF0ZSBhY2Nlc3NLZXlJZChtb2NrUmVxdWVzdDogTW9ja1JlcXVlc3QpOiBzdHJpbmcge1xuICAgIC8vIFwiQVdTNC1ITUFDLVNIQTI1NiBDcmVkZW50aWFsPShhYjFhNWU0Yy1mZjQxLTQ4MTEtYWM1Zi02ZDEyMzBmN2FhOTApYWNjZXNzLzIwMjAxMjEwL2V1LWJsYS01L3N0cy9hd3M0X3JlcXVlc3QsIFNpZ25lZEhlYWRlcnM9aG9zdDt4LWFtei1jb250ZW50LXNoYTI1Njt4LWFtei1kYXRlLCBTaWduYXR1cmU9OWIzMTAxMTE3M2E3ODQyZmEzNzJkNGVmN2M0MzFjMDhmMGIxNTE0ZmRhZjU0MTQ1NTYwYTRkYjdlY2QyNDUyOVwiXG4gICAgY29uc3QgYXV0aCA9IG1vY2tSZXF1ZXN0LmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcblxuICAgIGNvbnN0IG0gPSBhdXRoPy5tYXRjaCgvQ3JlZGVudGlhbD0oW15cXC9dKykvKTtcbiAgICBpZiAoIW0pIHsgdGhyb3cgbmV3IEVycm9yKGBObyBjb3JyZWN0IGF1dGhvcml6YXRpb24gaGVhZGVyOiAke2F1dGh9YCk7IH1cbiAgICByZXR1cm4gbVsxXTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlZ2lzdGVyVXNlck9wdGlvbnMge1xuICByZWFkb25seSBuYW1lPzogc3RyaW5nO1xuICByZWFkb25seSBwYXJ0aXRpb24/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVnaXN0ZXJSb2xlT3B0aW9ucyB7XG4gIHJlYWRvbmx5IGFsbG93ZWRBY2NvdW50cz86IHN0cmluZ1tdO1xuICByZWFkb25seSBuYW1lPzogc3RyaW5nO1xuICByZWFkb25seSBwYXJ0aXRpb24/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBNb2NrUmVxdWVzdCB7XG4gIHJlYWRvbmx5IGhvc3Q6IHN0cmluZztcbiAgcmVhZG9ubHkgdXJpOiBzdHJpbmc7XG4gIHJlYWRvbmx5IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHJlYWRvbmx5IHBhcnNlZEJvZHk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmZ1bmN0aW9uIHVybGRlY29kZShib2R5OiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgY29uc3QgcGFydHMgPSBib2R5LnNwbGl0KCcmJyk7XG4gIGNvbnN0IHJldDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcbiAgICBjb25zdCBbaywgdl0gPSBwYXJ0LnNwbGl0KCc9Jyk7XG4gICAgcmV0W2RlY29kZVVSSUNvbXBvbmVudChrKV0gPSBkZWNvZGVVUklDb21wb25lbnQodik7XG4gIH1cbiAgcmV0dXJuIHJldDtcbn1cbiJdfQ==