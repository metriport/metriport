import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../env-config";
import { createLambda } from "../shared/lambda";

export type TesterLambdaProps = {
  stack: Construct;
  config: EnvConfig;
  sharedNodeModules: lambda.ILayerVersion;
  vpc: ec2.IVpc;
};

export function createTesterLambda(props: TesterLambdaProps): lambda.Function {
  const { stack, sharedNodeModules } = props;
  const { environmentType, lambdasSentryDSN } = props.config;
  return createLambda({
    stack,
    name: "Tester",
    vpc: props.vpc,
    subnets: props.vpc.privateSubnets,
    entry: "tester",
    layers: [sharedNodeModules],
    runtime: lambda.Runtime.NODEJS_18_X,
    envVars: {
      ENV_TYPE: environmentType,
      ...(lambdasSentryDSN ? { SENTRY_DSN: lambdasSentryDSN } : {}),
    },
  });
}
