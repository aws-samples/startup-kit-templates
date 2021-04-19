"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSMContextProviderPlugin = void 0;
const cxapi = require("@aws-cdk/cx-api");
const api_1 = require("../api");
const logging_1 = require("../logging");
/**
 * Plugin to read arbitrary SSM parameter names
 */
class SSMContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(args) {
        const region = args.region;
        const account = args.account;
        if (!('parameterName' in args)) {
            throw new Error('parameterName must be provided in props for SSMContextProviderPlugin');
        }
        const parameterName = args.parameterName;
        logging_1.debug(`Reading SSM parameter ${account}:${region}:${parameterName}`);
        const response = await this.getSsmParameterValue(account, region, parameterName);
        if (!response.Parameter || response.Parameter.Value === undefined) {
            throw new Error(`SSM parameter not available in account ${account}, region ${region}: ${parameterName}`);
        }
        return response.Parameter.Value;
    }
    /**
     * Gets the value of an SSM Parameter, while not throwin if the parameter does not exist.
     * @param account       the account in which the SSM Parameter is expected to be.
     * @param region        the region in which the SSM Parameter is expected to be.
     * @param parameterName the name of the SSM Parameter
     *
     * @returns the result of the ``GetParameter`` operation.
     *
     * @throws Error if a service error (other than ``ParameterNotFound``) occurs.
     */
    async getSsmParameterValue(account, region, parameterName) {
        const ssm = (await this.aws.forEnvironment(cxapi.EnvironmentUtils.make(account, region), api_1.Mode.ForReading)).ssm();
        try {
            return await ssm.getParameter({ Name: parameterName }).promise();
        }
        catch (e) {
            if (e.code === 'ParameterNotFound') {
                return {};
            }
            throw e;
        }
    }
}
exports.SSMContextProviderPlugin = SSMContextProviderPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NtLXBhcmFtZXRlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzc20tcGFyYW1ldGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx5Q0FBeUM7QUFFekMsZ0NBQTJDO0FBQzNDLHdDQUFtQztBQUduQzs7R0FFRztBQUNILE1BQWEsd0JBQXdCO0lBQ25DLFlBQTZCLEdBQWdCO1FBQWhCLFFBQUcsR0FBSCxHQUFHLENBQWE7SUFDN0MsQ0FBQztJQUVNLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBdUM7UUFDM0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUMzQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQzdCLElBQUksQ0FBQyxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsRUFBRTtZQUM5QixNQUFNLElBQUksS0FBSyxDQUFDLHNFQUFzRSxDQUFDLENBQUM7U0FDekY7UUFDRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ3pDLGVBQUssQ0FBQyx5QkFBeUIsT0FBTyxJQUFJLE1BQU0sSUFBSSxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBRXJFLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDakYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLElBQUksUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ2pFLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQTBDLE9BQU8sWUFBWSxNQUFNLEtBQUssYUFBYSxFQUFFLENBQUMsQ0FBQztTQUMxRztRQUNELE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7SUFDbEMsQ0FBQztJQUVEOzs7Ozs7Ozs7T0FTRztJQUNLLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxPQUFlLEVBQUUsTUFBYyxFQUFFLGFBQXFCO1FBQ3ZGLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxVQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNqSCxJQUFJO1lBQ0YsT0FBTyxNQUFNLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUNsRTtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLG1CQUFtQixFQUFFO2dCQUNsQyxPQUFPLEVBQUUsQ0FBQzthQUNYO1lBQ0QsTUFBTSxDQUFDLENBQUM7U0FDVDtJQUNILENBQUM7Q0FDRjtBQXpDRCw0REF5Q0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeHNjaGVtYSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcbmltcG9ydCB7IE1vZGUsIFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBDb250ZXh0UHJvdmlkZXJQbHVnaW4gfSBmcm9tICcuL3Byb3ZpZGVyJztcblxuLyoqXG4gKiBQbHVnaW4gdG8gcmVhZCBhcmJpdHJhcnkgU1NNIHBhcmFtZXRlciBuYW1lc1xuICovXG5leHBvcnQgY2xhc3MgU1NNQ29udGV4dFByb3ZpZGVyUGx1Z2luIGltcGxlbWVudHMgQ29udGV4dFByb3ZpZGVyUGx1Z2luIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBhd3M6IFNka1Byb3ZpZGVyKSB7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0VmFsdWUoYXJnczogY3hzY2hlbWEuU1NNUGFyYW1ldGVyQ29udGV4dFF1ZXJ5KSB7XG4gICAgY29uc3QgcmVnaW9uID0gYXJncy5yZWdpb247XG4gICAgY29uc3QgYWNjb3VudCA9IGFyZ3MuYWNjb3VudDtcbiAgICBpZiAoISgncGFyYW1ldGVyTmFtZScgaW4gYXJncykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigncGFyYW1ldGVyTmFtZSBtdXN0IGJlIHByb3ZpZGVkIGluIHByb3BzIGZvciBTU01Db250ZXh0UHJvdmlkZXJQbHVnaW4nKTtcbiAgICB9XG4gICAgY29uc3QgcGFyYW1ldGVyTmFtZSA9IGFyZ3MucGFyYW1ldGVyTmFtZTtcbiAgICBkZWJ1ZyhgUmVhZGluZyBTU00gcGFyYW1ldGVyICR7YWNjb3VudH06JHtyZWdpb259OiR7cGFyYW1ldGVyTmFtZX1gKTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXRTc21QYXJhbWV0ZXJWYWx1ZShhY2NvdW50LCByZWdpb24sIHBhcmFtZXRlck5hbWUpO1xuICAgIGlmICghcmVzcG9uc2UuUGFyYW1ldGVyIHx8IHJlc3BvbnNlLlBhcmFtZXRlci5WYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFNTTSBwYXJhbWV0ZXIgbm90IGF2YWlsYWJsZSBpbiBhY2NvdW50ICR7YWNjb3VudH0sIHJlZ2lvbiAke3JlZ2lvbn06ICR7cGFyYW1ldGVyTmFtZX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3BvbnNlLlBhcmFtZXRlci5WYWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSB2YWx1ZSBvZiBhbiBTU00gUGFyYW1ldGVyLCB3aGlsZSBub3QgdGhyb3dpbiBpZiB0aGUgcGFyYW1ldGVyIGRvZXMgbm90IGV4aXN0LlxuICAgKiBAcGFyYW0gYWNjb3VudCAgICAgICB0aGUgYWNjb3VudCBpbiB3aGljaCB0aGUgU1NNIFBhcmFtZXRlciBpcyBleHBlY3RlZCB0byBiZS5cbiAgICogQHBhcmFtIHJlZ2lvbiAgICAgICAgdGhlIHJlZ2lvbiBpbiB3aGljaCB0aGUgU1NNIFBhcmFtZXRlciBpcyBleHBlY3RlZCB0byBiZS5cbiAgICogQHBhcmFtIHBhcmFtZXRlck5hbWUgdGhlIG5hbWUgb2YgdGhlIFNTTSBQYXJhbWV0ZXJcbiAgICpcbiAgICogQHJldHVybnMgdGhlIHJlc3VsdCBvZiB0aGUgYGBHZXRQYXJhbWV0ZXJgYCBvcGVyYXRpb24uXG4gICAqXG4gICAqIEB0aHJvd3MgRXJyb3IgaWYgYSBzZXJ2aWNlIGVycm9yIChvdGhlciB0aGFuIGBgUGFyYW1ldGVyTm90Rm91bmRgYCkgb2NjdXJzLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBnZXRTc21QYXJhbWV0ZXJWYWx1ZShhY2NvdW50OiBzdHJpbmcsIHJlZ2lvbjogc3RyaW5nLCBwYXJhbWV0ZXJOYW1lOiBzdHJpbmcpOiBQcm9taXNlPEFXUy5TU00uR2V0UGFyYW1ldGVyUmVzdWx0PiB7XG4gICAgY29uc3Qgc3NtID0gKGF3YWl0IHRoaXMuYXdzLmZvckVudmlyb25tZW50KGN4YXBpLkVudmlyb25tZW50VXRpbHMubWFrZShhY2NvdW50LCByZWdpb24pLCBNb2RlLkZvclJlYWRpbmcpKS5zc20oKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IHNzbS5nZXRQYXJhbWV0ZXIoeyBOYW1lOiBwYXJhbWV0ZXJOYW1lIH0pLnByb21pc2UoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5jb2RlID09PSAnUGFyYW1ldGVyTm90Rm91bmQnKSB7XG4gICAgICAgIHJldHVybiB7fTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG4iXX0=