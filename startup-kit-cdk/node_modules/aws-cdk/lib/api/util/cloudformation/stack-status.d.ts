import * as AWS from 'aws-sdk';
/**
 * A utility class to inspect CloudFormation stack statuses.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-describing-stacks.html
 */
export declare class StackStatus {
    readonly name: string;
    readonly reason?: string | undefined;
    static fromStackDescription(description: AWS.CloudFormation.Stack): StackStatus;
    constructor(name: string, reason?: string | undefined);
    get isCreationFailure(): boolean;
    get isDeleted(): boolean;
    get isFailure(): boolean;
    get isInProgress(): boolean;
    get isNotFound(): boolean;
    get isDeploySuccess(): boolean;
    toString(): string;
}
