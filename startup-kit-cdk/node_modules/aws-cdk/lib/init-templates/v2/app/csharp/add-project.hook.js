"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoke = void 0;
const child_process = require("child_process");
const path = require("path");
exports.invoke = async (targetDirectory) => {
    const slnPath = path.join(targetDirectory, 'src', '%name.PascalCased%.sln');
    const csprojPath = path.join(targetDirectory, 'src', '%name.PascalCased%', '%name.PascalCased%.csproj');
    const child = child_process.spawn('dotnet', ['sln', slnPath, 'add', csprojPath], {
        // Need this for Windows where we want .cmd and .bat to be found as well.
        shell: true,
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((resolve, reject) => {
        const stdout = new Array();
        child.stdout.on('data', chunk => {
            process.stdout.write(chunk);
            stdout.push(chunk);
        });
        child.once('error', reject);
        child.once('exit', code => {
            if (code === 0) {
                resolve(Buffer.concat(stdout).toString('utf-8'));
            }
            else {
                reject(new Error(`Could not add project %name.PascalCased%.csproj to solution %name.PascalCased%.sln. Error code: ${code}`));
            }
        });
    });
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkLXByb2plY3QuaG9vay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkZC1wcm9qZWN0Lmhvb2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0NBQStDO0FBQy9DLDZCQUE2QjtBQUdoQixRQUFBLE1BQU0sR0FBZSxLQUFLLEVBQUUsZUFBdUIsRUFBRSxFQUFFO0lBQ2xFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEtBQUssRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO0lBQzVFLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO0lBRXhHLE1BQU0sS0FBSyxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLEVBQUU7UUFDL0UseUVBQXlFO1FBQ3pFLEtBQUssRUFBRSxJQUFJO1FBQ1gsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUM7S0FDckMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxJQUFJLE9BQU8sQ0FBUyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLEtBQUssRUFBTyxDQUFDO1FBRWhDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFBRTtZQUM5QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JCLENBQUMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFNUIsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDeEIsSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO2dCQUNkLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2xEO2lCQUFNO2dCQUNMLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxtR0FBbUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQzlIO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNoaWxkX3Byb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgSW52b2tlSG9vayB9IGZyb20gJy4uLy4uLy4uLy4uL2luaXQnO1xuXG5leHBvcnQgY29uc3QgaW52b2tlOiBJbnZva2VIb29rID0gYXN5bmMgKHRhcmdldERpcmVjdG9yeTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHNsblBhdGggPSBwYXRoLmpvaW4odGFyZ2V0RGlyZWN0b3J5LCAnc3JjJywgJyVuYW1lLlBhc2NhbENhc2VkJS5zbG4nKTtcbiAgY29uc3QgY3Nwcm9qUGF0aCA9IHBhdGguam9pbih0YXJnZXREaXJlY3RvcnksICdzcmMnLCAnJW5hbWUuUGFzY2FsQ2FzZWQlJywgJyVuYW1lLlBhc2NhbENhc2VkJS5jc3Byb2onKTtcblxuICBjb25zdCBjaGlsZCA9IGNoaWxkX3Byb2Nlc3Muc3Bhd24oJ2RvdG5ldCcsIFsnc2xuJywgc2xuUGF0aCwgJ2FkZCcsIGNzcHJvalBhdGhdLCB7XG4gICAgLy8gTmVlZCB0aGlzIGZvciBXaW5kb3dzIHdoZXJlIHdlIHdhbnQgLmNtZCBhbmQgLmJhdCB0byBiZSBmb3VuZCBhcyB3ZWxsLlxuICAgIHNoZWxsOiB0cnVlLFxuICAgIHN0ZGlvOiBbJ2lnbm9yZScsICdwaXBlJywgJ2luaGVyaXQnXSxcbiAgfSk7XG5cbiAgYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3Qgc3Rkb3V0ID0gbmV3IEFycmF5PGFueT4oKTtcblxuICAgIGNoaWxkLnN0ZG91dC5vbignZGF0YScsIGNodW5rID0+IHtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNodW5rKTtcbiAgICAgIHN0ZG91dC5wdXNoKGNodW5rKTtcbiAgICB9KTtcblxuICAgIGNoaWxkLm9uY2UoJ2Vycm9yJywgcmVqZWN0KTtcblxuICAgIGNoaWxkLm9uY2UoJ2V4aXQnLCBjb2RlID0+IHtcbiAgICAgIGlmIChjb2RlID09PSAwKSB7XG4gICAgICAgIHJlc29sdmUoQnVmZmVyLmNvbmNhdChzdGRvdXQpLnRvU3RyaW5nKCd1dGYtOCcpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYENvdWxkIG5vdCBhZGQgcHJvamVjdCAlbmFtZS5QYXNjYWxDYXNlZCUuY3Nwcm9qIHRvIHNvbHV0aW9uICVuYW1lLlBhc2NhbENhc2VkJS5zbG4uIEVycm9yIGNvZGU6ICR7Y29kZX1gKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufTtcbiJdfQ==