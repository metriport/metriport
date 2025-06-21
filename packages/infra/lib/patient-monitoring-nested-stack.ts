import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { LambdaSettings } from "./shared/settings";

function settings() {
  const timeout = Duration.seconds(61);
  const patientMonitoringDischargeRequery: LambdaSettings = {
    name: "DischargeRequery",
    entry: "patient-monitoring/discharge-requery",
    lambda: {
      memory: 512 as const,
      timeout,
    },
  };

  return {
    patientMonitoringDischargeRequery,
  };
}

interface PatientMonitoringNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  secrets: Secrets;
}

export class PatientMonitoringNestedStack extends NestedStack {
  public readonly dischargeRequeryLambda: Lambda;

  constructor(scope: Construct, id: string, props: PatientMonitoringNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const analyticsSecret = props.secrets["POST_HOG_API_KEY_SECRET"];
    if (!analyticsSecret) {
      throw new Error("Analytics secret is required");
    }

    const lambda = this.setupDischargeRequeryLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      analyticsSecret,
    });

    this.dischargeRequeryLambda = lambda;
  }

  private setupDischargeRequeryLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    analyticsSecret: ISecret;
  }): Lambda {
    const { lambdaLayers, vpc, sentryDsn, envType, alarmAction, analyticsSecret } = ownProps;
    const { name, entry, lambda: lambdaSettings } = settings().patientMonitoringDischargeRequery;

    const lambda = createLambda({
      ...lambdaSettings,
      name,
      entry,
      stack: this,
      envType,
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
    });

    analyticsSecret.grantRead(lambda);

    return lambda;
  }
}
