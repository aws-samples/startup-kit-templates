import * as yargs from 'yargs';
import { CommandOptions } from '../command-api';
export declare const command = "doctor";
export declare const describe = "Check your set-up for potential problems";
export declare const builder: {};
export declare function handler(args: yargs.Arguments): void;
export declare function realHandler(_options: CommandOptions): Promise<number>;
