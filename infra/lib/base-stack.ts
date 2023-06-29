import { Stack, StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Code, ILayerVersion, LayerVersion } from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { AlarmSlackBot } from "./creators/alarm-slack-chatbot";
import { EnvConfig } from "./env-config";

interface BaseStackProps extends StackProps {
  config: EnvConfig;
}

export class BaseStack extends Stack {
  private readonly _alarmAction: SnsAction | undefined;
  private readonly _lambdaLayers: ILayerVersion[];

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, {
      ...props,
      stackName: id,
    });
    this._alarmAction = this.setupSlackNotifSnsTopic(this, props.config);
    this._lambdaLayers = this.setupLambdasLayers();
  }

  get alarmAction(): SnsAction | undefined {
    return this._alarmAction;
  }
  get lambdaLayers(): ILayerVersion[] {
    return this._lambdaLayers;
  }

  setupSlackNotifSnsTopic(stack: Stack, config: EnvConfig): SnsAction | undefined {
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
    return new SnsAction(slackNotifSnsTopic);
  }

  private setupLambdasLayers(): ILayerVersion[] {
    return [
      new LayerVersion(this, "lambdaNodeModules", {
        code: Code.fromAsset("../api/lambdas/layers/shared/shared-layer.zip"),
      }),
    ];
  }
}
