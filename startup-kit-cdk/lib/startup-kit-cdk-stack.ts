import * as cdk from "@aws-cdk/core";
import * as appConfig from "../app.config.json";
import { VpcConfig } from "./vpc/vpc-config";
import { VpcConstruct } from "./vpc/vpc-construct";

export class StartUpKitCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcConfig = appConfig.vpc as VpcConfig;
    if (vpcConfig.createVpc) {
      for (let i = 0; i < vpcConfig.environments.length; i++) {
        let vpcProps = {
          vpcName: vpcConfig.environments[i].environmentName,
          cidr: vpcConfig.environments[i].cidr,
          maxAZs: vpcConfig.environments[i].maxAZs,
          subnets: vpcConfig.environments[i].subnets,
        };
        new VpcConstruct(this, vpcProps);
      }
    }
  }
}
