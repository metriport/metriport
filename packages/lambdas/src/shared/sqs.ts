import { MetriportError } from "@metriport/shared";
import { SQSMessageAttributes, SQSRecord } from "aws-lambda";
import * as AWS from "aws-sdk";
import { SQS } from "aws-sdk";
import { MessageBodyAttributeMap } from "aws-sdk/clients/sqs";
import { z } from "zod";
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

export function getSingleMessageOrFail(
  records: SQSRecord[],
  lambdaName: string
): SQSRecord | undefined {
  if (!records || records.length < 1) {
    console.log(`No records, discarding this event: ${JSON.stringify(records)}`);
    return undefined;
  }
  if (records.length > 1) {
    const msg = "Got more than one message from SQS";
    capture.error(msg, {
      extra: {
        context: lambdaName,
        additional: `This lambda is supposed to run w/ only 1 message per batch, got ${records.length}`,
      },
    });
    throw new MetriportError(msg, undefined, { amountOfRecords: records.length });
  }
  // Safe as we just checked the length
  const message = records[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  return message;
}

export function parseBody<T>(schema: z.Schema<T>, body?: unknown): T {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return schema.parse(bodyAsJson);
}
