import * as cxapi from '@aws-cdk/cx-api';
import { SdkProvider } from '../aws-auth';
import { DeployStackResult } from '../deploy-stack';
import { BootstrapEnvironmentOptions } from './bootstrap-props';
export declare type BootstrapSource = {
    source: 'legacy';
} | {
    source: 'default';
} | {
    source: 'custom';
    templateFile: string;
};
export declare class Bootstrapper {
    private readonly source;
    constructor(source: BootstrapSource);
    bootstrapEnvironment(environment: cxapi.Environment, sdkProvider: SdkProvider, options?: BootstrapEnvironmentOptions): Promise<DeployStackResult>;
    showTemplate(): Promise<void>;
    /**
     * Deploy legacy bootstrap stack
     *
     * @experimental
     */
    private legacyBootstrap;
    /**
     * Deploy CI/CD-ready bootstrap stack from template
     *
     * @experimental
     */
    private modernBootstrap;
    private customBootstrap;
    private loadTemplate;
}
