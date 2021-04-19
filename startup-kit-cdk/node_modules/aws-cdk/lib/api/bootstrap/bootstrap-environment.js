"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bootstrapper = void 0;
const console_1 = require("console");
const path = require("path");
const logging_1 = require("../../logging");
const serialize_1 = require("../../serialize");
const deploy_bootstrap_1 = require("./deploy-bootstrap");
const legacy_template_1 = require("./legacy-template");
class Bootstrapper {
    constructor(source) {
        this.source = source;
    }
    bootstrapEnvironment(environment, sdkProvider, options = {}) {
        switch (this.source.source) {
            case 'legacy':
                return this.legacyBootstrap(environment, sdkProvider, options);
            case 'default':
                return this.modernBootstrap(environment, sdkProvider, options);
            case 'custom':
                return this.customBootstrap(environment, sdkProvider, options);
        }
    }
    async showTemplate() {
        const template = await this.loadTemplate();
        process.stdout.write(`${serialize_1.toYAML(template)}\n`);
    }
    /**
     * Deploy legacy bootstrap stack
     *
     * @experimental
     */
    async legacyBootstrap(environment, sdkProvider, options = {}) {
        var _a, _b, _c, _d;
        const params = (_a = options.parameters) !== null && _a !== void 0 ? _a : {};
        if ((_b = params.trustedAccounts) === null || _b === void 0 ? void 0 : _b.length) {
            throw new Error('--trust can only be passed for the modern bootstrap experience.');
        }
        if ((_c = params.cloudFormationExecutionPolicies) === null || _c === void 0 ? void 0 : _c.length) {
            throw new Error('--cloudformation-execution-policies can only be passed for the modern bootstrap experience.');
        }
        if (params.createCustomerMasterKey !== undefined) {
            throw new Error('--bootstrap-customer-key can only be passed for the modern bootstrap experience.');
        }
        if (params.qualifier) {
            throw new Error('--qualifier can only be passed for the modern bootstrap experience.');
        }
        const current = await deploy_bootstrap_1.BootstrapStack.lookup(sdkProvider, environment, options.toolkitStackName);
        return current.update(await this.loadTemplate(params), {}, {
            ...options,
            terminationProtection: (_d = options.terminationProtection) !== null && _d !== void 0 ? _d : current.terminationProtection,
        });
    }
    /**
     * Deploy CI/CD-ready bootstrap stack from template
     *
     * @experimental
     */
    async modernBootstrap(environment, sdkProvider, options = {}) {
        var _a, _b, _c, _d, _e;
        const params = (_a = options.parameters) !== null && _a !== void 0 ? _a : {};
        const bootstrapTemplate = await this.loadTemplate();
        const current = await deploy_bootstrap_1.BootstrapStack.lookup(sdkProvider, environment, options.toolkitStackName);
        if (params.createCustomerMasterKey !== undefined && params.kmsKeyId) {
            throw new Error('You cannot pass \'--bootstrap-kms-key-id\' and \'--bootstrap-customer-key\' together. Specify one or the other');
        }
        // If people re-bootstrap, existing parameter values are reused so that people don't accidentally change the configuration
        // on their bootstrap stack (this happens automatically in deployStack). However, to do proper validation on the
        // combined arguments (such that if --trust has been given, --cloudformation-execution-policies is necessary as well)
        // we need to take this parameter reuse into account.
        //
        // Ideally we'd do this inside the template, but the `Rules` section of CFN
        // templates doesn't seem to be able to express the conditions that we need
        // (can't use Fn::Join or reference Conditions) so we do it here instead.
        const trustedAccounts = (_b = params.trustedAccounts) !== null && _b !== void 0 ? _b : splitCfnArray(current.parameters.TrustedAccounts);
        console_1.info(`Trusted accounts:   ${trustedAccounts.length > 0 ? trustedAccounts.join(', ') : '(none)'}`);
        const cloudFormationExecutionPolicies = (_c = params.cloudFormationExecutionPolicies) !== null && _c !== void 0 ? _c : splitCfnArray(current.parameters.CloudFormationExecutionPolicies);
        if (trustedAccounts.length === 0 && cloudFormationExecutionPolicies.length === 0) {
            // For self-trust it's okay to default to AdministratorAccess, and it improves the usability of bootstrapping a lot.
            //
            // We don't actually make the implicity policy a physical parameter. The template will infer it instead,
            // we simply do the UI advertising that behavior here.
            //
            // If we DID make it an explicit parameter, we wouldn't be able to tell the difference between whether
            // we inferred it or whether the user told us, and the sequence:
            //
            // $ cdk bootstrap
            // $ cdk bootstrap --trust 1234
            //
            // Would leave AdministratorAccess policies with a trust relationship, without the user explicitly
            // approving the trust policy.
            const implicitPolicy = `arn:${await current.partition()}:iam::aws:policy/AdministratorAccess`;
            logging_1.warning(`Using default execution policy of '${implicitPolicy}'. Pass '--cloudformation-execution-policies' to customize.`);
        }
        else if (cloudFormationExecutionPolicies.length === 0) {
            throw new Error('Please pass \'--cloudformation-execution-policies\' when using \'--trust\' to specify deployment permissions. Try a managed policy of the form \'arn:aws:iam::aws:policy/<PolicyName>\'.');
        }
        else {
            // Remind people what the current settings are
            console_1.info(`Execution policies: ${cloudFormationExecutionPolicies.join(', ')}`);
        }
        // * If an ARN is given, that ARN. Otherwise:
        //   * '-' if customerKey = false
        //   * '' if customerKey = true
        //   * if customerKey is also not given
        //     * undefined if we already had a value in place (reusing what we had)
        //     * '-' if this is the first time we're deploying this stack (or upgrading from old to new bootstrap)
        const currentKmsKeyId = current.parameters.FileAssetsBucketKmsKeyId;
        const kmsKeyId = (_d = params.kmsKeyId) !== null && _d !== void 0 ? _d : (params.createCustomerMasterKey === true ? CREATE_NEW_KEY :
            params.createCustomerMasterKey === false || currentKmsKeyId === undefined ? USE_AWS_MANAGED_KEY :
                undefined);
        return current.update(bootstrapTemplate, {
            FileAssetsBucketName: params.bucketName,
            FileAssetsBucketKmsKeyId: kmsKeyId,
            // Empty array becomes empty string
            TrustedAccounts: trustedAccounts.join(','),
            CloudFormationExecutionPolicies: cloudFormationExecutionPolicies.join(','),
            Qualifier: params.qualifier,
            PublicAccessBlockConfiguration: params.publicAccessBlockConfiguration || params.publicAccessBlockConfiguration === undefined ? 'true' : 'false',
        }, {
            ...options,
            terminationProtection: (_e = options.terminationProtection) !== null && _e !== void 0 ? _e : current.terminationProtection,
        });
    }
    async customBootstrap(environment, sdkProvider, options = {}) {
        // Look at the template, decide whether it's most likely a legacy or modern bootstrap
        // template, and use the right bootstrapper for that.
        const version = deploy_bootstrap_1.bootstrapVersionFromTemplate(await this.loadTemplate());
        if (version === 0) {
            return this.legacyBootstrap(environment, sdkProvider, options);
        }
        else {
            return this.modernBootstrap(environment, sdkProvider, options);
        }
    }
    async loadTemplate(params = {}) {
        switch (this.source.source) {
            case 'custom':
                return serialize_1.loadStructuredFile(this.source.templateFile);
            case 'default':
                return serialize_1.loadStructuredFile(path.join(__dirname, 'bootstrap-template.yaml'));
            case 'legacy':
                return legacy_template_1.legacyBootstrapTemplate(params);
        }
    }
}
exports.Bootstrapper = Bootstrapper;
/**
 * Magic parameter value that will cause the bootstrap-template.yml to NOT create a CMK but use the default keyo
 */
const USE_AWS_MANAGED_KEY = 'AWS_MANAGED_KEY';
/**
 * Magic parameter value that will cause the bootstrap-template.yml to create a CMK
 */
const CREATE_NEW_KEY = '';
/**
 * Split an array-like CloudFormation parameter on ,
 *
 * An empty string is the empty array (instead of `['']`).
 */
function splitCfnArray(xs) {
    if (xs === '' || xs === undefined) {
        return [];
    }
    return xs.split(',');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwLWVudmlyb25tZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdHN0cmFwLWVudmlyb25tZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUErQjtBQUMvQiw2QkFBNkI7QUFFN0IsMkNBQXdDO0FBQ3hDLCtDQUE2RDtBQUk3RCx5REFBa0Y7QUFDbEYsdURBQTREO0FBVTVELE1BQWEsWUFBWTtJQUN2QixZQUE2QixNQUF1QjtRQUF2QixXQUFNLEdBQU4sTUFBTSxDQUFpQjtJQUNwRCxDQUFDO0lBRU0sb0JBQW9CLENBQUMsV0FBOEIsRUFBRSxXQUF3QixFQUFFLFVBQXVDLEVBQUU7UUFDN0gsUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUMxQixLQUFLLFFBQVE7Z0JBQ1gsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDakUsS0FBSyxTQUFTO2dCQUNaLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2pFLEtBQUssUUFBUTtnQkFDWCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNsRTtJQUNILENBQUM7SUFFTSxLQUFLLENBQUMsWUFBWTtRQUN2QixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUMzQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLGtCQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssS0FBSyxDQUFDLGVBQWUsQ0FBQyxXQUE4QixFQUFFLFdBQXdCLEVBQUUsVUFBdUMsRUFBRTs7UUFDL0gsTUFBTSxNQUFNLFNBQUcsT0FBTyxDQUFDLFVBQVUsbUNBQUksRUFBRSxDQUFDO1FBRXhDLFVBQUksTUFBTSxDQUFDLGVBQWUsMENBQUUsTUFBTSxFQUFFO1lBQ2xDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQztTQUNwRjtRQUNELFVBQUksTUFBTSxDQUFDLCtCQUErQiwwQ0FBRSxNQUFNLEVBQUU7WUFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyw2RkFBNkYsQ0FBQyxDQUFDO1NBQ2hIO1FBQ0QsSUFBSSxNQUFNLENBQUMsdUJBQXVCLEtBQUssU0FBUyxFQUFFO1lBQ2hELE1BQU0sSUFBSSxLQUFLLENBQUMsa0ZBQWtGLENBQUMsQ0FBQztTQUNyRztRQUNELElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRTtZQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLHFFQUFxRSxDQUFDLENBQUM7U0FDeEY7UUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLGlDQUFjLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDaEcsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUU7WUFDekQsR0FBRyxPQUFPO1lBQ1YscUJBQXFCLFFBQUUsT0FBTyxDQUFDLHFCQUFxQixtQ0FBSSxPQUFPLENBQUMscUJBQXFCO1NBQ3RGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssS0FBSyxDQUFDLGVBQWUsQ0FDM0IsV0FBOEIsRUFDOUIsV0FBd0IsRUFDeEIsVUFBdUMsRUFBRTs7UUFFekMsTUFBTSxNQUFNLFNBQUcsT0FBTyxDQUFDLFVBQVUsbUNBQUksRUFBRSxDQUFDO1FBRXhDLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFcEQsTUFBTSxPQUFPLEdBQUcsTUFBTSxpQ0FBYyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRWhHLElBQUksTUFBTSxDQUFDLHVCQUF1QixLQUFLLFNBQVMsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFO1lBQ25FLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0hBQWdILENBQUMsQ0FBQztTQUNuSTtRQUVELDBIQUEwSDtRQUMxSCxnSEFBZ0g7UUFDaEgscUhBQXFIO1FBQ3JILHFEQUFxRDtRQUNyRCxFQUFFO1FBQ0YsMkVBQTJFO1FBQzNFLDJFQUEyRTtRQUMzRSx5RUFBeUU7UUFDekUsTUFBTSxlQUFlLFNBQUcsTUFBTSxDQUFDLGVBQWUsbUNBQUksYUFBYSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDcEcsY0FBSSxDQUFDLHVCQUF1QixlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUVsRyxNQUFNLCtCQUErQixTQUFHLE1BQU0sQ0FBQywrQkFBK0IsbUNBQUksYUFBYSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUNwSixJQUFJLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLCtCQUErQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDaEYsb0hBQW9IO1lBQ3BILEVBQUU7WUFDRix3R0FBd0c7WUFDeEcsc0RBQXNEO1lBQ3RELEVBQUU7WUFDRixzR0FBc0c7WUFDdEcsZ0VBQWdFO1lBQ2hFLEVBQUU7WUFDRixrQkFBa0I7WUFDbEIsK0JBQStCO1lBQy9CLEVBQUU7WUFDRixrR0FBa0c7WUFDbEcsOEJBQThCO1lBQzlCLE1BQU0sY0FBYyxHQUFHLE9BQU8sTUFBTSxPQUFPLENBQUMsU0FBUyxFQUFFLHNDQUFzQyxDQUFDO1lBQzlGLGlCQUFPLENBQUMsc0NBQXNDLGNBQWMsNkRBQTZELENBQUMsQ0FBQztTQUM1SDthQUFNLElBQUksK0JBQStCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN2RCxNQUFNLElBQUksS0FBSyxDQUFDLDBMQUEwTCxDQUFDLENBQUM7U0FDN007YUFBTTtZQUNMLDhDQUE4QztZQUM5QyxjQUFJLENBQUMsdUJBQXVCLCtCQUErQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDM0U7UUFFRCw2Q0FBNkM7UUFDN0MsaUNBQWlDO1FBQ2pDLCtCQUErQjtRQUMvQix1Q0FBdUM7UUFDdkMsMkVBQTJFO1FBQzNFLDBHQUEwRztRQUMxRyxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLHdCQUF3QixDQUFDO1FBQ3BFLE1BQU0sUUFBUSxTQUFHLE1BQU0sQ0FBQyxRQUFRLG1DQUM5QixDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ3pELE1BQU0sQ0FBQyx1QkFBdUIsS0FBSyxLQUFLLElBQUksZUFBZSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztnQkFDL0YsU0FBUyxDQUFDLENBQUM7UUFFakIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUNuQixpQkFBaUIsRUFDakI7WUFDRSxvQkFBb0IsRUFBRSxNQUFNLENBQUMsVUFBVTtZQUN2Qyx3QkFBd0IsRUFBRSxRQUFRO1lBQ2xDLG1DQUFtQztZQUNuQyxlQUFlLEVBQUUsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7WUFDMUMsK0JBQStCLEVBQUUsK0JBQStCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUMxRSxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVM7WUFDM0IsOEJBQThCLEVBQUUsTUFBTSxDQUFDLDhCQUE4QixJQUFJLE1BQU0sQ0FBQyw4QkFBOEIsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTztTQUNoSixFQUFFO1lBQ0QsR0FBRyxPQUFPO1lBQ1YscUJBQXFCLFFBQUUsT0FBTyxDQUFDLHFCQUFxQixtQ0FBSSxPQUFPLENBQUMscUJBQXFCO1NBQ3RGLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUMzQixXQUE4QixFQUM5QixXQUF3QixFQUN4QixVQUF1QyxFQUFFO1FBRXpDLHFGQUFxRjtRQUNyRixxREFBcUQ7UUFDckQsTUFBTSxPQUFPLEdBQUcsK0NBQTRCLENBQUMsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUN4RSxJQUFJLE9BQU8sS0FBSyxDQUFDLEVBQUU7WUFDakIsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDaEU7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ2hFO0lBQ0gsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZLENBQUMsU0FBa0MsRUFBRTtRQUM3RCxRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQzFCLEtBQUssUUFBUTtnQkFDWCxPQUFPLDhCQUFrQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdEQsS0FBSyxTQUFTO2dCQUNaLE9BQU8sOEJBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUseUJBQXlCLENBQUMsQ0FBQyxDQUFDO1lBQzdFLEtBQUssUUFBUTtnQkFDWCxPQUFPLHlDQUF1QixDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQzFDO0lBQ0gsQ0FBQztDQUNGO0FBNUpELG9DQTRKQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxtQkFBbUIsR0FBRyxpQkFBaUIsQ0FBQztBQUU5Qzs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLEVBQUUsQ0FBQztBQUUxQjs7OztHQUlHO0FBQ0gsU0FBUyxhQUFhLENBQUMsRUFBc0I7SUFDM0MsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUU7UUFBRSxPQUFPLEVBQUUsQ0FBQztLQUFFO0lBQ2pELE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaW5mbyB9IGZyb20gJ2NvbnNvbGUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgeyB3YXJuaW5nIH0gZnJvbSAnLi4vLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBsb2FkU3RydWN0dXJlZEZpbGUsIHRvWUFNTCB9IGZyb20gJy4uLy4uL3NlcmlhbGl6ZSc7XG5pbXBvcnQgeyBTZGtQcm92aWRlciB9IGZyb20gJy4uL2F3cy1hdXRoJztcbmltcG9ydCB7IERlcGxveVN0YWNrUmVzdWx0IH0gZnJvbSAnLi4vZGVwbG95LXN0YWNrJztcbmltcG9ydCB7IEJvb3RzdHJhcEVudmlyb25tZW50T3B0aW9ucywgQm9vdHN0cmFwcGluZ1BhcmFtZXRlcnMgfSBmcm9tICcuL2Jvb3RzdHJhcC1wcm9wcyc7XG5pbXBvcnQgeyBCb290c3RyYXBTdGFjaywgYm9vdHN0cmFwVmVyc2lvbkZyb21UZW1wbGF0ZSB9IGZyb20gJy4vZGVwbG95LWJvb3RzdHJhcCc7XG5pbXBvcnQgeyBsZWdhY3lCb290c3RyYXBUZW1wbGF0ZSB9IGZyb20gJy4vbGVnYWN5LXRlbXBsYXRlJztcblxuLyogZXNsaW50LWRpc2FibGUgbWF4LWxlbiAqL1xuXG5leHBvcnQgdHlwZSBCb290c3RyYXBTb3VyY2UgPVxuICB7IHNvdXJjZTogJ2xlZ2FjeScgfVxuICB8IHsgc291cmNlOiAnZGVmYXVsdCcgfVxuICB8IHsgc291cmNlOiAnY3VzdG9tJzsgdGVtcGxhdGVGaWxlOiBzdHJpbmcgfTtcblxuXG5leHBvcnQgY2xhc3MgQm9vdHN0cmFwcGVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBzb3VyY2U6IEJvb3RzdHJhcFNvdXJjZSkge1xuICB9XG5cbiAgcHVibGljIGJvb3RzdHJhcEVudmlyb25tZW50KGVudmlyb25tZW50OiBjeGFwaS5FbnZpcm9ubWVudCwgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyLCBvcHRpb25zOiBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMgPSB7fSk6IFByb21pc2U8RGVwbG95U3RhY2tSZXN1bHQ+IHtcbiAgICBzd2l0Y2ggKHRoaXMuc291cmNlLnNvdXJjZSkge1xuICAgICAgY2FzZSAnbGVnYWN5JzpcbiAgICAgICAgcmV0dXJuIHRoaXMubGVnYWN5Qm9vdHN0cmFwKGVudmlyb25tZW50LCBzZGtQcm92aWRlciwgb3B0aW9ucyk7XG4gICAgICBjYXNlICdkZWZhdWx0JzpcbiAgICAgICAgcmV0dXJuIHRoaXMubW9kZXJuQm9vdHN0cmFwKGVudmlyb25tZW50LCBzZGtQcm92aWRlciwgb3B0aW9ucyk7XG4gICAgICBjYXNlICdjdXN0b20nOlxuICAgICAgICByZXR1cm4gdGhpcy5jdXN0b21Cb290c3RyYXAoZW52aXJvbm1lbnQsIHNka1Byb3ZpZGVyLCBvcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgc2hvd1RlbXBsYXRlKCkge1xuICAgIGNvbnN0IHRlbXBsYXRlID0gYXdhaXQgdGhpcy5sb2FkVGVtcGxhdGUoKTtcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShgJHt0b1lBTUwodGVtcGxhdGUpfVxcbmApO1xuICB9XG5cbiAgLyoqXG4gICAqIERlcGxveSBsZWdhY3kgYm9vdHN0cmFwIHN0YWNrXG4gICAqXG4gICAqIEBleHBlcmltZW50YWxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgbGVnYWN5Qm9vdHN0cmFwKGVudmlyb25tZW50OiBjeGFwaS5FbnZpcm9ubWVudCwgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyLCBvcHRpb25zOiBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMgPSB7fSk6IFByb21pc2U8RGVwbG95U3RhY2tSZXN1bHQ+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBvcHRpb25zLnBhcmFtZXRlcnMgPz8ge307XG5cbiAgICBpZiAocGFyYW1zLnRydXN0ZWRBY2NvdW50cz8ubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJy0tdHJ1c3QgY2FuIG9ubHkgYmUgcGFzc2VkIGZvciB0aGUgbW9kZXJuIGJvb3RzdHJhcCBleHBlcmllbmNlLicpO1xuICAgIH1cbiAgICBpZiAocGFyYW1zLmNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM/Lmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCctLWNsb3VkZm9ybWF0aW9uLWV4ZWN1dGlvbi1wb2xpY2llcyBjYW4gb25seSBiZSBwYXNzZWQgZm9yIHRoZSBtb2Rlcm4gYm9vdHN0cmFwIGV4cGVyaWVuY2UuJyk7XG4gICAgfVxuICAgIGlmIChwYXJhbXMuY3JlYXRlQ3VzdG9tZXJNYXN0ZXJLZXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCctLWJvb3RzdHJhcC1jdXN0b21lci1rZXkgY2FuIG9ubHkgYmUgcGFzc2VkIGZvciB0aGUgbW9kZXJuIGJvb3RzdHJhcCBleHBlcmllbmNlLicpO1xuICAgIH1cbiAgICBpZiAocGFyYW1zLnF1YWxpZmllcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCctLXF1YWxpZmllciBjYW4gb25seSBiZSBwYXNzZWQgZm9yIHRoZSBtb2Rlcm4gYm9vdHN0cmFwIGV4cGVyaWVuY2UuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudCA9IGF3YWl0IEJvb3RzdHJhcFN0YWNrLmxvb2t1cChzZGtQcm92aWRlciwgZW52aXJvbm1lbnQsIG9wdGlvbnMudG9vbGtpdFN0YWNrTmFtZSk7XG4gICAgcmV0dXJuIGN1cnJlbnQudXBkYXRlKGF3YWl0IHRoaXMubG9hZFRlbXBsYXRlKHBhcmFtcyksIHt9LCB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiBvcHRpb25zLnRlcm1pbmF0aW9uUHJvdGVjdGlvbiA/PyBjdXJyZW50LnRlcm1pbmF0aW9uUHJvdGVjdGlvbixcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXBsb3kgQ0kvQ0QtcmVhZHkgYm9vdHN0cmFwIHN0YWNrIGZyb20gdGVtcGxhdGVcbiAgICpcbiAgICogQGV4cGVyaW1lbnRhbFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBtb2Rlcm5Cb290c3RyYXAoXG4gICAgZW52aXJvbm1lbnQ6IGN4YXBpLkVudmlyb25tZW50LFxuICAgIHNka1Byb3ZpZGVyOiBTZGtQcm92aWRlcixcbiAgICBvcHRpb25zOiBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMgPSB7fSk6IFByb21pc2U8RGVwbG95U3RhY2tSZXN1bHQ+IHtcblxuICAgIGNvbnN0IHBhcmFtcyA9IG9wdGlvbnMucGFyYW1ldGVycyA/PyB7fTtcblxuICAgIGNvbnN0IGJvb3RzdHJhcFRlbXBsYXRlID0gYXdhaXQgdGhpcy5sb2FkVGVtcGxhdGUoKTtcblxuICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCBCb290c3RyYXBTdGFjay5sb29rdXAoc2RrUHJvdmlkZXIsIGVudmlyb25tZW50LCBvcHRpb25zLnRvb2xraXRTdGFja05hbWUpO1xuXG4gICAgaWYgKHBhcmFtcy5jcmVhdGVDdXN0b21lck1hc3RlcktleSAhPT0gdW5kZWZpbmVkICYmIHBhcmFtcy5rbXNLZXlJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgY2Fubm90IHBhc3MgXFwnLS1ib290c3RyYXAta21zLWtleS1pZFxcJyBhbmQgXFwnLS1ib290c3RyYXAtY3VzdG9tZXIta2V5XFwnIHRvZ2V0aGVyLiBTcGVjaWZ5IG9uZSBvciB0aGUgb3RoZXInKTtcbiAgICB9XG5cbiAgICAvLyBJZiBwZW9wbGUgcmUtYm9vdHN0cmFwLCBleGlzdGluZyBwYXJhbWV0ZXIgdmFsdWVzIGFyZSByZXVzZWQgc28gdGhhdCBwZW9wbGUgZG9uJ3QgYWNjaWRlbnRhbGx5IGNoYW5nZSB0aGUgY29uZmlndXJhdGlvblxuICAgIC8vIG9uIHRoZWlyIGJvb3RzdHJhcCBzdGFjayAodGhpcyBoYXBwZW5zIGF1dG9tYXRpY2FsbHkgaW4gZGVwbG95U3RhY2spLiBIb3dldmVyLCB0byBkbyBwcm9wZXIgdmFsaWRhdGlvbiBvbiB0aGVcbiAgICAvLyBjb21iaW5lZCBhcmd1bWVudHMgKHN1Y2ggdGhhdCBpZiAtLXRydXN0IGhhcyBiZWVuIGdpdmVuLCAtLWNsb3VkZm9ybWF0aW9uLWV4ZWN1dGlvbi1wb2xpY2llcyBpcyBuZWNlc3NhcnkgYXMgd2VsbClcbiAgICAvLyB3ZSBuZWVkIHRvIHRha2UgdGhpcyBwYXJhbWV0ZXIgcmV1c2UgaW50byBhY2NvdW50LlxuICAgIC8vXG4gICAgLy8gSWRlYWxseSB3ZSdkIGRvIHRoaXMgaW5zaWRlIHRoZSB0ZW1wbGF0ZSwgYnV0IHRoZSBgUnVsZXNgIHNlY3Rpb24gb2YgQ0ZOXG4gICAgLy8gdGVtcGxhdGVzIGRvZXNuJ3Qgc2VlbSB0byBiZSBhYmxlIHRvIGV4cHJlc3MgdGhlIGNvbmRpdGlvbnMgdGhhdCB3ZSBuZWVkXG4gICAgLy8gKGNhbid0IHVzZSBGbjo6Sm9pbiBvciByZWZlcmVuY2UgQ29uZGl0aW9ucykgc28gd2UgZG8gaXQgaGVyZSBpbnN0ZWFkLlxuICAgIGNvbnN0IHRydXN0ZWRBY2NvdW50cyA9IHBhcmFtcy50cnVzdGVkQWNjb3VudHMgPz8gc3BsaXRDZm5BcnJheShjdXJyZW50LnBhcmFtZXRlcnMuVHJ1c3RlZEFjY291bnRzKTtcbiAgICBpbmZvKGBUcnVzdGVkIGFjY291bnRzOiAgICR7dHJ1c3RlZEFjY291bnRzLmxlbmd0aCA+IDAgPyB0cnVzdGVkQWNjb3VudHMuam9pbignLCAnKSA6ICcobm9uZSknfWApO1xuXG4gICAgY29uc3QgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llcyA9IHBhcmFtcy5jbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzID8/IHNwbGl0Q2ZuQXJyYXkoY3VycmVudC5wYXJhbWV0ZXJzLkNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXMpO1xuICAgIGlmICh0cnVzdGVkQWNjb3VudHMubGVuZ3RoID09PSAwICYmIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBGb3Igc2VsZi10cnVzdCBpdCdzIG9rYXkgdG8gZGVmYXVsdCB0byBBZG1pbmlzdHJhdG9yQWNjZXNzLCBhbmQgaXQgaW1wcm92ZXMgdGhlIHVzYWJpbGl0eSBvZiBib290c3RyYXBwaW5nIGEgbG90LlxuICAgICAgLy9cbiAgICAgIC8vIFdlIGRvbid0IGFjdHVhbGx5IG1ha2UgdGhlIGltcGxpY2l0eSBwb2xpY3kgYSBwaHlzaWNhbCBwYXJhbWV0ZXIuIFRoZSB0ZW1wbGF0ZSB3aWxsIGluZmVyIGl0IGluc3RlYWQsXG4gICAgICAvLyB3ZSBzaW1wbHkgZG8gdGhlIFVJIGFkdmVydGlzaW5nIHRoYXQgYmVoYXZpb3IgaGVyZS5cbiAgICAgIC8vXG4gICAgICAvLyBJZiB3ZSBESUQgbWFrZSBpdCBhbiBleHBsaWNpdCBwYXJhbWV0ZXIsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gdGVsbCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHdoZXRoZXJcbiAgICAgIC8vIHdlIGluZmVycmVkIGl0IG9yIHdoZXRoZXIgdGhlIHVzZXIgdG9sZCB1cywgYW5kIHRoZSBzZXF1ZW5jZTpcbiAgICAgIC8vXG4gICAgICAvLyAkIGNkayBib290c3RyYXBcbiAgICAgIC8vICQgY2RrIGJvb3RzdHJhcCAtLXRydXN0IDEyMzRcbiAgICAgIC8vXG4gICAgICAvLyBXb3VsZCBsZWF2ZSBBZG1pbmlzdHJhdG9yQWNjZXNzIHBvbGljaWVzIHdpdGggYSB0cnVzdCByZWxhdGlvbnNoaXAsIHdpdGhvdXQgdGhlIHVzZXIgZXhwbGljaXRseVxuICAgICAgLy8gYXBwcm92aW5nIHRoZSB0cnVzdCBwb2xpY3kuXG4gICAgICBjb25zdCBpbXBsaWNpdFBvbGljeSA9IGBhcm46JHthd2FpdCBjdXJyZW50LnBhcnRpdGlvbigpfTppYW06OmF3czpwb2xpY3kvQWRtaW5pc3RyYXRvckFjY2Vzc2A7XG4gICAgICB3YXJuaW5nKGBVc2luZyBkZWZhdWx0IGV4ZWN1dGlvbiBwb2xpY3kgb2YgJyR7aW1wbGljaXRQb2xpY3l9Jy4gUGFzcyAnLS1jbG91ZGZvcm1hdGlvbi1leGVjdXRpb24tcG9saWNpZXMnIHRvIGN1c3RvbWl6ZS5gKTtcbiAgICB9IGVsc2UgaWYgKGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBwYXNzIFxcJy0tY2xvdWRmb3JtYXRpb24tZXhlY3V0aW9uLXBvbGljaWVzXFwnIHdoZW4gdXNpbmcgXFwnLS10cnVzdFxcJyB0byBzcGVjaWZ5IGRlcGxveW1lbnQgcGVybWlzc2lvbnMuIFRyeSBhIG1hbmFnZWQgcG9saWN5IG9mIHRoZSBmb3JtIFxcJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5LzxQb2xpY3lOYW1lPlxcJy4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUmVtaW5kIHBlb3BsZSB3aGF0IHRoZSBjdXJyZW50IHNldHRpbmdzIGFyZVxuICAgICAgaW5mbyhgRXhlY3V0aW9uIHBvbGljaWVzOiAke2Nsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXMuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICAvLyAqIElmIGFuIEFSTiBpcyBnaXZlbiwgdGhhdCBBUk4uIE90aGVyd2lzZTpcbiAgICAvLyAgICogJy0nIGlmIGN1c3RvbWVyS2V5ID0gZmFsc2VcbiAgICAvLyAgICogJycgaWYgY3VzdG9tZXJLZXkgPSB0cnVlXG4gICAgLy8gICAqIGlmIGN1c3RvbWVyS2V5IGlzIGFsc28gbm90IGdpdmVuXG4gICAgLy8gICAgICogdW5kZWZpbmVkIGlmIHdlIGFscmVhZHkgaGFkIGEgdmFsdWUgaW4gcGxhY2UgKHJldXNpbmcgd2hhdCB3ZSBoYWQpXG4gICAgLy8gICAgICogJy0nIGlmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWUgd2UncmUgZGVwbG95aW5nIHRoaXMgc3RhY2sgKG9yIHVwZ3JhZGluZyBmcm9tIG9sZCB0byBuZXcgYm9vdHN0cmFwKVxuICAgIGNvbnN0IGN1cnJlbnRLbXNLZXlJZCA9IGN1cnJlbnQucGFyYW1ldGVycy5GaWxlQXNzZXRzQnVja2V0S21zS2V5SWQ7XG4gICAgY29uc3Qga21zS2V5SWQgPSBwYXJhbXMua21zS2V5SWQgPz9cbiAgICAgIChwYXJhbXMuY3JlYXRlQ3VzdG9tZXJNYXN0ZXJLZXkgPT09IHRydWUgPyBDUkVBVEVfTkVXX0tFWSA6XG4gICAgICAgIHBhcmFtcy5jcmVhdGVDdXN0b21lck1hc3RlcktleSA9PT0gZmFsc2UgfHwgY3VycmVudEttc0tleUlkID09PSB1bmRlZmluZWQgPyBVU0VfQVdTX01BTkFHRURfS0VZIDpcbiAgICAgICAgICB1bmRlZmluZWQpO1xuXG4gICAgcmV0dXJuIGN1cnJlbnQudXBkYXRlKFxuICAgICAgYm9vdHN0cmFwVGVtcGxhdGUsXG4gICAgICB7XG4gICAgICAgIEZpbGVBc3NldHNCdWNrZXROYW1lOiBwYXJhbXMuYnVja2V0TmFtZSxcbiAgICAgICAgRmlsZUFzc2V0c0J1Y2tldEttc0tleUlkOiBrbXNLZXlJZCxcbiAgICAgICAgLy8gRW1wdHkgYXJyYXkgYmVjb21lcyBlbXB0eSBzdHJpbmdcbiAgICAgICAgVHJ1c3RlZEFjY291bnRzOiB0cnVzdGVkQWNjb3VudHMuam9pbignLCcpLFxuICAgICAgICBDbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzLmpvaW4oJywnKSxcbiAgICAgICAgUXVhbGlmaWVyOiBwYXJhbXMucXVhbGlmaWVyLFxuICAgICAgICBQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb246IHBhcmFtcy5wdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb24gfHwgcGFyYW1zLnB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbiA9PT0gdW5kZWZpbmVkID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgIH0sIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiBvcHRpb25zLnRlcm1pbmF0aW9uUHJvdGVjdGlvbiA/PyBjdXJyZW50LnRlcm1pbmF0aW9uUHJvdGVjdGlvbixcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjdXN0b21Cb290c3RyYXAoXG4gICAgZW52aXJvbm1lbnQ6IGN4YXBpLkVudmlyb25tZW50LFxuICAgIHNka1Byb3ZpZGVyOiBTZGtQcm92aWRlcixcbiAgICBvcHRpb25zOiBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMgPSB7fSk6IFByb21pc2U8RGVwbG95U3RhY2tSZXN1bHQ+IHtcblxuICAgIC8vIExvb2sgYXQgdGhlIHRlbXBsYXRlLCBkZWNpZGUgd2hldGhlciBpdCdzIG1vc3QgbGlrZWx5IGEgbGVnYWN5IG9yIG1vZGVybiBib290c3RyYXBcbiAgICAvLyB0ZW1wbGF0ZSwgYW5kIHVzZSB0aGUgcmlnaHQgYm9vdHN0cmFwcGVyIGZvciB0aGF0LlxuICAgIGNvbnN0IHZlcnNpb24gPSBib290c3RyYXBWZXJzaW9uRnJvbVRlbXBsYXRlKGF3YWl0IHRoaXMubG9hZFRlbXBsYXRlKCkpO1xuICAgIGlmICh2ZXJzaW9uID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5sZWdhY3lCb290c3RyYXAoZW52aXJvbm1lbnQsIHNka1Byb3ZpZGVyLCBvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZXJuQm9vdHN0cmFwKGVudmlyb25tZW50LCBzZGtQcm92aWRlciwgb3B0aW9ucyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkVGVtcGxhdGUocGFyYW1zOiBCb290c3RyYXBwaW5nUGFyYW1ldGVycyA9IHt9KTogUHJvbWlzZTxhbnk+IHtcbiAgICBzd2l0Y2ggKHRoaXMuc291cmNlLnNvdXJjZSkge1xuICAgICAgY2FzZSAnY3VzdG9tJzpcbiAgICAgICAgcmV0dXJuIGxvYWRTdHJ1Y3R1cmVkRmlsZSh0aGlzLnNvdXJjZS50ZW1wbGF0ZUZpbGUpO1xuICAgICAgY2FzZSAnZGVmYXVsdCc6XG4gICAgICAgIHJldHVybiBsb2FkU3RydWN0dXJlZEZpbGUocGF0aC5qb2luKF9fZGlybmFtZSwgJ2Jvb3RzdHJhcC10ZW1wbGF0ZS55YW1sJykpO1xuICAgICAgY2FzZSAnbGVnYWN5JzpcbiAgICAgICAgcmV0dXJuIGxlZ2FjeUJvb3RzdHJhcFRlbXBsYXRlKHBhcmFtcyk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWFnaWMgcGFyYW1ldGVyIHZhbHVlIHRoYXQgd2lsbCBjYXVzZSB0aGUgYm9vdHN0cmFwLXRlbXBsYXRlLnltbCB0byBOT1QgY3JlYXRlIGEgQ01LIGJ1dCB1c2UgdGhlIGRlZmF1bHQga2V5b1xuICovXG5jb25zdCBVU0VfQVdTX01BTkFHRURfS0VZID0gJ0FXU19NQU5BR0VEX0tFWSc7XG5cbi8qKlxuICogTWFnaWMgcGFyYW1ldGVyIHZhbHVlIHRoYXQgd2lsbCBjYXVzZSB0aGUgYm9vdHN0cmFwLXRlbXBsYXRlLnltbCB0byBjcmVhdGUgYSBDTUtcbiAqL1xuY29uc3QgQ1JFQVRFX05FV19LRVkgPSAnJztcblxuLyoqXG4gKiBTcGxpdCBhbiBhcnJheS1saWtlIENsb3VkRm9ybWF0aW9uIHBhcmFtZXRlciBvbiAsXG4gKlxuICogQW4gZW1wdHkgc3RyaW5nIGlzIHRoZSBlbXB0eSBhcnJheSAoaW5zdGVhZCBvZiBgWycnXWApLlxuICovXG5mdW5jdGlvbiBzcGxpdENmbkFycmF5KHhzOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmdbXSB7XG4gIGlmICh4cyA9PT0gJycgfHwgeHMgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gW107IH1cbiAgcmV0dXJuIHhzLnNwbGl0KCcsJyk7XG59XG4iXX0=