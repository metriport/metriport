import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../env-config";
import { createLambda } from "../shared/lambda";

export type CdaToVisualizationLambdaProps = {
  stack: Construct;
  config: EnvConfig;
  lambdaLayers: lambda.ILayerVersion[];
  vpc: ec2.IVpc;
  apiTaskRole: IGrantable;
  medicalDocumentsBucket: s3.IBucket;
};

export function createCdaToVisualizationLambda(
  props: CdaToVisualizationLambdaProps
): lambda.Function {
  const { stack, lambdaLayers, apiTaskRole, medicalDocumentsBucket } = props;
  const {
    environmentType,
    lambdasSentryDSN,
    medicalDocumentsBucketName,
    cdaToVisualizationLambdaName,
  } = props.config;

  const chromiumLayer = new lambda.LayerVersion(stack, "chromium-layer", {
    compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
    code: lambda.Code.fromAsset("../api/lambdas/layers/chromium"),
    description: "Adds chromium to the lambda",
  });

  const cdaToVisualizationLambda = createLambda({
    stack: stack,
    name: cdaToVisualizationLambdaName,
    vpc: props.vpc,
    subnets: props.vpc.privateSubnets,
    entry: "cda-to-visualization",
    layers: [...lambdaLayers, chromiumLayer],
    runtime: lambda.Runtime.NODEJS_16_X,
    memory: 512,
    timeout: Duration.minutes(1),
    envVars: {
      ENV_TYPE: environmentType,
      ...(lambdasSentryDSN ? { SENTRY_DSN: lambdasSentryDSN } : {}),
      ...(medicalDocumentsBucketName && {
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucketName,
      }),
    },
  });
  // Allow the API to call this lambda
  cdaToVisualizationLambda.grantInvoke(apiTaskRole);
  // Allow this lambda to read/write to the medical documents bucket
  medicalDocumentsBucket.grantReadWrite(cdaToVisualizationLambda);

  return cdaToVisualizationLambda;
}
