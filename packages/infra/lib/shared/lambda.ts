import { Duration, StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Metric } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { ISubnet, IVpc } from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  Architecture,
  Code,
  Function as Lambda,
  ILayerVersion,
  Runtime,
  RuntimeManagementMode,
  SingletonFunction,
} from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import { FilterPattern } from "aws-cdk-lib/aws-logs";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { getConfig, METRICS_NAMESPACE } from "./config";

export const DEFAULT_LAMBDA_TIMEOUT = Duration.seconds(30);
export const MAXIMUM_LAMBDA_TIMEOUT = Duration.minutes(15);
const pathToLambdas = "../lambdas";

export const buildPolicy = (
  actionToAllow: string,
  instanceARN: string | string[]
): PolicyStatement =>
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [actionToAllow],
    resources: typeof instanceARN === "string" ? [instanceARN] : instanceARN,
  });

export interface LambdaProps extends StackProps {
  readonly stack: Construct;
  readonly name: string;
  /**
   * Name of the lambda file without the extension. The file must be a TS file and in the `lambdas/src` folder.
   */
  readonly entry: string;
  readonly vpc?: IVpc;
  readonly subnets?: ISubnet[];
  readonly role?: iam.Role;
  readonly envVars?: { [key: string]: string };
  readonly envType: EnvType;
  readonly timeout?: Duration;
  readonly memory?: number;
  readonly reservedConcurrentExecutions?: number;
  readonly retryAttempts?: number;
  readonly maxEventAge?: Duration;
  readonly alarmSnsAction?: SnsAction;
  readonly runtime?: Runtime;
  readonly runtimeManagementMode?: RuntimeManagementMode;
  readonly architecture?: Architecture;
  readonly layers: ILayerVersion[];
  readonly version?: string | undefined;
}

export function createLambda(props: LambdaProps): Lambda {
  const lambda = new Lambda(props.stack, props.name, {
    functionName: props.name + "Lambda",
    runtime: props.runtime ?? Runtime.NODEJS_18_X,
    runtimeManagementMode: props.runtimeManagementMode,
    // TODO move our lambdas to use layers, quicker to deploy and execute them
    code: Code.fromAsset(`${pathToLambdas}/dist`),
    handler: props.entry + ".handler",
    ...(props.layers && props.layers.length > 0 ? { layers: props.layers } : {}),
    vpc: props.vpc,
    vpcSubnets: props.subnets ? { subnets: props.subnets } : undefined,
    /**
     * Watch out if this is more than 60s while using SQS we likely need to update the
     * queue's VisibilityTimeout so the message is not processed more than once.
     * See: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
     */
    timeout: props.timeout ?? DEFAULT_LAMBDA_TIMEOUT,
    memorySize: props.memory,
    reservedConcurrentExecutions: props.reservedConcurrentExecutions,
    role: props.role ?? undefined,
    environment: {
      ...props.envVars,
      ENV_TYPE: props.envType,
      ...(props.version ? { METRIPORT_VERSION: props.version } : undefined),
    },
    retryAttempts: props.retryAttempts ?? 0,
    maxEventAge: props.maxEventAge ?? undefined,
    architecture: props.architecture ?? Architecture.X86_64,
  });

  // Allow the lambda to publish metrics to cloudwatch
  Metric.grantPutMetricData(lambda);

  // Setup alarm - general errors
  addErrorAlarmToLambdaFunc(
    props.stack,
    lambda,
    `${props.name}-GeneralLambdaAlarm`,
    props.alarmSnsAction
  );

  // Setup alarm - OOM (Out Of Memory) errors
  const metricFilter = lambda.logGroup?.addMetricFilter(`${props.name}-OOMErrorsFilter`, {
    metricNamespace: METRICS_NAMESPACE,
    metricName: `${props.name}-OOMErrors`,
    filterPattern: FilterPattern.anyTerm(
      "Runtime exited with error",
      "signal: killed Runtime.ExitError",
      "ELIFECYCLE",
      "JS heap out of memory",
      "OUT_OF_MEMORY"
    ),
    metricValue: "1",
  });
  const metric = metricFilter?.metric();
  if (metric) {
    const alarm = metric.createAlarm(props.stack, `${props.name}-OOMLambdaAlarm`, {
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Alarm if we get an OOM error from the Lambda function",
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    props.alarmSnsAction && alarm.addAlarmAction(props.alarmSnsAction);
  }

  return lambda;
}

export interface RetryLambdaProps extends Omit<LambdaProps, "entry"> {
  entry?: string;
  sourceQueue: IQueue;
  destinationQueue: IQueue;
}

/**
 * Creates a lambda to retry messages from a dead letter queue.
 *
 * @param props.entry The source code entry point, defaults to the Reenque's file name.
 */
export function createRetryLambda(props: RetryLambdaProps): Lambda {
  const config = getConfig();
  const retryLambdaName = props.name + "_Retry_";
  const retryLambda = createLambda({
    ...props,
    name: retryLambdaName,
    entry: "sqs-to-sqs",
    layers: props.layers,
    envVars: {
      ...props.envVars,
      ENV_TYPE: config.environmentType,
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      SOURCE_QUEUE: props.sourceQueue.queueUrl,
      DESTINATION_QUEUE: props.destinationQueue.queueUrl,
    },
  });
  props.sourceQueue.grantConsumeMessages(retryLambda);
  props.destinationQueue.grantSendMessages(retryLambda);
  return retryLambda;
}

export function addErrorAlarmToLambdaFunc(
  construct: Construct,
  lambdaFunc: SingletonFunction | lambda_node.NodejsFunction,
  alarmName: string,
  alarmAction?: SnsAction
) {
  const errMetric = lambdaFunc.metricErrors({
    period: Duration.minutes(1),
  });
  // 👇 create an Alarm directly on the Metric
  const alarm = errMetric.createAlarm(construct, alarmName, {
    threshold: 1,
    evaluationPeriods: 1,
    alarmDescription:
      "Alarm if the SUM of Lambda invocations is greater than or equal to the  threshold (1) for 1 evaluation period",
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
  alarmAction && alarm.addAlarmAction(alarmAction);
}

export function getLambdaUrl({ arn, region }: { arn: string; region: string }) {
  return `https://lambda.${region}.amazonaws.com/2015-03-31/functions/${arn}/invocations`;
}
