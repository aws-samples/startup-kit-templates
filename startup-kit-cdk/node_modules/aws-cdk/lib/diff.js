"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printSecurityDiff = exports.RequireApproval = exports.printStackDiff = void 0;
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cfnDiff = require("@aws-cdk/cloudformation-diff");
const colors = require("colors/safe");
const logging_1 = require("./logging");
/**
 * Pretty-prints the differences between two template states to the console.
 *
 * @param oldTemplate the old/current state of the stack.
 * @param newTemplate the new/target state of the stack.
 * @param strict      do not filter out AWS::CDK::Metadata
 * @param context     lines of context to use in arbitrary JSON diff
 *
 * @returns the count of differences that were rendered.
 */
function printStackDiff(oldTemplate, newTemplate, strict, context, stream) {
    const diff = cfnDiff.diffTemplate(oldTemplate, newTemplate.template);
    // filter out 'AWS::CDK::Metadata' resources from the template
    if (diff.resources && !strict) {
        diff.resources = diff.resources.filter(change => {
            if (!change) {
                return true;
            }
            if (change.newResourceType === 'AWS::CDK::Metadata') {
                return false;
            }
            if (change.oldResourceType === 'AWS::CDK::Metadata') {
                return false;
            }
            return true;
        });
    }
    if (!diff.isEmpty) {
        cfnDiff.formatDifferences(stream || process.stderr, diff, buildLogicalToPathMap(newTemplate), context);
    }
    else {
        logging_1.print(colors.green('There were no differences'));
    }
    return diff.differenceCount;
}
exports.printStackDiff = printStackDiff;
var RequireApproval;
(function (RequireApproval) {
    RequireApproval["Never"] = "never";
    RequireApproval["AnyChange"] = "any-change";
    RequireApproval["Broadening"] = "broadening";
})(RequireApproval = exports.RequireApproval || (exports.RequireApproval = {}));
/**
 * Print the security changes of this diff, if the change is impactful enough according to the approval level
 *
 * Returns true if the changes are prompt-worthy, false otherwise.
 */
function printSecurityDiff(oldTemplate, newTemplate, requireApproval) {
    const diff = cfnDiff.diffTemplate(oldTemplate, newTemplate.template);
    if (difRequiresApproval(diff, requireApproval)) {
        // eslint-disable-next-line max-len
        logging_1.warning(`This deployment will make potentially sensitive changes according to your current security approval level (--require-approval ${requireApproval}).`);
        logging_1.warning('Please confirm you intend to make the following modifications:\n');
        cfnDiff.formatSecurityChanges(process.stdout, diff, buildLogicalToPathMap(newTemplate));
        return true;
    }
    return false;
}
exports.printSecurityDiff = printSecurityDiff;
/**
 * Return whether the diff has security-impacting changes that need confirmation
 *
 * TODO: Filter the security impact determination based off of an enum that allows
 * us to pick minimum "severities" to alert on.
 */
function difRequiresApproval(diff, requireApproval) {
    switch (requireApproval) {
        case RequireApproval.Never: return false;
        case RequireApproval.AnyChange: return diff.permissionsAnyChanges;
        case RequireApproval.Broadening: return diff.permissionsBroadened;
        default: throw new Error(`Unrecognized approval level: ${requireApproval}`);
    }
}
function buildLogicalToPathMap(stack) {
    const map = {};
    for (const md of stack.findMetadataByType(cxschema.ArtifactMetadataEntryType.LOGICAL_ID)) {
        map[md.data] = md.path;
    }
    return map;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkRBQTJEO0FBQzNELHdEQUF3RDtBQUV4RCxzQ0FBc0M7QUFDdEMsdUNBQTJDO0FBRTNDOzs7Ozs7Ozs7R0FTRztBQUNILFNBQWdCLGNBQWMsQ0FDNUIsV0FBZ0IsRUFDaEIsV0FBOEMsRUFDOUMsTUFBZSxFQUNmLE9BQWUsRUFDZixNQUE2QjtJQUU3QixNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFckUsOERBQThEO0lBQzlELElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUM3QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzlDLElBQUksQ0FBQyxNQUFNLEVBQUU7Z0JBQUUsT0FBTyxJQUFJLENBQUM7YUFBRTtZQUM3QixJQUFJLE1BQU0sQ0FBQyxlQUFlLEtBQUssb0JBQW9CLEVBQUU7Z0JBQUUsT0FBTyxLQUFLLENBQUM7YUFBRTtZQUN0RSxJQUFJLE1BQU0sQ0FBQyxlQUFlLEtBQUssb0JBQW9CLEVBQUU7Z0JBQUUsT0FBTyxLQUFLLENBQUM7YUFBRTtZQUN0RSxPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNqQixPQUFPLENBQUMsaUJBQWlCLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ3hHO1NBQU07UUFDTCxlQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUM7S0FDbEQ7SUFFRCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUM7QUFDOUIsQ0FBQztBQTFCRCx3Q0EwQkM7QUFFRCxJQUFZLGVBTVg7QUFORCxXQUFZLGVBQWU7SUFDekIsa0NBQWUsQ0FBQTtJQUVmLDJDQUF3QixDQUFBO0lBRXhCLDRDQUF5QixDQUFBO0FBQzNCLENBQUMsRUFOVyxlQUFlLEdBQWYsdUJBQWUsS0FBZix1QkFBZSxRQU0xQjtBQUVEOzs7O0dBSUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxXQUFnQixFQUFFLFdBQThDLEVBQUUsZUFBZ0M7SUFDbEksTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXJFLElBQUksbUJBQW1CLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxFQUFFO1FBQzlDLG1DQUFtQztRQUNuQyxpQkFBTyxDQUFDLGlJQUFpSSxlQUFlLElBQUksQ0FBQyxDQUFDO1FBQzlKLGlCQUFPLENBQUMsa0VBQWtFLENBQUMsQ0FBQztRQUU1RSxPQUFPLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUscUJBQXFCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUN4RixPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBWkQsOENBWUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQVMsbUJBQW1CLENBQUMsSUFBMEIsRUFBRSxlQUFnQztJQUN2RixRQUFRLGVBQWUsRUFBRTtRQUN2QixLQUFLLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQztRQUN6QyxLQUFLLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztRQUNsRSxLQUFLLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztRQUNsRSxPQUFPLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxlQUFlLEVBQUUsQ0FBQyxDQUFDO0tBQzdFO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsS0FBd0M7SUFDckUsTUFBTSxHQUFHLEdBQTZCLEVBQUUsQ0FBQztJQUN6QyxLQUFLLE1BQU0sRUFBRSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMseUJBQXlCLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDeEYsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFjLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO0tBQ2xDO0lBQ0QsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY3hzY2hlbWEgZnJvbSAnQGF3cy1jZGsvY2xvdWQtYXNzZW1ibHktc2NoZW1hJztcbmltcG9ydCAqIGFzIGNmbkRpZmYgZnJvbSAnQGF3cy1jZGsvY2xvdWRmb3JtYXRpb24tZGlmZic7XG5pbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycy9zYWZlJztcbmltcG9ydCB7IHByaW50LCB3YXJuaW5nIH0gZnJvbSAnLi9sb2dnaW5nJztcblxuLyoqXG4gKiBQcmV0dHktcHJpbnRzIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZW1wbGF0ZSBzdGF0ZXMgdG8gdGhlIGNvbnNvbGUuXG4gKlxuICogQHBhcmFtIG9sZFRlbXBsYXRlIHRoZSBvbGQvY3VycmVudCBzdGF0ZSBvZiB0aGUgc3RhY2suXG4gKiBAcGFyYW0gbmV3VGVtcGxhdGUgdGhlIG5ldy90YXJnZXQgc3RhdGUgb2YgdGhlIHN0YWNrLlxuICogQHBhcmFtIHN0cmljdCAgICAgIGRvIG5vdCBmaWx0ZXIgb3V0IEFXUzo6Q0RLOjpNZXRhZGF0YVxuICogQHBhcmFtIGNvbnRleHQgICAgIGxpbmVzIG9mIGNvbnRleHQgdG8gdXNlIGluIGFyYml0cmFyeSBKU09OIGRpZmZcbiAqXG4gKiBAcmV0dXJucyB0aGUgY291bnQgb2YgZGlmZmVyZW5jZXMgdGhhdCB3ZXJlIHJlbmRlcmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJpbnRTdGFja0RpZmYoXG4gIG9sZFRlbXBsYXRlOiBhbnksXG4gIG5ld1RlbXBsYXRlOiBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3QsXG4gIHN0cmljdDogYm9vbGVhbixcbiAgY29udGV4dDogbnVtYmVyLFxuICBzdHJlYW0/OiBjZm5EaWZmLkZvcm1hdFN0cmVhbSk6IG51bWJlciB7XG5cbiAgY29uc3QgZGlmZiA9IGNmbkRpZmYuZGlmZlRlbXBsYXRlKG9sZFRlbXBsYXRlLCBuZXdUZW1wbGF0ZS50ZW1wbGF0ZSk7XG5cbiAgLy8gZmlsdGVyIG91dCAnQVdTOjpDREs6Ok1ldGFkYXRhJyByZXNvdXJjZXMgZnJvbSB0aGUgdGVtcGxhdGVcbiAgaWYgKGRpZmYucmVzb3VyY2VzICYmICFzdHJpY3QpIHtcbiAgICBkaWZmLnJlc291cmNlcyA9IGRpZmYucmVzb3VyY2VzLmZpbHRlcihjaGFuZ2UgPT4ge1xuICAgICAgaWYgKCFjaGFuZ2UpIHsgcmV0dXJuIHRydWU7IH1cbiAgICAgIGlmIChjaGFuZ2UubmV3UmVzb3VyY2VUeXBlID09PSAnQVdTOjpDREs6Ok1ldGFkYXRhJykgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgIGlmIChjaGFuZ2Uub2xkUmVzb3VyY2VUeXBlID09PSAnQVdTOjpDREs6Ok1ldGFkYXRhJykgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKCFkaWZmLmlzRW1wdHkpIHtcbiAgICBjZm5EaWZmLmZvcm1hdERpZmZlcmVuY2VzKHN0cmVhbSB8fCBwcm9jZXNzLnN0ZGVyciwgZGlmZiwgYnVpbGRMb2dpY2FsVG9QYXRoTWFwKG5ld1RlbXBsYXRlKSwgY29udGV4dCk7XG4gIH0gZWxzZSB7XG4gICAgcHJpbnQoY29sb3JzLmdyZWVuKCdUaGVyZSB3ZXJlIG5vIGRpZmZlcmVuY2VzJykpO1xuICB9XG5cbiAgcmV0dXJuIGRpZmYuZGlmZmVyZW5jZUNvdW50O1xufVxuXG5leHBvcnQgZW51bSBSZXF1aXJlQXBwcm92YWwge1xuICBOZXZlciA9ICduZXZlcicsXG5cbiAgQW55Q2hhbmdlID0gJ2FueS1jaGFuZ2UnLFxuXG4gIEJyb2FkZW5pbmcgPSAnYnJvYWRlbmluZydcbn1cblxuLyoqXG4gKiBQcmludCB0aGUgc2VjdXJpdHkgY2hhbmdlcyBvZiB0aGlzIGRpZmYsIGlmIHRoZSBjaGFuZ2UgaXMgaW1wYWN0ZnVsIGVub3VnaCBhY2NvcmRpbmcgdG8gdGhlIGFwcHJvdmFsIGxldmVsXG4gKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBjaGFuZ2VzIGFyZSBwcm9tcHQtd29ydGh5LCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmludFNlY3VyaXR5RGlmZihvbGRUZW1wbGF0ZTogYW55LCBuZXdUZW1wbGF0ZTogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0LCByZXF1aXJlQXBwcm92YWw6IFJlcXVpcmVBcHByb3ZhbCk6IGJvb2xlYW4ge1xuICBjb25zdCBkaWZmID0gY2ZuRGlmZi5kaWZmVGVtcGxhdGUob2xkVGVtcGxhdGUsIG5ld1RlbXBsYXRlLnRlbXBsYXRlKTtcblxuICBpZiAoZGlmUmVxdWlyZXNBcHByb3ZhbChkaWZmLCByZXF1aXJlQXBwcm92YWwpKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cbiAgICB3YXJuaW5nKGBUaGlzIGRlcGxveW1lbnQgd2lsbCBtYWtlIHBvdGVudGlhbGx5IHNlbnNpdGl2ZSBjaGFuZ2VzIGFjY29yZGluZyB0byB5b3VyIGN1cnJlbnQgc2VjdXJpdHkgYXBwcm92YWwgbGV2ZWwgKC0tcmVxdWlyZS1hcHByb3ZhbCAke3JlcXVpcmVBcHByb3ZhbH0pLmApO1xuICAgIHdhcm5pbmcoJ1BsZWFzZSBjb25maXJtIHlvdSBpbnRlbmQgdG8gbWFrZSB0aGUgZm9sbG93aW5nIG1vZGlmaWNhdGlvbnM6XFxuJyk7XG5cbiAgICBjZm5EaWZmLmZvcm1hdFNlY3VyaXR5Q2hhbmdlcyhwcm9jZXNzLnN0ZG91dCwgZGlmZiwgYnVpbGRMb2dpY2FsVG9QYXRoTWFwKG5ld1RlbXBsYXRlKSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIFJldHVybiB3aGV0aGVyIHRoZSBkaWZmIGhhcyBzZWN1cml0eS1pbXBhY3RpbmcgY2hhbmdlcyB0aGF0IG5lZWQgY29uZmlybWF0aW9uXG4gKlxuICogVE9ETzogRmlsdGVyIHRoZSBzZWN1cml0eSBpbXBhY3QgZGV0ZXJtaW5hdGlvbiBiYXNlZCBvZmYgb2YgYW4gZW51bSB0aGF0IGFsbG93c1xuICogdXMgdG8gcGljayBtaW5pbXVtIFwic2V2ZXJpdGllc1wiIHRvIGFsZXJ0IG9uLlxuICovXG5mdW5jdGlvbiBkaWZSZXF1aXJlc0FwcHJvdmFsKGRpZmY6IGNmbkRpZmYuVGVtcGxhdGVEaWZmLCByZXF1aXJlQXBwcm92YWw6IFJlcXVpcmVBcHByb3ZhbCkge1xuICBzd2l0Y2ggKHJlcXVpcmVBcHByb3ZhbCkge1xuICAgIGNhc2UgUmVxdWlyZUFwcHJvdmFsLk5ldmVyOiByZXR1cm4gZmFsc2U7XG4gICAgY2FzZSBSZXF1aXJlQXBwcm92YWwuQW55Q2hhbmdlOiByZXR1cm4gZGlmZi5wZXJtaXNzaW9uc0FueUNoYW5nZXM7XG4gICAgY2FzZSBSZXF1aXJlQXBwcm92YWwuQnJvYWRlbmluZzogcmV0dXJuIGRpZmYucGVybWlzc2lvbnNCcm9hZGVuZWQ7XG4gICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgYXBwcm92YWwgbGV2ZWw6ICR7cmVxdWlyZUFwcHJvdmFsfWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkTG9naWNhbFRvUGF0aE1hcChzdGFjazogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0KSB7XG4gIGNvbnN0IG1hcDogeyBbaWQ6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG4gIGZvciAoY29uc3QgbWQgb2Ygc3RhY2suZmluZE1ldGFkYXRhQnlUeXBlKGN4c2NoZW1hLkFydGlmYWN0TWV0YWRhdGFFbnRyeVR5cGUuTE9HSUNBTF9JRCkpIHtcbiAgICBtYXBbbWQuZGF0YSBhcyBzdHJpbmddID0gbWQucGF0aDtcbiAgfVxuICByZXR1cm4gbWFwO1xufSJdfQ==