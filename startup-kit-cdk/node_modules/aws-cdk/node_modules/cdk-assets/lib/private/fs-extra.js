"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rmRfSync = exports.emptyDirSync = exports.pathExists = void 0;
const fs = require("fs");
const path = require("path");
const pfs = fs.promises;
async function pathExists(pathName) {
    try {
        await pfs.stat(pathName);
        return true;
    }
    catch (e) {
        if (e.code !== 'ENOENT') {
            throw e;
        }
        return false;
    }
}
exports.pathExists = pathExists;
function emptyDirSync(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
        const fullPath = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
            emptyDirSync(fullPath);
            fs.rmdirSync(fullPath);
        }
        else {
            fs.unlinkSync(fullPath);
        }
    });
}
exports.emptyDirSync = emptyDirSync;
function rmRfSync(dir) {
    emptyDirSync(dir);
    fs.rmdirSync(dir);
}
exports.rmRfSync = rmRfSync;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnMtZXh0cmEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmcy1leHRyYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUM7QUFFakIsS0FBSyxVQUFVLFVBQVUsQ0FBQyxRQUFnQjtJQUMvQyxJQUFJO1FBQ0YsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3pCLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7WUFBRSxNQUFNLENBQUMsQ0FBQztTQUFFO1FBQ3JDLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDO0FBUkQsZ0NBUUM7QUFFRCxTQUFnQixZQUFZLENBQUMsR0FBVztJQUN0QyxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDeEIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZCLEVBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDeEI7YUFBTTtZQUNMLEVBQUUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDekI7SUFDSCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFWRCxvQ0FVQztBQUVELFNBQWdCLFFBQVEsQ0FBQyxHQUFXO0lBQ2xDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsQixFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLENBQUM7QUFIRCw0QkFHQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IHBmcyA9IGZzLnByb21pc2VzO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcGF0aEV4aXN0cyhwYXRoTmFtZTogc3RyaW5nKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcGZzLnN0YXQocGF0aE5hbWUpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUuY29kZSAhPT0gJ0VOT0VOVCcpIHsgdGhyb3cgZTsgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZW1wdHlEaXJTeW5jKGRpcjogc3RyaW5nKSB7XG4gIGZzLnJlYWRkaXJTeW5jKGRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pLmZvckVhY2goZGlyZW50ID0+IHtcbiAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXIsIGRpcmVudC5uYW1lKTtcbiAgICBpZiAoZGlyZW50LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIGVtcHR5RGlyU3luYyhmdWxsUGF0aCk7XG4gICAgICBmcy5ybWRpclN5bmMoZnVsbFBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmcy51bmxpbmtTeW5jKGZ1bGxQYXRoKTtcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcm1SZlN5bmMoZGlyOiBzdHJpbmcpIHtcbiAgZW1wdHlEaXJTeW5jKGRpcik7XG4gIGZzLnJtZGlyU3luYyhkaXIpO1xufSJdfQ==