import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { createLambda, LambdaProps } from "./lambda";

export type ScheduledLambdaProps = Omit<LambdaProps, "entry"> & {
  scheduleExpression: string | string[];
} & (
    | {
        entry: string;
      }
    | {
        entry?: never;
        url: string;
      }
  );

/**
 * Creates a lambda that is triggered by a schedule.
 *
 * @param props.scheduleExpression: "Minutes Hours Day-of-month Month Day-of-week Year", see more
 *    here: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
 * @param props.url The url to call when the lambda is triggered -
 */
export function createScheduledLambda(props: ScheduledLambdaProps): Lambda {
  const lambdaFn = createLambda({
    ...props,
    ...(props.entry != null
      ? {
          entry: props.entry,
        }
      : {
          entry: `scheduled`,
          envVars: {
            ...props.envVars,
            ...(props.url ? { URL: props.url } : {}),
          },
        }),
  });

  const schedules =
    typeof props.scheduleExpression === "string"
      ? [props.scheduleExpression]
      : props.scheduleExpression;

  schedules.forEach((schedule, i) => {
    new Rule(props.stack, `${props.name}Rule_${i}`, {
      schedule: Schedule.expression("cron(" + schedule + ")"),
      targets: [new LambdaFunction(lambdaFn)],
    });
  });

  return lambdaFn;
}
