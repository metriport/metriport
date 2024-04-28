import { CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StateMachine, Chain } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvocationType, LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Duration } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { EnvConfig } from "../config/env-config";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";

// express workflows
interface JonahTestStackProps extends NestedStackProps {
  config: EnvConfig;
  lambdaLayers: LambdaLayers;
  vpc: ec2.IVpc;
  version: string | undefined;
}

export class JonahTestStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: JonahTestStackProps) {
    super(scope, id, props);

    if (!props?.lambdaLayers) {
      throw new Error("Lambda layers are required");
    }

    // QUEUE
    const queue = new sqs.Queue(this, "JonahTestQueue", {
      visibilityTimeout: Duration.seconds(60),
    });

    // DYNAMOD
    const requestTable = new dynamodb.Table(this, "RequestTable", {
      partitionKey: { name: "requestId", type: dynamodb.AttributeType.STRING },
    });
    console.log("Request Table Name: ", requestTable.tableName);

    // Message Processor Lambda Function
    const processQueueMessageLambda = createLambda({
      stack: this,
      name: "ProcessQueueMessage",
      entry: "jonah-test-lambda-2",
      layers: [props?.lambdaLayers.shared],
      envType: props?.config.environmentType,
      envVars: {
        REQUEST_TABLE_NAME: requestTable.tableName,
      },
      memory: 1024,
      vpc: props?.vpc,
    });
    processQueueMessageLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [requestTable.tableArn],
      })
    );

    // State Machine
    const lambdaInvokeTask = new LambdaInvoke(this, "InvokeLambdaTask", {
      lambdaFunction: processQueueMessageLambda,
      invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      outputPath: "$.Payload",
    });

    const definition = Chain.start(lambdaInvokeTask);

    const stateMachine = new StateMachine(this, "QueueProcessingStateMachine", {
      definition,
      timeout: Duration.hours(1),
    });
    console.log("State Machine ARN: ", stateMachine.stateMachineArn);

    // Lambda to trigger the state machine via the queue
    const triggerStateMachineLambda = createLambda({
      stack: this,
      name: "TriggerStateMachine",
      entry: "jonah-test-lambda-1",
      envType: props.config.environmentType,
      envVars: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
      layers: [props.lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(1),
      vpc: props.vpc,
    });
    triggerStateMachineLambda.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 1,
      })
    );
    stateMachine.grantStartExecution(triggerStateMachineLambda);

    new CfnOutput(this, "QueueURL", {
      value: queue.queueUrl,
    });

    new CfnOutput(this, "RequestTableName", {
      value: requestTable.tableName,
    });
  }
}
