"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginHost = void 0;
const safe_1 = require("colors/safe");
const logging_1 = require("./logging");
/**
 * A utility to manage plug-ins.
 *
 * @experimental
 */
class PluginHost {
    constructor() {
        /**
         * Access the currently registered CredentialProviderSources. New sources can
         * be registered using the +registerCredentialProviderSource+ method.
         */
        this.credentialProviderSources = new Array();
        if (PluginHost.instance && PluginHost.instance !== this) {
            throw new Error('New instances of PluginHost must not be built. Use PluginHost.instance instead!');
        }
    }
    /**
     * Loads a plug-in into this PluginHost.
     *
     * @param moduleSpec the specification (path or name) of the plug-in module to be loaded.
     */
    load(moduleSpec) {
        try {
            /* eslint-disable @typescript-eslint/no-require-imports */
            const plugin = require(moduleSpec);
            /* eslint-enable */
            if (!isPlugin(plugin)) {
                logging_1.error(`Module ${safe_1.green(moduleSpec)} is not a valid plug-in, or has an unsupported version.`);
                throw new Error(`Module ${moduleSpec} does not define a valid plug-in.`);
            }
            if (plugin.init) {
                plugin.init(PluginHost.instance);
            }
        }
        catch (e) {
            logging_1.error(`Unable to load ${safe_1.green(moduleSpec)}: ${e.stack}`);
            throw new Error(`Unable to load plug-in: ${moduleSpec}`);
        }
        function isPlugin(x) {
            return x != null && x.version === '1';
        }
    }
    /**
     * Allows plug-ins to register new CredentialProviderSources.
     *
     * @param source a new CredentialProviderSource to register.
     */
    registerCredentialProviderSource(source) {
        this.credentialProviderSources.push(source);
    }
}
exports.PluginHost = PluginHost;
PluginHost.instance = new PluginHost();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHNDQUFvQztBQUdwQyx1Q0FBa0M7QUFrQ2xDOzs7O0dBSUc7QUFDSCxNQUFhLFVBQVU7SUFTckI7UUFOQTs7O1dBR0c7UUFDYSw4QkFBeUIsR0FBRyxJQUFJLEtBQUssRUFBNEIsQ0FBQztRQUdoRixJQUFJLFVBQVUsQ0FBQyxRQUFRLElBQUksVUFBVSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7WUFDdkQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpRkFBaUYsQ0FBQyxDQUFDO1NBQ3BHO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxJQUFJLENBQUMsVUFBa0I7UUFDNUIsSUFBSTtZQUNGLDBEQUEwRDtZQUMxRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbkMsbUJBQW1CO1lBQ25CLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3JCLGVBQUssQ0FBQyxVQUFVLFlBQUssQ0FBQyxVQUFVLENBQUMseURBQXlELENBQUMsQ0FBQztnQkFDNUYsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLFVBQVUsbUNBQW1DLENBQUMsQ0FBQzthQUMxRTtZQUNELElBQUksTUFBTSxDQUFDLElBQUksRUFBRTtnQkFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUFFO1NBQ3ZEO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixlQUFLLENBQUMsa0JBQWtCLFlBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUN6RCxNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixVQUFVLEVBQUUsQ0FBQyxDQUFDO1NBQzFEO1FBRUQsU0FBUyxRQUFRLENBQUMsQ0FBTTtZQUN0QixPQUFPLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLE9BQU8sS0FBSyxHQUFHLENBQUM7UUFDeEMsQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksZ0NBQWdDLENBQUMsTUFBZ0M7UUFDdEUsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5QyxDQUFDOztBQS9DSCxnQ0FnREM7QUEvQ2UsbUJBQVEsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZ3JlZW4gfSBmcm9tICdjb2xvcnMvc2FmZSc7XG5cbmltcG9ydCB7IENyZWRlbnRpYWxQcm92aWRlclNvdXJjZSB9IGZyb20gJy4vYXBpL2F3cy1hdXRoL2NyZWRlbnRpYWxzJztcbmltcG9ydCB7IGVycm9yIH0gZnJvbSAnLi9sb2dnaW5nJztcblxuLyoqXG4gKiBUaGUgYmFzaWMgY29udHJhY3QgZm9yIHBsdWctaW5zIHRvIGFkaGVyZSB0bzo6XG4gKlxuICogICBpbXBvcnQgeyBQbHVnaW4sIFBsdWdpbkhvc3QgfSBmcm9tICdhd3MtY2RrJztcbiAqICAgaW1wb3J0IHsgQ3VzdG9tQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlIH0gZnJvbSAnLi9jdXN0b20tY3JlZGVudGlhbC1wcm92aWRlci1zb3VyY2UnO1xuICpcbiAqICAgZXhwb3J0IGRlZmF1bHQgY2xhc3MgRm9vQ0RLUGx1Z0luIGltcGxlbWVudHMgUGx1Z2luSG9zdCB7XG4gKiAgICAgcHVibGljIHJlYWRvbmx5IHZlcnNpb24gPSAnMSc7XG4gKlxuICogICAgIHB1YmxpYyBpbml0KGhvc3Q6IFBsdWdpbkhvc3QpIHtcbiAqICAgICBob3N0LnJlZ2lzdGVyQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlKG5ldyBDdXN0b21DcmVkZW50aWFsUHJvdmlkZXJTb3VyY2UoKSk7XG4gKiAgICAgfVxuICogICB9XG4gKlxuICogQGV4cGVyaW1lbnRhbFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpbiB7XG4gIC8qKlxuICAgKiBUaGUgdmVyc2lvbiBvZiB0aGUgcGx1Zy1pbiBpbnRlcmZhY2UgdXNlZCBieSB0aGUgcGx1Zy1pbi4gVGhpcyB3aWxsIGJlIHVzZWQgYnlcbiAgICogdGhlIHBsdWctaW4gaG9zdCB0byBoYW5kbGUgdmVyc2lvbiBjaGFuZ2VzLlxuICAgKi9cbiAgdmVyc2lvbjogJzEnO1xuXG4gIC8qKlxuICAgKiBXaGVuIGRlZmluZWQsIHRoaXMgZnVuY3Rpb24gaXMgaW52b2tlZCByaWdodCBhZnRlciB0aGUgcGx1Zy1pbiBoYXMgYmVlbiBsb2FkZWQsXG4gICAqIHNvIHRoYXQgdGhlIHBsdWctaW4gaXMgYWJsZSB0byBpbml0aWFsaXplIGl0c2VsZi4gSXQgbWF5IGNhbGwgbWV0aG9kcyBvZiB0aGVcbiAgICogYGBQbHVnaW5Ib3N0YGAgaW5zdGFuY2UgaXQgcmVjZWl2ZXMgdG8gcmVnaXN0ZXIgbmV3IGBgQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlYGBcbiAgICogaW5zdGFuY2VzLlxuICAgKi9cbiAgaW5pdD86IChob3N0OiBQbHVnaW5Ib3N0KSA9PiB2b2lkO1xufVxuXG4vKipcbiAqIEEgdXRpbGl0eSB0byBtYW5hZ2UgcGx1Zy1pbnMuXG4gKlxuICogQGV4cGVyaW1lbnRhbFxuICovXG5leHBvcnQgY2xhc3MgUGx1Z2luSG9zdCB7XG4gIHB1YmxpYyBzdGF0aWMgaW5zdGFuY2UgPSBuZXcgUGx1Z2luSG9zdCgpO1xuXG4gIC8qKlxuICAgKiBBY2Nlc3MgdGhlIGN1cnJlbnRseSByZWdpc3RlcmVkIENyZWRlbnRpYWxQcm92aWRlclNvdXJjZXMuIE5ldyBzb3VyY2VzIGNhblxuICAgKiBiZSByZWdpc3RlcmVkIHVzaW5nIHRoZSArcmVnaXN0ZXJDcmVkZW50aWFsUHJvdmlkZXJTb3VyY2UrIG1ldGhvZC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBjcmVkZW50aWFsUHJvdmlkZXJTb3VyY2VzID0gbmV3IEFycmF5PENyZWRlbnRpYWxQcm92aWRlclNvdXJjZT4oKTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBpZiAoUGx1Z2luSG9zdC5pbnN0YW5jZSAmJiBQbHVnaW5Ib3N0Lmluc3RhbmNlICE9PSB0aGlzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05ldyBpbnN0YW5jZXMgb2YgUGx1Z2luSG9zdCBtdXN0IG5vdCBiZSBidWlsdC4gVXNlIFBsdWdpbkhvc3QuaW5zdGFuY2UgaW5zdGVhZCEnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9hZHMgYSBwbHVnLWluIGludG8gdGhpcyBQbHVnaW5Ib3N0LlxuICAgKlxuICAgKiBAcGFyYW0gbW9kdWxlU3BlYyB0aGUgc3BlY2lmaWNhdGlvbiAocGF0aCBvciBuYW1lKSBvZiB0aGUgcGx1Zy1pbiBtb2R1bGUgdG8gYmUgbG9hZGVkLlxuICAgKi9cbiAgcHVibGljIGxvYWQobW9kdWxlU3BlYzogc3RyaW5nKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgIGNvbnN0IHBsdWdpbiA9IHJlcXVpcmUobW9kdWxlU3BlYyk7XG4gICAgICAvKiBlc2xpbnQtZW5hYmxlICovXG4gICAgICBpZiAoIWlzUGx1Z2luKHBsdWdpbikpIHtcbiAgICAgICAgZXJyb3IoYE1vZHVsZSAke2dyZWVuKG1vZHVsZVNwZWMpfSBpcyBub3QgYSB2YWxpZCBwbHVnLWluLCBvciBoYXMgYW4gdW5zdXBwb3J0ZWQgdmVyc2lvbi5gKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBNb2R1bGUgJHttb2R1bGVTcGVjfSBkb2VzIG5vdCBkZWZpbmUgYSB2YWxpZCBwbHVnLWluLmApO1xuICAgICAgfVxuICAgICAgaWYgKHBsdWdpbi5pbml0KSB7IHBsdWdpbi5pbml0KFBsdWdpbkhvc3QuaW5zdGFuY2UpOyB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXJyb3IoYFVuYWJsZSB0byBsb2FkICR7Z3JlZW4obW9kdWxlU3BlYyl9OiAke2Uuc3RhY2t9YCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBsb2FkIHBsdWctaW46ICR7bW9kdWxlU3BlY31gKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1BsdWdpbih4OiBhbnkpOiB4IGlzIFBsdWdpbiB7XG4gICAgICByZXR1cm4geCAhPSBudWxsICYmIHgudmVyc2lvbiA9PT0gJzEnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBbGxvd3MgcGx1Zy1pbnMgdG8gcmVnaXN0ZXIgbmV3IENyZWRlbnRpYWxQcm92aWRlclNvdXJjZXMuXG4gICAqXG4gICAqIEBwYXJhbSBzb3VyY2UgYSBuZXcgQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlIHRvIHJlZ2lzdGVyLlxuICAgKi9cbiAgcHVibGljIHJlZ2lzdGVyQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlKHNvdXJjZTogQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlKSB7XG4gICAgdGhpcy5jcmVkZW50aWFsUHJvdmlkZXJTb3VyY2VzLnB1c2goc291cmNlKTtcbiAgfVxufVxuIl19