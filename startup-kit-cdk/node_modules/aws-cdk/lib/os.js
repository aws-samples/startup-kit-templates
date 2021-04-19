"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shell = void 0;
const child_process = require("child_process");
const colors = require("colors/safe");
const logging_1 = require("./logging");
/**
 * OS helpers
 *
 * Shell function which both prints to stdout and collects the output into a
 * string.
 */
async function shell(command, options = {}) {
    logging_1.debug(`Executing ${colors.blue(renderCommandLine(command))}`);
    const child = child_process.spawn(command[0], command.slice(1), {
        ...options,
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    return new Promise((resolve, reject) => {
        const stdout = new Array();
        // Both write to stdout and collect
        child.stdout.on('data', chunk => {
            if (!options.quiet) {
                process.stdout.write(chunk);
            }
            stdout.push(chunk);
        });
        child.once('error', reject);
        child.once('exit', code => {
            if (code === 0) {
                resolve(Buffer.concat(stdout).toString('utf-8'));
            }
            else {
                reject(new Error(`${renderCommandLine(command)} exited with error code ${code}`));
            }
        });
    });
}
exports.shell = shell;
/**
 * Render the given command line as a string
 *
 * Probably missing some cases but giving it a good effort.
 */
function renderCommandLine(cmd) {
    if (process.platform !== 'win32') {
        return doRender(cmd, hasAnyChars(' ', '\\', '!', '"', "'", '&', '$'), posixEscape);
    }
    else {
        return doRender(cmd, hasAnyChars(' ', '"', '&', '^', '%'), windowsEscape);
    }
}
/**
 * Render a UNIX command line
 */
function doRender(cmd, needsEscaping, doEscape) {
    return cmd.map(x => needsEscaping(x) ? doEscape(x) : x).join(' ');
}
/**
 * Return a predicate that checks if a string has any of the indicated chars in it
 */
function hasAnyChars(...chars) {
    return (str) => {
        return chars.some(c => str.indexOf(c) !== -1);
    };
}
/**
 * Escape a shell argument for POSIX shells
 *
 * Wrapping in single quotes and escaping single quotes inside will do it for us.
 */
function posixEscape(x) {
    // Turn ' -> '"'"'
    x = x.replace("'", "'\"'\"'");
    return `'${x}'`;
}
/**
 * Escape a shell argument for cmd.exe
 *
 * This is how to do it right, but I'm not following everything:
 *
 * https://blogs.msdn.microsoft.com/twistylittlepassagesallalike/2011/04/23/everyone-quotes-command-line-arguments-the-wrong-way/
 */
function windowsEscape(x) {
    // First surround by double quotes, ignore the part about backslashes
    x = `"${x}"`;
    // Now escape all special characters
    const shellMeta = new Set(['"', '&', '^', '%']);
    return x.split('').map(c => shellMeta.has(x) ? '^' + c : c).join('');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQ0FBK0M7QUFDL0Msc0NBQXNDO0FBQ3RDLHVDQUFrQztBQU1sQzs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxLQUFLLENBQUMsT0FBaUIsRUFBRSxVQUF3QixFQUFFO0lBQ3ZFLGVBQUssQ0FBQyxhQUFhLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDOUQsTUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUM5RCxHQUFHLE9BQU87UUFDVixLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQztLQUNyQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzdDLE1BQU0sTUFBTSxHQUFHLElBQUksS0FBSyxFQUFPLENBQUM7UUFFaEMsbUNBQW1DO1FBQ25DLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFBRTtZQUM5QixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRTtnQkFDbEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDN0I7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JCLENBQUMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFNUIsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDeEIsSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO2dCQUNkLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2xEO2lCQUFNO2dCQUNMLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLGlCQUFpQixDQUFDLE9BQU8sQ0FBQywyQkFBMkIsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ25GO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUE1QkQsc0JBNEJDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsaUJBQWlCLENBQUMsR0FBYTtJQUN0QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFO1FBQ2hDLE9BQU8sUUFBUSxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7S0FDcEY7U0FBTTtRQUNMLE9BQU8sUUFBUSxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0tBQzNFO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxRQUFRLENBQUMsR0FBYSxFQUFFLGFBQXFDLEVBQUUsUUFBK0I7SUFDckcsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FBQyxHQUFHLEtBQWU7SUFDckMsT0FBTyxDQUFDLEdBQVcsRUFBRSxFQUFFO1FBQ3JCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRCxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsV0FBVyxDQUFDLENBQVM7SUFDNUIsa0JBQWtCO0lBQ2xCLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUM5QixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDbEIsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQVMsYUFBYSxDQUFDLENBQVM7SUFDOUIscUVBQXFFO0lBQ3JFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ2Isb0NBQW9DO0lBQ3BDLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFTLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN4RCxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjaGlsZF9wcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycy9zYWZlJztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi9sb2dnaW5nJztcblxuZXhwb3J0IGludGVyZmFjZSBTaGVsbE9wdGlvbnMgZXh0ZW5kcyBjaGlsZF9wcm9jZXNzLlNwYXduT3B0aW9ucyB7XG4gIHF1aWV0PzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBPUyBoZWxwZXJzXG4gKlxuICogU2hlbGwgZnVuY3Rpb24gd2hpY2ggYm90aCBwcmludHMgdG8gc3Rkb3V0IGFuZCBjb2xsZWN0cyB0aGUgb3V0cHV0IGludG8gYVxuICogc3RyaW5nLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2hlbGwoY29tbWFuZDogc3RyaW5nW10sIG9wdGlvbnM6IFNoZWxsT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgZGVidWcoYEV4ZWN1dGluZyAke2NvbG9ycy5ibHVlKHJlbmRlckNvbW1hbmRMaW5lKGNvbW1hbmQpKX1gKTtcbiAgY29uc3QgY2hpbGQgPSBjaGlsZF9wcm9jZXNzLnNwYXduKGNvbW1hbmRbMF0sIGNvbW1hbmQuc2xpY2UoMSksIHtcbiAgICAuLi5vcHRpb25zLFxuICAgIHN0ZGlvOiBbJ2lnbm9yZScsICdwaXBlJywgJ2luaGVyaXQnXSxcbiAgfSk7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHN0ZG91dCA9IG5ldyBBcnJheTxhbnk+KCk7XG5cbiAgICAvLyBCb3RoIHdyaXRlIHRvIHN0ZG91dCBhbmQgY29sbGVjdFxuICAgIGNoaWxkLnN0ZG91dC5vbignZGF0YScsIGNodW5rID0+IHtcbiAgICAgIGlmICghb3B0aW9ucy5xdWlldCkge1xuICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShjaHVuayk7XG4gICAgICB9XG4gICAgICBzdGRvdXQucHVzaChjaHVuayk7XG4gICAgfSk7XG5cbiAgICBjaGlsZC5vbmNlKCdlcnJvcicsIHJlamVjdCk7XG5cbiAgICBjaGlsZC5vbmNlKCdleGl0JywgY29kZSA9PiB7XG4gICAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgICByZXNvbHZlKEJ1ZmZlci5jb25jYXQoc3Rkb3V0KS50b1N0cmluZygndXRmLTgnKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKGAke3JlbmRlckNvbW1hbmRMaW5lKGNvbW1hbmQpfSBleGl0ZWQgd2l0aCBlcnJvciBjb2RlICR7Y29kZX1gKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIFJlbmRlciB0aGUgZ2l2ZW4gY29tbWFuZCBsaW5lIGFzIGEgc3RyaW5nXG4gKlxuICogUHJvYmFibHkgbWlzc2luZyBzb21lIGNhc2VzIGJ1dCBnaXZpbmcgaXQgYSBnb29kIGVmZm9ydC5cbiAqL1xuZnVuY3Rpb24gcmVuZGVyQ29tbWFuZExpbmUoY21kOiBzdHJpbmdbXSkge1xuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuICAgIHJldHVybiBkb1JlbmRlcihjbWQsIGhhc0FueUNoYXJzKCcgJywgJ1xcXFwnLCAnIScsICdcIicsIFwiJ1wiLCAnJicsICckJyksIHBvc2l4RXNjYXBlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZG9SZW5kZXIoY21kLCBoYXNBbnlDaGFycygnICcsICdcIicsICcmJywgJ14nLCAnJScpLCB3aW5kb3dzRXNjYXBlKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlbmRlciBhIFVOSVggY29tbWFuZCBsaW5lXG4gKi9cbmZ1bmN0aW9uIGRvUmVuZGVyKGNtZDogc3RyaW5nW10sIG5lZWRzRXNjYXBpbmc6ICh4OiBzdHJpbmcpID0+IGJvb2xlYW4sIGRvRXNjYXBlOiAoeDogc3RyaW5nKSA9PiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gY21kLm1hcCh4ID0+IG5lZWRzRXNjYXBpbmcoeCkgPyBkb0VzY2FwZSh4KSA6IHgpLmpvaW4oJyAnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSBwcmVkaWNhdGUgdGhhdCBjaGVja3MgaWYgYSBzdHJpbmcgaGFzIGFueSBvZiB0aGUgaW5kaWNhdGVkIGNoYXJzIGluIGl0XG4gKi9cbmZ1bmN0aW9uIGhhc0FueUNoYXJzKC4uLmNoYXJzOiBzdHJpbmdbXSk6ICh4OiBzdHJpbmcpID0+IGJvb2xlYW4ge1xuICByZXR1cm4gKHN0cjogc3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIGNoYXJzLnNvbWUoYyA9PiBzdHIuaW5kZXhPZihjKSAhPT0gLTEpO1xuICB9O1xufVxuXG4vKipcbiAqIEVzY2FwZSBhIHNoZWxsIGFyZ3VtZW50IGZvciBQT1NJWCBzaGVsbHNcbiAqXG4gKiBXcmFwcGluZyBpbiBzaW5nbGUgcXVvdGVzIGFuZCBlc2NhcGluZyBzaW5nbGUgcXVvdGVzIGluc2lkZSB3aWxsIGRvIGl0IGZvciB1cy5cbiAqL1xuZnVuY3Rpb24gcG9zaXhFc2NhcGUoeDogc3RyaW5nKSB7XG4gIC8vIFR1cm4gJyAtPiAnXCInXCInXG4gIHggPSB4LnJlcGxhY2UoXCInXCIsIFwiJ1xcXCInXFxcIidcIik7XG4gIHJldHVybiBgJyR7eH0nYDtcbn1cblxuLyoqXG4gKiBFc2NhcGUgYSBzaGVsbCBhcmd1bWVudCBmb3IgY21kLmV4ZVxuICpcbiAqIFRoaXMgaXMgaG93IHRvIGRvIGl0IHJpZ2h0LCBidXQgSSdtIG5vdCBmb2xsb3dpbmcgZXZlcnl0aGluZzpcbiAqXG4gKiBodHRwczovL2Jsb2dzLm1zZG4ubWljcm9zb2Z0LmNvbS90d2lzdHlsaXR0bGVwYXNzYWdlc2FsbGFsaWtlLzIwMTEvMDQvMjMvZXZlcnlvbmUtcXVvdGVzLWNvbW1hbmQtbGluZS1hcmd1bWVudHMtdGhlLXdyb25nLXdheS9cbiAqL1xuZnVuY3Rpb24gd2luZG93c0VzY2FwZSh4OiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBGaXJzdCBzdXJyb3VuZCBieSBkb3VibGUgcXVvdGVzLCBpZ25vcmUgdGhlIHBhcnQgYWJvdXQgYmFja3NsYXNoZXNcbiAgeCA9IGBcIiR7eH1cImA7XG4gIC8vIE5vdyBlc2NhcGUgYWxsIHNwZWNpYWwgY2hhcmFjdGVyc1xuICBjb25zdCBzaGVsbE1ldGEgPSBuZXcgU2V0PHN0cmluZz4oWydcIicsICcmJywgJ14nLCAnJSddKTtcbiAgcmV0dXJuIHguc3BsaXQoJycpLm1hcChjID0+IHNoZWxsTWV0YS5oYXMoeCkgPyAnXicgKyBjIDogYykuam9pbignJyk7XG59XG4iXX0=