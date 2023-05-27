import { Duration, StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Metric } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { ISubnet, IVpc } from "aws-cdk-lib/aws-ec2";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import { FilterPattern } from "aws-cdk-lib/aws-logs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { getConfig, METRICS_NAMESPACE } from "./config";
import { addErrorAlarmToLambdaFunc } from "./util";

export const DEFAULT_LAMBDA_TIMEOUT_SECONDS = 10;
const pathToLambdas = "../api/lambdas";

export const buildEventRule = (scope: Construct, id: string, scheduleExpression: string): Rule =>
  new Rule(scope, id, {
    schedule: Schedule.expression("cron(" + scheduleExpression + ")"),
  });

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
  readonly entry: string;
  readonly vpc: IVpc;
  readonly subnets?: ISubnet[];
  readonly role?: iam.Role;
  readonly envVars?: { [key: string]: string };
  readonly timeout?: Duration;
  readonly memory?: number;
  readonly reservedConcurrentExecutions?: number;
  readonly retryAttempts?: number;
  readonly maxEventAge?: Duration;
  readonly alarmSnsAction?: SnsAction;
}

export function createLambda(props: LambdaProps): Lambda {
  const lambda = new lambda_node.NodejsFunction(props.stack, props.name, {
    functionName: props.name + "Lambda",
    runtime: Runtime.NODEJS_16_X,
    // TODO move our lambdas to use layers, quicker to deploy and execute them
    entry: props.entry,
    // code: Code.fromAsset('lambda'),
    // handler: (fileName ?? name) + '.handler',
    // layers: props.dependencies,
    vpc: props.vpc,
    vpcSubnets: props.subnets ? { subnets: props.subnets } : undefined,
    /**
     * Watch out if this is more than 60s while using SQS we likely need to update the
     * queue's VisibilityTimeout so the message is not processed more than once.
     * See: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
     */
    timeout: props.timeout ?? Duration.seconds(DEFAULT_LAMBDA_TIMEOUT_SECONDS), // max 900
    memorySize: props.memory,
    reservedConcurrentExecutions: props.reservedConcurrentExecutions,
    role: props.role ?? undefined,
    environment: props.envVars,
    retryAttempts: props.retryAttempts ?? 0,
    maxEventAge: props.maxEventAge ?? undefined,
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
      "signal: killed Runtime.ExitError"
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
  sourceQueue: Queue;
  destinationQueue: Queue;
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
    entry: props.entry ?? `${pathToLambdas}/sqs-to-sqs/index.js`,
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

// TODO validate this works
// export type ScheduledLambdaProps = Omit<LambdaProps, "entry"> & {
//   scheduleExpression: string | string[];
// } & (
//     | {
//         entry: string;
//       }
//     | {
//         entry?: never;
//         url: string;
//       }
//   );

// /**
//  * Creates a lambda that is triggered by a schedule.
//  *
//  * @param props.scheduleExpression: "Minutes Hours Day-of-month Month Day-of-week Year", see more
//  *    here: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
//  * @param props.url The url to call when the lambda is triggered -
//  */
// export function createScheduledLambda(props: ScheduledLambdaProps): Lambda {
//   const lambdaFn = createLambda({
//     ...props,
//     ...(props.entry != null
//       ? {
//           entry: props.entry,
//         }
//       : {
//           entry: `${pathToLambdas}/scheduled/index.js`,
//           envVars: {
//             ...props.envVars,
//             ...(props.url ? { URL: props.url } : {}),
//           },
//         }),
//   });

//   if (typeof props.scheduleExpression === "string") {
//     const eventRule: Rule = buildEventRule(
//       props.stack,
//       `${props.name}Rule`,
//       props.scheduleExpression
//     );
//     eventRule.addTarget(new LambdaFunction(lambdaFn));
//   } else {
//     props.scheduleExpression.forEach((schedule, i) => {
//       const eventRule: Rule = buildEventRule(props.stack, `${props.name}Rule_${i}`, schedule);
//       eventRule.addTarget(new LambdaFunction(lambdaFn));
//     });
//   }

//   return lambdaFn;
// };
