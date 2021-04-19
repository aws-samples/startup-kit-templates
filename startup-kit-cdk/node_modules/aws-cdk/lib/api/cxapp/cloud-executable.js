"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudExecutable = void 0;
const fs_1 = require("fs");
const cxapi = require("@aws-cdk/cx-api");
const region_info_1 = require("@aws-cdk/region-info");
const contextproviders = require("../../context-providers");
const logging_1 = require("../../logging");
const cloud_assembly_1 = require("./cloud-assembly");
/**
 * Represent the Cloud Executable and the synthesis we can do on it
 */
class CloudExecutable {
    constructor(props) {
        this.props = props;
    }
    /**
     * Return whether there is an app command from the configuration
     */
    get hasApp() {
        return !!this.props.configuration.settings.get(['app']);
    }
    /**
     * Synthesize a set of stacks
     */
    async synthesize() {
        if (!this._cloudAssembly) {
            this._cloudAssembly = await this.doSynthesize();
        }
        return this._cloudAssembly;
    }
    async doSynthesize() {
        const trackVersions = this.props.configuration.settings.get(['versionReporting']);
        // We may need to run the cloud executable multiple times in order to satisfy all missing context
        // (When the executable runs, it will tell us about context it wants to use
        // but it missing. We'll then look up the context and run the executable again, and
        // again, until it doesn't complain anymore or we've stopped making progress).
        let previouslyMissingKeys;
        while (true) {
            const assembly = await this.props.synthesizer(this.props.sdkProvider, this.props.configuration);
            if (assembly.manifest.missing && assembly.manifest.missing.length > 0) {
                const missingKeys = missingContextKeys(assembly.manifest.missing);
                if (!this.canLookup) {
                    throw new Error('Context lookups have been disabled. '
                        + 'Make sure all necessary context is already in \'cdk.context.json\' by running \'cdk synth\' on a machine with sufficient AWS credentials and committing the result. '
                        + `Missing context keys: '${Array.from(missingKeys).join(', ')}'`);
                }
                let tryLookup = true;
                if (previouslyMissingKeys && setsEqual(missingKeys, previouslyMissingKeys)) {
                    logging_1.debug('Not making progress trying to resolve environmental context. Giving up.');
                    tryLookup = false;
                }
                previouslyMissingKeys = missingKeys;
                if (tryLookup) {
                    logging_1.debug('Some context information is missing. Fetching...');
                    await contextproviders.provideContextValues(assembly.manifest.missing, this.props.configuration.context, this.props.sdkProvider);
                    // Cache the new context to disk
                    await this.props.configuration.saveContext();
                    // Execute again
                    continue;
                }
            }
            if (trackVersions) {
                // @deprecated(v2): remove this 'if' block and all code referenced by it.
                // This should honestly not be done here. The framework
                // should (and will, shortly) synthesize this information directly into
                // the template. However, in order to support old framework versions
                // that don't synthesize this info yet, we can only remove this code
                // once we break backwards compatibility.
                await this.addMetadataResource(assembly);
            }
            return new cloud_assembly_1.CloudAssembly(assembly);
        }
    }
    /**
     * Modify the templates in the assembly in-place to add metadata resource declarations
     */
    async addMetadataResource(rootAssembly) {
        if (!rootAssembly.runtime) {
            return;
        }
        const modules = formatModules(rootAssembly.runtime);
        await processAssembly(rootAssembly);
        async function processAssembly(assembly) {
            for (const stack of assembly.stacks) {
                await processStack(stack);
            }
            for (const nested of assembly.nestedAssemblies) {
                await processAssembly(nested.nestedAssembly);
            }
        }
        async function processStack(stack) {
            const resourcePresent = stack.environment.region === cxapi.UNKNOWN_REGION
                || region_info_1.RegionInfo.get(stack.environment.region).cdkMetadataResourceAvailable;
            if (!resourcePresent) {
                return;
            }
            if (!stack.template.Resources) {
                stack.template.Resources = {};
            }
            if (stack.template.Resources.CDKMetadata) {
                // Already added by framework, this is expected.
                return;
            }
            stack.template.Resources.CDKMetadata = {
                Type: 'AWS::CDK::Metadata',
                Properties: {
                    Modules: modules,
                },
            };
            if (stack.environment.region === cxapi.UNKNOWN_REGION) {
                stack.template.Conditions = stack.template.Conditions || {};
                const condName = 'CDKMetadataAvailable';
                if (!stack.template.Conditions[condName]) {
                    stack.template.Conditions[condName] = _makeCdkMetadataAvailableCondition();
                    stack.template.Resources.CDKMetadata.Condition = condName;
                }
                else {
                    logging_1.warning(`The stack ${stack.id} already includes a ${condName} condition`);
                }
            }
            // The template has changed in-memory, but the file on disk remains unchanged so far.
            // The CLI *might* later on deploy the in-memory version (if it's <50kB) or use the
            // on-disk version (if it's >50kB).
            //
            // Be sure to flush the changes we just made back to disk. The on-disk format is always
            // JSON.
            await fs_1.promises.writeFile(stack.templateFullPath, JSON.stringify(stack.template, undefined, 2), { encoding: 'utf-8' });
        }
    }
    get canLookup() {
        var _a;
        return !!((_a = this.props.configuration.settings.get(['lookups'])) !== null && _a !== void 0 ? _a : true);
    }
}
exports.CloudExecutable = CloudExecutable;
/**
 * Return all keys of missing context items
 */
function missingContextKeys(missing) {
    return new Set((missing || []).map(m => m.key));
}
function setsEqual(a, b) {
    if (a.size !== b.size) {
        return false;
    }
    for (const x of a) {
        if (!b.has(x)) {
            return false;
        }
    }
    return true;
}
function _makeCdkMetadataAvailableCondition() {
    return _fnOr(region_info_1.RegionInfo.regions
        .filter(ri => ri.cdkMetadataResourceAvailable)
        .map(ri => ({ 'Fn::Equals': [{ Ref: 'AWS::Region' }, ri.name] })));
}
/**
 * This takes a bunch of operands and crafts an `Fn::Or` for those. Funny thing is `Fn::Or` requires
 * at least 2 operands and at most 10 operands, so we have to... do this.
 */
function _fnOr(operands) {
    if (operands.length === 0) {
        throw new Error('Cannot build `Fn::Or` with zero operands!');
    }
    if (operands.length === 1) {
        return operands[0];
    }
    if (operands.length <= 10) {
        return { 'Fn::Or': operands };
    }
    return _fnOr(_inGroupsOf(operands, 10).map(group => _fnOr(group)));
}
function _inGroupsOf(array, maxGroup) {
    const result = new Array();
    for (let i = 0; i < array.length; i += maxGroup) {
        result.push(array.slice(i, i + maxGroup));
    }
    return result;
}
function formatModules(runtime) {
    const modules = new Array();
    // inject toolkit version to list of modules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const toolkitVersion = require('../../../package.json').version;
    modules.push(`aws-cdk=${toolkitVersion}`);
    for (const key of Object.keys(runtime.libraries).sort()) {
        modules.push(`${key}=${runtime.libraries[key]}`);
    }
    return modules.join(',');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQtZXhlY3V0YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsb3VkLWV4ZWN1dGFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkJBQW9DO0FBQ3BDLHlDQUF5QztBQUN6QyxzREFBa0Q7QUFDbEQsNERBQTREO0FBQzVELDJDQUErQztBQUcvQyxxREFBaUQ7QUF3QmpEOztHQUVHO0FBQ0gsTUFBYSxlQUFlO0lBRzFCLFlBQTZCLEtBQTJCO1FBQTNCLFVBQUssR0FBTCxLQUFLLENBQXNCO0lBQ3hELENBQUM7SUFFRDs7T0FFRztJQUNILElBQVcsTUFBTTtRQUNmLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyxVQUFVO1FBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQ3hCLElBQUksQ0FBQyxjQUFjLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDakQ7UUFDRCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDN0IsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZO1FBQ3hCLE1BQU0sYUFBYSxHQUFZLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7UUFFM0YsaUdBQWlHO1FBQ2pHLDJFQUEyRTtRQUMzRSxtRkFBbUY7UUFDbkYsOEVBQThFO1FBQzlFLElBQUkscUJBQThDLENBQUM7UUFDbkQsT0FBTyxJQUFJLEVBQUU7WUFDWCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMs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Q0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDdkQsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUNsRDtJQUNELE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMzQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0IHsgUmVnaW9uSW5mbyB9IGZyb20gJ0Bhd3MtY2RrL3JlZ2lvbi1pbmZvJztcbmltcG9ydCAqIGFzIGNvbnRleHRwcm92aWRlcnMgZnJvbSAnLi4vLi4vY29udGV4dC1wcm92aWRlcnMnO1xuaW1wb3J0IHsgZGVidWcsIHdhcm5pbmcgfSBmcm9tICcuLi8uLi9sb2dnaW5nJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi9zZXR0aW5ncyc7XG5pbXBvcnQgeyBTZGtQcm92aWRlciB9IGZyb20gJy4uL2F3cy1hdXRoJztcbmltcG9ydCB7IENsb3VkQXNzZW1ibHkgfSBmcm9tICcuL2Nsb3VkLWFzc2VtYmx5JztcblxuLyoqXG4gKiBAcmV0dXJucyBvdXRwdXQgZGlyZWN0b3J5XG4gKi9cbnR5cGUgU3ludGhlc2l6ZXIgPSAoYXdzOiBTZGtQcm92aWRlciwgY29uZmlnOiBDb25maWd1cmF0aW9uKSA9PiBQcm9taXNlPGN4YXBpLkNsb3VkQXNzZW1ibHk+O1xuXG5leHBvcnQgaW50ZXJmYWNlIENsb3VkRXhlY3V0YWJsZVByb3BzIHtcbiAgLyoqXG4gICAqIEFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb24gKHNldHRpbmdzIGFuZCBjb250ZXh0KVxuICAgKi9cbiAgY29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbjtcblxuICAvKipcbiAgICogQVdTIG9iamVjdCAodXNlZCBieSBzeW50aGVzaXplciBhbmQgY29udGV4dHByb3ZpZGVyKVxuICAgKi9cbiAgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyO1xuXG4gIC8qKlxuICAgKiBDYWxsYmFjayBpbnZva2VkIHRvIHN5bnRoZXNpemUgdGhlIGFjdHVhbCBzdGFja3NcbiAgICovXG4gIHN5bnRoZXNpemVyOiBTeW50aGVzaXplcjtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnQgdGhlIENsb3VkIEV4ZWN1dGFibGUgYW5kIHRoZSBzeW50aGVzaXMgd2UgY2FuIGRvIG9uIGl0XG4gKi9cbmV4cG9ydCBjbGFzcyBDbG91ZEV4ZWN1dGFibGUge1xuICBwcml2YXRlIF9jbG91ZEFzc2VtYmx5PzogQ2xvdWRBc3NlbWJseTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHByb3BzOiBDbG91ZEV4ZWN1dGFibGVQcm9wcykge1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB3aGV0aGVyIHRoZXJlIGlzIGFuIGFwcCBjb21tYW5kIGZyb20gdGhlIGNvbmZpZ3VyYXRpb25cbiAgICovXG4gIHB1YmxpYyBnZXQgaGFzQXBwKCkge1xuICAgIHJldHVybiAhIXRoaXMucHJvcHMuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5nZXQoWydhcHAnXSk7XG4gIH1cblxuICAvKipcbiAgICogU3ludGhlc2l6ZSBhIHNldCBvZiBzdGFja3NcbiAgICovXG4gIHB1YmxpYyBhc3luYyBzeW50aGVzaXplKCk6IFByb21pc2U8Q2xvdWRBc3NlbWJseT4ge1xuICAgIGlmICghdGhpcy5fY2xvdWRBc3NlbWJseSkge1xuICAgICAgdGhpcy5fY2xvdWRBc3NlbWJseSA9IGF3YWl0IHRoaXMuZG9TeW50aGVzaXplKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jbG91ZEFzc2VtYmx5O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBkb1N5bnRoZXNpemUoKTogUHJvbWlzZTxDbG91ZEFzc2VtYmx5PiB7XG4gICAgY29uc3QgdHJhY2tWZXJzaW9uczogYm9vbGVhbiA9IHRoaXMucHJvcHMuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5nZXQoWyd2ZXJzaW9uUmVwb3J0aW5nJ10pO1xuXG4gICAgLy8gV2UgbWF5IG5lZWQgdG8gcnVuIHRoZSBjbG91ZCBleGVjdXRhYmxlIG11bHRpcGxlIHRpbWVzIGluIG9yZGVyIHRvIHNhdGlzZnkgYWxsIG1pc3NpbmcgY29udGV4dFxuICAgIC8vIChXaGVuIHRoZSBleGVjdXRhYmxlIHJ1bnMsIGl0IHdpbGwgdGVsbCB1cyBhYm91dCBjb250ZXh0IGl0IHdhbnRzIHRvIHVzZVxuICAgIC8vIGJ1dCBpdCBtaXNzaW5nLiBXZSdsbCB0aGVuIGxvb2sgdXAgdGhlIGNvbnRleHQgYW5kIHJ1biB0aGUgZXhlY3V0YWJsZSBhZ2FpbiwgYW5kXG4gICAgLy8gYWdhaW4sIHVudGlsIGl0IGRvZXNuJ3QgY29tcGxhaW4gYW55bW9yZSBvciB3ZSd2ZSBzdG9wcGVkIG1ha2luZyBwcm9ncmVzcykuXG4gICAgbGV0IHByZXZpb3VzbHlNaXNzaW5nS2V5czogU2V0PHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IGFzc2VtYmx5ID0gYXdhaXQgdGhpcy5wcm9wcy5zeW50aGVzaXplcih0aGlzLnByb3BzLnNka1Byb3ZpZGVyLCB0aGlzLnByb3BzLmNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICBpZiAoYXNzZW1ibHkubWFuaWZlc3QubWlzc2luZyAmJiBhc3NlbWJseS5tYW5pZmVzdC5taXNzaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbWlzc2luZ0tleXMgPSBtaXNzaW5nQ29udGV4dEtleXMoYXNzZW1ibHkubWFuaWZlc3QubWlzc2luZyk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmNhbkxvb2t1cCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdDb250ZXh0IGxvb2t1cHMgaGF2ZSBiZWVuIGRpc2FibGVkLiAnXG4gICAgICAgICAgICArICdNYWtlIHN1cmUgYWxsIG5lY2Vzc2FyeSBjb250ZXh0IGlzIGFscmVhZHkgaW4gXFwnY2RrLmNvbnRleHQuanNvblxcJyBieSBydW5uaW5nIFxcJ2NkayBzeW50aFxcJyBvbiBhIG1hY2hpbmUgd2l0aCBzdWZmaWNpZW50IEFXUyBjcmVkZW50aWFscyBhbmQgY29tbWl0dGluZyB0aGUgcmVzdWx0LiAnXG4gICAgICAgICAgICArIGBNaXNzaW5nIGNvbnRleHQga2V5czogJyR7QXJyYXkuZnJvbShtaXNzaW5nS2V5cykuam9pbignLCAnKX0nYCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdHJ5TG9va3VwID0gdHJ1ZTtcbiAgICAgICAgaWYgKHByZXZpb3VzbHlNaXNzaW5nS2V5cyAmJiBzZXRzRXF1YWwobWlzc2luZ0tleXMsIHByZXZpb3VzbHlNaXNzaW5nS2V5cykpIHtcbiAgICAgICAgICBkZWJ1ZygnTm90IG1ha2luZyBwcm9ncmVzcyB0cnlpbmcgdG8gcmVzb2x2ZSBlbnZpcm9ubWVudGFsIGNvbnRleHQuIEdpdmluZyB1cC4nKTtcbiAgICAgICAgICB0cnlMb29rdXAgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByZXZpb3VzbHlNaXNzaW5nS2V5cyA9IG1pc3NpbmdLZXlzO1xuXG4gICAgICAgIGlmICh0cnlMb29rdXApIHtcbiAgICAgICAgICBkZWJ1ZygnU29tZSBjb250ZXh0IGluZm9ybWF0aW9uIGlzIG1pc3NpbmcuIEZldGNoaW5nLi4uJyk7XG5cbiAgICAgICAgICBhd2FpdCBjb250ZXh0cHJvdmlkZXJzLnByb3ZpZGVDb250ZXh0VmFsdWVzKGFzc2VtYmx5Lm1hbmlmZXN0Lm1pc3NpbmcsIHRoaXMucHJvcHMuY29uZmlndXJhdGlvbi5jb250ZXh0LCB0aGlzLnByb3BzLnNka1Byb3ZpZGVyKTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSBuZXcgY29udGV4dCB0byBkaXNrXG4gICAgICAgICAgYXdhaXQgdGhpcy5wcm9wcy5jb25maWd1cmF0aW9uLnNhdmVDb250ZXh0KCk7XG5cbiAgICAgICAgICAvLyBFeGVjdXRlIGFnYWluXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRyYWNrVmVyc2lvbnMpIHtcbiAgICAgICAgLy8gQGRlcHJlY2F0ZWQodjIpOiByZW1vdmUgdGhpcyAnaWYnIGJsb2NrIGFuZCBhbGwgY29kZSByZWZlcmVuY2VkIGJ5IGl0LlxuICAgICAgICAvLyBUaGlzIHNob3VsZCBob25lc3RseSBub3QgYmUgZG9uZSBoZXJlLiBUaGUgZnJhbWV3b3JrXG4gICAgICAgIC8vIHNob3VsZCAoYW5kIHdpbGwsIHNob3J0bHkpIHN5bnRoZXNpemUgdGhpcyBpbmZvcm1hdGlvbiBkaXJlY3RseSBpbnRvXG4gICAgICAgIC8vIHRoZSB0ZW1wbGF0ZS4gSG93ZXZlciwgaW4gb3JkZXIgdG8gc3VwcG9ydCBvbGQgZnJhbWV3b3JrIHZlcnNpb25zXG4gICAgICAgIC8vIHRoYXQgZG9uJ3Qgc3ludGhlc2l6ZSB0aGlzIGluZm8geWV0LCB3ZSBjYW4gb25seSByZW1vdmUgdGhpcyBjb2RlXG4gICAgICAgIC8vIG9uY2Ugd2UgYnJlYWsgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG4gICAgICAgIGF3YWl0IHRoaXMuYWRkTWV0YWRhdGFSZXNvdXJjZShhc3NlbWJseSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgQ2xvdWRBc3NlbWJseShhc3NlbWJseSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1vZGlmeSB0aGUgdGVtcGxhdGVzIGluIHRoZSBhc3NlbWJseSBpbi1wbGFjZSB0byBhZGQgbWV0YWRhdGEgcmVzb3VyY2UgZGVjbGFyYXRpb25zXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGFkZE1ldGFkYXRhUmVzb3VyY2Uocm9vdEFzc2VtYmx5OiBjeGFwaS5DbG91ZEFzc2VtYmx5KSB7XG4gICAgaWYgKCFyb290QXNzZW1ibHkucnVudGltZSkgeyByZXR1cm47IH1cblxuICAgIGNvbnN0IG1vZHVsZXMgPSBmb3JtYXRNb2R1bGVzKHJvb3RBc3NlbWJseS5ydW50aW1lKTtcbiAgICBhd2FpdCBwcm9jZXNzQXNzZW1ibHkocm9vdEFzc2VtYmx5KTtcblxuICAgIGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NBc3NlbWJseShhc3NlbWJseTogY3hhcGkuQ2xvdWRBc3NlbWJseSkge1xuICAgICAgZm9yIChjb25zdCBzdGFjayBvZiBhc3NlbWJseS5zdGFja3MpIHtcbiAgICAgICAgYXdhaXQgcHJvY2Vzc1N0YWNrKHN0YWNrKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgbmVzdGVkIG9mIGFzc2VtYmx5Lm5lc3RlZEFzc2VtYmxpZXMpIHtcbiAgICAgICAgYXdhaXQgcHJvY2Vzc0Fzc2VtYmx5KG5lc3RlZC5uZXN0ZWRBc3NlbWJseSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc1N0YWNrKHN0YWNrOiBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3QpIHtcbiAgICAgIGNvbnN0IHJlc291cmNlUHJlc2VudCA9IHN0YWNrLmVudmlyb25tZW50LnJlZ2lvbiA9PT0gY3hhcGkuVU5LTk9XTl9SRUdJT05cbiAgICAgICAgfHwgUmVnaW9uSW5mby5nZXQoc3RhY2suZW52aXJvbm1lbnQucmVnaW9uKS5jZGtNZXRhZGF0YVJlc291cmNlQXZhaWxhYmxlO1xuICAgICAgaWYgKCFyZXNvdXJjZVByZXNlbnQpIHsgcmV0dXJuOyB9XG5cbiAgICAgIGlmICghc3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzKSB7XG4gICAgICAgIHN0YWNrLnRlbXBsYXRlLlJlc291cmNlcyA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKHN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5DREtNZXRhZGF0YSkge1xuICAgICAgICAvLyBBbHJlYWR5IGFkZGVkIGJ5IGZyYW1ld29yaywgdGhpcyBpcyBleHBlY3RlZC5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBzdGFjay50ZW1wbGF0ZS5SZXNvdXJjZXMuQ0RLTWV0YWRhdGEgPSB7XG4gICAgICAgIFR5cGU6ICdBV1M6OkNESzo6TWV0YWRhdGEnLFxuICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgTW9kdWxlczogbW9kdWxlcyxcbiAgICAgICAgfSxcbiAgICAgIH07XG5cbiAgICAgIGlmIChzdGFjay5lbnZpcm9ubWVudC5yZWdpb24gPT09IGN4YXBpLlVOS05PV05fUkVHSU9OKSB7XG4gICAgICAgIHN0YWNrLnRlbXBsYXRlLkNvbmRpdGlvbnMgPSBzdGFjay50ZW1wbGF0ZS5Db25kaXRpb25zIHx8IHt9O1xuICAgICAgICBjb25zdCBjb25kTmFtZSA9ICdDREtNZXRhZGF0YUF2YWlsYWJsZSc7XG4gICAgICAgIGlmICghc3RhY2sudGVtcGxhdGUuQ29uZGl0aW9uc1tjb25kTmFtZV0pIHtcbiAgICAgICAgICBzdGFjay50ZW1wbGF0ZS5Db25kaXRpb25zW2NvbmROYW1lXSA9IF9tYWtlQ2RrTWV0YWRhdGFBdmFpbGFibGVDb25kaXRpb24oKTtcbiAgICAgICAgICBzdGFjay50ZW1wbGF0ZS5SZXNvdXJjZXMuQ0RLTWV0YWRhdGEuQ29uZGl0aW9uID0gY29uZE5hbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2FybmluZyhgVGhlIHN0YWNrICR7c3RhY2suaWR9IGFscmVhZHkgaW5jbHVkZXMgYSAke2NvbmROYW1lfSBjb25kaXRpb25gKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUaGUgdGVtcGxhdGUgaGFzIGNoYW5nZWQgaW4tbWVtb3J5LCBidXQgdGhlIGZpbGUgb24gZGlzayByZW1haW5zIHVuY2hhbmdlZCBzbyBmYXIuXG4gICAgICAvLyBUaGUgQ0xJICptaWdodCogbGF0ZXIgb24gZGVwbG95IHRoZSBpbi1tZW1vcnkgdmVyc2lvbiAoaWYgaXQncyA8NTBrQikgb3IgdXNlIHRoZVxuICAgICAgLy8gb24tZGlzayB2ZXJzaW9uIChpZiBpdCdzID41MGtCKS5cbiAgICAgIC8vXG4gICAgICAvLyBCZSBzdXJlIHRvIGZsdXNoIHRoZSBjaGFuZ2VzIHdlIGp1c3QgbWFkZSBiYWNrIHRvIGRpc2suIFRoZSBvbi1kaXNrIGZvcm1hdCBpcyBhbHdheXNcbiAgICAgIC8vIEpTT04uXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUoc3RhY2sudGVtcGxhdGVGdWxsUGF0aCwgSlNPTi5zdHJpbmdpZnkoc3RhY2sudGVtcGxhdGUsIHVuZGVmaW5lZCwgMiksIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXQgY2FuTG9va3VwKCkge1xuICAgIHJldHVybiAhISh0aGlzLnByb3BzLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3MuZ2V0KFsnbG9va3VwcyddKSA/PyB0cnVlKTtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybiBhbGwga2V5cyBvZiBtaXNzaW5nIGNvbnRleHQgaXRlbXNcbiAqL1xuZnVuY3Rpb24gbWlzc2luZ0NvbnRleHRLZXlzKG1pc3Npbmc/OiBjeGFwaS5NaXNzaW5nQ29udGV4dFtdKTogU2V0PHN0cmluZz4ge1xuICByZXR1cm4gbmV3IFNldCgobWlzc2luZyB8fCBbXSkubWFwKG0gPT4gbS5rZXkpKTtcbn1cblxuZnVuY3Rpb24gc2V0c0VxdWFsPEE+KGE6IFNldDxBPiwgYjogU2V0PEE+KSB7XG4gIGlmIChhLnNpemUgIT09IGIuc2l6ZSkgeyByZXR1cm4gZmFsc2U7IH1cbiAgZm9yIChjb25zdCB4IG9mIGEpIHtcbiAgICBpZiAoIWIuaGFzKHgpKSB7IHJldHVybiBmYWxzZTsgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBfbWFrZUNka01ldGFkYXRhQXZhaWxhYmxlQ29uZGl0aW9uKCkge1xuICByZXR1cm4gX2ZuT3IoUmVnaW9uSW5mby5yZWdpb25zXG4gICAgLmZpbHRlcihyaSA9PiByaS5jZGtNZXRhZGF0YVJlc291cmNlQXZhaWxhYmxlKVxuICAgIC5tYXAocmkgPT4gKHsgJ0ZuOjpFcXVhbHMnOiBbeyBSZWY6ICdBV1M6OlJlZ2lvbicgfSwgcmkubmFtZV0gfSkpKTtcbn1cblxuLyoqXG4gKiBUaGlzIHRha2VzIGEgYnVuY2ggb2Ygb3BlcmFuZHMgYW5kIGNyYWZ0cyBhbiBgRm46Ok9yYCBmb3IgdGhvc2UuIEZ1bm55IHRoaW5nIGlzIGBGbjo6T3JgIHJlcXVpcmVzXG4gKiBhdCBsZWFzdCAyIG9wZXJhbmRzIGFuZCBhdCBtb3N0IDEwIG9wZXJhbmRzLCBzbyB3ZSBoYXZlIHRvLi4uIGRvIHRoaXMuXG4gKi9cbmZ1bmN0aW9uIF9mbk9yKG9wZXJhbmRzOiBhbnlbXSk6IGFueSB7XG4gIGlmIChvcGVyYW5kcy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBidWlsZCBgRm46Ok9yYCB3aXRoIHplcm8gb3BlcmFuZHMhJyk7XG4gIH1cbiAgaWYgKG9wZXJhbmRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBvcGVyYW5kc1swXTtcbiAgfVxuICBpZiAob3BlcmFuZHMubGVuZ3RoIDw9IDEwKSB7XG4gICAgcmV0dXJuIHsgJ0ZuOjpPcic6IG9wZXJhbmRzIH07XG4gIH1cbiAgcmV0dXJuIF9mbk9yKF9pbkdyb3Vwc09mKG9wZXJhbmRzLCAxMCkubWFwKGdyb3VwID0+IF9mbk9yKGdyb3VwKSkpO1xufVxuXG5mdW5jdGlvbiBfaW5Hcm91cHNPZjxUPihhcnJheTogVFtdLCBtYXhHcm91cDogbnVtYmVyKTogVFtdW10ge1xuICBjb25zdCByZXN1bHQgPSBuZXcgQXJyYXk8VFtdPigpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSArPSBtYXhHcm91cCkge1xuICAgIHJlc3VsdC5wdXNoKGFycmF5LnNsaWNlKGksIGkgKyBtYXhHcm91cCkpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdE1vZHVsZXMocnVudGltZTogY3hhcGkuUnVudGltZUluZm8pOiBzdHJpbmcge1xuICBjb25zdCBtb2R1bGVzID0gbmV3IEFycmF5PHN0cmluZz4oKTtcblxuICAvLyBpbmplY3QgdG9vbGtpdCB2ZXJzaW9uIHRvIGxpc3Qgb2YgbW9kdWxlc1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICBjb25zdCB0b29sa2l0VmVyc2lvbiA9IHJlcXVpcmUoJy4uLy4uLy4uL3BhY2thZ2UuanNvbicpLnZlcnNpb247XG4gIG1vZHVsZXMucHVzaChgYXdzLWNkaz0ke3Rvb2xraXRWZXJzaW9ufWApO1xuXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHJ1bnRpbWUubGlicmFyaWVzKS5zb3J0KCkpIHtcbiAgICBtb2R1bGVzLnB1c2goYCR7a2V5fT0ke3J1bnRpbWUubGlicmFyaWVzW2tleV19YCk7XG4gIH1cbiAgcmV0dXJuIG1vZHVsZXMuam9pbignLCcpO1xufVxuIl19