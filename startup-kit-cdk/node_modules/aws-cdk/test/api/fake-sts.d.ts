interface AssumedRole {
    readonly roleArn: string;
    readonly serialNumber: string;
    readonly tokenCode: string;
    readonly roleSessionName: string;
}
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
export declare class FakeSts {
    readonly assumedRoles: AssumedRole[];
    private identities;
    private roles;
    constructor();
    /**
     * Begin mocking
     */
    begin(): void;
    /**
     * Restore everything to normal
     */
    restore(): void;
    /**
     * Register a user
     */
    registerUser(account: string, accessKey: string, options?: RegisterUserOptions): void;
    /**
     * Register an assumable role
     */
    registerRole(account: string, roleArn: string, options?: RegisterRoleOptions): void;
    private handleRequest;
    private handleGetCallerIdentity;
    private handleAssumeRole;
    private identity;
    /**
     * Return the access key from a signed request
     */
    private accessKeyId;
}
export interface RegisterUserOptions {
    readonly name?: string;
    readonly partition?: string;
}
export interface RegisterRoleOptions {
    readonly allowedAccounts?: string[];
    readonly name?: string;
    readonly partition?: string;
}
export {};
