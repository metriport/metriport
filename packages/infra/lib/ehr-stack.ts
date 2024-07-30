import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";

import { Construct } from "constructs";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { EnvConfig } from "../config/env-config";
import { createLambda } from "./shared/lambda";
import { EnvType } from "./env-type";

interface EHRStackProps extends NestedStackProps {
  lambdaLayers: LambdaLayers;
  secrets: Secrets;
  vpc: ec2.IVpc;
  config: EnvConfig;
}

export class EHRStack extends NestedStack {
  constructor(scope: Construct, id: string, props: EHRStackProps) {
    super(scope, id, props);

    this.setupCanvasIntergationLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      secrets: props.secrets,
      envType: props.config.environmentType,
    });
  }

  private setupCanvasIntergationLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    envType: EnvType;
  }): Lambda {
    const { lambdaLayers, vpc, envType } = ownProps;

    const canvasIntegrationLambda = createLambda({
      stack: this,
      name: "CanvasIntegration",
      entry: "canvas-integration",
      envType: envType,
      envVars: {},
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(10),
      vpc,
    });

    return canvasIntegrationLambda;
  }
}
