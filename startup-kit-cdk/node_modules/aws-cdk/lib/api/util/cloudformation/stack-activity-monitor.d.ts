/// <reference types="node" />
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as aws from 'aws-sdk';
import { LogLevel } from '../../../logging';
export interface StackActivity {
    readonly event: aws.CloudFormation.StackEvent;
    readonly metadata?: ResourceMetadata;
}
export interface ResourceMetadata {
    entry: cxschema.MetadataEntry;
    constructPath: string;
}
/**
 * Supported display modes for stack deployment activity
 */
export declare enum StackActivityProgress {
    /**
     * Displays a progress bar with only the events for the resource currently being deployed
     */
    BAR = "bar",
    /**
     * Displays complete history with all CloudFormation stack events
     */
    EVENTS = "events"
}
export interface WithDefaultPrinterProps {
    /**
     * Total number of resources to update
     *
     * Used to calculate a progress bar.
     *
     * @default - No progress reporting.
     */
    readonly resourcesTotal?: number;
    /**
     * The log level that was requested in the CLI
     *
     * If verbose or trace is requested, we'll always use the full history printer.
     *
     * @default - Use value from logging.logLevel
     */
    readonly logLevel?: LogLevel;
    /**
     * Whether to display all stack events or to display only the events for the
     * resource currently being deployed
     *
     * If not set, the stack history with all stack events will be displayed
     *
     * @default false
     */
    progress?: StackActivityProgress;
    /**
     * Whether we are on a CI system
     *
     * If so, disable the "optimized" stack monitor.
     *
     * @default false
     */
    readonly ci?: boolean;
    /**
     * Creation time of the change set
     *
     * This will be used to filter events, only showing those from after the change
     * set creation time.
     *
     * It is recommended to use this, otherwise the filtering will be subject
     * to clock drift between local and cloud machines.
     *
     * @default - local machine's current time
     */
    readonly changeSetCreationTime?: Date;
}
export declare class StackActivityMonitor {
    private readonly cfn;
    private readonly stackName;
    private readonly printer;
    private readonly stack?;
    /**
     * Create a Stack Activity Monitor using a default printer, based on context clues
     */
    static withDefaultPrinter(cfn: aws.CloudFormation, stackName: string, stackArtifact: cxapi.CloudFormationStackArtifact, options?: WithDefaultPrinterProps): StackActivityMonitor;
    private active;
    private activity;
    /**
     * Determines which events not to display
     */
    private readonly startTime;
    /**
     * Current tick timer
     */
    private tickTimer?;
    /**
     * Set to the activity of reading the current events
     */
    private readPromise?;
    constructor(cfn: aws.CloudFormation, stackName: string, printer: IActivityPrinter, stack?: cxapi.CloudFormationStackArtifact | undefined, changeSetCreationTime?: Date);
    start(): this;
    stop(): Promise<void>;
    private scheduleNextTick;
    private tick;
    private findMetadataFor;
    /**
     * Reads all new events from the stack history
     *
     * The events are returned in reverse chronological order; we continue to the next page if we
     * see a next page and the last event in the page is new to us (and within the time window).
     * haven't seen the final event
     */
    private readNewEvents;
    /**
     * Perform a final poll to the end and flush out all events to the printer
     *
     * Finish any poll currently in progress, then do a final one until we've
     * reached the last page.
     */
    private finalPollToEnd;
    private simplifyConstructPath;
}
interface PrinterProps {
    /**
     * Total resources to deploy
     */
    readonly resourcesTotal?: number;
    /**
     * The with of the "resource type" column.
     */
    readonly resourceTypeColumnWidth: number;
    /**
     * Stream to write to
     */
    readonly stream: NodeJS.WriteStream;
}
export interface IActivityPrinter {
    readonly updateSleep: number;
    addActivity(activity: StackActivity): void;
    print(): void;
    start(): void;
    stop(): void;
}
declare abstract class ActivityPrinterBase implements IActivityPrinter {
    protected readonly props: PrinterProps;
    /**
     * Fetch new activity every 5 seconds
     */
    readonly updateSleep: number;
    /**
     * A list of resource IDs which are currently being processed
     */
    protected resourcesInProgress: Record<string, StackActivity>;
    /**
     * Previous completion state observed by logical ID
     *
     * We use this to detect that if we see a DELETE_COMPLETE after a
     * CREATE_COMPLETE, it's actually a rollback and we should DECREASE
     * resourcesDone instead of increase it
     */
    protected resourcesPrevCompleteState: Record<string, string>;
    /**
     * Count of resources that have reported a _COMPLETE status
     */
    protected resourcesDone: number;
    /**
     * How many digits we need to represent the total count (for lining up the status reporting)
     */
    protected readonly resourceDigits: number;
    protected readonly resourcesTotal?: number;
    protected rollingBack: boolean;
    protected readonly failures: StackActivity[];
    protected readonly stream: NodeJS.WriteStream;
    constructor(props: PrinterProps);
    addActivity(activity: StackActivity): void;
    abstract print(): void;
    start(): void;
    stop(): void;
}
/**
 * Activity Printer which shows a full log of all CloudFormation events
 *
 * When there hasn't been activity for a while, it will print the resources
 * that are currently in progress, to show what's holding up the deployment.
 */
export declare class HistoryActivityPrinter extends ActivityPrinterBase {
    /**
     * Last time we printed something to the console.
     *
     * Used to measure timeout for progress reporting.
     */
    private lastPrintTime;
    /**
     * Number of ms of change absence before we tell the user about the resources that are currently in progress.
     */
    private readonly inProgressDelay;
    private readonly printable;
    constructor(props: PrinterProps);
    addActivity(activity: StackActivity): void;
    print(): void;
    private printOne;
    /**
     * Report the current progress as a [34/42] string, or just [34] if the total is unknown
     */
    private progress;
    /**
     * If some resources are taking a while to create, notify the user about what's currently in progress
     */
    private printInProgress;
}
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
export declare class CurrentActivityPrinter extends ActivityPrinterBase {
    /**
     * This looks very disorienting sleeping for 5 seconds. Update quicker.
     */
    readonly updateSleep: number;
    private oldLogLevel;
    private block;
    constructor(props: PrinterProps);
    print(): void;
    start(): void;
    stop(): void;
    private progressBar;
    private failureReasonOnNextLine;
}
export {};
