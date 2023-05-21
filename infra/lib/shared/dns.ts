import * as r53 from "aws-cdk-lib/aws-route53";

export type DnsZones = {
  privateZone: r53.IPrivateHostedZone;
  publicZone: r53.IHostedZone;
};
