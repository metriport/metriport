import { AWSError, SQS } from "aws-sdk";
import { MessageBodyAttributeMap } from "aws-sdk/clients/sqs";
import { PromiseResult } from "aws-sdk/lib/request";
import { Config } from "../../shared/config";
import { Util } from "../../shared/util";

const sleepTimeBetweenCountsInMs = 1_000;

const sqsConfig = {
  awsRegion: Config.getAWSRegion(),
};
/**
 * @deprecated Use @metriport/core instead
 */
export const sqs = new SQS({
  apiVersion: "2012-11-05",
  region: sqsConfig.awsRegion,
});

/**
 * @deprecated Use @metriport/core instead
 */
export type SQSMessageAttributes = Record<string, string> & {
  cxId?: string;
};
/**
 * @deprecated Use @metriport/core instead
 */
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

/**
 * @deprecated Use @metriport/core instead
 */
export async function sendMessageToQueue(
  queueUrl: string,
  messageBody: string,
  sqsParams: SQSParameters = {}
): Promise<PromiseResult<SQS.SendMessageResult, AWSError>> {
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
  return sqs.sendMessage(messageParams).promise();
}

export type GetMessageSQSParameters = SharedInternalGetMessageSQSParameters & {
  /**
   * How many messages to return per query, from 1 to 10. Defaults to 1.
   */
  maxNumberOfMessagesPerQuery?: number;
  /**
   * Maximum number of messages to return. Defaults to 10.
   */
  maxNumberOfMessages?: number;
  /**
   * Determines whether it should keep pooling until the queue is empty or `maxNumberOfMessages`
   * has been reached. Defaults to false, which means it will only pool once.
   */
  poolUntilEmpty?: boolean;
};

/**
 * Reads and removes messages from the queue. If poolUntilEmpty is true, it will keep pooling
 * until the queue is empty (as determined by `getMessageCountFromQueue()`).
 */
export async function getMessagesFromQueue(
  queueUrl: string,
  sqsParams: GetMessageSQSParameters
): Promise<SQS.Message[]> {
  return _getMessagesFromQueue(queueUrl, {
    ...sqsParams,
    removeMessages: true,
    poolUntilEmpty: sqsParams.poolUntilEmpty ?? false,
  });
}

export type PeekMessageSQSParameters = SharedInternalGetMessageSQSParameters;

/**
 * Reads messages from the queue, returns them, but does not remove them.
 * Only queries the queue once.
 */
export async function peekMessagesFromQueue(
  queueUrl: string,
  sqsParams: GetMessageSQSParameters
): Promise<SQS.Message[]> {
  return _getMessagesFromQueue(queueUrl, {
    ...sqsParams,
    removeMessages: false,
    poolUntilEmpty: false,
    visibilityTimeout: 1, // we don't want to leave them "in flight" after we peek into them
  });
}

type SharedInternalGetMessageSQSParameters = {
  maxNumberOfMessagesPerQuery?: number;
  visibilityTimeout?: number;
  waitTimeSeconds?: number;
};
type InternalGetMessageSQSParameters = SharedInternalGetMessageSQSParameters & {
  maxNumberOfMessages?: number;
  removeMessages: boolean;
  poolUntilEmpty: boolean;
};

async function _getMessagesFromQueue(
  queueUrl: string,
  sqsParams: InternalGetMessageSQSParameters,
  rollingResult: SQS.Message[] = []
): Promise<SQS.Message[]> {
  const {
    removeMessages,
    poolUntilEmpty,
    maxNumberOfMessages = 10,
    maxNumberOfMessagesPerQuery = 1,
  } = sqsParams;
  if (!removeMessages && poolUntilEmpty) {
    throw new Error("Cannot pool until empty if not removing messages");
  }

  const remainingMessagesToQuery = maxNumberOfMessages - rollingResult.length;
  const maxMessagesOnQuery = Math.min(maxNumberOfMessagesPerQuery, remainingMessagesToQuery);
  if (maxMessagesOnQuery <= 0) return rollingResult;

  const messageParams: SQS.Types.ReceiveMessageRequest = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessagesOnQuery,
    VisibilityTimeout: sqsParams.visibilityTimeout,
    WaitTimeSeconds: sqsParams.waitTimeSeconds ?? 1,
    AttributeNames: ["All"],
    MessageAttributeNames: ["All"],
  };

  const resultReceive = await sqs.receiveMessage(messageParams).promise();
  const messages = resultReceive.Messages ?? [];
  const result = [...rollingResult, ...messages];

  if (removeMessages) await deleteMessagesFromQueue(queueUrl, toDeleteFormat(messages));

  if (poolUntilEmpty) {
    // SQS is a distributed system and the consensus about the message count take some time to be reached.
    const preUpdatedTotal1 = await getMessageCountFromQueue(queueUrl);
    await Util.sleep(sleepTimeBetweenCountsInMs);
    const preUpdatedTotal2 = await getMessageCountFromQueue(queueUrl);
    const updatedTotal = Math.max(preUpdatedTotal1, preUpdatedTotal2);
    if (updatedTotal <= 0) return result;
    return _getMessagesFromQueue(queueUrl, sqsParams, result);
  }
  return result;
}

/**
 * Returns the approximate count of messages in the queue. Returns -1 if not available.
 */
export async function getMessageCountFromQueue(queueUrl: string): Promise<number> {
  const resultTotal = await sqs
    .getQueueAttributes({
      QueueUrl: queueUrl,
      AttributeNames: ["ApproximateNumberOfMessages"],
    })
    .promise();
  const total = Number(resultTotal.Attributes?.ApproximateNumberOfMessages ?? "-1");
  return total;
}

function toDeleteFormat(messages: SQS.Message[]): MessageToDelete[] {
  return messages.flatMap(m => {
    if (!m.MessageId || !m.ReceiptHandle) return [];
    return {
      id: m.MessageId,
      receiptHandle: m.ReceiptHandle,
    };
  });
}

export type MessageToDelete = {
  id: string;
  receiptHandle: string;
};

export async function deleteMessagesFromQueue(
  queueUrl: string,
  messages: MessageToDelete[]
): Promise<{
  successful: SQS.DeleteMessageBatchResultEntryList;
  failed: SQS.BatchResultErrorEntryList;
}> {
  if (!messages || !messages.length) return { successful: [], failed: [] };
  const entries: SQS.Types.DeleteMessageBatchRequestEntryList = messages.map(m => ({
    Id: m.id,
    ReceiptHandle: m.receiptHandle,
  }));
  const messageParams: SQS.Types.DeleteMessageBatchRequest = {
    QueueUrl: queueUrl,
    Entries: entries,
  };
  const result = await sqs.deleteMessageBatch(messageParams).promise();
  if (result.Failed.length) {
    console.log(`Failed to delete messages from SQS: ${JSON.stringify(result.Failed)}`);
  }
  return { successful: result.Successful, failed: result.Failed };
}

/**
 * @deprecated move to core w/ Lambda's SQSUtils
 */
export function attributesToSend(
  inboundMessageAttribs: SQS.MessageBodyAttributeMap
): SQS.MessageBodyAttributeMap {
  let res = {};
  for (const [key, value] of Object.entries(inboundMessageAttribs)) {
    res = {
      ...res,
      ...singleAttributeToSend(key, value.StringValue),
    };
  }
  return res;
}

/**
 * @deprecated move to core w/ Lambda's SQSUtils
 */
export function singleAttributeToSend(
  key: string,
  value: string | undefined
): SQS.MessageBodyAttributeMap {
  return {
    [key]: {
      DataType: "String",
      StringValue: value,
    },
  };
}
