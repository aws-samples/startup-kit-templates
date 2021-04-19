"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureStackTrace = void 0;
// tslint:disable-next-line:ban-types
function captureStackTrace(below) {
    below = below || captureStackTrace; // hide myself if nothing else
    const object = { stack: '' };
    const previousLimit = Error.stackTraceLimit;
    try {
        Error.stackTraceLimit = Number.MAX_SAFE_INTEGER;
        Error.captureStackTrace(object, below);
    }
    finally {
        Error.stackTraceLimit = previousLimit;
    }
    if (!object.stack) {
        return [];
    }
    return object.stack.split('\n').slice(1).map(s => s.replace(/^\s*at\s+/, ''));
}
exports.captureStackTrace = captureStackTrace;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhY2stdHJhY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcHJpdmF0ZS9zdGFjay10cmFjZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBcUM7QUFDckMsU0FBZ0IsaUJBQWlCLENBQUMsS0FBZ0I7SUFDaEQsS0FBSyxHQUFHLEtBQUssSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLDhCQUE4QjtJQUNsRSxNQUFNLE1BQU0sR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUM3QixNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDO0lBQzVDLElBQUk7UUFDRixLQUFLLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztRQUNoRCxLQUFLLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3hDO1lBQVM7UUFDUixLQUFLLENBQUMsZUFBZSxHQUFHLGFBQWEsQ0FBQztLQUN2QztJQUNELElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFO1FBQ2pCLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFDRCxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2hGLENBQUM7QUFkRCw4Q0FjQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpiYW4tdHlwZXNcbmV4cG9ydCBmdW5jdGlvbiBjYXB0dXJlU3RhY2tUcmFjZShiZWxvdz86IEZ1bmN0aW9uKTogc3RyaW5nW10ge1xuICBiZWxvdyA9IGJlbG93IHx8IGNhcHR1cmVTdGFja1RyYWNlOyAvLyBoaWRlIG15c2VsZiBpZiBub3RoaW5nIGVsc2VcbiAgY29uc3Qgb2JqZWN0ID0geyBzdGFjazogJycgfTtcbiAgY29uc3QgcHJldmlvdXNMaW1pdCA9IEVycm9yLnN0YWNrVHJhY2VMaW1pdDtcbiAgdHJ5IHtcbiAgICBFcnJvci5zdGFja1RyYWNlTGltaXQgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZShvYmplY3QsIGJlbG93KTtcbiAgfSBmaW5hbGx5IHtcbiAgICBFcnJvci5zdGFja1RyYWNlTGltaXQgPSBwcmV2aW91c0xpbWl0O1xuICB9XG4gIGlmICghb2JqZWN0LnN0YWNrKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG4gIHJldHVybiBvYmplY3Quc3RhY2suc3BsaXQoJ1xcbicpLnNsaWNlKDEpLm1hcChzID0+IHMucmVwbGFjZSgvXlxccyphdFxccysvLCAnJykpO1xufVxuIl19