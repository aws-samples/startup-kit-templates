"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const serialize_1 = require("../lib/serialize");
describe(serialize_1.toYAML, () => {
    test('does not wrap lines', () => {
        const longString = 'Long string is long!'.repeat(1024);
        expect(serialize_1.toYAML({ longString })).toEqual(`longString: ${longString}\n`);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsaXplLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXJpYWxpemUudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGdEQUEwQztBQUUxQyxRQUFRLENBQUMsa0JBQU0sRUFBRSxHQUFHLEVBQUU7SUFDcEIsSUFBSSxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtRQUMvQixNQUFNLFVBQVUsR0FBRyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsSUFBSyxDQUFDLENBQUM7UUFDeEQsTUFBTSxDQUFDLGtCQUFNLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsVUFBVSxJQUFJLENBQUMsQ0FBQztJQUN4RSxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9ZQU1MIH0gZnJvbSAnLi4vbGliL3NlcmlhbGl6ZSc7XG5cbmRlc2NyaWJlKHRvWUFNTCwgKCkgPT4ge1xuICB0ZXN0KCdkb2VzIG5vdCB3cmFwIGxpbmVzJywgKCkgPT4ge1xuICAgIGNvbnN0IGxvbmdTdHJpbmcgPSAnTG9uZyBzdHJpbmcgaXMgbG9uZyEnLnJlcGVhdCgxXzAyNCk7XG4gICAgZXhwZWN0KHRvWUFNTCh7IGxvbmdTdHJpbmcgfSkpLnRvRXF1YWwoYGxvbmdTdHJpbmc6ICR7bG9uZ1N0cmluZ31cXG5gKTtcbiAgfSk7XG59KTtcbiJdfQ==