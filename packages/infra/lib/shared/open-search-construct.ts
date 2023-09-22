import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import {
  CapacityConfig,
  Domain,
  EbsOptions,
  EngineVersion,
  IDomain,
} from "aws-cdk-lib/aws-opensearchservice";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

const masterUserName = "admin";

export interface OpenSearchConstructProps {
  region: string;
  vpc: ec2.IVpc;
  capacity: CapacityConfig;
  ebs: EbsOptions;
  encryptionAtRest?: boolean;
}

export default class OpenSearchConstruct extends Construct {
  public readonly domain: IDomain;
  public readonly creds: { user: string; secretName: string };

  constructor(scope: Construct, id: string, props: OpenSearchConstructProps) {
    super(scope, `${id}Construct`);

    const { vpc, region, capacity, ebs, encryptionAtRest = true } = props;

    const secretName = "OpenSearchSecretName";
    const credsSecret = new secret.Secret(this, secretName, {
      secretName,
      generateSecretString: { includeSpace: false },
    });
    this.creds = {
      user: masterUserName,
      secretName,
    };

    const osSg = new ec2.SecurityGroup(this, `${id}-sg`, {
      securityGroupName: `${id}-sg`,
      vpc,
    });

    const domainName = `${id}-domain`.toLowerCase();
    this.domain = new Domain(this, domainName, {
      domainName,
      version: EngineVersion.OPENSEARCH_2_5,
      removalPolicy: RemovalPolicy.DESTROY,
      enableVersionUpgrade: true,
      capacity,
      ebs,
      vpc,
      vpcSubnets: [
        {
          // Had issues setting this up, this + zoneAwareness did the trick. The error was:
          // "Invalid request provided: You must specify exactly one subnet. (Service: OpenSearch, Status Code: 400..."
          // subnets: [vpc.privateSubnets[0]!],
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          // subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          // TODO 1050 try to solve this
          availabilityZones: [`${region}a`],
          // availabilityZones: vpc.availabilityZones.slice(0, capacity.dataNodes),
          onePerAz: true,
        },
      ],
      zoneAwareness: {
        enabled: false,
      },
      securityGroups: [osSg],
      encryptionAtRest: {
        enabled: encryptionAtRest,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
      fineGrainedAccessControl: {
        masterUserName,
        masterUserPassword: credsSecret.secretValue,
      },
      logging: {
        slowSearchLogEnabled: true,
        slowIndexLogEnabled: true,
        appLogEnabled: true,
      },
    });

    new CfnOutput(this, `${id}DomainID`, {
      description: `OpenSearch ${id} Domain ID`,
      value: this.domain.domainId,
    });
    new CfnOutput(this, `${id}DomainEndpoint`, {
      description: `OpenSearch ${id} Domain Endpoint`,
      value: this.domain.domainEndpoint,
    });
  }
}
