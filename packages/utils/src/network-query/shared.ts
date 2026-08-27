import { Config } from "@metriport/core/util/config";

export const validSources = ["surescripts", "quest"] as const;
export type Source = (typeof validSources)[number];

export function isValidSource(source: string): source is Source {
  return validSources.includes(source as Source);
}

/**
 * Builds a CloudWatch Logs URL for a Lambda function's log group.
 */
function buildCloudWatchLogsUrl(lambdaName: string): string {
  const region = Config.getAWSRegion();
  const logGroup = `/aws/lambda/${lambdaName}`;
  const encodedLogGroup = encodeURIComponent(logGroup);
  return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodedLogGroup}/log-events`;
}

/**
 * Logs the Lambda name and a clickable CloudWatch Logs URL (only in cloud mode).
 */
export function logLambdaInfo(lambdaName: string): void {
  console.log(`Lambda: ${lambdaName}`);
  console.log(`CloudWatch Logs: ${buildCloudWatchLogsUrl(lambdaName)}\n`);
}

/**
 * Logs the AWS region.
 */
export function logAwsRegion(): void {
  const region = Config.getAWSRegion();
  console.log(`AWS Region: ${region}`);
}

/**
 * Logs the execution mode based on ENV_TYPE.
 */
export function logExecutionMode(action: string, source: Source): void {
  const envType = Config.getEnvType();
  const mode = Config.isDev() ? "LOCAL (direct processing)" : "CLOUD (invoke Lambda)";
  console.log(`${action} ${source}...`);
  console.log(`Mode: ${mode}`);
  console.log(`ENV_TYPE: ${envType}`);
}
