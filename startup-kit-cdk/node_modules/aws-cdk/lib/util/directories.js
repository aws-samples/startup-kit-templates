"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cdkCacheDir = exports.cdkHomeDir = void 0;
const os = require("os");
const path = require("path");
function cdkHomeDir() {
    var _a;
    return process.env.CDK_HOME
        ? path.resolve(process.env.CDK_HOME)
        : path.join(((_a = os.userInfo().homedir) !== null && _a !== void 0 ? _a : os.homedir()).trim() || '/', '.cdk');
}
exports.cdkHomeDir = cdkHomeDir;
function cdkCacheDir() {
    return path.join(cdkHomeDir(), 'cache');
}
exports.cdkCacheDir = cdkCacheDir;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0b3JpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkaXJlY3Rvcmllcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLFNBQWdCLFVBQVU7O0lBQ3hCLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRO1FBQ3pCLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sbUNBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQy9FLENBQUM7QUFKRCxnQ0FJQztBQUVELFNBQWdCLFdBQVc7SUFDekIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFGRCxrQ0FFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjZGtIb21lRGlyKCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuQ0RLX0hPTUVcbiAgICA/IHBhdGgucmVzb2x2ZShwcm9jZXNzLmVudi5DREtfSE9NRSlcbiAgICA6IHBhdGguam9pbigob3MudXNlckluZm8oKS5ob21lZGlyID8/IG9zLmhvbWVkaXIoKSkudHJpbSgpIHx8ICcvJywgJy5jZGsnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNka0NhY2hlRGlyKCkge1xuICByZXR1cm4gcGF0aC5qb2luKGNka0hvbWVEaXIoKSwgJ2NhY2hlJyk7XG59Il19