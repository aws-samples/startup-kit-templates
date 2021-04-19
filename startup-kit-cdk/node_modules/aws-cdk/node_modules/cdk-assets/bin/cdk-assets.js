"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const lib_1 = require("../lib");
const list_1 = require("./list");
const logging_1 = require("./logging");
const publish_1 = require("./publish");
async function main() {
    const argv = yargs
        .usage('$0 <cmd> [args]')
        .option('verbose', {
        alias: 'v',
        type: 'boolean',
        desc: 'Increase logging verbosity',
        count: true,
        default: 0,
    })
        .option('path', {
        alias: 'p',
        type: 'string',
        desc: 'The path (file or directory) to load the assets from. If a directory, ' +
            `the file '${lib_1.AssetManifest.DEFAULT_FILENAME}' will be loaded from it.`,
        default: '.',
        requiresArg: true,
    })
        .command('ls', 'List assets from the given manifest', command => command, wrapHandler(async (args) => {
        await list_1.list(args);
    }))
        .command('publish [ASSET..]', 'Publish assets in the given manifest', command => command
        .option('profile', { type: 'string', describe: 'Profile to use from AWS Credentials file' })
        .positional('ASSET', { type: 'string', array: true, describe: 'Assets to publish (format: "ASSET[:DEST]"), default all' }), wrapHandler(async (args) => {
        await publish_1.publish({
            path: args.path,
            assets: args.ASSET,
            profile: args.profile,
        });
    }))
        .demandCommand()
        .help()
        .strict() // Error on wrong command
        .version(logging_1.VERSION)
        .showHelpOnFail(false)
        .argv;
    // Evaluating .argv triggers the parsing but the command gets implicitly executed,
    // so we don't need the output.
    Array.isArray(argv);
}
/**
 * Wrap a command's handler with standard pre- and post-work
 */
function wrapHandler(handler) {
    return async (argv) => {
        if (argv.verbose) {
            logging_1.setLogThreshold('verbose');
        }
        await handler(argv);
    };
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e.stack);
    process.exitCode = 1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWFzc2V0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1hc3NldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQkFBK0I7QUFDL0IsZ0NBQXVDO0FBQ3ZDLGlDQUE4QjtBQUM5Qix1Q0FBcUQ7QUFDckQsdUNBQW9DO0FBRXBDLEtBQUssVUFBVSxJQUFJO0lBQ2pCLE1BQU0sSUFBSSxHQUFHLEtBQUs7U0FDZixLQUFLLENBQUMsaUJBQWlCLENBQUM7U0FDeEIsTUFBTSxDQUFDLFNBQVMsRUFBRTtRQUNqQixLQUFLLEVBQUUsR0FBRztRQUNWLElBQUksRUFBRSxTQUFTO1FBQ2YsSUFBSSxFQUFFLDRCQUE0QjtRQUNsQyxLQUFLLEVBQUUsSUFBSTtRQUNYLE9BQU8sRUFBRSxDQUFDO0tBQ1gsQ0FBQztTQUNELE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDZCxLQUFLLEVBQUUsR0FBRztRQUNWLElBQUksRUFBRSxRQUFRO1FBQ2QsSUFBSSxFQUFFLHdFQUF3RTtZQUNoRixhQUFhLG1CQUFhLENBQUMsZ0JBQWdCLDJCQUEyQjtRQUNwRSxPQUFPLEVBQUUsR0FBRztRQUNaLFdBQVcsRUFBRSxJQUFJO0tBQ2xCLENBQUM7U0FDRCxPQUFPLENBQUMsSUFBSSxFQUFFLHFDQUFxQyxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUNwRSxXQUFXLENBQUMsS0FBSyxFQUFDLElBQUksRUFBQyxFQUFFO1FBQ3pCLE1BQU0sV0FBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25CLENBQUMsQ0FBQyxDQUFDO1NBQ0osT0FBTyxDQUFDLG1CQUFtQixFQUFFLHNDQUFzQyxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTztTQUNyRixNQUFNLENBQUMsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsMENBQTBDLEVBQUUsQ0FBQztTQUMzRixVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSx5REFBeUQsRUFBRSxDQUFDLEVBQzFILFdBQVcsQ0FBQyxLQUFLLEVBQUMsSUFBSSxFQUFDLEVBQUU7UUFDekIsTUFBTSxpQkFBTyxDQUFDO1lBQ1osSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLO1lBQ2xCLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztTQUN0QixDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztTQUNGLGFBQWEsRUFBRTtTQUNmLElBQUksRUFBRTtTQUNOLE1BQU0sRUFBRSxDQUFDLHlCQUF5QjtTQUNsQyxPQUFPLENBQUMsaUJBQU8sQ0FBQztTQUNoQixjQUFjLENBQUMsS0FBSyxDQUFDO1NBQ3JCLElBQUksQ0FBQztJQUVSLGtGQUFrRjtJQUNsRiwrQkFBK0I7SUFDL0IsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN0QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FBb0MsT0FBNkI7SUFDbkYsT0FBTyxLQUFLLEVBQUUsSUFBTyxFQUFFLEVBQUU7UUFDdkIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLHlCQUFlLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDNUI7UUFDRCxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QixDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ2Ysc0NBQXNDO0lBQ3RDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZCLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgeWFyZ3MgZnJvbSAneWFyZ3MnO1xuaW1wb3J0IHsgQXNzZXRNYW5pZmVzdCB9IGZyb20gJy4uL2xpYic7XG5pbXBvcnQgeyBsaXN0IH0gZnJvbSAnLi9saXN0JztcbmltcG9ydCB7IHNldExvZ1RocmVzaG9sZCwgVkVSU0lPTiB9IGZyb20gJy4vbG9nZ2luZyc7XG5pbXBvcnQgeyBwdWJsaXNoIH0gZnJvbSAnLi9wdWJsaXNoJztcblxuYXN5bmMgZnVuY3Rpb24gbWFpbigpIHtcbiAgY29uc3QgYXJndiA9IHlhcmdzXG4gICAgLnVzYWdlKCckMCA8Y21kPiBbYXJnc10nKVxuICAgIC5vcHRpb24oJ3ZlcmJvc2UnLCB7XG4gICAgICBhbGlhczogJ3YnLFxuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVzYzogJ0luY3JlYXNlIGxvZ2dpbmcgdmVyYm9zaXR5JyxcbiAgICAgIGNvdW50OiB0cnVlLFxuICAgICAgZGVmYXVsdDogMCxcbiAgICB9KVxuICAgIC5vcHRpb24oJ3BhdGgnLCB7XG4gICAgICBhbGlhczogJ3AnLFxuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZXNjOiAnVGhlIHBhdGggKGZpbGUgb3IgZGlyZWN0b3J5KSB0byBsb2FkIHRoZSBhc3NldHMgZnJvbS4gSWYgYSBkaXJlY3RvcnksICcgK1xuICAgIGB0aGUgZmlsZSAnJHtBc3NldE1hbmlmZXN0LkRFRkFVTFRfRklMRU5BTUV9JyB3aWxsIGJlIGxvYWRlZCBmcm9tIGl0LmAsXG4gICAgICBkZWZhdWx0OiAnLicsXG4gICAgICByZXF1aXJlc0FyZzogdHJ1ZSxcbiAgICB9KVxuICAgIC5jb21tYW5kKCdscycsICdMaXN0IGFzc2V0cyBmcm9tIHRoZSBnaXZlbiBtYW5pZmVzdCcsIGNvbW1hbmQgPT4gY29tbWFuZFxuICAgICAgLCB3cmFwSGFuZGxlcihhc3luYyBhcmdzID0+IHtcbiAgICAgICAgYXdhaXQgbGlzdChhcmdzKTtcbiAgICAgIH0pKVxuICAgIC5jb21tYW5kKCdwdWJsaXNoIFtBU1NFVC4uXScsICdQdWJsaXNoIGFzc2V0cyBpbiB0aGUgZ2l2ZW4gbWFuaWZlc3QnLCBjb21tYW5kID0+IGNvbW1hbmRcbiAgICAgIC5vcHRpb24oJ3Byb2ZpbGUnLCB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmliZTogJ1Byb2ZpbGUgdG8gdXNlIGZyb20gQVdTIENyZWRlbnRpYWxzIGZpbGUnIH0pXG4gICAgICAucG9zaXRpb25hbCgnQVNTRVQnLCB7IHR5cGU6ICdzdHJpbmcnLCBhcnJheTogdHJ1ZSwgZGVzY3JpYmU6ICdBc3NldHMgdG8gcHVibGlzaCAoZm9ybWF0OiBcIkFTU0VUWzpERVNUXVwiKSwgZGVmYXVsdCBhbGwnIH0pXG4gICAgLCB3cmFwSGFuZGxlcihhc3luYyBhcmdzID0+IHtcbiAgICAgIGF3YWl0IHB1Ymxpc2goe1xuICAgICAgICBwYXRoOiBhcmdzLnBhdGgsXG4gICAgICAgIGFzc2V0czogYXJncy5BU1NFVCxcbiAgICAgICAgcHJvZmlsZTogYXJncy5wcm9maWxlLFxuICAgICAgfSk7XG4gICAgfSkpXG4gICAgLmRlbWFuZENvbW1hbmQoKVxuICAgIC5oZWxwKClcbiAgICAuc3RyaWN0KCkgLy8gRXJyb3Igb24gd3JvbmcgY29tbWFuZFxuICAgIC52ZXJzaW9uKFZFUlNJT04pXG4gICAgLnNob3dIZWxwT25GYWlsKGZhbHNlKVxuICAgIC5hcmd2O1xuXG4gIC8vIEV2YWx1YXRpbmcgLmFyZ3YgdHJpZ2dlcnMgdGhlIHBhcnNpbmcgYnV0IHRoZSBjb21tYW5kIGdldHMgaW1wbGljaXRseSBleGVjdXRlZCxcbiAgLy8gc28gd2UgZG9uJ3QgbmVlZCB0aGUgb3V0cHV0LlxuICBBcnJheS5pc0FycmF5KGFyZ3YpO1xufVxuXG4vKipcbiAqIFdyYXAgYSBjb21tYW5kJ3MgaGFuZGxlciB3aXRoIHN0YW5kYXJkIHByZS0gYW5kIHBvc3Qtd29ya1xuICovXG5mdW5jdGlvbiB3cmFwSGFuZGxlcjxBIGV4dGVuZHMgeyB2ZXJib3NlPzogbnVtYmVyIH0sIFI+KGhhbmRsZXI6ICh4OiBBKSA9PiBQcm9taXNlPFI+KSB7XG4gIHJldHVybiBhc3luYyAoYXJndjogQSkgPT4ge1xuICAgIGlmIChhcmd2LnZlcmJvc2UpIHtcbiAgICAgIHNldExvZ1RocmVzaG9sZCgndmVyYm9zZScpO1xuICAgIH1cbiAgICBhd2FpdCBoYW5kbGVyKGFyZ3YpO1xuICB9O1xufVxuXG5tYWluKCkuY2F0Y2goZSA9PiB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gIGNvbnNvbGUuZXJyb3IoZS5zdGFjayk7XG4gIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xufSk7XG4iXX0=