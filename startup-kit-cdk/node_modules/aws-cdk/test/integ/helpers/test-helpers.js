"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integTest = void 0;
const fs = require("fs");
const path = require("path");
const corking_1 = require("./corking");
const SKIP_TESTS = fs.readFileSync(path.join(__dirname, 'skip-tests.txt'), { encoding: 'utf-8' }).split('\n');
/**
 * A wrapper for jest's 'test' which takes regression-disabled tests into account and prints a banner
 */
function integTest(name, callback) {
    // Integ tests can run concurrently, and are responsible for blocking themselves if they cannot.
    const runner = shouldSkip(name) ? test.skip : test.concurrent;
    runner(name, async () => {
        const output = new corking_1.MemoryStream();
        output.write('================================================================\n');
        output.write(`${name}\n`);
        output.write('================================================================\n');
        let success = true;
        try {
            return await callback({ output });
        }
        catch (e) {
            await output.flushTo(process.stderr);
            process.stderr.write(`❌ ${e.toString()}\n`);
            success = false;
            throw e;
        }
        finally {
            if (success) {
                // Show people there's progress
                process.stderr.write('✅');
            }
        }
    });
}
exports.integTest = integTest;
function shouldSkip(testName) {
    return SKIP_TESTS.includes(testName);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGVzdC1oZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFDN0IsdUNBQXlDO0FBRXpDLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUk5Rzs7R0FFRztBQUNILFNBQWdCLFNBQVMsQ0FBQyxJQUFZLEVBQ3BDLFFBQWlEO0lBRWpELGdHQUFnRztJQUNoRyxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7SUFFOUQsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRTtRQUN0QixNQUFNLE1BQU0sR0FBRyxJQUFJLHNCQUFZLEVBQUUsQ0FBQztRQUVsQyxNQUFNLENBQUMsS0FBSyxDQUFDLG9FQUFvRSxDQUFDLENBQUM7UUFDbkYsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLENBQUM7UUFDMUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxvRUFBb0UsQ0FBQyxDQUFDO1FBRW5GLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQztRQUNuQixJQUFJO1lBQ0YsT0FBTyxNQUFNLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7U0FDbkM7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNWLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDckMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzVDLE9BQU8sR0FBRyxLQUFLLENBQUM7WUFDaEIsTUFBTSxDQUFDLENBQUM7U0FDVDtnQkFBUztZQUNSLElBQUksT0FBTyxFQUFFO2dCQUNYLCtCQUErQjtnQkFDL0IsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDM0I7U0FDRjtJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQTVCRCw4QkE0QkM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxRQUFnQjtJQUNsQyxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdkMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBNZW1vcnlTdHJlYW0gfSBmcm9tICcuL2NvcmtpbmcnO1xuXG5jb25zdCBTS0lQX1RFU1RTID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICdza2lwLXRlc3RzLnR4dCcpLCB7IGVuY29kaW5nOiAndXRmLTgnIH0pLnNwbGl0KCdcXG4nKTtcblxuZXhwb3J0IHR5cGUgVGVzdENvbnRleHQgPSB7IHJlYWRvbmx5IG91dHB1dDogTm9kZUpTLldyaXRhYmxlU3RyZWFtOyB9O1xuXG4vKipcbiAqIEEgd3JhcHBlciBmb3IgamVzdCdzICd0ZXN0JyB3aGljaCB0YWtlcyByZWdyZXNzaW9uLWRpc2FibGVkIHRlc3RzIGludG8gYWNjb3VudCBhbmQgcHJpbnRzIGEgYmFubmVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnRlZ1Rlc3QobmFtZTogc3RyaW5nLFxuICBjYWxsYmFjazogKGNvbnRleHQ6IFRlc3RDb250ZXh0KSA9PiBQcm9taXNlPHZvaWQ+KSB7XG5cbiAgLy8gSW50ZWcgdGVzdHMgY2FuIHJ1biBjb25jdXJyZW50bHksIGFuZCBhcmUgcmVzcG9uc2libGUgZm9yIGJsb2NraW5nIHRoZW1zZWx2ZXMgaWYgdGhleSBjYW5ub3QuXG4gIGNvbnN0IHJ1bm5lciA9IHNob3VsZFNraXAobmFtZSkgPyB0ZXN0LnNraXAgOiB0ZXN0LmNvbmN1cnJlbnQ7XG5cbiAgcnVubmVyKG5hbWUsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgTWVtb3J5U3RyZWFtKCk7XG5cbiAgICBvdXRwdXQud3JpdGUoJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG4nKTtcbiAgICBvdXRwdXQud3JpdGUoYCR7bmFtZX1cXG5gKTtcbiAgICBvdXRwdXQud3JpdGUoJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG4nKTtcblxuICAgIGxldCBzdWNjZXNzID0gdHJ1ZTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGNhbGxiYWNrKHsgb3V0cHV0IH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGF3YWl0IG91dHB1dC5mbHVzaFRvKHByb2Nlc3Muc3RkZXJyKTtcbiAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGDinYwgJHtlLnRvU3RyaW5nKCl9XFxuYCk7XG4gICAgICBzdWNjZXNzID0gZmFsc2U7XG4gICAgICB0aHJvdyBlO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICAvLyBTaG93IHBlb3BsZSB0aGVyZSdzIHByb2dyZXNzXG4gICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKCfinIUnKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBzaG91bGRTa2lwKHRlc3ROYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIFNLSVBfVEVTVFMuaW5jbHVkZXModGVzdE5hbWUpO1xufSJdfQ==