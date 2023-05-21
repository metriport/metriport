import { SQS } from "aws-sdk";
import { Config } from "../../shared/config";

const sqsConfig = {
  awsRegion: Config.getAWSRegion(),
};
export const sqs = new SQS({
  apiVersion: "2012-11-05",
  region: sqsConfig.awsRegion,
});

export type SQSMessageAttributes = {
  cxId?: {
    DataType: "String";
    StringValue: string;
  };
};

export async function sendMessageToQueue(
  queueUrl: string,
  messageBody: object,
  sqsParams: {
    messageGroupId: string;
    messageDeduplicationId: string;
    messageAttributes?: SQSMessageAttributes;
    delaySeconds?: number;
  }
): Promise<void> {
  const { messageGroupId, messageAttributes, messageDeduplicationId, delaySeconds } = sqsParams;
  const messageParams: SQS.Types.SendMessageRequest = {
    MessageBody: JSON.stringify(messageBody),
    QueueUrl: queueUrl,
    DelaySeconds: delaySeconds,
    MessageDeduplicationId: messageDeduplicationId,
    MessageGroupId: messageGroupId,
    MessageAttributes: messageAttributes,
  };
  messageParams.MessageDeduplicationId = messageDeduplicationId
    ? messageDeduplicationId
    : undefined;
  messageParams.MessageGroupId = messageGroupId ? messageGroupId : undefined;
  await sqs.sendMessage(messageParams).promise();
}
