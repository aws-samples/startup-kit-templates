import * as cfnDiff from '@aws-cdk/cloudformation-diff';
import * as cxapi from '@aws-cdk/cx-api';
/**
 * Pretty-prints the differences between two template states to the console.
 *
 * @param oldTemplate the old/current state of the stack.
 * @param newTemplate the new/target state of the stack.
 * @param strict      do not filter out AWS::CDK::Metadata
 * @param context     lines of context to use in arbitrary JSON diff
 *
 * @returns the count of differences that were rendered.
 */
export declare function printStackDiff(oldTemplate: any, newTemplate: cxapi.CloudFormationStackArtifact, strict: boolean, context: number, stream?: cfnDiff.FormatStream): number;
export declare enum RequireApproval {
    Never = "never",
    AnyChange = "any-change",
    Broadening = "broadening"
}
/**
 * Print the security changes of this diff, if the change is impactful enough according to the approval level
 *
 * Returns true if the changes are prompt-worthy, false otherwise.
 */
export declare function printSecurityDiff(oldTemplate: any, newTemplate: cxapi.CloudFormationStackArtifact, requireApproval: RequireApproval): boolean;
