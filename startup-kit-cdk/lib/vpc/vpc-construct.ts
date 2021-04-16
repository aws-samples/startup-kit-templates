import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";

export interface VpcConstructProps {
  readonly vpcName: string;
  readonly cidr: string;
  readonly maxAZs: number;
  readonly subnets: ec2.SubnetConfiguration[];
}

export class VpcConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, props: VpcConstructProps) {
    super(scope, props.vpcName);

    let subnetConf = new Array<ec2.SubnetConfiguration>();
    for (let i = 0; i < props.subnets.length; i++) {
      let subnet = {
        cidrMask: props.subnets[i].cidrMask ?? 24,
        name: props.subnets[i].name,
        subnetType: props.subnets[i].subnetType
      };
      
      subnetConf.push(subnet);
    }

    const vpcProp = {
      cidr: props.cidr,
      maxAzs: props.maxAZs,
      subnetConfiguration: subnetConf,
    };

    new ec2.Vpc(this, props.vpcName, vpcProp);
  }
}
