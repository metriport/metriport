import * as apig from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../env-config";
import { addErrorAlarmToLambdaFunc, createLambda } from "../shared/lambda";

export type GarminLambdaProps = {
  stack: Construct;
  config: EnvConfig;
  sharedNodeModules: lambda.ILayerVersion;
  vpc: ec2.IVpc;
  apiGatewayBaseResource: apig.Resource;
  apiService: ecs.FargateService;
  apiServiceDnsAddress: string;
  dynamoDBTokenTable: dynamodb.Table;
};

export function createGarminLambda(props: GarminLambdaProps): lambda.Function {
  const {
    stack,
    vpc,
    sharedNodeModules,
    apiService,
    apiServiceDnsAddress,
    dynamoDBTokenTable,
    apiGatewayBaseResource,
  } = props;
  const { environmentType, lambdasSentryDSN } = props.config;

  const garminLambda = createLambda({
    stack: stack,
    name: "GarminLambda",
    vpc: vpc,
    subnets: vpc.privateSubnets,
    entry: "garmin",
    layers: [sharedNodeModules],
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

  // Grant lambda access to the api server
  apiService.connections.allowFrom(garminLambda, ec2.Port.allTcp());

  // setup $base/garmin path with token auth
  const garminResource = apiGatewayBaseResource.addResource("garmin");
  garminResource.addMethod("ANY", new apig.LambdaIntegration(garminLambda));

  return garminLambda;
}
