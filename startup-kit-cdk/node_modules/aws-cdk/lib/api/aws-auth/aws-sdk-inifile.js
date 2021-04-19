"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchedSharedIniFileCredentials = void 0;
const AWS = require("aws-sdk");
/**
 * Hack-fix
 *
 * There are a number of issues in the upstream version of SharedIniFileCredentials
 * that need fixing:
 *
 *  1. The upstream aws-sdk contains an incorrect instantiation of an `AWS.STS`
 *     client, which *should* have taken the region from the requested profile
 *     but doesn't. It will use the region from the default profile, which
 *     may not exist, defaulting to `us-east-1` (since we switched to
 *     AWS_STS_REGIONAL_ENDPOINTS=regional, that default is not even allowed anymore
 *     and the absence of a default region will lead to an error).
 *
 *  2. The simple fix is to get the region from the `config` file. profiles
 *     are made up of a combination of `credentials` and `config`, and the region is
 *     generally in `config` with the rest in `credentials`. However, a bug in
 *     `getProfilesFromSharedConfig` overwrites ALL `config` data with `credentials`
 *     data, so we also need to do extra work to fish the `region` out of the config.
 *
 * 3.  The 'credential_source' option is not supported. Meaning credentials
 *     for assume-role cannot be fetched using EC2/ESC metadata.
 *
 * See https://github.com/aws/aws-sdk-js/issues/3418 for all the gory details.
 * See https://github.com/aws/aws-sdk-js/issues/1916 for some more glory details.
 */
class PatchedSharedIniFileCredentials extends AWS.SharedIniFileCredentials {
    loadRoleProfile(creds, roleProfile, callback) {
        // Need to duplicate the whole implementation here -- the function is long and has been written in
        // such a way that there are no small monkey patches possible.
        var _a, _b, _c, _d;
        if (this.disableAssumeRole) {
            throw AWS.util.error(new Error('Role assumption profiles are disabled. ' +
                'Failed to load profile ' + this.profile +
                ' from ' + creds.filename), { code: 'SharedIniFileCredentialsProviderFailure' });
        }
        var self = this;
        var roleArn = roleProfile.role_arn;
        var roleSessionName = roleProfile.role_session_name;
        var externalId = roleProfile.external_id;
        var mfaSerial = roleProfile.mfa_serial;
        var sourceProfile = roleProfile.source_profile;
        var credentialSource = roleProfile.credential_source;
        const credentialError = AWS.util.error(new Error(`When using 'role_arn' in profile ('${this.profile}'), you must also configure exactly one of 'source_profile' or 'credential_source'`), { code: 'SharedIniFileCredentialsProviderFailure' });
        if (sourceProfile && credentialSource) {
            throw credentialError;
        }
        if (!sourceProfile && !credentialSource) {
            throw credentialError;
        }
        const profiles = loadProfilesProper(this.filename);
        const region = (_d = (_b = (_a = profiles[this.profile]) === null || _a === void 0 ? void 0 : _a.region) !== null && _b !== void 0 ? _b : (_c = profiles.default) === null || _c === void 0 ? void 0 : _c.region) !== null && _d !== void 0 ? _d : 'us-east-1';
        const stsCreds = sourceProfile ? this.sourceProfileCredentials(sourceProfile, creds) : this.credentialSourceCredentials(credentialSource);
        this.roleArn = roleArn;
        var sts = new AWS.STS({
            credentials: stsCreds,
            region,
            httpOptions: this.httpOptions,
        });
        var roleParams = {
            RoleArn: roleArn,
            RoleSessionName: roleSessionName || 'aws-sdk-js-' + Date.now(),
        };
        if (externalId) {
            roleParams.ExternalId = externalId;
        }
        if (mfaSerial && self.tokenCodeFn) {
            roleParams.SerialNumber = mfaSerial;
            self.tokenCodeFn(mfaSerial, function (err, token) {
                if (err) {
                    var message;
                    if (err instanceof Error) {
                        message = err.message;
                    }
                    else {
                        message = err;
                    }
                    callback(AWS.util.error(new Error('Error fetching MFA token: ' + message), { code: 'SharedIniFileCredentialsProviderFailure' }));
                    return;
                }
                roleParams.TokenCode = token;
                sts.assumeRole(roleParams, callback);
            });
            return;
        }
        sts.assumeRole(roleParams, callback);
    }
    sourceProfileCredentials(sourceProfile, profiles) {
        var sourceProfileExistanceTest = profiles[sourceProfile];
        if (typeof sourceProfileExistanceTest !== 'object') {
            throw AWS.util.error(new Error('source_profile ' + sourceProfile + ' using profile '
                + this.profile + ' does not exist'), { code: 'SharedIniFileCredentialsProviderFailure' });
        }
        return new AWS.SharedIniFileCredentials(AWS.util.merge(this.options || {}, {
            profile: sourceProfile,
            preferStaticCredentials: true,
        }));
    }
    // the aws-sdk for js does not support 'credential_source' (https://github.com/aws/aws-sdk-js/issues/1916)
    // so unfortunately we need to implement this ourselves.
    credentialSourceCredentials(sourceCredential) {
        // see https://docs.aws.amazon.com/credref/latest/refdocs/setting-global-credential_source.html
        switch (sourceCredential) {
            case 'Environment': {
                return new AWS.EnvironmentCredentials('AWS');
            }
            case 'Ec2InstanceMetadata': {
                return new AWS.EC2MetadataCredentials();
            }
            case 'EcsContainer': {
                return new AWS.ECSCredentials();
            }
            default: {
                throw new Error(`credential_source ${sourceCredential} in profile ${this.profile} is unsupported. choose one of [Environment, Ec2InstanceMetadata, EcsContainer]`);
            }
        }
    }
}
exports.PatchedSharedIniFileCredentials = PatchedSharedIniFileCredentials;
/**
 * A function to load profiles from disk that MERGES credentials and config instead of overwriting
 *
 * @see https://github.com/aws/aws-sdk-js/blob/5ae5a7d7d24d1000dbc089cc15f8ed2c7b06c542/lib/util.js#L956
 */
function loadProfilesProper(filename) {
    const util = AWS.util; // Does exists even though there aren't any typings for it
    const iniLoader = util.iniLoader;
    const profiles = {};
    let profilesFromConfig = {};
    if (process.env[util.configOptInEnv]) {
        profilesFromConfig = iniLoader.loadFrom({
            isConfig: true,
            filename: process.env[util.sharedConfigFileEnv],
        });
    }
    var profilesFromCreds = iniLoader.loadFrom({
        filename: filename ||
            (process.env[util.configOptInEnv] && process.env[util.sharedCredentialsFileEnv]),
    });
    for (const [name, profile] of Object.entries(profilesFromConfig)) {
        profiles[name] = profile;
    }
    for (const [name, profile] of Object.entries(profilesFromCreds)) {
        profiles[name] = {
            ...profiles[name],
            ...profile,
        };
    }
    return profiles;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLXNkay1pbmlmaWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXdzLXNkay1pbmlmaWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUErQjtBQUcvQjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBd0JHO0FBQ0gsTUFBYSwrQkFBZ0MsU0FBUSxHQUFHLENBQUMsd0JBQXdCO0lBU3hFLGVBQWUsQ0FDcEIsS0FBNkMsRUFDN0MsV0FBbUMsRUFDbkMsUUFBMkM7UUFFM0Msa0dBQWtHO1FBQ2xHLDhEQUE4RDs7UUFFOUQsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUU7WUFDMUIsTUFBTyxHQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FDM0IsSUFBSSxLQUFLLENBQUMseUNBQXlDO2dCQUN6Qyx5QkFBeUIsR0FBRyxJQUFJLENBQUMsT0FBTztnQkFDeEMsUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFDcEMsRUFBRSxJQUFJLEVBQUUseUNBQXlDLEVBQUUsQ0FDcEQsQ0FBQztTQUNIO1FBRUQsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2hCLElBQUksT0FBTyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUM7UUFDbkMsSUFBSSxlQUFlLEdBQUcsV0FBVyxDQUFDLGlCQUFpQixDQUFDO1FBQ3BELElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUM7UUFDekMsSUFBSSxTQUFTLEdBQUcsV0FBVyxDQUFDLFVBQVUsQ0FBQztRQUN2QyxJQUFJLGFBQWEsR0FBRyxXQUFXLENBQUMsY0FBYyxDQUFDO1FBQy9DLElBQUksZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLGlCQUFpQixDQUFDO1FBRXJELE1BQU0sZUFBZSxHQUFJLEdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUM3QyxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsSUFBSSxDQUFDLE9BQU8sb0ZBQW9GLENBQUMsRUFDakosRUFBRSxJQUFJLEVBQUUseUNB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QUFDO1NBQ2hELENBQUMsQ0FBQztLQUNKO0lBQ0QsSUFBSSxpQkFBaUIsR0FBMkMsU0FBUyxDQUFDLFFBQVEsQ0FBQztRQUNqRixRQUFRLEVBQUUsUUFBUTtZQUNoQixDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7S0FDbkYsQ0FBQyxDQUFDO0lBQ0gsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsRUFBRTtRQUNoRSxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDO0tBQzFCO0lBQ0QsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsRUFBRTtRQUMvRCxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUc7WUFDZixHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDakIsR0FBRyxPQUFPO1NBQ1gsQ0FBQztLQUNIO0lBQ0QsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcblxuXG4vKipcbiAqIEhhY2stZml4XG4gKlxuICogVGhlcmUgYXJlIGEgbnVtYmVyIG9mIGlzc3VlcyBpbiB0aGUgdXBzdHJlYW0gdmVyc2lvbiBvZiBTaGFyZWRJbmlGaWxlQ3JlZGVudGlhbHNcbiAqIHRoYXQgbmVlZCBmaXhpbmc6XG4gKlxuICogIDEuIFRoZSB1cHN0cmVhbSBhd3Mtc2RrIGNvbnRhaW5zIGFuIGluY29ycmVjdCBpbnN0YW50aWF0aW9uIG9mIGFuIGBBV1MuU1RTYFxuICogICAgIGNsaWVudCwgd2hpY2ggKnNob3VsZCogaGF2ZSB0YWtlbiB0aGUgcmVnaW9uIGZyb20gdGhlIHJlcXVlc3RlZCBwcm9maWxlXG4gKiAgICAgYnV0IGRvZXNuJ3QuIEl0IHdpbGwgdXNlIHRoZSByZWdpb24gZnJvbSB0aGUgZGVmYXVsdCBwcm9maWxlLCB3aGljaFxuICogICAgIG1heSBub3QgZXhpc3QsIGRlZmF1bHRpbmcgdG8gYHVzLWVhc3QtMWAgKHNpbmNlIHdlIHN3aXRjaGVkIHRvXG4gKiAgICAgQVdTX1NUU19SRUdJT05BTF9FTkRQT0lOVFM9cmVnaW9uYWwsIHRoYXQgZGVmYXVsdCBpcyBub3QgZXZlbiBhbGxvd2VkIGFueW1vcmVcbiAqICAgICBhbmQgdGhlIGFic2VuY2Ugb2YgYSBkZWZhdWx0IHJlZ2lvbiB3aWxsIGxlYWQgdG8gYW4gZXJyb3IpLlxuICpcbiAqICAyLiBUaGUgc2ltcGxlIGZpeCBpcyB0byBnZXQgdGhlIHJlZ2lvbiBmcm9tIHRoZSBgY29uZmlnYCBmaWxlLiBwcm9maWxlc1xuICogICAgIGFyZSBtYWRlIHVwIG9mIGEgY29tYmluYXRpb24gb2YgYGNyZWRlbnRpYWxzYCBhbmQgYGNvbmZpZ2AsIGFuZCB0aGUgcmVnaW9uIGlzXG4gKiAgICAgZ2VuZXJhbGx5IGluIGBjb25maWdgIHdpdGggdGhlIHJlc3QgaW4gYGNyZWRlbnRpYWxzYC4gSG93ZXZlciwgYSBidWcgaW5cbiAqICAgICBgZ2V0UHJvZmlsZXNGcm9tU2hhcmVkQ29uZmlnYCBvdmVyd3JpdGVzIEFMTCBgY29uZmlnYCBkYXRhIHdpdGggYGNyZWRlbnRpYWxzYFxuICogICAgIGRhdGEsIHNvIHdlIGFsc28gbmVlZCB0byBkbyBleHRyYSB3b3JrIHRvIGZpc2ggdGhlIGByZWdpb25gIG91dCBvZiB0aGUgY29uZmlnLlxuICpcbiAqIDMuICBUaGUgJ2NyZWRlbnRpYWxfc291cmNlJyBvcHRpb24gaXMgbm90IHN1cHBvcnRlZC4gTWVhbmluZyBjcmVkZW50aWFsc1xuICogICAgIGZvciBhc3N1bWUtcm9sZSBjYW5ub3QgYmUgZmV0Y2hlZCB1c2luZyBFQzIvRVNDIG1ldGFkYXRhLlxuICpcbiAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1zZGstanMvaXNzdWVzLzM0MTggZm9yIGFsbCB0aGUgZ29yeSBkZXRhaWxzLlxuICogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLXNkay1qcy9pc3N1ZXMvMTkxNiBmb3Igc29tZSBtb3JlIGdsb3J5IGRldGFpbHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRjaGVkU2hhcmVkSW5pRmlsZUNyZWRlbnRpYWxzIGV4dGVuZHMgQVdTLlNoYXJlZEluaUZpbGVDcmVkZW50aWFscyB7XG4gIGRlY2xhcmUgcHJpdmF0ZSBwcm9maWxlOiBzdHJpbmc7XG4gIGRlY2xhcmUgcHJpdmF0ZSBmaWxlbmFtZTogc3RyaW5nO1xuICBkZWNsYXJlIHByaXZhdGUgZGlzYWJsZUFzc3VtZVJvbGU6IGJvb2xlYW47XG4gIGRlY2xhcmUgcHJpdmF0ZSBvcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBkZWNsYXJlIHByaXZhdGUgcm9sZUFybjogc3RyaW5nO1xuICBkZWNsYXJlIHByaXZhdGUgaHR0cE9wdGlvbnM/OiBBV1MuSFRUUE9wdGlvbnM7XG4gIGRlY2xhcmUgcHJpdmF0ZSB0b2tlbkNvZGVGbj86IChtZmFTZXJpYWw6IHN0cmluZywgY2FsbGJhY2s6IChlcnI/OiBFcnJvciwgdG9rZW4/OiBzdHJpbmcpID0+IHZvaWQpID0+IHZvaWQ7XG5cbiAgcHVibGljIGxvYWRSb2xlUHJvZmlsZShcbiAgICBjcmVkczogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgc3RyaW5nPj4sXG4gICAgcm9sZVByb2ZpbGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gICAgY2FsbGJhY2s6IChlcnI/OiBFcnJvciwgZGF0YT86IGFueSkgPT4gdm9pZCkge1xuXG4gICAgLy8gTmVlZCB0byBkdXBsaWNhdGUgdGhlIHdob2xlIGltcGxlbWVudGF0aW9uIGhlcmUgLS0gdGhlIGZ1bmN0aW9uIGlzIGxvbmcgYW5kIGhhcyBiZWVuIHdyaXR0ZW4gaW5cbiAgICAvLyBzdWNoIGEgd2F5IHRoYXQgdGhlcmUgYXJlIG5vIHNtYWxsIG1vbmtleSBwYXRjaGVzIHBvc3NpYmxlLlxuXG4gICAgaWYgKHRoaXMuZGlzYWJsZUFzc3VtZVJvbGUpIHtcbiAgICAgIHRocm93IChBV1MgYXMgYW55KS51dGlsLmVycm9yKFxuICAgICAgICBuZXcgRXJyb3IoJ1JvbGUgYXNzdW1wdGlvbiBwcm9maWxlcyBhcmUgZGlzYWJsZWQuICcgK1xuICAgICAgICAgICAgICAgICAgJ0ZhaWxlZCB0byBsb2FkIHByb2ZpbGUgJyArIHRoaXMucHJvZmlsZSArXG4gICAgICAgICAgICAgICAgICAnIGZyb20gJyArIGNyZWRzLmZpbGVuYW1lKSxcbiAgICAgICAgeyBjb2RlOiAnU2hhcmVkSW5pRmlsZUNyZWRlbnRpYWxzUHJvdmlkZXJGYWlsdXJlJyB9LFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJvbGVBcm4gPSByb2xlUHJvZmlsZS5yb2xlX2FybjtcbiAgICB2YXIgcm9sZVNlc3Npb25OYW1lID0gcm9sZVByb2ZpbGUucm9sZV9zZXNzaW9uX25hbWU7XG4gICAgdmFyIGV4dGVybmFsSWQgPSByb2xlUHJvZmlsZS5leHRlcm5hbF9pZDtcbiAgICB2YXIgbWZhU2VyaWFsID0gcm9sZVByb2ZpbGUubWZhX3NlcmlhbDtcbiAgICB2YXIgc291cmNlUHJvZmlsZSA9IHJvbGVQcm9maWxlLnNvdXJjZV9wcm9maWxlO1xuICAgIHZhciBjcmVkZW50aWFsU291cmNlID0gcm9sZVByb2ZpbGUuY3JlZGVudGlhbF9zb3VyY2U7XG5cbiAgICBjb25zdCBjcmVkZW50aWFsRXJyb3IgPSAoQVdTIGFzIGFueSkudXRpbC5lcnJvcihcbiAgICAgIG5ldyBFcnJvcihgV2hlbiB1c2luZyAncm9sZV9hcm4nIGluIHByb2ZpbGUgKCcke3RoaXMucHJvZmlsZX0nKSwgeW91IG11c3QgYWxzbyBjb25maWd1cmUgZXhhY3RseSBvbmUgb2YgJ3NvdXJjZV9wcm9maWxlJyBvciAnY3JlZGVudGlhbF9zb3VyY2UnYCksXG4gICAgICB7IGNvZGU6ICdTaGFyZWRJbmlGaWxlQ3JlZGVudGlhbHNQcm92aWRlckZhaWx1cmUnIH0sXG4gICAgKTtcblxuICAgIGlmIChzb3VyY2VQcm9maWxlICYmIGNyZWRlbnRpYWxTb3VyY2UpIHtcbiAgICAgIHRocm93IGNyZWRlbnRpYWxFcnJvcjtcbiAgICB9XG5cbiAgICBpZiAoIXNvdXJjZVByb2ZpbGUgJiYgIWNyZWRlbnRpYWxTb3VyY2UpIHtcbiAgICAgIHRocm93IGNyZWRlbnRpYWxFcnJvcjtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9maWxlcyA9IGxvYWRQcm9maWxlc1Byb3Blcih0aGlzLmZpbGVuYW1lKTtcbiAgICBjb25zdCByZWdpb24gPSBwcm9maWxlc1t0aGlzLnByb2ZpbGVdPy5yZWdpb24gPz8gcHJvZmlsZXMuZGVmYXVsdD8ucmVnaW9uID8/ICd1cy1lYXN0LTEnO1xuXG4gICAgY29uc3Qgc3RzQ3JlZHMgPSBzb3VyY2VQcm9maWxlID8gdGhpcy5zb3VyY2VQcm9maWxlQ3JlZGVudGlhbHMoc291cmNlUHJvZmlsZSwgY3JlZHMpIDogdGhpcy5jcmVkZW50aWFsU291cmNlQ3JlZGVudGlhbHMoY3JlZGVudGlhbFNvdXJjZSk7XG5cbiAgICB0aGlzLnJvbGVBcm4gPSByb2xlQXJuO1xuICAgIHZhciBzdHMgPSBuZXcgQVdTLlNUUyh7XG4gICAgICBjcmVkZW50aWFsczogc3RzQ3JlZHMsXG4gICAgICByZWdpb24sXG4gICAgICBodHRwT3B0aW9uczogdGhpcy5odHRwT3B0aW9ucyxcbiAgICB9KTtcblxuICAgIHZhciByb2xlUGFyYW1zOiBBV1MuU1RTLkFzc3VtZVJvbGVSZXF1ZXN0ID0ge1xuICAgICAgUm9sZUFybjogcm9sZUFybixcbiAgICAgIFJvbGVTZXNzaW9uTmFtZTogcm9sZVNlc3Npb25OYW1lIHx8ICdhd3Mtc2RrLWpzLScgKyBEYXRlLm5vdygpLFxuICAgIH07XG5cbiAgICBpZiAoZXh0ZXJuYWxJZCkge1xuICAgICAgcm9sZVBhcmFtcy5FeHRlcm5hbElkID0gZXh0ZXJuYWxJZDtcbiAgICB9XG5cbiAgICBpZiAobWZhU2VyaWFsICYmIHNlbGYudG9rZW5Db2RlRm4pIHtcbiAgICAgIHJvbGVQYXJhbXMuU2VyaWFsTnVtYmVyID0gbWZhU2VyaWFsO1xuICAgICAgc2VsZi50b2tlbkNvZGVGbihtZmFTZXJpYWwsIGZ1bmN0aW9uKGVyciwgdG9rZW4pIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHZhciBtZXNzYWdlO1xuICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgbWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtZXNzYWdlID0gZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjayhcbiAgICAgICAgICAgIChBV1MgYXMgYW55KS51dGlsLmVycm9yKFxuICAgICAgICAgICAgICBuZXcgRXJyb3IoJ0Vycm9yIGZldGNoaW5nIE1GQSB0b2tlbjogJyArIG1lc3NhZ2UpLFxuICAgICAgICAgICAgICB7IGNvZGU6ICdTaGFyZWRJbmlGaWxlQ3JlZGVudGlhbHNQcm92aWRlckZhaWx1cmUnIH0sXG4gICAgICAgICAgICApKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByb2xlUGFyYW1zLlRva2VuQ29kZSA9IHRva2VuO1xuICAgICAgICBzdHMuYXNzdW1lUm9sZShyb2xlUGFyYW1zLCBjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc3RzLmFzc3VtZVJvbGUocm9sZVBhcmFtcywgY2FsbGJhY2spO1xuICB9XG5cbiAgcHJpdmF0ZSBzb3VyY2VQcm9maWxlQ3JlZGVudGlhbHMoc291cmNlUHJvZmlsZTogc3RyaW5nLCBwcm9maWxlczogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgc3RyaW5nPj4pIHtcblxuICAgIHZhciBzb3VyY2VQcm9maWxlRXhpc3RhbmNlVGVzdCA9IHByb2ZpbGVzW3NvdXJjZVByb2ZpbGVdO1xuXG4gICAgaWYgKHR5cGVvZiBzb3VyY2VQcm9maWxlRXhpc3RhbmNlVGVzdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IChBV1MgYXMgYW55KS51dGlsLmVycm9yKFxuICAgICAgICBuZXcgRXJyb3IoJ3NvdXJjZV9wcm9maWxlICcgKyBzb3VyY2VQcm9maWxlICsgJyB1c2luZyBwcm9maWxlICdcbiAgICAgICAgICArIHRoaXMucHJvZmlsZSArICcgZG9lcyBub3QgZXhpc3QnKSxcbiAgICAgICAgeyBjb2RlOiAnU2hhcmVkSW5pRmlsZUNyZWRlbnRpYWxzUHJvdmlkZXJGYWlsdXJlJyB9LFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFXUy5TaGFyZWRJbmlGaWxlQ3JlZGVudGlhbHMoXG4gICAgICAoQVdTIGFzIGFueSkudXRpbC5tZXJnZSh0aGlzLm9wdGlvbnMgfHwge30sIHtcbiAgICAgICAgcHJvZmlsZTogc291cmNlUHJvZmlsZSxcbiAgICAgICAgcHJlZmVyU3RhdGljQ3JlZGVudGlhbHM6IHRydWUsXG4gICAgICB9KSxcbiAgICApO1xuXG4gIH1cblxuICAvLyB0aGUgYXdzLXNkayBmb3IganMgZG9lcyBub3Qgc3VwcG9ydCAnY3JlZGVudGlhbF9zb3VyY2UnIChodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1zZGstanMvaXNzdWVzLzE5MTYpXG4gIC8vIHNvIHVuZm9ydHVuYXRlbHkgd2UgbmVlZCB0byBpbXBsZW1lbnQgdGhpcyBvdXJzZWx2ZXMuXG4gIHByaXZhdGUgY3JlZGVudGlhbFNvdXJjZUNyZWRlbnRpYWxzKHNvdXJjZUNyZWRlbnRpYWw6IHN0cmluZykge1xuXG4gICAgLy8gc2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jcmVkcmVmL2xhdGVzdC9yZWZkb2NzL3NldHRpbmctZ2xvYmFsLWNyZWRlbnRpYWxfc291cmNlLmh0bWxcbiAgICBzd2l0Y2ggKHNvdXJjZUNyZWRlbnRpYWwpIHtcbiAgICAgIGNhc2UgJ0Vudmlyb25tZW50Jzoge1xuICAgICAgICByZXR1cm4gbmV3IEFXUy5FbnZpcm9ubWVudENyZWRlbnRpYWxzKCdBV1MnKTtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ0VjMkluc3RhbmNlTWV0YWRhdGEnOiB7XG4gICAgICAgIHJldHVybiBuZXcgQVdTLkVDMk1ldGFkYXRhQ3JlZGVudGlhbHMoKTtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ0Vjc0NvbnRhaW5lcic6IHtcbiAgICAgICAgcmV0dXJuIG5ldyBBV1MuRUNTQ3JlZGVudGlhbHMoKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjcmVkZW50aWFsX3NvdXJjZSAke3NvdXJjZUNyZWRlbnRpYWx9IGluIHByb2ZpbGUgJHt0aGlzLnByb2ZpbGV9IGlzIHVuc3VwcG9ydGVkLiBjaG9vc2Ugb25lIG9mIFtFbnZpcm9ubWVudCwgRWMySW5zdGFuY2VNZXRhZGF0YSwgRWNzQ29udGFpbmVyXWApO1xuICAgICAgfVxuICAgIH1cblxuICB9XG59XG5cbi8qKlxuICogQSBmdW5jdGlvbiB0byBsb2FkIHByb2ZpbGVzIGZyb20gZGlzayB0aGF0IE1FUkdFUyBjcmVkZW50aWFscyBhbmQgY29uZmlnIGluc3RlYWQgb2Ygb3ZlcndyaXRpbmdcbiAqXG4gKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLXNkay1qcy9ibG9iLzVhZTVhN2Q3ZDI0ZDEwMDBkYmMwODljYzE1ZjhlZDJjN2IwNmM1NDIvbGliL3V0aWwuanMjTDk1NlxuICovXG5mdW5jdGlvbiBsb2FkUHJvZmlsZXNQcm9wZXIoZmlsZW5hbWU6IHN0cmluZykge1xuICBjb25zdCB1dGlsID0gKEFXUyBhcyBhbnkpLnV0aWw7IC8vIERvZXMgZXhpc3RzIGV2ZW4gdGhvdWdoIHRoZXJlIGFyZW4ndCBhbnkgdHlwaW5ncyBmb3IgaXRcbiAgY29uc3QgaW5pTG9hZGVyID0gdXRpbC5pbmlMb2FkZXI7XG4gIGNvbnN0IHByb2ZpbGVzOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHt9O1xuICBsZXQgcHJvZmlsZXNGcm9tQ29uZmlnOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHt9O1xuICBpZiAocHJvY2Vzcy5lbnZbdXRpbC5jb25maWdPcHRJbkVudl0pIHtcbiAgICBwcm9maWxlc0Zyb21Db25maWcgPSBpbmlMb2FkZXIubG9hZEZyb20oe1xuICAgICAgaXNDb25maWc6IHRydWUsXG4gICAgICBmaWxlbmFtZTogcHJvY2Vzcy5lbnZbdXRpbC5zaGFyZWRDb25maWdGaWxlRW52XSxcbiAgICB9KTtcbiAgfVxuICB2YXIgcHJvZmlsZXNGcm9tQ3JlZHM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0gaW5pTG9hZGVyLmxvYWRGcm9tKHtcbiAgICBmaWxlbmFtZTogZmlsZW5hbWUgfHxcbiAgICAgIChwcm9jZXNzLmVudlt1dGlsLmNvbmZpZ09wdEluRW52XSAmJiBwcm9jZXNzLmVudlt1dGlsLnNoYXJlZENyZWRlbnRpYWxzRmlsZUVudl0pLFxuICB9KTtcbiAgZm9yIChjb25zdCBbbmFtZSwgcHJvZmlsZV0gb2YgT2JqZWN0LmVudHJpZXMocHJvZmlsZXNGcm9tQ29uZmlnKSkge1xuICAgIHByb2ZpbGVzW25hbWVdID0gcHJvZmlsZTtcbiAgfVxuICBmb3IgKGNvbnN0IFtuYW1lLCBwcm9maWxlXSBvZiBPYmplY3QuZW50cmllcyhwcm9maWxlc0Zyb21DcmVkcykpIHtcbiAgICBwcm9maWxlc1tuYW1lXSA9IHtcbiAgICAgIC4uLnByb2ZpbGVzW25hbWVdLFxuICAgICAgLi4ucHJvZmlsZSxcbiAgICB9O1xuICB9XG4gIHJldHVybiBwcm9maWxlcztcbn1cbiJdfQ==