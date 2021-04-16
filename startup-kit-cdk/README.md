# AWS Startup-Kit CDK App

The Startup-Kit CDK App is a collection of CDK stacks that enables you to maintain your infrastructure as code and 
allows you to easily deploy and change your infrastrcuture.

## Installation

To deploy a CDK application you will need to clone to repo to an environment with 
[AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) installed. You can use 
[AWS Cloud9](https://aws.amazon.com/cloud9/) which comes with a pre-installed version of AWS CDK.

1. Clone the AWS Startup-Kit repo
```
git clone https://github.com/aws-samples/startup-kit-templates.git
```
2. Change directory to the CDK app
```
cd startup-kit-templates/startup-kit-cdk
```
3. Install the application dependencies (described in `package.json`)
```
npm install
```

## Setup

Open the `app.config.json`, change the settings to your needs and save it
```
{
    "accountId": "YOUR ACCOUNT ID",
    "region": "us-west-2",
    "vpc": {
        "createVpc": true,
        "environments": [{
                "environmentName": "prod",
                "cidr": "10.0.0.0/16",
                "maxAZs": 2,
                "subnets": [{
                        "name": "DMZ",
                        "subnetType": "Public"
                    },
                    {
                        "name": "APP",
                        "subnetType": "Private"
                    },
                    {
                        "name": "DB",
                        "subnetType": "Private"
                    }
                ]
            },
            {
                "environmentName": "dev",
                "cidr": "10.0.0.0/16",
                "maxAZs": 1,
                "subnets": [{
                    "name": "APP",
                    "subnetType": "Public"
                }]
            }
        ]
    }
}
```

<u>**Main Configuration**</u>  
**accountId** [string] - Your AWS 12 digits [account id](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html)  
**region** [string] - The [region](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) 
you would like to deploy the infrastrcuture to  
**vpc** [structure] - [Amazon VPC](https://aws.amazon.com/vpc/) configuration

<u>**VPC Configuration**</u>  
**createVpc** [boolean] - Indicate if to create the VPC(s) or not.
**environments** [array] - A list of VPCs to create  
**environments[].environmentName** [string] - The name of the VPC to create  
**environments[].cidr** [string] - The VPC [CIDR block](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing)  
**environments[].maxAZs** [number] - The maximum amount of 
[Availiability Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html#concepts-availability-zones) 
to use for the VPC  
**environments[].subnets** [array] - A list of subnets configuration  
**environments[].subnets[].name** [string] - A name for the subnet  
**environments[].subnets[].subnetType** [string - case sensitive] - The [subnet type](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.SubnetType.html) 
(Public | Private | Isolated)  


## Deployment

CDK synthesize the code into a [CloudFormation](https://aws.amazon.com/cloudformation/) template and use it to deploy 
the AWS resources to your account. You can run `cdk synth` to create the template file(s) in the cdk.out folder.  
You cal also run `cdk diff` to see the differences between the current application setup and the running infrastracture.  
To deploy the changes, run `cdk deploy`.