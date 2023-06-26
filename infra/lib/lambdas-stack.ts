import { Stack, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { FargateService } from "aws-cdk-lib/aws-ecs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Code, ILayerVersion, LayerVersion } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";
import { createCdaToVisualizationLambda } from "./lambdas/cda-to-visualization";
import { createGarminLambda } from "./lambdas/garmin";
import { createTesterLambda } from "./lambdas/tester";

interface LambdasStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  apiService: FargateService;
  apiServiceDnsAddress: string;
  medicalDocumentsBucket: s3.Bucket | undefined;
  apiGatewayWebhookResource: apig.Resource;
  dynamoDBTokenTable: dynamodb.Table;
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

    this.setupCdaToVisualization(props);

    this.setupGarmin(props);

    // TODO 715 add remaining lambdas
  }

  private setupDependencies(): void {
    this.lambdaDependencies = new LayerVersion(this, "lambdaNodeModules", {
      code: Code.fromAsset("../api/lambdas/layers/shared/shared-layer.zip"),
    });
  }

  private setupTester(props: LambdasStackProps): lambda.Function {
    return createTesterLambda({
      stack: this,
      config: props.config,
      vpc: props.vpc,
      sharedNodeModules: this.lambdaDependencies,
    });
  }

  private setupCdaToVisualization(props: LambdasStackProps): lambda.Function | undefined {
    const medicalDocumentsBucket = props.medicalDocumentsBucket;
    if (medicalDocumentsBucket) {
      return createCdaToVisualizationLambda({
        stack: this,
        config: props.config,
        sharedNodeModules: this.lambdaDependencies,
        vpc: props.vpc,
        caller: props.apiService.taskDefinition.taskRole,
        medicalDocumentsBucket,
      });
    }
    return undefined;
  }

  private setupGarmin(props: LambdasStackProps): lambda.Function | undefined {
    return createGarminLambda({
      stack: this,
      config: props.config,
      sharedNodeModules: this.lambdaDependencies,
      vpc: props.vpc,
      apiService: props.apiService,
      apiServiceDnsAddress: props.apiServiceDnsAddress,
      apiGatewayBaseResource: props.apiGatewayWebhookResource,
      dynamoDBTokenTable: props.dynamoDBTokenTable,
    });
  }
}
