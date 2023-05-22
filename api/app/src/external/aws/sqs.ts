import { SQS } from "aws-sdk";
import { MessageBodyAttributeMap } from "aws-sdk/clients/sqs";
import { Config } from "../../shared/config";

const sqsConfig = {
  awsRegion: Config.getAWSRegion(),
};
export const sqs = new SQS({
  apiVersion: "2012-11-05",
  region: sqsConfig.awsRegion,
});

export type SQSMessageAttributes = Record<string, string> & {
  cxId?: string;
};

export async function sendMessageToQueue(
  queueUrl: string,
  messageBody: string,
  sqsParams: {
    messageGroupId: string;
    messageDeduplicationId: string;
    messageAttributes?: SQSMessageAttributes;
    messageAttributesRaw?: SQS.MessageBodyAttributeMap;
    delaySeconds?: number;
  }
): Promise<void> {
  const {
    messageGroupId,
    messageAttributes,
    messageAttributesRaw,
    messageDeduplicationId,
    delaySeconds,
  } = sqsParams;
  const messageParams: SQS.Types.SendMessageRequest = {
    MessageBody: messageBody,
    QueueUrl: queueUrl,
    DelaySeconds: delaySeconds,
    MessageDeduplicationId: messageDeduplicationId,
    MessageGroupId: messageGroupId,
    MessageAttributes: {
      ...(messageAttributes
        ? Object.entries(messageAttributes).reduce((acc, [key, value]) => {
            acc[key] = {
              DataType: "String",
              StringValue: value,
            };
            return acc;
          }, {} as MessageBodyAttributeMap)
        : {}),
      ...(messageAttributesRaw ? messageAttributesRaw : {}),
    },
  };
  messageParams.MessageDeduplicationId = messageDeduplicationId
    ? messageDeduplicationId
    : undefined;
  messageParams.MessageGroupId = messageGroupId ? messageGroupId : undefined;
  await sqs.sendMessage(messageParams).promise();
}
