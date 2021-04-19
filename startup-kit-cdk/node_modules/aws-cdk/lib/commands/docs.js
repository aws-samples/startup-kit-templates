"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realHandler = exports.handler = exports.builder = exports.aliases = exports.describe = exports.command = void 0;
const childProcess = require("child_process");
const process = require("process");
const colors = require("colors/safe");
const logging_1 = require("../../lib/logging");
exports.command = 'docs';
exports.describe = 'Opens the reference documentation in a browser';
exports.aliases = ['doc'];
const defaultBrowserCommand = {
    darwin: 'open %u',
    win32: 'start %u',
};
exports.builder = {
    browser: {
        alias: 'b',
        desc: 'the command to use to open the browser, using %u as a placeholder for the path of the file to open',
        type: 'string',
        default: process.platform in defaultBrowserCommand ? defaultBrowserCommand[process.platform] : 'xdg-open %u',
    },
};
function handler(args) {
    args.commandHandler = realHandler;
}
exports.handler = handler;
async function realHandler(options) {
    const url = 'https://docs.aws.amazon.com/cdk/api/latest/';
    logging_1.print(colors.green(url));
    const browserCommand = options.args.browser.replace(/%u/g, url);
    logging_1.debug(`Opening documentation ${colors.green(browserCommand)}`);
    return new Promise((resolve, _reject) => {
        childProcess.exec(browserCommand, (err, stdout, stderr) => {
            if (err) {
                logging_1.debug(`An error occurred when trying to open a browser: ${err.stack || err.message}`);
                return resolve(0);
            }
            if (stdout) {
                logging_1.debug(stdout);
            }
            if (stderr) {
                logging_1.warning(stderr);
            }
            resolve(0);
        });
    });
}
exports.realHandler = realHandler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9jcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRvY3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOENBQThDO0FBQzlDLG1DQUFtQztBQUNuQyxzQ0FBc0M7QUFFdEMsK0NBQTBEO0FBRzdDLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLFFBQVEsR0FBRyxnREFBZ0QsQ0FBQztBQUM1RCxRQUFBLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRS9CLE1BQU0scUJBQXFCLEdBQTBDO0lBQ25FLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLEtBQUssRUFBRSxVQUFVO0NBQ2xCLENBQUM7QUFFVyxRQUFBLE9BQU8sR0FBRztJQUNyQixPQUFPLEVBQUU7UUFDUCxLQUFLLEVBQUUsR0FBRztRQUNWLElBQUksRUFBRSxvR0FBb0c7UUFDMUcsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsT0FBTyxDQUFDLFFBQVEsSUFBSSxxQkFBcUIsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhO0tBQzdHO0NBQ0YsQ0FBQztBQU1GLFNBQWdCLE9BQU8sQ0FBQyxJQUFxQjtJQUMzQyxJQUFJLENBQUMsY0FBYyxHQUFHLFdBQVcsQ0FBQztBQUNwQyxDQUFDO0FBRkQsMEJBRUM7QUFFTSxLQUFLLFVBQVUsV0FBVyxDQUFDLE9BQXVCO0lBQ3ZELE1BQU0sR0FBRyxHQUFHLDZDQUE2QyxDQUFDO0lBQzFELGVBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDekIsTUFBTSxjQUFjLEdBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFrQixDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDNUUsZUFBSyxDQUFDLHlCQUF5QixNQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMvRCxPQUFPLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQzlDLFlBQVksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUN4RCxJQUFJLEdBQUcsRUFBRTtnQkFDUCxlQUFLLENBQUMsb0RBQW9ELEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7Z0JBQ3RGLE9BQU8sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ25CO1lBQ0QsSUFBSSxNQUFNLEVBQUU7Z0JBQUUsZUFBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQUU7WUFDOUIsSUFBSSxNQUFNLEVBQUU7Z0JBQUUsaUJBQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUFFO1lBQ2hDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNiLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBaEJELGtDQWdCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAncHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBjb2xvcnMgZnJvbSAnY29sb3JzL3NhZmUnO1xuaW1wb3J0ICogYXMgeWFyZ3MgZnJvbSAneWFyZ3MnO1xuaW1wb3J0IHsgZGVidWcsIHByaW50LCB3YXJuaW5nIH0gZnJvbSAnLi4vLi4vbGliL2xvZ2dpbmcnO1xuaW1wb3J0IHsgQ29tbWFuZE9wdGlvbnMgfSBmcm9tICcuLi9jb21tYW5kLWFwaSc7XG5cbmV4cG9ydCBjb25zdCBjb21tYW5kID0gJ2RvY3MnO1xuZXhwb3J0IGNvbnN0IGRlc2NyaWJlID0gJ09wZW5zIHRoZSByZWZlcmVuY2UgZG9jdW1lbnRhdGlvbiBpbiBhIGJyb3dzZXInO1xuZXhwb3J0IGNvbnN0IGFsaWFzZXMgPSBbJ2RvYyddO1xuXG5jb25zdCBkZWZhdWx0QnJvd3NlckNvbW1hbmQ6IHsgW2tleSBpbiBOb2RlSlMuUGxhdGZvcm1dPzogc3RyaW5nIH0gPSB7XG4gIGRhcndpbjogJ29wZW4gJXUnLFxuICB3aW4zMjogJ3N0YXJ0ICV1Jyxcbn07XG5cbmV4cG9ydCBjb25zdCBidWlsZGVyID0ge1xuICBicm93c2VyOiB7XG4gICAgYWxpYXM6ICdiJyxcbiAgICBkZXNjOiAndGhlIGNvbW1hbmQgdG8gdXNlIHRvIG9wZW4gdGhlIGJyb3dzZXIsIHVzaW5nICV1IGFzIGEgcGxhY2Vob2xkZXIgZm9yIHRoZSBwYXRoIG9mIHRoZSBmaWxlIHRvIG9wZW4nLFxuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6IHByb2Nlc3MucGxhdGZvcm0gaW4gZGVmYXVsdEJyb3dzZXJDb21tYW5kID8gZGVmYXVsdEJyb3dzZXJDb21tYW5kW3Byb2Nlc3MucGxhdGZvcm1dIDogJ3hkZy1vcGVuICV1JyxcbiAgfSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXJndW1lbnRzIGV4dGVuZHMgeWFyZ3MuQXJndW1lbnRzIHtcbiAgYnJvd3Nlcjogc3RyaW5nXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYW5kbGVyKGFyZ3M6IHlhcmdzLkFyZ3VtZW50cykge1xuICBhcmdzLmNvbW1hbmRIYW5kbGVyID0gcmVhbEhhbmRsZXI7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFsSGFuZGxlcihvcHRpb25zOiBDb21tYW5kT3B0aW9ucyk6IFByb21pc2U8bnVtYmVyPiB7XG4gIGNvbnN0IHVybCA9ICdodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY2RrL2FwaS9sYXRlc3QvJztcbiAgcHJpbnQoY29sb3JzLmdyZWVuKHVybCkpO1xuICBjb25zdCBicm93c2VyQ29tbWFuZCA9IChvcHRpb25zLmFyZ3MuYnJvd3NlciBhcyBzdHJpbmcpLnJlcGxhY2UoLyV1L2csIHVybCk7XG4gIGRlYnVnKGBPcGVuaW5nIGRvY3VtZW50YXRpb24gJHtjb2xvcnMuZ3JlZW4oYnJvd3NlckNvbW1hbmQpfWApO1xuICByZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPigocmVzb2x2ZSwgX3JlamVjdCkgPT4ge1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKGJyb3dzZXJDb21tYW5kLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBkZWJ1ZyhgQW4gZXJyb3Igb2NjdXJyZWQgd2hlbiB0cnlpbmcgdG8gb3BlbiBhIGJyb3dzZXI6ICR7ZXJyLnN0YWNrIHx8IGVyci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZSgwKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdGRvdXQpIHsgZGVidWcoc3Rkb3V0KTsgfVxuICAgICAgaWYgKHN0ZGVycikgeyB3YXJuaW5nKHN0ZGVycik7IH1cbiAgICAgIHJlc29sdmUoMCk7XG4gICAgfSk7XG4gIH0pO1xufVxuIl19