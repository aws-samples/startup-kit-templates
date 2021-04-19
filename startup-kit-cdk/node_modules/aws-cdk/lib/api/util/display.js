"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewritableBlock = void 0;
const wrapAnsi = require("wrap-ansi");
/**
 * A class representing rewritable display lines
 */
class RewritableBlock {
    constructor(stream) {
        this.stream = stream;
        this.lastHeight = 0;
    }
    get width() {
        // Might get changed if the user resizes the terminal
        return this.stream.columns;
    }
    displayLines(lines) {
        lines = terminalWrap(this.width, expandNewlines(lines));
        this.stream.write(cursorUp(this.lastHeight));
        for (const line of lines) {
            this.stream.write(cll() + line + '\n');
        }
        // Clear remainder of unwritten lines
        for (let i = 0; i < this.lastHeight - lines.length; i++) {
            this.stream.write(cll() + '\n');
        }
        // The block can only ever get bigger
        this.lastHeight = Math.max(this.lastHeight, lines.length);
    }
}
exports.RewritableBlock = RewritableBlock;
const ESC = '\u001b';
/*
 * Move cursor up `n` lines. Default is 1
 */
function cursorUp(n) {
    n = typeof n === 'number' ? n : 1;
    return n > 0 ? ESC + '[' + n + 'A' : '';
}
/**
 * Clear to end of line
 */
function cll() {
    return ESC + '[K';
}
function terminalWrap(width, lines) {
    if (width === undefined) {
        return lines;
    }
    const ret = new Array();
    for (const line of lines) {
        ret.push(...wrapAnsi(line, width - 1, {
            hard: true,
            trim: true,
            wordWrap: false,
        }).split('\n'));
    }
    return ret;
}
/**
 * Make sure there are no hidden newlines in the gin strings
 */
function expandNewlines(lines) {
    const ret = new Array();
    for (const line of lines) {
        ret.push(...line.split('\n'));
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzcGxheS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpc3BsYXkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsc0NBQXNDO0FBRXRDOztHQUVHO0FBQ0gsTUFBYSxlQUFlO0lBRzFCLFlBQTZCLE1BQTBCO1FBQTFCLFdBQU0sR0FBTixNQUFNLENBQW9CO1FBRi9DLGVBQVUsR0FBRyxDQUFDLENBQUM7SUFHdkIsQ0FBQztJQUVELElBQVcsS0FBSztRQUNkLHFEQUFxRDtRQUNyRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQzdCLENBQUM7SUFFTSxZQUFZLENBQUMsS0FBZTtRQUNqQyxLQUFLLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFeEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzdDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQztTQUN4QztRQUNELHFDQUFxQztRQUNyQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3ZELElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1NBQ2pDO1FBRUQscUNBQXFDO1FBQ3JDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM1RCxDQUFDO0NBQ0Y7QUExQkQsMENBMEJDO0FBRUQsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDO0FBRXJCOztHQUVHO0FBQ0gsU0FBUyxRQUFRLENBQUMsQ0FBUztJQUN6QixDQUFDLEdBQUcsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQzFDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsR0FBRztJQUNWLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQztBQUNwQixDQUFDO0FBRUQsU0FBUyxZQUFZLENBQUMsS0FBeUIsRUFBRSxLQUFlO0lBQzlELElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtRQUFFLE9BQU8sS0FBSyxDQUFDO0tBQUU7SUFFMUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLEVBQVUsQ0FBQztJQUNoQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRTtRQUN4QixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFO1lBQ3BDLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7WUFDVixRQUFRLEVBQUUsS0FBSztTQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDakI7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLEtBQWU7SUFDckMsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLEVBQVUsQ0FBQztJQUNoQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRTtRQUN4QixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQy9CO0lBQ0QsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgd3JhcEFuc2kgZnJvbSAnd3JhcC1hbnNpJztcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudGluZyByZXdyaXRhYmxlIGRpc3BsYXkgbGluZXNcbiAqL1xuZXhwb3J0IGNsYXNzIFJld3JpdGFibGVCbG9jayB7XG4gIHByaXZhdGUgbGFzdEhlaWdodCA9IDA7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBzdHJlYW06IE5vZGVKUy5Xcml0ZVN0cmVhbSkge1xuICB9XG5cbiAgcHVibGljIGdldCB3aWR0aCgpIHtcbiAgICAvLyBNaWdodCBnZXQgY2hhbmdlZCBpZiB0aGUgdXNlciByZXNpemVzIHRoZSB0ZXJtaW5hbFxuICAgIHJldHVybiB0aGlzLnN0cmVhbS5jb2x1bW5zO1xuICB9XG5cbiAgcHVibGljIGRpc3BsYXlMaW5lcyhsaW5lczogc3RyaW5nW10pIHtcbiAgICBsaW5lcyA9IHRlcm1pbmFsV3JhcCh0aGlzLndpZHRoLCBleHBhbmROZXdsaW5lcyhsaW5lcykpO1xuXG4gICAgdGhpcy5zdHJlYW0ud3JpdGUoY3Vyc29yVXAodGhpcy5sYXN0SGVpZ2h0KSk7XG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICB0aGlzLnN0cmVhbS53cml0ZShjbGwoKSArIGxpbmUgKyAnXFxuJyk7XG4gICAgfVxuICAgIC8vIENsZWFyIHJlbWFpbmRlciBvZiB1bndyaXR0ZW4gbGluZXNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGFzdEhlaWdodCAtIGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnN0cmVhbS53cml0ZShjbGwoKSArICdcXG4nKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgYmxvY2sgY2FuIG9ubHkgZXZlciBnZXQgYmlnZ2VyXG4gICAgdGhpcy5sYXN0SGVpZ2h0ID0gTWF0aC5tYXgodGhpcy5sYXN0SGVpZ2h0LCBsaW5lcy5sZW5ndGgpO1xuICB9XG59XG5cbmNvbnN0IEVTQyA9ICdcXHUwMDFiJztcblxuLypcbiAqIE1vdmUgY3Vyc29yIHVwIGBuYCBsaW5lcy4gRGVmYXVsdCBpcyAxXG4gKi9cbmZ1bmN0aW9uIGN1cnNvclVwKG46IG51bWJlcikge1xuICBuID0gdHlwZW9mIG4gPT09ICdudW1iZXInID8gbiA6IDE7XG4gIHJldHVybiBuID4gMCA/IEVTQyArICdbJyArIG4gKyAnQScgOiAnJztcbn1cblxuLyoqXG4gKiBDbGVhciB0byBlbmQgb2YgbGluZVxuICovXG5mdW5jdGlvbiBjbGwoKSB7XG4gIHJldHVybiBFU0MgKyAnW0snO1xufVxuXG5mdW5jdGlvbiB0ZXJtaW5hbFdyYXAod2lkdGg6IG51bWJlciB8IHVuZGVmaW5lZCwgbGluZXM6IHN0cmluZ1tdKSB7XG4gIGlmICh3aWR0aCA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiBsaW5lczsgfVxuXG4gIGNvbnN0IHJldCA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgIHJldC5wdXNoKC4uLndyYXBBbnNpKGxpbmUsIHdpZHRoIC0gMSwge1xuICAgICAgaGFyZDogdHJ1ZSxcbiAgICAgIHRyaW06IHRydWUsXG4gICAgICB3b3JkV3JhcDogZmFsc2UsXG4gICAgfSkuc3BsaXQoJ1xcbicpKTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIE1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gaGlkZGVuIG5ld2xpbmVzIGluIHRoZSBnaW4gc3RyaW5nc1xuICovXG5mdW5jdGlvbiBleHBhbmROZXdsaW5lcyhsaW5lczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHJldCA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgIHJldC5wdXNoKC4uLmxpbmUuc3BsaXQoJ1xcbicpKTtcbiAgfVxuICByZXR1cm4gcmV0O1xufSJdfQ==