import * as cxapi from '@aws-cdk/cx-api';
import { Configuration } from '../../settings';
import { SdkProvider } from '../aws-auth';
/** Invokes the cloud executable and returns JSON output */
export declare function execProgram(aws: SdkProvider, config: Configuration): Promise<cxapi.CloudAssembly>;
