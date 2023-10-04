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
const MAX_AVAILABILITY_ZONES = 3;

export interface OpenSearchConstructProps {
  region: string;
  vpc: ec2.IVpc;
  capacity: CapacityConfig;
  ebs: EbsOptions;
  encryptionAtRest?: boolean;
}

export default class OpenSearchConstruct extends Construct {
  public readonly domain: IDomain;
  public readonly creds: { username: string; secretName: string };

  constructor(scope: Construct, id: string, props: OpenSearchConstructProps) {
    super(scope, `${id}Construct`);

    const { vpc, capacity, ebs, encryptionAtRest = true } = props;
    const dataNodesCount = capacity.dataNodes ?? 1;

    const secretName = `${id}SecretName`;
    const credsSecret = new secret.Secret(this, secretName, {
      secretName,
      generateSecretString: { includeSpace: false },
    });
    this.creds = {
      username: masterUserName,
      secretName,
    };

    const osSg = new ec2.SecurityGroup(this, `${id}-sg`, {
      securityGroupName: `${id}-sg`,
      vpc,
    });

    const zoneAwareness =
      dataNodesCount < 1
        ? undefined
        : dataNodesCount === 1
        ? { enabled: false }
        : {
            enabled: true,
            availabilityZoneCount: Math.min(dataNodesCount, MAX_AVAILABILITY_ZONES),
          };
    if (!zoneAwareness) throw new Error(`Invalid data nodes count: ${dataNodesCount}`);

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
          subnets: vpc.privateSubnets.slice(0, dataNodesCount),
          availabilityZones: vpc.availabilityZones.slice(0, dataNodesCount),
        },
      ],
      zoneAwareness,
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
