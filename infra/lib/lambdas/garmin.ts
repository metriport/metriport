import * as apig from "aws-cdk-lib/aws-apigateway";
import { Resource } from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { ApiGateway } from "../api-stack";
import { EnvConfig } from "../env-config";
import { addErrorAlarmToLambdaFunc, createLambda } from "../shared/lambda";

export type GarminLambdaProps = {
  stack: Construct;
  config: EnvConfig;
  lambdaLayers: lambda.ILayerVersion[];
  vpc: ec2.IVpc;
  apiGateway: ApiGateway;
  apiServiceDnsAddress: string;
  dynamoDBTokenTable: dynamodb.Table;
};

export function createGarminLambda(props: GarminLambdaProps): lambda.Function {
  const { stack, vpc, lambdaLayers, apiServiceDnsAddress, dynamoDBTokenTable, apiGateway } = props;
  const { environmentType, lambdasSentryDSN } = props.config;

  const garminLambda = createLambda({
    stack: stack,
    name: "GarminLambda",
    vpc: vpc,
    subnets: vpc.privateSubnets,
    entry: "garmin",
    layers: lambdaLayers,
    runtime: lambda.Runtime.NODEJS_18_X,
    envVars: {
      TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
      API_URL: `http://${apiServiceDnsAddress}/webhook/garmin`,
      ENV_TYPE: environmentType,
      ...(lambdasSentryDSN ? { SENTRY_DSN: lambdasSentryDSN } : {}),
    },
  });
  addErrorAlarmToLambdaFunc(stack, garminLambda, "GarminAuthFunctionAlarm");

  // Grant lambda access to the DynamoDB token table
  garminLambda.role && dynamoDBTokenTable.grantReadData(garminLambda.role);

  // setup $base/garmin path with token auth
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
  const garminResource = webhookResource.addResource("garmin");
  garminResource.addMethod("ANY", new apig.LambdaIntegration(garminLambda));

  return garminLambda;
}
