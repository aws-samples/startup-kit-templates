import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { SdkProvider } from '../api';
import { ContextProviderPlugin } from './provider';
/**
 * Plugin to read arbitrary SSM parameter names
 */
export declare class SSMContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: cxschema.SSMParameterContextQuery): Promise<string>;
    /**
     * Gets the value of an SSM Parameter, while not throwin if the parameter does not exist.
     * @param account       the account in which the SSM Parameter is expected to be.
     * @param region        the region in which the SSM Parameter is expected to be.
     * @param parameterName the name of the SSM Parameter
     *
     * @returns the result of the ``GetParameter`` operation.
     *
     * @throws Error if a service error (other than ``ParameterNotFound``) occurs.
     */
    private getSsmParameterValue;
}
