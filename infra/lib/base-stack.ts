import { Stack, StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { AlarmSlackBot } from "./creators/alarm-slack-chatbot";
import { EnvConfig } from "./env-config";

interface BaseStackProps extends StackProps {
  config: EnvConfig;
}

export class BaseStack extends Stack {
  private _alarmAction: SnsAction | undefined;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, {
      ...props,
      stackName: id,
    });

    this.setupSlackNotifSnsTopic(this, props.config);
  }

  get alarmAction() {
    return this._alarmAction;
  }

  setupSlackNotifSnsTopic(stack: Stack, config: EnvConfig): void {
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
    this._alarmAction = new SnsAction(slackNotifSnsTopic);
  }
}
