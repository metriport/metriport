import { Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Code, ILayerVersion, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";
import { createLambda } from "./shared/lambda";

interface LambdasStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
}

export class LambdasStack extends Stack {
  private lambdaDependencies!: ILayerVersion;

  constructor(scope: Construct, id: string, props: LambdasStackProps) {
    super(scope, id, {
      ...props,
      stackName: id,
    });

    this.setupDependencies();

    this.setupTester(props);

    // TODO 715 add remaining lambdas
  }

  private setupDependencies(): void {
    this.lambdaDependencies = new LayerVersion(this, "lambdaNodeModules", {
      code: Code.fromAsset("../api/lambdas/layers/shared/shared-layer.zip"),
    });
  }

  private setupTester(props: LambdasStackProps): lambda.Function {
    const { environmentType, lambdasSentryDSN } = props.config;
    return createLambda({
      stack: this,
      name: "Tester",
      vpc: props.vpc,
      subnets: props.vpc.privateSubnets,
      entry: "tester",
      layers: [this.lambdaDependencies],
      runtime: Runtime.NODEJS_18_X,
      envVars: {
        ENV_TYPE: environmentType,
        ...(lambdasSentryDSN ? { SENTRY_DSN: lambdasSentryDSN } : {}),
      },
    });
  }
}
