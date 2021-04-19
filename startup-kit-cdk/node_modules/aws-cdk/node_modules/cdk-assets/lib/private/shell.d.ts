/// <reference types="node" />
import * as child_process from 'child_process';
export declare type Logger = (x: string) => void;
export interface ShellOptions extends child_process.SpawnOptions {
    readonly quiet?: boolean;
    readonly logger?: Logger;
    readonly input?: string;
}
/**
 * OS helpers
 *
 * Shell function which both prints to stdout and collects the output into a
 * string.
 */
export declare function shell(command: string[], options?: ShellOptions): Promise<string>;
