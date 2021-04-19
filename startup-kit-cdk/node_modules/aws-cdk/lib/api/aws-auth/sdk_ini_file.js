"use strict";
/**
 * A reimplementation of JS AWS SDK's SharedIniFile class
 *
 * We need that class to parse the ~/.aws/config file to determine the correct
 * region at runtime, but unfortunately it is private upstream.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedIniFile = void 0;
const os = require("os");
const path = require("path");
const AWS = require("aws-sdk");
const fs = require("fs-extra");
class SharedIniFile {
    constructor(options) {
        options = options || {};
        this.isConfig = options.isConfig === true;
        this.filename = options.filename || this.getDefaultFilepath();
    }
    async getProfile(profile) {
        await this.ensureFileLoaded();
        const profileIndex = profile !== AWS.util.defaultProfile && this.isConfig ?
            'profile ' + profile : profile;
        return this.parsedContents[profileIndex];
    }
    getDefaultFilepath() {
        return path.join(os.homedir(), '.aws', this.isConfig ? 'config' : 'credentials');
    }
    async ensureFileLoaded() {
        if (this.parsedContents) {
            return;
        }
        if (!await fs.pathExists(this.filename)) {
            this.parsedContents = {};
            return;
        }
        const contents = (await fs.readFile(this.filename)).toString();
        this.parsedContents = AWS.util.ini.parse(contents);
    }
}
exports.SharedIniFile = SharedIniFile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrX2luaV9maWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2RrX2luaV9maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7O0FBRUgseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QiwrQkFBK0I7QUFDL0IsK0JBQStCO0FBTy9CLE1BQWEsYUFBYTtJQUt4QixZQUFZLE9BQThCO1FBQ3hDLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUM7UUFDMUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQ2hFLENBQUM7SUFFTSxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQWU7UUFDckMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUU5QixNQUFNLFlBQVksR0FBRyxPQUFPLEtBQU0sR0FBVyxDQUFDLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xGLFVBQVUsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUVqQyxPQUFPLElBQUksQ0FBQyxjQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVPLGtCQUFrQjtRQUN4QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQ2QsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUNaLE1BQU0sRUFDTixJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FDekMsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMsZ0JBQWdCO1FBQzVCLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRTtZQUN2QixPQUFPO1NBQ1I7UUFFRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUN2QyxJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztZQUN6QixPQUFPO1NBQ1I7UUFFRCxNQUFNLFFBQVEsR0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN2RSxJQUFJLENBQUMsY0FBYyxHQUFJLEdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM5RCxDQUFDO0NBQ0Y7QUF6Q0Qsc0NBeUNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIHJlaW1wbGVtZW50YXRpb24gb2YgSlMgQVdTIFNESydzIFNoYXJlZEluaUZpbGUgY2xhc3NcbiAqXG4gKiBXZSBuZWVkIHRoYXQgY2xhc3MgdG8gcGFyc2UgdGhlIH4vLmF3cy9jb25maWcgZmlsZSB0byBkZXRlcm1pbmUgdGhlIGNvcnJlY3RcbiAqIHJlZ2lvbiBhdCBydW50aW1lLCBidXQgdW5mb3J0dW5hdGVseSBpdCBpcyBwcml2YXRlIHVwc3RyZWFtLlxuICovXG5cbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBBV1MgZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy1leHRyYSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2hhcmVkSW5pRmlsZU9wdGlvbnMge1xuICBpc0NvbmZpZz86IGJvb2xlYW47XG4gIGZpbGVuYW1lPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU2hhcmVkSW5pRmlsZSB7XG4gIHByaXZhdGUgcmVhZG9ubHkgaXNDb25maWc6IGJvb2xlYW47XG4gIHByaXZhdGUgcmVhZG9ubHkgZmlsZW5hbWU6IHN0cmluZztcbiAgcHJpdmF0ZSBwYXJzZWRDb250ZW50cz86IHsgW2tleTogc3RyaW5nXTogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSB9O1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM/OiBTaGFyZWRJbmlGaWxlT3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHRoaXMuaXNDb25maWcgPSBvcHRpb25zLmlzQ29uZmlnID09PSB0cnVlO1xuICAgIHRoaXMuZmlsZW5hbWUgPSBvcHRpb25zLmZpbGVuYW1lIHx8IHRoaXMuZ2V0RGVmYXVsdEZpbGVwYXRoKCk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0UHJvZmlsZShwcm9maWxlOiBzdHJpbmcpIHtcbiAgICBhd2FpdCB0aGlzLmVuc3VyZUZpbGVMb2FkZWQoKTtcblxuICAgIGNvbnN0IHByb2ZpbGVJbmRleCA9IHByb2ZpbGUgIT09IChBV1MgYXMgYW55KS51dGlsLmRlZmF1bHRQcm9maWxlICYmIHRoaXMuaXNDb25maWcgP1xuICAgICAgJ3Byb2ZpbGUgJyArIHByb2ZpbGUgOiBwcm9maWxlO1xuXG4gICAgcmV0dXJuIHRoaXMucGFyc2VkQ29udGVudHMhW3Byb2ZpbGVJbmRleF07XG4gIH1cblxuICBwcml2YXRlIGdldERlZmF1bHRGaWxlcGF0aCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBwYXRoLmpvaW4oXG4gICAgICBvcy5ob21lZGlyKCksXG4gICAgICAnLmF3cycsXG4gICAgICB0aGlzLmlzQ29uZmlnID8gJ2NvbmZpZycgOiAnY3JlZGVudGlhbHMnLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGVuc3VyZUZpbGVMb2FkZWQoKSB7XG4gICAgaWYgKHRoaXMucGFyc2VkQ29udGVudHMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWF3YWl0IGZzLnBhdGhFeGlzdHModGhpcy5maWxlbmFtZSkpIHtcbiAgICAgIHRoaXMucGFyc2VkQ29udGVudHMgPSB7fTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50czogc3RyaW5nID0gKGF3YWl0IGZzLnJlYWRGaWxlKHRoaXMuZmlsZW5hbWUpKS50b1N0cmluZygpO1xuICAgIHRoaXMucGFyc2VkQ29udGVudHMgPSAoQVdTIGFzIGFueSkudXRpbC5pbmkucGFyc2UoY29udGVudHMpO1xuICB9XG59XG4iXX0=