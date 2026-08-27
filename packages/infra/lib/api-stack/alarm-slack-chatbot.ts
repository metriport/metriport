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

const DEFAULT_CONSTRUCT_ID = "SlackChannelConfiguration";
const DEFAULT_ROLE_PREFIX = "SlackBot";

type SlackBotProps = {
  readonly configName: string;
  readonly workspaceId: string;
  readonly channelId: string;
  readonly topics: ReadonlyArray<ITopic>;
  readonly id?: string;
};

export class AlarmSlackBot {
  public static addSlackChannelConfig(
    scope: Construct,
    props: SlackBotProps
  ): SlackChannelConfiguration {
    const { configName, channelId, workspaceId, topics, id } = props;
    const constructId = id ?? DEFAULT_CONSTRUCT_ID;
    const roleId = `${id ?? DEFAULT_ROLE_PREFIX}Role`;

    const role = new Role(scope, roleId, {
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

    return new SlackChannelConfiguration(scope, constructId, {
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
