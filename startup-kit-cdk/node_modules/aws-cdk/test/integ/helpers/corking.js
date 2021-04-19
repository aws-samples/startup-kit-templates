"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStream = void 0;
/**
 * Routines for corking stdout and stderr
 */
const stream = require("stream");
class MemoryStream extends stream.Writable {
    constructor() {
        super(...arguments);
        this.parts = new Array();
    }
    _write(chunk, _encoding, callback) {
        this.parts.push(chunk);
        callback();
    }
    buffer() {
        return Buffer.concat(this.parts);
    }
    clear() {
        this.parts.splice(0, this.parts.length);
    }
    async flushTo(strm) {
        const flushed = strm.write(this.buffer());
        if (!flushed) {
            return new Promise(ok => strm.once('drain', ok));
        }
    }
}
exports.MemoryStream = MemoryStream;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29ya2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvcmtpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxpQ0FBaUM7QUFFakMsTUFBYSxZQUFhLFNBQVEsTUFBTSxDQUFDLFFBQVE7SUFBakQ7O1FBQ1UsVUFBSyxHQUFHLElBQUksS0FBSyxFQUFVLENBQUM7SUFxQnRDLENBQUM7SUFuQlEsTUFBTSxDQUFDLEtBQWEsRUFBRSxTQUFpQixFQUFFLFFBQXdDO1FBQ3RGLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3ZCLFFBQVEsRUFBRSxDQUFDO0lBQ2IsQ0FBQztJQUVNLE1BQU07UUFDWCxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTSxLQUFLO1FBQ1YsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVNLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBMkI7UUFDOUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ1osT0FBTyxJQUFJLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDbEQ7SUFDSCxDQUFDO0NBQ0Y7QUF0QkQsb0NBc0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSb3V0aW5lcyBmb3IgY29ya2luZyBzdGRvdXQgYW5kIHN0ZGVyclxuICovXG5pbXBvcnQgKiBhcyBzdHJlYW0gZnJvbSAnc3RyZWFtJztcblxuZXhwb3J0IGNsYXNzIE1lbW9yeVN0cmVhbSBleHRlbmRzIHN0cmVhbS5Xcml0YWJsZSB7XG4gIHByaXZhdGUgcGFydHMgPSBuZXcgQXJyYXk8QnVmZmVyPigpO1xuXG4gIHB1YmxpYyBfd3JpdGUoY2h1bms6IEJ1ZmZlciwgX2VuY29kaW5nOiBzdHJpbmcsIGNhbGxiYWNrOiAoZXJyb3I/OiBFcnJvciB8IG51bGwpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLnBhcnRzLnB1c2goY2h1bmspO1xuICAgIGNhbGxiYWNrKCk7XG4gIH1cblxuICBwdWJsaWMgYnVmZmVyKCkge1xuICAgIHJldHVybiBCdWZmZXIuY29uY2F0KHRoaXMucGFydHMpO1xuICB9XG5cbiAgcHVibGljIGNsZWFyKCkge1xuICAgIHRoaXMucGFydHMuc3BsaWNlKDAsIHRoaXMucGFydHMubGVuZ3RoKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBmbHVzaFRvKHN0cm06IE5vZGVKUy5Xcml0YWJsZVN0cmVhbSkge1xuICAgIGNvbnN0IGZsdXNoZWQgPSBzdHJtLndyaXRlKHRoaXMuYnVmZmVyKCkpO1xuICAgIGlmICghZmx1c2hlZCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKG9rID0+IHN0cm0ub25jZSgnZHJhaW4nLCBvaykpO1xuICAgIH1cbiAgfVxufVxuIl19