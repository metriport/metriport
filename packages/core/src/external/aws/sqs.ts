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
    await this.sqs.sendMessage(messageParams).promise();
  }
}
