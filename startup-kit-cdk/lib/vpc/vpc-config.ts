import * as ec2 from "@aws-cdk/aws-ec2";

export interface VpcSubnetConfig {
  readonly subnetName: string;
  readonly publicSubnet: boolean;
  readonly cidrMask?: number;
}

export interface VpcEnvironmentConfig {
    readonly environmentName: string;
    readonly cidr: string;
    readonly maxAZs: number;
    readonly subnets: ec2.SubnetConfiguration[]
}

export interface VpcConfig {
    readonly createVpc: boolean;
    readonly environments: VpcEnvironmentConfig[]
}