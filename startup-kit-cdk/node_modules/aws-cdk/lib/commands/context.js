"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realHandler = exports.handler = exports.builder = exports.describe = exports.command = void 0;
const colors = require("colors/safe");
const version = require("../../lib/version");
const logging_1 = require("../logging");
const settings_1 = require("../settings");
const util_1 = require("../util");
exports.command = 'context';
exports.describe = 'Manage cached context values';
exports.builder = {
    reset: {
        alias: 'e',
        desc: 'The context key (or its index) to reset',
        type: 'string',
        requiresArg: true,
    },
    clear: {
        desc: 'Clear all context',
        type: 'boolean',
    },
};
function handler(args) {
    args.commandHandler = realHandler;
}
exports.handler = handler;
async function realHandler(options) {
    const { configuration, args } = options;
    if (args.clear) {
        configuration.context.clear();
        await configuration.saveContext();
        logging_1.print('All context values cleared.');
    }
    else if (args.reset) {
        invalidateContext(configuration.context, args.reset);
        await configuration.saveContext();
    }
    else {
        // List -- support '--json' flag
        if (args.json) {
            const contextValues = configuration.context.all;
            process.stdout.write(JSON.stringify(contextValues, undefined, 2));
        }
        else {
            listContext(configuration.context);
        }
    }
    await version.displayVersionMessage();
    return 0;
}
exports.realHandler = realHandler;
function listContext(context) {
    const keys = contextKeys(context);
    if (keys.length === 0) {
        logging_1.print('This CDK application does not have any saved context values yet.');
        logging_1.print('');
        logging_1.print('Context will automatically be saved when you synthesize CDK apps');
        logging_1.print('that use environment context information like AZ information, VPCs,');
        logging_1.print('SSM parameters, and so on.');
        return;
    }
    // Print config by default
    const data = [[colors.green('#'), colors.green('Key'), colors.green('Value')]];
    for (const [i, key] of keys) {
        const jsonWithoutNewlines = JSON.stringify(context.all[key], undefined, 2).replace(/\s+/g, ' ');
        data.push([i, key, jsonWithoutNewlines]);
    }
    logging_1.print(`Context found in ${colors.blue(settings_1.PROJECT_CONFIG)}:\n`);
    logging_1.print(util_1.renderTable(data, process.stdout.columns));
    // eslint-disable-next-line max-len
    logging_1.print(`Run ${colors.blue('cdk context --reset KEY_OR_NUMBER')} to remove a context key. It will be refreshed on the next CDK synthesis run.`);
}
function invalidateContext(context, key) {
    const i = parseInt(key, 10);
    if (`${i}` === key) {
        // was a number and we fully parsed it.
        key = keyByNumber(context, i);
    }
    // Unset!
    if (context.has(key)) {
        context.unset(key);
        logging_1.print(`Context value ${colors.blue(key)} reset. It will be refreshed on next synthesis`);
    }
    else {
        logging_1.print(`No context value with key ${colors.blue(key)}`);
    }
}
function keyByNumber(context, n) {
    for (const [i, key] of contextKeys(context)) {
        if (n === i) {
            return key;
        }
    }
    throw new Error(`No context key with number: ${n}`);
}
/**
 * Return enumerated keys in a definitive order
 */
function contextKeys(context) {
    const keys = context.keys;
    keys.sort();
    return enumerate1(keys);
}
function enumerate1(xs) {
    const ret = new Array();
    let i = 1;
    for (const x of xs) {
        ret.push([i, x]);
        i += 1;
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsc0NBQXNDO0FBRXRDLDZDQUE2QztBQUU3Qyx3Q0FBbUM7QUFDbkMsMENBQXNEO0FBQ3RELGtDQUFzQztBQUV6QixRQUFBLE9BQU8sR0FBRyxTQUFTLENBQUM7QUFDcEIsUUFBQSxRQUFRLEdBQUcsOEJBQThCLENBQUM7QUFDMUMsUUFBQSxPQUFPLEdBQUc7SUFDckIsS0FBSyxFQUFFO1FBQ0wsS0FBSyxFQUFFLEdBQUc7UUFDVixJQUFJLEVBQUUseUNBQXlDO1FBQy9DLElBQUksRUFBRSxRQUFRO1FBQ2QsV0FBVyxFQUFFLElBQUk7S0FDbEI7SUFDRCxLQUFLLEVBQUU7UUFDTCxJQUFJLEVBQUUsbUJBQW1CO1FBQ3pCLElBQUksRUFBRSxTQUFTO0tBQ2hCO0NBQ0YsQ0FBQztBQUVGLFNBQWdCLE9BQU8sQ0FBQyxJQUFxQjtJQUMzQyxJQUFJLENBQUMsY0FBYyxHQUFHLFdBQVcsQ0FBQztBQUNwQyxDQUFDO0FBRkQsMEJBRUM7QUFFTSxLQUFLLFVBQVUsV0FBVyxDQUFDLE9BQXVCO0lBQ3ZELE1BQU0sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBRXhDLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtRQUNkLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDOUIsTUFBTSxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDbEMsZUFBSyxDQUFDLDZCQUE2QixDQUFDLENBQUM7S0FDdEM7U0FBTSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDckIsaUJBQWlCLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsS0FBZSxDQUFDLENBQUM7UUFDL0QsTUFBTSxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUM7S0FDbkM7U0FBTTtRQUNMLGdDQUFnQztRQUNoQyxJ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LEVBQUUsR0FBRyxDQUFDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzNDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNYLE9BQU8sR0FBRyxDQUFDO1NBQ1o7S0FDRjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxXQUFXLENBQUMsT0FBZ0I7SUFDbkMsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztJQUMxQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDWixPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQixDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUksRUFBTztJQUM1QixNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssRUFBZSxDQUFDO0lBQ3JDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFO1FBQ2xCLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqQixDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ1I7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjb2xvcnMgZnJvbSAnY29sb3JzL3NhZmUnO1xuaW1wb3J0ICogYXMgeWFyZ3MgZnJvbSAneWFyZ3MnO1xuaW1wb3J0ICogYXMgdmVyc2lvbiBmcm9tICcuLi8uLi9saWIvdmVyc2lvbic7XG5pbXBvcnQgeyBDb21tYW5kT3B0aW9ucyB9IGZyb20gJy4uL2NvbW1hbmQtYXBpJztcbmltcG9ydCB7IHByaW50IH0gZnJvbSAnLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBDb250ZXh0LCBQUk9KRUNUX0NPTkZJRyB9IGZyb20gJy4uL3NldHRpbmdzJztcbmltcG9ydCB7IHJlbmRlclRhYmxlIH0gZnJvbSAnLi4vdXRpbCc7XG5cbmV4cG9ydCBjb25zdCBjb21tYW5kID0gJ2NvbnRleHQnO1xuZXhwb3J0IGNvbnN0IGRlc2NyaWJlID0gJ01hbmFnZSBjYWNoZWQgY29udGV4dCB2YWx1ZXMnO1xuZXhwb3J0IGNvbnN0IGJ1aWxkZXIgPSB7XG4gIHJlc2V0OiB7XG4gICAgYWxpYXM6ICdlJyxcbiAgICBkZXNjOiAnVGhlIGNvbnRleHQga2V5IChvciBpdHMgaW5kZXgpIHRvIHJlc2V0JyxcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICByZXF1aXJlc0FyZzogdHJ1ZSxcbiAgfSxcbiAgY2xlYXI6IHtcbiAgICBkZXNjOiAnQ2xlYXIgYWxsIGNvbnRleHQnLFxuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgfSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBoYW5kbGVyKGFyZ3M6IHlhcmdzLkFyZ3VtZW50cykge1xuICBhcmdzLmNvbW1hbmRIYW5kbGVyID0gcmVhbEhhbmRsZXI7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFsSGFuZGxlcihvcHRpb25zOiBDb21tYW5kT3B0aW9ucyk6IFByb21pc2U8bnVtYmVyPiB7XG4gIGNvbnN0IHsgY29uZmlndXJhdGlvbiwgYXJncyB9ID0gb3B0aW9ucztcblxuICBpZiAoYXJncy5jbGVhcikge1xuICAgIGNvbmZpZ3VyYXRpb24uY29udGV4dC5jbGVhcigpO1xuICAgIGF3YWl0IGNvbmZpZ3VyYXRpb24uc2F2ZUNvbnRleHQoKTtcbiAgICBwcmludCgnQWxsIGNvbnRleHQgdmFsdWVzIGNsZWFyZWQuJyk7XG4gIH0gZWxzZSBpZiAoYXJncy5yZXNldCkge1xuICAgIGludmFsaWRhdGVDb250ZXh0KGNvbmZpZ3VyYXRpb24uY29udGV4dCwgYXJncy5yZXNldCBhcyBzdHJpbmcpO1xuICAgIGF3YWl0IGNvbmZpZ3VyYXRpb24uc2F2ZUNvbnRleHQoKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMaXN0IC0tIHN1cHBvcnQgJy0tanNvbicgZmxhZ1xuICAgIGlmIChhcmdzLmpzb24pIHtcbiAgICAgIGNvbnN0IGNvbnRleHRWYWx1ZXMgPSBjb25maWd1cmF0aW9uLmNvbnRleHQuYWxsO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoSlNPTi5zdHJpbmdpZnkoY29udGV4dFZhbHVlcywgdW5kZWZpbmVkLCAyKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3RDb250ZXh0KGNvbmZpZ3VyYXRpb24uY29udGV4dCk7XG4gICAgfVxuICB9XG4gIGF3YWl0IHZlcnNpb24uZGlzcGxheVZlcnNpb25NZXNzYWdlKCk7XG5cbiAgcmV0dXJuIDA7XG59XG5cbmZ1bmN0aW9uIGxpc3RDb250ZXh0KGNvbnRleHQ6IENvbnRleHQpIHtcbiAgY29uc3Qga2V5cyA9IGNvbnRleHRLZXlzKGNvbnRleHQpO1xuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHByaW50KCdUaGlzIENESyBhcHBsaWNhdGlvbiBkb2VzIG5vdCBoYXZlIGFueSBzYXZlZCBjb250ZXh0IHZhbHVlcyB5ZXQuJyk7XG4gICAgcHJpbnQoJycpO1xuICAgIHByaW50KCdDb250ZXh0IHdpbGwgYXV0b21hdGljYWxseSBiZSBzYXZlZCB3aGVuIHlvdSBzeW50aGVzaXplIENESyBhcHBzJyk7XG4gICAgcHJpbnQoJ3RoYXQgdXNlIGVudmlyb25tZW50IGNvbnRleHQgaW5mb3JtYXRpb24gbGlrZSBBWiBpbmZvcm1hdGlvbiwgVlBDcywnKTtcbiAgICBwcmludCgnU1NNIHBhcmFtZXRlcnMsIGFuZCBzbyBvbi4nKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFByaW50IGNvbmZpZyBieSBkZWZhdWx0XG4gIGNvbnN0IGRhdGE6IGFueVtdID0gW1tjb2xvcnMuZ3JlZW4oJyMnKSwgY29sb3JzLmdyZWVuKCdLZXknKSwgY29sb3JzLmdyZWVuKCdWYWx1ZScpXV07XG4gIGZvciAoY29uc3QgW2ksIGtleV0gb2Yga2V5cykge1xuICAgIGNvbnN0IGpzb25XaXRob3V0TmV3bGluZXMgPSBKU09OLnN0cmluZ2lmeShjb250ZXh0LmFsbFtrZXldLCB1bmRlZmluZWQsIDIpLnJlcGxhY2UoL1xccysvZywgJyAnKTtcbiAgICBkYXRhLnB1c2goW2ksIGtleSwganNvbldpdGhvdXROZXdsaW5lc10pO1xuICB9XG5cbiAgcHJpbnQoYENvbnRleHQgZm91bmQgaW4gJHtjb2xvcnMuYmx1ZShQUk9KRUNUX0NPTkZJRyl9OlxcbmApO1xuXG4gIHByaW50KHJlbmRlclRhYmxlKGRhdGEsIHByb2Nlc3Muc3Rkb3V0LmNvbHVtbnMpKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuICBwcmludChgUnVuICR7Y29sb3JzLmJsdWUoJ2NkayBjb250ZXh0IC0tcmVzZXQgS0VZX09SX05VTUJFUicpfSB0byByZW1vdmUgYSBjb250ZXh0IGtleS4gSXQgd2lsbCBiZSByZWZyZXNoZWQgb24gdGhlIG5leHQgQ0RLIHN5bnRoZXNpcyBydW4uYCk7XG59XG5cbmZ1bmN0aW9uIGludmFsaWRhdGVDb250ZXh0KGNvbnRleHQ6IENvbnRleHQsIGtleTogc3RyaW5nKSB7XG4gIGNvbnN0IGkgPSBwYXJzZUludChrZXksIDEwKTtcbiAgaWYgKGAke2l9YCA9PT0ga2V5KSB7XG4gICAgLy8gd2FzIGEgbnVtYmVyIGFuZCB3ZSBmdWxseSBwYXJzZWQgaXQuXG4gICAga2V5ID0ga2V5QnlOdW1iZXIoY29udGV4dCwgaSk7XG4gIH1cblxuICAvLyBVbnNldCFcbiAgaWYgKGNvbnRleHQuaGFzKGtleSkpIHtcbiAgICBjb250ZXh0LnVuc2V0KGtleSk7XG4gICAgcHJpbnQoYENvbnRleHQgdmFsdWUgJHtjb2xvcnMuYmx1ZShrZXkpfSByZXNldC4gSXQgd2lsbCBiZSByZWZyZXNoZWQgb24gbmV4dCBzeW50aGVzaXNgKTtcbiAgfSBlbHNlIHtcbiAgICBwcmludChgTm8gY29udGV4dCB2YWx1ZSB3aXRoIGtleSAke2NvbG9ycy5ibHVlKGtleSl9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24ga2V5QnlOdW1iZXIoY29udGV4dDogQ29udGV4dCwgbjogbnVtYmVyKSB7XG4gIGZvciAoY29uc3QgW2ksIGtleV0gb2YgY29udGV4dEtleXMoY29udGV4dCkpIHtcbiAgICBpZiAobiA9PT0gaSkge1xuICAgICAgcmV0dXJuIGtleTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBObyBjb250ZXh0IGtleSB3aXRoIG51bWJlcjogJHtufWApO1xufVxuXG4vKipcbiAqIFJldHVybiBlbnVtZXJhdGVkIGtleXMgaW4gYSBkZWZpbml0aXZlIG9yZGVyXG4gKi9cbmZ1bmN0aW9uIGNvbnRleHRLZXlzKGNvbnRleHQ6IENvbnRleHQpOiBbbnVtYmVyLCBzdHJpbmddW10ge1xuICBjb25zdCBrZXlzID0gY29udGV4dC5rZXlzO1xuICBrZXlzLnNvcnQoKTtcbiAgcmV0dXJuIGVudW1lcmF0ZTEoa2V5cyk7XG59XG5cbmZ1bmN0aW9uIGVudW1lcmF0ZTE8VD4oeHM6IFRbXSk6IEFycmF5PFtudW1iZXIsIFRdPiB7XG4gIGNvbnN0IHJldCA9IG5ldyBBcnJheTxbbnVtYmVyLCBUXT4oKTtcbiAgbGV0IGkgPSAxO1xuICBmb3IgKGNvbnN0IHggb2YgeHMpIHtcbiAgICByZXQucHVzaChbaSwgeF0pO1xuICAgIGkgKz0gMTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuIl19