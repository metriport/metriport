import { SQSMessageAttributes, SQSRecord } from "aws-lambda";
import * as AWS from "aws-sdk";
import { SQS } from "aws-sdk";
import { MessageBodyAttributeMap, SendMessageRequest } from "aws-sdk/clients/sqs";
import { capture } from "./capture";

export class SQSUtils {
  public readonly _sqs: SQS;
  constructor(
    readonly region: string,
    readonly sourceQueueURL: string,
    readonly dlqURL?: string,
    readonly delayWhenRetryingSeconds?: number
  ) {
    this._sqs = new AWS.SQS({ region });
  }

  get sqs(): SQS {
    return this._sqs;
  }

  getRetryCount(message: SQSRecord): number {
    return parseInt(message.messageAttributes?.retryCount?.stringValue ?? "0");
  }

  async sendToDLQ(message: SQSRecord) {
    if (!this.dlqURL) throw new Error(`Missing dlqURL`);
    await this.dequeue(message);
    const sendParams: AWS.SQS.SendMessageRequest = {
      MessageBody: message.body,
      QueueUrl: this.dlqURL,
      // DelaySeconds: delaySeconds, // Missing, consider adding it when updating/using this
      MessageGroupId: message.attributes.MessageGroupId,
      MessageDeduplicationId: message.attributes.MessageDeduplicationId,
      MessageAttributes: this.attributesToSend(message.messageAttributes),
    };
    try {
      console.log(`Sending message to DLQ: ${JSON.stringify(sendParams)}`);
      await this.sqs.sendMessage(sendParams).promise();
    } catch (err) {
      console.log(`Failed to send message to queue: `, message, err);
      capture.error(err, {
        extra: { message, sendParams, context: "sendToDLQ" },
      });
    }
  }

  async reEnqueue(message: SQSRecord) {
    const retryCount = this.getRetryCount(message);
    const messageAttributes = {
      ...message.messageAttributes,
      retryCount: {
        stringValue: (retryCount + 1).toString(),
        dataType: "String",
      },
    };
    await this.dequeue(message);
    const sendParams: SendMessageRequest = {
      MessageBody: message.body,
      QueueUrl: this.sourceQueueURL,
      DelaySeconds: this.delayWhenRetryingSeconds, // wait at least that long before retrying
      MessageGroupId: message.attributes.MessageGroupId,
      MessageDeduplicationId: message.attributes.MessageDeduplicationId,
      MessageAttributes: this.attributesToSend(messageAttributes),
    };
    try {
      await this.sqs.sendMessage(sendParams).promise();
    } catch (err) {
      console.log(`Failed to re-enqueue message: `, message, err);
      capture.error(err, {
        extra: { message, sendParams, context: "reEnqueue" },
      });
    }
  }

  async dequeue(message: SQSRecord) {
    const deleteParams = {
      QueueUrl: this.sourceQueueURL,
      ReceiptHandle: message.receiptHandle,
    };
    try {
      await this.sqs.deleteMessage(deleteParams).promise();
    } catch (err) {
      console.log(`Failed to remove message from queue: `, message, err);
      capture.error(err, {
        extra: { message, deleteParams, context: "dequeue" },
      });
    }
  }

  attributesToSend(inboundMessageAttribs: SQSMessageAttributes): MessageBodyAttributeMap {
    let res = {};
    for (const [key, value] of Object.entries(inboundMessageAttribs)) {
      res = {
        ...res,
        ...this.singleAttributeToSend(key, value.stringValue),
      };
    }
    return res;
  }

  singleAttributeToSend(key: string, value: string | undefined): MessageBodyAttributeMap {
    return {
      [key]: {
        DataType: "String",
        StringValue: value,
      },
    };
  }
}
