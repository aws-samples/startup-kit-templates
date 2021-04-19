/// <reference types="node" />
/**
 * Routines for corking stdout and stderr
 */
import * as stream from 'stream';
export declare class MemoryStream extends stream.Writable {
    private parts;
    _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void;
    buffer(): Buffer;
    clear(): void;
    flushTo(strm: NodeJS.WritableStream): Promise<unknown>;
}
