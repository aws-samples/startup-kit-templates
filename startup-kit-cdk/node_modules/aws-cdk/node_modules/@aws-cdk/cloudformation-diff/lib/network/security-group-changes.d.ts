import { PropertyChange, ResourceChange } from '../diff/types';
import { DiffableCollection } from '../diffable';
import { RuleJson, SecurityGroupRule } from './security-group-rule';
export interface SecurityGroupChangesProps {
    ingressRulePropertyChanges: PropertyChange[];
    ingressRuleResourceChanges: ResourceChange[];
    egressRuleResourceChanges: ResourceChange[];
    egressRulePropertyChanges: PropertyChange[];
}
/**
 * Changes to IAM statements
 */
export declare class SecurityGroupChanges {
    readonly ingress: DiffableCollection<SecurityGroupRule>;
    readonly egress: DiffableCollection<SecurityGroupRule>;
    constructor(props: SecurityGroupChangesProps);
    get hasChanges(): boolean;
    /**
     * Return a summary table of changes
     */
    summarize(): string[][];
    toJson(): SecurityGroupChangesJson;
    get rulesAdded(): boolean;
    private readInlineRules;
    private readRuleResource;
}
export interface SecurityGroupChangesJson {
    ingressRuleAdditions?: RuleJson[];
    ingressRuleRemovals?: RuleJson[];
    egressRuleAdditions?: RuleJson[];
    egressRuleRemovals?: RuleJson[];
}
