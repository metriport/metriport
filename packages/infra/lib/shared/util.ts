import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { Stack } from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { AlarmSlackBot } from "../api-stack/alarm-slack-chatbot";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";

export function isStaging(config: EnvConfig): boolean {
  return config.environmentType === EnvType.staging;
}
export function isProd(config: EnvConfig): boolean {
  return config.environmentType === EnvType.production;
}
export function isSandbox(config: EnvConfig): boolean {
  return config.environmentType === EnvType.sandbox;
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

export function getEnvVar(varName: string): string | undefined {
  return process.env[varName];
}
export function getEnvVarOrFail(varName: string): string {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
}

export function setupSlackNotifSnsTopic(
  stack: Stack,
  config: EnvConfig
): { snsTopic: ITopic; alarmAction: SnsAction } | undefined {
  if (!config.slack) return undefined;

  const slackNotifSnsTopic = new sns.Topic(stack, "SlackSnsTopic", {
    displayName: "Slack SNS Topic",
  });
  AlarmSlackBot.addSlackChannelConfig(stack, {
    configName: `slack-chatbot-configuration-` + config.environmentType,
    workspaceId: config.slack.workspaceId,
    channelId: config.slack.alertsChannelId,
    topics: [slackNotifSnsTopic],
  });
  const alarmAction = new SnsAction(slackNotifSnsTopic);
  return { snsTopic: slackNotifSnsTopic, alarmAction };
}
