import { Aspects, CfnOutput } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { IHEGatewayProps } from "../../config/ihe-gateway-config";
import { addDBClusterPerformanceAlarms } from "../shared/rds";

// export interface IHEGatewayAlarmThresholds {
//   masterCpuUtilization?: number;
//   cpuUtilization?: number;
// }
export interface IHEDatabaseConstructProps {
  config: IHEGatewayProps;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction | undefined;
}

const id = "IHEDatabase";

export default class IHEDBConstruct extends Construct {
  public readonly secret: secret.ISecret;
  public readonly server: rds.IDatabaseCluster;

  constructor(scope: Construct, props: IHEDatabaseConstructProps) {
    super(scope, `${id}Construct`);

    const { vpc, config, alarmAction } = props;

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
    // TODO 1377 validate that it copies the props from the default group
    // TODO 1377 validate that it copies the props from the default group
    // TODO 1377 validate that it copies the props from the default group
    // TODO 1377 validate that it copies the props from the default group
    const parameterGroup = new rds.ParameterGroup(this, "FHIR_DB_Params", {
      engine: dbEngine,
      parameters: {
        log_min_duration_statement: config.rds.minSlowLogDurationInMs.toString(),
      },
    });
    const dbCluster = new rds.DatabaseCluster(this, `${id}DB`, {
      engine: dbEngine,
      instanceProps: {
        vpc,
        instanceType: new ec2.InstanceType("serverless"),
      },
      credentials: dbCreds,
      defaultDatabaseName: dbName,
      clusterIdentifier: dbClusterName,
      storageEncrypted: true,
      parameterGroup,
      cloudwatchLogsExports: ["postgresql"],
    });
    this.server = dbCluster;

    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: config.rds.minDBCap,
            maxCapacity: config.rds.maxDBCap,
          };
        }
      },
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
