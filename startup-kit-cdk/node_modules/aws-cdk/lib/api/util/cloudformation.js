"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParameterValues = exports.TemplateParameters = exports.stabilizeStack = exports.waitForStackDeploy = exports.waitForStackDelete = exports.changeSetHasNoChanges = exports.waitForChangeSet = exports.CloudFormationStack = void 0;
const logging_1 = require("../../logging");
const serialize_1 = require("../../serialize");
const stack_status_1 = require("./cloudformation/stack-status");
/**
 * Represents an (existing) Stack in CloudFormation
 *
 * Bundle and cache some information that we need during deployment (so we don't have to make
 * repeated calls to CloudFormation).
 */
class CloudFormationStack {
    constructor(cfn, stackName, stack) {
        this.cfn = cfn;
        this.stackName = stackName;
        this.stack = stack;
    }
    static async lookup(cfn, stackName) {
        try {
            const response = await cfn.describeStacks({ StackName: stackName }).promise();
            return new CloudFormationStack(cfn, stackName, response.Stacks && response.Stacks[0]);
        }
        catch (e) {
            if (e.code === 'ValidationError' && e.message === `Stack with id ${stackName} does not exist`) {
                return new CloudFormationStack(cfn, stackName, undefined);
            }
            throw e;
        }
    }
    /**
     * Return a copy of the given stack that does not exist
     *
     * It's a little silly that it needs arguments to do that, but there we go.
     */
    static doesNotExist(cfn, stackName) {
        return new CloudFormationStack(cfn, stackName);
    }
    /**
     * From static information (for testing)
     */
    static fromStaticInformation(cfn, stackName, stack) {
        return new CloudFormationStack(cfn, stackName, stack);
    }
    /**
     * Retrieve the stack's deployed template
     *
     * Cached, so will only be retrieved once. Will return an empty
     * structure if the stack does not exist.
     */
    async template() {
        if (!this.exists) {
            return {};
        }
        if (this._template === undefined) {
            const response = await this.cfn.getTemplate({ StackName: this.stackName, TemplateStage: 'Original' }).promise();
            this._template = (response.TemplateBody && serialize_1.deserializeStructure(response.TemplateBody)) || {};
        }
        return this._template;
    }
    /**
     * Whether the stack exists
     */
    get exists() {
        return this.stack !== undefined;
    }
    /**
     * The stack's ID
     *
     * Throws if the stack doesn't exist.
     */
    get stackId() {
        this.assertExists();
        return this.stack.StackId;
    }
    /**
     * The stack's current outputs
     *
     * Empty object if the stack doesn't exist
     */
    get outputs() {
        if (!this.exists) {
            return {};
        }
        const result = {};
        (this.stack.Outputs || []).forEach(output => {
            result[output.OutputKey] = output.OutputValue;
        });
        return result;
    }
    /**
     * The stack's status
     *
     * Special status NOT_FOUND if the stack does not exist.
     */
    get stackStatus() {
        if (!this.exists) {
            return new stack_status_1.StackStatus('NOT_FOUND', 'Stack not found during lookup');
        }
        return stack_status_1.StackStatus.fromStackDescription(this.stack);
    }
    /**
     * The stack's current tags
     *
     * Empty list of the stack does not exist
     */
    get tags() {
        var _a;
        return ((_a = this.stack) === null || _a === void 0 ? void 0 : _a.Tags) || [];
    }
    /**
     * Return the names of all current parameters to the stack
     *
     * Empty list if the stack does not exist.
     */
    get parameterNames() {
        return Object.keys(this.parameters);
    }
    /**
     * Return the names and values of all current parameters to the stack
     *
     * Empty object if the stack does not exist.
     */
    get parameters() {
        var _a;
        if (!this.exists) {
            return {};
        }
        const ret = {};
        for (const param of (_a = this.stack.Parameters) !== null && _a !== void 0 ? _a : []) {
            ret[param.ParameterKey] = param.ParameterValue;
        }
        return ret;
    }
    /**
     * Return the termination protection of the stack
     */
    get terminationProtection() {
        var _a;
        return (_a = this.stack) === null || _a === void 0 ? void 0 : _a.EnableTerminationProtection;
    }
    assertExists() {
        if (!this.exists) {
            throw new Error(`No stack named '${this.stackName}'`);
        }
    }
}
exports.CloudFormationStack = CloudFormationStack;
/**
 * Describe a changeset in CloudFormation, regardless of its current state.
 *
 * @param cfn       a CloudFormation client
 * @param stackName   the name of the Stack the ChangeSet belongs to
 * @param changeSetName the name of the ChangeSet
 *
 * @returns       CloudFormation information about the ChangeSet
 */
async function describeChangeSet(cfn, stackName, changeSetName) {
    const response = await cfn.describeChangeSet({ StackName: stackName, ChangeSetName: changeSetName }).promise();
    return response;
}
/**
 * Waits for a function to return non-+undefined+ before returning.
 *
 * @param valueProvider a function that will return a value that is not +undefined+ once the wait should be over
 * @param timeout     the time to wait between two calls to +valueProvider+
 *
 * @returns       the value that was returned by +valueProvider+
 */
async function waitFor(valueProvider, timeout = 5000) {
    while (true) {
        const result = await valueProvider();
        if (result === null) {
            return undefined;
        }
        else if (result !== undefined) {
            return result;
        }
        await new Promise(cb => setTimeout(cb, timeout));
    }
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
// eslint-disable-next-line max-len
async function waitForChangeSet(cfn, stackName, changeSetName) {
    logging_1.debug('Waiting for changeset %s on stack %s to finish creating...', changeSetName, stackName);
    const ret = await waitFor(async () => {
        const description = await describeChangeSet(cfn, stackName, changeSetName);
        // The following doesn't use a switch because tsc will not allow fall-through, UNLESS it is allows
        // EVERYWHERE that uses this library directly or indirectly, which is undesirable.
        if (description.Status === 'CREATE_PENDING' || description.Status === 'CREATE_IN_PROGRESS') {
            logging_1.debug('Changeset %s on stack %s is still creating', changeSetName, stackName);
            return undefined;
        }
        if (description.Status === 'CREATE_COMPLETE' || changeSetHasNoChanges(description)) {
            return description;
        }
        // eslint-disable-next-line max-len
        throw new Error(`Failed to create ChangeSet ${changeSetName} on ${stackName}: ${description.Status || 'NO_STATUS'}, ${description.StatusReason || 'no reason provided'}`);
    });
    if (!ret) {
        throw new Error('Change set took too long to be created; aborting');
    }
    return ret;
}
exports.waitForChangeSet = waitForChangeSet;
/**
 * Return true if the given change set has no changes
 *
 * This must be determined from the status, not the 'Changes' array on the
 * object; the latter can be empty because no resources were changed, but if
 * there are changes to Outputs, the change set can still be executed.
 */
function changeSetHasNoChanges(description) {
    const noChangeErrorPrefixes = [
        // Error message for a regular template
        'The submitted information didn\'t contain changes.',
        // Error message when a Transform is involved (see #10650)
        'No updates are to be performed.',
    ];
    return description.Status === 'FAILED'
        && noChangeErrorPrefixes.some(p => { var _a; return ((_a = description.StatusReason) !== null && _a !== void 0 ? _a : '').startsWith(p); });
}
exports.changeSetHasNoChanges = changeSetHasNoChanges;
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
async function waitForStackDelete(cfn, stackName) {
    const stack = await stabilizeStack(cfn, stackName);
    if (!stack) {
        return undefined;
    }
    const status = stack.stackStatus;
    if (status.isFailure) {
        throw new Error(`The stack named ${stackName} is in a failed state. You may need to delete it from the AWS console : ${status}`);
    }
    else if (status.isDeleted) {
        return undefined;
    }
    return stack;
}
exports.waitForStackDelete = waitForStackDelete;
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
async function waitForStackDeploy(cfn, stackName) {
    const stack = await stabilizeStack(cfn, stackName);
    if (!stack) {
        return undefined;
    }
    const status = stack.stackStatus;
    if (status.isCreationFailure) {
        throw new Error(`The stack named ${stackName} failed creation, it may need to be manually deleted from the AWS console: ${status}`);
    }
    else if (!status.isDeploySuccess) {
        throw new Error(`The stack named ${stackName} failed to deploy: ${status}`);
    }
    return stack;
}
exports.waitForStackDeploy = waitForStackDeploy;
/**
 * Wait for a stack to become stable (no longer _IN_PROGRESS), returning it
 */
async function stabilizeStack(cfn, stackName) {
    logging_1.debug('Waiting for stack %s to finish creating or updating...', stackName);
    return waitFor(async () => {
        const stack = await CloudFormationStack.lookup(cfn, stackName);
        if (!stack.exists) {
            logging_1.debug('Stack %s does not exist', stackName);
            return null;
        }
        const status = stack.stackStatus;
        if (status.isInProgress) {
            logging_1.debug('Stack %s has an ongoing operation in progress and is not stable (%s)', stackName, status);
            return undefined;
        }
        return stack;
    });
}
exports.stabilizeStack = stabilizeStack;
/**
 * The set of (formal) parameters that have been declared in a template
 */
class TemplateParameters {
    constructor(params) {
        this.params = params;
    }
    static fromTemplate(template) {
        return new TemplateParameters(template.Parameters || {});
    }
    /**
     * Calculate stack parameters to pass from the given desired parameter values
     *
     * Will throw if parameters without a Default value or a Previous value are not
     * supplied.
     */
    supplyAll(updates) {
        return new ParameterValues(this.params, updates);
    }
    /**
     * From the template, the given desired values and the current values, calculate the changes to the stack parameters
     *
     * Will take into account parameters already set on the template (will emit
     * 'UsePreviousValue: true' for those unless the value is changed), and will
     * throw if parameters without a Default value or a Previous value are not
     * supplied.
     */
    updateExisting(updates, previousValues) {
        return new ParameterValues(this.params, updates, previousValues);
    }
}
exports.TemplateParameters = TemplateParameters;
/**
 * The set of parameters we're going to pass to a Stack
 */
class ParameterValues {
    constructor(formalParams, updates, previousValues = {}) {
        this.formalParams = formalParams;
        this.values = {};
        this.apiParameters = [];
        const missingRequired = new Array();
        for (const [key, formalParam] of Object.entries(this.formalParams)) {
            // Check updates first, then use the previous value (if available), then use
            // the default (if available).
            //
            // If we don't find a parameter value using any of these methods, then that's an error.
            const updatedValue = updates[key];
            if (updatedValue !== undefined) {
                this.values[key] = updatedValue;
                this.apiParameters.push({ ParameterKey: key, ParameterValue: updates[key] });
                continue;
            }
            if (key in previousValues) {
                this.values[key] = previousValues[key];
                this.apiParameters.push({ ParameterKey: key, UsePreviousValue: true });
                continue;
            }
            if (formalParam.Default !== undefined) {
                this.values[key] = formalParam.Default;
                continue;
            }
            // Oh no
            missingRequired.push(key);
        }
        if (missingRequired.length > 0) {
            throw new Error(`The following CloudFormation Parameters are missing a value: ${missingRequired.join(', ')}`);
        }
        // Just append all supplied overrides that aren't really expected (this
        // will fail CFN but maybe people made typos that they want to be notified
        // of)
        const unknownParam = ([key, _]) => this.formalParams[key] === undefined;
        const hasValue = ([_, value]) => !!value;
        for (const [key, value] of Object.entries(updates).filter(unknownParam).filter(hasValue)) {
            this.values[key] = value;
            this.apiParameters.push({ ParameterKey: key, ParameterValue: value });
        }
    }
    /**
     * Whether this set of parameter updates will change the actual stack values
     */
    hasChanges(currentValues) {
        // If any of the parameters are SSM parameters, deploying must always happen
        // because we can't predict what the values will be.
        if (Object.values(this.formalParams).some(p => p.Type.startsWith('AWS::SSM::Parameter::'))) {
            return true;
        }
        // Otherwise we're dirty if:
        // - any of the existing values are removed, or changed
        if (Object.entries(currentValues).some(([key, value]) => !(key in this.values) || value !== this.values[key])) {
            return true;
        }
        // - any of the values we're setting are new
        if (Object.keys(this.values).some(key => !(key in currentValues))) {
            return true;
        }
        return false;
    }
}
exports.ParameterValues = ParameterValues;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWRmb3JtYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjbG91ZGZvcm1hdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwyQ0FBc0M7QUFDdEMsK0NBQXVEO0FBQ3ZELGdFQUE0RDtBQWE1RDs7Ozs7R0FLRztBQUNILE1BQWEsbUJBQW1CO0lBK0I5QixZQUF1QyxHQUFtQixFQUFrQixTQUFpQixFQUFtQixLQUE0QjtRQUFyRyxRQUFHLEdBQUgsR0FBRyxDQUFnQjtRQUFrQixjQUFTLEdBQVQsU0FBUyxDQUFRO1FBQW1CLFVBQUssR0FBTCxLQUFLLENBQXVCO0lBQzVJLENBQUM7SUEvQk0sTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBbUIsRUFBRSxTQUFpQjtRQUMvRCxJQUFJO1lBQ0YsTUFBTSxRQUFRLEdBQUcsTUFBTSxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDOUUsT0FBTyxJQUFJLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDdkY7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNWLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxpQkFBaUIsSUFBSSxDQUFDLENBQUMsT0FBTyxLQUFLLGlCQUFpQixTQUFTLGlCQUFpQixFQUFFO2dCQUM3RixPQUFPLElBQUksbUJBQW1CLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQzthQUMzRDtZQUNELE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLE1BQU0sQ0FBQyxZQUFZLENBQUMsR0FBbUIsRUFBRSxTQUFpQjtRQUMvRCxPQUFPLElBQUksbUJBQW1CLENBQUMsR0FBRyxFQUFFLFNBQVMs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QUE0RTtRQUM1RSxvREFBb0Q7UUFDcEQsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEVBQUU7WUFDMUYsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELDRCQUE0QjtRQUM1Qix1REFBdUQ7UUFDdkQsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO1lBQzdHLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCw0Q0FBNEM7UUFDNUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLGFBQWEsQ0FBQyxDQUFDLEVBQUU7WUFDakUsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBNUVELDBDQTRFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENsb3VkRm9ybWF0aW9uIH0gZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgeyBkZWJ1ZyB9IGZyb20gJy4uLy4uL2xvZ2dpbmcnO1xuaW1wb3J0IHsgZGVzZXJpYWxpemVTdHJ1Y3R1cmUgfSBmcm9tICcuLi8uLi9zZXJpYWxpemUnO1xuaW1wb3J0IHsgU3RhY2tTdGF0dXMgfSBmcm9tICcuL2Nsb3VkZm9ybWF0aW9uL3N0YWNrLXN0YXR1cyc7XG5cbmV4cG9ydCB0eXBlIFRlbXBsYXRlID0ge1xuICBQYXJhbWV0ZXJzPzogUmVjb3JkPHN0cmluZywgVGVtcGxhdGVQYXJhbWV0ZXI+O1xuICBba2V5OiBzdHJpbmddOiBhbnk7XG59O1xuXG5pbnRlcmZhY2UgVGVtcGxhdGVQYXJhbWV0ZXIge1xuICBUeXBlOiBzdHJpbmc7XG4gIERlZmF1bHQ/OiBhbnk7XG4gIFtrZXk6IHN0cmluZ106IGFueTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIChleGlzdGluZykgU3RhY2sgaW4gQ2xvdWRGb3JtYXRpb25cbiAqXG4gKiBCdW5kbGUgYW5kIGNhY2hlIHNvbWUgaW5mb3JtYXRpb24gdGhhdCB3ZSBuZWVkIGR1cmluZyBkZXBsb3ltZW50IChzbyB3ZSBkb24ndCBoYXZlIHRvIG1ha2VcbiAqIHJlcGVhdGVkIGNhbGxzIHRvIENsb3VkRm9ybWF0aW9uKS5cbiAqL1xuZXhwb3J0IGNsYXNzIENsb3VkRm9ybWF0aW9uU3RhY2sge1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGxvb2t1cChjZm46IENsb3VkRm9ybWF0aW9uLCBzdGFja05hbWU6IHN0cmluZyk6IFByb21pc2U8Q2xvdWRGb3JtYXRpb25TdGFjaz4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNmbi5kZXNjcmliZVN0YWNrcyh7IFN0YWNrTmFtZTogc3RhY2tOYW1lIH0pLnByb21pc2UoKTtcbiAgICAgIHJldHVybiBuZXcgQ2xvdWRGb3JtYXRpb25TdGFjayhjZm4sIHN0YWNrTmFtZSwgcmVzcG9uc2UuU3RhY2tzICYmIHJlc3BvbnNlLlN0YWNrc1swXSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUuY29kZSA9PT0gJ1ZhbGlkYXRpb25FcnJvcicgJiYgZS5tZXNzYWdlID09PSBgU3RhY2sgd2l0aCBpZCAke3N0YWNrTmFtZX0gZG9lcyBub3QgZXhpc3RgKSB7XG4gICAgICAgIHJldHVybiBuZXcgQ2xvdWRGb3JtYXRpb25TdGFjayhjZm4sIHN0YWNrTmFtZSwgdW5kZWZpbmVkKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIGNvcHkgb2YgdGhlIGdpdmVuIHN0YWNrIHRoYXQgZG9lcyBub3QgZXhpc3RcbiAgICpcbiAgICogSXQncyBhIGxpdHRsZSBzaWxseSB0aGF0IGl0IG5lZWRzIGFyZ3VtZW50cyB0byBkbyB0aGF0LCBidXQgdGhlcmUgd2UgZ28uXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGRvZXNOb3RFeGlzdChjZm46IENsb3VkRm9ybWF0aW9uLCBzdGFja05hbWU6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgQ2xvdWRGb3JtYXRpb25TdGFjayhjZm4sIHN0YWNrTmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogRnJvbSBzdGF0aWMgaW5mb3JtYXRpb24gKGZvciB0ZXN0aW5nKVxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBmcm9tU3RhdGljSW5mb3JtYXRpb24oY2ZuOiBDbG91ZEZvcm1hdGlvbiwgc3RhY2tOYW1lOiBzdHJpbmcsIHN0YWNrOiBDbG91ZEZvcm1hdGlvbi5TdGFjaykge1xuICAgIHJldHVybiBuZXcgQ2xvdWRGb3JtYXRpb25TdGFjayhjZm4sIHN0YWNrTmFtZSwgc3RhY2spO1xuICB9XG5cbiAgcHJpdmF0ZSBfdGVtcGxhdGU6IGFueTtcblxuICBwcm90ZWN0ZWQgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBjZm46IENsb3VkRm9ybWF0aW9uLCBwdWJsaWMgcmVhZG9ubHkgc3RhY2tOYW1lOiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgc3RhY2s/OiBDbG91ZEZvcm1hdGlvbi5TdGFjaykge1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBzdGFjaydzIGRlcGxveWVkIHRlbXBsYXRlXG4gICAqXG4gICAqIENhY2hlZCwgc28gd2lsbCBvbmx5IGJlIHJldHJpZXZlZCBvbmNlLiBXaWxsIHJldHVybiBhbiBlbXB0eVxuICAgKiBzdHJ1Y3R1cmUgaWYgdGhlIHN0YWNrIGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgcHVibGljIGFzeW5jIHRlbXBsYXRlKCk6IFByb21pc2U8VGVtcGxhdGU+IHtcbiAgICBpZiAoIXRoaXMuZXhpc3RzKSB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3RlbXBsYXRlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jZm4uZ2V0VGVtcGxhdGUoeyBTdGFja05hbWU6IHRoaXMuc3RhY2tOYW1lLCBUZW1wbGF0ZVN0YWdlOiAnT3JpZ2luYWwnIH0pLnByb21pc2UoKTtcbiAgICAgIHRoaXMuX3RlbXBsYXRlID0gKHJlc3BvbnNlLlRlbXBsYXRlQm9keSAmJiBkZXNlcmlhbGl6ZVN0cnVjdHVyZShyZXNwb25zZS5UZW1wbGF0ZUJvZHkpKSB8fCB7fTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3RlbXBsYXRlO1xuICB9XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIHN0YWNrIGV4aXN0c1xuICAgKi9cbiAgcHVibGljIGdldCBleGlzdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhY2sgIT09IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc3RhY2sncyBJRFxuICAgKlxuICAgKiBUaHJvd3MgaWYgdGhlIHN0YWNrIGRvZXNuJ3QgZXhpc3QuXG4gICAqL1xuICBwdWJsaWMgZ2V0IHN0YWNrSWQoKSB7XG4gICAgdGhpcy5hc3NlcnRFeGlzdHMoKTtcbiAgICByZXR1cm4gdGhpcy5zdGFjayEuU3RhY2tJZCE7XG4gIH1cblxuICAvKipcbiAgICogVGhlIHN0YWNrJ3MgY3VycmVudCBvdXRwdXRzXG4gICAqXG4gICAqIEVtcHR5IG9iamVjdCBpZiB0aGUgc3RhY2sgZG9lc24ndCBleGlzdFxuICAgKi9cbiAgcHVibGljIGdldCBvdXRwdXRzKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICAgIGlmICghdGhpcy5leGlzdHMpIHsgcmV0dXJuIHt9OyB9XG4gICAgY29uc3QgcmVzdWx0OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgICh0aGlzLnN0YWNrIS5PdXRwdXRzIHx8IFtdKS5mb3JFYWNoKG91dHB1dCA9PiB7XG4gICAgICByZXN1bHRbb3V0cHV0Lk91dHB1dEtleSFdID0gb3V0cHV0Lk91dHB1dFZhbHVlITtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBzdGFjaydzIHN0YXR1c1xuICAgKlxuICAgKiBTcGVjaWFsIHN0YXR1cyBOT1RfRk9VTkQgaWYgdGhlIHN0YWNrIGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgcHVibGljIGdldCBzdGFja1N0YXR1cygpOiBTdGFja1N0YXR1cyB7XG4gICAgaWYgKCF0aGlzLmV4aXN0cykge1xuICAgICAgcmV0dXJuIG5ldyBTdGFja1N0YXR1cygnTk9UX0ZPVU5EJywgJ1N0YWNrIG5vdCBmb3VuZCBkdXJpbmcgbG9va3VwJyk7XG4gICAgfVxuICAgIHJldHVybiBTdGFja1N0YXR1cy5mcm9tU3RhY2tEZXNjcmlwdGlvbih0aGlzLnN0YWNrISk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIHN0YWNrJ3MgY3VycmVudCB0YWdzXG4gICAqXG4gICAqIEVtcHR5IGxpc3Qgb2YgdGhlIHN0YWNrIGRvZXMgbm90IGV4aXN0XG4gICAqL1xuICBwdWJsaWMgZ2V0IHRhZ3MoKTogQ2xvdWRGb3JtYXRpb24uVGFncyB7XG4gICAgcmV0dXJuIHRoaXMuc3RhY2s/LlRhZ3MgfHwgW107XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBuYW1lcyBvZiBhbGwgY3VycmVudCBwYXJhbWV0ZXJzIHRvIHRoZSBzdGFja1xuICAgKlxuICAgKiBFbXB0eSBsaXN0IGlmIHRoZSBzdGFjayBkb2VzIG5vdCBleGlzdC5cbiAgICovXG4gIHB1YmxpYyBnZXQgcGFyYW1ldGVyTmFtZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnBhcmFtZXRlcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgbmFtZXMgYW5kIHZhbHVlcyBvZiBhbGwgY3VycmVudCBwYXJhbWV0ZXJzIHRvIHRoZSBzdGFja1xuICAgKlxuICAgKiBFbXB0eSBvYmplY3QgaWYgdGhlIHN0YWNrIGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgcHVibGljIGdldCBwYXJhbWV0ZXJzKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICAgIGlmICghdGhpcy5leGlzdHMpIHsgcmV0dXJuIHt9OyB9XG4gICAgY29uc3QgcmV0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChjb25zdCBwYXJhbSBvZiB0aGlzLnN0YWNrIS5QYXJhbWV0ZXJzID8/IFtdKSB7XG4gICAgICByZXRbcGFyYW0uUGFyYW1ldGVyS2V5IV0gPSBwYXJhbS5QYXJhbWV0ZXJWYWx1ZSE7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSB0ZXJtaW5hdGlvbiBwcm90ZWN0aW9uIG9mIHRoZSBzdGFja1xuICAgKi9cbiAgcHVibGljIGdldCB0ZXJtaW5hdGlvblByb3RlY3Rpb24oKTogYm9vbGVhbiB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuc3RhY2s/LkVuYWJsZVRlcm1pbmF0aW9uUHJvdGVjdGlvbjtcbiAgfVxuXG4gIHByaXZhdGUgYXNzZXJ0RXhpc3RzKCkge1xuICAgIGlmICghdGhpcy5leGlzdHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gc3RhY2sgbmFtZWQgJyR7dGhpcy5zdGFja05hbWV9J2ApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERlc2NyaWJlIGEgY2hhbmdlc2V0IGluIENsb3VkRm9ybWF0aW9uLCByZWdhcmRsZXNzIG9mIGl0cyBjdXJyZW50IHN0YXRlLlxuICpcbiAqIEBwYXJhbSBjZm4gICAgICAgYSBDbG91ZEZvcm1hdGlvbiBjbGllbnRcbiAqIEBwYXJhbSBzdGFja05hbWUgICB0aGUgbmFtZSBvZiB0aGUgU3RhY2sgdGhlIENoYW5nZVNldCBiZWxvbmdzIHRvXG4gKiBAcGFyYW0gY2hhbmdlU2V0TmFtZSB0aGUgbmFtZSBvZiB0aGUgQ2hhbmdlU2V0XG4gKlxuICogQHJldHVybnMgICAgICAgQ2xvdWRGb3JtYXRpb24gaW5mb3JtYXRpb24gYWJvdXQgdGhlIENoYW5nZVNldFxuICovXG5hc3luYyBmdW5jdGlvbiBkZXNjcmliZUNoYW5nZVNldChjZm46IENsb3VkRm9ybWF0aW9uLCBzdGFja05hbWU6IHN0cmluZywgY2hhbmdlU2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxDbG91ZEZvcm1hdGlvbi5EZXNjcmliZUNoYW5nZVNldE91dHB1dD4ge1xuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNmbi5kZXNjcmliZUNoYW5nZVNldCh7IFN0YWNrTmFtZTogc3RhY2tOYW1lLCBDaGFuZ2VTZXROYW1lOiBjaGFuZ2VTZXROYW1lIH0pLnByb21pc2UoKTtcbiAgcmV0dXJuIHJlc3BvbnNlO1xufVxuXG4vKipcbiAqIFdhaXRzIGZvciBhIGZ1bmN0aW9uIHRvIHJldHVybiBub24tK3VuZGVmaW5lZCsgYmVmb3JlIHJldHVybmluZy5cbiAqXG4gKiBAcGFyYW0gdmFsdWVQcm92aWRlciBhIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXR1cm4gYSB2YWx1ZSB0aGF0IGlzIG5vdCArdW5kZWZpbmVkKyBvbmNlIHRoZSB3YWl0IHNob3VsZCBiZSBvdmVyXG4gKiBAcGFyYW0gdGltZW91dCAgICAgdGhlIHRpbWUgdG8gd2FpdCBiZXR3ZWVuIHR3byBjYWxscyB0byArdmFsdWVQcm92aWRlcitcbiAqXG4gKiBAcmV0dXJucyAgICAgICB0aGUgdmFsdWUgdGhhdCB3YXMgcmV0dXJuZWQgYnkgK3ZhbHVlUHJvdmlkZXIrXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHdhaXRGb3I8VD4odmFsdWVQcm92aWRlcjogKCkgPT4gUHJvbWlzZTxUIHwgbnVsbCB8IHVuZGVmaW5lZD4sIHRpbWVvdXQ6IG51bWJlciA9IDUwMDApOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB2YWx1ZVByb3ZpZGVyKCk7XG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9IGVsc2UgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBhd2FpdCBuZXcgUHJvbWlzZShjYiA9PiBzZXRUaW1lb3V0KGNiLCB0aW1lb3V0KSk7XG4gIH1cbn1cblxuLyoqXG4gKiBXYWl0cyBmb3IgYSBDaGFuZ2VTZXQgdG8gYmUgYXZhaWxhYmxlIGZvciB0cmlnZ2VyaW5nIGEgU3RhY2tVcGRhdGUuXG4gKlxuICogV2lsbCByZXR1cm4gYSBjaGFuZ2VzZXQgdGhhdCBpcyBlaXRoZXIgcmVhZHkgdG8gYmUgZXhlY3V0ZWQgb3IgaGFzIG5vIGNoYW5nZXMuXG4gKiBXaWxsIHRocm93IGluIG90aGVyIGNhc2VzLlxuICpcbiAqIEBwYXJhbSBjZm4gICAgICAgYSBDbG91ZEZvcm1hdGlvbiBjbGllbnRcbiAqIEBwYXJhbSBzdGFja05hbWUgICB0aGUgbmFtZSBvZiB0aGUgU3RhY2sgdGhhdCB0aGUgQ2hhbmdlU2V0IGJlbG9uZ3MgdG9cbiAqIEBwYXJhbSBjaGFuZ2VTZXROYW1lIHRoZSBuYW1lIG9mIHRoZSBDaGFuZ2VTZXRcbiAqXG4gKiBAcmV0dXJucyAgICAgICB0aGUgQ2xvdWRGb3JtYXRpb24gZGVzY3JpcHRpb24gb2YgdGhlIENoYW5nZVNldFxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JDaGFuZ2VTZXQoY2ZuOiBDbG91ZEZvcm1hdGlvbiwgc3RhY2tOYW1lOiBzdHJpbmcsIGNoYW5nZVNldE5hbWU6IHN0cmluZyk6IFByb21pc2U8Q2xvdWRGb3JtYXRpb24uRGVzY3JpYmVDaGFuZ2VTZXRPdXRwdXQ+IHtcbiAgZGVidWcoJ1dhaXRpbmcgZm9yIGNoYW5nZXNldCAlcyBvbiBzdGFjayAlcyB0byBmaW5pc2ggY3JlYXRpbmcuLi4nLCBjaGFuZ2VTZXROYW1lLCBzdGFja05hbWUpO1xuICBjb25zdCByZXQgPSBhd2FpdCB3YWl0Rm9yKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGF3YWl0IGRlc2NyaWJlQ2hhbmdlU2V0KGNmbiwgc3RhY2tOYW1lLCBjaGFuZ2VTZXROYW1lKTtcbiAgICAvLyBUaGUgZm9sbG93aW5nIGRvZXNuJ3QgdXNlIGEgc3dpdGNoIGJlY2F1c2UgdHNjIHdpbGwgbm90IGFsbG93IGZhbGwtdGhyb3VnaCwgVU5MRVNTIGl0IGlzIGFsbG93c1xuICAgIC8vIEVWRVJZV0hFUkUgdGhhdCB1c2VzIHRoaXMgbGlicmFyeSBkaXJlY3RseSBvciBpbmRpcmVjdGx5LCB3aGljaCBpcyB1bmRlc2lyYWJsZS5cbiAgICBpZiAoZGVzY3JpcHRpb24uU3RhdHVzID09PSAnQ1JFQVRFX1BFTkRJTkcnIHx8IGRlc2NyaXB0aW9uLlN0YXR1cyA9PT0gJ0NSRUFURV9JTl9QUk9HUkVTUycpIHtcbiAgICAgIGRlYnVnKCdDaGFuZ2VzZXQgJXMgb24gc3RhY2sgJXMgaXMgc3RpbGwgY3JlYXRpbmcnLCBjaGFuZ2VTZXROYW1lLCBzdGFja05hbWUpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAoZGVzY3JpcHRpb24uU3RhdHVzID09PSAnQ1JFQVRFX0NPTVBMRVRFJyB8fCBjaGFuZ2VTZXRIYXNOb0NoYW5nZXMoZGVzY3JpcHRpb24pKSB7XG4gICAgICByZXR1cm4gZGVzY3JpcHRpb247XG4gICAgfVxuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgQ2hhbmdlU2V0ICR7Y2hhbmdlU2V0TmFtZX0gb24gJHtzdGFja05hbWV9OiAke2Rlc2NyaXB0aW9uLlN0YXR1cyB8fCAnTk9fU1RBVFVTJ30sICR7ZGVzY3JpcHRpb24uU3RhdHVzUmVhc29uIHx8ICdubyByZWFzb24gcHJvdmlkZWQnfWApO1xuICB9KTtcblxuICBpZiAoIXJldCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2hhbmdlIHNldCB0b29rIHRvbyBsb25nIHRvIGJlIGNyZWF0ZWQ7IGFib3J0aW5nJyk7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIHRoZSBnaXZlbiBjaGFuZ2Ugc2V0IGhhcyBubyBjaGFuZ2VzXG4gKlxuICogVGhpcyBtdXN0IGJlIGRldGVybWluZWQgZnJvbSB0aGUgc3RhdHVzLCBub3QgdGhlICdDaGFuZ2VzJyBhcnJheSBvbiB0aGVcbiAqIG9iamVjdDsgdGhlIGxhdHRlciBjYW4gYmUgZW1wdHkgYmVjYXVzZSBubyByZXNvdXJjZXMgd2VyZSBjaGFuZ2VkLCBidXQgaWZcbiAqIHRoZXJlIGFyZSBjaGFuZ2VzIHRvIE91dHB1dHMsIHRoZSBjaGFuZ2Ugc2V0IGNhbiBzdGlsbCBiZSBleGVjdXRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoYW5nZVNldEhhc05vQ2hhbmdlcyhkZXNjcmlwdGlvbjogQ2xvdWRGb3JtYXRpb24uRGVzY3JpYmVDaGFuZ2VTZXRPdXRwdXQpIHtcbiAgY29uc3Qgbm9DaGFuZ2VFcnJvclByZWZpeGVzID0gW1xuICAgIC8vIEVycm9yIG1lc3NhZ2UgZm9yIGEgcmVndWxhciB0ZW1wbGF0ZVxuICAgICdUaGUgc3VibWl0dGVkIGluZm9ybWF0aW9uIGRpZG5cXCd0IGNvbnRhaW4gY2hhbmdlcy4nLFxuICAgIC8vIEVycm9yIG1lc3NhZ2Ugd2hlbiBhIFRyYW5zZm9ybSBpcyBpbnZvbHZlZCAoc2VlICMxMDY1MClcbiAgICAnTm8gdXBkYXRlcyBhcmUgdG8gYmUgcGVyZm9ybWVkLicsXG4gIF07XG5cbiAgcmV0dXJuIGRlc2NyaXB0aW9uLlN0YXR1cyA9PT0gJ0ZBSUxFRCdcbiAgICAmJiBub0NoYW5nZUVycm9yUHJlZml4ZXMuc29tZShwID0+IChkZXNjcmlwdGlvbi5TdGF0dXNSZWFzb24gPz8gJycpLnN0YXJ0c1dpdGgocCkpO1xufVxuXG4vKipcbiAqIFdhaXRzIGZvciBhIENsb3VkRm9ybWF0aW9uIHN0YWNrIHRvIHN0YWJpbGl6ZSBpbiBhIGNvbXBsZXRlL2F2YWlsYWJsZSBzdGF0ZVxuICogYWZ0ZXIgYSBkZWxldGUgb3BlcmF0aW9uIGlzIGlzc3VlZC5cbiAqXG4gKiBGYWlscyBpZiB0aGUgc3RhY2sgaXMgaW4gYSBGQUlMRUQgc3RhdGUuIFdpbGwgbm90IGZhaWwgaWYgdGhlIHN0YWNrIHdhc1xuICogYWxyZWFkeSBkZWxldGVkLlxuICpcbiAqIEBwYXJhbSBjZm4gICAgICAgIGEgQ2xvdWRGb3JtYXRpb24gY2xpZW50XG4gKiBAcGFyYW0gc3RhY2tOYW1lICAgICAgdGhlIG5hbWUgb2YgdGhlIHN0YWNrIHRvIHdhaXQgZm9yIGFmdGVyIGEgZGVsZXRlXG4gKlxuICogQHJldHVybnMgICAgIHRoZSBDbG91ZEZvcm1hdGlvbiBkZXNjcmlwdGlvbiBvZiB0aGUgc3RhYmlsaXplZCBzdGFjayBhZnRlciB0aGUgZGVsZXRlIGF0dGVtcHRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JTdGFja0RlbGV0ZShcbiAgY2ZuOiBDbG91ZEZvcm1hdGlvbixcbiAgc3RhY2tOYW1lOiBzdHJpbmcpOiBQcm9taXNlPENsb3VkRm9ybWF0aW9uU3RhY2sgfCB1bmRlZmluZWQ+IHtcblxuICBjb25zdCBzdGFjayA9IGF3YWl0IHN0YWJpbGl6ZVN0YWNrKGNmbiwgc3RhY2tOYW1lKTtcbiAgaWYgKCFzdGFjaykgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cbiAgY29uc3Qgc3RhdHVzID0gc3RhY2suc3RhY2tTdGF0dXM7XG4gIGlmIChzdGF0dXMuaXNGYWlsdXJlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgc3RhY2sgbmFtZWQgJHtzdGFja05hbWV9IGlzIGluIGEgZmFpbGVkIHN0YXRlLiBZb3UgbWF5IG5lZWQgdG8gZGVsZXRlIGl0IGZyb20gdGhlIEFXUyBjb25zb2xlIDogJHtzdGF0dXN9YCk7XG4gIH0gZWxzZSBpZiAoc3RhdHVzLmlzRGVsZXRlZCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHN0YWNrO1xufVxuXG4vKipcbiAqIFdhaXRzIGZvciBhIENsb3VkRm9ybWF0aW9uIHN0YWNrIHRvIHN0YWJpbGl6ZSBpbiBhIGNvbXBsZXRlL2F2YWlsYWJsZSBzdGF0ZVxuICogYWZ0ZXIgYW4gdXBkYXRlL2NyZWF0ZSBvcGVyYXRpb24gaXMgaXNzdWVkLlxuICpcbiAqIEZhaWxzIGlmIHRoZSBzdGFjayBpcyBpbiBhIEZBSUxFRCBzdGF0ZSwgUk9MTEJBQ0sgc3RhdGUsIG9yIERFTEVURUQgc3RhdGUuXG4gKlxuICogQHBhcmFtIGNmbiAgICAgICAgYSBDbG91ZEZvcm1hdGlvbiBjbGllbnRcbiAqIEBwYXJhbSBzdGFja05hbWUgICAgICB0aGUgbmFtZSBvZiB0aGUgc3RhY2sgdG8gd2FpdCBmb3IgYWZ0ZXIgYW4gdXBkYXRlXG4gKlxuICogQHJldHVybnMgICAgIHRoZSBDbG91ZEZvcm1hdGlvbiBkZXNjcmlwdGlvbiBvZiB0aGUgc3RhYmlsaXplZCBzdGFjayBhZnRlciB0aGUgdXBkYXRlIGF0dGVtcHRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JTdGFja0RlcGxveShcbiAgY2ZuOiBDbG91ZEZvcm1hdGlvbixcbiAgc3RhY2tOYW1lOiBzdHJpbmcpOiBQcm9taXNlPENsb3VkRm9ybWF0aW9uU3RhY2sgfCB1bmRlZmluZWQ+IHtcblxuICBjb25zdCBzdGFjayA9IGF3YWl0IHN0YWJpbGl6ZVN0YWNrKGNmbiwgc3RhY2tOYW1lKTtcbiAgaWYgKCFzdGFjaykgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cbiAgY29uc3Qgc3RhdHVzID0gc3RhY2suc3RhY2tTdGF0dXM7XG5cbiAgaWYgKHN0YXR1cy5pc0NyZWF0aW9uRmFpbHVyZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhlIHN0YWNrIG5hbWVkICR7c3RhY2tOYW1lfSBmYWlsZWQgY3JlYXRpb24sIGl0IG1heSBuZWVkIHRvIGJlIG1hbnVhbGx5IGRlbGV0ZWQgZnJvbSB0aGUgQVdTIGNvbnNvbGU6ICR7c3RhdHVzfWApO1xuICB9IGVsc2UgaWYgKCFzdGF0dXMuaXNEZXBsb3lTdWNjZXNzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgc3RhY2sgbmFtZWQgJHtzdGFja05hbWV9IGZhaWxlZCB0byBkZXBsb3k6ICR7c3RhdHVzfWApO1xuICB9XG5cbiAgcmV0dXJuIHN0YWNrO1xufVxuXG4vKipcbiAqIFdhaXQgZm9yIGEgc3RhY2sgdG8gYmVjb21lIHN0YWJsZSAobm8gbG9uZ2VyIF9JTl9QUk9HUkVTUyksIHJldHVybmluZyBpdFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RhYmlsaXplU3RhY2soY2ZuOiBDbG91ZEZvcm1hdGlvbiwgc3RhY2tOYW1lOiBzdHJpbmcpIHtcbiAgZGVidWcoJ1dhaXRpbmcgZm9yIHN0YWNrICVzIHRvIGZpbmlzaCBjcmVhdGluZyBvciB1cGRhdGluZy4uLicsIHN0YWNrTmFtZSk7XG4gIHJldHVybiB3YWl0Rm9yKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzdGFjayA9IGF3YWl0IENsb3VkRm9ybWF0aW9uU3RhY2subG9va3VwKGNmbiwgc3RhY2tOYW1lKTtcbiAgICBpZiAoIXN0YWNrLmV4aXN0cykge1xuICAgICAgZGVidWcoJ1N0YWNrICVzIGRvZXMgbm90IGV4aXN0Jywgc3RhY2tOYW1lKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzdGF0dXMgPSBzdGFjay5zdGFja1N0YXR1cztcbiAgICBpZiAoc3RhdHVzLmlzSW5Qcm9ncmVzcykge1xuICAgICAgZGVidWcoJ1N0YWNrICVzIGhhcyBhbiBvbmdvaW5nIG9wZXJhdGlvbiBpbiBwcm9ncmVzcyBhbmQgaXMgbm90IHN0YWJsZSAoJXMpJywgc3RhY2tOYW1lLCBzdGF0dXMpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhY2s7XG4gIH0pO1xufVxuXG4vKipcbiAqIFRoZSBzZXQgb2YgKGZvcm1hbCkgcGFyYW1ldGVycyB0aGF0IGhhdmUgYmVlbiBkZWNsYXJlZCBpbiBhIHRlbXBsYXRlXG4gKi9cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVBhcmFtZXRlcnMge1xuICBwdWJsaWMgc3RhdGljIGZyb21UZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpIHtcbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlUGFyYW1ldGVycyh0ZW1wbGF0ZS5QYXJhbWV0ZXJzIHx8IHt9KTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCBUZW1wbGF0ZVBhcmFtZXRlcj4pIHtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhdGUgc3RhY2sgcGFyYW1ldGVycyB0byBwYXNzIGZyb20gdGhlIGdpdmVuIGRlc2lyZWQgcGFyYW1ldGVyIHZhbHVlc1xuICAgKlxuICAgKiBXaWxsIHRocm93IGlmIHBhcmFtZXRlcnMgd2l0aG91dCBhIERlZmF1bHQgdmFsdWUgb3IgYSBQcmV2aW91cyB2YWx1ZSBhcmUgbm90XG4gICAqIHN1cHBsaWVkLlxuICAgKi9cbiAgcHVibGljIHN1cHBseUFsbCh1cGRhdGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWQ+KTogUGFyYW1ldGVyVmFsdWVzIHtcbiAgICByZXR1cm4gbmV3IFBhcmFtZXRlclZhbHVlcyh0aGlzLnBhcmFtcywgdXBkYXRlcyk7XG4gIH1cblxuICAvKipcbiAgICogRnJvbSB0aGUgdGVtcGxhdGUsIHRoZSBnaXZlbiBkZXNpcmVkIHZhbHVlcyBhbmQgdGhlIGN1cnJlbnQgdmFsdWVzLCBjYWxjdWxhdGUgdGhlIGNoYW5nZXMgdG8gdGhlIHN0YWNrIHBhcmFtZXRlcnNcbiAgICpcbiAgICogV2lsbCB0YWtlIGludG8gYWNjb3VudCBwYXJhbWV0ZXJzIGFscmVhZHkgc2V0IG9uIHRoZSB0ZW1wbGF0ZSAod2lsbCBlbWl0XG4gICAqICdVc2VQcmV2aW91c1ZhbHVlOiB0cnVlJyBmb3IgdGhvc2UgdW5sZXNzIHRoZSB2YWx1ZSBpcyBjaGFuZ2VkKSwgYW5kIHdpbGxcbiAgICogdGhyb3cgaWYgcGFyYW1ldGVycyB3aXRob3V0IGEgRGVmYXVsdCB2YWx1ZSBvciBhIFByZXZpb3VzIHZhbHVlIGFyZSBub3RcbiAgICogc3VwcGxpZWQuXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlRXhpc3RpbmcodXBkYXRlczogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPiwgcHJldmlvdXNWYWx1ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBQYXJhbWV0ZXJWYWx1ZXMge1xuICAgIHJldHVybiBuZXcgUGFyYW1ldGVyVmFsdWVzKHRoaXMucGFyYW1zLCB1cGRhdGVzLCBwcmV2aW91c1ZhbHVlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGUgc2V0IG9mIHBhcmFtZXRlcnMgd2UncmUgZ29pbmcgdG8gcGFzcyB0byBhIFN0YWNrXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXJhbWV0ZXJWYWx1ZXMge1xuICBwdWJsaWMgcmVhZG9ubHkgdmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIHB1YmxpYyByZWFkb25seSBhcGlQYXJhbWV0ZXJzOiBDbG91ZEZvcm1hdGlvbi5QYXJhbWV0ZXJbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgZm9ybWFsUGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCBUZW1wbGF0ZVBhcmFtZXRlcj4sXG4gICAgdXBkYXRlczogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPixcbiAgICBwcmV2aW91c1ZhbHVlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KSB7XG5cbiAgICBjb25zdCBtaXNzaW5nUmVxdWlyZWQgPSBuZXcgQXJyYXk8c3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBba2V5LCBmb3JtYWxQYXJhbV0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5mb3JtYWxQYXJhbXMpKSB7XG4gICAgICAvLyBDaGVjayB1cGRhdGVzIGZpcnN0LCB0aGVuIHVzZSB0aGUgcHJldmlvdXMgdmFsdWUgKGlmIGF2YWlsYWJsZSksIHRoZW4gdXNlXG4gICAgICAvLyB0aGUgZGVmYXVsdCAoaWYgYXZhaWxhYmxlKS5cbiAgICAgIC8vXG4gICAgICAvLyBJZiB3ZSBkb24ndCBmaW5kIGEgcGFyYW1ldGVyIHZhbHVlIHVzaW5nIGFueSBvZiB0aGVzZSBtZXRob2RzLCB0aGVuIHRoYXQncyBhbiBlcnJvci5cbiAgICAgIGNvbnN0IHVwZGF0ZWRWYWx1ZSA9IHVwZGF0ZXNba2V5XTtcbiAgICAgIGlmICh1cGRhdGVkVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLnZhbHVlc1trZXldID0gdXBkYXRlZFZhbHVlO1xuICAgICAgICB0aGlzLmFwaVBhcmFtZXRlcnMucHVzaCh7IFBhcmFtZXRlcktleToga2V5LCBQYXJhbWV0ZXJWYWx1ZTogdXBkYXRlc1trZXldIH0pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGtleSBpbiBwcmV2aW91c1ZhbHVlcykge1xuICAgICAgICB0aGlzLnZhbHVlc1trZXldID0gcHJldmlvdXNWYWx1ZXNba2V5XTtcbiAgICAgICAgdGhpcy5hcGlQYXJhbWV0ZXJzLnB1c2goeyBQYXJhbWV0ZXJLZXk6IGtleSwgVXNlUHJldmlvdXNWYWx1ZTogdHJ1ZSB9KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChmb3JtYWxQYXJhbS5EZWZhdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy52YWx1ZXNba2V5XSA9IGZvcm1hbFBhcmFtLkRlZmF1bHQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBPaCBub1xuICAgICAgbWlzc2luZ1JlcXVpcmVkLnB1c2goa2V5KTtcbiAgICB9XG5cbiAgICBpZiAobWlzc2luZ1JlcXVpcmVkLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlIGZvbGxvd2luZyBDbG91ZEZvcm1hdGlvbiBQYXJhbWV0ZXJzIGFyZSBtaXNzaW5nIGEgdmFsdWU6ICR7bWlzc2luZ1JlcXVpcmVkLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgLy8gSnVzdCBhcHBlbmQgYWxsIHN1cHBsaWVkIG92ZXJyaWRlcyB0aGF0IGFyZW4ndCByZWFsbHkgZXhwZWN0ZWQgKHRoaXNcbiAgICAvLyB3aWxsIGZhaWwgQ0ZOIGJ1dCBtYXliZSBwZW9wbGUgbWFkZSB0eXBvcyB0aGF0IHRoZXkgd2FudCB0byBiZSBub3RpZmllZFxuICAgIC8vIG9mKVxuICAgIGNvbnN0IHVua25vd25QYXJhbSA9IChba2V5LCBfXTogW3N0cmluZywgYW55XSkgPT4gdGhpcy5mb3JtYWxQYXJhbXNba2V5XSA9PT0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGhhc1ZhbHVlID0gKFtfLCB2YWx1ZV06IFtzdHJpbmcsIGFueV0pID0+ICEhdmFsdWU7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykuZmlsdGVyKHVua25vd25QYXJhbSkuZmlsdGVyKGhhc1ZhbHVlKSkge1xuICAgICAgdGhpcy52YWx1ZXNba2V5XSA9IHZhbHVlITtcbiAgICAgIHRoaXMuYXBpUGFyYW1ldGVycy5wdXNoKHsgUGFyYW1ldGVyS2V5OiBrZXksIFBhcmFtZXRlclZhbHVlOiB2YWx1ZSB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2hldGhlciB0aGlzIHNldCBvZiBwYXJhbWV0ZXIgdXBkYXRlcyB3aWxsIGNoYW5nZSB0aGUgYWN0dWFsIHN0YWNrIHZhbHVlc1xuICAgKi9cbiAgcHVibGljIGhhc0NoYW5nZXMoY3VycmVudFZhbHVlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6IGJvb2xlYW4ge1xuICAgIC8vIElmIGFueSBvZiB0aGUgcGFyYW1ldGVycyBhcmUgU1NNIHBhcmFtZXRlcnMsIGRlcGxveWluZyBtdXN0IGFsd2F5cyBoYXBwZW5cbiAgICAvLyBiZWNhdXNlIHdlIGNhbid0IHByZWRpY3Qgd2hhdCB0aGUgdmFsdWVzIHdpbGwgYmUuXG4gICAgaWYgKE9iamVjdC52YWx1ZXModGhpcy5mb3JtYWxQYXJhbXMpLnNvbWUocCA9PiBwLlR5cGUuc3RhcnRzV2l0aCgnQVdTOjpTU006OlBhcmFtZXRlcjo6JykpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBPdGhlcndpc2Ugd2UncmUgZGlydHkgaWY6XG4gICAgLy8gLSBhbnkgb2YgdGhlIGV4aXN0aW5nIHZhbHVlcyBhcmUgcmVtb3ZlZCwgb3IgY2hhbmdlZFxuICAgIGlmIChPYmplY3QuZW50cmllcyhjdXJyZW50VmFsdWVzKS5zb21lKChba2V5LCB2YWx1ZV0pID0+ICEoa2V5IGluIHRoaXMudmFsdWVzKSB8fCB2YWx1ZSAhPT0gdGhpcy52YWx1ZXNba2V5XSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIC0gYW55IG9mIHRoZSB2YWx1ZXMgd2UncmUgc2V0dGluZyBhcmUgbmV3XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMudmFsdWVzKS5zb21lKGtleSA9PiAhKGtleSBpbiBjdXJyZW50VmFsdWVzKSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuIl19