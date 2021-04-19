"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentActivityPrinter = exports.HistoryActivityPrinter = exports.StackActivityMonitor = exports.StackActivityProgress = void 0;
const util = require("util");
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const colors = require("colors/safe");
const logging_1 = require("../../../logging");
const display_1 = require("../display");
/**
 * Supported display modes for stack deployment activity
 */
var StackActivityProgress;
(function (StackActivityProgress) {
    /**
     * Displays a progress bar with only the events for the resource currently being deployed
     */
    StackActivityProgress["BAR"] = "bar";
    /**
     * Displays complete history with all CloudFormation stack events
     */
    StackActivityProgress["EVENTS"] = "events";
})(StackActivityProgress = exports.StackActivityProgress || (exports.StackActivityProgress = {}));
class StackActivityMonitor {
    constructor(cfn, stackName, printer, stack, changeSetCreationTime) {
        var _a;
        this.cfn = cfn;
        this.stackName = stackName;
        this.printer = printer;
        this.stack = stack;
        this.active = false;
        this.activity = {};
        this.startTime = (_a = changeSetCreationTime === null || changeSetCreationTime === void 0 ? void 0 : changeSetCreationTime.getTime()) !== null && _a !== void 0 ? _a : Date.now();
    }
    /**
     * Create a Stack Activity Monitor using a default printer, based on context clues
     */
    static withDefaultPrinter(cfn, stackName, stackArtifact, options = {}) {
        var _a, _b;
        const stream = process.stderr;
        const props = {
            resourceTypeColumnWidth: calcMaxResourceTypeLength(stackArtifact.template),
            resourcesTotal: options.resourcesTotal,
            stream,
        };
        const isWindows = process.platform === 'win32';
        const verbose = (_a = options.logLevel) !== null && _a !== void 0 ? _a : logging_1.logLevel;
        // On some CI systems (such as CircleCI) output still reports as a TTY so we also
        // need an individual check for whether we're running on CI.
        // see: https://discuss.circleci.com/t/circleci-terminal-is-a-tty-but-term-is-not-set/9965
        const fancyOutputAvailable = !isWindows && stream.isTTY && !options.ci;
        const progress = (_b = options.progress) !== null && _b !== void 0 ? _b : StackActivityProgress.BAR;
        const printer = fancyOutputAvailable && !verbose && (progress === StackActivityProgress.BAR)
            ? new CurrentActivityPrinter(props)
            : new HistoryActivityPrinter(props);
        return new StackActivityMonitor(cfn, stackName, printer, stackArtifact, options.changeSetCreationTime);
    }
    start() {
        this.active = true;
        this.printer.start();
        this.scheduleNextTick();
        return this;
    }
    async stop() {
        this.active = false;
        this.printer.stop();
        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
        }
        // Do a final poll for all events. This is to handle the situation where DescribeStackStatus
        // already returned an error, but the monitor hasn't seen all the events yet and we'd end
        // up not printing the failure reason to users.
        await this.finalPollToEnd();
    }
    scheduleNextTick() {
        if (!this.active) {
            return;
        }
        this.tickTimer = setTimeout(() => void (this.tick()), this.printer.updateSleep);
    }
    async tick() {
        if (!this.active) {
            return;
        }
        try {
            this.readPromise = this.readNewEvents();
            await this.readPromise;
            this.readPromise = undefined;
            // We might have been stop()ped while the network call was in progress.
            if (!this.active) {
                return;
            }
            this.printer.print();
        }
        catch (e) {
            logging_1.error('Error occurred while monitoring stack: %s', e);
        }
        this.scheduleNextTick();
    }
    findMetadataFor(logicalId) {
        var _a, _b;
        const metadata = (_b = (_a = this.stack) === null || _a === void 0 ? void 0 : _a.manifest) === null || _b === void 0 ? void 0 : _b.metadata;
        if (!logicalId || !metadata) {
            return undefined;
        }
        for (const path of Object.keys(metadata)) {
            const entry = metadata[path]
                .filter(e => e.type === cxschema.ArtifactMetadataEntryType.LOGICAL_ID)
                .find(e => e.data === logicalId);
            if (entry) {
                return {
                    entry,
                    constructPath: this.simplifyConstructPath(path),
                };
            }
        }
        return undefined;
    }
    /**
     * Reads all new events from the stack history
     *
     * The events are returned in reverse chronological order; we continue to the next page if we
     * see a next page and the last event in the page is new to us (and within the time window).
     * haven't seen the final event
     */
    async readNewEvents() {
        var _a;
        const events = [];
        try {
            let nextToken;
            let finished = false;
            while (!finished) {
                const response = await this.cfn.describeStackEvents({ StackName: this.stackName, NextToken: nextToken }).promise();
                const eventPage = (_a = response === null || response === void 0 ? void 0 : response.StackEvents) !== null && _a !== void 0 ? _a : [];
                for (const event of eventPage) {
                    // Event from before we were interested in 'em
                    if (event.Timestamp.valueOf() < this.startTime) {
                        finished = true;
                        break;
                    }
                    // Already seen this one
                    if (event.EventId in this.activity) {
                        finished = true;
                        break;
                    }
                    // Fresh event
                    events.push(this.activity[event.EventId] = {
                        event: event,
                        metadata: this.findMetadataFor(event.LogicalResourceId),
                    });
                }
                // We're also done if there's nothing left to read
                nextToken = response === null || response === void 0 ? void 0 : response.NextToken;
                if (nextToken === undefined) {
                    finished = true;
                }
            }
        }
        catch (e) {
            if (e.code === 'ValidationError' && e.message === `Stack [${this.stackName}] does not exist`) {
                return;
            }
            throw e;
        }
        events.reverse();
        for (const event of events) {
            this.printer.addActivity(event);
        }
    }
    /**
     * Perform a final poll to the end and flush out all events to the printer
     *
     * Finish any poll currently in progress, then do a final one until we've
     * reached the last page.
     */
    async finalPollToEnd() {
        // If we were doing a poll, finish that first. It was started before
        // the moment we were sure we weren't going to get any new events anymore
        // so we need to do a new one anyway. Need to wait for this one though
        // because our state is single-threaded.
        if (this.readPromise) {
            await this.readPromise;
        }
        await this.readNewEvents();
        // Final print
        this.printer.print();
    }
    simplifyConstructPath(path) {
        path = path.replace(/\/Resource$/, '');
        path = path.replace(/^\//, ''); // remove "/" prefix
        // remove "<stack-name>/" prefix
        if (path.startsWith(this.stackName + '/')) {
            path = path.substr(this.stackName.length + 1);
        }
        return path;
    }
}
exports.StackActivityMonitor = StackActivityMonitor;
function padRight(n, x) {
    return x + ' '.repeat(Math.max(0, n - x.length));
}
/**
 * Infamous padLeft()
 */
function padLeft(n, x) {
    return ' '.repeat(Math.max(0, n - x.length)) + x;
}
function calcMaxResourceTypeLength(template) {
    const resources = (template && template.Resources) || {};
    let maxWidth = 0;
    for (const id of Object.keys(resources)) {
        const type = resources[id].Type || '';
        if (type.length > maxWidth) {
            maxWidth = type.length;
        }
    }
    return maxWidth;
}
class ActivityPrinterBase {
    constructor(props) {
        this.props = props;
        /**
         * Fetch new activity every 5 seconds
         */
        this.updateSleep = 5000;
        /**
         * A list of resource IDs which are currently being processed
         */
        this.resourcesInProgress = {};
        /**
         * Previous completion state observed by logical ID
         *
         * We use this to detect that if we see a DELETE_COMPLETE after a
         * CREATE_COMPLETE, it's actually a rollback and we should DECREASE
         * resourcesDone instead of increase it
         */
        this.resourcesPrevCompleteState = {};
        /**
         * Count of resources that have reported a _COMPLETE status
         */
        this.resourcesDone = 0;
        /**
         * How many digits we need to represent the total count (for lining up the status reporting)
         */
        this.resourceDigits = 0;
        this.rollingBack = false;
        this.failures = new Array();
        // +1 because the stack also emits a "COMPLETE" event at the end, and that wasn't
        // counted yet. This makes it line up with the amount of events we expect.
        this.resourcesTotal = props.resourcesTotal ? props.resourcesTotal + 1 : undefined;
        // How many digits does this number take to represent?
        this.resourceDigits = this.resourcesTotal ? Math.ceil(Math.log10(this.resourcesTotal)) : 0;
        this.stream = props.stream;
    }
    addActivity(activity) {
        var _a;
        const status = activity.event.ResourceStatus;
        if (!status || !activity.event.LogicalResourceId) {
            return;
        }
        if (status === 'ROLLBACK_IN_PROGRESS' || status === 'UPDATE_ROLLBACK_IN_PROGRESS') {
            // Only triggered on the stack once we've started doing a rollback
            this.rollingBack = true;
        }
        if (status.endsWith('_IN_PROGRESS')) {
            this.resourcesInProgress[activity.event.LogicalResourceId] = activity;
        }
        if (hasErrorMessage(status)) {
            const isCancelled = ((_a = activity.event.ResourceStatusReason) !== null && _a !== void 0 ? _a : '').indexOf('cancelled') > -1;
            // Cancelled is not an interesting failure reason
            if (!isCancelled) {
                this.failures.push(activity);
            }
        }
        if (status.endsWith('_COMPLETE') || status.endsWith('_FAILED')) {
            delete this.resourcesInProgress[activity.event.LogicalResourceId];
        }
        if (status.endsWith('_COMPLETE')) {
            const prevState = this.resourcesPrevCompleteState[activity.event.LogicalResourceId];
            if (!prevState) {
                this.resourcesDone++;
            }
            else {
                // If we completed this before and we're completing it AGAIN, means we're rolling back.
                // Protect against silly underflow.
                this.resourcesDone--;
                if (this.resourcesDone < 0) {
                    this.resourcesDone = 0;
                }
            }
            this.resourcesPrevCompleteState[activity.event.LogicalResourceId] = status;
        }
    }
    start() {
        // Empty on purpose
    }
    stop() {
        // Empty on purpose
    }
}
/**
 * Activity Printer which shows a full log of all CloudFormation events
 *
 * When there hasn't been activity for a while, it will print the resources
 * that are currently in progress, to show what's holding up the deployment.
 */
class HistoryActivityPrinter extends ActivityPrinterBase {
    constructor(props) {
        super(props);
        /**
         * Last time we printed something to the console.
         *
         * Used to measure timeout for progress reporting.
         */
        this.lastPrintTime = Date.now();
        /**
         * Number of ms of change absence before we tell the user about the resources that are currently in progress.
         */
        this.inProgressDelay = 30000;
        this.printable = new Array();
    }
    addActivity(activity) {
        super.addActivity(activity);
        this.printable.push(activity);
    }
    print() {
        for (const activity of this.printable) {
            this.printOne(activity);
        }
        this.printable.splice(0, this.printable.length);
        this.printInProgress();
    }
    printOne(activity) {
        const e = activity.event;
        const color = colorFromStatusResult(e.ResourceStatus);
        let reasonColor = colors.cyan;
        let stackTrace = '';
        const md = activity.metadata;
        if (md && e.ResourceStatus && e.ResourceStatus.indexOf('FAILED') !== -1) {
            stackTrace = md.entry.trace ? `\n\t${md.entry.trace.join('\n\t\\_ ')}` : '';
            reasonColor = colors.red;
        }
        const resourceName = md ? md.constructPath : (e.LogicalResourceId || '');
        const logicalId = resourceName !== e.LogicalResourceId ? `(${e.LogicalResourceId}) ` : '';
        this.stream.write(util.format(' %s | %s | %s | %s | %s %s%s%s\n', this.progress(), new Date(e.Timestamp).toLocaleTimeString(), color(padRight(STATUS_WIDTH, (e.ResourceStatus || '').substr(0, STATUS_WIDTH))), // pad left and trim
        padRight(this.props.resourceTypeColumnWidth, e.ResourceType || ''), color(colors.bold(resourceName)), logicalId, reasonColor(colors.bold(e.ResourceStatusReason ? e.ResourceStatusReason : '')), reasonColor(stackTrace)));
        this.lastPrintTime = Date.now();
    }
    /**
     * Report the current progress as a [34/42] string, or just [34] if the total is unknown
     */
    progress() {
        if (this.resourcesTotal == null) {
            // Don't have total, show simple count and hope the human knows
            return padLeft(3, util.format('%s', this.resourcesDone)); // max 500 resources
        }
        return util.format('%s/%s', padLeft(this.resourceDigits, this.resourcesDone.toString()), padLeft(this.resourceDigits, this.resourcesTotal != null ? this.resourcesTotal.toString() : '?'));
    }
    /**
     * If some resources are taking a while to create, notify the user about what's currently in progress
     */
    printInProgress() {
        if (Date.now() < this.lastPrintTime + this.inProgressDelay) {
            return;
        }
        if (Object.keys(this.resourcesInProgress).length > 0) {
            this.stream.write(util.format('%s Currently in progress: %s\n', this.progress(), colors.bold(Object.keys(this.resourcesInProgress).join(', '))));
        }
        // We cheat a bit here. To prevent printInProgress() from repeatedly triggering,
        // we set the timestamp into the future. It will be reset whenever a regular print
        // occurs, after which we can be triggered again.
        this.lastPrintTime = +Infinity;
    }
}
exports.HistoryActivityPrinter = HistoryActivityPrinter;
/**
 * Activity Printer which shows the resources currently being updated
 *
 * It will continuously reupdate the terminal and show only the resources
 * that are currently being updated, in addition to a progress bar which
 * shows how far along the deployment is.
 *
 * Resources that have failed will always be shown, and will be recapitulated
 * along with their stack trace when the monitoring ends.
 *
 * Resources that failed deployment because they have been cancelled are
 * not included.
 */
class CurrentActivityPrinter extends ActivityPrinterBase {
    constructor(props) {
        super(props);
        /**
         * This looks very disorienting sleeping for 5 seconds. Update quicker.
         */
        this.updateSleep = 2000;
        this.oldLogLevel = 0 /* DEFAULT */;
        this.block = new display_1.RewritableBlock(this.stream);
    }
    print() {
        var _a;
        const lines = [];
        // Add a progress bar at the top
        const progressWidth = Math.max(Math.min(((_a = this.block.width) !== null && _a !== void 0 ? _a : 80) - PROGRESSBAR_EXTRA_SPACE - 1, MAX_PROGRESSBAR_WIDTH), MIN_PROGRESSBAR_WIDTH);
        const prog = this.progressBar(progressWidth);
        if (prog) {
            lines.push('  ' + prog, '');
        }
        // Normally we'd only print "resources in progress", but it's also useful
        // to keep an eye on the failures and know about the specific errors asquickly
        // as possible (while the stack is still rolling back), so add those in.
        const toPrint = [...this.failures, ...Object.values(this.resourcesInProgress)];
        toPrint.sort((a, b) => a.event.Timestamp.getTime() - b.event.Timestamp.getTime());
        lines.push(...toPrint.map(res => {
            var _a, _b, _c;
            const color = colorFromStatusActivity(res.event.ResourceStatus);
            const resourceName = (_c = (_b = (_a = res.metadata) === null || _a === void 0 ? void 0 : _a.constructPath) !== null && _b !== void 0 ? _b : res.event.LogicalResourceId) !== null && _c !== void 0 ? _c : '';
            return util.format('%s | %s | %s | %s%s', padLeft(TIMESTAMP_WIDTH, new Date(res.event.Timestamp).toLocaleTimeString()), color(padRight(STATUS_WIDTH, (res.event.ResourceStatus || '').substr(0, STATUS_WIDTH))), padRight(this.props.resourceTypeColumnWidth, res.event.ResourceType || ''), color(colors.bold(shorten(40, resourceName))), this.failureReasonOnNextLine(res));
        }));
        this.block.displayLines(lines);
    }
    start() {
        // Need to prevent the waiter from printing 'stack not stable' every 5 seconds, it messes
        // with the output calculations.
        this.oldLogLevel = logging_1.logLevel;
        logging_1.setLogLevel(0 /* DEFAULT */);
    }
    stop() {
        var _a, _b, _c;
        logging_1.setLogLevel(this.oldLogLevel);
        // Print failures at the end
        const lines = new Array();
        for (const failure of this.failures) {
            lines.push(util.format(colors.red('%s | %s | %s | %s%s') + '\n', padLeft(TIMESTAMP_WIDTH, new Date(failure.event.Timestamp).toLocaleTimeString()), padRight(STATUS_WIDTH, (failure.event.ResourceStatus || '').substr(0, STATUS_WIDTH)), padRight(this.props.resourceTypeColumnWidth, failure.event.ResourceType || ''), shorten(40, (_a = failure.event.LogicalResourceId) !== null && _a !== void 0 ? _a : ''), this.failureReasonOnNextLine(failure)));
            const trace = (_c = (_b = failure.metadata) === null || _b === void 0 ? void 0 : _b.entry) === null || _c === void 0 ? void 0 : _c.trace;
            if (trace) {
                lines.push(colors.red(`\t${trace.join('\n\t\\_ ')}\n`));
            }
        }
        // Display in the same block space, otherwise we're going to have silly empty lines.
        this.block.displayLines(lines);
    }
    progressBar(width) {
        if (!this.resourcesTotal) {
            return '';
        }
        const fraction = Math.min(this.resourcesDone / this.resourcesTotal, 1);
        const innerWidth = Math.max(1, width - 2);
        const chars = innerWidth * fraction;
        const remainder = chars - Math.floor(chars);
        const fullChars = FULL_BLOCK.repeat(Math.floor(chars));
        const partialChar = PARTIAL_BLOCK[Math.floor(remainder * PARTIAL_BLOCK.length)];
        const filler = '·'.repeat(innerWidth - Math.floor(chars) - (partialChar ? 1 : 0));
        const color = this.rollingBack ? colors.yellow : colors.green;
        return '[' + color(fullChars + partialChar) + filler + `] (${this.resourcesDone}/${this.resourcesTotal})`;
    }
    failureReasonOnNextLine(activity) {
        var _a, _b;
        return hasErrorMessage((_a = activity.event.ResourceStatus) !== null && _a !== void 0 ? _a : '')
            ? `\n${' '.repeat(TIMESTAMP_WIDTH + STATUS_WIDTH + 6)}${colors.red((_b = activity.event.ResourceStatusReason) !== null && _b !== void 0 ? _b : '')}`
            : '';
    }
}
exports.CurrentActivityPrinter = CurrentActivityPrinter;
const FULL_BLOCK = '█';
const PARTIAL_BLOCK = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
const MAX_PROGRESSBAR_WIDTH = 60;
const MIN_PROGRESSBAR_WIDTH = 10;
const PROGRESSBAR_EXTRA_SPACE = 2 /* leading spaces */ + 2 /* brackets */ + 4 /* progress number decoration */ + 6 /* 2 progress numbers up to 999 */;
function hasErrorMessage(status) {
    return status.endsWith('_FAILED') || status === 'ROLLBACK_IN_PROGRESS' || status === 'UPDATE_ROLLBACK_IN_PROGRESS';
}
function colorFromStatusResult(status) {
    if (!status) {
        return colors.reset;
    }
    if (status.indexOf('FAILED') !== -1) {
        return colors.red;
    }
    if (status.indexOf('ROLLBACK') !== -1) {
        return colors.yellow;
    }
    if (status.indexOf('COMPLETE') !== -1) {
        return colors.green;
    }
    return colors.reset;
}
function colorFromStatusActivity(status) {
    if (!status) {
        return colors.reset;
    }
    if (status.endsWith('_FAILED')) {
        return colors.red;
    }
    if (status.startsWith('CREATE_') || status.startsWith('UPDATE_')) {
        return colors.green;
    }
    // For stacks, it may also be 'UPDDATE_ROLLBACK_IN_PROGRESS'
    if (status.indexOf('ROLLBACK_') !== -1) {
        return colors.yellow;
    }
    if (status.startsWith('DELETE_')) {
        return colors.yellow;
    }
    return colors.reset;
}
function shorten(maxWidth, p) {
    if (p.length <= maxWidth) {
        return p;
    }
    const half = Math.floor((maxWidth - 3) / 2);
    return p.substr(0, half) + '...' + p.substr(p.length - half);
}
const TIMESTAMP_WIDTH = 12;
const STATUS_WIDTH = 20;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhY2stYWN0aXZpdHktbW9uaXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0YWNrLWFjdGl2aXR5LW1vbml0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkJBQTZCO0FBQzdCLDJEQUEyRDtBQUczRCxzQ0FBc0M7QUFDdEMsOENBQTBFO0FBQzFFLHdDQUE2QztBQVk3Qzs7R0FFRztBQUNILElBQVkscUJBVVg7QUFWRCxXQUFZLHFCQUFxQjtJQUMvQjs7T0FFRztJQUNILG9DQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILDBDQUFpQixDQUFBO0FBQ25CLENBQUMsRUFWVyxxQkFBcUIsR0FBckIsNkJBQXFCLEtBQXJCLDZCQUFxQixRQVVoQztBQXNERCxNQUFhLG9CQUFvQjtJQW1EL0IsWUFDbUIsR0FBdUIsRUFDdkIsU0FBaUIsRUFDakIsT0FBeUIsRUFDekIsS0FBeUMsRUFDMUQscUJBQTRCOztRQUpYLFFBQUcsR0FBSCxHQUFHLENBQW9CO1FBQ3ZCLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFDakIsWUFBTyxHQUFQLE9BQU8sQ0FBa0I7UUFDekIsVUFBSyxHQUFMLEtBQUssQ0FBb0M7UUF0QnBELFdBQU0sR0FBRyxLQUFLLENBQUM7UUFDZixhQUFRLEdBQXlDLEVBQUcsQ0FBQztRQXdCM0QsSUFBSSxDQUFDLFNBQVMsU0FBRyxxQkFBcUIsYUFBckIscUJBQXFCLHVCQUFyQixxQkFBcUIsQ0FBRSxPQUFPLHFDQUFNLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNsRSxDQUFDO0lBekREOztPQUVHO0lBQ0ksTUFBTSxDQUFDLGtCQUFrQixDQUM5QixHQUF1QixFQUN2QixTQUFpQixFQUNqQixhQUFnRCxFQUFFLFVBQW1DLEVBQUU7O1FBQ3ZGLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFFOUIsTUFBTSxLQUFLLEdBQWlCO1lBQzFCLHVCQUF1QixFQUFFLHlCQUF5QixDQUFDLGFBQWEsQ0FBQyxR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QUFlLEdBQUcsRUFBRSxDQUFDO0FBQzNCLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHV0aWwgZnJvbSAndXRpbCc7XG5pbXBvcnQgKiBhcyBjeHNjaGVtYSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIGF3cyBmcm9tICdhd3Mtc2RrJztcbmltcG9ydCAqIGFzIGNvbG9ycyBmcm9tICdjb2xvcnMvc2FmZSc7XG5pbXBvcnQgeyBlcnJvciwgbG9nTGV2ZWwsIExvZ0xldmVsLCBzZXRMb2dMZXZlbCB9IGZyb20gJy4uLy4uLy4uL2xvZ2dpbmcnO1xuaW1wb3J0IHsgUmV3cml0YWJsZUJsb2NrIH0gZnJvbSAnLi4vZGlzcGxheSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhY2tBY3Rpdml0eSB7XG4gIHJlYWRvbmx5IGV2ZW50OiBhd3MuQ2xvdWRGb3JtYXRpb24uU3RhY2tFdmVudDtcbiAgcmVhZG9ubHkgbWV0YWRhdGE/OiBSZXNvdXJjZU1ldGFkYXRhO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlc291cmNlTWV0YWRhdGEge1xuICBlbnRyeTogY3hzY2hlbWEuTWV0YWRhdGFFbnRyeTtcbiAgY29uc3RydWN0UGF0aDogc3RyaW5nO1xufVxuXG4vKipcbiAqIFN1cHBvcnRlZCBkaXNwbGF5IG1vZGVzIGZvciBzdGFjayBkZXBsb3ltZW50IGFjdGl2aXR5XG4gKi9cbmV4cG9ydCBlbnVtIFN0YWNrQWN0aXZpdHlQcm9ncmVzcyB7XG4gIC8qKlxuICAgKiBEaXNwbGF5cyBhIHByb2dyZXNzIGJhciB3aXRoIG9ubHkgdGhlIGV2ZW50cyBmb3IgdGhlIHJlc291cmNlIGN1cnJlbnRseSBiZWluZyBkZXBsb3llZFxuICAgKi9cbiAgQkFSID0gJ2JhcicsXG5cbiAgLyoqXG4gICAqIERpc3BsYXlzIGNvbXBsZXRlIGhpc3Rvcnkgd2l0aCBhbGwgQ2xvdWRGb3JtYXRpb24gc3RhY2sgZXZlbnRzXG4gICAqL1xuICBFVkVOVFMgPSAnZXZlbnRzJyxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXaXRoRGVmYXVsdFByaW50ZXJQcm9wcyB7XG4gIC8qKlxuICAgKiBUb3RhbCBudW1iZXIgb2YgcmVzb3VyY2VzIHRvIHVwZGF0ZVxuICAgKlxuICAgKiBVc2VkIHRvIGNhbGN1bGF0ZSBhIHByb2dyZXNzIGJhci5cbiAgICpcbiAgICogQGRlZmF1bHQgLSBObyBwcm9ncmVzcyByZXBvcnRpbmcuXG4gICAqL1xuICByZWFkb25seSByZXNvdXJjZXNUb3RhbD86IG51bWJlcjtcblxuICAvKipcbiAgICogVGhlIGxvZyBsZXZlbCB0aGF0IHdhcyByZXF1ZXN0ZWQgaW4gdGhlIENMSVxuICAgKlxuICAgKiBJZiB2ZXJib3NlIG9yIHRyYWNlIGlzIHJlcXVlc3RlZCwgd2UnbGwgYWx3YXlzIHVzZSB0aGUgZnVsbCBoaXN0b3J5IHByaW50ZXIuXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gVXNlIHZhbHVlIGZyb20gbG9nZ2luZy5sb2dMZXZlbFxuICAgKi9cbiAgcmVhZG9ubHkgbG9nTGV2ZWw/OiBMb2dMZXZlbDtcblxuICAvKipcbiAgICogV2hldGhlciB0byBkaXNwbGF5IGFsbCBzdGFjayBldmVudHMgb3IgdG8gZGlzcGxheSBvbmx5IHRoZSBldmVudHMgZm9yIHRoZVxuICAgKiByZXNvdXJjZSBjdXJyZW50bHkgYmVpbmcgZGVwbG95ZWRcbiAgICpcbiAgICogSWYgbm90IHNldCwgdGhlIHN0YWNrIGhpc3Rvcnkgd2l0aCBhbGwgc3RhY2sgZXZlbnRzIHdpbGwgYmUgZGlzcGxheWVkXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICBwcm9ncmVzcz86IFN0YWNrQWN0aXZpdHlQcm9ncmVzcztcblxuICAvKipcbiAgICogV2hldGhlciB3ZSBhcmUgb24gYSBDSSBzeXN0ZW1cbiAgICpcbiAgICogSWYgc28sIGRpc2FibGUgdGhlIFwib3B0aW1pemVkXCIgc3RhY2sgbW9uaXRvci5cbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHJlYWRvbmx5IGNpPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQ3JlYXRpb24gdGltZSBvZiB0aGUgY2hhbmdlIHNldFxuICAgKlxuICAgKiBUaGlzIHdpbGwgYmUgdXNlZCB0byBmaWx0ZXIgZXZlbnRzLCBvbmx5IHNob3dpbmcgdGhvc2UgZnJvbSBhZnRlciB0aGUgY2hhbmdlXG4gICAqIHNldCBjcmVhdGlvbiB0aW1lLlxuICAgKlxuICAgKiBJdCBpcyByZWNvbW1lbmRlZCB0byB1c2UgdGhpcywgb3RoZXJ3aXNlIHRoZSBmaWx0ZXJpbmcgd2lsbCBiZSBzdWJqZWN0XG4gICAqIHRvIGNsb2NrIGRyaWZ0IGJldHdlZW4gbG9jYWwgYW5kIGNsb3VkIG1hY2hpbmVzLlxuICAgKlxuICAgKiBAZGVmYXVsdCAtIGxvY2FsIG1hY2hpbmUncyBjdXJyZW50IHRpbWVcbiAgICovXG4gIHJlYWRvbmx5IGNoYW5nZVNldENyZWF0aW9uVGltZT86IERhdGU7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGFja0FjdGl2aXR5TW9uaXRvciB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIFN0YWNrIEFjdGl2aXR5IE1vbml0b3IgdXNpbmcgYSBkZWZhdWx0IHByaW50ZXIsIGJhc2VkIG9uIGNvbnRleHQgY2x1ZXNcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgd2l0aERlZmF1bHRQcmludGVyKFxuICAgIGNmbjogYXdzLkNsb3VkRm9ybWF0aW9uLFxuICAgIHN0YWNrTmFtZTogc3RyaW5nLFxuICAgIHN0YWNrQXJ0aWZhY3Q6IGN4YXBpLkNsb3VkRm9ybWF0aW9uU3RhY2tBcnRpZmFjdCwgb3B0aW9uczogV2l0aERlZmF1bHRQcmludGVyUHJvcHMgPSB7fSkge1xuICAgIGNvbnN0IHN0cmVhbSA9IHByb2Nlc3Muc3RkZXJyO1xuXG4gICAgY29uc3QgcHJvcHM6IFByaW50ZXJQcm9wcyA9IHtcbiAgICAgIHJlc291cmNlVHlwZUNvbHVtbldpZHRoOiBjYWxjTWF4UmVzb3VyY2VUeXBlTGVuZ3RoKHN0YWNrQXJ0aWZhY3QudGVtcGxhdGUpLFxuICAgICAgcmVzb3VyY2VzVG90YWw6IG9wdGlvbnMucmVzb3VyY2VzVG90YWwsXG4gICAgICBzdHJlYW0sXG4gICAgfTtcblxuICAgIGNvbnN0IGlzV2luZG93cyA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMic7XG4gICAgY29uc3QgdmVyYm9zZSA9IG9wdGlvbnMubG9nTGV2ZWwgPz8gbG9nTGV2ZWw7XG4gICAgLy8gT24gc29tZSBDSSBzeXN0ZW1zIChzdWNoIGFzIENpcmNsZUNJKSBvdXRwdXQgc3RpbGwgcmVwb3J0cyBhcyBhIFRUWSBzbyB3ZSBhbHNvXG4gICAgLy8gbmVlZCBhbiBpbmRpdmlkdWFsIGNoZWNrIGZvciB3aGV0aGVyIHdlJ3JlIHJ1bm5pbmcgb24gQ0kuXG4gICAgLy8gc2VlOiBodHRwczovL2Rpc2N1c3MuY2lyY2xlY2kuY29tL3QvY2lyY2xlY2ktdGVybWluYWwtaXMtYS10dHktYnV0LXRlcm0taXMtbm90LXNldC85OTY1XG4gICAgY29uc3QgZmFuY3lPdXRwdXRBdmFpbGFibGUgPSAhaXNXaW5kb3dzICYmIHN0cmVhbS5pc1RUWSAmJiAhb3B0aW9ucy5jaTtcbiAgICBjb25zdCBwcm9ncmVzcyA9IG9wdGlvbnMucHJvZ3Jlc3MgPz8gU3RhY2tBY3Rpdml0eVByb2dyZXNzLkJBUjtcblxuICAgIGNvbnN0IHByaW50ZXIgPSBmYW5jeU91dHB1dEF2YWlsYWJsZSAmJiAhdmVyYm9zZSAmJiAocHJvZ3Jlc3MgPT09IFN0YWNrQWN0aXZpdHlQcm9ncmVzcy5CQVIpXG4gICAgICA/IG5ldyBDdXJyZW50QWN0aXZpdHlQcmludGVyKHByb3BzKVxuICAgICAgOiBuZXcgSGlzdG9yeUFjdGl2aXR5UHJpbnRlcihwcm9wcyk7XG5cbiAgICByZXR1cm4gbmV3IFN0YWNrQWN0aXZpdHlNb25pdG9yKGNmbiwgc3RhY2tOYW1lLCBwcmludGVyLCBzdGFja0FydGlmYWN0LCBvcHRpb25zLmNoYW5nZVNldENyZWF0aW9uVGltZSk7XG4gIH1cblxuXG4gIHByaXZhdGUgYWN0aXZlID0gZmFsc2U7XG4gIHByaXZhdGUgYWN0aXZpdHk6IHsgW2V2ZW50SWQ6IHN0cmluZ106IFN0YWNrQWN0aXZpdHkgfSA9IHsgfTtcblxuICAvKipcbiAgICogRGV0ZXJtaW5lcyB3aGljaCBldmVudHMgbm90IHRvIGRpc3BsYXlcbiAgICovXG4gIHByaXZhdGUgcmVhZG9ubHkgc3RhcnRUaW1lOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgdGljayB0aW1lclxuICAgKi9cbiAgcHJpdmF0ZSB0aWNrVGltZXI/OiBOb2RlSlMuVGltZXI7XG5cbiAgLyoqXG4gICAqIFNldCB0byB0aGUgYWN0aXZpdHkgb2YgcmVhZGluZyB0aGUgY3VycmVudCBldmVudHNcbiAgICovXG4gIHByaXZhdGUgcmVhZFByb21pc2U/OiBQcm9taXNlPGFueT47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBjZm46IGF3cy5DbG91ZEZvcm1hdGlvbixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0YWNrTmFtZTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcHJpbnRlcjogSUFjdGl2aXR5UHJpbnRlcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0YWNrPzogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0LFxuICAgIGNoYW5nZVNldENyZWF0aW9uVGltZT86IERhdGUsXG4gICkge1xuICAgIHRoaXMuc3RhcnRUaW1lID0gY2hhbmdlU2V0Q3JlYXRpb25UaW1lPy5nZXRUaW1lKCkgPz8gRGF0ZS5ub3coKTtcbiAgfVxuXG4gIHB1YmxpYyBzdGFydCgpIHtcbiAgICB0aGlzLmFjdGl2ZSA9IHRydWU7XG4gICAgdGhpcy5wcmludGVyLnN0YXJ0KCk7XG4gICAgdGhpcy5zY2hlZHVsZU5leHRUaWNrKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgc3RvcCgpIHtcbiAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgIHRoaXMucHJpbnRlci5zdG9wKCk7XG4gICAgaWYgKHRoaXMudGlja1RpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50aWNrVGltZXIpO1xuICAgIH1cblxuICAgIC8vIERvIGEgZmluYWwgcG9sbCBmb3IgYWxsIGV2ZW50cy4gVGhpcyBpcyB0byBoYW5kbGUgdGhlIHNpdHVhdGlvbiB3aGVyZSBEZXNjcmliZVN0YWNrU3RhdHVzXG4gICAgLy8gYWxyZWFkeSByZXR1cm5lZCBhbiBlcnJvciwgYnV0IHRoZSBtb25pdG9yIGhhc24ndCBzZWVuIGFsbCB0aGUgZXZlbnRzIHlldCBhbmQgd2UnZCBlbmRcbiAgICAvLyB1cCBub3QgcHJpbnRpbmcgdGhlIGZhaWx1cmUgcmVhc29uIHRvIHVzZXJzLlxuICAgIGF3YWl0IHRoaXMuZmluYWxQb2xsVG9FbmQoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVOZXh0VGljaygpIHtcbiAgICBpZiAoIXRoaXMuYWN0aXZlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy50aWNrVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHZvaWQodGhpcy50aWNrKCkpLCB0aGlzLnByaW50ZXIudXBkYXRlU2xlZXApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB0aWNrKCkge1xuICAgIGlmICghdGhpcy5hY3RpdmUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5yZWFkUHJvbWlzZSA9IHRoaXMucmVhZE5ld0V2ZW50cygpO1xuICAgICAgYXdhaXQgdGhpcy5yZWFkUHJvbWlzZTtcbiAgICAgIHRoaXMucmVhZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFdlIG1pZ2h0IGhhdmUgYmVlbiBzdG9wKClwZWQgd2hpbGUgdGhlIG5ldHdvcmsgY2FsbCB3YXMgaW4gcHJvZ3Jlc3MuXG4gICAgICBpZiAoIXRoaXMuYWN0aXZlKSB7IHJldHVybjsgfVxuXG4gICAgICB0aGlzLnByaW50ZXIucHJpbnQoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBlcnJvcignRXJyb3Igb2NjdXJyZWQgd2hpbGUgbW9uaXRvcmluZyBzdGFjazogJXMnLCBlKTtcbiAgICB9XG4gICAgdGhpcy5zY2hlZHVsZU5leHRUaWNrKCk7XG4gIH1cblxuICBwcml2YXRlIGZpbmRNZXRhZGF0YUZvcihsb2dpY2FsSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFJlc291cmNlTWV0YWRhdGEgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IG1ldGFkYXRhID0gdGhpcy5zdGFjaz8ubWFuaWZlc3Q/Lm1ldGFkYXRhO1xuICAgIGlmICghbG9naWNhbElkIHx8ICFtZXRhZGF0YSkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG4gICAgZm9yIChjb25zdCBwYXRoIG9mIE9iamVjdC5rZXlzKG1ldGFkYXRhKSkge1xuICAgICAgY29uc3QgZW50cnkgPSBtZXRhZGF0YVtwYXRoXVxuICAgICAgICAuZmlsdGVyKGUgPT4gZS50eXBlID09PSBjeHNjaGVtYS5BcnRpZmFjdE1ldGFkYXRhRW50cnlUeXBlLkxPR0lDQUxfSUQpXG4gICAgICAgIC5maW5kKGUgPT4gZS5kYXRhID09PSBsb2dpY2FsSWQpO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZW50cnksXG4gICAgICAgICAgY29uc3RydWN0UGF0aDogdGhpcy5zaW1wbGlmeUNvbnN0cnVjdFBhdGgocGF0aCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogUmVhZHMgYWxsIG5ldyBldmVudHMgZnJvbSB0aGUgc3RhY2sgaGlzdG9yeVxuICAgKlxuICAgKiBUaGUgZXZlbnRzIGFyZSByZXR1cm5lZCBpbiByZXZlcnNlIGNocm9ub2xvZ2ljYWwgb3JkZXI7IHdlIGNvbnRpbnVlIHRvIHRoZSBuZXh0IHBhZ2UgaWYgd2VcbiAgICogc2VlIGEgbmV4dCBwYWdlIGFuZCB0aGUgbGFzdCBldmVudCBpbiB0aGUgcGFnZSBpcyBuZXcgdG8gdXMgKGFuZCB3aXRoaW4gdGhlIHRpbWUgd2luZG93KS5cbiAgICogaGF2ZW4ndCBzZWVuIHRoZSBmaW5hbCBldmVudFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyByZWFkTmV3RXZlbnRzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV2ZW50czogU3RhY2tBY3Rpdml0eVtdID0gW107XG5cbiAgICB0cnkge1xuICAgICAgbGV0IG5leHRUb2tlbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgbGV0IGZpbmlzaGVkID0gZmFsc2U7XG4gICAgICB3aGlsZSAoIWZpbmlzaGVkKSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jZm4uZGVzY3JpYmVTdGFja0V2ZW50cyh7IFN0YWNrTmFtZTogdGhpcy5zdGFja05hbWUsIE5leHRUb2tlbjogbmV4dFRva2VuIH0pLnByb21pc2UoKTtcbiAgICAgICAgY29uc3QgZXZlbnRQYWdlID0gcmVzcG9uc2U/LlN0YWNrRXZlbnRzID8/IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRQYWdlKSB7XG4gICAgICAgICAgLy8gRXZlbnQgZnJvbSBiZWZvcmUgd2Ugd2VyZSBpbnRlcmVzdGVkIGluICdlbVxuICAgICAgICAgIGlmIChldmVudC5UaW1lc3RhbXAudmFsdWVPZigpIDwgdGhpcy5zdGFydFRpbWUpIHtcbiAgICAgICAgICAgIGZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFscmVhZHkgc2VlbiB0aGlzIG9uZVxuICAgICAgICAgIGlmIChldmVudC5FdmVudElkIGluIHRoaXMuYWN0aXZpdHkpIHtcbiAgICAgICAgICAgIGZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEZyZXNoIGV2ZW50XG4gICAgICAgICAgZXZlbnRzLnB1c2godGhpcy5hY3Rpdml0eVtldmVudC5FdmVudElkXSA9IHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIG1ldGFkYXRhOiB0aGlzLmZpbmRNZXRhZGF0YUZvcihldmVudC5Mb2dpY2FsUmVzb3VyY2VJZCksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXZSdyZSBhbHNvIGRvbmUgaWYgdGhlcmUncyBub3RoaW5nIGxlZnQgdG8gcmVhZFxuICAgICAgICBuZXh0VG9rZW4gPSByZXNwb25zZT8uTmV4dFRva2VuO1xuICAgICAgICBpZiAobmV4dFRva2VuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBmaW5pc2hlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5jb2RlID09PSAnVmFsaWRhdGlvbkVycm9yJyAmJiBlLm1lc3NhZ2UgPT09IGBTdGFjayBbJHt0aGlzLnN0YWNrTmFtZX1dIGRvZXMgbm90IGV4aXN0YCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGV2ZW50cy5yZXZlcnNlKCk7XG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgIHRoaXMucHJpbnRlci5hZGRBY3Rpdml0eShldmVudCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gYSBmaW5hbCBwb2xsIHRvIHRoZSBlbmQgYW5kIGZsdXNoIG91dCBhbGwgZXZlbnRzIHRvIHRoZSBwcmludGVyXG4gICAqXG4gICAqIEZpbmlzaCBhbnkgcG9sbCBjdXJyZW50bHkgaW4gcHJvZ3Jlc3MsIHRoZW4gZG8gYSBmaW5hbCBvbmUgdW50aWwgd2UndmVcbiAgICogcmVhY2hlZCB0aGUgbGFzdCBwYWdlLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBmaW5hbFBvbGxUb0VuZCgpIHtcbiAgICAvLyBJZiB3ZSB3ZXJlIGRvaW5nIGEgcG9sbCwgZmluaXNoIHRoYXQgZmlyc3QuIEl0IHdhcyBzdGFydGVkIGJlZm9yZVxuICAgIC8vIHRoZSBtb21lbnQgd2Ugd2VyZSBzdXJlIHdlIHdlcmVuJ3QgZ29pbmcgdG8gZ2V0IGFueSBuZXcgZXZlbnRzIGFueW1vcmVcbiAgICAvLyBzbyB3ZSBuZWVkIHRvIGRvIGEgbmV3IG9uZSBhbnl3YXkuIE5lZWQgdG8gd2FpdCBmb3IgdGhpcyBvbmUgdGhvdWdoXG4gICAgLy8gYmVjYXVzZSBvdXIgc3RhdGUgaXMgc2luZ2xlLXRocmVhZGVkLlxuICAgIGlmICh0aGlzLnJlYWRQcm9taXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlYWRQcm9taXNlO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMucmVhZE5ld0V2ZW50cygpO1xuXG4gICAgLy8gRmluYWwgcHJpbnRcbiAgICB0aGlzLnByaW50ZXIucHJpbnQoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2ltcGxpZnlDb25zdHJ1Y3RQYXRoKHBhdGg6IHN0cmluZykge1xuICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoL1xcL1Jlc291cmNlJC8sICcnKTtcbiAgICBwYXRoID0gcGF0aC5yZXBsYWNlKC9eXFwvLywgJycpOyAvLyByZW1vdmUgXCIvXCIgcHJlZml4XG5cbiAgICAvLyByZW1vdmUgXCI8c3RhY2stbmFtZT4vXCIgcHJlZml4XG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aCh0aGlzLnN0YWNrTmFtZSArICcvJykpIHtcbiAgICAgIHBhdGggPSBwYXRoLnN1YnN0cih0aGlzLnN0YWNrTmFtZS5sZW5ndGggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhdGg7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFkUmlnaHQobjogbnVtYmVyLCB4OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4geCArICcgJy5yZXBlYXQoTWF0aC5tYXgoMCwgbiAtIHgubGVuZ3RoKSk7XG59XG5cbi8qKlxuICogSW5mYW1vdXMgcGFkTGVmdCgpXG4gKi9cbmZ1bmN0aW9uIHBhZExlZnQobjogbnVtYmVyLCB4OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gJyAnLnJlcGVhdChNYXRoLm1heCgwLCBuIC0geC5sZW5ndGgpKSArIHg7XG59XG5cbmZ1bmN0aW9uIGNhbGNNYXhSZXNvdXJjZVR5cGVMZW5ndGgodGVtcGxhdGU6IGFueSkge1xuICBjb25zdCByZXNvdXJjZXMgPSAodGVtcGxhdGUgJiYgdGVtcGxhdGUuUmVzb3VyY2VzKSB8fCB7fTtcbiAgbGV0IG1heFdpZHRoID0gMDtcbiAgZm9yIChjb25zdCBpZCBvZiBPYmplY3Qua2V5cyhyZXNvdXJjZXMpKSB7XG4gICAgY29uc3QgdHlwZSA9IHJlc291cmNlc1tpZF0uVHlwZSB8fCAnJztcbiAgICBpZiAodHlwZS5sZW5ndGggPiBtYXhXaWR0aCkge1xuICAgICAgbWF4V2lkdGggPSB0eXBlLmxlbmd0aDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG1heFdpZHRoO1xufVxuXG5pbnRlcmZhY2UgUHJpbnRlclByb3BzIHtcbiAgLyoqXG4gICAqIFRvdGFsIHJlc291cmNlcyB0byBkZXBsb3lcbiAgICovXG4gIHJlYWRvbmx5IHJlc291cmNlc1RvdGFsPzogbnVtYmVyXG5cbiAgLyoqXG4gICAqIFRoZSB3aXRoIG9mIHRoZSBcInJlc291cmNlIHR5cGVcIiBjb2x1bW4uXG4gICAqL1xuICByZWFkb25seSByZXNvdXJjZVR5cGVDb2x1bW5XaWR0aDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBTdHJlYW0gdG8gd3JpdGUgdG9cbiAgICovXG4gIHJlYWRvbmx5IHN0cmVhbTogTm9kZUpTLldyaXRlU3RyZWFtO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBY3Rpdml0eVByaW50ZXIge1xuICByZWFkb25seSB1cGRhdGVTbGVlcDogbnVtYmVyO1xuXG4gIGFkZEFjdGl2aXR5KGFjdGl2aXR5OiBTdGFja0FjdGl2aXR5KTogdm9pZDtcbiAgcHJpbnQoKTogdm9pZDtcbiAgc3RhcnQoKTogdm9pZDtcbiAgc3RvcCgpOiB2b2lkO1xufVxuXG5hYnN0cmFjdCBjbGFzcyBBY3Rpdml0eVByaW50ZXJCYXNlIGltcGxlbWVudHMgSUFjdGl2aXR5UHJpbnRlciB7XG4gIC8qKlxuICAgKiBGZXRjaCBuZXcgYWN0aXZpdHkgZXZlcnkgNSBzZWNvbmRzXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgdXBkYXRlU2xlZXA6IG51bWJlciA9IDVfMDAwO1xuXG4gIC8qKlxuICAgKiBBIGxpc3Qgb2YgcmVzb3VyY2UgSURzIHdoaWNoIGFyZSBjdXJyZW50bHkgYmVpbmcgcHJvY2Vzc2VkXG4gICAqL1xuICBwcm90ZWN0ZWQgcmVzb3VyY2VzSW5Qcm9ncmVzczogUmVjb3JkPHN0cmluZywgU3RhY2tBY3Rpdml0eT4gPSB7fTtcblxuICAvKipcbiAgICogUHJldmlvdXMgY29tcGxldGlvbiBzdGF0ZSBvYnNlcnZlZCBieSBsb2dpY2FsIElEXG4gICAqXG4gICAqIFdlIHVzZSB0aGlzIHRvIGRldGVjdCB0aGF0IGlmIHdlIHNlZSBhIERFTEVURV9DT01QTEVURSBhZnRlciBhXG4gICAqIENSRUFURV9DT01QTEVURSwgaXQncyBhY3R1YWxseSBhIHJvbGxiYWNrIGFuZCB3ZSBzaG91bGQgREVDUkVBU0VcbiAgICogcmVzb3VyY2VzRG9uZSBpbnN0ZWFkIG9mIGluY3JlYXNlIGl0XG4gICAqL1xuICBwcm90ZWN0ZWQgcmVzb3VyY2VzUHJldkNvbXBsZXRlU3RhdGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuICAvKipcbiAgICogQ291bnQgb2YgcmVzb3VyY2VzIHRoYXQgaGF2ZSByZXBvcnRlZCBhIF9DT01QTEVURSBzdGF0dXNcbiAgICovXG4gIHByb3RlY3RlZCByZXNvdXJjZXNEb25lOiBudW1iZXIgPSAwO1xuXG4gIC8qKlxuICAgKiBIb3cgbWFueSBkaWdpdHMgd2UgbmVlZCB0byByZXByZXNlbnQgdGhlIHRvdGFsIGNvdW50IChmb3IgbGluaW5nIHVwIHRoZSBzdGF0dXMgcmVwb3J0aW5nKVxuICAgKi9cbiAgcHJvdGVjdGVkIHJlYWRvbmx5IHJlc291cmNlRGlnaXRzOiBudW1iZXIgPSAwO1xuXG4gIHByb3RlY3RlZCByZWFkb25seSByZXNvdXJjZXNUb3RhbD86IG51bWJlcjtcblxuICBwcm90ZWN0ZWQgcm9sbGluZ0JhY2sgPSBmYWxzZTtcblxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgZmFpbHVyZXMgPSBuZXcgQXJyYXk8U3RhY2tBY3Rpdml0eT4oKTtcblxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgc3RyZWFtOiBOb2RlSlMuV3JpdGVTdHJlYW07XG5cbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIHJlYWRvbmx5IHByb3BzOiBQcmludGVyUHJvcHMpIHtcbiAgICAvLyArMSBiZWNhdXNlIHRoZSBzdGFjayBhbHNvIGVtaXRzIGEgXCJDT01QTEVURVwiIGV2ZW50IGF0IHRoZSBlbmQsIGFuZCB0aGF0IHdhc24ndFxuICAgIC8vIGNvdW50ZWQgeWV0LiBUaGlzIG1ha2VzIGl0IGxpbmUgdXAgd2l0aCB0aGUgYW1vdW50IG9mIGV2ZW50cyB3ZSBleHBlY3QuXG4gICAgdGhpcy5yZXNvdXJjZXNUb3RhbCA9IHByb3BzLnJlc291cmNlc1RvdGFsID8gcHJvcHMucmVzb3VyY2VzVG90YWwgKyAxIDogdW5kZWZpbmVkO1xuXG4gICAgLy8gSG93IG1hbnkgZGlnaXRzIGRvZXMgdGhpcyBudW1iZXIgdGFrZSB0byByZXByZXNlbnQ/XG4gICAgdGhpcy5yZXNvdXJjZURpZ2l0cyA9IHRoaXMucmVzb3VyY2VzVG90YWwgPyBNYXRoLmNlaWwoTWF0aC5sb2cxMCh0aGlzLnJlc291cmNlc1RvdGFsKSkgOiAwO1xuXG4gICAgdGhpcy5zdHJlYW0gPSBwcm9wcy5zdHJlYW07XG4gIH1cblxuICBwdWJsaWMgYWRkQWN0aXZpdHkoYWN0aXZpdHk6IFN0YWNrQWN0aXZpdHkpIHtcbiAgICBjb25zdCBzdGF0dXMgPSBhY3Rpdml0eS5ldmVudC5SZXNvdXJjZVN0YXR1cztcbiAgICBpZiAoIXN0YXR1cyB8fCAhYWN0aXZpdHkuZXZlbnQuTG9naWNhbFJlc291cmNlSWQpIHsgcmV0dXJuOyB9XG5cbiAgICBpZiAoc3RhdHVzID09PSAnUk9MTEJBQ0tfSU5fUFJPR1JFU1MnIHx8IHN0YXR1cyA9PT0gJ1VQREFURV9ST0xMQkFDS19JTl9QUk9HUkVTUycpIHtcbiAgICAgIC8vIE9ubHkgdHJpZ2dlcmVkIG9uIHRoZSBzdGFjayBvbmNlIHdlJ3ZlIHN0YXJ0ZWQgZG9pbmcgYSByb2xsYmFja1xuICAgICAgdGhpcy5yb2xsaW5nQmFjayA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHN0YXR1cy5lbmRzV2l0aCgnX0lOX1BST0dSRVNTJykpIHtcbiAgICAgIHRoaXMucmVzb3VyY2VzSW5Qcm9ncmVzc1thY3Rpdml0eS5ldmVudC5Mb2dpY2FsUmVzb3VyY2VJZF0gPSBhY3Rpdml0eTtcbiAgICB9XG5cbiAgICBpZiAoaGFzRXJyb3JNZXNzYWdlKHN0YXR1cykpIHtcbiAgICAgIGNvbnN0IGlzQ2FuY2VsbGVkID0gKGFjdGl2aXR5LmV2ZW50LlJlc291cmNlU3RhdHVzUmVhc29uID8/ICcnKS5pbmRleE9mKCdjYW5jZWxsZWQnKSA+IC0xO1xuXG4gICAgICAvLyBDYW5jZWxsZWQgaXMgbm90IGFuIGludGVyZXN0aW5nIGZhaWx1cmUgcmVhc29uXG4gICAgICBpZiAoIWlzQ2FuY2VsbGVkKSB7XG4gICAgICAgIHRoaXMuZmFpbHVyZXMucHVzaChhY3Rpdml0eSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN0YXR1cy5lbmRzV2l0aCgnX0NPTVBMRVRFJykgfHwgc3RhdHVzLmVuZHNXaXRoKCdfRkFJTEVEJykpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnJlc291cmNlc0luUHJvZ3Jlc3NbYWN0aXZpdHkuZXZlbnQuTG9naWNhbFJlc291cmNlSWRdO1xuICAgIH1cblxuICAgIGlmIChzdGF0dXMuZW5kc1dpdGgoJ19DT01QTEVURScpKSB7XG4gICAgICBjb25zdCBwcmV2U3RhdGUgPSB0aGlzLnJlc291cmNlc1ByZXZDb21wbGV0ZVN0YXRlW2FjdGl2aXR5LmV2ZW50LkxvZ2ljYWxSZXNvdXJjZUlkXTtcbiAgICAgIGlmICghcHJldlN0YXRlKSB7XG4gICAgICAgIHRoaXMucmVzb3VyY2VzRG9uZSsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSWYgd2UgY29tcGxldGVkIHRoaXMgYmVmb3JlIGFuZCB3ZSdyZSBjb21wbGV0aW5nIGl0IEFHQUlOLCBtZWFucyB3ZSdyZSByb2xsaW5nIGJhY2suXG4gICAgICAgIC8vIFByb3RlY3QgYWdhaW5zdCBzaWxseSB1bmRlcmZsb3cuXG4gICAgICAgIHRoaXMucmVzb3VyY2VzRG9uZS0tO1xuICAgICAgICBpZiAodGhpcy5yZXNvdXJjZXNEb25lIDwgMCkge1xuICAgICAgICAgIHRoaXMucmVzb3VyY2VzRG9uZSA9IDA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMucmVzb3VyY2VzUHJldkNvbXBsZXRlU3RhdGVbYWN0aXZpdHkuZXZlbnQuTG9naWNhbFJlc291cmNlSWRdID0gc3RhdHVzO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhYnN0cmFjdCBwcmludCgpOiB2b2lkO1xuXG4gIHB1YmxpYyBzdGFydCgpIHtcbiAgICAvLyBFbXB0eSBvbiBwdXJwb3NlXG4gIH1cblxuICBwdWJsaWMgc3RvcCgpIHtcbiAgICAvLyBFbXB0eSBvbiBwdXJwb3NlXG4gIH1cbn1cblxuLyoqXG4gKiBBY3Rpdml0eSBQcmludGVyIHdoaWNoIHNob3dzIGEgZnVsbCBsb2cgb2YgYWxsIENsb3VkRm9ybWF0aW9uIGV2ZW50c1xuICpcbiAqIFdoZW4gdGhlcmUgaGFzbid0IGJlZW4gYWN0aXZpdHkgZm9yIGEgd2hpbGUsIGl0IHdpbGwgcHJpbnQgdGhlIHJlc291cmNlc1xuICogdGhhdCBhcmUgY3VycmVudGx5IGluIHByb2dyZXNzLCB0byBzaG93IHdoYXQncyBob2xkaW5nIHVwIHRoZSBkZXBsb3ltZW50LlxuICovXG5leHBvcnQgY2xhc3MgSGlzdG9yeUFjdGl2aXR5UHJpbnRlciBleHRlbmRzIEFjdGl2aXR5UHJpbnRlckJhc2Uge1xuICAvKipcbiAgICogTGFzdCB0aW1lIHdlIHByaW50ZWQgc29tZXRoaW5nIHRvIHRoZSBjb25zb2xlLlxuICAgKlxuICAgKiBVc2VkIHRvIG1lYXN1cmUgdGltZW91dCBmb3IgcHJvZ3Jlc3MgcmVwb3J0aW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBsYXN0UHJpbnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAvKipcbiAgICogTnVtYmVyIG9mIG1zIG9mIGNoYW5nZSBhYnNlbmNlIGJlZm9yZSB3ZSB0ZWxsIHRoZSB1c2VyIGFib3V0IHRoZSByZXNvdXJjZXMgdGhhdCBhcmUgY3VycmVudGx5IGluIHByb2dyZXNzLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBpblByb2dyZXNzRGVsYXkgPSAzMF8wMDA7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBwcmludGFibGUgPSBuZXcgQXJyYXk8U3RhY2tBY3Rpdml0eT4oKTtcblxuICBjb25zdHJ1Y3Rvcihwcm9wczogUHJpbnRlclByb3BzKSB7XG4gICAgc3VwZXIocHJvcHMpO1xuICB9XG5cbiAgcHVibGljIGFkZEFjdGl2aXR5KGFjdGl2aXR5OiBTdGFja0FjdGl2aXR5KSB7XG4gICAgc3VwZXIuYWRkQWN0aXZpdHkoYWN0aXZpdHkpO1xuICAgIHRoaXMucHJpbnRhYmxlLnB1c2goYWN0aXZpdHkpO1xuICB9XG5cbiAgcHVibGljIHByaW50KCkge1xuICAgIGZvciAoY29uc3QgYWN0aXZpdHkgb2YgdGhpcy5wcmludGFibGUpIHtcbiAgICAgIHRoaXMucHJpbnRPbmUoYWN0aXZpdHkpO1xuICAgIH1cbiAgICB0aGlzLnByaW50YWJsZS5zcGxpY2UoMCwgdGhpcy5wcmludGFibGUubGVuZ3RoKTtcbiAgICB0aGlzLnByaW50SW5Qcm9ncmVzcygpO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmludE9uZShhY3Rpdml0eTogU3RhY2tBY3Rpdml0eSkge1xuICAgIGNvbnN0IGUgPSBhY3Rpdml0eS5ldmVudDtcbiAgICBjb25zdCBjb2xvciA9IGNvbG9yRnJvbVN0YXR1c1Jlc3VsdChlLlJlc291cmNlU3RhdHVzKTtcbiAgICBsZXQgcmVhc29uQ29sb3IgPSBjb2xvcnMuY3lhbjtcblxuICAgIGxldCBzdGFja1RyYWNlID0gJyc7XG4gICAgY29uc3QgbWQgPSBhY3Rpdml0eS5tZXRhZGF0YTtcbiAgICBpZiAobWQgJiYgZS5SZXNvdXJjZVN0YXR1cyAmJiBlLlJlc291cmNlU3RhdHVzLmluZGV4T2YoJ0ZBSUxFRCcpICE9PSAtMSkge1xuICAgICAgc3RhY2tUcmFjZSA9IG1kLmVudHJ5LnRyYWNlID8gYFxcblxcdCR7bWQuZW50cnkudHJhY2Uuam9pbignXFxuXFx0XFxcXF8gJyl9YCA6ICcnO1xuICAgICAgcmVhc29uQ29sb3IgPSBjb2xvcnMucmVkO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc291cmNlTmFtZSA9IG1kID8gbWQuY29uc3RydWN0UGF0aCA6IChlLkxvZ2ljYWxSZXNvdXJjZUlkIHx8ICcnKTtcblxuICAgIGNvbnN0IGxvZ2ljYWxJZCA9IHJlc291cmNlTmFtZSAhPT0gZS5Mb2dpY2FsUmVzb3VyY2VJZCA/IGAoJHtlLkxvZ2ljYWxSZXNvdXJjZUlkfSkgYCA6ICcnO1xuXG4gICAgdGhpcy5zdHJlYW0ud3JpdGUodXRpbC5mb3JtYXQoJyAlcyB8ICVzIHwgJXMgfCAlcyB8ICVzICVzJXMlc1xcbicsXG4gICAgICB0aGlzLnByb2dyZXNzKCksXG4gICAgICBuZXcgRGF0ZShlLlRpbWVzdGFtcCkudG9Mb2NhbGVUaW1lU3RyaW5nKCksXG4gICAgICBjb2xvcihwYWRSaWdodChTVEFUVVNfV0lEVEgsIChlLlJlc291cmNlU3RhdHVzIHx8ICcnKS5zdWJzdHIoMCwgU1RBVFVTX1dJRFRIKSkpLCAvLyBwYWQgbGVmdCBhbmQgdHJpbVxuICAgICAgcGFkUmlnaHQodGhpcy5wcm9wcy5yZXNvdXJjZVR5cGVDb2x1bW5XaWR0aCwgZS5SZXNvdXJjZVR5cGUgfHwgJycpLFxuICAgICAgY29sb3IoY29sb3JzLmJvbGQocmVzb3VyY2VOYW1lKSksXG4gICAgICBsb2dpY2FsSWQsXG4gICAgICByZWFzb25Db2xvcihjb2xvcnMuYm9sZChlLlJlc291cmNlU3RhdHVzUmVhc29uID8gZS5SZXNvdXJjZVN0YXR1c1JlYXNvbiA6ICcnKSksXG4gICAgICByZWFzb25Db2xvcihzdGFja1RyYWNlKSkpO1xuXG4gICAgdGhpcy5sYXN0UHJpbnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBvcnQgdGhlIGN1cnJlbnQgcHJvZ3Jlc3MgYXMgYSBbMzQvNDJdIHN0cmluZywgb3IganVzdCBbMzRdIGlmIHRoZSB0b3RhbCBpcyB1bmtub3duXG4gICAqL1xuICBwcml2YXRlIHByb2dyZXNzKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMucmVzb3VyY2VzVG90YWwgPT0gbnVsbCkge1xuICAgICAgLy8gRG9uJ3QgaGF2ZSB0b3RhbCwgc2hvdyBzaW1wbGUgY291bnQgYW5kIGhvcGUgdGhlIGh1bWFuIGtub3dzXG4gICAgICByZXR1cm4gcGFkTGVmdCgzLCB1dGlsLmZvcm1hdCgnJXMnLCB0aGlzLnJlc291cmNlc0RvbmUpKTsgLy8gbWF4IDUwMCByZXNvdXJjZXNcbiAgICB9XG5cbiAgICByZXR1cm4gdXRpbC5mb3JtYXQoJyVzLyVzJyxcbiAgICAgIHBhZExlZnQodGhpcy5yZXNvdXJjZURpZ2l0cywgdGhpcy5yZXNvdXJjZXNEb25lLnRvU3RyaW5nKCkpLFxuICAgICAgcGFkTGVmdCh0aGlzLnJlc291cmNlRGlnaXRzLCB0aGlzLnJlc291cmNlc1RvdGFsICE9IG51bGwgPyB0aGlzLnJlc291cmNlc1RvdGFsLnRvU3RyaW5nKCkgOiAnPycpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiBzb21lIHJlc291cmNlcyBhcmUgdGFraW5nIGEgd2hpbGUgdG8gY3JlYXRlLCBub3RpZnkgdGhlIHVzZXIgYWJvdXQgd2hhdCdzIGN1cnJlbnRseSBpbiBwcm9ncmVzc1xuICAgKi9cbiAgcHJpdmF0ZSBwcmludEluUHJvZ3Jlc3MoKSB7XG4gICAgaWYgKERhdGUubm93KCkgPCB0aGlzLmxhc3RQcmludFRpbWUgKyB0aGlzLmluUHJvZ3Jlc3NEZWxheSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLnJlc291cmNlc0luUHJvZ3Jlc3MpLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuc3RyZWFtLndyaXRlKHV0aWwuZm9ybWF0KCclcyBDdXJyZW50bHkgaW4gcHJvZ3Jlc3M6ICVzXFxuJyxcbiAgICAgICAgdGhpcy5wcm9ncmVzcygpLFxuICAgICAgICBjb2xvcnMuYm9sZChPYmplY3Qua2V5cyh0aGlzLnJlc291cmNlc0luUHJvZ3Jlc3MpLmpvaW4oJywgJykpKSk7XG4gICAgfVxuXG4gICAgLy8gV2UgY2hlYXQgYSBiaXQgaGVyZS4gVG8gcHJldmVudCBwcmludEluUHJvZ3Jlc3MoKSBmcm9tIHJlcGVhdGVkbHkgdHJpZ2dlcmluZyxcbiAgICAvLyB3ZSBzZXQgdGhlIHRpbWVzdGFtcCBpbnRvIHRoZSBmdXR1cmUuIEl0IHdpbGwgYmUgcmVzZXQgd2hlbmV2ZXIgYSByZWd1bGFyIHByaW50XG4gICAgLy8gb2NjdXJzLCBhZnRlciB3aGljaCB3ZSBjYW4gYmUgdHJpZ2dlcmVkIGFnYWluLlxuICAgIHRoaXMubGFzdFByaW50VGltZSA9ICtJbmZpbml0eTtcbiAgfVxuXG59XG5cbi8qKlxuICogQWN0aXZpdHkgUHJpbnRlciB3aGljaCBzaG93cyB0aGUgcmVzb3VyY2VzIGN1cnJlbnRseSBiZWluZyB1cGRhdGVkXG4gKlxuICogSXQgd2lsbCBjb250aW51b3VzbHkgcmV1cGRhdGUgdGhlIHRlcm1pbmFsIGFuZCBzaG93IG9ubHkgdGhlIHJlc291cmNlc1xuICogdGhhdCBhcmUgY3VycmVudGx5IGJlaW5nIHVwZGF0ZWQsIGluIGFkZGl0aW9uIHRvIGEgcHJvZ3Jlc3MgYmFyIHdoaWNoXG4gKiBzaG93cyBob3cgZmFyIGFsb25nIHRoZSBkZXBsb3ltZW50IGlzLlxuICpcbiAqIFJlc291cmNlcyB0aGF0IGhhdmUgZmFpbGVkIHdpbGwgYWx3YXlzIGJlIHNob3duLCBhbmQgd2lsbCBiZSByZWNhcGl0dWxhdGVkXG4gKiBhbG9uZyB3aXRoIHRoZWlyIHN0YWNrIHRyYWNlIHdoZW4gdGhlIG1vbml0b3JpbmcgZW5kcy5cbiAqXG4gKiBSZXNvdXJjZXMgdGhhdCBmYWlsZWQgZGVwbG95bWVudCBiZWNhdXNlIHRoZXkgaGF2ZSBiZWVuIGNhbmNlbGxlZCBhcmVcbiAqIG5vdCBpbmNsdWRlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIEN1cnJlbnRBY3Rpdml0eVByaW50ZXIgZXh0ZW5kcyBBY3Rpdml0eVByaW50ZXJCYXNlIHtcbiAgLyoqXG4gICAqIFRoaXMgbG9va3MgdmVyeSBkaXNvcmllbnRpbmcgc2xlZXBpbmcgZm9yIDUgc2Vjb25kcy4gVXBkYXRlIHF1aWNrZXIuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgdXBkYXRlU2xlZXA6IG51bWJlciA9IDJfMDAwO1xuXG4gIHByaXZhdGUgb2xkTG9nTGV2ZWw6IExvZ0xldmVsID0gTG9nTGV2ZWwuREVGQVVMVDtcbiAgcHJpdmF0ZSBibG9jayA9IG5ldyBSZXdyaXRhYmxlQmxvY2sodGhpcy5zdHJlYW0pO1xuXG4gIGNvbnN0cnVjdG9yKHByb3BzOiBQcmludGVyUHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gIH1cblxuICBwdWJsaWMgcHJpbnQoKTogdm9pZCB7XG4gICAgY29uc3QgbGluZXMgPSBbXTtcblxuICAgIC8vIEFkZCBhIHByb2dyZXNzIGJhciBhdCB0aGUgdG9wXG4gICAgY29uc3QgcHJvZ3Jlc3NXaWR0aCA9IE1hdGgubWF4KE1hdGgubWluKCh0aGlzLmJsb2NrLndpZHRoID8/IDgwKSAtIFBST0dSRVNTQkFSX0VYVFJBX1NQQUNFIC0gMSwgTUFYX1BST0dSRVNTQkFSX1dJRFRIKSwgTUlOX1BST0dSRVNTQkFSX1dJRFRIKTtcbiAgICBjb25zdCBwcm9nID0gdGhpcy5wcm9ncmVzc0Jhcihwcm9ncmVzc1dpZHRoKTtcbiAgICBpZiAocHJvZykge1xuICAgICAgbGluZXMucHVzaCgnICAnICsgcHJvZywgJycpO1xuICAgIH1cblxuICAgIC8vIE5vcm1hbGx5IHdlJ2Qgb25seSBwcmludCBcInJlc291cmNlcyBpbiBwcm9ncmVzc1wiLCBidXQgaXQncyBhbHNvIHVzZWZ1bFxuICAgIC8vIHRvIGtlZXAgYW4gZXllIG9uIHRoZSBmYWlsdXJlcyBhbmQga25vdyBhYm91dCB0aGUgc3BlY2lmaWMgZXJyb3JzIGFzcXVpY2tseVxuICAgIC8vIGFzIHBvc3NpYmxlICh3aGlsZSB0aGUgc3RhY2sgaXMgc3RpbGwgcm9sbGluZyBiYWNrKSwgc28gYWRkIHRob3NlIGluLlxuICAgIGNvbnN0IHRvUHJpbnQ6IFN0YWNrQWN0aXZpdHlbXSA9IFsuLi50aGlzLmZhaWx1cmVzLCAuLi5PYmplY3QudmFsdWVzKHRoaXMucmVzb3VyY2VzSW5Qcm9ncmVzcyldO1xuICAgIHRvUHJpbnQuc29ydCgoYSwgYikgPT4gYS5ldmVudC5UaW1lc3RhbXAuZ2V0VGltZSgpIC0gYi5ldmVudC5UaW1lc3RhbXAuZ2V0VGltZSgpKTtcblxuICAgIGxpbmVzLnB1c2goLi4udG9QcmludC5tYXAocmVzID0+IHtcbiAgICAgIGNvbnN0IGNvbG9yID0gY29sb3JGcm9tU3RhdHVzQWN0aXZpdHkocmVzLmV2ZW50LlJlc291cmNlU3RhdHVzKTtcbiAgICAgIGNvbnN0IHJlc291cmNlTmFtZSA9IHJlcy5tZXRhZGF0YT8uY29uc3RydWN0UGF0aCA/PyByZXMuZXZlbnQuTG9naWNhbFJlc291cmNlSWQgPz8gJyc7XG5cbiAgICAgIHJldHVybiB1dGlsLmZvcm1hdCgnJXMgfCAlcyB8ICVzIHwgJXMlcycsXG4gICAgICAgIHBhZExlZnQoVElNRVNUQU1QX1dJRFRILCBuZXcgRGF0ZShyZXMuZXZlbnQuVGltZXN0YW1wKS50b0xvY2FsZVRpbWVTdHJpbmcoKSksXG4gICAgICAgIGNvbG9yKHBhZFJpZ2h0KFNUQVRVU19XSURUSCwgKHJlcy5ldmVudC5SZXNvdXJjZVN0YXR1cyB8fCAnJykuc3Vic3RyKDAsIFNUQVRVU19XSURUSCkpKSxcbiAgICAgICAgcGFkUmlnaHQodGhpcy5wcm9wcy5yZXNvdXJjZVR5cGVDb2x1bW5XaWR0aCwgcmVzLmV2ZW50LlJlc291cmNlVHlwZSB8fCAnJyksXG4gICAgICAgIGNvbG9yKGNvbG9ycy5ib2xkKHNob3J0ZW4oNDAsIHJlc291cmNlTmFtZSkpKSxcbiAgICAgICAgdGhpcy5mYWlsdXJlUmVhc29uT25OZXh0TGluZShyZXMpKTtcbiAgICB9KSk7XG5cbiAgICB0aGlzLmJsb2NrLmRpc3BsYXlMaW5lcyhsaW5lcyk7XG4gIH1cblxuICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgLy8gTmVlZCB0byBwcmV2ZW50IHRoZSB3YWl0ZXIgZnJvbSBwcmludGluZyAnc3RhY2sgbm90IHN0YWJsZScgZXZlcnkgNSBzZWNvbmRzLCBpdCBtZXNzZXNcbiAgICAvLyB3aXRoIHRoZSBvdXRwdXQgY2FsY3VsYXRpb25zLlxuICAgIHRoaXMub2xkTG9nTGV2ZWwgPSBsb2dMZXZlbDtcbiAgICBzZXRMb2dMZXZlbChMb2dMZXZlbC5ERUZBVUxUKTtcbiAgfVxuXG4gIHB1YmxpYyBzdG9wKCkge1xuICAgIHNldExvZ0xldmVsKHRoaXMub2xkTG9nTGV2ZWwpO1xuXG4gICAgLy8gUHJpbnQgZmFpbHVyZXMgYXQgdGhlIGVuZFxuICAgIGNvbnN0IGxpbmVzID0gbmV3IEFycmF5PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IGZhaWx1cmUgb2YgdGhpcy5mYWlsdXJlcykge1xuICAgICAgbGluZXMucHVzaCh1dGlsLmZvcm1hdChjb2xvcnMucmVkKCclcyB8ICVzIHwgJXMgfCAlcyVzJykgKyAnXFxuJyxcbiAgICAgICAgcGFkTGVmdChUSU1FU1RBTVBfV0lEVEgsIG5ldyBEYXRlKGZhaWx1cmUuZXZlbnQuVGltZXN0YW1wKS50b0xvY2FsZVRpbWVTdHJpbmcoKSksXG4gICAgICAgIHBhZFJpZ2h0KFNUQVRVU19XSURUSCwgKGZhaWx1cmUuZXZlbnQuUmVzb3VyY2VTdGF0dXMgfHwgJycpLnN1YnN0cigwLCBTVEFUVVNfV0lEVEgpKSxcbiAgICAgICAgcGFkUmlnaHQodGhpcy5wcm9wcy5yZXNvdXJjZVR5cGVDb2x1bW5XaWR0aCwgZmFpbHVyZS5ldmVudC5SZXNvdXJjZVR5cGUgfHwgJycpLFxuICAgICAgICBzaG9ydGVuKDQwLCBmYWlsdXJlLmV2ZW50LkxvZ2ljYWxSZXNvdXJjZUlkID8/ICcnKSxcbiAgICAgICAgdGhpcy5mYWlsdXJlUmVhc29uT25OZXh0TGluZShmYWlsdXJlKSkpO1xuXG4gICAgICBjb25zdCB0cmFjZSA9IGZhaWx1cmUubWV0YWRhdGE/LmVudHJ5Py50cmFjZTtcbiAgICAgIGlmICh0cmFjZSkge1xuICAgICAgICBsaW5lcy5wdXNoKGNvbG9ycy5yZWQoYFxcdCR7dHJhY2Uuam9pbignXFxuXFx0XFxcXF8gJyl9XFxuYCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIERpc3BsYXkgaW4gdGhlIHNhbWUgYmxvY2sgc3BhY2UsIG90aGVyd2lzZSB3ZSdyZSBnb2luZyB0byBoYXZlIHNpbGx5IGVtcHR5IGxpbmVzLlxuICAgIHRoaXMuYmxvY2suZGlzcGxheUxpbmVzKGxpbmVzKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJvZ3Jlc3NCYXIod2lkdGg6IG51bWJlcikge1xuICAgIGlmICghdGhpcy5yZXNvdXJjZXNUb3RhbCkgeyByZXR1cm4gJyc7IH1cbiAgICBjb25zdCBmcmFjdGlvbiA9IE1hdGgubWluKHRoaXMucmVzb3VyY2VzRG9uZSAvIHRoaXMucmVzb3VyY2VzVG90YWwsIDEpO1xuICAgIGNvbnN0IGlubmVyV2lkdGggPSBNYXRoLm1heCgxLCB3aWR0aCAtIDIpO1xuICAgIGNvbnN0IGNoYXJzID0gaW5uZXJXaWR0aCAqIGZyYWN0aW9uO1xuICAgIGNvbnN0IHJlbWFpbmRlciA9IGNoYXJzIC0gTWF0aC5mbG9vcihjaGFycyk7XG5cbiAgICBjb25zdCBmdWxsQ2hhcnMgPSBGVUxMX0JMT0NLLnJlcGVhdChNYXRoLmZsb29yKGNoYXJzKSk7XG4gICAgY29uc3QgcGFydGlhbENoYXIgPSBQQVJUSUFMX0JMT0NLW01hdGguZmxvb3IocmVtYWluZGVyICogUEFSVElBTF9CTE9DSy5sZW5ndGgpXTtcbiAgICBjb25zdCBmaWxsZXIgPSAnwrcnLnJlcGVhdChpbm5lcldpZHRoIC0gTWF0aC5mbG9vcihjaGFycykgLSAocGFydGlhbENoYXIgPyAxIDogMCkpO1xuXG4gICAgY29uc3QgY29sb3IgPSB0aGlzLnJvbGxpbmdCYWNrID8gY29sb3JzLnllbGxvdyA6IGNvbG9ycy5ncmVlbjtcblxuICAgIHJldHVybiAnWycgKyBjb2xvcihmdWxsQ2hhcnMgKyBwYXJ0aWFsQ2hhcikgKyBmaWxsZXIgKyBgXSAoJHt0aGlzLnJlc291cmNlc0RvbmV9LyR7dGhpcy5yZXNvdXJjZXNUb3RhbH0pYDtcbiAgfVxuXG4gIHByaXZhdGUgZmFpbHVyZVJlYXNvbk9uTmV4dExpbmUoYWN0aXZpdHk6IFN0YWNrQWN0aXZpdHkpIHtcbiAgICByZXR1cm4gaGFzRXJyb3JNZXNzYWdlKGFjdGl2aXR5LmV2ZW50LlJlc291cmNlU3RhdHVzID8/ICcnKVxuICAgICAgPyBgXFxuJHsnICcucmVwZWF0KFRJTUVTVEFNUF9XSURUSCArIFNUQVRVU19XSURUSCArIDYpfSR7Y29sb3JzLnJlZChhY3Rpdml0eS5ldmVudC5SZXNvdXJjZVN0YXR1c1JlYXNvbiA/PyAnJyl9YFxuICAgICAgOiAnJztcbiAgfVxufVxuXG5jb25zdCBGVUxMX0JMT0NLID0gJ+KWiCc7XG5jb25zdCBQQVJUSUFMX0JMT0NLID0gWycnLCAn4paPJywgJ+KWjicsICfilo0nLCAn4paMJywgJ+KWiycsICfiloonLCAn4paJJ107XG5jb25zdCBNQVhfUFJPR1JFU1NCQVJfV0lEVEggPSA2MDtcbmNvbnN0IE1JTl9QUk9HUkVTU0JBUl9XSURUSCA9IDEwO1xuY29uc3QgUFJPR1JFU1NCQVJfRVhUUkFfU1BBQ0UgPSAyIC8qIGxlYWRpbmcgc3BhY2VzICovICsgMiAvKiBicmFja2V0cyAqLyArIDQgLyogcHJvZ3Jlc3MgbnVtYmVyIGRlY29yYXRpb24gKi8gKyA2IC8qIDIgcHJvZ3Jlc3MgbnVtYmVycyB1cCB0byA5OTkgKi87XG5cbmZ1bmN0aW9uIGhhc0Vycm9yTWVzc2FnZShzdGF0dXM6IHN0cmluZykge1xuICByZXR1cm4gc3RhdHVzLmVuZHNXaXRoKCdfRkFJTEVEJykgfHwgc3RhdHVzID09PSAnUk9MTEJBQ0tfSU5fUFJPR1JFU1MnIHx8IHN0YXR1cyA9PT0gJ1VQREFURV9ST0xMQkFDS19JTl9QUk9HUkVTUyc7XG59XG5cbmZ1bmN0aW9uIGNvbG9yRnJvbVN0YXR1c1Jlc3VsdChzdGF0dXM/OiBzdHJpbmcpIHtcbiAgaWYgKCFzdGF0dXMpIHtcbiAgICByZXR1cm4gY29sb3JzLnJlc2V0O1xuICB9XG5cbiAgaWYgKHN0YXR1cy5pbmRleE9mKCdGQUlMRUQnKSAhPT0gLTEpIHtcbiAgICByZXR1cm4gY29sb3JzLnJlZDtcbiAgfVxuICBpZiAoc3RhdHVzLmluZGV4T2YoJ1JPTExCQUNLJykgIT09IC0xKSB7XG4gICAgcmV0dXJuIGNvbG9ycy55ZWxsb3c7XG4gIH1cbiAgaWYgKHN0YXR1cy5pbmRleE9mKCdDT01QTEVURScpICE9PSAtMSkge1xuICAgIHJldHVybiBjb2xvcnMuZ3JlZW47XG4gIH1cblxuICByZXR1cm4gY29sb3JzLnJlc2V0O1xufVxuXG5mdW5jdGlvbiBjb2xvckZyb21TdGF0dXNBY3Rpdml0eShzdGF0dXM/OiBzdHJpbmcpIHtcbiAgaWYgKCFzdGF0dXMpIHtcbiAgICByZXR1cm4gY29sb3JzLnJlc2V0O1xuICB9XG5cbiAgaWYgKHN0YXR1cy5lbmRzV2l0aCgnX0ZBSUxFRCcpKSB7XG4gICAgcmV0dXJuIGNvbG9ycy5yZWQ7XG4gIH1cblxuICBpZiAoc3RhdHVzLnN0YXJ0c1dpdGgoJ0NSRUFURV8nKSB8fCBzdGF0dXMuc3RhcnRzV2l0aCgnVVBEQVRFXycpKSB7XG4gICAgcmV0dXJuIGNvbG9ycy5ncmVlbjtcbiAgfVxuICAvLyBGb3Igc3RhY2tzLCBpdCBtYXkgYWxzbyBiZSAnVVBEREFURV9ST0xMQkFDS19JTl9QUk9HUkVTUydcbiAgaWYgKHN0YXR1cy5pbmRleE9mKCdST0xMQkFDS18nKSAhPT0gLTEpIHtcbiAgICByZXR1cm4gY29sb3JzLnllbGxvdztcbiAgfVxuICBpZiAoc3RhdHVzLnN0YXJ0c1dpdGgoJ0RFTEVURV8nKSkge1xuICAgIHJldHVybiBjb2xvcnMueWVsbG93O1xuICB9XG5cbiAgcmV0dXJuIGNvbG9ycy5yZXNldDtcbn1cblxuZnVuY3Rpb24gc2hvcnRlbihtYXhXaWR0aDogbnVtYmVyLCBwOiBzdHJpbmcpIHtcbiAgaWYgKHAubGVuZ3RoIDw9IG1heFdpZHRoKSB7IHJldHVybiBwOyB9XG4gIGNvbnN0IGhhbGYgPSBNYXRoLmZsb29yKChtYXhXaWR0aCAtIDMpIC8gMik7XG4gIHJldHVybiBwLnN1YnN0cigwLCBoYWxmKSArICcuLi4nICsgcC5zdWJzdHIocC5sZW5ndGggLSBoYWxmKTtcbn1cblxuY29uc3QgVElNRVNUQU1QX1dJRFRIID0gMTI7XG5jb25zdCBTVEFUVVNfV0lEVEggPSAyMDtcbiJdfQ==