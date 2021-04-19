"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withMocked = exports.withMockedClassSingleton = exports.instanceMockFrom = exports.testStack = exports.testAssembly = exports.MockCloudExecutable = exports.DEFAULT_FAKE_TEMPLATE = void 0;
const fs = require("fs");
const path = require("path");
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cxapi = require("@aws-cdk/cx-api");
const cloud_executable_1 = require("../lib/api/cxapp/cloud-executable");
const settings_1 = require("../lib/settings");
const mock_sdk_1 = require("./util/mock-sdk");
exports.DEFAULT_FAKE_TEMPLATE = { No: 'Resources' };
class MockCloudExecutable extends cloud_executable_1.CloudExecutable {
    constructor(assembly) {
        const configuration = new settings_1.Configuration();
        const sdkProvider = new mock_sdk_1.MockSdkProvider();
        super({
            configuration,
            sdkProvider,
            synthesizer: () => Promise.resolve(testAssembly(assembly)),
        });
        this.configuration = configuration;
        this.sdkProvider = sdkProvider;
    }
}
exports.MockCloudExecutable = MockCloudExecutable;
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function testAssembly(assembly) {
    var _a;
    const builder = new cxapi.CloudAssemblyBuilder();
    for (const stack of assembly.stacks) {
        const templateFile = `${stack.stackName}.template.json`;
        const template = (_a = stack.template) !== null && _a !== void 0 ? _a : exports.DEFAULT_FAKE_TEMPLATE;
        fs.writeFileSync(path.join(builder.outdir, templateFile), JSON.stringify(template, undefined, 2));
        // we call patchStackTags here to simulate the tags formatter
        // that is used when building real manifest files.
        const metadata = patchStackTags({ ...stack.metadata });
        for (const asset of stack.assets || []) {
            metadata[asset.id] = [
                { type: cxschema.ArtifactMetadataEntryType.ASSET, data: asset },
            ];
        }
        for (const missing of assembly.missing || []) {
            builder.addMissing(missing);
        }
        builder.addArtifact(stack.stackName, {
            type: cxschema.ArtifactType.AWS_CLOUDFORMATION_STACK,
            environment: stack.env || 'aws://123456789012/here',
            dependencies: stack.depends,
            metadata,
            properties: {
                ...stack.properties,
                templateFile,
                terminationProtection: stack.terminationProtection,
            },
        });
    }
    return builder.buildAssembly();
}
exports.testAssembly = testAssembly;
/**
 * Transform stack tags from how they are decalred in source code (lower cased)
 * to how they are stored on disk (upper cased). In real synthesis this is done
 * by a special tags formatter.
 *
 * @see @aws-cdk/core/lib/stack.ts
 */
function patchStackTags(metadata) {
    const cloned = clone(metadata);
    for (const metadataEntries of Object.values(cloned)) {
        for (const metadataEntry of metadataEntries) {
            if (metadataEntry.type === cxschema.ArtifactMetadataEntryType.STACK_TAGS && metadataEntry.data) {
                const metadataAny = metadataEntry;
                metadataAny.data = metadataAny.data.map((t) => {
                    return { Key: t.key, Value: t.value };
                });
            }
        }
    }
    return cloned;
}
function testStack(stack) {
    const assembly = testAssembly({ stacks: [stack] });
    return assembly.getStackByName(stack.stackName);
}
exports.testStack = testStack;
/**
 * Return a mocked instance of a class, given its constructor
 *
 * I don't understand why jest doesn't provide this by default,
 * but there you go.
 *
 * FIXME: Currently very limited. Doesn't support inheritance, getters or
 * automatic detection of properties (as those exist on instances, not
 * classes).
 */
function instanceMockFrom(ctr) {
    const ret = {};
    for (const methodName of Object.getOwnPropertyNames(ctr.prototype)) {
        ret[methodName] = jest.fn();
    }
    return ret;
}
exports.instanceMockFrom = instanceMockFrom;
/**
 * Run an async block with a class (constructor) replaced with a mock
 *
 * The class constructor will be replaced with a constructor that returns
 * a singleton, and the singleton will be passed to the block so that its
 * methods can be mocked individually.
 *
 * Uses `instanceMockFrom` so is subject to the same limitations that hold
 * for that function.
 */
async function withMockedClassSingleton(obj, key, cb) {
    const original = obj[key];
    try {
        const mock = instanceMockFrom(original);
        obj[key] = jest.fn().mockReturnValue(mock);
        const ret = await cb(mock);
        return ret;
    }
    finally {
        obj[key] = original;
    }
}
exports.withMockedClassSingleton = withMockedClassSingleton;
function withMocked(obj, key, block) {
    const original = obj[key];
    const mockFn = jest.fn();
    obj[key] = mockFn;
    let asyncFinally = false;
    try {
        const ret = block(mockFn);
        if (!isPromise(ret)) {
            return ret;
        }
        asyncFinally = true;
        return ret.finally(() => { obj[key] = original; });
    }
    finally {
        if (!asyncFinally) {
            obj[key] = original;
        }
    }
}
exports.withMocked = withMocked;
function isPromise(object) {
    return Promise.resolve(object) === object;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInV0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QiwyREFBMkQ7QUFDM0QseUNBQXlDO0FBQ3pDLHdFQUFvRTtBQUNwRSw4Q0FBZ0Q7QUFDaEQsOENBQWtEO0FBRXJDLFFBQUEscUJBQXFCLEdBQUcsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUM7QUFrQnpELE1BQWEsbUJBQW9CLFNBQVEsa0NBQWU7SUFJdEQsWUFBWSxRQUFzQjtRQUNoQyxNQUFNLGFBQWEsR0FBRyxJQUFJLHdCQUFhLEVBQUUsQ0FBQztRQUMxQyxNQUFNLFdBQVcsR0FBRyxJQUFJLDBCQUFlLEVBQUUsQ0FBQztRQUUxQyxLQUFLLENBQUM7WUFDSixhQUFhO1lBQ2IsV0FBVztZQUNYLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUMzRCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUNqQyxDQUFDO0NBQ0Y7QUFqQkQsa0RBaUJDO0FBRUQsU0FBUyxLQUFLLENBQUMsR0FBUTtJQUNyQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3pDLENBQUM7QUFFRCxTQUFnQixZQUFZLENBQUMsUUFBc0I7O0lBQ2pELE1BQU0sT0FBTyxHQUFHLElBQUksS0FBSyxDQUFDLG9CQUFvQixFQUFFLENBQUM7SUFFakQsS0FBSyxNQUFNLEtBQUssSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQ25DLE1BQU0sWUFBWSxHQUFHLEdBQUcsS0FBSyxDQUFDLFNBQVMsZ0JBQWdCLENBQUM7UUFDeEQsTUFBTSxRQUFRLFNB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Q0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBUSxDQUFDO0tBQzNEO1lBQVM7UUFDUixJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ2pCLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUM7U0FDckI7S0FDRjtBQUNILENBQUM7QUFqQkQsZ0NBaUJDO0FBRUQsU0FBUyxTQUFTLENBQUksTUFBVztJQUMvQixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssTUFBTSxDQUFDO0FBQzVDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgY3hzY2hlbWEgZnJvbSAnQGF3cy1jZGsvY2xvdWQtYXNzZW1ibHktc2NoZW1hJztcbmltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgeyBDbG91ZEV4ZWN1dGFibGUgfSBmcm9tICcuLi9saWIvYXBpL2N4YXBwL2Nsb3VkLWV4ZWN1dGFibGUnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2xpYi9zZXR0aW5ncyc7XG5pbXBvcnQgeyBNb2NrU2RrUHJvdmlkZXIgfSBmcm9tICcuL3V0aWwvbW9jay1zZGsnO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9GQUtFX1RFTVBMQVRFID0geyBObzogJ1Jlc291cmNlcycgfTtcblxuZXhwb3J0IGludGVyZmFjZSBUZXN0U3RhY2tBcnRpZmFjdCB7XG4gIHN0YWNrTmFtZTogc3RyaW5nO1xuICB0ZW1wbGF0ZT86IGFueTtcbiAgZW52Pzogc3RyaW5nLFxuICBkZXBlbmRzPzogc3RyaW5nW107XG4gIG1ldGFkYXRhPzogY3hhcGkuU3RhY2tNZXRhZGF0YTtcbiAgYXNzZXRzPzogY3hzY2hlbWEuQXNzZXRNZXRhZGF0YUVudHJ5W107XG4gIHByb3BlcnRpZXM/OiBQYXJ0aWFsPGN4c2NoZW1hLkF3c0Nsb3VkRm9ybWF0aW9uU3RhY2tQcm9wZXJ0aWVzPjtcbiAgdGVybWluYXRpb25Qcm90ZWN0aW9uPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUZXN0QXNzZW1ibHkge1xuICBzdGFja3M6IFRlc3RTdGFja0FydGlmYWN0W107XG4gIG1pc3Npbmc/OiBjeHNjaGVtYS5NaXNzaW5nQ29udGV4dFtdO1xufVxuXG5leHBvcnQgY2xhc3MgTW9ja0Nsb3VkRXhlY3V0YWJsZSBleHRlbmRzIENsb3VkRXhlY3V0YWJsZSB7XG4gIHB1YmxpYyByZWFkb25seSBjb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc2RrUHJvdmlkZXI6IE1vY2tTZGtQcm92aWRlcjtcblxuICBjb25zdHJ1Y3Rvcihhc3NlbWJseTogVGVzdEFzc2VtYmx5KSB7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbiA9IG5ldyBDb25maWd1cmF0aW9uKCk7XG4gICAgY29uc3Qgc2RrUHJvdmlkZXIgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG5cbiAgICBzdXBlcih7XG4gICAgICBjb25maWd1cmF0aW9uLFxuICAgICAgc2RrUHJvdmlkZXIsXG4gICAgICBzeW50aGVzaXplcjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHRlc3RBc3NlbWJseShhc3NlbWJseSkpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5jb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbjtcbiAgICB0aGlzLnNka1Byb3ZpZGVyID0gc2RrUHJvdmlkZXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xvbmUob2JqOiBhbnkpIHtcbiAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXN0QXNzZW1ibHkoYXNzZW1ibHk6IFRlc3RBc3NlbWJseSk6IGN4YXBpLkNsb3VkQXNzZW1ibHkge1xuICBjb25zdCBidWlsZGVyID0gbmV3IGN4YXBpLkNsb3VkQXNzZW1ibHlCdWlsZGVyKCk7XG5cbiAgZm9yIChjb25zdCBzdGFjayBvZiBhc3NlbWJseS5zdGFja3MpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBgJHtzdGFjay5zdGFja05hbWV9LnRlbXBsYXRlLmpzb25gO1xuICAgIGNvbnN0IHRlbXBsYXRlID0gc3RhY2sudGVtcGxhdGUgPz8gREVGQVVMVF9GQUtFX1RFTVBMQVRFO1xuICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGJ1aWxkZXIub3V0ZGlyLCB0ZW1wbGF0ZUZpbGUpLCBKU09OLnN0cmluZ2lmeSh0ZW1wbGF0ZSwgdW5kZWZpbmVkLCAyKSk7XG5cbiAgICAvLyB3ZSBjYWxsIHBhdGNoU3RhY2tUYWdzIGhlcmUgdG8gc2ltdWxhdGUgdGhlIHRhZ3MgZm9ybWF0dGVyXG4gICAgLy8gdGhhdCBpcyB1c2VkIHdoZW4gYnVpbGRpbmcgcmVhbCBtYW5pZmVzdCBmaWxlcy5cbiAgICBjb25zdCBtZXRhZGF0YTogeyBbcGF0aDogc3RyaW5nXTogY3hzY2hlbWEuTWV0YWRhdGFFbnRyeVtdIH0gPSBwYXRjaFN0YWNrVGFncyh7IC4uLnN0YWNrLm1ldGFkYXRhIH0pO1xuICAgIGZvciAoY29uc3QgYXNzZXQgb2Ygc3RhY2suYXNzZXRzIHx8IFtdKSB7XG4gICAgICBtZXRhZGF0YVthc3NldC5pZF0gPSBbXG4gICAgICAgIHsgdHlwZTogY3hzY2hlbWEuQXJ0aWZhY3RNZXRhZGF0YUVudHJ5VHlwZS5BU1NFVCwgZGF0YTogYXNzZXQgfSxcbiAgICAgIF07XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBtaXNzaW5nIG9mIGFzc2VtYmx5Lm1pc3NpbmcgfHwgW10pIHtcbiAgICAgIGJ1aWxkZXIuYWRkTWlzc2luZyhtaXNzaW5nKTtcbiAgICB9XG5cbiAgICBidWlsZGVyLmFkZEFydGlmYWN0KHN0YWNrLnN0YWNrTmFtZSwge1xuICAgICAgdHlwZTogY3hzY2hlbWEuQXJ0aWZhY3RUeXBlLkFXU19DTE9VREZPUk1BVElPTl9TVEFDSyxcbiAgICAgIGVudmlyb25tZW50OiBzdGFjay5lbnYgfHwgJ2F3czovLzEyMzQ1Njc4OTAxMi9oZXJlJyxcblxuICAgICAgZGVwZW5kZW5jaWVzOiBzdGFjay5kZXBlbmRzLFxuICAgICAgbWV0YWRhdGEsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIC4uLnN0YWNrLnByb3BlcnRpZXMsXG4gICAgICAgIHRlbXBsYXRlRmlsZSxcbiAgICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiBzdGFjay50ZXJtaW5hdGlvblByb3RlY3Rpb24sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkZXIuYnVpbGRBc3NlbWJseSgpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBzdGFjayB0YWdzIGZyb20gaG93IHRoZXkgYXJlIGRlY2FscmVkIGluIHNvdXJjZSBjb2RlIChsb3dlciBjYXNlZClcbiAqIHRvIGhvdyB0aGV5IGFyZSBzdG9yZWQgb24gZGlzayAodXBwZXIgY2FzZWQpLiBJbiByZWFsIHN5bnRoZXNpcyB0aGlzIGlzIGRvbmVcbiAqIGJ5IGEgc3BlY2lhbCB0YWdzIGZvcm1hdHRlci5cbiAqXG4gKiBAc2VlIEBhd3MtY2RrL2NvcmUvbGliL3N0YWNrLnRzXG4gKi9cbmZ1bmN0aW9uIHBhdGNoU3RhY2tUYWdzKG1ldGFkYXRhOiB7IFtwYXRoOiBzdHJpbmddOiBjeHNjaGVtYS5NZXRhZGF0YUVudHJ5W10gfSk6IHsgW3BhdGg6IHN0cmluZ106IGN4c2NoZW1hLk1ldGFkYXRhRW50cnlbXSB9IHtcblxuICBjb25zdCBjbG9uZWQgPSBjbG9uZShtZXRhZGF0YSkgYXMgeyBbcGF0aDogc3RyaW5nXTogY3hzY2hlbWEuTWV0YWRhdGFFbnRyeVtdIH07XG5cbiAgZm9yIChjb25zdCBtZXRhZGF0YUVudHJpZXMgb2YgT2JqZWN0LnZhbHVlcyhjbG9uZWQpKSB7XG4gICAgZm9yIChjb25zdCBtZXRhZGF0YUVudHJ5IG9mIG1ldGFkYXRhRW50cmllcykge1xuICAgICAgaWYgKG1ldGFkYXRhRW50cnkudHlwZSA9PT0gY3hzY2hlbWEuQXJ0aWZhY3RNZXRhZGF0YUVudHJ5VHlwZS5TVEFDS19UQUdTICYmIG1ldGFkYXRhRW50cnkuZGF0YSkge1xuXG4gICAgICAgIGNvbnN0IG1ldGFkYXRhQW55ID0gbWV0YWRhdGFFbnRyeSBhcyBhbnk7XG5cbiAgICAgICAgbWV0YWRhdGFBbnkuZGF0YSA9IG1ldGFkYXRhQW55LmRhdGEubWFwKCh0OiBhbnkpID0+IHtcbiAgICAgICAgICByZXR1cm4geyBLZXk6IHQua2V5LCBWYWx1ZTogdC52YWx1ZSB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNsb25lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlc3RTdGFjayhzdGFjazogVGVzdFN0YWNrQXJ0aWZhY3QpIHtcbiAgY29uc3QgYXNzZW1ibHkgPSB0ZXN0QXNzZW1ibHkoeyBzdGFja3M6IFtzdGFja10gfSk7XG4gIHJldHVybiBhc3NlbWJseS5nZXRTdGFja0J5TmFtZShzdGFjay5zdGFja05hbWUpO1xufVxuXG4vKipcbiAqIFJldHVybiBhIG1vY2tlZCBpbnN0YW5jZSBvZiBhIGNsYXNzLCBnaXZlbiBpdHMgY29uc3RydWN0b3JcbiAqXG4gKiBJIGRvbid0IHVuZGVyc3RhbmQgd2h5IGplc3QgZG9lc24ndCBwcm92aWRlIHRoaXMgYnkgZGVmYXVsdCxcbiAqIGJ1dCB0aGVyZSB5b3UgZ28uXG4gKlxuICogRklYTUU6IEN1cnJlbnRseSB2ZXJ5IGxpbWl0ZWQuIERvZXNuJ3Qgc3VwcG9ydCBpbmhlcml0YW5jZSwgZ2V0dGVycyBvclxuICogYXV0b21hdGljIGRldGVjdGlvbiBvZiBwcm9wZXJ0aWVzIChhcyB0aG9zZSBleGlzdCBvbiBpbnN0YW5jZXMsIG5vdFxuICogY2xhc3NlcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnN0YW5jZU1vY2tGcm9tPEE+KGN0cjogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gQSk6IGplc3QuTW9ja2VkPEE+IHtcbiAgY29uc3QgcmV0OiBhbnkgPSB7fTtcbiAgZm9yIChjb25zdCBtZXRob2ROYW1lIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGN0ci5wcm90b3R5cGUpKSB7XG4gICAgcmV0W21ldGhvZE5hbWVdID0gamVzdC5mbigpO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbi8qKlxuICogUnVuIGFuIGFzeW5jIGJsb2NrIHdpdGggYSBjbGFzcyAoY29uc3RydWN0b3IpIHJlcGxhY2VkIHdpdGggYSBtb2NrXG4gKlxuICogVGhlIGNsYXNzIGNvbnN0cnVjdG9yIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhIGNvbnN0cnVjdG9yIHRoYXQgcmV0dXJuc1xuICogYSBzaW5nbGV0b24sIGFuZCB0aGUgc2luZ2xldG9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBibG9jayBzbyB0aGF0IGl0c1xuICogbWV0aG9kcyBjYW4gYmUgbW9ja2VkIGluZGl2aWR1YWxseS5cbiAqXG4gKiBVc2VzIGBpbnN0YW5jZU1vY2tGcm9tYCBzbyBpcyBzdWJqZWN0IHRvIHRoZSBzYW1lIGxpbWl0YXRpb25zIHRoYXQgaG9sZFxuICogZm9yIHRoYXQgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoTW9ja2VkQ2xhc3NTaW5nbGV0b248QSBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIGtleW9mIEEsIEI+KFxuICBvYmo6IEEsXG4gIGtleTogSyxcbiAgY2I6IChtb2NrOiBBW0tdIGV4dGVuZHMgamVzdC5Db25zdHJ1Y3RhYmxlID8gamVzdC5Nb2NrZWQ8SW5zdGFuY2VUeXBlPEFbS10+PiA6IG5ldmVyKSA9PiBQcm9taXNlPEI+LFxuKTogUHJvbWlzZTxCPiB7XG5cbiAgY29uc3Qgb3JpZ2luYWwgPSBvYmpba2V5XTtcbiAgdHJ5IHtcbiAgICBjb25zdCBtb2NrID0gaW5zdGFuY2VNb2NrRnJvbShvcmlnaW5hbCBhcyBhbnkpO1xuICAgIG9ialtrZXldID0gamVzdC5mbigpLm1vY2tSZXR1cm5WYWx1ZShtb2NrKSBhcyBhbnk7XG4gICAgY29uc3QgcmV0ID0gYXdhaXQgY2IobW9jayBhcyBhbnkpO1xuICAgIHJldHVybiByZXQ7XG4gIH0gZmluYWxseSB7XG4gICAgb2JqW2tleV0gPSBvcmlnaW5hbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd2l0aE1vY2tlZDxBIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMga2V5b2YgQSwgQj4ob2JqOiBBLCBrZXk6IEssIGJsb2NrOiAoZm46IGplc3QuTW9ja2VkPEE+W0tdKSA9PiBCKTogQiB7XG4gIGNvbnN0IG9yaWdpbmFsID0gb2JqW2tleV07XG4gIGNvbnN0IG1vY2tGbiA9IGplc3QuZm4oKTtcbiAgKG9iaiBhcyBhbnkpW2tleV0gPSBtb2NrRm47XG5cbiAgbGV0IGFzeW5jRmluYWxseTogYm9vbGVhbiA9IGZhbHNlO1xuICB0cnkge1xuICAgIGNvbnN0IHJldCA9IGJsb2NrKG1vY2tGbiBhcyBhbnkpO1xuICAgIGlmICghaXNQcm9taXNlKHJldCkpIHsgcmV0dXJuIHJldDsgfVxuXG4gICAgYXN5bmNGaW5hbGx5ID0gdHJ1ZTtcbiAgICByZXR1cm4gcmV0LmZpbmFsbHkoKCkgPT4geyBvYmpba2V5XSA9IG9yaWdpbmFsOyB9KSBhcyBhbnk7XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKCFhc3luY0ZpbmFsbHkpIHtcbiAgICAgIG9ialtrZXldID0gb3JpZ2luYWw7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzUHJvbWlzZTxBPihvYmplY3Q6IGFueSk6IG9iamVjdCBpcyBQcm9taXNlPEE+IHtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShvYmplY3QpID09PSBvYmplY3Q7XG59XG4iXX0=