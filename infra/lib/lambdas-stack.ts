import { Stack, StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { FargateService, FargateTaskDefinition } from "aws-cdk-lib/aws-ecs";
import { IRole } from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Code, ILayerVersion, LayerVersion } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { ApiGateway } from "./api-stack";
import * as fhirConverterConnector from "./creators/fhir-converter-connector";
import * as sidechainFHIRConverterConnector from "./creators/sidechain-fhir-converter-connector";
import { EnvConfig } from "./env-config";
import { FHIRConnector } from "./fhir-connector-stack";
import { createCdaToVisualizationLambda } from "./lambdas/cda-to-visualization";
import { createDocQueryChecker } from "./lambdas/doc-query-checker";
import { createGarminLambda } from "./lambdas/garmin";
import { createTesterLambda } from "./lambdas/tester";

interface LambdasStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  apiService: FargateService;
  apiServiceDnsAddress: string;
  apiTaskDefArn: string;
  medicalDocumentsBucket: s3.Bucket | undefined;
  apiGateway: ApiGateway;
  dynamoDBTokenTable: dynamodb.Table;
  fhirConnector: FHIRConnector;
  sidechainFHIRConnector: FHIRConnector;
  fhirServerQueue: Queue | undefined;
  alarmAction: SnsAction | undefined;
}

type APITaskRole = {
  apiTaskRole: IRole;
};

export class LambdasStack extends Stack {
  private lambdaDependencies!: ILayerVersion;

  constructor(scope: Construct, id: string, props: LambdasStackProps) {
    super(scope, id, {
      ...props,
      stackName: id,
    });

    this.setupDependencies();

    this.setupTester(props);

    const apiTaskRole = this.getApiTaskRole(props);

    this.setupCdaToVisualization({ ...props, apiTaskRole });

    this.setupGarmin(props);

    this.setupScheduled(props);

    this.setupFHIRConverter({ ...props, apiTaskRole });
    this.setupSidechainFHIRConverter({ ...props, apiTaskRole });

    // TODO 715 add remaining lambdas
  }

  private setupDependencies(): void {
    this.lambdaDependencies = new LayerVersion(this, "lambdaNodeModules", {
      code: Code.fromAsset("../api/lambdas/layers/shared/shared-layer.zip"),
    });
  }

  private getApiTaskRole(props: LambdasStackProps): IRole {
    const taskDef = FargateTaskDefinition.fromFargateTaskDefinitionArn(
      this,
      "apiTaskDefForCDALambda",
      props.apiTaskDefArn
    );
    if (!taskDef) throw new Error("API task definition not found");
    return taskDef.taskRole;
  }

  private setupTester(props: LambdasStackProps): lambda.Function {
    return createTesterLambda({
      stack: this,
      config: props.config,
      vpc: props.vpc,
      sharedNodeModules: this.lambdaDependencies,
    });
  }

  private setupCdaToVisualization(
    props: LambdasStackProps & APITaskRole
  ): lambda.Function | undefined {
    const medicalDocumentsBucket = props.medicalDocumentsBucket;
    if (medicalDocumentsBucket) {
      return createCdaToVisualizationLambda({
        stack: this,
        config: props.config,
        sharedNodeModules: this.lambdaDependencies,
        vpc: props.vpc,
        apiTaskRole: props.apiTaskRole,
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
      apiServiceDnsAddress: props.apiServiceDnsAddress,
      apiGateway: props.apiGateway,
      dynamoDBTokenTable: props.dynamoDBTokenTable,
    });
  }

  private setupScheduled(props: LambdasStackProps): lambda.Function | undefined {
    return createDocQueryChecker({
      stack: this,
      sharedNodeModules: this.lambdaDependencies,
      apiAddress: props.apiServiceDnsAddress,
      vpc: props.vpc,
    });
  }

  private setupFHIRConverter(props: LambdasStackProps & APITaskRole): lambda.Function | undefined {
    const { fhirServerQueue } = props;
    if (!fhirServerQueue) return undefined;
    return fhirConverterConnector.createLambda({
      stack: this,
      sharedNodeModules: this.lambdaDependencies,
      envType: props.config.environmentType,
      vpc: props.vpc,
      sourceQueue: props.fhirConnector.queue,
      destinationQueue: fhirServerQueue,
      dlq: props.fhirConnector.dlq,
      fhirConverterBucket: props.fhirConnector.bucket,
      apiTaskRole: props.apiTaskRole,
      apiServiceDnsAddress: props.apiServiceDnsAddress,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      alarmSnsAction: props.alarmAction,
    });
  }
  private setupSidechainFHIRConverter(
    props: LambdasStackProps & APITaskRole
  ): lambda.Function | undefined {
    const { fhirServerQueue } = props;
    if (!fhirServerQueue) return undefined;
    return sidechainFHIRConverterConnector.createLambda({
      stack: this,
      sharedNodeModules: this.lambdaDependencies,
      envType: props.config.environmentType,
      vpc: props.vpc,
      sourceQueue: props.sidechainFHIRConnector.queue,
      destinationQueue: fhirServerQueue,
      dlq: props.sidechainFHIRConnector.dlq,
      fhirConverterBucket: props.sidechainFHIRConnector.bucket,
      apiTaskRole: props.apiTaskRole,
      apiServiceDnsAddress: props.apiServiceDnsAddress,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      alarmSnsAction: props.alarmAction,
    });
  }
}
