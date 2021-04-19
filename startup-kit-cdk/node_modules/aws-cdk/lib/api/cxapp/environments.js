"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.environmentsFromDescriptors = exports.globEnvironmentsFromStacks = exports.looksLikeGlob = void 0;
const minimatch = require("minimatch");
function looksLikeGlob(environment) {
    return environment.indexOf('*') > -1;
}
exports.looksLikeGlob = looksLikeGlob;
// eslint-disable-next-line max-len
async function globEnvironmentsFromStacks(stacks, environmentGlobs, sdk) {
    if (environmentGlobs.length === 0) {
        return [];
    }
    const availableEnvironments = new Array();
    for (const stack of stacks.stackArtifacts) {
        const actual = await sdk.resolveEnvironment(stack.environment);
        availableEnvironments.push(actual);
    }
    const environments = distinct(availableEnvironments).filter(env => environmentGlobs.find(glob => minimatch(env.name, glob)));
    if (environments.length === 0) {
        const globs = JSON.stringify(environmentGlobs);
        const envList = availableEnvironments.length > 0 ? availableEnvironments.map(env => env.name).join(', ') : '<none>';
        throw new Error(`No environments were found when selecting across ${globs} (available: ${envList})`);
    }
    return environments;
}
exports.globEnvironmentsFromStacks = globEnvironmentsFromStacks;
/**
 * Given a set of "<account>/<region>" strings, construct environments for them
 */
function environmentsFromDescriptors(envSpecs) {
    const ret = new Array();
    for (const spec of envSpecs) {
        const parts = spec.replace(/^aws:\/\//, '').split('/');
        if (parts.length !== 2) {
            throw new Error(`Expected environment name in format 'aws://<account>/<region>', got: ${spec}`);
        }
        ret.push({
            name: spec,
            account: parts[0],
            region: parts[1],
        });
    }
    return ret;
}
exports.environmentsFromDescriptors = environmentsFromDescriptors;
/**
 * De-duplicates a list of environments, such that a given account and region is only represented exactly once
 * in the result.
 *
 * @param envs the possibly full-of-duplicates list of environments.
 *
 * @return a de-duplicated list of environments.
 */
function distinct(envs) {
    const unique = {};
    for (const env of envs) {
        const id = `${env.account || 'default'}/${env.region || 'default'}`;
        if (id in unique) {
            continue;
        }
        unique[id] = env;
    }
    return Object.values(unique);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZW52aXJvbm1lbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHVDQUF1QztBQUl2QyxTQUFnQixhQUFhLENBQUMsV0FBbUI7SUFDL0MsT0FBTyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLENBQUM7QUFGRCxzQ0FFQztBQUVELG1DQUFtQztBQUM1QixLQUFLLFVBQVUsMEJBQTBCLENBQUMsTUFBdUIsRUFBRSxnQkFBMEIsRUFBRSxHQUFnQjtJQUNwSCxJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFBRSxPQUFPLEVBQUUsQ0FBQztLQUFFO0lBRWpELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxLQUFLLEVBQXFCLENBQUM7SUFDN0QsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLENBQUMsY0FBYyxFQUFFO1FBQ3pDLE1BQU0sTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMvRCxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDcEM7SUFFRCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMscUJBQXFCLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUgsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUM3QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDL0MsTUFBTSxPQUFPLEdBQUcscUJBQXFCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQ3JILE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELEtBQUssZ0JBQWdCLE9BQU8sR0FBRyxDQUFDLENBQUM7S0FDdEc7SUFFRCxPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDO0FBakJELGdFQWlCQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsMkJBQTJCLENBQUMsUUFBa0I7SUFDNUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLEVBQXFCLENBQUM7SUFFM0MsS0FBSyxNQUFNLElBQUksSUFBSSxRQUFRLEVBQUU7UUFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZELElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsSUFBSSxFQUFFLENBQUMsQ0FBQztTQUNqRztRQUVELEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFDUCxJQUFJLEVBQUUsSUFBSTtZQUNWLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ2pCLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDO0FBakJELGtFQWlCQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLFFBQVEsQ0FBQyxJQUF5QjtJQUN6QyxNQUFNLE1BQU0sR0FBd0MsRUFBRSxDQUFDO0lBQ3ZELEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1FBQ3RCLE1BQU0sRUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sSUFBSSxTQUFTLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUNwRSxJQUFJLEVBQUUsSUFBSSxNQUFNLEVBQUU7WUFBRSxTQUFTO1NBQUU7UUFDL0IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQztLQUNsQjtJQUNELE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIG1pbmltYXRjaCBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0IHsgU2RrUHJvdmlkZXIgfSBmcm9tICcuLi9hd3MtYXV0aCc7XG5pbXBvcnQgeyBTdGFja0NvbGxlY3Rpb24gfSBmcm9tICcuL2Nsb3VkLWFzc2VtYmx5JztcblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2tzTGlrZUdsb2IoZW52aXJvbm1lbnQ6IHN0cmluZykge1xuICByZXR1cm4gZW52aXJvbm1lbnQuaW5kZXhPZignKicpID4gLTE7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGVuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2xvYkVudmlyb25tZW50c0Zyb21TdGFja3Moc3RhY2tzOiBTdGFja0NvbGxlY3Rpb24sIGVudmlyb25tZW50R2xvYnM6IHN0cmluZ1tdLCBzZGs6IFNka1Byb3ZpZGVyKTogUHJvbWlzZTxjeGFwaS5FbnZpcm9ubWVudFtdPiB7XG4gIGlmIChlbnZpcm9ubWVudEdsb2JzLmxlbmd0aCA9PT0gMCkgeyByZXR1cm4gW107IH1cblxuICBjb25zdCBhdmFpbGFibGVFbnZpcm9ubWVudHMgPSBuZXcgQXJyYXk8Y3hhcGkuRW52aXJvbm1lbnQ+KCk7XG4gIGZvciAoY29uc3Qgc3RhY2sgb2Ygc3RhY2tzLnN0YWNrQXJ0aWZhY3RzKSB7XG4gICAgY29uc3QgYWN0dWFsID0gYXdhaXQgc2RrLnJlc29sdmVFbnZpcm9ubWVudChzdGFjay5lbnZpcm9ubWVudCk7XG4gICAgYXZhaWxhYmxlRW52aXJvbm1lbnRzLnB1c2goYWN0dWFsKTtcbiAgfVxuXG4gIGNvbnN0IGVudmlyb25tZW50cyA9IGRpc3RpbmN0KGF2YWlsYWJsZUVudmlyb25tZW50cykuZmlsdGVyKGVudiA9PiBlbnZpcm9ubWVudEdsb2JzLmZpbmQoZ2xvYiA9PiBtaW5pbWF0Y2goZW52IS5uYW1lLCBnbG9iKSkpO1xuICBpZiAoZW52aXJvbm1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnN0IGdsb2JzID0gSlNPTi5zdHJpbmdpZnkoZW52aXJvbm1lbnRHbG9icyk7XG4gICAgY29uc3QgZW52TGlzdCA9IGF2YWlsYWJsZUVudmlyb25tZW50cy5sZW5ndGggPiAwID8gYXZhaWxhYmxlRW52aXJvbm1lbnRzLm1hcChlbnYgPT4gZW52IS5uYW1lKS5qb2luKCcsICcpIDogJzxub25lPic7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBObyBlbnZpcm9ubWVudHMgd2VyZSBmb3VuZCB3aGVuIHNlbGVjdGluZyBhY3Jvc3MgJHtnbG9ic30gKGF2YWlsYWJsZTogJHtlbnZMaXN0fSlgKTtcbiAgfVxuXG4gIHJldHVybiBlbnZpcm9ubWVudHM7XG59XG5cbi8qKlxuICogR2l2ZW4gYSBzZXQgb2YgXCI8YWNjb3VudD4vPHJlZ2lvbj5cIiBzdHJpbmdzLCBjb25zdHJ1Y3QgZW52aXJvbm1lbnRzIGZvciB0aGVtXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbnZpcm9ubWVudHNGcm9tRGVzY3JpcHRvcnMoZW52U3BlY3M6IHN0cmluZ1tdKTogY3hhcGkuRW52aXJvbm1lbnRbXSB7XG4gIGNvbnN0IHJldCA9IG5ldyBBcnJheTxjeGFwaS5FbnZpcm9ubWVudD4oKTtcblxuICBmb3IgKGNvbnN0IHNwZWMgb2YgZW52U3BlY3MpIHtcbiAgICBjb25zdCBwYXJ0cyA9IHNwZWMucmVwbGFjZSgvXmF3czpcXC9cXC8vLCAnJykuc3BsaXQoJy8nKTtcbiAgICBpZiAocGFydHMubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGVudmlyb25tZW50IG5hbWUgaW4gZm9ybWF0ICdhd3M6Ly88YWNjb3VudD4vPHJlZ2lvbj4nLCBnb3Q6ICR7c3BlY31gKTtcbiAgICB9XG5cbiAgICByZXQucHVzaCh7XG4gICAgICBuYW1lOiBzcGVjLFxuICAgICAgYWNjb3VudDogcGFydHNbMF0sXG4gICAgICByZWdpb246IHBhcnRzWzFdLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuLyoqXG4gKiBEZS1kdXBsaWNhdGVzIGEgbGlzdCBvZiBlbnZpcm9ubWVudHMsIHN1Y2ggdGhhdCBhIGdpdmVuIGFjY291bnQgYW5kIHJlZ2lvbiBpcyBvbmx5IHJlcHJlc2VudGVkIGV4YWN0bHkgb25jZVxuICogaW4gdGhlIHJlc3VsdC5cbiAqXG4gKiBAcGFyYW0gZW52cyB0aGUgcG9zc2libHkgZnVsbC1vZi1kdXBsaWNhdGVzIGxpc3Qgb2YgZW52aXJvbm1lbnRzLlxuICpcbiAqIEByZXR1cm4gYSBkZS1kdXBsaWNhdGVkIGxpc3Qgb2YgZW52aXJvbm1lbnRzLlxuICovXG5mdW5jdGlvbiBkaXN0aW5jdChlbnZzOiBjeGFwaS5FbnZpcm9ubWVudFtdKTogY3hhcGkuRW52aXJvbm1lbnRbXSB7XG4gIGNvbnN0IHVuaXF1ZTogeyBbaWQ6IHN0cmluZ106IGN4YXBpLkVudmlyb25tZW50IH0gPSB7fTtcbiAgZm9yIChjb25zdCBlbnYgb2YgZW52cykge1xuICAgIGNvbnN0IGlkID0gYCR7ZW52LmFjY291bnQgfHwgJ2RlZmF1bHQnfS8ke2Vudi5yZWdpb24gfHwgJ2RlZmF1bHQnfWA7XG4gICAgaWYgKGlkIGluIHVuaXF1ZSkgeyBjb250aW51ZTsgfVxuICAgIHVuaXF1ZVtpZF0gPSBlbnY7XG4gIH1cbiAgcmV0dXJuIE9iamVjdC52YWx1ZXModW5pcXVlKTtcbn1cbiJdfQ==