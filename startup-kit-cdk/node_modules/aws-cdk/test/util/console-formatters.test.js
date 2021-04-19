"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const colors = require("colors/safe");
const console_formatters_1 = require("../../lib/util/console-formatters");
test('no banner on empty msg list', () => expect(console_formatters_1.formatAsBanner([])).toEqual([]));
test('banner works as expected', () => expect(console_formatters_1.formatAsBanner(['msg1', 'msg2'])).toEqual([
    '************',
    '*** msg1 ***',
    '*** msg2 ***',
    '************',
]));
test('banner works for formatted msgs', () => expect(console_formatters_1.formatAsBanner([
    'hello msg1',
    colors.yellow('hello msg2'),
    colors.bold('hello msg3'),
])).toEqual([
    '******************',
    '*** hello msg1 ***',
    `*** ${colors.yellow('hello msg2')} ***`,
    `*** ${colors.bold('hello msg3')} ***`,
    '******************',
]));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc29sZS1mb3JtYXR0ZXJzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb25zb2xlLWZvcm1hdHRlcnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNDQUFzQztBQUN0QywwRUFBbUU7QUFFbkUsSUFBSSxDQUFDLDZCQUE2QixFQUFFLEdBQUcsRUFBRSxDQUN2QyxNQUFNLENBQUMsbUNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRTFDLElBQUksQ0FBQywwQkFBMEIsRUFBRSxHQUFHLEVBQUUsQ0FDcEMsTUFBTSxDQUFDLG1DQUFjLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztJQUMvQyxjQUFjO0lBQ2QsY0FBYztJQUNkLGNBQWM7SUFDZCxjQUFjO0NBQ2YsQ0FBQyxDQUFDLENBQUM7QUFFTixJQUFJLENBQUMsaUNBQWlDLEVBQUUsR0FBRyxFQUFFLENBQzNDLE1BQU0sQ0FBQyxtQ0FBYyxDQUFDO0lBQ3BCLFlBQVk7SUFDWixNQUFNLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztDQUMxQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDVixvQkFBb0I7SUFDcEIsb0JBQW9CO0lBQ3BCLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTTtJQUN4QyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU07SUFDdEMsb0JBQW9CO0NBQ3JCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycy9zYWZlJztcbmltcG9ydCB7IGZvcm1hdEFzQmFubmVyIH0gZnJvbSAnLi4vLi4vbGliL3V0aWwvY29uc29sZS1mb3JtYXR0ZXJzJztcblxudGVzdCgnbm8gYmFubmVyIG9uIGVtcHR5IG1zZyBsaXN0JywgKCkgPT5cbiAgZXhwZWN0KGZvcm1hdEFzQmFubmVyKFtdKSkudG9FcXVhbChbXSkpO1xuXG50ZXN0KCdiYW5uZXIgd29ya3MgYXMgZXhwZWN0ZWQnLCAoKSA9PlxuICBleHBlY3QoZm9ybWF0QXNCYW5uZXIoWydtc2cxJywgJ21zZzInXSkpLnRvRXF1YWwoW1xuICAgICcqKioqKioqKioqKionLFxuICAgICcqKiogbXNnMSAqKionLFxuICAgICcqKiogbXNnMiAqKionLFxuICAgICcqKioqKioqKioqKionLFxuICBdKSk7XG5cbnRlc3QoJ2Jhbm5lciB3b3JrcyBmb3IgZm9ybWF0dGVkIG1zZ3MnLCAoKSA9PlxuICBleHBlY3QoZm9ybWF0QXNCYW5uZXIoW1xuICAgICdoZWxsbyBtc2cxJyxcbiAgICBjb2xvcnMueWVsbG93KCdoZWxsbyBtc2cyJyksXG4gICAgY29sb3JzLmJvbGQoJ2hlbGxvIG1zZzMnKSxcbiAgXSkpLnRvRXF1YWwoW1xuICAgICcqKioqKioqKioqKioqKioqKionLFxuICAgICcqKiogaGVsbG8gbXNnMSAqKionLFxuICAgIGAqKiogJHtjb2xvcnMueWVsbG93KCdoZWxsbyBtc2cyJyl9ICoqKmAsXG4gICAgYCoqKiAke2NvbG9ycy5ib2xkKCdoZWxsbyBtc2czJyl9ICoqKmAsXG4gICAgJyoqKioqKioqKioqKioqKioqKicsXG4gIF0pKTtcbiJdfQ==