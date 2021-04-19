import * as cdk from "@aws-cdk/core";
import * as config from "@aws-cdk/aws-config";
import * as sns from "@aws-cdk/aws-sns";
import * as subs from "@aws-cdk/aws-sns-subscriptions";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as budgets from "@aws-cdk/aws-budgets";
import * as lambdaNodeJs from "@aws-cdk/aws-lambda-nodejs";
import * as iam from "@aws-cdk/aws-iam";
import * as path from "path";
import * as fs from "fs";
import StartupConfigRule from "./config-rule-construct";
import * as appConfig from "../app.config.json";

export class StartupCheckStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const env = props.env as cdk.Environment;
    const region = env.region as string;
    const accountId = env.account as string;

    const emailSubscriber = appConfig.emailSubscriber;

    const topic = new sns.Topic(this, "AWS Startup check", {
      displayName: "AWS Startup check",
      topicName: "AWS_Starup_Check",
    });

    topic.addSubscription(new subs.EmailSubscription(emailSubscriber));

    new StartupConfigRule(this, {
      ruleIdentifier: config.ManagedRuleIdentifiers.ROOT_ACCOUNT_MFA_ENABLED,
      managed: true,
    });

    new StartupConfigRule(this, {
      ruleIdentifier: config.ManagedRuleIdentifiers.IAM_ROOT_ACCESS_KEY_CHECK,
      managed: true,
    });

    new StartupConfigRule(this, {
      ruleIdentifier: config.ManagedRuleIdentifiers.EC2_VOLUME_INUSE_CHECK,
      managed: true,
      ruleScope: config.RuleScope.fromResources([
        config.ResourceType.EBS_VOLUME,
      ]),
    });

    new StartupConfigRule(this, {
      ruleIdentifier: config.ManagedRuleIdentifiers.EIP_ATTACHED,
      managed: true,
    });

    new StartupConfigRule(this, {
      ruleIdentifier:
        config.ManagedRuleIdentifiers.RDS_INSTANCE_PUBLIC_ACCESS_CHECK,
      managed: true,
      ruleScope: config.RuleScope.fromResources([
        config.ResourceType.RDS_DB_INSTANCE,
      ]),
    });

    const tagsScope = [
      config.ResourceType.ACM_CERTIFICATE,
      config.ResourceType.AUTO_SCALING_GROUP,
      config.ResourceType.CODEBUILD_PROJECT,
      config.ResourceType.DYNAMODB_TABLE,
      config.ResourceType.EC2_CUSTOMER_GATEWAY,
      config.ResourceType.EC2_INSTANCE,
      config.ResourceType.EBS_VOLUME,
      config.ResourceType.EC2_VPC,
      config.ResourceType.EC2_VPN_CONNECTION,
      config.ResourceType.EC2_VPN_GATEWAY,
      config.ResourceType.ELB_LOAD_BALANCER,
      config.ResourceType.RDS_DB_INSTANCE,
      config.ResourceType.RDS_DB_SNAPSHOT,
      config.ResourceType.REDSHIFT_CLUSTER,
      config.ResourceType.REDSHIFT_CLUSTER_SNAPSHOT,
      config.ResourceType.S3_BUCKET,
    ];

    let tagsResources: string[] = [];
    tagsScope.forEach((t) => tagsResources.push(t.complianceResourceType));

    let inputParameters: { [key: string]: string } = {};
    for (let i = 0; i < appConfig.requiredTags.length; i++) {
      inputParameters[`tag${i + 1}Key`] = appConfig.requiredTags[i];
    }

    new StartupConfigRule(this, {
      ruleIdentifier: config.ManagedRuleIdentifiers.REQUIRED_TAGS,
      managed: true,
      ruleScope: config.RuleScope.fromResources(tagsScope),
      inputParameters: inputParameters,
    });

    const startupCheckLambdaRole = new iam.Role(
      this,
      "startup-check-lambda-role",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaBasicExecutionRole"
          ),
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AWSBudgetsReadOnlyAccess"
          ),
        ],
      }
    );

    const filePath = path.join(
      __dirname,
      "../resources/check-config-rules-policy.json"
    );

    const startupCheckLambdaDoc = fs
      .readFileSync(filePath, { encoding: "utf-8" })
      .replace(/REGION/g, region)
      .replace(/ACCOUNTID/g, accountId);

    const startupCheckLambdPolicyProps = {
      policyName: "startup-check-lambda-policy",
      document: iam.PolicyDocument.fromJson(JSON.parse(startupCheckLambdaDoc)),
      force: true,
      roles: [startupCheckLambdaRole],
    };

    const startupCheckLambdaPolicy = new iam.Policy(
      this,
      startupCheckLambdPolicyProps.policyName,
      startupCheckLambdPolicyProps
    );

    const checkFunction = new lambdaNodeJs.NodejsFunction(
      this,
      "startup-check-config-rules",
      {
        entry: "./resources/check-config-rules.js",
        handler: "handler",
        role: startupCheckLambdaRole,
      }
    );

    const scheduledRule = new events.Rule(
      this,
      "startup-checks-scheduled-rule",
      {
        description:
          "Run a scheduled task to invoke the startup checks function",
        schedule: events.Schedule.cron({ hour: "12", minute: "0" }),
        targets: [new targets.LambdaFunction(checkFunction)],
      }
    );

    const monthlyBudgetParams = {
      budget: {
        budgetName: "startup-monthly-cost-budget",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        costTypes: {
          includeCredit: false,
          includeRefund: false,
        },
        budgetLimit: {
          amount: appConfig.monthlyBudget,
          unit: "USD",
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: "GREATER_THAN",
            notificationType: "ACTUAL",
            threshold: 50,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              address: emailSubscriber,
              subscriptionType: "EMAIL",
            },
          ],
        },
      ],
    };

    const montlyBudget = new budgets.CfnBudget(
      this,
      monthlyBudgetParams.budget.budgetName,
      monthlyBudgetParams
    );
  }
}
