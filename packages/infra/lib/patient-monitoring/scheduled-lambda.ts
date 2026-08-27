import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type ScheduledLambdaProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  alertSnsAction?: SnsAction;
  vpc: IVpc;
  apiAddress: string;
};

const lambdaTimeout = Duration.seconds(60);
const httpTimeout = Duration.seconds(50);

export function createPatientMonitoringScheduledQueriesScheduler(
  props: ScheduledLambdaProps
): Lambda {
  const config = getConfig();
  const { stack, lambdaLayers, vpc, apiAddress, alertSnsAction } = props;

  /**
   * Scheduled lambda that triggers the orchestrator endpoint weekly.
   * UTC-based cron: "Minutes Hours Day-of-month Month Day-of-week Year"
   * Saturday 12am PST (winter) = Saturday 8am UTC
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
   */
  const scheduleExpression = ["0 8 ? * SAT *"];

  const lambda = createScheduledLambda({
    stack,
    name: "PatientMonitoringScheduledQueriesScheduler",
    scheduleExpression,
    url: `http://${apiAddress}/internal/patient-monitoring/scheduled-queries`,
    envType: config.environmentType,
    envVars: {
      TIMEOUT_MILLIS: String(httpTimeout.toMilliseconds()),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
    timeout: lambdaTimeout,
    layers: [lambdaLayers.shared],
    memory: 256,
    vpc,
    alertSnsAction,
  });

  return lambda;
}
