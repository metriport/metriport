import { Fn, Stack } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { AlarmSlackBot } from "../api-stack/alarm-slack-chatbot";
import { EnvConfig } from "../../config/env-config";
import { isSandbox } from "./util";

export type CreateAlarmProps = {
  scope: Construct;
  metric: Metric;
  name: string;
  description: string;
  threshold: number;
  comparisonOperator: ComparisonOperator;
  evaluationPeriods?: number;
  treatMissingData?: TreatMissingData;
  includeOkAction?: boolean;
  alarmSnsAction: SnsAction;
};

/**
 * Adds an alarm to the scope with Slack and PagerDuty notifications.
 *
 * See the difference between alarms and alerts in notion. https://www.notion.so/metriport/On-Call-Shift-Runbook-186b51bb9040804a908dee54c60a2891?source=copy_link#2e6b51bb904080d8a8e9dc85754077cb
 * Alarms are used to send notifications to Slack and PagerDuty in the alarms channel.
 * Alerts are used to send notifications to Slack in the alerts channel.
 *
 * @param scope - The scope of the alarm.
 * @param metric - The metric to create the alarm on.
 * @param name - The name of the alarm.
 * @param description - The description of the alarm.
 * @param threshold - The threshold for the alarm.
 * @param comparisonOperator - The comparison operator for the alarm.
 * @param evaluationPeriods - The evaluation periods for the alarm.
 * @param treatMissingData - The treat missing data for the alarm.
 * @param includeOkAction - Whether to include the OK action for the alarm.
 * @param alarmSnsAction - The SNS action for the alarm (notifies Slack and PagerDuty).
 */
export function addAlarmToMetric({
  scope,
  metric,
  name,
  description,
  threshold,
  comparisonOperator,
  evaluationPeriods = 1,
  treatMissingData = TreatMissingData.NOT_BREACHING,
  includeOkAction = true,
  alarmSnsAction,
}: CreateAlarmProps): Alarm {
  const alarm = new Alarm(scope, name, {
    alarmName: name,
    alarmDescription: description,
    metric,
    threshold,
    comparisonOperator,
    evaluationPeriods,
    treatMissingData,
  });

  alarm.addAlarmAction(alarmSnsAction);
  if (includeOkAction) {
    alarm.addOkAction(alarmSnsAction);
  }

  return alarm;
}

/**
 * Sets up the alarm SNS action (Slack + PagerDuty) once in the stack.
 * Both Slack and PagerDuty subscribe to the same SNS topic.
 * Call this once in the main stack and pass the returned action to addAlarmToMetric.
 *
 * Note: The SlackChannelConfiguration is only created in prod and staging because AWS only allows
 * one chatbot configuration per Slack channel per account. Since prod and sandbox share
 * the same #engineering-alarms channel, we create it in prod and sandbox uses PagerDuty only.
 */
export function setupAlarmSnsAction({
  stack,
  config,
}: {
  stack: Stack;
  config: EnvConfig;
}): SnsAction {
  const alarmSnsTopic = new sns.Topic(stack, "AlarmSnsTopic", {
    displayName: "Alarm SNS Topic",
  });

  if (!isSandbox(config)) {
    AlarmSlackBot.addSlackChannelConfig(stack, {
      configName: `alarm-slack-chatbot-configuration-` + config.environmentType,
      workspaceId: config.alarms.slackWorkspaceId,
      channelId: config.alarms.slackChannelId,
      topics: [alarmSnsTopic],
      id: "AlarmSlackChatbotConfig",
    });
  }

  const pagerdutySecretName = config.alarms.secrets.pagerdutyUrl;

  /*
   * Fn.sub should not be used for secrets in most cases.
   * This case it's fine because (1) if the PD URL get's compromised it doesn't allow for anything other than generating noise/trash for us
   * It wouldn't be ok if this was a DB password or something that provides access to sensitive information,
   * and (2), this is being stored on a SNS subscription endpoint that only people with access to our AWS console can read
   * The alternative would be a proxy lambda, too much effort considering (1).
   */
  const pagerdutyIntegrationUrl = Fn.sub(`{{resolve:secretsmanager:${pagerdutySecretName}}}`);
  new sns.Subscription(stack, "AlarmPagerDutySubscription", {
    topic: alarmSnsTopic,
    protocol: sns.SubscriptionProtocol.HTTPS,
    endpoint: pagerdutyIntegrationUrl,
  });

  return new SnsAction(alarmSnsTopic);
}
