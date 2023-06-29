import { Stack, StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { FargateService, FargateTaskDefinition } from "aws-cdk-lib/aws-ecs";
import { IRole, Role } from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { ILayerVersion } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ApiGateway } from "./api-stack";
import { createLambda as createFHIRConverterLambda } from "./creators/fhir-converter-connector";
import { createLambda as createFHIRServerLambda } from "./creators/fhir-server-connector";
import { createLambda as createSidechainFHIRConverterLambda } from "./creators/sidechain-fhir-converter-connector";
import { EnvConfig } from "./env-config";
import { FHIRConnectorARNs, FHIRConnectorStack } from "./fhir-connector-stack";
import { createCdaToVisualizationLambda } from "./lambdas/cda-to-visualization";
import { createDocQueryChecker } from "./lambdas/doc-query-checker";
import { createGarminLambda } from "./lambdas/garmin";
import { createTesterLambda } from "./lambdas/tester";

interface LambdasStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  lambdaLayers: ILayerVersion[];
  apiService: FargateService;
  apiServiceDnsAddress: string;
  apiTaskDefArn: string;
  apiTaskRoleArn: string;
  medicalDocumentsBucket: s3.IBucket | undefined;
  apiGateway: ApiGateway;
  dynamoDBTokenTable: dynamodb.Table;
  fhirConverterConnectorARNs: FHIRConnectorARNs;
  sidechainFHIRConverterConnectorARNs: FHIRConnectorARNs;
  fhirServerConnectorARNs: FHIRConnectorARNs;
  alarmAction?: SnsAction | undefined;
}

type APITaskRole = {
  apiTaskRole: IRole;
};

export class LambdasStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdasStackProps) {
    super(scope, id, {
      ...props,
      stackName: id,
    });

    this.setupTester(props);

    const apiTaskRole = this.getApiTaskRole(props);

    this.setupCdaToVisualization({ ...props, apiTaskRole });

    this.setupGarmin(props);

    this.setupScheduled(props);

    this.setupFHIRConverter({ ...props, apiTaskRole });
    this.setupSidechainFHIRConverter({ ...props, apiTaskRole });

    this.setupFHIRServerLambda({ ...props, apiTaskRole });

    // TODO 715 add remaining lambdas
  }

  private getApiTaskRole(props: LambdasStackProps): IRole {
    const taskRole = Role.fromRoleArn(this, "apiTaskRoleForCDALambda", props.apiTaskRoleArn);
    const taskDef = FargateTaskDefinition.fromFargateTaskDefinitionAttributes(
      this,
      "apiTaskDefForCDALambda",
      {
        taskDefinitionArn: props.apiTaskDefArn,
        taskRole,
      }
    );
    if (!taskDef) throw new Error("API task definition not found");
    return taskDef.taskRole;
  }

  private setupTester(props: LambdasStackProps): lambda.Function {
    return createTesterLambda({
      stack: this,
      config: props.config,
      vpc: props.vpc,
      lambdaLayers: props.lambdaLayers,
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
        lambdaLayers: props.lambdaLayers,
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
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      apiServiceDnsAddress: props.apiServiceDnsAddress,
      apiGateway: props.apiGateway,
      dynamoDBTokenTable: props.dynamoDBTokenTable,
    });
  }

  private setupScheduled(props: LambdasStackProps): lambda.Function | undefined {
    return createDocQueryChecker({
      stack: this,
      lambdaLayers: props.lambdaLayers,
      apiAddress: props.apiServiceDnsAddress,
      vpc: props.vpc,
    });
  }

  private setupFHIRConverter(props: LambdasStackProps & APITaskRole): lambda.Function | undefined {
    const { fhirServerConnectorARNs, fhirConverterConnectorARNs } = props;
    const { queue: fhirServerQueue } = FHIRConnectorStack.fromARNs(this, {
      ...fhirServerConnectorARNs,
      id: "fhirServerConnectorForConverter",
    });
    const {
      queue: fhirConverterQueue,
      dlq: fhirConverterDLQ,
      bucket: fhirConverterBucket,
    } = FHIRConnectorStack.fromARNs(this, {
      ...fhirConverterConnectorARNs,
      id: "fhirConverterConnector",
    });
    return createFHIRConverterLambda({
      stack: this,
      lambdaLayers: props.lambdaLayers,
      envType: props.config.environmentType,
      vpc: props.vpc,
      sourceQueue: fhirConverterQueue,
      dlq: fhirConverterDLQ,
      createRetryLambda: fhirConverterConnectorARNs.createRetryLambda,
      fhirConverterBucket: fhirConverterBucket,
      destinationQueue: fhirServerQueue,
      apiTaskRole: props.apiTaskRole,
      apiServiceDnsAddress: props.apiServiceDnsAddress,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      alarmSnsAction: props.alarmAction,
    });
  }

  private setupSidechainFHIRConverter(
    props: LambdasStackProps & APITaskRole
  ): lambda.Function | undefined {
    const { fhirServerConnectorARNs, sidechainFHIRConverterConnectorARNs } = props;
    const { queue: fhirServerQueue } = FHIRConnectorStack.fromARNs(this, {
      ...fhirServerConnectorARNs,
      id: "fhirServerConnectorForSidechain",
    });
    const {
      queue: fhirConverterQueue,
      dlq: fhirConverterDLQ,
      bucket: fhirConverterBucket,
    } = FHIRConnectorStack.fromARNs(this, {
      ...sidechainFHIRConverterConnectorARNs,
      id: "sidechainFHIRConverterConnector",
    });
    return createSidechainFHIRConverterLambda({
      stack: this,
      lambdaLayers: props.lambdaLayers,
      envType: props.config.environmentType,
      vpc: props.vpc,
      sourceQueue: fhirConverterQueue,
      dlq: fhirConverterDLQ,
      createRetryLambda: sidechainFHIRConverterConnectorARNs.createRetryLambda,
      fhirConverterBucket: fhirConverterBucket,
      destinationQueue: fhirServerQueue,
      apiTaskRole: props.apiTaskRole,
      apiServiceDnsAddress: props.apiServiceDnsAddress,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      alarmSnsAction: props.alarmAction,
    });
  }

  private setupFHIRServerLambda(
    props: LambdasStackProps & APITaskRole
  ): lambda.Function | undefined {
    const { fhirServerConnectorARNs } = props;
    const { queue, dlq, bucket } = FHIRConnectorStack.fromARNs(this, {
      ...fhirServerConnectorARNs,
      id: "fhirServerConnector",
    });
    return createFHIRServerLambda({
      stack: this,
      lambdaLayers: props.lambdaLayers,
      envType: props.config.environmentType,
      vpc: props.vpc,
      queue,
      dlq,
      createRetryLambda: fhirServerConnectorARNs.createRetryLambda,
      fhirConverterBucket: bucket,
      alarmSnsAction: props.alarmAction,
    });
  }
}
