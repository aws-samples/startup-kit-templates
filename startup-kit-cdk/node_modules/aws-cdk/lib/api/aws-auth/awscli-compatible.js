"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsCliCompatible = void 0;
const child_process = require("child_process");
const os = require("os");
const path = require("path");
const util = require("util");
const AWS = require("aws-sdk");
const fs = require("fs-extra");
const promptly = require("promptly");
const logging_1 = require("../../logging");
const aws_sdk_inifile_1 = require("./aws-sdk-inifile");
const sdk_ini_file_1 = require("./sdk_ini_file");
/**
 * Behaviors to match AWS CLI
 *
 * See these links:
 *
 * https://docs.aws.amazon.com/cli/latest/topic/config-vars.html
 * https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
 */
class AwsCliCompatible {
    /**
     * Build an AWS CLI-compatible credential chain provider
     *
     * This is similar to the default credential provider chain created by the SDK
     * except:
     *
     * 1. Accepts profile argument in the constructor (the SDK must have it prepopulated
     *    in the environment).
     * 2. Conditionally checks EC2 credentials, because checking for EC2
     *    credentials on a non-EC2 machine may lead to long delays (in the best case)
     *    or an exception (in the worst case).
     * 3. Respects $AWS_SHARED_CREDENTIALS_FILE.
     * 4. Respects $AWS_DEFAULT_PROFILE in addition to $AWS_PROFILE.
     */
    static async credentialChain(options = {}) {
        var _a, _b;
        // To match AWS CLI behavior, if a profile is explicitly given using --profile,
        // we use that to the exclusion of everything else (note: this does not apply
        // to AWS_PROFILE, environment credentials still take precedence over AWS_PROFILE)
        if (options.profile) {
            await forceSdkToReadConfigIfPresent();
            const theProfile = options.profile;
            return new AWS.CredentialProviderChain([
                () => profileCredentials(theProfile),
                () => new AWS.ProcessCredentials({ profile: theProfile }),
            ]);
        }
        const implicitProfile = process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE || 'default';
        const sources = [
            () => new AWS.EnvironmentCredentials('AWS'),
            () => new AWS.EnvironmentCredentials('AMAZON'),
        ];
        if (await fs.pathExists(credentialsFileName())) {
            // Force reading the `config` file if it exists by setting the appropriate
            // environment variable.
            await forceSdkToReadConfigIfPresent();
            sources.push(() => profileCredentials(implicitProfile));
            sources.push(() => new AWS.ProcessCredentials({ profile: implicitProfile }));
        }
        if ((_a = options.containerCreds) !== null && _a !== void 0 ? _a : hasEcsCredentials()) {
            sources.push(() => new AWS.ECSCredentials());
        }
        else if (hasWebIdentityCredentials()) {
            // else if: we have found WebIdentityCredentials as provided by EKS ServiceAccounts
            sources.push(() => new AWS.TokenFileWebIdentityCredentials());
        }
        else if ((_b = options.ec2instance) !== null && _b !== void 0 ? _b : await isEc2Instance()) {
            // else if: don't get EC2 creds if we should have gotten ECS or EKS creds
            // ECS and EKS instances also run on EC2 boxes but the creds represent something different.
            // Same behavior as upstream code.
            sources.push(() => new AWS.EC2MetadataCredentials());
        }
        return new AWS.CredentialProviderChain(sources);
        function profileCredentials(profileName) {
            return new aws_sdk_inifile_1.PatchedSharedIniFileCredentials({
                profile: profileName,
                filename: credentialsFileName(),
                httpOptions: options.httpOptions,
                tokenCodeFn,
            });
        }
    }
    /**
     * Return the default region in a CLI-compatible way
     *
     * Mostly copied from node_loader.js, but with the following differences to make it
     * AWS CLI compatible:
     *
     * 1. Takes a profile name as an argument (instead of forcing it to be taken from $AWS_PROFILE).
     *    This requires having made a copy of the SDK's `SharedIniFile` (the original
     *    does not take an argument).
     * 2. $AWS_DEFAULT_PROFILE and $AWS_DEFAULT_REGION are also respected.
     *
     * Lambda and CodeBuild set the $AWS_REGION variable.
     */
    static async region(options = {}) {
        var _a;
        const profile = options.profile || process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE || 'default';
        // Defaults inside constructor
        const toCheck = [
            { filename: credentialsFileName(), profile },
            { isConfig: true, filename: configFileName(), profile },
            { isConfig: true, filename: configFileName(), profile: 'default' },
        ];
        let region = process.env.AWS_REGION || process.env.AMAZON_REGION ||
            process.env.AWS_DEFAULT_REGION || process.env.AMAZON_DEFAULT_REGION;
        while (!region && toCheck.length > 0) {
            const opts = toCheck.shift();
            if (await fs.pathExists(opts.filename)) {
                const configFile = new sdk_ini_file_1.SharedIniFile(opts);
                const section = await configFile.getProfile(opts.profile);
                region = section === null || section === void 0 ? void 0 : section.region;
            }
        }
        if (!region && ((_a = options.ec2instance) !== null && _a !== void 0 ? _a : await isEc2Instance())) {
            logging_1.debug('Looking up AWS region in the EC2 Instance Metadata Service (IMDS).');
            const imdsOptions = {
                httpOptions: { timeout: 1000, connectTimeout: 1000 }, maxRetries: 2,
            };
            const metadataService = new AWS.MetadataService(imdsOptions);
            let token;
            try {
                token = await getImdsV2Token(metadataService);
            }
            catch (e) {
                logging_1.debug(`No IMDSv2 token: ${e}`);
            }
            try {
                region = await getRegionFromImds(metadataService, token);
                logging_1.debug(`AWS region from IMDS: ${region}`);
            }
            catch (e) {
                logging_1.debug(`Unable to retrieve AWS region from IMDS: ${e}`);
            }
        }
        if (!region) {
            const usedProfile = !profile ? '' : ` (profile: "${profile}")`;
            region = 'us-east-1'; // This is what the AWS CLI does
            logging_1.debug(`Unable to determine AWS region from environment or AWS configuration${usedProfile}, defaulting to '${region}'`);
        }
        return region;
    }
}
exports.AwsCliCompatible = AwsCliCompatible;
/**
 * Return whether it looks like we'll have ECS credentials available
 */
function hasEcsCredentials() {
    return AWS.ECSCredentials.prototype.isConfiguredForEcsCredentials();
}
/**
 * Return whether it looks like we'll have WebIdentityCredentials (that's what EKS uses) available
 * No check like hasEcsCredentials available, so have to implement our own.
 * @see https://github.com/aws/aws-sdk-js/blob/3ccfd94da07234ae87037f55c138392f38b6881d/lib/credentials/token_file_web_identity_credentials.js#L59
 */
function hasWebIdentityCredentials() {
    return Boolean(process.env.AWS_ROLE_ARN && process.env.AWS_WEB_IDENTITY_TOKEN_FILE);
}
/**
 * Return whether we're on an EC2 instance
 */
async function isEc2Instance() {
    if (isEc2InstanceCache === undefined) {
        logging_1.debug("Determining if we're on an EC2 instance.");
        let instance = false;
        if (process.platform === 'win32') {
            // https://docs.aws.amazon.com/AWSEC2/latest/WindowsGuide/identify_ec2_instances.html
            const result = await util.promisify(child_process.exec)('wmic path win32_computersystemproduct get uuid', { encoding: 'utf-8' });
            // output looks like
            //  UUID
            //  EC2AE145-D1DC-13B2-94ED-01234ABCDEF
            const lines = result.stdout.toString().split('\n');
            instance = lines.some(x => matchesRegex(/^ec2/i, x));
        }
        else {
            // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/identify_ec2_instances.html
            const files = [
                // This recognizes the Xen hypervisor based instances (pre-5th gen)
                ['/sys/hypervisor/uuid', /^ec2/i],
                // This recognizes the new Hypervisor (5th-gen instances and higher)
                // Can't use the advertised file '/sys/devices/virtual/dmi/id/product_uuid' because it requires root to read.
                // Instead, sys_vendor contains something like 'Amazon EC2'.
                ['/sys/devices/virtual/dmi/id/sys_vendor', /ec2/i],
            ];
            for (const [file, re] of files) {
                if (matchesRegex(re, readIfPossible(file))) {
                    instance = true;
                    break;
                }
            }
        }
        logging_1.debug(instance ? 'Looks like an EC2 instance.' : 'Does not look like an EC2 instance.');
        isEc2InstanceCache = instance;
    }
    return isEc2InstanceCache;
}
let isEc2InstanceCache = undefined;
/**
 * Attempts to get a Instance Metadata Service V2 token
 */
async function getImdsV2Token(metadataService) {
    logging_1.debug('Attempting to retrieve an IMDSv2 token.');
    return new Promise((resolve, reject) => {
        metadataService.request('/latest/api/token', {
            method: 'PUT',
            headers: { 'x-aws-ec2-metadata-token-ttl-seconds': '60' },
        }, (err, token) => {
            if (err) {
                reject(err);
            }
            else if (!token) {
                reject(new Error('IMDS did not return a token.'));
            }
            else {
                resolve(token);
            }
        });
    });
}
/**
 * Attempts to get the region from the Instance Metadata Service
 */
async function getRegionFromImds(metadataService, token) {
    logging_1.debug('Retrieving the AWS region from the IMDS.');
    let options = {};
    if (token) {
        options = { headers: { 'x-aws-ec2-metadata-token': token } };
    }
    return new Promise((resolve, reject) => {
        metadataService.request('/latest/dynamic/instance-identity/document', options, (err, instanceIdentityDocument) => {
            if (err) {
                reject(err);
            }
            else if (!instanceIdentityDocument) {
                reject(new Error('IMDS did not return an Instance Identity Document.'));
            }
            else {
                try {
                    resolve(JSON.parse(instanceIdentityDocument).region);
                }
                catch (e) {
                    reject(e);
                }
            }
        });
    });
}
function homeDir() {
    return process.env.HOME || process.env.USERPROFILE
        || (process.env.HOMEPATH ? ((process.env.HOMEDRIVE || 'C:/') + process.env.HOMEPATH) : null) || os.homedir();
}
function credentialsFileName() {
    return process.env.AWS_SHARED_CREDENTIALS_FILE || path.join(homeDir(), '.aws', 'credentials');
}
function configFileName() {
    return process.env.AWS_CONFIG_FILE || path.join(homeDir(), '.aws', 'config');
}
/**
 * Force the JS SDK to honor the ~/.aws/config file (and various settings therein)
 *
 * For example, there is just *NO* way to do AssumeRole credentials as long as AWS_SDK_LOAD_CONFIG is not set,
 * or read credentials from that file.
 *
 * The SDK crashes if the variable is set but the file does not exist, so conditionally set it.
 */
async function forceSdkToReadConfigIfPresent() {
    if (await fs.pathExists(configFileName())) {
        process.env.AWS_SDK_LOAD_CONFIG = '1';
    }
}
function matchesRegex(re, s) {
    return s !== undefined && re.exec(s) !== null;
}
/**
 * Read a file if it exists, or return undefined
 *
 * Not async because it is used in the constructor
 */
function readIfPossible(filename) {
    try {
        if (!fs.pathExistsSync(filename)) {
            return undefined;
        }
        return fs.readFileSync(filename, { encoding: 'utf-8' });
    }
    catch (e) {
        logging_1.debug(e);
        return undefined;
    }
}
/**
 * Ask user for MFA token for given serial
 *
 * Result is send to callback function for SDK to authorize the request
 */
async function tokenCodeFn(serialArn, cb) {
    logging_1.debug('Require MFA token for serial ARN', serialArn);
    try {
        const token = await promptly.prompt(`MFA token for ${serialArn}: `, {
            trim: true,
            default: '',
        });
        logging_1.debug('Successfully got MFA token from user');
        cb(undefined, token);
    }
    catch (err) {
        logging_1.debug('Failed to get MFA token', err);
        cb(err);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzY2xpLWNvbXBhdGlibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhd3NjbGktY29tcGF0aWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQ0FBK0M7QUFDL0MseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3Qiw2QkFBNkI7QUFDN0IsK0JBQStCO0FBQy9CLCtCQUErQjtBQUMvQixxQ0FBcUM7QUFDckMsMkNBQXNDO0FBQ3RDLHVEQUFvRTtBQUNwRSxpREFBK0M7QUFFL0M7Ozs7Ozs7R0FPRztBQUNILE1BQWEsZ0JBQWdCO0lBQzNCOzs7Ozs7Ozs7Ozs7O09BYUc7SUFDSSxNQUFNLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxVQUFrQyxFQUFFOztRQUV0RSwrRUFBK0U7UUFDL0UsNkVBQTZFO1FBQzdFLGtGQUFrRjtRQUNsRixJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUU7WUFDbkIsTUFBTSw2QkFBNkIsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDbkMsT0FBTyxJQUFJLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQztnQkFDckMsR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDO2dCQUNwQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQzthQUMxRCxDQUFDLENBQUM7U0FDSjtRQUVELE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksU0FBUyxDQUFDO1FBRWhHLE1BQU0sT0FBTyxHQUFHO1lBQ2QsR0FBRyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDO1lBQzNDLEdBQUcsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLHNCQUFzQixDQUFDLFFBQVEsQ0FB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QUFDLEVBQUU7UUFDVixlQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDVCxPQUFPLFNBQVMsQ0FBQztLQUNsQjtBQUNILENBQUM7QUFjRDs7OztHQUlHO0FBQ0gsS0FBSyxVQUFVLFdBQVcsQ0FBQyxTQUFpQixFQUFFLEVBQXlDO0lBQ3JGLGVBQUssQ0FBQyxrQ0FBa0MsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNyRCxJQUFJO1FBQ0YsTUFBTSxLQUFLLEdBQVcsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDLGlCQUFpQixTQUFTLElBQUksRUFBRTtZQUMxRSxJQUFJLEVBQUUsSUFBSTtZQUNWLE9BQU8sRUFBRSxFQUFFO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsZUFBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7UUFDOUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztLQUN0QjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osZUFBSyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3RDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNUO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNoaWxkX3Byb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICd1dGlsJztcbmltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCAqIGFzIHByb21wdGx5IGZyb20gJ3Byb21wdGx5JztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi4vLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBQYXRjaGVkU2hhcmVkSW5pRmlsZUNyZWRlbnRpYWxzIH0gZnJvbSAnLi9hd3Mtc2RrLWluaWZpbGUnO1xuaW1wb3J0IHsgU2hhcmVkSW5pRmlsZSB9IGZyb20gJy4vc2RrX2luaV9maWxlJztcblxuLyoqXG4gKiBCZWhhdmlvcnMgdG8gbWF0Y2ggQVdTIENMSVxuICpcbiAqIFNlZSB0aGVzZSBsaW5rczpcbiAqXG4gKiBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY2xpL2xhdGVzdC90b3BpYy9jb25maWctdmFycy5odG1sXG4gKiBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY2xpL2xhdGVzdC91c2VyZ3VpZGUvY2xpLWNvbmZpZ3VyZS1lbnZ2YXJzLmh0bWxcbiAqL1xuZXhwb3J0IGNsYXNzIEF3c0NsaUNvbXBhdGlibGUge1xuICAvKipcbiAgICogQnVpbGQgYW4gQVdTIENMSS1jb21wYXRpYmxlIGNyZWRlbnRpYWwgY2hhaW4gcHJvdmlkZXJcbiAgICpcbiAgICogVGhpcyBpcyBzaW1pbGFyIHRvIHRoZSBkZWZhdWx0IGNyZWRlbnRpYWwgcHJvdmlkZXIgY2hhaW4gY3JlYXRlZCBieSB0aGUgU0RLXG4gICAqIGV4Y2VwdDpcbiAgICpcbiAgICogMS4gQWNjZXB0cyBwcm9maWxlIGFyZ3VtZW50IGluIHRoZSBjb25zdHJ1Y3RvciAodGhlIFNESyBtdXN0IGhhdmUgaXQgcHJlcG9wdWxhdGVkXG4gICAqICAgIGluIHRoZSBlbnZpcm9ubWVudCkuXG4gICAqIDIuIENvbmRpdGlvbmFsbHkgY2hlY2tzIEVDMiBjcmVkZW50aWFscywgYmVjYXVzZSBjaGVja2luZyBmb3IgRUMyXG4gICAqICAgIGNyZWRlbnRpYWxzIG9uIGEgbm9uLUVDMiBtYWNoaW5lIG1heSBsZWFkIHRvIGxvbmcgZGVsYXlzIChpbiB0aGUgYmVzdCBjYXNlKVxuICAgKiAgICBvciBhbiBleGNlcHRpb24gKGluIHRoZSB3b3JzdCBjYXNlKS5cbiAgICogMy4gUmVzcGVjdHMgJEFXU19TSEFSRURfQ1JFREVOVElBTFNfRklMRS5cbiAgICogNC4gUmVzcGVjdHMgJEFXU19ERUZBVUxUX1BST0ZJTEUgaW4gYWRkaXRpb24gdG8gJEFXU19QUk9GSUxFLlxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBhc3luYyBjcmVkZW50aWFsQ2hhaW4ob3B0aW9uczogQ3JlZGVudGlhbENoYWluT3B0aW9ucyA9IHt9KSB7XG5cbiAgICAvLyBUbyBtYXRjaCBBV1MgQ0xJIGJlaGF2aW9yLCBpZiBhIHByb2ZpbGUgaXMgZXhwbGljaXRseSBnaXZlbiB1c2luZyAtLXByb2ZpbGUsXG4gICAgLy8gd2UgdXNlIHRoYXQgdG8gdGhlIGV4Y2x1c2lvbiBvZiBldmVyeXRoaW5nIGVsc2UgKG5vdGU6IHRoaXMgZG9lcyBub3QgYXBwbHlcbiAgICAvLyB0byBBV1NfUFJPRklMRSwgZW52aXJvbm1lbnQgY3JlZGVudGlhbHMgc3RpbGwgdGFrZSBwcmVjZWRlbmNlIG92ZXIgQVdTX1BST0ZJTEUpXG4gICAgaWYgKG9wdGlvbnMucHJvZmlsZSkge1xuICAgICAgYXdhaXQgZm9yY2VTZGtUb1JlYWRDb25maWdJZlByZXNlbnQoKTtcbiAgICAgIGNvbnN0IHRoZVByb2ZpbGUgPSBvcHRpb25zLnByb2ZpbGU7XG4gICAgICByZXR1cm4gbmV3IEFXUy5DcmVkZW50aWFsUHJvdmlkZXJDaGFpbihbXG4gICAgICAgICgpID0+IHByb2ZpbGVDcmVkZW50aWFscyh0aGVQcm9maWxlKSxcbiAgICAgICAgKCkgPT4gbmV3IEFXUy5Qcm9jZXNzQ3JlZGVudGlhbHMoeyBwcm9maWxlOiB0aGVQcm9maWxlIH0pLFxuICAgICAgXSk7XG4gICAgfVxuXG4gICAgY29uc3QgaW1wbGljaXRQcm9maWxlID0gcHJvY2Vzcy5lbnYuQVdTX1BST0ZJTEUgfHwgcHJvY2Vzcy5lbnYuQVdTX0RFRkFVTFRfUFJPRklMRSB8fCAnZGVmYXVsdCc7XG5cbiAgICBjb25zdCBzb3VyY2VzID0gW1xuICAgICAgKCkgPT4gbmV3IEFXUy5FbnZpcm9ubWVudENyZWRlbnRpYWxzKCdBV1MnKSxcbiAgICAgICgpID0+IG5ldyBBV1MuRW52aXJvbm1lbnRDcmVkZW50aWFscygnQU1BWk9OJyksXG4gICAgXTtcblxuICAgIGlmIChhd2FpdCBmcy5wYXRoRXhpc3RzKGNyZWRlbnRpYWxzRmlsZU5hbWUoKSkpIHtcbiAgICAgIC8vIEZvcmNlIHJlYWRpbmcgdGhlIGBjb25maWdgIGZpbGUgaWYgaXQgZXhpc3RzIGJ5IHNldHRpbmcgdGhlIGFwcHJvcHJpYXRlXG4gICAgICAvLyBlbnZpcm9ubWVudCB2YXJpYWJsZS5cbiAgICAgIGF3YWl0IGZvcmNlU2RrVG9SZWFkQ29uZmlnSWZQcmVzZW50KCk7XG4gICAgICBzb3VyY2VzLnB1c2goKCkgPT4gcHJvZmlsZUNyZWRlbnRpYWxzKGltcGxpY2l0UHJvZmlsZSkpO1xuICAgICAgc291cmNlcy5wdXNoKCgpID0+IG5ldyBBV1MuUHJvY2Vzc0NyZWRlbnRpYWxzKHsgcHJvZmlsZTogaW1wbGljaXRQcm9maWxlIH0pKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5jb250YWluZXJDcmVkcyA/PyBoYXNFY3NDcmVkZW50aWFscygpKSB7XG4gICAgICBzb3VyY2VzLnB1c2goKCkgPT4gbmV3IEFXUy5FQ1NDcmVkZW50aWFscygpKTtcbiAgICB9IGVsc2UgaWYgKGhhc1dlYklkZW50aXR5Q3JlZGVudGlhbHMoKSkge1xuICAgICAgLy8gZWxzZSBpZjogd2UgaGF2ZSBmb3VuZCBXZWJJZGVudGl0eUNyZWRlbnRpYWxzIGFzIHByb3ZpZGVkIGJ5IEVLUyBTZXJ2aWNlQWNjb3VudHNcbiAgICAgIHNvdXJjZXMucHVzaCgoKSA9PiBuZXcgQVdTLlRva2VuRmlsZVdlYklkZW50aXR5Q3JlZGVudGlhbHMoKSk7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmVjMmluc3RhbmNlID8/IGF3YWl0IGlzRWMySW5zdGFuY2UoKSkge1xuICAgICAgLy8gZWxzZSBpZjogZG9uJ3QgZ2V0IEVDMiBjcmVkcyBpZiB3ZSBzaG91bGQgaGF2ZSBnb3R0ZW4gRUNTIG9yIEVLUyBjcmVkc1xuICAgICAgLy8gRUNTIGFuZCBFS1MgaW5zdGFuY2VzIGFsc28gcnVuIG9uIEVDMiBib3hlcyBidXQgdGhlIGNyZWRzIHJlcHJlc2VudCBzb21ldGhpbmcgZGlmZmVyZW50LlxuICAgICAgLy8gU2FtZSBiZWhhdmlvciBhcyB1cHN0cmVhbSBjb2RlLlxuICAgICAgc291cmNlcy5wdXNoKCgpID0+IG5ldyBBV1MuRUMyTWV0YWRhdGFDcmVkZW50aWFscygpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFXUy5DcmVkZW50aWFsUHJvdmlkZXJDaGFpbihzb3VyY2VzKTtcblxuICAgIGZ1bmN0aW9uIHByb2ZpbGVDcmVkZW50aWFscyhwcm9maWxlTmFtZTogc3RyaW5nKSB7XG4gICAgICByZXR1cm4gbmV3IFBhdGNoZWRTaGFyZWRJbmlGaWxlQ3JlZGVudGlhbHMoe1xuICAgICAgICBwcm9maWxlOiBwcm9maWxlTmFtZSxcbiAgICAgICAgZmlsZW5hbWU6IGNyZWRlbnRpYWxzRmlsZU5hbWUoKSxcbiAgICAgICAgaHR0cE9wdGlvbnM6IG9wdGlvbnMuaHR0cE9wdGlvbnMsXG4gICAgICAgIHRva2VuQ29kZUZuLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgZGVmYXVsdCByZWdpb24gaW4gYSBDTEktY29tcGF0aWJsZSB3YXlcbiAgICpcbiAgICogTW9zdGx5IGNvcGllZCBmcm9tIG5vZGVfbG9hZGVyLmpzLCBidXQgd2l0aCB0aGUgZm9sbG93aW5nIGRpZmZlcmVuY2VzIHRvIG1ha2UgaXRcbiAgICogQVdTIENMSSBjb21wYXRpYmxlOlxuICAgKlxuICAgKiAxLiBUYWtlcyBhIHByb2ZpbGUgbmFtZSBhcyBhbiBhcmd1bWVudCAoaW5zdGVhZCBvZiBmb3JjaW5nIGl0IHRvIGJlIHRha2VuIGZyb20gJEFXU19QUk9GSUxFKS5cbiAgICogICAgVGhpcyByZXF1aXJlcyBoYXZpbmcgbWFkZSBhIGNvcHkgb2YgdGhlIFNESydzIGBTaGFyZWRJbmlGaWxlYCAodGhlIG9yaWdpbmFsXG4gICAqICAgIGRvZXMgbm90IHRha2UgYW4gYXJndW1lbnQpLlxuICAgKiAyLiAkQVdTX0RFRkFVTFRfUFJPRklMRSBhbmQgJEFXU19ERUZBVUxUX1JFR0lPTiBhcmUgYWxzbyByZXNwZWN0ZWQuXG4gICAqXG4gICAqIExhbWJkYSBhbmQgQ29kZUJ1aWxkIHNldCB0aGUgJEFXU19SRUdJT04gdmFyaWFibGUuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIHJlZ2lvbihvcHRpb25zOiBSZWdpb25PcHRpb25zID0ge30pOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHByb2ZpbGUgPSBvcHRpb25zLnByb2ZpbGUgfHwgcHJvY2Vzcy5lbnYuQVdTX1BST0ZJTEUgfHwgcHJvY2Vzcy5lbnYuQVdTX0RFRkFVTFRfUFJPRklMRSB8fCAnZGVmYXVsdCc7XG5cbiAgICAvLyBEZWZhdWx0cyBpbnNpZGUgY29uc3RydWN0b3JcbiAgICBjb25zdCB0b0NoZWNrID0gW1xuICAgICAgeyBmaWxlbmFtZTogY3JlZGVudGlhbHNGaWxlTmFtZSgpLCBwcm9maWxlIH0sXG4gICAgICB7IGlzQ29uZmlnOiB0cnVlLCBmaWxlbmFtZTogY29uZmlnRmlsZU5hbWUoKSwgcHJvZmlsZSB9LFxuICAgICAgeyBpc0NvbmZpZzogdHJ1ZSwgZmlsZW5hbWU6IGNvbmZpZ0ZpbGVOYW1lKCksIHByb2ZpbGU6ICdkZWZhdWx0JyB9LFxuICAgIF07XG5cbiAgICBsZXQgcmVnaW9uID0gcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fCBwcm9jZXNzLmVudi5BTUFaT05fUkVHSU9OIHx8XG4gICAgICBwcm9jZXNzLmVudi5BV1NfREVGQVVMVF9SRUdJT04gfHwgcHJvY2Vzcy5lbnYuQU1BWk9OX0RFRkFVTFRfUkVHSU9OO1xuXG4gICAgd2hpbGUgKCFyZWdpb24gJiYgdG9DaGVjay5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBvcHRzID0gdG9DaGVjay5zaGlmdCgpITtcbiAgICAgIGlmIChhd2FpdCBmcy5wYXRoRXhpc3RzKG9wdHMuZmlsZW5hbWUpKSB7XG4gICAgICAgIGNvbnN0IGNvbmZpZ0ZpbGUgPSBuZXcgU2hhcmVkSW5pRmlsZShvcHRzKTtcbiAgICAgICAgY29uc3Qgc2VjdGlvbiA9IGF3YWl0IGNvbmZpZ0ZpbGUuZ2V0UHJvZmlsZShvcHRzLnByb2ZpbGUpO1xuICAgICAgICByZWdpb24gPSBzZWN0aW9uPy5yZWdpb247XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFyZWdpb24gJiYgKG9wdGlvbnMuZWMyaW5zdGFuY2UgPz8gYXdhaXQgaXNFYzJJbnN0YW5jZSgpKSkge1xuICAgICAgZGVidWcoJ0xvb2tpbmcgdXAgQVdTIHJlZ2lvbiBpbiB0aGUgRUMyIEluc3RhbmNlIE1ldGFkYXRhIFNlcnZpY2UgKElNRFMpLicpO1xuICAgICAgY29uc3QgaW1kc09wdGlvbnMgPSB7XG4gICAgICAgIGh0dHBPcHRpb25zOiB7IHRpbWVvdXQ6IDEwMDAsIGNvbm5lY3RUaW1lb3V0OiAxMDAwIH0sIG1heFJldHJpZXM6IDIsXG4gICAgICB9O1xuICAgICAgY29uc3QgbWV0YWRhdGFTZXJ2aWNlID0gbmV3IEFXUy5NZXRhZGF0YVNlcnZpY2UoaW1kc09wdGlvbnMpO1xuXG4gICAgICBsZXQgdG9rZW47XG4gICAgICB0cnkge1xuICAgICAgICB0b2tlbiA9IGF3YWl0IGdldEltZHNWMlRva2VuKG1ldGFkYXRhU2VydmljZSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGRlYnVnKGBObyBJTURTdjIgdG9rZW46ICR7ZX1gKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgcmVnaW9uID0gYXdhaXQgZ2V0UmVnaW9uRnJvbUltZHMobWV0YWRhdGFTZXJ2aWNlLCB0b2tlbik7XG4gICAgICAgIGRlYnVnKGBBV1MgcmVnaW9uIGZyb20gSU1EUzogJHtyZWdpb259YCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGRlYnVnKGBVbmFibGUgdG8gcmV0cmlldmUgQVdTIHJlZ2lvbiBmcm9tIElNRFM6ICR7ZX1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXJlZ2lvbikge1xuICAgICAgY29uc3QgdXNlZFByb2ZpbGUgPSAhcHJvZmlsZSA/ICcnIDogYCAocHJvZmlsZTogXCIke3Byb2ZpbGV9XCIpYDtcbiAgICAgIHJlZ2lvbiA9ICd1cy1lYXN0LTEnOyAvLyBUaGlzIGlzIHdoYXQgdGhlIEFXUyBDTEkgZG9lc1xuICAgICAgZGVidWcoYFVuYWJsZSB0byBkZXRlcm1pbmUgQVdTIHJlZ2lvbiBmcm9tIGVudmlyb25tZW50IG9yIEFXUyBjb25maWd1cmF0aW9uJHt1c2VkUHJvZmlsZX0sIGRlZmF1bHRpbmcgdG8gJyR7cmVnaW9ufSdgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVnaW9uO1xuICB9XG59XG5cbi8qKlxuICogUmV0dXJuIHdoZXRoZXIgaXQgbG9va3MgbGlrZSB3ZSdsbCBoYXZlIEVDUyBjcmVkZW50aWFscyBhdmFpbGFibGVcbiAqL1xuZnVuY3Rpb24gaGFzRWNzQ3JlZGVudGlhbHMoKTogYm9vbGVhbiB7XG4gIHJldHVybiAoQVdTLkVDU0NyZWRlbnRpYWxzLnByb3RvdHlwZSBhcyBhbnkpLmlzQ29uZmlndXJlZEZvckVjc0NyZWRlbnRpYWxzKCk7XG59XG5cbi8qKlxuICogUmV0dXJuIHdoZXRoZXIgaXQgbG9va3MgbGlrZSB3ZSdsbCBoYXZlIFdlYklkZW50aXR5Q3JlZGVudGlhbHMgKHRoYXQncyB3aGF0IEVLUyB1c2VzKSBhdmFpbGFibGVcbiAqIE5vIGNoZWNrIGxpa2UgaGFzRWNzQ3JlZGVudGlhbHMgYXZhaWxhYmxlLCBzbyBoYXZlIHRvIGltcGxlbWVudCBvdXIgb3duLlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1zZGstanMvYmxvYi8zY2NmZDk0ZGEwNzIzNGFlODcwMzdmNTVjMTM4MzkyZjM4YjY4ODFkL2xpYi9jcmVkZW50aWFscy90b2tlbl9maWxlX3dlYl9pZGVudGl0eV9jcmVkZW50aWFscy5qcyNMNTlcbiAqL1xuZnVuY3Rpb24gaGFzV2ViSWRlbnRpdHlDcmVkZW50aWFscygpOiBib29sZWFuIHtcbiAgcmV0dXJuIEJvb2xlYW4ocHJvY2Vzcy5lbnYuQVdTX1JPTEVfQVJOICYmIHByb2Nlc3MuZW52LkFXU19XRUJfSURFTlRJVFlfVE9LRU5fRklMRSk7XG59XG5cbi8qKlxuICogUmV0dXJuIHdoZXRoZXIgd2UncmUgb24gYW4gRUMyIGluc3RhbmNlXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGlzRWMySW5zdGFuY2UoKSB7XG4gIGlmIChpc0VjMkluc3RhbmNlQ2FjaGUgPT09IHVuZGVmaW5lZCkge1xuICAgIGRlYnVnKFwiRGV0ZXJtaW5pbmcgaWYgd2UncmUgb24gYW4gRUMyIGluc3RhbmNlLlwiKTtcbiAgICBsZXQgaW5zdGFuY2UgPSBmYWxzZTtcbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgLy8gaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL0FXU0VDMi9sYXRlc3QvV2luZG93c0d1aWRlL2lkZW50aWZ5X2VjMl9pbnN0YW5jZXMuaHRtbFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXRpbC5wcm9taXNpZnkoY2hpbGRfcHJvY2Vzcy5leGVjKSgnd21pYyBwYXRoIHdpbjMyX2NvbXB1dGVyc3lzdGVtcHJvZHVjdCBnZXQgdXVpZCcsIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSk7XG4gICAgICAvLyBvdXRwdXQgbG9va3MgbGlrZVxuICAgICAgLy8gIFVVSURcbiAgICAgIC8vICBFQzJBRTE0NS1EMURDLTEzQjItOTRFRC0wMTIzNEFCQ0RFRlxuICAgICAgY29uc3QgbGluZXMgPSByZXN1bHQuc3Rkb3V0LnRvU3RyaW5nKCkuc3BsaXQoJ1xcbicpO1xuICAgICAgaW5zdGFuY2UgPSBsaW5lcy5zb21lKHggPT4gbWF0Y2hlc1JlZ2V4KC9eZWMyL2ksIHgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL0FXU0VDMi9sYXRlc3QvVXNlckd1aWRlL2lkZW50aWZ5X2VjMl9pbnN0YW5jZXMuaHRtbFxuICAgICAgY29uc3QgZmlsZXM6IEFycmF5PFtzdHJpbmcsIFJlZ0V4cF0+ID0gW1xuICAgICAgICAvLyBUaGlzIHJlY29nbml6ZXMgdGhlIFhlbiBoeXBlcnZpc29yIGJhc2VkIGluc3RhbmNlcyAocHJlLTV0aCBnZW4pXG4gICAgICAgIFsnL3N5cy9oeXBlcnZpc29yL3V1aWQnLCAvXmVjMi9pXSxcblxuICAgICAgICAvLyBUaGlzIHJlY29nbml6ZXMgdGhlIG5ldyBIeXBlcnZpc29yICg1dGgtZ2VuIGluc3RhbmNlcyBhbmQgaGlnaGVyKVxuICAgICAgICAvLyBDYW4ndCB1c2UgdGhlIGFkdmVydGlzZWQgZmlsZSAnL3N5cy9kZXZpY2VzL3ZpcnR1YWwvZG1pL2lkL3Byb2R1Y3RfdXVpZCcgYmVjYXVzZSBpdCByZXF1aXJlcyByb290IHRvIHJlYWQuXG4gICAgICAgIC8vIEluc3RlYWQsIHN5c192ZW5kb3IgY29udGFpbnMgc29tZXRoaW5nIGxpa2UgJ0FtYXpvbiBFQzInLlxuICAgICAgICBbJy9zeXMvZGV2aWNlcy92aXJ0dWFsL2RtaS9pZC9zeXNfdmVuZG9yJywgL2VjMi9pXSxcbiAgICAgIF07XG4gICAgICBmb3IgKGNvbnN0IFtmaWxlLCByZV0gb2YgZmlsZXMpIHtcbiAgICAgICAgaWYgKG1hdGNoZXNSZWdleChyZSwgcmVhZElmUG9zc2libGUoZmlsZSkpKSB7XG4gICAgICAgICAgaW5zdGFuY2UgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGRlYnVnKGluc3RhbmNlID8gJ0xvb2tzIGxpa2UgYW4gRUMyIGluc3RhbmNlLicgOiAnRG9lcyBub3QgbG9vayBsaWtlIGFuIEVDMiBpbnN0YW5jZS4nKTtcbiAgICBpc0VjMkluc3RhbmNlQ2FjaGUgPSBpbnN0YW5jZTtcbiAgfVxuICByZXR1cm4gaXNFYzJJbnN0YW5jZUNhY2hlO1xufVxuXG5cbmxldCBpc0VjMkluc3RhbmNlQ2FjaGU6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbi8qKlxuICogQXR0ZW1wdHMgdG8gZ2V0IGEgSW5zdGFuY2UgTWV0YWRhdGEgU2VydmljZSBWMiB0b2tlblxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRJbWRzVjJUb2tlbihtZXRhZGF0YVNlcnZpY2U6IEFXUy5NZXRhZGF0YVNlcnZpY2UpOiBQcm9taXNlPHN0cmluZz4ge1xuICBkZWJ1ZygnQXR0ZW1wdGluZyB0byByZXRyaWV2ZSBhbiBJTURTdjIgdG9rZW4uJyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgbWV0YWRhdGFTZXJ2aWNlLnJlcXVlc3QoXG4gICAgICAnL2xhdGVzdC9hcGkvdG9rZW4nLFxuICAgICAge1xuICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICBoZWFkZXJzOiB7ICd4LWF3cy1lYzItbWV0YWRhdGEtdG9rZW4tdHRsLXNlY29uZHMnOiAnNjAnIH0sXG4gICAgICB9LFxuICAgICAgKGVycjogQVdTLkFXU0Vycm9yLCB0b2tlbjogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSBlbHNlIGlmICghdG9rZW4pIHtcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdJTURTIGRpZCBub3QgcmV0dXJuIGEgdG9rZW4uJykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUodG9rZW4pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfSk7XG59XG5cbi8qKlxuICogQXR0ZW1wdHMgdG8gZ2V0IHRoZSByZWdpb24gZnJvbSB0aGUgSW5zdGFuY2UgTWV0YWRhdGEgU2VydmljZVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRSZWdpb25Gcm9tSW1kcyhtZXRhZGF0YVNlcnZpY2U6IEFXUy5NZXRhZGF0YVNlcnZpY2UsIHRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPHN0cmluZz4ge1xuICBkZWJ1ZygnUmV0cmlldmluZyB0aGUgQVdTIHJlZ2lvbiBmcm9tIHRoZSBJTURTLicpO1xuICBsZXQgb3B0aW9uczogeyBtZXRob2Q/OiBzdHJpbmcgfCB1bmRlZmluZWQ7IGhlYWRlcnM/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZzsgfSB8IHVuZGVmaW5lZDsgfSA9IHt9O1xuICBpZiAodG9rZW4pIHtcbiAgICBvcHRpb25zID0geyBoZWFkZXJzOiB7ICd4LWF3cy1lYzItbWV0YWRhdGEtdG9rZW4nOiB0b2tlbiB9IH07XG4gIH1cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBtZXRhZGF0YVNlcnZpY2UucmVxdWVzdChcbiAgICAgICcvbGF0ZXN0L2R5bmFtaWMvaW5zdGFuY2UtaWRlbnRpdHkvZG9jdW1lbnQnLFxuICAgICAgb3B0aW9ucyxcbiAgICAgIChlcnI6IEFXUy5BV1NFcnJvciwgaW5zdGFuY2VJZGVudGl0eURvY3VtZW50OiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9IGVsc2UgaWYgKCFpbnN0YW5jZUlkZW50aXR5RG9jdW1lbnQpIHtcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdJTURTIGRpZCBub3QgcmV0dXJuIGFuIEluc3RhbmNlIElkZW50aXR5IERvY3VtZW50LicpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzb2x2ZShKU09OLnBhcnNlKGluc3RhbmNlSWRlbnRpdHlEb2N1bWVudCkucmVnaW9uKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGhvbWVEaXIoKSB7XG4gIHJldHVybiBwcm9jZXNzLmVudi5IT01FIHx8IHByb2Nlc3MuZW52LlVTRVJQUk9GSUxFXG4gICAgfHwgKHByb2Nlc3MuZW52LkhPTUVQQVRIID8gKChwcm9jZXNzLmVudi5IT01FRFJJVkUgfHwgJ0M6LycpICsgcHJvY2Vzcy5lbnYuSE9NRVBBVEgpIDogbnVsbCkgfHwgb3MuaG9tZWRpcigpO1xufVxuXG5mdW5jdGlvbiBjcmVkZW50aWFsc0ZpbGVOYW1lKCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuQVdTX1NIQVJFRF9DUkVERU5USUFMU19GSUxFIHx8IHBhdGguam9pbihob21lRGlyKCksICcuYXdzJywgJ2NyZWRlbnRpYWxzJyk7XG59XG5cbmZ1bmN0aW9uIGNvbmZpZ0ZpbGVOYW1lKCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuQVdTX0NPTkZJR19GSUxFIHx8IHBhdGguam9pbihob21lRGlyKCksICcuYXdzJywgJ2NvbmZpZycpO1xufVxuXG4vKipcbiAqIEZvcmNlIHRoZSBKUyBTREsgdG8gaG9ub3IgdGhlIH4vLmF3cy9jb25maWcgZmlsZSAoYW5kIHZhcmlvdXMgc2V0dGluZ3MgdGhlcmVpbilcbiAqXG4gKiBGb3IgZXhhbXBsZSwgdGhlcmUgaXMganVzdCAqTk8qIHdheSB0byBkbyBBc3N1bWVSb2xlIGNyZWRlbnRpYWxzIGFzIGxvbmcgYXMgQVdTX1NES19MT0FEX0NPTkZJRyBpcyBub3Qgc2V0LFxuICogb3IgcmVhZCBjcmVkZW50aWFscyBmcm9tIHRoYXQgZmlsZS5cbiAqXG4gKiBUaGUgU0RLIGNyYXNoZXMgaWYgdGhlIHZhcmlhYmxlIGlzIHNldCBidXQgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3QsIHNvIGNvbmRpdGlvbmFsbHkgc2V0IGl0LlxuICovXG5hc3luYyBmdW5jdGlvbiBmb3JjZVNka1RvUmVhZENvbmZpZ0lmUHJlc2VudCgpIHtcbiAgaWYgKGF3YWl0IGZzLnBhdGhFeGlzdHMoY29uZmlnRmlsZU5hbWUoKSkpIHtcbiAgICBwcm9jZXNzLmVudi5BV1NfU0RLX0xPQURfQ09ORklHID0gJzEnO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXNSZWdleChyZTogUmVnRXhwLCBzOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcbiAgcmV0dXJuIHMgIT09IHVuZGVmaW5lZCAmJiByZS5leGVjKHMpICE9PSBudWxsO1xufVxuXG4vKipcbiAqIFJlYWQgYSBmaWxlIGlmIGl0IGV4aXN0cywgb3IgcmV0dXJuIHVuZGVmaW5lZFxuICpcbiAqIE5vdCBhc3luYyBiZWNhdXNlIGl0IGlzIHVzZWQgaW4gdGhlIGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIHJlYWRJZlBvc3NpYmxlKGZpbGVuYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICB0cnkge1xuICAgIGlmICghZnMucGF0aEV4aXN0c1N5bmMoZmlsZW5hbWUpKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cbiAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCB7IGVuY29kaW5nOiAndXRmLTgnIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZGVidWcoZSk7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENyZWRlbnRpYWxDaGFpbk9wdGlvbnMge1xuICByZWFkb25seSBwcm9maWxlPzogc3RyaW5nO1xuICByZWFkb25seSBlYzJpbnN0YW5jZT86IGJvb2xlYW47XG4gIHJlYWRvbmx5IGNvbnRhaW5lckNyZWRzPzogYm9vbGVhbjtcbiAgcmVhZG9ubHkgaHR0cE9wdGlvbnM/OiBBV1MuSFRUUE9wdGlvbnM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVnaW9uT3B0aW9ucyB7XG4gIHJlYWRvbmx5IHByb2ZpbGU/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGVjMmluc3RhbmNlPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBBc2sgdXNlciBmb3IgTUZBIHRva2VuIGZvciBnaXZlbiBzZXJpYWxcbiAqXG4gKiBSZXN1bHQgaXMgc2VuZCB0byBjYWxsYmFjayBmdW5jdGlvbiBmb3IgU0RLIHRvIGF1dGhvcml6ZSB0aGUgcmVxdWVzdFxuICovXG5hc3luYyBmdW5jdGlvbiB0b2tlbkNvZGVGbihzZXJpYWxBcm46IHN0cmluZywgY2I6IChlcnI/OiBFcnJvciwgdG9rZW4/OiBzdHJpbmcpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgZGVidWcoJ1JlcXVpcmUgTUZBIHRva2VuIGZvciBzZXJpYWwgQVJOJywgc2VyaWFsQXJuKTtcbiAgdHJ5IHtcbiAgICBjb25zdCB0b2tlbjogc3RyaW5nID0gYXdhaXQgcHJvbXB0bHkucHJvbXB0KGBNRkEgdG9rZW4gZm9yICR7c2VyaWFsQXJufTogYCwge1xuICAgICAgdHJpbTogdHJ1ZSxcbiAgICAgIGRlZmF1bHQ6ICcnLFxuICAgIH0pO1xuICAgIGRlYnVnKCdTdWNjZXNzZnVsbHkgZ290IE1GQSB0b2tlbiBmcm9tIHVzZXInKTtcbiAgICBjYih1bmRlZmluZWQsIHRva2VuKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgZGVidWcoJ0ZhaWxlZCB0byBnZXQgTUZBIHRva2VuJywgZXJyKTtcbiAgICBjYihlcnIpO1xuICB9XG59XG5cbiJdfQ==