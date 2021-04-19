export declare let logLevel: LogLevel;
export declare function setLogLevel(newLogLevel: LogLevel): void;
export declare function increaseVerbosity(): void;
export declare const trace: (fmt: string, ...args: any) => false | void;
export declare const debug: (fmt: string, ...args: any[]) => false | void;
export declare const error: (fmt: string, ...args: any[]) => void;
export declare const warning: (fmt: string, ...args: any[]) => void;
export declare const success: (fmt: string, ...args: any[]) => void;
export declare const highlight: (fmt: string, ...args: any[]) => void;
export declare const print: (fmt: string, ...args: any[]) => void;
export declare const data: (fmt: string, ...args: any[]) => void;
export declare type LoggerFunction = (fmt: string, ...args: any[]) => void;
/**
 * Create a logger output that features a constant prefix string.
 *
 * @param prefixString the prefix string to be appended before any log entry.
 * @param fn   the logger function to be used (typically one of the other functions in this module)
 *
 * @returns a new LoggerFunction.
 */
export declare function prefix(prefixString: string, fn: LoggerFunction): LoggerFunction;
export declare const enum LogLevel {
    /** Not verbose at all */
    DEFAULT = 0,
    /** Pretty verbose */
    DEBUG = 1,
    /** Extremely verbose */
    TRACE = 2
}
