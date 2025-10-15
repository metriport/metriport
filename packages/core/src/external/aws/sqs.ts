import { MetriportError } from "@metriport/shared";
import { SQS } from "aws-sdk";
import { MessageBodyAttributeMap } from "aws-sdk/clients/sqs";

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

export type SQSBatchMessage = {
  id: string;
  body: string;
} & SQSParameters;

export class SQSClient {
  private _sqs: SQS;

  constructor(readonly config: { region: string }) {
    this._sqs = this.makeSQSClient(config.region);
  }

  public get sqs() {
    return this._sqs;
  }

  private makeSQSClient(region: string) {
    return new SQS({
      apiVersion: "2012-11-05",
      region,
    });
  }

  async sendMessageToQueue(
    queueUrl: string,
    messageBody: string,
    sqsParams: SQSParameters = {}
  ): Promise<void> {
    const messageParams: SQS.Types.SendMessageRequest = {
      ...buildSQSMessage({
        ...sqsParams,
        body: messageBody,
      }),
      QueueUrl: queueUrl,
    };
    await this.sqs.sendMessage(messageParams).promise();
  }

  async sendBatchMessagesToQueue(queueUrl: string, messages: SQSBatchMessage[]): Promise<void> {
    if (messages.length < 1) return;
    if (messages.length > 10) {
      throw new MetriportError("SQS batch sendMessage limit is 10 messages per call", undefined, {
        messageCount: messages.length,
      });
    }

    const entries = messages.map(message => {
      const entry: SQS.SendMessageBatchRequestEntry = {
        Id: message.id,
        ...buildSQSMessage(message),
      };
      return entry;
    });

    const batchParams: SQS.Types.SendMessageBatchRequest = {
      QueueUrl: queueUrl,
      Entries: entries,
    };

    await this.sqs.sendMessageBatch(batchParams).promise();
  }
}

function buildSQSMessage(
  message: Omit<SQSBatchMessage, "id">
): Omit<SQS.Types.SendMessageRequest, "QueueUrl"> {
  const {
    messageGroupId,
    body,
    messageAttributes,
    messageAttributesRaw,
    messageDeduplicationId,
    delaySeconds,
  } = message;
  return {
    MessageBody: body,
    ...(delaySeconds ? { DelaySeconds: delaySeconds } : {}),
    ...(messageDeduplicationId ? { MessageDeduplicationId: messageDeduplicationId } : {}),
    ...(messageGroupId ? { MessageGroupId: messageGroupId } : {}),
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
}
