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
import { setupLambdasLayers } from "./shared/lambda-layers";
import { EnvConfig } from "../config/env-config";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";

// express workflows
interface JonahTestStackProps extends NestedStackProps {
  config: EnvConfig;
  version: string | undefined;
}

export class JonahTestStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: JonahTestStackProps) {
    super(scope, id, props);

    const vpcId = props?.config.iheGateway?.vpcId;
    if (!vpcId) throw new Error("Missing VPC ID for IHE stack");
    const vpc = ec2.Vpc.fromLookup(this, "APIVpc", { vpcId });

    const lambdaLayers = setupLambdasLayers(this, true);

    // QUEUE
    const queue = new sqs.Queue(this, "JonahTestQueue");

    // DYNAMODB
    const requestTable = new dynamodb.Table(this, "RequestTable", {
      partitionKey: { name: "requestId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Use on-demand billing mode
    });

    // Message Processor Lambda Function
    const processQueueMessageLambda = createLambda({
      stack: this,
      name: "ProcessQueueMessage",
      entry: "jonah-test-lambda-2",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      memory: 1024,
      vpc,
    });
    processQueueMessageLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [requestTable.tableArn],
      })
    );
    processQueueMessageLambda.addEnvironment("REQUEST_TABLE_NAME", requestTable.tableName);

    // State Machine
    const lambdaInvokeTask = new LambdaInvoke(this, "InvokeLambdaTask", {
      lambdaFunction: processQueueMessageLambda,
      invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      outputPath: "$.Payload",
    });

    const definition = Chain.start(lambdaInvokeTask);

    const stateMachine = new StateMachine(this, "QueueProcessingStateMachine", {
      definition,
      timeout: Duration.hours(1), // Adjust based on expected execution time
    });

    // Lambda to trigger the state machine via the queue
    const triggerStateMachineLambda = createLambda({
      stack: this,
      name: "JonahTestLambda",
      entry: "jonah-test-lambda-1",
      envType: props.config.environmentType,
      envVars: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(1),
      vpc,
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
