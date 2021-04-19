"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haveOutput = void 0;
const assertion_1 = require("../assertion");
class HaveOutputAssertion extends assertion_1.JestFriendlyAssertion {
    constructor(outputName, exportName, outputValue) {
        super();
        this.outputName = outputName;
        this.exportName = exportName;
        this.outputValue = outputValue;
        this.inspected = [];
        if (!this.outputName && !this.exportName) {
            throw new Error('At least one of [outputName, exportName] should be provided');
        }
    }
    get description() {
        const descriptionPartsArray = new Array();
        if (this.outputName) {
            descriptionPartsArray.push(`name '${this.outputName}'`);
        }
        if (this.exportName) {
            descriptionPartsArray.push(`export name ${JSON.stringify(this.exportName)}`);
        }
        if (this.outputValue) {
            descriptionPartsArray.push(`value ${JSON.stringify(this.outputValue)}`);
        }
        return 'output with ' + descriptionPartsArray.join(', ');
    }
    assertUsing(inspector) {
        var _a;
        if (!('Outputs' in inspector.value)) {
            return false;
        }
        for (const [name, props] of Object.entries(inspector.value.Outputs)) {
            const mismatchedFields = new Array();
            if (this.outputName && name !== this.outputName) {
                mismatchedFields.push('name');
            }
            if (this.exportName && JSON.stringify(this.exportName) !== JSON.stringify((_a = props.Export) === null || _a === void 0 ? void 0 : _a.Name)) {
                mismatchedFields.push('export name');
            }
            if (this.outputValue && JSON.stringify(this.outputValue) !== JSON.stringify(props.Value)) {
                mismatchedFields.push('value');
            }
            if (mismatchedFields.length === 0) {
                return true;
            }
            this.inspected.push({
                output: { [name]: props },
                failureReason: `mismatched ${mismatchedFields.join(', ')}`,
            });
        }
        return false;
    }
    generateErrorMessage() {
        const lines = new Array();
        lines.push(`None of ${this.inspected.length} outputs matches ${this.description}.`);
        for (const inspected of this.inspected) {
            lines.push(`- ${inspected.failureReason} in:`);
            lines.push(indent(4, JSON.stringify(inspected.output, null, 2)));
        }
        return lines.join('\n');
    }
}
/**
 * An assertion  to check whether Output with particular properties is present in a stack
 * @param props  properties of the Output that is being asserted against.
 *               Check ``HaveOutputProperties`` interface to get full list of available parameters
 */
function haveOutput(props) {
    return new HaveOutputAssertion(props.outputName, props.exportName, props.outputValue);
}
exports.haveOutput = haveOutput;
function indent(n, s) {
    const prefix = ' '.repeat(n);
    return prefix + s.replace(/\n/g, '\n' + prefix);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGF2ZS1vdXRwdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoYXZlLW91dHB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw0Q0FBcUQ7QUFHckQsTUFBTSxtQkFBb0IsU0FBUSxpQ0FBcUM7SUFHckUsWUFBNkIsVUFBbUIsRUFBbUIsVUFBZ0IsRUFBVSxXQUFpQjtRQUM1RyxLQUFLLEVBQUUsQ0FBQztRQURtQixlQUFVLEdBQVYsVUFBVSxDQUFTO1FBQW1CLGVBQVUsR0FBVixVQUFVLENBQU07UUFBVSxnQkFBVyxHQUFYLFdBQVcsQ0FBTTtRQUY3RixjQUFTLEdBQXdCLEVBQUUsQ0FBQztRQUluRCxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO1NBQ2hGO0lBQ0gsQ0FBQztJQUVELElBQVcsV0FBVztRQUNwQixNQUFNLHFCQUFxQixHQUFHLElBQUksS0FBSyxFQUFVLENBQUM7UUFFbEQsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ25CLHFCQUFxQixDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1NBQ3pEO1FBQ0QsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ25CLHFCQUFxQixDQUFDLElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUM5RTtRQUNELElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNwQixxQkFBcUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDekU7UUFFRCxPQUFPLGNBQWMsR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7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ZGx5QXNzZXJ0aW9uIH0gZnJvbSAnLi4vYXNzZXJ0aW9uJztcbmltcG9ydCB7IFN0YWNrSW5zcGVjdG9yIH0gZnJvbSAnLi4vaW5zcGVjdG9yJztcblxuY2xhc3MgSGF2ZU91dHB1dEFzc2VydGlvbiBleHRlbmRzIEplc3RGcmllbmRseUFzc2VydGlvbjxTdGFja0luc3BlY3Rvcj4ge1xuICBwcml2YXRlIHJlYWRvbmx5IGluc3BlY3RlZDogSW5zcGVjdGlvbkZhaWx1cmVbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0TmFtZT86IHN0cmluZywgcHJpdmF0ZSByZWFkb25seSBleHBvcnROYW1lPzogYW55LCBwcml2YXRlIG91dHB1dFZhbHVlPzogYW55KSB7XG4gICAgc3VwZXIoKTtcbiAgICBpZiAoIXRoaXMub3V0cHV0TmFtZSAmJiAhdGhpcy5leHBvcnROYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0F0IGxlYXN0IG9uZSBvZiBbb3V0cHV0TmFtZSwgZXhwb3J0TmFtZV0gc2hvdWxkIGJlIHByb3ZpZGVkJyk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGdldCBkZXNjcmlwdGlvbigpOiBzdHJpbmcge1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uUGFydHNBcnJheSA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG5cbiAgICBpZiAodGhpcy5vdXRwdXROYW1lKSB7XG4gICAgICBkZXNjcmlwdGlvblBhcnRzQXJyYXkucHVzaChgbmFtZSAnJHt0aGlzLm91dHB1dE5hbWV9J2ApO1xuICAgIH1cbiAgICBpZiAodGhpcy5leHBvcnROYW1lKSB7XG4gICAgICBkZXNjcmlwdGlvblBhcnRzQXJyYXkucHVzaChgZXhwb3J0IG5hbWUgJHtKU09OLnN0cmluZ2lmeSh0aGlzLmV4cG9ydE5hbWUpfWApO1xuICAgIH1cbiAgICBpZiAodGhpcy5vdXRwdXRWYWx1ZSkge1xuICAgICAgZGVzY3JpcHRpb25QYXJ0c0FycmF5LnB1c2goYHZhbHVlICR7SlNPTi5zdHJpbmdpZnkodGhpcy5vdXRwdXRWYWx1ZSl9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuICdvdXRwdXQgd2l0aCAnICsgZGVzY3JpcHRpb25QYXJ0c0FycmF5LmpvaW4oJywgJyk7XG4gIH1cblxuICBwdWJsaWMgYXNzZXJ0VXNpbmcoaW5zcGVjdG9yOiBTdGFja0luc3BlY3Rvcik6IGJvb2xlYW4ge1xuICAgIGlmICghKCdPdXRwdXRzJyBpbiBpbnNwZWN0b3IudmFsdWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBbbmFtZSwgcHJvcHNdIG9mIE9iamVjdC5lbnRyaWVzKGluc3BlY3Rvci52YWx1ZS5PdXRwdXRzIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pKSB7XG4gICAgICBjb25zdCBtaXNtYXRjaGVkRmllbGRzID0gbmV3IEFycmF5PHN0cmluZz4oKTtcblxuICAgICAgaWYgKHRoaXMub3V0cHV0TmFtZSAmJiBuYW1lICE9PSB0aGlzLm91dHB1dE5hbWUpIHtcbiAgICAgICAgbWlzbWF0Y2hlZEZpZWxkcy5wdXNoKCduYW1lJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmV4cG9ydE5hbWUgJiYgSlNPTi5zdHJpbmdpZnkodGhpcy5leHBvcnROYW1lKSAhPT0gSlNPTi5zdHJpbmdpZnkocHJvcHMuRXhwb3J0Py5OYW1lKSkge1xuICAgICAgICBtaXNtYXRjaGVkRmllbGRzLnB1c2goJ2V4cG9ydCBuYW1lJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLm91dHB1dFZhbHVlICYmIEpTT04uc3RyaW5naWZ5KHRoaXMub3V0cHV0VmFsdWUpICE9PSBKU09OLnN0cmluZ2lmeShwcm9wcy5WYWx1ZSkpIHtcbiAgICAgICAgbWlzbWF0Y2hlZEZpZWxkcy5wdXNoKCd2YWx1ZScpO1xuICAgICAgfVxuXG4gICAgICBpZiAobWlzbWF0Y2hlZEZpZWxkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW5zcGVjdGVkLnB1c2goe1xuICAgICAgICBvdXRwdXQ6IHsgW25hbWVdOiBwcm9wcyB9LFxuICAgICAgICBmYWlsdXJlUmVhc29uOiBgbWlzbWF0Y2hlZCAke21pc21hdGNoZWRGaWVsZHMuam9pbignLCAnKX1gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHVibGljIGdlbmVyYXRlRXJyb3JNZXNzYWdlKCkge1xuICAgIGNvbnN0IGxpbmVzID0gbmV3IEFycmF5PHN0cmluZz4oKTtcblxuICAgIGxpbmVzLnB1c2goYE5vbmUgb2YgJHt0aGlzLmluc3BlY3RlZC5sZW5ndGh9IG91dHB1dHMgbWF0Y2hlcyAke3RoaXMuZGVzY3JpcHRpb259LmApO1xuXG4gICAgZm9yIChjb25zdCBpbnNwZWN0ZWQgb2YgdGhpcy5pbnNwZWN0ZWQpIHtcbiAgICAgIGxpbmVzLnB1c2goYC0gJHtpbnNwZWN0ZWQuZmFpbHVyZVJlYXNvbn0gaW46YCk7XG4gICAgICBsaW5lcy5wdXNoKGluZGVudCg0LCBKU09OLnN0cmluZ2lmeShpbnNwZWN0ZWQub3V0cHV0LCBudWxsLCAyKSkpO1xuICAgIH1cblxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxufVxuXG4vKipcbiAqIEludGVyZmFjZSBmb3IgaGF2ZU91dHB1dCBmdW5jdGlvbiBwcm9wZXJ0aWVzXG4gKiBOT1RFIHRoYXQgYXQgbGVhc3Qgb25lIG9mIFtvdXRwdXROYW1lLCBleHBvcnROYW1lXSBzaG91bGQgYmUgcHJvdmlkZWRcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBIYXZlT3V0cHV0UHJvcGVydGllcyB7XG4gIC8qKlxuICAgKiBMb2dpY2FsIElEIG9mIHRoZSBvdXRwdXRcbiAgICogQGRlZmF1bHQgLSB0aGUgbG9naWNhbCBJRCBvZiB0aGUgb3V0cHV0IHdpbGwgbm90IGJlIGNoZWNrZWRcbiAgICovXG4gIG91dHB1dE5hbWU/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBFeHBvcnQgbmFtZSBvZiB0aGUgb3V0cHV0LCB3aGVuIGl0J3MgZXhwb3J0ZWQgZm9yIGNyb3NzLXN0YWNrIHJlZmVyZW5jaW5nXG4gICAqIEBkZWZhdWx0IC0gdGhlIGV4cG9ydCBuYW1lIGlzIG5vdCByZXF1aXJlZCBhbmQgd2lsbCBub3QgYmUgY2hlY2tlZFxuICAgKi9cbiAgZXhwb3J0TmFtZT86IGFueTtcbiAgLyoqXG4gICAqIFZhbHVlIG9mIHRoZSBvdXRwdXQ7XG4gICAqIEBkZWZhdWx0IC0gdGhlIHZhbHVlIHdpbGwgbm90IGJlIGNoZWNrZWRcbiAgICovXG4gIG91dHB1dFZhbHVlPzogYW55O1xufVxuXG5pbnRlcmZhY2UgSW5zcGVjdGlvbkZhaWx1cmUge1xuICBvdXRwdXQ6IGFueTtcbiAgZmFpbHVyZVJlYXNvbjogc3RyaW5nO1xufVxuXG4vKipcbiAqIEFuIGFzc2VydGlvbiAgdG8gY2hlY2sgd2hldGhlciBPdXRwdXQgd2l0aCBwYXJ0aWN1bGFyIHByb3BlcnRpZXMgaXMgcHJlc2VudCBpbiBhIHN0YWNrXG4gKiBAcGFyYW0gcHJvcHMgIHByb3BlcnRpZXMgb2YgdGhlIE91dHB1dCB0aGF0IGlzIGJlaW5nIGFzc2VydGVkIGFnYWluc3QuXG4gKiAgICAgICAgICAgICAgIENoZWNrIGBgSGF2ZU91dHB1dFByb3BlcnRpZXNgYCBpbnRlcmZhY2UgdG8gZ2V0IGZ1bGwgbGlzdCBvZiBhdmFpbGFibGUgcGFyYW1ldGVyc1xuICovXG5leHBvcnQgZnVuY3Rpb24gaGF2ZU91dHB1dChwcm9wczogSGF2ZU91dHB1dFByb3BlcnRpZXMpOiBKZXN0RnJpZW5kbHlBc3NlcnRpb248U3RhY2tJbnNwZWN0b3I+IHtcbiAgcmV0dXJuIG5ldyBIYXZlT3V0cHV0QXNzZXJ0aW9uKHByb3BzLm91dHB1dE5hbWUsIHByb3BzLmV4cG9ydE5hbWUsIHByb3BzLm91dHB1dFZhbHVlKTtcbn1cblxuZnVuY3Rpb24gaW5kZW50KG46IG51bWJlciwgczogc3RyaW5nKSB7XG4gIGNvbnN0IHByZWZpeCA9ICcgJy5yZXBlYXQobik7XG4gIHJldHVybiBwcmVmaXggKyBzLnJlcGxhY2UoL1xcbi9nLCAnXFxuJyArIHByZWZpeCk7XG59XG4iXX0=