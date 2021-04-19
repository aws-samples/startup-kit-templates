"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StackCollection = exports.CloudAssembly = exports.ExtendedStackSelection = exports.DefaultSelection = void 0;
const cxapi = require("@aws-cdk/cx-api");
const colors = require("colors/safe");
const minimatch = require("minimatch");
const logging_1 = require("../../logging");
var DefaultSelection;
(function (DefaultSelection) {
    /**
     * Returns an empty selection in case there are no selectors.
     */
    DefaultSelection["None"] = "none";
    /**
     * If the app includes a single stack, returns it. Otherwise throws an exception.
     * This behavior is used by "deploy".
     */
    DefaultSelection["OnlySingle"] = "single";
    /**
     * If no selectors are provided, returns all stacks in the app.
     */
    DefaultSelection["AllStacks"] = "all";
})(DefaultSelection = exports.DefaultSelection || (exports.DefaultSelection = {}));
/**
 * When selecting stacks, what other stacks to include because of dependencies
 */
var ExtendedStackSelection;
(function (ExtendedStackSelection) {
    /**
     * Don't select any extra stacks
     */
    ExtendedStackSelection[ExtendedStackSelection["None"] = 0] = "None";
    /**
     * Include stacks that this stack depends on
     */
    ExtendedStackSelection[ExtendedStackSelection["Upstream"] = 1] = "Upstream";
    /**
     * Include stacks that depend on this stack
     */
    ExtendedStackSelection[ExtendedStackSelection["Downstream"] = 2] = "Downstream";
})(ExtendedStackSelection = exports.ExtendedStackSelection || (exports.ExtendedStackSelection = {}));
/**
 * A single Cloud Assembly and the operations we do on it to deploy the artifacts inside
 */
class CloudAssembly {
    constructor(assembly) {
        this.assembly = assembly;
        this.directory = assembly.directory;
    }
    async selectStacks(selectors, options) {
        selectors = selectors.filter(s => s != null); // filter null/undefined
        selectors = [...new Set(selectors)]; // make them unique
        const stacks = this.assembly.stacks;
        if (stacks.length === 0) {
            throw new Error('This app contains no stacks');
        }
        if (selectors.length === 0) {
            switch (options.defaultBehavior) {
                case DefaultSelection.AllStacks:
                    return new StackCollection(this, stacks);
                case DefaultSelection.None:
                    return new StackCollection(this, []);
                case DefaultSelection.OnlySingle:
                    if (stacks.length === 1) {
                        return new StackCollection(this, stacks);
                    }
                    else {
                        throw new Error('Since this app includes more than a single stack, specify which stacks to use (wildcards are supported) or specify `--all`\n' +
                            `Stacks: ${stacks.map(x => x.id).join(' ')}`);
                    }
                default:
                    throw new Error(`invalid default behavior: ${options.defaultBehavior}`);
            }
        }
        const allStacks = new Map();
        for (const stack of stacks) {
            allStacks.set(stack.id, stack);
        }
        // For every selector argument, pick stacks from the list.
        const selectedStacks = new Map();
        for (const pattern of selectors) {
            let found = false;
            for (const stack of stacks) {
                if (minimatch(stack.id, pattern) && !selectedStacks.has(stack.id)) {
                    selectedStacks.set(stack.id, stack);
                    found = true;
                }
            }
            if (!found) {
                throw new Error(`No stack found matching '${pattern}'. Use "list" to print manifest`);
            }
        }
        const extend = options.extend || ExtendedStackSelection.None;
        switch (extend) {
            case ExtendedStackSelection.Downstream:
                includeDownstreamStacks(selectedStacks, allStacks);
                break;
            case ExtendedStackSelection.Upstream:
                includeUpstreamStacks(selectedStacks, allStacks);
                break;
        }
        // Filter original array because it is in the right order
        const selectedList = stacks.filter(s => selectedStacks.has(s.id));
        return new StackCollection(this, selectedList);
    }
    /**
     * Select a single stack by its ID
     */
    stackById(stackId) {
        return new StackCollection(this, [this.assembly.getStackArtifact(stackId)]);
    }
}
exports.CloudAssembly = CloudAssembly;
/**
 * A collection of stacks and related artifacts
 *
 * In practice, not all artifacts in the CloudAssembly are created equal;
 * stacks can be selected independently, but other artifacts such as asset
 * bundles cannot.
 */
class StackCollection {
    constructor(assembly, stackArtifacts) {
        this.assembly = assembly;
        this.stackArtifacts = stackArtifacts;
    }
    get stackCount() {
        return this.stackArtifacts.length;
    }
    get firstStack() {
        if (this.stackCount < 1) {
            throw new Error('StackCollection contains no stack artifacts (trying to access the first one)');
        }
        return this.stackArtifacts[0];
    }
    get stackIds() {
        return this.stackArtifacts.map(s => s.id);
    }
    reversed() {
        const arts = [...this.stackArtifacts];
        arts.reverse();
        return new StackCollection(this.assembly, arts);
    }
    /**
     * Extracts 'aws:cdk:warning|info|error' metadata entries from the stack synthesis
     */
    processMetadataMessages(options = {}) {
        let warnings = false;
        let errors = false;
        for (const stack of this.stackArtifacts) {
            for (const message of stack.messages) {
                switch (message.level) {
                    case cxapi.SynthesisMessageLevel.WARNING:
                        warnings = true;
                        printMessage(logging_1.warning, 'Warning', message.id, message.entry);
                        break;
                    case cxapi.SynthesisMessageLevel.ERROR:
                        errors = true;
                        printMessage(logging_1.error, 'Error', message.id, message.entry);
                        break;
                    case cxapi.SynthesisMessageLevel.INFO:
                        printMessage(logging_1.print, 'Info', message.id, message.entry);
                        break;
                }
            }
        }
        if (errors && !options.ignoreErrors) {
            throw new Error('Found errors');
        }
        if (options.strict && warnings) {
            throw new Error('Found warnings (--strict mode)');
        }
        function printMessage(logFn, prefix, id, entry) {
            logFn(`[${prefix} at ${id}] ${entry.data}`);
            if (options.verbose && entry.trace) {
                logFn(`  ${entry.trace.join('\n  ')}`);
            }
        }
    }
}
exports.StackCollection = StackCollection;
/**
 * Calculate the transitive closure of stack dependents.
 *
 * Modifies `selectedStacks` in-place.
 */
function includeDownstreamStacks(selectedStacks, allStacks) {
    const added = new Array();
    let madeProgress;
    do {
        madeProgress = false;
        for (const [id, stack] of allStacks) {
            // Select this stack if it's not selected yet AND it depends on a stack that's in the selected set
            if (!selectedStacks.has(id) && (stack.dependencies || []).some(dep => selectedStacks.has(dep.id))) {
                selectedStacks.set(id, stack);
                added.push(id);
                madeProgress = true;
            }
        }
    } while (madeProgress);
    if (added.length > 0) {
        logging_1.print('Including depending stacks: %s', colors.bold(added.join(', ')));
    }
}
/**
 * Calculate the transitive closure of stack dependencies.
 *
 * Modifies `selectedStacks` in-place.
 */
function includeUpstreamStacks(selectedStacks, allStacks) {
    const added = new Array();
    let madeProgress = true;
    while (madeProgress) {
        madeProgress = false;
        for (const stack of selectedStacks.values()) {
            // Select an additional stack if it's not selected yet and a dependency of a selected stack (and exists, obviously)
            for (const dependencyId of stack.dependencies.map(x => x.id)) {
                if (!selectedStacks.has(dependencyId) && allStacks.has(dependencyId)) {
                    added.push(dependencyId);
                    selectedStacks.set(dependencyId, allStacks.get(dependencyId));
                    madeProgress = true;
                }
            }
        }
    }
    if (added.length > 0) {
        logging_1.print('Including dependency stacks: %s', colors.bold(added.join(', ')));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQtYXNzZW1ibHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjbG91ZC1hc3NlbWJseS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5Q0FBeUM7QUFDekMsc0NBQXNDO0FBQ3RDLHVDQUF1QztBQUN2QywyQ0FBc0Q7QUFFdEQsSUFBWSxnQkFnQlg7QUFoQkQsV0FBWSxnQkFBZ0I7SUFDMUI7O09BRUc7SUFDSCxpQ0FBYSxDQUFBO0lBRWI7OztPQUdHO0lBQ0gseUNBQXFCLENBQUE7SUFFckI7O09BRUc7SUFDSCxxQ0FBaUIsQ0FBQTtBQUNuQixDQUFDLEVBaEJXLGdCQUFnQixHQUFoQix3QkFBZ0IsS0FBaEIsd0JBQWdCLFFBZ0IzQjtBQWVEOztHQUVHO0FBQ0gsSUFBWSxzQkFlWDtBQWZELFdBQVksc0JBQXNCO0lBQ2hDOztPQUVHO0lBQ0gsbUVBQUksQ0FBQTtJQUVKOztPQUVHO0lBQ0gsMkVBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0VBQVUsQ0FBQTtBQUNaLENBQUMsRUFmVyxzQkFBc0IsR0FBdEIsOEJBQXNCLEtBQXRCLDhCQUFzQixRQWVqQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxhQUFhO0lBTXhCLFlBQTRCLFFBQTZCO1FBQTdCLGFBQVEsR0FBUixRQUFRLENBQXFCO1FBQ3ZELElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQztJQUN0QyxDQUFDO0lBRU0sS0FBSyxDQUFDLFlBQVksQ0FBQyxTQUFtQixFQUFFLE9BQTRCO1FBQ3pFLFNBQVMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsd0JBQXdCO1FBQ3RFLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQjtRQUV4RCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFD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QUksWUFBWSxHQUFHLElBQUksQ0FBQztJQUN4QixPQUFPLFlBQVksRUFBRTtRQUNuQixZQUFZLEdBQUcsS0FBSyxDQUFDO1FBRXJCLEtBQUssTUFBTSxLQUFLLElBQUksY0FBYyxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQzNDLG1IQUFtSDtZQUNuSCxLQUFLLE1BQU0sWUFBWSxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUM1RCxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFO29CQUNwRSxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO29CQUN6QixjQUFjLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBRSxDQUFDLENBQUM7b0JBQy9ELFlBQVksR0FBRyxJQUFJLENBQUM7aUJBQ3JCO2FBQ0Y7U0FDRjtLQUNGO0lBRUQsSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUNwQixlQUFLLENBQUMsaUNBQWlDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN6RTtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycy9zYWZlJztcbmltcG9ydCAqIGFzIG1pbmltYXRjaCBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0IHsgZXJyb3IsIHByaW50LCB3YXJuaW5nIH0gZnJvbSAnLi4vLi4vbG9nZ2luZyc7XG5cbmV4cG9ydCBlbnVtIERlZmF1bHRTZWxlY3Rpb24ge1xuICAvKipcbiAgICogUmV0dXJucyBhbiBlbXB0eSBzZWxlY3Rpb24gaW4gY2FzZSB0aGVyZSBhcmUgbm8gc2VsZWN0b3JzLlxuICAgKi9cbiAgTm9uZSA9ICdub25lJyxcblxuICAvKipcbiAgICogSWYgdGhlIGFwcCBpbmNsdWRlcyBhIHNpbmdsZSBzdGFjaywgcmV0dXJucyBpdC4gT3RoZXJ3aXNlIHRocm93cyBhbiBleGNlcHRpb24uXG4gICAqIFRoaXMgYmVoYXZpb3IgaXMgdXNlZCBieSBcImRlcGxveVwiLlxuICAgKi9cbiAgT25seVNpbmdsZSA9ICdzaW5nbGUnLFxuXG4gIC8qKlxuICAgKiBJZiBubyBzZWxlY3RvcnMgYXJlIHByb3ZpZGVkLCByZXR1cm5zIGFsbCBzdGFja3MgaW4gdGhlIGFwcC5cbiAgICovXG4gIEFsbFN0YWNrcyA9ICdhbGwnLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlbGVjdFN0YWNrc09wdGlvbnMge1xuICAvKipcbiAgICogRXh0ZW5kIHRoZSBzZWxlY3Rpb24gdG8gdXBzdHJlYWQvZG93bnN0cmVhbSBzdGFja3NcbiAgICogQGRlZmF1bHQgRXh0ZW5kZWRTdGFja1NlbGVjdGlvbi5Ob25lIG9ubHkgc2VsZWN0IHRoZSBzcGVjaWZpZWQgc3RhY2tzLlxuICAgKi9cbiAgZXh0ZW5kPzogRXh0ZW5kZWRTdGFja1NlbGVjdGlvbjtcblxuICAvKipcbiAgICogVGhlIGJlaGF2aW9yIGlmIGlmIG5vIHNlbGVjdG9ycyBhcmUgcHJpdmlkZWQuXG4gICAqL1xuICBkZWZhdWx0QmVoYXZpb3I6IERlZmF1bHRTZWxlY3Rpb247XG59XG5cbi8qKlxuICogV2hlbiBzZWxlY3Rpbmcgc3RhY2tzLCB3aGF0IG90aGVyIHN0YWNrcyB0byBpbmNsdWRlIGJlY2F1c2Ugb2YgZGVwZW5kZW5jaWVzXG4gKi9cbmV4cG9ydCBlbnVtIEV4dGVuZGVkU3RhY2tTZWxlY3Rpb24ge1xuICAvKipcbiAgICogRG9uJ3Qgc2VsZWN0IGFueSBleHRyYSBzdGFja3NcbiAgICovXG4gIE5vbmUsXG5cbiAgLyoqXG4gICAqIEluY2x1ZGUgc3RhY2tzIHRoYXQgdGhpcyBzdGFjayBkZXBlbmRzIG9uXG4gICAqL1xuICBVcHN0cmVhbSxcblxuICAvKipcbiAgICogSW5jbHVkZSBzdGFja3MgdGhhdCBkZXBlbmQgb24gdGhpcyBzdGFja1xuICAgKi9cbiAgRG93bnN0cmVhbVxufVxuXG4vKipcbiAqIEEgc2luZ2xlIENsb3VkIEFzc2VtYmx5IGFuZCB0aGUgb3BlcmF0aW9ucyB3ZSBkbyBvbiBpdCB0byBkZXBsb3kgdGhlIGFydGlmYWN0cyBpbnNpZGVcbiAqL1xuZXhwb3J0IGNsYXNzIENsb3VkQXNzZW1ibHkge1xuICAvKipcbiAgICogVGhlIGRpcmVjdG9yeSB0aGlzIENsb3VkQXNzZW1ibHkgd2FzIHJlYWQgZnJvbVxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGRpcmVjdG9yeTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBhc3NlbWJseTogY3hhcGkuQ2xvdWRBc3NlbWJseSkge1xuICAgIHRoaXMuZGlyZWN0b3J5ID0gYXNzZW1ibHkuZGlyZWN0b3J5O1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHNlbGVjdFN0YWNrcyhzZWxlY3RvcnM6IHN0cmluZ1tdLCBvcHRpb25zOiBTZWxlY3RTdGFja3NPcHRpb25zKTogUHJvbWlzZTxTdGFja0NvbGxlY3Rpb24+IHtcbiAgICBzZWxlY3RvcnMgPSBzZWxlY3RvcnMuZmlsdGVyKHMgPT4gcyAhPSBudWxsKTsgLy8gZmlsdGVyIG51bGwvdW5kZWZpbmVkXG4gICAgc2VsZWN0b3JzID0gWy4uLm5ldyBTZXQoc2VsZWN0b3JzKV07IC8vIG1ha2UgdGhlbSB1bmlxdWVcblxuICAgIGNvbnN0IHN0YWNrcyA9IHRoaXMuYXNzZW1ibHkuc3RhY2tzO1xuICAgIGlmIChzdGFja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoaXMgYXBwIGNvbnRhaW5zIG5vIHN0YWNrcycpO1xuICAgIH1cblxuICAgIGlmIChzZWxlY3RvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzd2l0Y2ggKG9wdGlvbnMuZGVmYXVsdEJlaGF2aW9yKSB7XG4gICAgICAgIGNhc2UgRGVmYXVsdFNlbGVjdGlvbi5BbGxTdGFja3M6XG4gICAgICAgICAgcmV0dXJuIG5ldyBTdGFja0NvbGxlY3Rpb24odGhpcywgc3RhY2tzKTtcbiAgICAgICAgY2FzZSBEZWZhdWx0U2VsZWN0aW9uLk5vbmU6XG4gICAgICAgICAgcmV0dXJuIG5ldyBTdGFja0NvbGxlY3Rpb24odGhpcywgW10pO1xuICAgICAgICBjYXNlIERlZmF1bHRTZWxlY3Rpb24uT25seVNpbmdsZTpcbiAgICAgICAgICBpZiAoc3RhY2tzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBTdGFja0NvbGxlY3Rpb24odGhpcywgc3RhY2tzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTaW5jZSB0aGlzIGFwcCBpbmNsdWRlcyBtb3JlIHRoYW4gYSBzaW5nbGUgc3RhY2ssIHNwZWNpZnkgd2hpY2ggc3RhY2tzIHRvIHVzZSAod2lsZGNhcmRzIGFyZSBzdXBwb3J0ZWQpIG9yIHNwZWNpZnkgYC0tYWxsYFxcbicgK1xuICAgICAgICAgICAgICBgU3RhY2tzOiAke3N0YWNrcy5tYXAoeCA9PiB4LmlkKS5qb2luKCcgJyl9YCk7XG4gICAgICAgICAgfVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBkZWZhdWx0IGJlaGF2aW9yOiAke29wdGlvbnMuZGVmYXVsdEJlaGF2aW9yfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGFsbFN0YWNrcyA9IG5ldyBNYXA8c3RyaW5nLCBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3Q+KCk7XG4gICAgZm9yIChjb25zdCBzdGFjayBvZiBzdGFja3MpIHtcbiAgICAgIGFsbFN0YWNrcy5zZXQoc3RhY2suaWQsIHN0YWNrKTtcbiAgICB9XG5cbiAgICAvLyBGb3IgZXZlcnkgc2VsZWN0b3IgYXJndW1lbnQsIHBpY2sgc3RhY2tzIGZyb20gdGhlIGxpc3QuXG4gICAgY29uc3Qgc2VsZWN0ZWRTdGFja3MgPSBuZXcgTWFwPHN0cmluZywgY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0PigpO1xuICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBzZWxlY3RvcnMpIHtcbiAgICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuXG4gICAgICBmb3IgKGNvbnN0IHN0YWNrIG9mIHN0YWNrcykge1xuICAgICAgICBpZiAobWluaW1hdGNoKHN0YWNrLmlkLCBwYXR0ZXJuKSAmJiAhc2VsZWN0ZWRTdGFja3MuaGFzKHN0YWNrLmlkKSkge1xuICAgICAgICAgIHNlbGVjdGVkU3RhY2tzLnNldChzdGFjay5pZCwgc3RhY2spO1xuICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gc3RhY2sgZm91bmQgbWF0Y2hpbmcgJyR7cGF0dGVybn0nLiBVc2UgXCJsaXN0XCIgdG8gcHJpbnQgbWFuaWZlc3RgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBleHRlbmQgPSBvcHRpb25zLmV4dGVuZCB8fCBFeHRlbmRlZFN0YWNrU2VsZWN0aW9uLk5vbmU7XG4gICAgc3dpdGNoIChleHRlbmQpIHtcbiAgICAgIGNhc2UgRXh0ZW5kZWRTdGFja1NlbGVjdGlvbi5Eb3duc3RyZWFtOlxuICAgICAgICBpbmNsdWRlRG93bnN0cmVhbVN0YWNrcyhzZWxlY3RlZFN0YWNrcywgYWxsU3RhY2tzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV4dGVuZGVkU3RhY2tTZWxlY3Rpb24uVXBzdHJlYW06XG4gICAgICAgIGluY2x1ZGVVcHN0cmVhbVN0YWNrcyhzZWxlY3RlZFN0YWNrcywgYWxsU3RhY2tzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gRmlsdGVyIG9yaWdpbmFsIGFycmF5IGJlY2F1c2UgaXQgaXMgaW4gdGhlIHJpZ2h0IG9yZGVyXG4gICAgY29uc3Qgc2VsZWN0ZWRMaXN0ID0gc3RhY2tzLmZpbHRlcihzID0+IHNlbGVjdGVkU3RhY2tzLmhhcyhzLmlkKSk7XG5cbiAgICByZXR1cm4gbmV3IFN0YWNrQ29sbGVjdGlvbih0aGlzLCBzZWxlY3RlZExpc3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbGVjdCBhIHNpbmdsZSBzdGFjayBieSBpdHMgSURcbiAgICovXG4gIHB1YmxpYyBzdGFja0J5SWQoc3RhY2tJZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBTdGFja0NvbGxlY3Rpb24odGhpcywgW3RoaXMuYXNzZW1ibHkuZ2V0U3RhY2tBcnRpZmFjdChzdGFja0lkKV0pO1xuICB9XG59XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIHN0YWNrcyBhbmQgcmVsYXRlZCBhcnRpZmFjdHNcbiAqXG4gKiBJbiBwcmFjdGljZSwgbm90IGFsbCBhcnRpZmFjdHMgaW4gdGhlIENsb3VkQXNzZW1ibHkgYXJlIGNyZWF0ZWQgZXF1YWw7XG4gKiBzdGFja3MgY2FuIGJlIHNlbGVjdGVkIGluZGVwZW5kZW50bHksIGJ1dCBvdGhlciBhcnRpZmFjdHMgc3VjaCBhcyBhc3NldFxuICogYnVuZGxlcyBjYW5ub3QuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGFja0NvbGxlY3Rpb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgYXNzZW1ibHk6IENsb3VkQXNzZW1ibHksIHB1YmxpYyByZWFkb25seSBzdGFja0FydGlmYWN0czogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0W10pIHtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgc3RhY2tDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFja0FydGlmYWN0cy5sZW5ndGg7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGZpcnN0U3RhY2soKSB7XG4gICAgaWYgKHRoaXMuc3RhY2tDb3VudCA8IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU3RhY2tDb2xsZWN0aW9uIGNvbnRhaW5zIG5vIHN0YWNrIGFydGlmYWN0cyAodHJ5aW5nIHRvIGFjY2VzcyB0aGUgZmlyc3Qgb25lKScpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zdGFja0FydGlmYWN0c1swXTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgc3RhY2tJZHMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLnN0YWNrQXJ0aWZhY3RzLm1hcChzID0+IHMuaWQpO1xuICB9XG5cbiAgcHVibGljIHJldmVyc2VkKCkge1xuICAgIGNvbnN0IGFydHMgPSBbLi4udGhpcy5zdGFja0FydGlmYWN0c107XG4gICAgYXJ0cy5yZXZlcnNlKCk7XG4gICAgcmV0dXJuIG5ldyBTdGFja0NvbGxlY3Rpb24odGhpcy5hc3NlbWJseSwgYXJ0cyk7XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdHMgJ2F3czpjZGs6d2FybmluZ3xpbmZvfGVycm9yJyBtZXRhZGF0YSBlbnRyaWVzIGZyb20gdGhlIHN0YWNrIHN5bnRoZXNpc1xuICAgKi9cbiAgcHVibGljIHByb2Nlc3NNZXRhZGF0YU1lc3NhZ2VzKG9wdGlvbnM6IE1ldGFkYXRhTWVzc2FnZU9wdGlvbnMgPSB7fSkge1xuICAgIGxldCB3YXJuaW5ncyA9IGZhbHNlO1xuICAgIGxldCBlcnJvcnMgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3Qgc3RhY2sgb2YgdGhpcy5zdGFja0FydGlmYWN0cykge1xuICAgICAgZm9yIChjb25zdCBtZXNzYWdlIG9mIHN0YWNrLm1lc3NhZ2VzKSB7XG4gICAgICAgIHN3aXRjaCAobWVzc2FnZS5sZXZlbCkge1xuICAgICAgICAgIGNhc2UgY3hhcGkuU3ludGhlc2lzTWVzc2FnZUxldmVsLldBUk5JTkc6XG4gICAgICAgICAgICB3YXJuaW5ncyA9IHRydWU7XG4gICAgICAgICAgICBwcmludE1lc3NhZ2Uod2FybmluZywgJ1dhcm5pbmcnLCBtZXNzYWdlLmlkLCBtZXNzYWdlLmVudHJ5KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgY3hhcGkuU3ludGhlc2lzTWVzc2FnZUxldmVsLkVSUk9SOlxuICAgICAgICAgICAgZXJyb3JzID0gdHJ1ZTtcbiAgICAgICAgICAgIHByaW50TWVzc2FnZShlcnJvciwgJ0Vycm9yJywgbWVzc2FnZS5pZCwgbWVzc2FnZS5lbnRyeSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGN4YXBpLlN5bnRoZXNpc01lc3NhZ2VMZXZlbC5JTkZPOlxuICAgICAgICAgICAgcHJpbnRNZXNzYWdlKHByaW50LCAnSW5mbycsIG1lc3NhZ2UuaWQsIG1lc3NhZ2UuZW50cnkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZXJyb3JzICYmICFvcHRpb25zLmlnbm9yZUVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCBlcnJvcnMnKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5zdHJpY3QgJiYgd2FybmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgd2FybmluZ3MgKC0tc3RyaWN0IG1vZGUpJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJpbnRNZXNzYWdlKGxvZ0ZuOiAoczogc3RyaW5nKSA9PiB2b2lkLCBwcmVmaXg6IHN0cmluZywgaWQ6IHN0cmluZywgZW50cnk6IGN4YXBpLk1ldGFkYXRhRW50cnkpIHtcbiAgICAgIGxvZ0ZuKGBbJHtwcmVmaXh9IGF0ICR7aWR9XSAke2VudHJ5LmRhdGF9YCk7XG5cbiAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UgJiYgZW50cnkudHJhY2UpIHtcbiAgICAgICAgbG9nRm4oYCAgJHtlbnRyeS50cmFjZS5qb2luKCdcXG4gICcpfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1ldGFkYXRhTWVzc2FnZU9wdGlvbnMge1xuICAvKipcbiAgICogV2hldGhlciB0byBiZSB2ZXJib3NlXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICB2ZXJib3NlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogRG9uJ3Qgc3RvcCBvbiBlcnJvciBtZXRhZGF0YVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgaWdub3JlRXJyb3JzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogVHJlYXQgd2FybmluZ3MgaW4gbWV0YWRhdGEgYXMgZXJyb3JzXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICBzdHJpY3Q/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZSB0aGUgdHJhbnNpdGl2ZSBjbG9zdXJlIG9mIHN0YWNrIGRlcGVuZGVudHMuXG4gKlxuICogTW9kaWZpZXMgYHNlbGVjdGVkU3RhY2tzYCBpbi1wbGFjZS5cbiAqL1xuZnVuY3Rpb24gaW5jbHVkZURvd25zdHJlYW1TdGFja3MoXG4gIHNlbGVjdGVkU3RhY2tzOiBNYXA8c3RyaW5nLCBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3Q+LFxuICBhbGxTdGFja3M6IE1hcDxzdHJpbmcsIGN4YXBpLkNsb3VkRm9ybWF0aW9uU3RhY2tBcnRpZmFjdD4pIHtcbiAgY29uc3QgYWRkZWQgPSBuZXcgQXJyYXk8c3RyaW5nPigpO1xuXG4gIGxldCBtYWRlUHJvZ3Jlc3M7XG4gIGRvIHtcbiAgICBtYWRlUHJvZ3Jlc3MgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgW2lkLCBzdGFja10gb2YgYWxsU3RhY2tzKSB7XG4gICAgICAvLyBTZWxlY3QgdGhpcyBzdGFjayBpZiBpdCdzIG5vdCBzZWxlY3RlZCB5ZXQgQU5EIGl0IGRlcGVuZHMgb24gYSBzdGFjayB0aGF0J3MgaW4gdGhlIHNlbGVjdGVkIHNldFxuICAgICAgaWYgKCFzZWxlY3RlZFN0YWNrcy5oYXMoaWQpICYmIChzdGFjay5kZXBlbmRlbmNpZXMgfHwgW10pLnNvbWUoZGVwID0+IHNlbGVjdGVkU3RhY2tzLmhhcyhkZXAuaWQpKSkge1xuICAgICAgICBzZWxlY3RlZFN0YWNrcy5zZXQoaWQsIHN0YWNrKTtcbiAgICAgICAgYWRkZWQucHVzaChpZCk7XG4gICAgICAgIG1hZGVQcm9ncmVzcyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9IHdoaWxlIChtYWRlUHJvZ3Jlc3MpO1xuXG4gIGlmIChhZGRlZC5sZW5ndGggPiAwKSB7XG4gICAgcHJpbnQoJ0luY2x1ZGluZyBkZXBlbmRpbmcgc3RhY2tzOiAlcycsIGNvbG9ycy5ib2xkKGFkZGVkLmpvaW4oJywgJykpKTtcbiAgfVxufVxuXG4vKipcbiAqIENhbGN1bGF0ZSB0aGUgdHJhbnNpdGl2ZSBjbG9zdXJlIG9mIHN0YWNrIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBNb2RpZmllcyBgc2VsZWN0ZWRTdGFja3NgIGluLXBsYWNlLlxuICovXG5mdW5jdGlvbiBpbmNsdWRlVXBzdHJlYW1TdGFja3MoXG4gIHNlbGVjdGVkU3RhY2tzOiBNYXA8c3RyaW5nLCBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3Q+LFxuICBhbGxTdGFja3M6IE1hcDxzdHJpbmcsIGN4YXBpLkNsb3VkRm9ybWF0aW9uU3RhY2tBcnRpZmFjdD4pIHtcbiAgY29uc3QgYWRkZWQgPSBuZXcgQXJyYXk8c3RyaW5nPigpO1xuICBsZXQgbWFkZVByb2dyZXNzID0gdHJ1ZTtcbiAgd2hpbGUgKG1hZGVQcm9ncmVzcykge1xuICAgIG1hZGVQcm9ncmVzcyA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCBzdGFjayBvZiBzZWxlY3RlZFN0YWNrcy52YWx1ZXMoKSkge1xuICAgICAgLy8gU2VsZWN0IGFuIGFkZGl0aW9uYWwgc3RhY2sgaWYgaXQncyBub3Qgc2VsZWN0ZWQgeWV0IGFuZCBhIGRlcGVuZGVuY3kgb2YgYSBzZWxlY3RlZCBzdGFjayAoYW5kIGV4aXN0cywgb2J2aW91c2x5KVxuICAgICAgZm9yIChjb25zdCBkZXBlbmRlbmN5SWQgb2Ygc3RhY2suZGVwZW5kZW5jaWVzLm1hcCh4ID0+IHguaWQpKSB7XG4gICAgICAgIGlmICghc2VsZWN0ZWRTdGFja3MuaGFzKGRlcGVuZGVuY3lJZCkgJiYgYWxsU3RhY2tzLmhhcyhkZXBlbmRlbmN5SWQpKSB7XG4gICAgICAgICAgYWRkZWQucHVzaChkZXBlbmRlbmN5SWQpO1xuICAgICAgICAgIHNlbGVjdGVkU3RhY2tzLnNldChkZXBlbmRlbmN5SWQsIGFsbFN0YWNrcy5nZXQoZGVwZW5kZW5jeUlkKSEpO1xuICAgICAgICAgIG1hZGVQcm9ncmVzcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoYWRkZWQubGVuZ3RoID4gMCkge1xuICAgIHByaW50KCdJbmNsdWRpbmcgZGVwZW5kZW5jeSBzdGFja3M6ICVzJywgY29sb3JzLmJvbGQoYWRkZWQuam9pbignLCAnKSkpO1xuICB9XG59Il19