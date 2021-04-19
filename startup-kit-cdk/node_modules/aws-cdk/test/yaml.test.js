"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const serialize_1 = require("../lib/serialize");
// Preferred quote of the YAML library
const q = '"';
test('quote the word "ON"', () => {
    // NON NEGOTIABLE! If not quoted, will be interpreted as the boolean TRUE
    // eslint-disable-next-line no-console
    const output = serialize_1.toYAML({
        notABoolean: 'ON',
    });
    expect(output.trim()).toEqual(`notABoolean: ${q}ON${q}`);
});
test('quote number-like strings with a leading 0', () => {
    const output = serialize_1.toYAML({
        leadingZero: '012345',
    });
    expect(output.trim()).toEqual(`leadingZero: ${q}012345${q}`);
});
test('do not quote octal numbers that arent really octal', () => {
    // This is a contentious one, and something that might have changed in YAML1.2 vs YAML1.1
    //
    // One could make the argument that a sequence of characters that couldn't ever
    // be an octal value doesn't need to be quoted, and pyyaml parses it correctly.
    //
    // However, CloudFormation's parser interprets it as a decimal number (eating the
    // leading 0) if it's unquoted, so that's the behavior we're testing for.
    const output = serialize_1.toYAML({
        leadingZero: '0123456789',
    });
    expect(output.trim()).toEqual(`leadingZero: ${q}0123456789${q}`);
});
test('validate that our YAML correctly emits quoted colons in a list', () => {
    // Must be quoted otherwise it's not valid YAML.
    //
    // 'yaml' fails this.
    const output = serialize_1.toYAML({
        colons: ['arn', ':', 'aws'],
    });
    expect(output.trim()).toEqual([
        'colons:',
        '  - arn',
        `  - ${q}:${q}`,
        '  - aws',
    ].join('\n'));
});
test('validate emission of very long lines', () => {
    const template = {
        Field: ' very long line that starts with a space. very long line that starts with a space. start on a new line',
    };
    const output = serialize_1.toYAML(template);
    const parsed = serialize_1.deserializeStructure(output);
    expect(template).toEqual(parsed);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieWFtbC50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsieWFtbC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsZ0RBQWdFO0FBRWhFLHNDQUFzQztBQUN0QyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7QUFFZCxJQUFJLENBQUMscUJBQXFCLEVBQUUsR0FBRyxFQUFFO0lBQy9CLHlFQUF5RTtJQUV6RSxzQ0FBc0M7SUFDdEMsTUFBTSxNQUFNLEdBQUcsa0JBQU0sQ0FBQztRQUNwQixXQUFXLEVBQUUsSUFBSTtLQUNsQixDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMzRCxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyw0Q0FBNEMsRUFBRSxHQUFHLEVBQUU7SUFDdEQsTUFBTSxNQUFNLEdBQUcsa0JBQU0sQ0FBQztRQUNwQixXQUFXLEVBQUUsUUFBUTtLQUN0QixDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMvRCxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyxvREFBb0QsRUFBRSxHQUFHLEVBQUU7SUFDOUQseUZBQXlGO0lBQ3pGLEVBQUU7SUFDRiwrRUFBK0U7SUFDL0UsK0VBQStFO0lBQy9FLEVBQUU7SUFDRixpRkFBaUY7SUFDakYseUVBQXlFO0lBRXpFLE1BQU0sTUFBTSxHQUFHLGtCQUFNLENBQUM7UUFDcEIsV0FBVyxFQUFFLFlBQVk7S0FDMUIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbkUsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsZ0VBQWdFLEVBQUUsR0FBRyxFQUFFO0lBQzFFLGdEQUFnRDtJQUNoRCxFQUFFO0lBQ0YscUJBQXFCO0lBRXJCLE1BQU0sTUFBTSxHQUFHLGtCQUFNLENBQUM7UUFDcEIsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUM7S0FDNUIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUM1QixTQUFTO1FBQ1QsU0FBUztRQUNULE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNmLFNBQVM7S0FDVixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxDQUFDLHNDQUFzQyxFQUFFLEdBQUcsRUFBRTtJQUNoRCxNQUFNLFFBQVEsR0FBRztRQUNmLEtBQUssRUFBRSx3R0FBd0c7S0FDaEgsQ0FBQztJQUVGLE1BQU0sTUFBTSxHQUFHLGtCQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFaEMsTUFBTSxNQUFNLEdBQUcsZ0NBQW9CLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFNUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQyxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRlc2VyaWFsaXplU3RydWN0dXJlLCB0b1lBTUwgfSBmcm9tICcuLi9saWIvc2VyaWFsaXplJztcblxuLy8gUHJlZmVycmVkIHF1b3RlIG9mIHRoZSBZQU1MIGxpYnJhcnlcbmNvbnN0IHEgPSAnXCInO1xuXG50ZXN0KCdxdW90ZSB0aGUgd29yZCBcIk9OXCInLCAoKSA9PiB7XG4gIC8vIE5PTiBORUdPVElBQkxFISBJZiBub3QgcXVvdGVkLCB3aWxsIGJlIGludGVycHJldGVkIGFzIHRoZSBib29sZWFuIFRSVUVcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICBjb25zdCBvdXRwdXQgPSB0b1lBTUwoe1xuICAgIG5vdEFCb29sZWFuOiAnT04nLFxuICB9KTtcblxuICBleHBlY3Qob3V0cHV0LnRyaW0oKSkudG9FcXVhbChgbm90QUJvb2xlYW46ICR7cX1PTiR7cX1gKTtcbn0pO1xuXG50ZXN0KCdxdW90ZSBudW1iZXItbGlrZSBzdHJpbmdzIHdpdGggYSBsZWFkaW5nIDAnLCAoKSA9PiB7XG4gIGNvbnN0IG91dHB1dCA9IHRvWUFNTCh7XG4gICAgbGVhZGluZ1plcm86ICcwMTIzNDUnLFxuICB9KTtcblxuICBleHBlY3Qob3V0cHV0LnRyaW0oKSkudG9FcXVhbChgbGVhZGluZ1plcm86ICR7cX0wMTIzNDUke3F9YCk7XG59KTtcblxudGVzdCgnZG8gbm90IHF1b3RlIG9jdGFsIG51bWJlcnMgdGhhdCBhcmVudCByZWFsbHkgb2N0YWwnLCAoKSA9PiB7XG4gIC8vIFRoaXMgaXMgYSBjb250ZW50aW91cyBvbmUsIGFuZCBzb21ldGhpbmcgdGhhdCBtaWdodCBoYXZlIGNoYW5nZWQgaW4gWUFNTDEuMiB2cyBZQU1MMS4xXG4gIC8vXG4gIC8vIE9uZSBjb3VsZCBtYWtlIHRoZSBhcmd1bWVudCB0aGF0IGEgc2VxdWVuY2Ugb2YgY2hhcmFjdGVycyB0aGF0IGNvdWxkbid0IGV2ZXJcbiAgLy8gYmUgYW4gb2N0YWwgdmFsdWUgZG9lc24ndCBuZWVkIHRvIGJlIHF1b3RlZCwgYW5kIHB5eWFtbCBwYXJzZXMgaXQgY29ycmVjdGx5LlxuICAvL1xuICAvLyBIb3dldmVyLCBDbG91ZEZvcm1hdGlvbidzIHBhcnNlciBpbnRlcnByZXRzIGl0IGFzIGEgZGVjaW1hbCBudW1iZXIgKGVhdGluZyB0aGVcbiAgLy8gbGVhZGluZyAwKSBpZiBpdCdzIHVucXVvdGVkLCBzbyB0aGF0J3MgdGhlIGJlaGF2aW9yIHdlJ3JlIHRlc3RpbmcgZm9yLlxuXG4gIGNvbnN0IG91dHB1dCA9IHRvWUFNTCh7XG4gICAgbGVhZGluZ1plcm86ICcwMTIzNDU2Nzg5JyxcbiAgfSk7XG5cbiAgZXhwZWN0KG91dHB1dC50cmltKCkpLnRvRXF1YWwoYGxlYWRpbmdaZXJvOiAke3F9MDEyMzQ1Njc4OSR7cX1gKTtcbn0pO1xuXG50ZXN0KCd2YWxpZGF0ZSB0aGF0IG91ciBZQU1MIGNvcnJlY3RseSBlbWl0cyBxdW90ZWQgY29sb25zIGluIGEgbGlzdCcsICgpID0+IHtcbiAgLy8gTXVzdCBiZSBxdW90ZWQgb3RoZXJ3aXNlIGl0J3Mgbm90IHZhbGlkIFlBTUwuXG4gIC8vXG4gIC8vICd5YW1sJyBmYWlscyB0aGlzLlxuXG4gIGNvbnN0IG91dHB1dCA9IHRvWUFNTCh7XG4gICAgY29sb25zOiBbJ2FybicsICc6JywgJ2F3cyddLFxuICB9KTtcblxuICBleHBlY3Qob3V0cHV0LnRyaW0oKSkudG9FcXVhbChbXG4gICAgJ2NvbG9uczonLFxuICAgICcgIC0gYXJuJyxcbiAgICBgICAtICR7cX06JHtxfWAsXG4gICAgJyAgLSBhd3MnLFxuICBdLmpvaW4oJ1xcbicpKTtcbn0pO1xuXG50ZXN0KCd2YWxpZGF0ZSBlbWlzc2lvbiBvZiB2ZXJ5IGxvbmcgbGluZXMnLCAoKSA9PiB7XG4gIGNvbnN0IHRlbXBsYXRlID0ge1xuICAgIEZpZWxkOiAnIHZlcnkgbG9uZyBsaW5lIHRoYXQgc3RhcnRzIHdpdGggYSBzcGFjZS4gdmVyeSBsb25nIGxpbmUgdGhhdCBzdGFydHMgd2l0aCBhIHNwYWNlLiBzdGFydCBvbiBhIG5ldyBsaW5lJyxcbiAgfTtcblxuICBjb25zdCBvdXRwdXQgPSB0b1lBTUwodGVtcGxhdGUpO1xuXG4gIGNvbnN0IHBhcnNlZCA9IGRlc2VyaWFsaXplU3RydWN0dXJlKG91dHB1dCk7XG5cbiAgZXhwZWN0KHRlbXBsYXRlKS50b0VxdWFsKHBhcnNlZCk7XG59KTtcbiJdfQ==