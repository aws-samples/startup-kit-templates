"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cxapi = require("@aws-cdk/cx-api");
const cloud_assembly_1 = require("../../lib/api/cxapp/cloud-assembly");
const context_providers_1 = require("../../lib/context-providers");
const util_1 = require("../util");
describe('AWS::CDK::Metadata', () => {
    test('is generated for relocatable stacks', async () => {
        var _a;
        const cx = await testCloudExecutable({ env: `aws://${cxapi.UNKNOWN_ACCOUNT}/${cxapi.UNKNOWN_REGION}`, versionReporting: true });
        const cxasm = await cx.synthesize();
        const result = cxasm.stackById('withouterrors').firstStack;
        const metadata = result.template.Resources && result.template.Resources.CDKMetadata;
        expect(metadata).toEqual({
            Type: 'AWS::CDK::Metadata',
            Properties: {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                Modules: `${require('../../package.json').name}=${require('../../package.json').version}`,
            },
            Condition: 'CDKMetadataAvailable',
        });
        expect((_a = result.template.Conditions) === null || _a === void 0 ? void 0 : _a.CDKMetadataAvailable).toBeDefined();
    });
    test('is generated for stacks in supported regions', async () => {
        const cx = await testCloudExecutable({ env: 'aws://012345678912/us-east-1', versionReporting: true });
        const cxasm = await cx.synthesize();
        const result = cxasm.stackById('withouterrors').firstStack;
        const metadata = result.template.Resources && result.template.Resources.CDKMetadata;
        expect(metadata).toEqual({
            Type: 'AWS::CDK::Metadata',
            Properties: {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                Modules: `${require('../../package.json').name}=${require('../../package.json').version}`,
            },
        });
    });
    test('is not generated for stacks in unsupported regions', async () => {
        const cx = await testCloudExecutable({ env: 'aws://012345678912/bermuda-triangle-1337', versionReporting: true });
        const cxasm = await cx.synthesize();
        const result = cxasm.stackById('withouterrors').firstStack;
        const metadata = result.template.Resources && result.template.Resources.CDKMetadata;
        expect(metadata).toBeUndefined();
    });
});
test('stop executing if context providers are not making progress', async () => {
    context_providers_1.registerContextProvider(cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER, class {
        async getValue(_) {
            return 'foo';
        }
    });
    const cloudExecutable = new util_1.MockCloudExecutable({
        stacks: [{
                stackName: 'thestack',
                template: { resource: 'noerrorresource' },
            }],
        // Always return the same missing keys, synthesis should still finish.
        missing: [
            { key: 'abcdef', props: { account: '1324', region: 'us-east-1' }, provider: cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER },
        ],
    });
    const cxasm = await cloudExecutable.synthesize();
    // WHEN
    await cxasm.selectStacks(['thestack'], { defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks });
    // THEN: the test finishes normally});
});
test('fails if lookups are disabled and missing context is synthesized', async () => {
    // GIVEN
    const cloudExecutable = new util_1.MockCloudExecutable({
        stacks: [{
                stackName: 'thestack',
                template: { resource: 'noerrorresource' },
            }],
        // Always return the same missing keys, synthesis should still finish.
        missing: [
            { key: 'abcdef', props: { account: '1324', region: 'us-east-1' }, provider: cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER },
        ],
    });
    cloudExecutable.configuration.settings.set(['lookups'], false);
    // WHEN
    await expect(cloudExecutable.synthesize()).rejects.toThrow(/Context lookups have been disabled/);
});
async function testCloudExecutable({ env, versionReporting = true } = {}) {
    const cloudExec = new util_1.MockCloudExecutable({
        stacks: [{
                stackName: 'withouterrors',
                env,
                template: { resource: 'noerrorresource' },
            },
            {
                stackName: 'witherrors',
                env,
                template: { resource: 'errorresource' },
                metadata: {
                    '/resource': [
                        {
                            type: cxschema.ArtifactMetadataEntryType.ERROR,
                            data: 'this is an error',
                        },
                    ],
                },
            }],
    });
    cloudExec.configuration.settings.set(['versionReporting'], versionReporting);
    return cloudExec;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQtZXhlY3V0YWJsZS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xvdWQtZXhlY3V0YWJsZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMkRBQTJEO0FBQzNELHlDQUF5QztBQUN6Qyx1RUFBc0U7QUFDdEUsbUVBQXNFO0FBQ3RFLGtDQUE4QztBQUU5QyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO0lBQ2xDLElBQUksQ0FBQyxxQ0FBcUMsRUFBRSxLQUFLLElBQUksRUFBRTs7UUFDckQsTUFBTSxFQUFFLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxFQUFFLEdBQUcsRUFBRSxTQUFTLEtBQUssQ0FBQyxlQUFlLElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDaEksTUFBTSxLQUFLLEdBQUcsTUFBTSxFQUFFLENBQUMsVUFBVSxFQUFFLENBQUM7UUFFcEMsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxVQUFVLENBQUM7UUFDM0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDO1FBQ3BGLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDdkIsSUFBSSxFQUFFLG9CQUFvQjtZQUMxQixVQUFVLEVBQUU7Z0JBQ1YsaUVBQWlFO2dCQUNqRSxPQUFPLEVBQUUsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsT0FBTyxFQUFFO2FBQzFGO1lBQ0QsU0FBUyxFQUFFLHNCQUFzQjtTQUNsQyxDQUFDLENBQUM7UUFFSCxNQUFNLE9BQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLDBDQUFFLG9CQUFvQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDekUsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsOENBQThDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDOUQsTUFBTSxFQUFFLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxFQUFFLEdBQUcsRUFBRSw4QkFBOEIsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3RHLE1BQU0sS0FBSyxHQUFHLE1BQU0sRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRXBDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLENBQUMsVUFBVSxDQUFDO1FBQzNELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQztRQUNwRixNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3ZCLElBQUksRUFBRSxvQkFBb0I7WUFDMUIsVUFBVSxFQUFFO2dCQUNWLGlFQUFpRTtnQkFDakUsT0FBTyxFQUFFLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE9BQU8sRUFBRTthQUMxRjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG9EQUFvRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3BFLE1BQU0sRUFBRSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsRUFBRSxHQUFHLEVBQUUsMENBQTBDLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNsSCxNQUFNLEtBQUssR0FBRyxNQUFNLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUVwQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFVBQVUsQ0FBQztRQUMzRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFDcEYsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ25DLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsNkRBQTZELEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDN0UsMkNBQXVCLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQywwQkFBMEIsRUFBRTtRQUNwRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQXlCO1lBQzdDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztLQUNGLENBQUMsQ0FBQztJQUVILE1BQU0sZUFBZSxHQUFHLElBQUksMEJBQW1CLENBQUM7UUFDOUMsTUFBTSxFQUFFLENBQUM7Z0JBQ1AsU0FBUyxFQUFFLFVBQVU7Z0JBQ3JCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRTthQUMxQyxDQUFDO1FBQ0Ysc0VBQXNFO1FBQ3RFLE9BQU8sRUFBRTtZQUNQLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQywwQkFBMEIsRUFBRTtTQUNsSTtLQUNGLENBQUMsQ0FBQztJQUNILE1BQU0sS0FBSyxHQUFHLE1BQU0sZUFBZSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBRWpELE9BQU87SUFDUCxNQUFNLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLGVBQWUsRUFBRSxpQ0FBZ0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBRXhGLHNDQUFzQztBQUN4QyxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyxrRUFBa0UsRUFBRSxLQUFLLElBQUksRUFBRTtJQUNsRixRQUFRO0lBQ1IsTUFBTSxlQUFlLEdBQUcsSUFBSSwwQkFBbUIsQ0FBQztRQUM5QyxNQUFNLEVBQUUsQ0FBQztnQkFDUCxTQUFTLEVBQUUsVUFBVTtnQkFDckIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFO2FBQzFDLENBQUM7UUFDRixzRUFBc0U7UUFDdEUsT0FBTyxFQUFFO1lBQ1AsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsZUFBZSxDQUFDLDBCQUEwQixFQUFFO1NBQ2xJO0tBQ0YsQ0FBQyxDQUFDO0lBQ0gsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFFL0QsT0FBTztJQUNQLE1BQU0sTUFBTSxDQUFDLGVBQWUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0NBQW9DLENBQUMsQ0FBQztBQUNuRyxDQUFDLENBQUMsQ0FBQztBQUdILEtBQUssVUFBVSxtQkFBbUIsQ0FBQyxFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsR0FBRyxJQUFJLEtBQW1ELEVBQUU7SUFDcEgsTUFBTSxTQUFTLEdBQUcsSUFBSSwwQkFBbUIsQ0FBQztRQUN4QyxNQUFNLEVBQUUsQ0FBQztnQkFDUCxTQUFTLEVBQUUsZUFBZTtnQkFDMUIsR0FBRztnQkFDSCxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUU7YUFDMUM7WUFDRDtnQkFDRSxTQUFTLEVBQUUsWUFBWTtnQkFDdkIsR0FBRztnQkFDSCxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFO2dCQUN2QyxRQUFRLEVBQUU7b0JBQ1IsV0FBVyxFQUFFO3dCQUNYOzRCQUNFLElBQUksRUFBRSxRQUFRLENBQUMseUJBQXlCLENBQUMsS0FBSzs0QkFDOUMsSUFBSSxFQUFFLGtCQUFrQjt5QkFDekI7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDO0tBQ0gsQ0FBQyxDQUFDO0lBQ0gsU0FBUyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBRTdFLE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeHNjaGVtYSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCB7IERlZmF1bHRTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi9saWIvYXBpL2N4YXBwL2Nsb3VkLWFzc2VtYmx5JztcbmltcG9ydCB7IHJlZ2lzdGVyQ29udGV4dFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vbGliL2NvbnRleHQtcHJvdmlkZXJzJztcbmltcG9ydCB7IE1vY2tDbG91ZEV4ZWN1dGFibGUgfSBmcm9tICcuLi91dGlsJztcblxuZGVzY3JpYmUoJ0FXUzo6Q0RLOjpNZXRhZGF0YScsICgpID0+IHtcbiAgdGVzdCgnaXMgZ2VuZXJhdGVkIGZvciByZWxvY2F0YWJsZSBzdGFja3MnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY3ggPSBhd2FpdCB0ZXN0Q2xvdWRFeGVjdXRhYmxlKHsgZW52OiBgYXdzOi8vJHtjeGFwaS5VTktOT1dOX0FDQ09VTlR9LyR7Y3hhcGkuVU5LTk9XTl9SRUdJT059YCwgdmVyc2lvblJlcG9ydGluZzogdHJ1ZSB9KTtcbiAgICBjb25zdCBjeGFzbSA9IGF3YWl0IGN4LnN5bnRoZXNpemUoKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGN4YXNtLnN0YWNrQnlJZCgnd2l0aG91dGVycm9ycycpLmZpcnN0U3RhY2s7XG4gICAgY29uc3QgbWV0YWRhdGEgPSByZXN1bHQudGVtcGxhdGUuUmVzb3VyY2VzICYmIHJlc3VsdC50ZW1wbGF0ZS5SZXNvdXJjZXMuQ0RLTWV0YWRhdGE7XG4gICAgZXhwZWN0KG1ldGFkYXRhKS50b0VxdWFsKHtcbiAgICAgIFR5cGU6ICdBV1M6OkNESzo6TWV0YWRhdGEnLFxuICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICAgICAgICBNb2R1bGVzOiBgJHtyZXF1aXJlKCcuLi8uLi9wYWNrYWdlLmpzb24nKS5uYW1lfT0ke3JlcXVpcmUoJy4uLy4uL3BhY2thZ2UuanNvbicpLnZlcnNpb259YCxcbiAgICAgIH0sXG4gICAgICBDb25kaXRpb246ICdDREtNZXRhZGF0YUF2YWlsYWJsZScsXG4gICAgfSk7XG5cbiAgICBleHBlY3QocmVzdWx0LnRlbXBsYXRlLkNvbmRpdGlvbnM/LkNES01ldGFkYXRhQXZhaWxhYmxlKS50b0JlRGVmaW5lZCgpO1xuICB9KTtcblxuICB0ZXN0KCdpcyBnZW5lcmF0ZWQgZm9yIHN0YWNrcyBpbiBzdXBwb3J0ZWQgcmVnaW9ucycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjeCA9IGF3YWl0IHRlc3RDbG91ZEV4ZWN1dGFibGUoeyBlbnY6ICdhd3M6Ly8wMTIzNDU2Nzg5MTIvdXMtZWFzdC0xJywgdmVyc2lvblJlcG9ydGluZzogdHJ1ZSB9KTtcbiAgICBjb25zdCBjeGFzbSA9IGF3YWl0IGN4LnN5bnRoZXNpemUoKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGN4YXNtLnN0YWNrQnlJZCgnd2l0aG91dGVycm9ycycpLmZpcnN0U3RhY2s7XG4gICAgY29uc3QgbWV0YWRhdGEgPSByZXN1bHQudGVtcGxhdGUuUmVzb3VyY2VzICYmIHJlc3VsdC50ZW1wbGF0ZS5SZXNvdXJjZXMuQ0RLTWV0YWRhdGE7XG4gICAgZXhwZWN0KG1ldGFkYXRhKS50b0VxdWFsKHtcbiAgICAgIFR5cGU6ICdBV1M6OkNESzo6TWV0YWRhdGEnLFxuICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0c1xuICAgICAgICBNb2R1bGVzOiBgJHtyZXF1aXJlKCcuLi8uLi9wYWNrYWdlLmpzb24nKS5uYW1lfT0ke3JlcXVpcmUoJy4uLy4uL3BhY2thZ2UuanNvbicpLnZlcnNpb259YCxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2lzIG5vdCBnZW5lcmF0ZWQgZm9yIHN0YWNrcyBpbiB1bnN1cHBvcnRlZCByZWdpb25zJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGN4ID0gYXdhaXQgdGVzdENsb3VkRXhlY3V0YWJsZSh7IGVudjogJ2F3czovLzAxMjM0NTY3ODkxMi9iZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLCB2ZXJzaW9uUmVwb3J0aW5nOiB0cnVlIH0pO1xuICAgIGNvbnN0IGN4YXNtID0gYXdhaXQgY3guc3ludGhlc2l6ZSgpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gY3hhc20uc3RhY2tCeUlkKCd3aXRob3V0ZXJyb3JzJykuZmlyc3RTdGFjaztcbiAgICBjb25zdCBtZXRhZGF0YSA9IHJlc3VsdC50ZW1wbGF0ZS5SZXNvdXJjZXMgJiYgcmVzdWx0LnRlbXBsYXRlLlJlc291cmNlcy5DREtNZXRhZGF0YTtcbiAgICBleHBlY3QobWV0YWRhdGEpLnRvQmVVbmRlZmluZWQoKTtcbiAgfSk7XG59KTtcblxudGVzdCgnc3RvcCBleGVjdXRpbmcgaWYgY29udGV4dCBwcm92aWRlcnMgYXJlIG5vdCBtYWtpbmcgcHJvZ3Jlc3MnLCBhc3luYyAoKSA9PiB7XG4gIHJlZ2lzdGVyQ29udGV4dFByb3ZpZGVyKGN4c2NoZW1hLkNvbnRleHRQcm92aWRlci5BVkFJTEFCSUxJVFlfWk9ORV9QUk9WSURFUiwgY2xhc3Mge1xuICAgIHB1YmxpYyBhc3luYyBnZXRWYWx1ZShfOiB7IFtrZXk6IHN0cmluZ106IGFueSB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgIHJldHVybiAnZm9vJztcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IGNsb3VkRXhlY3V0YWJsZSA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICBzdGFja3M6IFt7XG4gICAgICBzdGFja05hbWU6ICd0aGVzdGFjaycsXG4gICAgICB0ZW1wbGF0ZTogeyByZXNvdXJjZTogJ25vZXJyb3JyZXNvdXJjZScgfSxcbiAgICB9XSxcbiAgICAvLyBBbHdheXMgcmV0dXJuIHRoZSBzYW1lIG1pc3Npbmcga2V5cywgc3ludGhlc2lzIHNob3VsZCBzdGlsbCBmaW5pc2guXG4gICAgbWlzc2luZzogW1xuICAgICAgeyBrZXk6ICdhYmNkZWYnLCBwcm9wczogeyBhY2NvdW50OiAnMTMyNCcsIHJlZ2lvbjogJ3VzLWVhc3QtMScgfSwgcHJvdmlkZXI6IGN4c2NoZW1hLkNvbnRleHRQcm92aWRlci5BVkFJTEFCSUxJVFlfWk9ORV9QUk9WSURFUiB9LFxuICAgIF0sXG4gIH0pO1xuICBjb25zdCBjeGFzbSA9IGF3YWl0IGNsb3VkRXhlY3V0YWJsZS5zeW50aGVzaXplKCk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBjeGFzbS5zZWxlY3RTdGFja3MoWyd0aGVzdGFjayddLCB7IGRlZmF1bHRCZWhhdmlvcjogRGVmYXVsdFNlbGVjdGlvbi5BbGxTdGFja3MgfSk7XG5cbiAgLy8gVEhFTjogdGhlIHRlc3QgZmluaXNoZXMgbm9ybWFsbHl9KTtcbn0pO1xuXG50ZXN0KCdmYWlscyBpZiBsb29rdXBzIGFyZSBkaXNhYmxlZCBhbmQgbWlzc2luZyBjb250ZXh0IGlzIHN5bnRoZXNpemVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjbG91ZEV4ZWN1dGFibGUgPSBuZXcgTW9ja0Nsb3VkRXhlY3V0YWJsZSh7XG4gICAgc3RhY2tzOiBbe1xuICAgICAgc3RhY2tOYW1lOiAndGhlc3RhY2snLFxuICAgICAgdGVtcGxhdGU6IHsgcmVzb3VyY2U6ICdub2Vycm9ycmVzb3VyY2UnIH0sXG4gICAgfV0sXG4gICAgLy8gQWx3YXlzIHJldHVybiB0aGUgc2FtZSBtaXNzaW5nIGtleXMsIHN5bnRoZXNpcyBzaG91bGQgc3RpbGwgZmluaXNoLlxuICAgIG1pc3Npbmc6IFtcbiAgICAgIHsga2V5OiAnYWJjZGVmJywgcHJvcHM6IHsgYWNjb3VudDogJzEzMjQnLCByZWdpb246ICd1cy1lYXN0LTEnIH0sIHByb3ZpZGVyOiBjeHNjaGVtYS5Db250ZXh0UHJvdmlkZXIuQVZBSUxBQklMSVRZX1pPTkVfUFJPVklERVIgfSxcbiAgICBdLFxuICB9KTtcbiAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnbG9va3VwcyddLCBmYWxzZSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBleHBlY3QoY2xvdWRFeGVjdXRhYmxlLnN5bnRoZXNpemUoKSkucmVqZWN0cy50b1Rocm93KC9Db250ZXh0IGxvb2t1cHMgaGF2ZSBiZWVuIGRpc2FibGVkLyk7XG59KTtcblxuXG5hc3luYyBmdW5jdGlvbiB0ZXN0Q2xvdWRFeGVjdXRhYmxlKHsgZW52LCB2ZXJzaW9uUmVwb3J0aW5nID0gdHJ1ZSB9OiB7IGVudj86IHN0cmluZywgdmVyc2lvblJlcG9ydGluZz86IGJvb2xlYW4gfSA9IHt9KSB7XG4gIGNvbnN0IGNsb3VkRXhlYyA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICBzdGFja3M6IFt7XG4gICAgICBzdGFja05hbWU6ICd3aXRob3V0ZXJyb3JzJyxcbiAgICAgIGVudixcbiAgICAgIHRlbXBsYXRlOiB7IHJlc291cmNlOiAnbm9lcnJvcnJlc291cmNlJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgc3RhY2tOYW1lOiAnd2l0aGVycm9ycycsXG4gICAgICBlbnYsXG4gICAgICB0ZW1wbGF0ZTogeyByZXNvdXJjZTogJ2Vycm9ycmVzb3VyY2UnIH0sXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICAnL3Jlc291cmNlJzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6IGN4c2NoZW1hLkFydGlmYWN0TWV0YWRhdGFFbnRyeVR5cGUuRVJST1IsXG4gICAgICAgICAgICBkYXRhOiAndGhpcyBpcyBhbiBlcnJvcicsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfV0sXG4gIH0pO1xuICBjbG91ZEV4ZWMuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5zZXQoWyd2ZXJzaW9uUmVwb3J0aW5nJ10sIHZlcnNpb25SZXBvcnRpbmcpO1xuXG4gIHJldHVybiBjbG91ZEV4ZWM7XG59XG4iXX0=