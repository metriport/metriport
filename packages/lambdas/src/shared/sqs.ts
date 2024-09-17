import { SQSMessageAttributes } from "aws-lambda";
import * as AWS from "aws-sdk";
import { SQS } from "aws-sdk";
import { MessageBodyAttributeMap } from "aws-sdk/clients/sqs";
import { SQSRecord } from "aws-lambda";
import { ChangeMessageVisibilityCommand, SQSClient } from "@aws-sdk/client-sqs";

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

  static attributesToSend(inboundMessageAttribs: SQSMessageAttributes): MessageBodyAttributeMap {
    let res = {};
    for (const [key, value] of Object.entries(inboundMessageAttribs)) {
      res = {
        ...res,
        ...SQSUtils.singleAttributeToSend(key, value.stringValue),
      };
    }
    return res;
  }

  static singleAttributeToSend(key: string, value: string | undefined): MessageBodyAttributeMap {
    return {
      [key]: {
        DataType: "String",
        StringValue: value,
      },
    };
  }
}

export async function changeMessageVisibility(
  record: SQSRecord,
  sqsClient: SQSClient,
  timeout: number
) {
  const command = new ChangeMessageVisibilityCommand({
    QueueUrl: record.eventSourceARN,
    ReceiptHandle: record.receiptHandle,
    VisibilityTimeout: timeout,
  });

  try {
    await sqsClient.send(command);
  } catch (error) {
    console.error("Error changing message visibility:", error);
  }
}
