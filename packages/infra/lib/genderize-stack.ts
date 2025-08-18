// lib/genderize-stack.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import { Duration } from "aws-cdk-lib";
import * as path from "node:path";
import type * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";

import { EnvConfig } from "../config/env-config";

export interface GenderizeStackProps extends cdk.StackProps {
  config: EnvConfig;
  vpc?: ec2.IVpc;
  alarmAction?: actions.SnsAction;
}

export class GenderizeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GenderizeStackProps) {
    super(scope, id, props);

    const { config, alarmAction } = props;

    const dockerContext = path.resolve(__dirname, "../../../models/genderize"); // from dist/lib → repo/models/genderize

    const fn = new lambda.DockerImageFunction(this, "GenderizeLambda", {
      functionName: `Genderize-${config.environmentType}`,
      code: lambda.DockerImageCode.fromImageAsset(dockerContext, {
        file: "Dockerfile.lambda",
        platform: ecrAssets.Platform.LINUX_AMD64,
        // Force a new asset hash each synth:
        buildArgs: { FORCE_REBUILD_TS: `${Date.now()}` },
      }),
      architecture: lambda.Architecture.X86_64,
      memorySize: 4096,
      timeout: Duration.seconds(120),
      environment: {
        ENV_TYPE: config.environmentType,
        HF_HOME: "/tmp/hf",
      },
    });

    if (alarmAction) {
      new cloudwatch.Alarm(this, "GenderizeErrors", {
        metric: fn.metricErrors({ period: Duration.minutes(1), statistic: "sum" }),
        threshold: 1,
        evaluationPeriods: 1,
      }).addAlarmAction(alarmAction);

      new cloudwatch.Alarm(this, "GenderizeP95", {
        metric: fn.metricDuration({ period: Duration.minutes(5), statistic: "p95" }),
        threshold: 1500,
        evaluationPeriods: 1,
      }).addAlarmAction(alarmAction);
    }
  }
}
