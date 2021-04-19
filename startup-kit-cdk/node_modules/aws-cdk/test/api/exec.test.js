"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('child_process');
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cdk = require("@aws-cdk/core");
const semver = require("semver");
const sinon = require("sinon");
const ts_mock_imports_1 = require("ts-mock-imports");
const exec_1 = require("../../lib/api/cxapp/exec");
const logging_1 = require("../../lib/logging");
const settings_1 = require("../../lib/settings");
const bockfs = require("../bockfs");
const util_1 = require("../util");
const mock_child_process_1 = require("../util/mock-child_process");
const mock_sdk_1 = require("../util/mock-sdk");
let sdkProvider;
let config;
beforeEach(() => {
    logging_1.setLogLevel(1 /* DEBUG */);
    sdkProvider = new mock_sdk_1.MockSdkProvider();
    config = new settings_1.Configuration();
    config.settings.set(['output'], 'cdk.out');
    // insert contents in fake filesystem
    bockfs({
        '/home/project/cloud-executable': 'ARBITRARY',
        '/home/project/windows.js': 'ARBITRARY',
        'home/project/executable-app.js': 'ARBITRARY',
    });
    bockfs.workingDirectory('/home/project');
    bockfs.executable('/home/project/cloud-executable');
    bockfs.executable('/home/project/executable-app.js');
});
afterEach(() => {
    logging_1.setLogLevel(0 /* DEFAULT */);
    sinon.restore();
    bockfs.restore();
});
// We need to increase the default 5s jest
// timeout for async tests because the 'execProgram' invocation
// might take a while :\
const TEN_SECOND_TIMEOUT = 10000;
function createApp() {
    const app = new cdk.App({ outdir: 'cdk.out' });
    const stack = new cdk.Stack(app, 'Stack');
    new cdk.CfnResource(stack, 'Role', {
        type: 'AWS::IAM::Role',
        properties: {
            RoleName: 'Role',
        },
    });
    return app;
}
test('cli throws when manifest version > schema version', async () => {
    const app = createApp();
    const currentSchemaVersion = cxschema.Manifest.version();
    const mockManifestVersion = semver.inc(currentSchemaVersion, 'major');
    // this mock will cause the framework to use a greater schema version than the real one,
    // and should cause the CLI to fail.
    const mockVersionNumber = ts_mock_imports_1.ImportMock.mockFunction(cxschema.Manifest, 'version', mockManifestVersion);
    try {
        app.synth();
    }
    finally {
        mockVersionNumber.restore();
    }
    const expectedError = 'This CDK CLI is not compatible with the CDK library used by your application. Please upgrade the CLI to the latest version.'
        + `\n(Cloud assembly schema version mismatch: Maximum schema version supported is ${currentSchemaVersion}, but found ${mockManifestVersion})`;
    config.settings.set(['app'], 'cdk.out');
    await expect(exec_1.execProgram(sdkProvider, config)).rejects.toEqual(new Error(expectedError));
}, TEN_SECOND_TIMEOUT);
test('cli does not throw when manifest version = schema version', async () => {
    const app = createApp();
    app.synth();
    config.settings.set(['app'], 'cdk.out');
    await exec_1.execProgram(sdkProvider, config);
}, TEN_SECOND_TIMEOUT);
test('cli does not throw when manifest version < schema version', async () => {
    const app = createApp();
    const currentSchemaVersion = cxschema.Manifest.version();
    app.synth();
    config.settings.set(['app'], 'cdk.out');
    // this mock will cause the cli to think its exepcted schema version is
    // greater that the version created in the manifest, which is what we are testing for.
    const mockVersionNumber = ts_mock_imports_1.ImportMock.mockFunction(cxschema.Manifest, 'version', semver.inc(currentSchemaVersion, 'major'));
    try {
        await exec_1.execProgram(sdkProvider, config);
    }
    finally {
        mockVersionNumber.restore();
    }
}, TEN_SECOND_TIMEOUT);
test('validates --app key is present', async () => {
    // GIVEN no config key for `app`
    await expect(exec_1.execProgram(sdkProvider, config)).rejects.toThrow('--app is required either in command-line, in cdk.json or in ~/.cdk.json');
});
test('bypasses synth when app points to a cloud assembly', async () => {
    // GIVEN
    config.settings.set(['app'], 'cdk.out');
    writeOutputAssembly();
    // WHEN
    const cloudAssembly = await exec_1.execProgram(sdkProvider, config);
    expect(cloudAssembly.artifacts).toEqual([]);
    expect(cloudAssembly.directory).toEqual('cdk.out');
});
test('the application set in --app is executed', async () => {
    // GIVEN
    config.settings.set(['app'], 'cloud-executable');
    mock_child_process_1.mockSpawn({
        commandLine: ['cloud-executable'],
        sideEffect: () => writeOutputAssembly(),
    });
    // WHEN
    await exec_1.execProgram(sdkProvider, config);
});
test('the application set in --app is executed as-is if it contains a filename that does not exist', async () => {
    // GIVEN
    config.settings.set(['app'], 'does-not-exist');
    mock_child_process_1.mockSpawn({
        commandLine: ['does-not-exist'],
        sideEffect: () => writeOutputAssembly(),
    });
    // WHEN
    await exec_1.execProgram(sdkProvider, config);
});
test('the application set in --app is executed with arguments', async () => {
    // GIVEN
    config.settings.set(['app'], 'cloud-executable an-arg');
    mock_child_process_1.mockSpawn({
        commandLine: ['cloud-executable', 'an-arg'],
        sideEffect: () => writeOutputAssembly(),
    });
    // WHEN
    await exec_1.execProgram(sdkProvider, config);
});
test('application set in --app as `*.js` always uses handler on windows', async () => {
    // GIVEN
    sinon.stub(process, 'platform').value('win32');
    config.settings.set(['app'], 'windows.js');
    mock_child_process_1.mockSpawn({
        commandLine: [process.execPath, 'windows.js'],
        sideEffect: () => writeOutputAssembly(),
    });
    // WHEN
    await exec_1.execProgram(sdkProvider, config);
});
test('application set in --app is `*.js` and executable', async () => {
    // GIVEN
    config.settings.set(['app'], 'executable-app.js');
    mock_child_process_1.mockSpawn({
        commandLine: ['executable-app.js'],
        sideEffect: () => writeOutputAssembly(),
    });
    // WHEN
    await exec_1.execProgram(sdkProvider, config);
});
function writeOutputAssembly() {
    const asm = util_1.testAssembly({
        stacks: [],
    });
    bockfs.write('/home/project/cdk.out/manifest.json', JSON.stringify(asm.manifest));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlYy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXhlYy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUMzQiwyREFBMkQ7QUFDM0QscUNBQXFDO0FBQ3JDLGlDQUFpQztBQUNqQywrQkFBK0I7QUFDL0IscURBQTZDO0FBQzdDLG1EQUF1RDtBQUN2RCwrQ0FBMEQ7QUFDMUQsaURBQW1EO0FBQ25ELG9DQUFvQztBQUNwQyxrQ0FBdUM7QUFDdkMsbUVBQXVEO0FBQ3ZELCtDQUFtRDtBQUVuRCxJQUFJLFdBQTRCLENBQUM7QUFDakMsSUFBSSxNQUFxQixDQUFDO0FBQzFCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxxQkFBVyxlQUFnQixDQUFDO0lBRTVCLFdBQVcsR0FBRyxJQUFJLDBCQUFlLEVBQUUsQ0FBQztJQUNwQyxNQUFNLEdBQUcsSUFBSSx3QkFBYSxFQUFFLENBQUM7SUFFN0IsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUUzQyxxQ0FBcUM7SUFDckMsTUFBTSxDQUFDO1FBQ0wsZ0NBQWdDLEVBQUUsV0FBVztRQUM3QywwQkFBMEIsRUFBRSxXQUFXO1FBQ3ZDLGdDQUFnQyxFQUFFLFdBQVc7S0FDOUMsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxDQUFDLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sQ0FBQyxVQUFVLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztJQUNwRCxNQUFNLENBQUMsVUFBVSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7QUFDdkQsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLENBQUMsR0FBRyxFQUFFO0lBQ2IscUJBQVcsaUJBQWtCLENBQUM7SUFFOUIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2hCLE1BQU0sQ0FBQyxPQUFPLEVB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LENBQUM7SUFDM0MsOEJBQVMsQ0FBQztRQUNSLFdBQVcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDO1FBQzdDLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsRUFBRTtLQUN4QyxDQUFDLENBQUM7SUFFSCxPQUFPO0lBQ1AsTUFBTSxrQkFBVyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyxtREFBbUQsRUFBRSxLQUFLLElBQUksRUFBRTtJQUNuRSxRQUFRO0lBQ1IsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO0lBQ2xELDhCQUFTLENBQUM7UUFDUixXQUFXLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztRQUNsQyxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsbUJBQW1CLEVBQUU7S0FDeEMsQ0FBQyxDQUFDO0lBRUgsT0FBTztJQUNQLE1BQU0sa0JBQVcsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLG1CQUFtQjtJQUMxQixNQUFNLEdBQUcsR0FBRyxtQkFBWSxDQUFDO1FBQ3ZCLE1BQU0sRUFBRSxFQUFFO0tBQ1gsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxxQ0FBcUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3BGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJqZXN0Lm1vY2soJ2NoaWxkX3Byb2Nlc3MnKTtcbmltcG9ydCAqIGFzIGN4c2NoZW1hIGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBzZW12ZXIgZnJvbSAnc2VtdmVyJztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IEltcG9ydE1vY2sgfSBmcm9tICd0cy1tb2NrLWltcG9ydHMnO1xuaW1wb3J0IHsgZXhlY1Byb2dyYW0gfSBmcm9tICcuLi8uLi9saWIvYXBpL2N4YXBwL2V4ZWMnO1xuaW1wb3J0IHsgTG9nTGV2ZWwsIHNldExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vbGliL2xvZ2dpbmcnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uL2xpYi9zZXR0aW5ncyc7XG5pbXBvcnQgKiBhcyBib2NrZnMgZnJvbSAnLi4vYm9ja2ZzJztcbmltcG9ydCB7IHRlc3RBc3NlbWJseSB9IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHsgbW9ja1NwYXduIH0gZnJvbSAnLi4vdXRpbC9tb2NrLWNoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgTW9ja1Nka1Byb3ZpZGVyIH0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5cbmxldCBzZGtQcm92aWRlcjogTW9ja1Nka1Byb3ZpZGVyO1xubGV0IGNvbmZpZzogQ29uZmlndXJhdGlvbjtcbmJlZm9yZUVhY2goKCkgPT4ge1xuICBzZXRMb2dMZXZlbChMb2dMZXZlbC5ERUJVRyk7XG5cbiAgc2RrUHJvdmlkZXIgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG4gIGNvbmZpZyA9IG5ldyBDb25maWd1cmF0aW9uKCk7XG5cbiAgY29uZmlnLnNldHRpbmdzLnNldChbJ291dHB1dCddLCAnY2RrLm91dCcpO1xuXG4gIC8vIGluc2VydCBjb250ZW50cyBpbiBmYWtlIGZpbGVzeXN0ZW1cbiAgYm9ja2ZzKHtcbiAgICAnL2hvbWUvcHJvamVjdC9jbG91ZC1leGVjdXRhYmxlJzogJ0FSQklUUkFSWScsXG4gICAgJy9ob21lL3Byb2plY3Qvd2luZG93cy5qcyc6ICdBUkJJVFJBUlknLFxuICAgICdob21lL3Byb2plY3QvZXhlY3V0YWJsZS1hcHAuanMnOiAnQVJCSVRSQVJZJyxcbiAgfSk7XG4gIGJvY2tmcy53b3JraW5nRGlyZWN0b3J5KCcvaG9tZS9wcm9qZWN0Jyk7XG4gIGJvY2tmcy5leGVjdXRhYmxlKCcvaG9tZS9wcm9qZWN0L2Nsb3VkLWV4ZWN1dGFibGUnKTtcbiAgYm9ja2ZzLmV4ZWN1dGFibGUoJy9ob21lL3Byb2plY3QvZXhlY3V0YWJsZS1hcHAuanMnKTtcbn0pO1xuXG5hZnRlckVhY2goKCkgPT4ge1xuICBzZXRMb2dMZXZlbChMb2dMZXZlbC5ERUZBVUxUKTtcblxuICBzaW5vbi5yZXN0b3JlKCk7XG4gIGJvY2tmcy5yZXN0b3JlKCk7XG59KTtcblxuLy8gV2UgbmVlZCB0byBpbmNyZWFzZSB0aGUgZGVmYXVsdCA1cyBqZXN0XG4vLyB0aW1lb3V0IGZvciBhc3luYyB0ZXN0cyBiZWNhdXNlIHRoZSAnZXhlY1Byb2dyYW0nIGludm9jYXRpb25cbi8vIG1pZ2h0IHRha2UgYSB3aGlsZSA6XFxcbmNvbnN0IFRFTl9TRUNPTkRfVElNRU9VVCA9IDEwMDAwO1xuXG5mdW5jdGlvbiBjcmVhdGVBcHAoKTogY2RrLkFwcCB7XG4gIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKHsgb3V0ZGlyOiAnY2RrLm91dCcgfSk7XG4gIGNvbnN0IHN0YWNrID0gbmV3IGNkay5TdGFjayhhcHAsICdTdGFjaycpO1xuXG4gIG5ldyBjZGsuQ2ZuUmVzb3VyY2Uoc3RhY2ssICdSb2xlJywge1xuICAgIHR5cGU6ICdBV1M6OklBTTo6Um9sZScsXG4gICAgcHJvcGVydGllczoge1xuICAgICAgUm9sZU5hbWU6ICdSb2xlJyxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gYXBwO1xufVxuXG50ZXN0KCdjbGkgdGhyb3dzIHdoZW4gbWFuaWZlc3QgdmVyc2lvbiA+IHNjaGVtYSB2ZXJzaW9uJywgYXN5bmMgKCkgPT4ge1xuXG4gIGNvbnN0IGFwcCA9IGNyZWF0ZUFwcCgpO1xuICBjb25zdCBjdXJyZW50U2NoZW1hVmVyc2lvbiA9IGN4c2NoZW1hLk1hbmlmZXN0LnZlcnNpb24oKTtcbiAgY29uc3QgbW9ja01hbmlmZXN0VmVyc2lvbiA9IHNlbXZlci5pbmMoY3VycmVudFNjaGVtYVZlcnNpb24sICdtYWpvcicpO1xuXG4gIC8vIHRoaXMgbW9jayB3aWxsIGNhdXNlIHRoZSBmcmFtZXdvcmsgdG8gdXNlIGEgZ3JlYXRlciBzY2hlbWEgdmVyc2lvbiB0aGFuIHRoZSByZWFsIG9uZSxcbiAgLy8gYW5kIHNob3VsZCBjYXVzZSB0aGUgQ0xJIHRvIGZhaWwuXG4gIGNvbnN0IG1vY2tWZXJzaW9uTnVtYmVyID0gSW1wb3J0TW9jay5tb2NrRnVuY3Rpb24oY3hzY2hlbWEuTWFuaWZlc3QsICd2ZXJzaW9uJywgbW9ja01hbmlmZXN0VmVyc2lvbik7XG4gIHRyeSB7XG4gICAgYXBwLnN5bnRoKCk7XG4gIH0gZmluYWxseSB7XG4gICAgbW9ja1ZlcnNpb25OdW1iZXIucmVzdG9yZSgpO1xuICB9XG5cbiAgY29uc3QgZXhwZWN0ZWRFcnJvciA9ICdUaGlzIENESyBDTEkgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgQ0RLIGxpYnJhcnkgdXNlZCBieSB5b3VyIGFwcGxpY2F0aW9uLiBQbGVhc2UgdXBncmFkZSB0aGUgQ0xJIHRvIHRoZSBsYXRlc3QgdmVyc2lvbi4nXG4gICAgKyBgXFxuKENsb3VkIGFzc2VtYmx5IHNjaGVtYSB2ZXJzaW9uIG1pc21hdGNoOiBNYXhpbXVtIHNjaGVtYSB2ZXJzaW9uIHN1cHBvcnRlZCBpcyAke2N1cnJlbnRTY2hlbWFWZXJzaW9ufSwgYnV0IGZvdW5kICR7bW9ja01hbmlmZXN0VmVyc2lvbn0pYDtcblxuICBjb25maWcuc2V0dGluZ3Muc2V0KFsnYXBwJ10sICdjZGsub3V0Jyk7XG5cbiAgYXdhaXQgZXhwZWN0KGV4ZWNQcm9ncmFtKHNka1Byb3ZpZGVyLCBjb25maWcpKS5yZWplY3RzLnRvRXF1YWwobmV3IEVycm9yKGV4cGVjdGVkRXJyb3IpKTtcblxufSwgVEVOX1NFQ09ORF9USU1FT1VUKTtcblxudGVzdCgnY2xpIGRvZXMgbm90IHRocm93IHdoZW4gbWFuaWZlc3QgdmVyc2lvbiA9IHNjaGVtYSB2ZXJzaW9uJywgYXN5bmMgKCkgPT4ge1xuXG4gIGNvbnN0IGFwcCA9IGNyZWF0ZUFwcCgpO1xuICBhcHAuc3ludGgoKTtcblxuICBjb25maWcuc2V0dGluZ3Muc2V0KFsnYXBwJ10sICdjZGsub3V0Jyk7XG5cbiAgYXdhaXQgZXhlY1Byb2dyYW0oc2RrUHJvdmlkZXIsIGNvbmZpZyk7XG5cbn0sIFRFTl9TRUNPTkRfVElNRU9VVCk7XG5cbnRlc3QoJ2NsaSBkb2VzIG5vdCB0aHJvdyB3aGVuIG1hbmlmZXN0IHZlcnNpb24gPCBzY2hlbWEgdmVyc2lvbicsIGFzeW5jICgpID0+IHtcblxuICBjb25zdCBhcHAgPSBjcmVhdGVBcHAoKTtcbiAgY29uc3QgY3VycmVudFNjaGVtYVZlcnNpb24gPSBjeHNjaGVtYS5NYW5pZmVzdC52ZXJzaW9uKCk7XG5cbiAgYXBwLnN5bnRoKCk7XG5cbiAgY29uZmlnLnNldHRpbmdzLnNldChbJ2FwcCddLCAnY2RrLm91dCcpO1xuXG4gIC8vIHRoaXMgbW9jayB3aWxsIGNhdXNlIHRoZSBjbGkgdG8gdGhpbmsgaXRzIGV4ZXBjdGVkIHNjaGVtYSB2ZXJzaW9uIGlzXG4gIC8vIGdyZWF0ZXIgdGhhdCB0aGUgdmVyc2lvbiBjcmVhdGVkIGluIHRoZSBtYW5pZmVzdCwgd2hpY2ggaXMgd2hhdCB3ZSBhcmUgdGVzdGluZyBmb3IuXG4gIGNvbnN0IG1vY2tWZXJzaW9uTnVtYmVyID0gSW1wb3J0TW9jay5tb2NrRnVuY3Rpb24oY3hzY2hlbWEuTWFuaWZlc3QsICd2ZXJzaW9uJywgc2VtdmVyLmluYyhjdXJyZW50U2NoZW1hVmVyc2lvbiwgJ21ham9yJykpO1xuICB0cnkge1xuICAgIGF3YWl0IGV4ZWNQcm9ncmFtKHNka1Byb3ZpZGVyLCBjb25maWcpO1xuICB9IGZpbmFsbHkge1xuICAgIG1vY2tWZXJzaW9uTnVtYmVyLnJlc3RvcmUoKTtcbiAgfVxuXG59LCBURU5fU0VDT05EX1RJTUVPVVQpO1xuXG50ZXN0KCd2YWxpZGF0ZXMgLS1hcHAga2V5IGlzIHByZXNlbnQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOIG5vIGNvbmZpZyBrZXkgZm9yIGBhcHBgXG4gIGF3YWl0IGV4cGVjdChleGVjUHJvZ3JhbShzZGtQcm92aWRlciwgY29uZmlnKSkucmVqZWN0cy50b1Rocm93KFxuICAgICctLWFwcCBpcyByZXF1aXJlZCBlaXRoZXIgaW4gY29tbWFuZC1saW5lLCBpbiBjZGsuanNvbiBvciBpbiB+Ly5jZGsuanNvbicsXG4gICk7XG5cbn0pO1xuXG50ZXN0KCdieXBhc3NlcyBzeW50aCB3aGVuIGFwcCBwb2ludHMgdG8gYSBjbG91ZCBhc3NlbWJseScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgY29uZmlnLnNldHRpbmdzLnNldChbJ2FwcCddLCAnY2RrLm91dCcpO1xuICB3cml0ZU91dHB1dEFzc2VtYmx5KCk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCBjbG91ZEFzc2VtYmx5ID0gYXdhaXQgZXhlY1Byb2dyYW0oc2RrUHJvdmlkZXIsIGNvbmZpZyk7XG4gIGV4cGVjdChjbG91ZEFzc2VtYmx5LmFydGlmYWN0cykudG9FcXVhbChbXSk7XG4gIGV4cGVjdChjbG91ZEFzc2VtYmx5LmRpcmVjdG9yeSkudG9FcXVhbCgnY2RrLm91dCcpO1xufSk7XG5cbnRlc3QoJ3RoZSBhcHBsaWNhdGlvbiBzZXQgaW4gLS1hcHAgaXMgZXhlY3V0ZWQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbmZpZy5zZXR0aW5ncy5zZXQoWydhcHAnXSwgJ2Nsb3VkLWV4ZWN1dGFibGUnKTtcbiAgbW9ja1NwYXduKHtcbiAgICBjb21tYW5kTGluZTogWydjbG91ZC1leGVjdXRhYmxlJ10sXG4gICAgc2lkZUVmZmVjdDogKCkgPT4gd3JpdGVPdXRwdXRBc3NlbWJseSgpLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGV4ZWNQcm9ncmFtKHNka1Byb3ZpZGVyLCBjb25maWcpO1xufSk7XG5cbnRlc3QoJ3RoZSBhcHBsaWNhdGlvbiBzZXQgaW4gLS1hcHAgaXMgZXhlY3V0ZWQgYXMtaXMgaWYgaXQgY29udGFpbnMgYSBmaWxlbmFtZSB0aGF0IGRvZXMgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25maWcuc2V0dGluZ3Muc2V0KFsnYXBwJ10sICdkb2VzLW5vdC1leGlzdCcpO1xuICBtb2NrU3Bhd24oe1xuICAgIGNvbW1hbmRMaW5lOiBbJ2RvZXMtbm90LWV4aXN0J10sXG4gICAgc2lkZUVmZmVjdDogKCkgPT4gd3JpdGVPdXRwdXRBc3NlbWJseSgpLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGV4ZWNQcm9ncmFtKHNka1Byb3ZpZGVyLCBjb25maWcpO1xufSk7XG5cbnRlc3QoJ3RoZSBhcHBsaWNhdGlvbiBzZXQgaW4gLS1hcHAgaXMgZXhlY3V0ZWQgd2l0aCBhcmd1bWVudHMnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbmZpZy5zZXR0aW5ncy5zZXQoWydhcHAnXSwgJ2Nsb3VkLWV4ZWN1dGFibGUgYW4tYXJnJyk7XG4gIG1vY2tTcGF3bih7XG4gICAgY29tbWFuZExpbmU6IFsnY2xvdWQtZXhlY3V0YWJsZScsICdhbi1hcmcnXSxcbiAgICBzaWRlRWZmZWN0OiAoKSA9PiB3cml0ZU91dHB1dEFzc2VtYmx5KCksXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZXhlY1Byb2dyYW0oc2RrUHJvdmlkZXIsIGNvbmZpZyk7XG59KTtcblxudGVzdCgnYXBwbGljYXRpb24gc2V0IGluIC0tYXBwIGFzIGAqLmpzYCBhbHdheXMgdXNlcyBoYW5kbGVyIG9uIHdpbmRvd3MnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIHNpbm9uLnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ3dpbjMyJyk7XG4gIGNvbmZpZy5zZXR0aW5ncy5zZXQoWydhcHAnXSwgJ3dpbmRvd3MuanMnKTtcbiAgbW9ja1NwYXduKHtcbiAgICBjb21tYW5kTGluZTogW3Byb2Nlc3MuZXhlY1BhdGgsICd3aW5kb3dzLmpzJ10sXG4gICAgc2lkZUVmZmVjdDogKCkgPT4gd3JpdGVPdXRwdXRBc3NlbWJseSgpLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGV4ZWNQcm9ncmFtKHNka1Byb3ZpZGVyLCBjb25maWcpO1xufSk7XG5cbnRlc3QoJ2FwcGxpY2F0aW9uIHNldCBpbiAtLWFwcCBpcyBgKi5qc2AgYW5kIGV4ZWN1dGFibGUnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbmZpZy5zZXR0aW5ncy5zZXQoWydhcHAnXSwgJ2V4ZWN1dGFibGUtYXBwLmpzJyk7XG4gIG1vY2tTcGF3bih7XG4gICAgY29tbWFuZExpbmU6IFsnZXhlY3V0YWJsZS1hcHAuanMnXSxcbiAgICBzaWRlRWZmZWN0OiAoKSA9PiB3cml0ZU91dHB1dEFzc2VtYmx5KCksXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZXhlY1Byb2dyYW0oc2RrUHJvdmlkZXIsIGNvbmZpZyk7XG59KTtcblxuZnVuY3Rpb24gd3JpdGVPdXRwdXRBc3NlbWJseSgpIHtcbiAgY29uc3QgYXNtID0gdGVzdEFzc2VtYmx5KHtcbiAgICBzdGFja3M6IFtdLFxuICB9KTtcbiAgYm9ja2ZzLndyaXRlKCcvaG9tZS9wcm9qZWN0L2Nkay5vdXQvbWFuaWZlc3QuanNvbicsIEpTT04uc3RyaW5naWZ5KGFzbS5tYW5pZmVzdCkpO1xufVxuIl19