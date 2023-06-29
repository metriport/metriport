import * as apig from "aws-cdk-lib/aws-apigateway";
import { Resource } from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { ApiGateway } from "../api-stack";
import { EnvConfig } from "../env-config";
import { createLambda } from "../shared/lambda";

export type WithingsLambdaProps = {
  stack: Construct;
  config: EnvConfig;
  lambdaLayers: lambda.ILayerVersion[];
  vpc: ec2.IVpc;
  apiGateway: ApiGateway;
  apiServiceDnsAddress: string;
};

export function createWithingsLambda(props: WithingsLambdaProps): lambda.Function {
  const { stack, vpc, lambdaLayers, apiGateway, apiServiceDnsAddress } = props;
  const { environmentType, lambdasSentryDSN } = props.config;

  const digLayer = new lambda.LayerVersion(stack, "dig-layer", {
    compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
    code: lambda.Code.fromAsset("../api/lambdas/layers/dig-layer"),
    description: "Adds dig to the Withings lambda",
  });

  const withingsLambda = createLambda({
    stack: stack,
    name: "WithingsLambda",
    vpc: vpc,
    subnets: vpc.privateSubnets,
    entry: "withings",
    layers: [...lambdaLayers, digLayer],
    runtime: lambda.Runtime.NODEJS_16_X,
    envVars: {
      API_URL: `http://${apiServiceDnsAddress}/webhook/withings`,
      ENV_TYPE: environmentType,
      ...(lambdasSentryDSN ? { SENTRY_DSN: lambdasSentryDSN } : {}),
    },
  });

  const apiGW = apig.RestApi.fromRestApiAttributes(stack, "ApiGWForGarmin", {
    restApiId: apiGateway.apiId,
    rootResourceId: apiGateway.apiRootResourceId,
  });
  const webhookResource = Resource.fromResourceAttributes(stack, "WebhookResourceForGarmin", {
    restApi: apiGW,
    resourceId: apiGateway.apiWebhookResourceId,
    path: apiGateway.apiWebhookPath,
  });
  if (!webhookResource) throw Error("Webhook resource not found on Garmin");
  const withingsResource = webhookResource.addResource("withings");
  withingsResource.addMethod("ANY", new apig.LambdaIntegration(withingsLambda));

  return withingsLambda;
}
