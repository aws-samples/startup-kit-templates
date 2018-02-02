# AWS Startup Kit Templates

The AWS Startup Kit [CloudFormation](https://aws.amazon.com/cloudformation/) templates create stacks to help with getting started on AWS. Components include a VPC, a [bastion host](https://en.wikipedia.org/wiki/Bastion_host), and optionally a relational
database and/or an [AWS Elastic Beanstalk](https://aws.amazon.com/elasticbeanstalk/) application.

The VPC template is the foundation for everything else. It creates a VPC that includes
the following network resources:
- Two public subnets
- Two private subnets
- Single or redundant NAT Gateway(s) to allow instances in private subnets to communicate with AWS services
- Two route tables, one for public subnets, and the other for private subnets
- Security groups for an application, load balancer, database, and bastion host

The bastion host or jump server is used to provide SSH access to instances with private IP addresses in
the application's security group.

If desired, a relational database can be created using the [db.cfn.yml](db.cfn.yml) template. Either
a MySQL or PostgreSQL database is created in the [Amazon Relational Database Service](https://aws.amazon.com/rds/)
(RDS), which automates much of the heavy lifting of database setup and maintenance. Following best practices, the database is
created in private subnets concealed from the public Internet.

The optional [app.cfn.yml](templates/app.cfn.yml) template creates an Elastic Beanstalk application with EC2 application servers
placed in private subnets while the load balancer in front of them is placed in public subnets. The complete architecture is as follows:

![Architecture](images/architecture.png)

### USING THE TEMPLATES

#### Prerequisites

If you haven't done so already:

- [Make sure you're signed into AWS as an IAM user with admin access](http://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html).
Avoid using the root account.


- [Create an EC2 key pair](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html#having-ec2-create-your-key-pair). This is necessary to use the bastion host.

#### Steps for Creating the Infrastructure

All of the following steps involve using the AWS CloudFormation console. Simply
click the "Create Stack" button in the upper left corner of the console. Next,
under "Choose a template", select "Upload a template to Amazon S3" and click
"Browse" to find your local fork of this repository and choose the relevant template.

Create the stacks in the following order:

**[1] Create the VPC**: Select the vpc.cfn.yml template. Pick a relevant stack
name, and an IP address or address range from which you will allow SSH access
to the bastion host. Use [CIDR notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing).

**[2] Create the bastion**: Select the bastion.cfn.yml template. Pick a relevant
stack name, and then enter the name of your EC2 key pair and the name of the VPC
stack you created in step [1].

**[3] Create the database**: Select the db.cfn.yml template.
- Pick a relevant stack name, and then enter the various database parameters such
as the user name and password.
- For NetworkStackName, enter the name of the VPC stack you created in step [1].
- For EnvironmentName, select dev or prod.  Keep in mind that prod will set up a
Multi-AZ RDS database that is highly available and configured with a primary-standby
setup. This is a best practice for production, but not for a test/development environment
and would be an unnecessary expense.

**[4] Create the app**: First, decide which app you'd like to deploy.
- You can try out a Startup Kit sample workload.  At this time, there is one available,
a Node.js Express app, see https://github.com/awslabs/startup-kit-nodejs.
- Alternatively, if you wish to deploy your own code, see 'Adding an Application'
at the end of this README.
- Before proceeding, follow the directions in the Startup Kit sample workload README.
It's a good idea to make sure your app runs locally before deploying on AWS.
- Either create a S3 bucket to hold your app code, or make sure you have an existing S3 bucket you can use.  Put your code in the bucket.
- Select the app.cfn.yml template.
- Pick a relevant stack name.
- For AppS3Bucket, enter the name of the S3 bucket that contains your code.
- For AppS3Key, enter the name of your code file in the S3 bucket.  For example, if your
app is a Node.js app, it would be the name of your Node.js code zip file.
- For NetworkStackName, enter the name of the VPC stack you created in step [1].
- For DatabaseStackName enter the name of the database stack you created in step [3].
- IMPORTANT:  before clicking the **Create** button in the CloudFormation console,
go to the Capabilities section just above the button, and be sure you have checked the
checkbox acknowledging that IAM resources will be created.

**[5] Create DevOps resources**: Select the devops.cfn.yml template. NOTE:  These resources
are meant to be used with the Node.js sample app, but can be modified to work with another app.
- Pick a relevant stack name.
- For AppStackName, enter the name of the app stack you created in step [4].

#### Connecting to Your Instances and Database

In general, it is best to treat your fleet of instances as "cattle, not pets" and
avoid SSH'ing into them to manage them individually. When it's necessary to connect
for debugging purposes etc., connect via the bastion host created with the bastion
template. One way to do this is to use SSH agent forwarding. For details about how
to set this up on your local computer, consult the relevant [AWS blog post](https://aws.amazon.com/blogs/security/securely-connect-to-linux-instances-running-in-a-private-amazon-vpc).

Since the database is in a private subnet, it also is necessary to connect to it via
the bastion host using a method such as TCP/IP over SSH. For an example of how
to do this with MySQL Workbench, see the [documentation](http://dev.mysql.com/doc/workbench/en/wb-mysql-connections-methods-ssh.html).

In that example, you would replace the SSH Hostname with the public DNS name of
your bastion host, SSH Username with "ec2-user", and SSH Key File with the path
to the EC2 key pair you created. Ignore the SSH Password field. For MySQL Hostname,
enter the "RdsDbURL" from the Outputs tab for the database stack in the CloudFormation
console. MySQL Server Port is 3306. For the Username and Password fields, enter the
corresponding outputs for "DbUser" and "DbPassword" from the Outputs tab.


#### Adding an Application

Using the app template automates the process of setting up an app in AWS Elastic
Beanstalk. Additionally, using a Startup Kit sample workload allows you to quickly
test out your VPC and database setup.

However, you can deploy your own app instead of a Startup Kit sample workload.  If
you use the app template, keep in mind that it is designed to work with a relational
database in RDS.  If your own app uses a relational database, the database connection
string parameters should conform to the naming conventions in the template, or you
can fork the templates and modify the names.  Similarly, if you're not using a
relational database at all, you can modify the app template accordingly.

Additionally, it is not necessary to use the app template to leverage the benefits
of the other templates. You can add an application on top of the infrastructure created
in steps [1] to [3] using any technologies of your choice.

For example, you can use the Elastic Beanstalk console to set up a load balanced,
highly available environment. Alternatively, you can directly set up a load balancer
and an autoscaling group (ASG) without using Elastic Beanstalk. To ensure your app
is highly available, make sure to spin up at least two server instances in separate
availability zones.

As you add application components on top of the infrastructure created with the
templates, make sure that each component is (a) set up in the VPC created in
step [1] above, and (b) assigned to the relevant security group created by the
VPC template. Check the Outputs tab of the CloudFormation console for the IDs
of the security groups, which will be prefixed with "sg-". In particular:

- Load balancers, such as Application Load Balancers or Classic Load Balancers,
should be assigned to "ELBSecurityGroup" so they can talk to the application
instances.

- Application instances, such as RESTful API servers or web servers, should be
assigned to the "AppSecurityGroup" so they can talk to the database as
well as the load balancer, and receive SSH traffic from the bastion host.


### Deploy

New services are not always available in all AWS Regions when they are released. Please consult the
[Region Table](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/) for
more information.

Deploy | Region Name | Region | VPC | Bastion | DB | Fargate | Elastic Beanstalk
:---: | ------------ | ------------- | ------------- | ------------- | -------------  | ------------- | -------------
[🚀 ][us-east-1-vpc] | US East (N. Virginia) | us-east-1 | 👍  ||||
[🚀 ][us-east-1-vpc-bastion] | US East (N. Virginia) | us-east-1 | 👍  | 👍 |||
[🚀 ][us-east-1-vpc-bastion-fargate] | US East (N. Virginia) | us-east-1 | 👍  | 👍  || 👍  ||
[🚀 ][us-east-1-vpc-bastion-fargate-rds] | US East (N. Virginia) | us-east-1 | 👍  | 👍  | 👍  | 👍  ||
[🚀 ][us-east-1-vpc-bastion-eb-rds] | US East (N. Virginia) | us-east-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][us-east-2-vpc] | US East (Ohio) | us-east-2 | 👍  ||||
[🚀 ][us-east-2-vpc-bastion] | US East (Ohio) | us-east-2 | 👍  | 👍 |||
[🚀 ][us-east-2-vpc-bastion-eb-rds] | US East (Ohio) | us-east-2 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][us-west-1-vpc] | US West (N. California) | us-west-1 | 👍  ||||
[🚀 ][us-west-1-vpc-bastion] | US West (N. California) | us-west-1 | 👍  | 👍 |||
[🚀 ][us-west-1-vpc-bastion-eb-rds] | US West (N. California) | us-west-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][us-west-2-vpc] | US West (Oregon) | us-west-2 | 👍  ||||
[🚀 ][us-west-2-vpc-bastion] | US West (Oregon) | us-west-2 | 👍  | 👍 |||
[🚀 ][us-west-2-vpc-bastion-eb-rds] | US West (Oregon) | us-west-2 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][ca-central-1-vpc] | Canada (Central) | ca-central-1 | 👍  ||||
[🚀 ][ca-central-1-vpc-bastion] | Canada (Central) | ca-central-1 | 👍  | 👍 |||
[🚀 ][ca-central-1-vpc-bastion-eb-rds] | Canada (Central) | ca-central-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][sa-east-1-vpc] | S. America (São Paulo) | sa-east-1 | 👍  ||||
[🚀 ][sa-east-1-vpc-bastion] | S. America (São Paulo) | sa-east-1 | 👍  | 👍 |||
[🚀 ][sa-east-1-vpc-bastion-eb-rds] | S. America (São Paulo) | sa-east-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][eu-west-1-vpc] | EU (Ireland) | eu-west-1 | 👍  ||||
[🚀 ][eu-west-1-vpc-bastion] | EU (Ireland) | eu-west-1 | 👍  | 👍 |||
[🚀 ][eu-west-1-vpc-bastion-eb-rds] | EU (Ireland) | eu-west-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][eu-west-2-vpc] | EU (London) | eu-west-2 | 👍  ||||
[🚀 ][eu-west-2-vpc-bastion] | EU (London) | eu-west-2 | 👍  | 👍 |||
[🚀 ][eu-west-2-vpc-bastion-eb-rds] | EU (London) | eu-west-2 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][eu-west-3-vpc] | EU (Paris) | eu-west-3 | 👍  ||||
[🚀 ][eu-west-3-vpc-bastion] | EU (Paris) | eu-west-3 | 👍  | 👍 |||
[🚀 ][eu-west-3-vpc-bastion-eb-rds] | EU (Paris) | eu-west-3 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][eu-central-1-vpc] | EU (Frankfurt) | eu-central-1 | 👍  ||||
[🚀 ][eu-central-1-vpc-bastion] | EU (Frankfurt) | eu-central-1 | 👍  | 👍 |||
[🚀 ][eu-central-1-vpc-bastion-eb-rds] | EU (Frankfurt) | eu-central-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][ap-northeast-1-vpc] | Asia Pacific (Tokyo) | ap-northeast-1 | 👍  ||||
[🚀 ][ap-northeast-1-vpc-bastion] | Asia Pacific (Tokyo) | ap-northeast-1 | 👍  | 👍 |||
[🚀 ][ap-northeast-1-vpc-bastion-eb-rds] | Asia Pacific (Tokyo) | ap-northeast-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][ap-northeast-2-vpc] | Asia Pacific (Seoul) | ap-northeast-2 | 👍  ||||
[🚀 ][ap-northeast-2-vpc-bastion] | Asia Pacific (Seoul) | ap-northeast-2 | 👍  | 👍 |||
[🚀 ][ap-northeast-2-vpc-bastion-eb-rds] | Asia Pacific (Seoul) | ap-northeast-2 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][ap-south-1-vpc] | Asia Pacific (Mumbai) | ap-south-1 | 👍  ||||
[🚀 ][ap-south-1-vpc-bastion] | Asia Pacific (Mumbai) | ap-south-1 | 👍  | 👍 |||
[🚀 ][ap-south-1-vpc-bastion-eb-rds] | Asia Pacific (Mumbai) | ap-south-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][ap-southeast-1-vpc] | Asia Pacific (Singapore) | ap-southeast-1 | 👍  ||||
[🚀 ][ap-southeast-1-vpc-bastion] | Asia Pacific (Singapore) | ap-southeast-1 | 👍  | 👍 |||
[🚀 ][ap-southeast-1-vpc-bastion-eb-rds] | Asia Pacific (Singapore) | ap-southeast-1 | 👍  | 👍  | 👍  || 👍   |
[🚀 ][ap-southeast-2-vpc] | Asia Pacific (Sydney) | ap-southeast-2 | 👍  ||||
[🚀 ][ap-southeast-2-vpc-bastion] | Asia Pacific (Sydney) | ap-southeast-2 | 👍  | 👍 |||
[🚀 ][ap-southeast-2-vpc-bastion-eb-rds] | Asia Pacific (Sydney) | ap-southeast-2 | 👍  | 👍  | 👍  || 👍   |

[us-east-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[us-east-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[us-east-1-vpc-bastion-fargate]: https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-fargate.cfn.yml
[us-east-1-vpc-bastion-fargate-rds]: https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-fargate-rds.cfn.yml
[us-east-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[us-east-2-vpc]: https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[us-east-2-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[us-east-2-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[us-west-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=us-west-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[us-west-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=us-west-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[us-west-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=us-west-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[us-west-2-vpc]: https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[us-west-2-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[us-west-2-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[sa-east-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=sa-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[sa-east-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=sa-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[sa-east-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=sa-east-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[eu-west-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[eu-west-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[eu-west-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[eu-west-2-vpc]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[eu-west-2-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[eu-west-2-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[eu-west-3-vpc]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-3#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[eu-west-3-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-3#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[eu-west-3-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=eu-west-3#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[eu-central-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=eu-central-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[eu-central-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=eu-central-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[eu-central-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=eu-central-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[ap-south-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=ap-south-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[ap-south-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=ap-south-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[ap-south-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=ap-south-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[ap-northeast-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[ap-northeast-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[ap-northeast-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[ap-northeast-2-vpc]: https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[ap-northeast-2-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[ap-northeast-2-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[ap-southeast-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[ap-southeast-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[ap-southeast-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[ap-southeast-2-vpc]: https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[ap-southeast-2-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[ap-southeast-2-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-2#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml

[ca-central-1-vpc]: https://console.aws.amazon.com/cloudformation/home?region=ca-central-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc.cfn.yml
[ca-central-1-vpc-bastion]: https://console.aws.amazon.com/cloudformation/home?region=ca-central-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion.cfn.yml
[ca-central-1-vpc-bastion-eb-rds]: https://console.aws.amazon.com/cloudformation/home?region=ca-central-1#/stacks/create/review?templateURL=https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v1/vpc-bastion-eb-rds.cfn.yml


