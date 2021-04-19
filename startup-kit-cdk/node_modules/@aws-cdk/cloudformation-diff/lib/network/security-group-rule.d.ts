/**
 * A single security group rule, either egress or ingress
 */
export declare class SecurityGroupRule {
    /**
     * Group ID of the group this rule applies to
     */
    readonly groupId: string;
    /**
     * IP protocol this rule applies to
     */
    readonly ipProtocol: string;
    /**
     * Start of port range this rule applies to, or ICMP type
     */
    readonly fromPort?: number;
    /**
     * End of port range this rule applies to, or ICMP code
     */
    readonly toPort?: number;
    /**
     * Peer of this rule
     */
    readonly peer?: RulePeer;
    constructor(ruleObject: any, groupRef?: string);
    equal(other: SecurityGroupRule): boolean;
    describeProtocol(): string;
    describePeer(): string;
    toJson(): RuleJson;
}
export interface CidrIpPeer {
    kind: 'cidr-ip';
    ip: string;
}
export interface SecurityGroupPeer {
    kind: 'security-group';
    securityGroupId: string;
}
export interface PrefixListPeer {
    kind: 'prefix-list';
    prefixListId: string;
}
export declare type RulePeer = CidrIpPeer | SecurityGroupPeer | PrefixListPeer;
export interface RuleJson {
    groupId: string;
    ipProtocol: string;
    fromPort?: number;
    toPort?: number;
    peer?: RulePeer;
}
