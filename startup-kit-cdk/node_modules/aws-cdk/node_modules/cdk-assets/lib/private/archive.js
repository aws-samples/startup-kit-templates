"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zipDirectory = void 0;
const fs_1 = require("fs");
const path = require("path");
const archiver = require("archiver");
const glob = require("glob");
function zipDirectory(directory, outputFile) {
    return new Promise(async (ok, fail) => {
        // The below options are needed to support following symlinks when building zip files:
        // - nodir: This will prevent symlinks themselves from being copied into the zip.
        // - follow: This will follow symlinks and copy the files within.
        const globOptions = {
            dot: true,
            nodir: true,
            follow: true,
            cwd: directory,
        };
        const files = glob.sync('**', globOptions); // The output here is already sorted
        const output = fs_1.createWriteStream(outputFile);
        const archive = archiver('zip');
        archive.on('warning', fail);
        archive.on('error', fail);
        // archive has been finalized and the output file descriptor has closed, resolve promise
        // this has to be done before calling `finalize` since the events may fire immediately after.
        // see https://www.npmjs.com/package/archiver
        output.once('close', ok);
        archive.pipe(output);
        // Append files serially to ensure file order
        for (const file of files) {
            const fullPath = path.resolve(directory, file);
            const [data, stat] = await Promise.all([fs_1.promises.readFile(fullPath), fs_1.promises.stat(fullPath)]);
            archive.append(data, {
                name: file,
                date: new Date('1980-01-01T00:00:00.000Z'),
                mode: stat.mode,
            });
        }
        await archive.finalize();
    });
}
exports.zipDirectory = zipDirectory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl2ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFyY2hpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkJBQXVEO0FBQ3ZELDZCQUE2QjtBQUM3QixxQ0FBcUM7QUFDckMsNkJBQTZCO0FBRTdCLFNBQWdCLFlBQVksQ0FBQyxTQUFpQixFQUFFLFVBQWtCO0lBQ2hFLE9BQU8sSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUNwQyxzRkFBc0Y7UUFDdEYsaUZBQWlGO1FBQ2pGLGlFQUFpRTtRQUNqRSxNQUFNLFdBQVcsR0FBRztZQUNsQixHQUFHLEVBQUUsSUFBSTtZQUNULEtBQUssRUFBRSxJQUFJO1lBQ1gsTUFBTSxFQUFFLElBQUk7WUFDWixHQUFHLEVBQUUsU0FBUztTQUNmLENBQUM7UUFDRixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLG9DQUFvQztRQUVoRixNQUFNLE1BQU0sR0FBRyxzQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU3QyxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUIsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFMUIsd0ZBQXdGO1FBQ3hGLDZGQUE2RjtRQUM3Riw2Q0FBNkM7UUFDN0MsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFekIsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVyQiw2Q0FBNkM7UUFDN0MsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDL0MsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxhQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLGFBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25GLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO2dCQUNuQixJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsMEJBQTBCLENBQUM7Z0JBQzFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTthQUNoQixDQUFDLENBQUM7U0FDSjtRQUVELE1BQU0sT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBRTNCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQXhDRCxvQ0F3Q0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVXcml0ZVN0cmVhbSwgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcblxuZXhwb3J0IGZ1bmN0aW9uIHppcERpcmVjdG9yeShkaXJlY3Rvcnk6IHN0cmluZywgb3V0cHV0RmlsZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAob2ssIGZhaWwpID0+IHtcbiAgICAvLyBUaGUgYmVsb3cgb3B0aW9ucyBhcmUgbmVlZGVkIHRvIHN1cHBvcnQgZm9sbG93aW5nIHN5bWxpbmtzIHdoZW4gYnVpbGRpbmcgemlwIGZpbGVzOlxuICAgIC8vIC0gbm9kaXI6IFRoaXMgd2lsbCBwcmV2ZW50IHN5bWxpbmtzIHRoZW1zZWx2ZXMgZnJvbSBiZWluZyBjb3BpZWQgaW50byB0aGUgemlwLlxuICAgIC8vIC0gZm9sbG93OiBUaGlzIHdpbGwgZm9sbG93IHN5bWxpbmtzIGFuZCBjb3B5IHRoZSBmaWxlcyB3aXRoaW4uXG4gICAgY29uc3QgZ2xvYk9wdGlvbnMgPSB7XG4gICAgICBkb3Q6IHRydWUsXG4gICAgICBub2RpcjogdHJ1ZSxcbiAgICAgIGZvbGxvdzogdHJ1ZSxcbiAgICAgIGN3ZDogZGlyZWN0b3J5LFxuICAgIH07XG4gICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoJyoqJywgZ2xvYk9wdGlvbnMpOyAvLyBUaGUgb3V0cHV0IGhlcmUgaXMgYWxyZWFkeSBzb3J0ZWRcblxuICAgIGNvbnN0IG91dHB1dCA9IGNyZWF0ZVdyaXRlU3RyZWFtKG91dHB1dEZpbGUpO1xuXG4gICAgY29uc3QgYXJjaGl2ZSA9IGFyY2hpdmVyKCd6aXAnKTtcbiAgICBhcmNoaXZlLm9uKCd3YXJuaW5nJywgZmFpbCk7XG4gICAgYXJjaGl2ZS5vbignZXJyb3InLCBmYWlsKTtcblxuICAgIC8vIGFyY2hpdmUgaGFzIGJlZW4gZmluYWxpemVkIGFuZCB0aGUgb3V0cHV0IGZpbGUgZGVzY3JpcHRvciBoYXMgY2xvc2VkLCByZXNvbHZlIHByb21pc2VcbiAgICAvLyB0aGlzIGhhcyB0byBiZSBkb25lIGJlZm9yZSBjYWxsaW5nIGBmaW5hbGl6ZWAgc2luY2UgdGhlIGV2ZW50cyBtYXkgZmlyZSBpbW1lZGlhdGVseSBhZnRlci5cbiAgICAvLyBzZWUgaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2UvYXJjaGl2ZXJcbiAgICBvdXRwdXQub25jZSgnY2xvc2UnLCBvayk7XG5cbiAgICBhcmNoaXZlLnBpcGUob3V0cHV0KTtcblxuICAgIC8vIEFwcGVuZCBmaWxlcyBzZXJpYWxseSB0byBlbnN1cmUgZmlsZSBvcmRlclxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLnJlc29sdmUoZGlyZWN0b3J5LCBmaWxlKTtcbiAgICAgIGNvbnN0IFtkYXRhLCBzdGF0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtmcy5yZWFkRmlsZShmdWxsUGF0aCksIGZzLnN0YXQoZnVsbFBhdGgpXSk7XG4gICAgICBhcmNoaXZlLmFwcGVuZChkYXRhLCB7XG4gICAgICAgIG5hbWU6IGZpbGUsXG4gICAgICAgIGRhdGU6IG5ldyBEYXRlKCcxOTgwLTAxLTAxVDAwOjAwOjAwLjAwMFonKSwgLy8gcmVzZXQgZGF0ZXMgdG8gZ2V0IHRoZSBzYW1lIGhhc2ggZm9yIHRoZSBzYW1lIGNvbnRlbnRcbiAgICAgICAgbW9kZTogc3RhdC5tb2RlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXdhaXQgYXJjaGl2ZS5maW5hbGl6ZSgpO1xuXG4gIH0pO1xufSJdfQ==