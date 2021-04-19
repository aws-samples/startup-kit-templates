import * as yargs from 'yargs';
import { CommandOptions } from '../command-api';
export declare const command = "docs";
export declare const describe = "Opens the reference documentation in a browser";
export declare const aliases: string[];
export declare const builder: {
    browser: {
        alias: string;
        desc: string;
        type: string;
        default: string | undefined;
    };
};
export interface Arguments extends yargs.Arguments {
    browser: string;
}
export declare function handler(args: yargs.Arguments): void;
export declare function realHandler(options: CommandOptions): Promise<number>;
