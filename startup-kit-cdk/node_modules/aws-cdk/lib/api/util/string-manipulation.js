"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leftPad = void 0;
/**
 * Pad 's' on the left with 'char' until it is n characters wide
 */
function leftPad(s, n, char) {
    const padding = Math.max(0, n - s.length);
    return char.repeat(padding) + s;
}
exports.leftPad = leftPad;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyaW5nLW1hbmlwdWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0cmluZy1tYW5pcHVsYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxTQUFnQixPQUFPLENBQUMsQ0FBUyxFQUFFLENBQVMsRUFBRSxJQUFZO0lBQ3hELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBSEQsMEJBR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFBhZCAncycgb24gdGhlIGxlZnQgd2l0aCAnY2hhcicgdW50aWwgaXQgaXMgbiBjaGFyYWN0ZXJzIHdpZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxlZnRQYWQoczogc3RyaW5nLCBuOiBudW1iZXIsIGNoYXI6IHN0cmluZykge1xuICBjb25zdCBwYWRkaW5nID0gTWF0aC5tYXgoMCwgbiAtIHMubGVuZ3RoKTtcbiAgcmV0dXJuIGNoYXIucmVwZWF0KHBhZGRpbmcpICsgcztcbn0iXX0=