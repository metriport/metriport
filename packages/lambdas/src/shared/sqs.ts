import { SQSMessageAttributes } from "aws-lambda";
import * as AWS from "aws-sdk";
import { SQS } from "aws-sdk";
import { MessageBodyAttributeMap } from "aws-sdk/clients/sqs";

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

/**
 * Normalizes a string to be used as a message group ID in SQS.
 *
 * From AWS:
 * MessageDeduplicationId can only include alphanumeric and punctuation characters. 1 to 128 in length.
 */
export function toMessageGroupId(
  value: string,
  order: "left-to-right" | "right-to-left" = "left-to-right",
  maxChars = 128
): string {
  const replaced = value.replace(/[^a-zA-Z0-9.]/g, "");
  if (order === "left-to-right") {
    return replaced.slice(0, maxChars);
  }
  return replaced.slice(-maxChars);
}
