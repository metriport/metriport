import { LoggingLevel, SlackChannelConfiguration } from "aws-cdk-lib/aws-chatbot";
import {
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

type SlackBotProps = {
  readonly configName: string;
  readonly workspaceId: string;
  readonly channelId: string;
  readonly topics: ReadonlyArray<ITopic>;
};

export class AlarmSlackBot {
  public static addSlackChannelConfig(
    scope: Construct,
    props: SlackBotProps
  ): SlackChannelConfiguration {
    const { configName, channelId, workspaceId, topics } = props;

    const role = new Role(scope, "SlackBotRole", {
      assumedBy: new ServicePrincipal("chatbot.amazonaws.com"),
      description: "Role for AWS ChatBot",
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")],
      inlinePolicies: {
        CloudWatchPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: ["*"],
              actions: ["cloudwatch:Describe*", "cloudwatch:Get*", "cloudwatch:List*"],
            }),
          ],
        }),
      },
    });

    return new SlackChannelConfiguration(scope, "SlackChannelConfiguration", {
      slackChannelConfigurationName: configName,
      slackWorkspaceId: workspaceId,
      slackChannelId: channelId,
      notificationTopics: [...topics],
      role,
      loggingLevel: LoggingLevel.INFO,
      logRetention: RetentionDays.ONE_YEAR,
    });
  }
}
