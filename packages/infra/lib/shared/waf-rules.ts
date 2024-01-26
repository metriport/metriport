import { aws_wafv2 as wafv2 } from "aws-cdk-lib";

export const wafRules: wafv2.CfnWebACL.RuleProperty[] = [
  // AWS IP Reputation list includes known malicious actors/bots and is regularly updated.
  // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-ip-rep.html#aws-managed-rule-groups-ip-rep-amazon
  {
    name: "AWS-AWSManagedRulesAmazonIpReputationList",
    priority: 10,
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWSManagedRulesAmazonIpReputationList",
      },
    },
    overrideAction: {
      none: {},
    },
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWSManagedRulesAmazonIpReputationList",
    },
  },
  // Blocks requests from services that permit the obfuscation of viewer identity. These include requests from VPNs, proxies, Tor nodes, and web hosting providers.
  {
    name: "AWS-AWSManagedRulesAnonymousIpList",
    priority: 15,
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWSManagedRulesAnonymousIpList",
        excludedRules: [
          { name: "HostingProviderIPList" }, // Excluding block of IP addresses from web hosting and cloud providers - as we traffic could come from hosted solutions.
        ],
      },
    },
    overrideAction: {
      none: {},
    },
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWS-AWSManagedRulesAnonymousIpList",
    },
  },
  // Common Rule Set aligns with major portions of OWASP Core Rule Set
  // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
  {
    name: "AWS-AWSManagedRulesCommonRuleSet",
    priority: 20,
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWSManagedRulesCommonRuleSet",
        excludedRules: [
          { name: "GenericRFI_BODY" }, // Excluding generic RFI body rule for things like webhook URLs - SSRF handled internally
          { name: "SizeRestrictions_BODY" }, // Excluding generic size body rule for lar - limits handled internally
          { name: "NoUserAgent_HEADER" }, // Excluding the block for the HTTP User-Agent header missing - TODO: alert customers before putting this block in
        ],
      },
    },
    overrideAction: {
      none: {},
    },
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWS-AWSManagedRulesCommonRuleSet",
    },
  },
  // Blocks external access to exposed administrative pages.
  // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-baseline.html#aws-managed-rule-groups-baseline-admin
  {
    name: "AWS-AWSManagedRulesAdminProtectionRuleSet",
    priority: 30,
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWSManagedRulesAdminProtectionRuleSet",
        excludedRules: [],
      },
    },
    overrideAction: {
      none: {},
    },
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWS-AWSManagedRulesAdminProtectionRuleSet",
    },
  },
  // Blocks request patterns that are known to be invalid and are associated with exploitation or discovery of vulnerabilities.
  // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-baseline.html#aws-managed-rule-groups-baseline-admin
  {
    name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
    priority: 40,
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWSManagedRulesKnownBadInputsRuleSet",
        excludedRules: [],
      },
    },
    overrideAction: {
      none: {},
    },
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
    },
  },
  // Blocks common SQL Injection
  // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-use-case.html#aws-managed-rule-groups-use-case-sql-db
  {
    name: "AWS-AWSManagedRulesSQLiRuleSet",
    priority: 50,
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWSManagedRulesSQLiRuleSet",
    },
    overrideAction: {
      none: {},
    },
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWS-AWSManagedRulesSQLiRuleSet",
        excludedRules: [],
      },
    },
  },
  // Blocks attacks targeting LFI (Local File Injection) for Linux systems.
  // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-use-case.html#aws-managed-rule-groups-use-case-linux-os
  {
    name: "AWS-AWSManagedRuleLinux",
    priority: 60,
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWSManagedRuleLinux",
    },
    overrideAction: {
      none: {},
    },
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWS-AWSManagedRulesLinuxRuleSet",
        excludedRules: [],
      },
    },
  },
  // Blocks request patterns associated with the exploitation of vulnerabilities specific to POSIX and POSIX-like operating systems;
  // including, but not limited to: Linux, AIX, HP-UX, macOS, Solaris, FreeBSD, and OpenBSD.
  // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-use-case.html#aws-managed-rule-groups-use-case-linux-os
  {
    name: "AWS-AWSManagedRulesUnixRuleSet",
    priority: 70,
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWSManagedRulesUnixRuleSet",
    },
    overrideAction: {
      none: {},
    },
    statement: {
      managedRuleGroupStatement: {
        vendorName: "AWS",
        name: "AWS-AWSManagedRulesUnixRulesSet",
        excludedRules: [],
      },
    },
  },
];
