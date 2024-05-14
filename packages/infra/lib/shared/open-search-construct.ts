import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { ComparisonOperator, Metric } from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  CapacityConfig,
  Domain,
  EbsOptions,
  EngineVersion,
  IDomain,
} from "aws-cdk-lib/aws-opensearchservice";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

const masterUserName = "admin";
const MAX_AVAILABILITY_ZONES = 3;

export interface OpenSearchAlarmThresholds {
  statusRed?: boolean;
  statusYellow?: boolean;
  freeStorageMB?: number;
  masterCpuUtilization?: number;
  cpuUtilization?: number;
  jvmMemoryPressure?: number;
  searchLatency?: number;
}
export interface OpenSearchConstructProps {
  awsAccount: string;
  region: string;
  vpc: ec2.IVpc;
  capacity: CapacityConfig;
  ebs: EbsOptions;
  encryptionAtRest?: boolean;
  alarmThresholds?: OpenSearchAlarmThresholds;
}

export default class OpenSearchConstruct extends Construct {
  public readonly domain: IDomain;
  public readonly creds: { username: string; secret: ISecret };

  constructor(scope: Construct, id: string, props: OpenSearchConstructProps) {
    super(scope, `${id}Construct`);

    const { vpc, capacity, ebs, encryptionAtRest = true } = props;
    const dataNodesCount = capacity.dataNodes ?? 1;
    const subnetsCount = vpc.privateSubnets.length;
    const azCount = Math.min(subnetsCount, dataNodesCount);

    const secretName = `${id}SecretName`;
    const credsSecret = new secret.Secret(this, secretName, {
      secretName,
      generateSecretString: { includeSpace: false },
    });
    this.creds = {
      username: masterUserName,
      secret: credsSecret,
    };

    const osSg = new ec2.SecurityGroup(this, `${id}-sg`, {
      securityGroupName: `${id}-sg`,
      vpc,
    });

    osSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTraffic());

    const zoneAwareness =
      azCount < 1
        ? undefined
        : azCount === 1
        ? { enabled: false }
        : {
            enabled: true,
            availabilityZoneCount: Math.min(azCount, MAX_AVAILABILITY_ZONES),
          };
    if (!zoneAwareness) throw new Error(`Invalid AZ count: ${azCount}`);

    const domainName = `${id}-domain`.toLowerCase();

    const accessPolicy: iam.PolicyStatement = new iam.PolicyStatement();
    accessPolicy.addAnyPrincipal();
    accessPolicy.addResources(
      `arn:aws:es:${props.region}:${props.awsAccount}:domain/${domainName}/*`
    );
    accessPolicy.addActions("es:*");
    accessPolicy.effect = iam.Effect.ALLOW;

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
          subnets: vpc.privateSubnets.slice(0, azCount),
          availabilityZones: vpc.availabilityZones.slice(0, azCount),
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
      accessPolicies: [accessPolicy],
      logging: {
        slowSearchLogEnabled: true,
        slowIndexLogEnabled: true,
        appLogEnabled: true,
      },
      enableAutoSoftwareUpdate: true,
    });

    this.createAlarms(id, props.alarmThresholds);

    new CfnOutput(this, `${id}DomainID`, {
      description: `OpenSearch ${id} Domain ID`,
      value: this.domain.domainId,
    });
    new CfnOutput(this, `${id}DomainEndpoint`, {
      description: `OpenSearch ${id} Domain Endpoint`,
      value: this.domain.domainEndpoint,
    });
  }

  private createAlarms(
    id: string,
    {
      statusRed,
      statusYellow,
      freeStorageMB,
      masterCpuUtilization,
      cpuUtilization,
      jvmMemoryPressure,
      searchLatency,
    }: OpenSearchAlarmThresholds = {}
  ) {
    const createAlarm = ({
      metric,
      name,
      threshold,
      evaluationPeriods,
      comparisonOperator,
    }: {
      metric: Metric;
      name: string;
      threshold: number;
      evaluationPeriods: number;
      comparisonOperator?: ComparisonOperator;
    }) => {
      metric.createAlarm(this, `${id}${name}`, {
        threshold,
        evaluationPeriods,
        alarmName: `${id}${name}`,
        comparisonOperator,
      });
    };

    (statusRed == null || statusRed) &&
      createAlarm({
        metric: this.domain.metricClusterStatusRed(),
        name: "ClusterStatusRed",
        threshold: 1,
        evaluationPeriods: 1,
      });
    (statusYellow == null || statusYellow) &&
      createAlarm({
        metric: this.domain.metricClusterStatusYellow(),
        name: "ClusterStatusYellow",
        threshold: 1,
        evaluationPeriods: 3,
      });

    createAlarm({
      metric: this.domain.metricFreeStorageSpace(),
      name: "FreeStorage",
      threshold: freeStorageMB ?? 5_000,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
    });

    createAlarm({
      metric: this.domain.metricMasterCPUUtilization(),
      name: "MasterCPUUtilization",
      threshold: masterCpuUtilization ?? 90,
      evaluationPeriods: 3,
    });
    createAlarm({
      metric: this.domain.metricCPUUtilization(),
      name: "CPUUtilization",
      threshold: cpuUtilization ?? 90,
      evaluationPeriods: 3,
    });

    createAlarm({
      metric: this.domain.metricJVMMemoryPressure(),
      name: "JVMMemoryPressure",
      threshold: jvmMemoryPressure ?? 90,
      evaluationPeriods: 3,
    });
    createAlarm({
      metric: this.domain.metricSearchLatency(),
      name: "SearchLatency",
      threshold: searchLatency ?? 300,
      evaluationPeriods: 1,
    });
  }
}
