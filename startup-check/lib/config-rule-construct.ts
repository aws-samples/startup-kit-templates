import * as cdk from "@aws-cdk/core";
import * as config from "@aws-cdk/aws-config";

export interface StartupConfigRuleProps {
  readonly ruleIdentifier: string;
  readonly managed: boolean;
  readonly ruleScope?: config.RuleScope;
  readonly inputParameters?: {[key: string]: any };
}

export default class StartupConfigRule extends cdk.Construct {
  constructor(scope: cdk.Construct, props: StartupConfigRuleProps) {
    const ruleName = props.ruleIdentifier.toLowerCase().replace(/_/g, "-");
    super(scope, ruleName);

    if (props.managed) {
      const rule = new config.ManagedRule(this, props.ruleIdentifier, {
        identifier: props.ruleIdentifier,
        ruleScope: props.ruleScope,
        inputParameters: props.inputParameters,
      });
    }
  }
}
