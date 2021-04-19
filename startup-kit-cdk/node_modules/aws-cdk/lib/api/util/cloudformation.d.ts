import { CloudFormation } from 'aws-sdk';
import { StackStatus } from './cloudformation/stack-status';
export declare type Template = {
    Parameters?: Record<string, TemplateParameter>;
    [key: string]: any;
};
interface TemplateParameter {
    Type: string;
    Default?: any;
    [key: string]: any;
}
/**
 * Represents an (existing) Stack in CloudFormation
 *
 * Bundle and cache some information that we need during deployment (so we don't have to make
 * repeated calls to CloudFormation).
 */
export declare class CloudFormationStack {
    private readonly cfn;
    readonly stackName: string;
    private readonly stack?;
    static lookup(cfn: CloudFormation, stackName: string): Promise<CloudFormationStack>;
    /**
     * Return a copy of the given stack that does not exist
     *
     * It's a little silly that it needs arguments to do that, but there we go.
     */
    static doesNotExist(cfn: CloudFormation, stackName: string): CloudFormationStack;
    /**
     * From static information (for testing)
     */
    static fromStaticInformation(cfn: CloudFormation, stackName: string, stack: CloudFormation.Stack): CloudFormationStack;
    private _template;
    protected constructor(cfn: CloudFormation, stackName: string, stack?: CloudFormation.Stack | undefined);
    /**
     * Retrieve the stack's deployed template
     *
     * Cached, so will only be retrieved once. Will return an empty
     * structure if the stack does not exist.
     */
    template(): Promise<Template>;
    /**
     * Whether the stack exists
     */
    get exists(): boolean;
    /**
     * The stack's ID
     *
     * Throws if the stack doesn't exist.
     */
    get stackId(): string;
    /**
     * The stack's current outputs
     *
     * Empty object if the stack doesn't exist
     */
    get outputs(): Record<string, string>;
    /**
     * The stack's status
     *
     * Special status NOT_FOUND if the stack does not exist.
     */
    get stackStatus(): StackStatus;
    /**
     * The stack's current tags
     *
     * Empty list of the stack does not exist
     */
    get tags(): CloudFormation.Tags;
    /**
     * Return the names of all current parameters to the stack
     *
     * Empty list if the stack does not exist.
     */
    get parameterNames(): string[];
    /**
     * Return the names and values of all current parameters to the stack
     *
     * Empty object if the stack does not exist.
     */
    get parameters(): Record<string, string>;
    /**
     * Return the termination protection of the stack
     */
    get terminationProtection(): boolean | undefined;
    private assertExists;
}
/**
 * Waits for a ChangeSet to be available for triggering a StackUpdate.
 *
 * Will return a changeset that is either ready to be executed or has no changes.
 * Will throw in other cases.
 *
 * @param cfn       a CloudFormation client
 * @param stackName   the name of the Stack that the ChangeSet belongs to
 * @param changeSetName the name of the ChangeSet
 *
 * @returns       the CloudFormation description of the ChangeSet
 */
export declare function waitForChangeSet(cfn: CloudFormation, stackName: string, changeSetName: string): Promise<CloudFormation.DescribeChangeSetOutput>;
/**
 * Return true if the given change set has no changes
 *
 * This must be determined from the status, not the 'Changes' array on the
 * object; the latter can be empty because no resources were changed, but if
 * there are changes to Outputs, the change set can still be executed.
 */
export declare function changeSetHasNoChanges(description: CloudFormation.DescribeChangeSetOutput): boolean;
/**
 * Waits for a CloudFormation stack to stabilize in a complete/available state
 * after a delete operation is issued.
 *
 * Fails if the stack is in a FAILED state. Will not fail if the stack was
 * already deleted.
 *
 * @param cfn        a CloudFormation client
 * @param stackName      the name of the stack to wait for after a delete
 *
 * @returns     the CloudFormation description of the stabilized stack after the delete attempt
 */
export declare function waitForStackDelete(cfn: CloudFormation, stackName: string): Promise<CloudFormationStack | undefined>;
/**
 * Waits for a CloudFormation stack to stabilize in a complete/available state
 * after an update/create operation is issued.
 *
 * Fails if the stack is in a FAILED state, ROLLBACK state, or DELETED state.
 *
 * @param cfn        a CloudFormation client
 * @param stackName      the name of the stack to wait for after an update
 *
 * @returns     the CloudFormation description of the stabilized stack after the update attempt
 */
export declare function waitForStackDeploy(cfn: CloudFormation, stackName: string): Promise<CloudFormationStack | undefined>;
/**
 * Wait for a stack to become stable (no longer _IN_PROGRESS), returning it
 */
export declare function stabilizeStack(cfn: CloudFormation, stackName: string): Promise<CloudFormationStack | undefined>;
/**
 * The set of (formal) parameters that have been declared in a template
 */
export declare class TemplateParameters {
    private readonly params;
    static fromTemplate(template: Template): TemplateParameters;
    constructor(params: Record<string, TemplateParameter>);
    /**
     * Calculate stack parameters to pass from the given desired parameter values
     *
     * Will throw if parameters without a Default value or a Previous value are not
     * supplied.
     */
    supplyAll(updates: Record<string, string | undefined>): ParameterValues;
    /**
     * From the template, the given desired values and the current values, calculate the changes to the stack parameters
     *
     * Will take into account parameters already set on the template (will emit
     * 'UsePreviousValue: true' for those unless the value is changed), and will
     * throw if parameters without a Default value or a Previous value are not
     * supplied.
     */
    updateExisting(updates: Record<string, string | undefined>, previousValues: Record<string, string>): ParameterValues;
}
/**
 * The set of parameters we're going to pass to a Stack
 */
export declare class ParameterValues {
    private readonly formalParams;
    readonly values: Record<string, string>;
    readonly apiParameters: CloudFormation.Parameter[];
    constructor(formalParams: Record<string, TemplateParameter>, updates: Record<string, string | undefined>, previousValues?: Record<string, string>);
    /**
     * Whether this set of parameter updates will change the actual stack values
     */
    hasChanges(currentValues: Record<string, string>): boolean;
}
export {};
