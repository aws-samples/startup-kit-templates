"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockSpawn = void 0;
const child_process = require("child_process");
const events = require("events");
if (!child_process.spawn.mockImplementationOnce) {
    throw new Error('Call "jest.mock(\'child_process\');" at the top of the test file!');
}
function mockSpawn(...invocations) {
    let mock = child_process.spawn;
    for (const _invocation of invocations) {
        const invocation = _invocation; // Mirror into variable for closure
        mock = mock.mockImplementationOnce((binary, args, options) => {
            var _a, _b;
            if (invocation.prefix) {
                // Match command line prefix
                expect([binary, ...args].slice(0, invocation.commandLine.length)).toEqual(invocation.commandLine);
            }
            else {
                // Match full command line
                expect([binary, ...args]).toEqual(invocation.commandLine);
            }
            if (invocation.cwd != null) {
                expect(options.cwd).toBe(invocation.cwd);
            }
            if (invocation.sideEffect) {
                invocation.sideEffect();
            }
            const child = new events.EventEmitter();
            child.stdin = new events.EventEmitter();
            child.stdin.write = jest.fn();
            child.stdin.end = jest.fn();
            child.stdout = new events.EventEmitter();
            child.stderr = new events.EventEmitter();
            if (invocation.stdout) {
                mockEmit(child.stdout, 'data', invocation.stdout);
            }
            mockEmit(child, 'close', (_a = invocation.exitCode) !== null && _a !== void 0 ? _a : 0);
            mockEmit(child, 'exit', (_b = invocation.exitCode) !== null && _b !== void 0 ? _b : 0);
            return child;
        });
    }
    mock.mockImplementation((binary, args, _options) => {
        throw new Error(`Did not expect call of ${JSON.stringify([binary, ...args])}`);
    });
}
exports.mockSpawn = mockSpawn;
/**
 * Must do this on the next tick, as emitter.emit() expects all listeners to have been attached already
 */
function mockEmit(emitter, event, data) {
    setImmediate(() => {
        emitter.emit(event, data);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay1jaGlsZF9wcm9jZXNzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9jay1jaGlsZF9wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtDQUErQztBQUMvQyxpQ0FBaUM7QUFFakMsSUFBSSxDQUFFLGFBQXFCLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFO0lBQ3hELE1BQU0sSUFBSSxLQUFLLENBQUMsbUVBQW1FLENBQUMsQ0FBQztDQUN0RjtBQW1CRCxTQUFnQixTQUFTLENBQUMsR0FBRyxXQUF5QjtJQUNwRCxJQUFJLElBQUksR0FBSSxhQUFhLENBQUMsS0FBYSxDQUFDO0lBQ3hDLEtBQUssTUFBTSxXQUFXLElBQUksV0FBVyxFQUFFO1FBQ3JDLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxDQUFDLG1DQUFtQztRQUNuRSxJQUFJLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUMsTUFBYyxFQUFFLElBQWMsRUFBRSxPQUFtQyxFQUFFLEVBQUU7O1lBQ3pHLElBQUksVUFBVSxDQUFDLE1BQU0sRUFBRTtnQkFDckIsNEJBQTRCO2dCQUM1QixNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ25HO2lCQUFNO2dCQUNMLDBCQUEwQjtnQkFDMUIsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQzNEO1lBRUQsSUFBSSxVQUFVLENBQUMsR0FBRyxJQUFJLElBQUksRUFBRTtnQkFDMUIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQzFDO1lBRUQsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFO2dCQUN6QixVQUFVLENBQUMsVUFBVSxFQUFFLENBQUM7YUFDekI7WUFFRCxNQUFNLEtBQUssR0FBUSxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM3QyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3hDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM5QixLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDNUIsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN6QyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBRXpDLElBQUksVUFBVSxDQUFDLE1BQU0sRUFBRTtnQkFDckIsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUNuRDtZQUNELFFBQVEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxRQUFFLFVBQVUsQ0FBQyxRQUFRLG1DQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ25ELFFBQVEsQ0FBQyxLQUFLLEVBQUUsTUFBTSxRQUFFLFVBQVUsQ0FBQyxRQUFRLG1DQUFJLENBQUMsQ0FBQyxDQUFDO1lBRWxELE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQyxDQUFDLENBQUM7S0FDSjtJQUVELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQWMsRUFBRSxJQUFjLEVBQUUsUUFBYSxFQUFFLEVBQUU7UUFDeEUsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQXpDRCw4QkF5Q0M7QUFFRDs7R0FFRztBQUNILFNBQVMsUUFBUSxDQUFDLE9BQTRCLEVBQUUsS0FBYSxFQUFFLElBQVM7SUFDdEUsWUFBWSxDQUFDLEdBQUcsRUFBRTtRQUNoQixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjaGlsZF9wcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2V2ZW50cyc7XG5cbmlmICghKGNoaWxkX3Byb2Nlc3MgYXMgYW55KS5zcGF3bi5tb2NrSW1wbGVtZW50YXRpb25PbmNlKSB7XG4gIHRocm93IG5ldyBFcnJvcignQ2FsbCBcImplc3QubW9jayhcXCdjaGlsZF9wcm9jZXNzXFwnKTtcIiBhdCB0aGUgdG9wIG9mIHRoZSB0ZXN0IGZpbGUhJyk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW52b2NhdGlvbiB7XG4gIGNvbW1hbmRMaW5lOiBzdHJpbmdbXTtcbiAgY3dkPzogc3RyaW5nO1xuICBleGl0Q29kZT86IG51bWJlcjtcbiAgc3Rkb3V0Pzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBPbmx5IG1hdGNoIGEgcHJlZml4IG9mIHRoZSBjb21tYW5kIChkb24ndCBjYXJlIGFib3V0IHRoZSBkZXRhaWxzIG9mIHRoZSBhcmd1bWVudHMpXG4gICAqL1xuICBwcmVmaXg/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBSdW4gdGhpcyBmdW5jdGlvbiBhcyBhIHNpZGUgZWZmZWN0LCBpZiBwcmVzZW50XG4gICAqL1xuICBzaWRlRWZmZWN0PzogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vY2tTcGF3biguLi5pbnZvY2F0aW9uczogSW52b2NhdGlvbltdKSB7XG4gIGxldCBtb2NrID0gKGNoaWxkX3Byb2Nlc3Muc3Bhd24gYXMgYW55KTtcbiAgZm9yIChjb25zdCBfaW52b2NhdGlvbiBvZiBpbnZvY2F0aW9ucykge1xuICAgIGNvbnN0IGludm9jYXRpb24gPSBfaW52b2NhdGlvbjsgLy8gTWlycm9yIGludG8gdmFyaWFibGUgZm9yIGNsb3N1cmVcbiAgICBtb2NrID0gbW9jay5tb2NrSW1wbGVtZW50YXRpb25PbmNlKChiaW5hcnk6IHN0cmluZywgYXJnczogc3RyaW5nW10sIG9wdGlvbnM6IGNoaWxkX3Byb2Nlc3MuU3Bhd25PcHRpb25zKSA9PiB7XG4gICAgICBpZiAoaW52b2NhdGlvbi5wcmVmaXgpIHtcbiAgICAgICAgLy8gTWF0Y2ggY29tbWFuZCBsaW5lIHByZWZpeFxuICAgICAgICBleHBlY3QoW2JpbmFyeSwgLi4uYXJnc10uc2xpY2UoMCwgaW52b2NhdGlvbi5jb21tYW5kTGluZS5sZW5ndGgpKS50b0VxdWFsKGludm9jYXRpb24uY29tbWFuZExpbmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTWF0Y2ggZnVsbCBjb21tYW5kIGxpbmVcbiAgICAgICAgZXhwZWN0KFtiaW5hcnksIC4uLmFyZ3NdKS50b0VxdWFsKGludm9jYXRpb24uY29tbWFuZExpbmUpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW52b2NhdGlvbi5jd2QgIT0gbnVsbCkge1xuICAgICAgICBleHBlY3Qob3B0aW9ucy5jd2QpLnRvQmUoaW52b2NhdGlvbi5jd2QpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW52b2NhdGlvbi5zaWRlRWZmZWN0KSB7XG4gICAgICAgIGludm9jYXRpb24uc2lkZUVmZmVjdCgpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjaGlsZDogYW55ID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcbiAgICAgIGNoaWxkLnN0ZGluID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcbiAgICAgIGNoaWxkLnN0ZGluLndyaXRlID0gamVzdC5mbigpO1xuICAgICAgY2hpbGQuc3RkaW4uZW5kID0gamVzdC5mbigpO1xuICAgICAgY2hpbGQuc3Rkb3V0ID0gbmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIoKTtcbiAgICAgIGNoaWxkLnN0ZGVyciA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG5cbiAgICAgIGlmIChpbnZvY2F0aW9uLnN0ZG91dCkge1xuICAgICAgICBtb2NrRW1pdChjaGlsZC5zdGRvdXQsICdkYXRhJywgaW52b2NhdGlvbi5zdGRvdXQpO1xuICAgICAgfVxuICAgICAgbW9ja0VtaXQoY2hpbGQsICdjbG9zZScsIGludm9jYXRpb24uZXhpdENvZGUgPz8gMCk7XG4gICAgICBtb2NrRW1pdChjaGlsZCwgJ2V4aXQnLCBpbnZvY2F0aW9uLmV4aXRDb2RlID8/IDApO1xuXG4gICAgICByZXR1cm4gY2hpbGQ7XG4gICAgfSk7XG4gIH1cblxuICBtb2NrLm1vY2tJbXBsZW1lbnRhdGlvbigoYmluYXJ5OiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBfb3B0aW9uczogYW55KSA9PiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBEaWQgbm90IGV4cGVjdCBjYWxsIG9mICR7SlNPTi5zdHJpbmdpZnkoW2JpbmFyeSwgLi4uYXJnc10pfWApO1xuICB9KTtcbn1cblxuLyoqXG4gKiBNdXN0IGRvIHRoaXMgb24gdGhlIG5leHQgdGljaywgYXMgZW1pdHRlci5lbWl0KCkgZXhwZWN0cyBhbGwgbGlzdGVuZXJzIHRvIGhhdmUgYmVlbiBhdHRhY2hlZCBhbHJlYWR5XG4gKi9cbmZ1bmN0aW9uIG1vY2tFbWl0KGVtaXR0ZXI6IGV2ZW50cy5FdmVudEVtaXR0ZXIsIGV2ZW50OiBzdHJpbmcsIGRhdGE6IGFueSkge1xuICBzZXRJbW1lZGlhdGUoKCkgPT4ge1xuICAgIGVtaXR0ZXIuZW1pdChldmVudCwgZGF0YSk7XG4gIH0pO1xufVxuIl19