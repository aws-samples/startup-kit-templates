import * as yargs from 'yargs';
import { CommandOptions } from '../command-api';
export declare const command = "context";
export declare const describe = "Manage cached context values";
export declare const builder: {
    reset: {
        alias: string;
        desc: string;
        type: string;
        requiresArg: boolean;
    };
    clear: {
        desc: string;
        type: string;
    };
};
export declare function handler(args: yargs.Arguments): void;
export declare function realHandler(options: CommandOptions): Promise<number>;
