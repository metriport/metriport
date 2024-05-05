import { Aspects, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { BackupResource } from "aws-cdk-lib/aws-backup";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { IHEGatewayProps } from "../../config/ihe-gateway-config";
import { EnvType } from "../env-type";
import { DailyBackup } from "../shared/backup";
import { addDBClusterPerformanceAlarms } from "../shared/rds";
import { isProdEnv } from "../shared/util";

export interface IHEDatabaseConstructProps {
  env: EnvType;
  config: IHEGatewayProps;
  vpc: ec2.IVpc;
  privateZone: r53.IPrivateHostedZone;
  domain: string;
  alarmAction?: SnsAction | undefined;
}

const id = "IHEDatabase";

export default class IHEDBConstruct extends Construct {
  public readonly secret: secret.ISecret;
  public readonly server: rds.IDatabaseCluster;

  constructor(scope: Construct, props: IHEDatabaseConstructProps) {
    super(scope, `${id}Construct`);

    const { vpc, config, privateZone, domain, alarmAction } = props;

    const dbClusterName = "ihe-db";
    const dbName = config.rds.dbName;
    const dbUsername = config.rds.userName;
    const dbPasswordSecret = new secret.Secret(this, `${id}Password`, {
      secretName: `${id}Password`,
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
      },
    });
    const dbCreds = rds.Credentials.fromPassword(dbUsername, dbPasswordSecret.secretValue);
    this.secret = dbPasswordSecret;

    const dbEngine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_14_7,
    });
    const parameterGroup = new rds.ParameterGroup(this, "IHE_GW_DB_Params", {
      engine: dbEngine,
      parameters: {
        ...(config.rds.minSlowLogDurationInMs
          ? {
              log_min_duration_statement: config.rds.minSlowLogDurationInMs.toString(),
            }
          : undefined),
      },
    });
    const dbCluster = new rds.DatabaseCluster(this, `${id}DB`, {
      engine: dbEngine,
      instanceProps: {
        vpc,
        instanceType: new ec2.InstanceType("serverless"),
        enablePerformanceInsights: true,
        parameterGroup,
      },
      preferredMaintenanceWindow: config.rds.maintenanceWindow,
      credentials: dbCreds,
      defaultDatabaseName: dbName,
      clusterIdentifier: dbClusterName,
      storageEncrypted: true,
      parameterGroup,
      cloudwatchLogsExports: ["postgresql"],
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.server = dbCluster;

    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: config.rds.minCapacity,
            maxCapacity: config.rds.maxCapacity,
          };
        }
      },
    });

    if (isProdEnv(props.env)) {
      new DailyBackup(this, "IHE_GW_DB_Backup", {
        backupPlanName: "IHE_GW_DB",
        resources: [BackupResource.fromRdsDatabaseCluster(dbCluster)],
      });
    }

    new r53.CnameRecord(this, `${id}PrivateRecord`, {
      recordName: `db.${config.subdomain}.${domain}`,
      zone: privateZone,
      domainName: dbCluster.clusterEndpoint.hostname,
    });

    addDBClusterPerformanceAlarms(
      this,
      dbCluster,
      dbClusterName,
      config.rds.alarmThresholds,
      alarmAction
    );

    new CfnOutput(this, `${id}ClusterId`, {
      description: ` ${id} Cluster ID`,
      value: dbCluster.clusterIdentifier,
    });
  }
}
