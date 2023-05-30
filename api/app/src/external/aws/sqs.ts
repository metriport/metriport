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
export type SQSParameters =
  | {
      fifo?: never | false;
      messageGroupId?: never;
      messageDeduplicationId?: never;
      messageAttributes?: SQSMessageAttributes;
      messageAttributesRaw?: SQS.MessageBodyAttributeMap;
      delaySeconds?: number;
    }
  | {
      fifo: true;
      messageGroupId: string;
      messageDeduplicationId: string;
      messageAttributes?: SQSMessageAttributes;
      messageAttributesRaw?: SQS.MessageBodyAttributeMap;
      delaySeconds?: number;
    };

export async function sendMessageToQueue(
  queueUrl: string,
  messageBody: string,
  sqsParams: SQSParameters
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
  await sqs.sendMessage(messageParams).promise();
}
