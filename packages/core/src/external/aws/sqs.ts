import { executeWithNetworkRetries } from "@metriport/shared";
import { SQS } from "aws-sdk";
import { MessageBodyAttributeMap } from "aws-sdk/clients/sqs";
import { chunk } from "lodash";
import { executeAsynchronously } from "../../util/concurrency";

const batchNumberOfParallelExecutions = 20;
const batchMinJitterMillis = 10;
const batchMaxJitterMillis = 200;
const batchSize = 10;

export type SQSMessageAttributes = Record<string, string> & {
  cxId?: string;
};
export type SQSParametersNonFifo = {
  fifo?: never | false;
  messageGroupId?: never;
  messageDeduplicationId?: never;
  messageAttributes?: SQSMessageAttributes;
  messageAttributesRaw?: SQS.MessageBodyAttributeMap;
  delaySeconds?: number;
};
export type SQSParametersFifo = {
  fifo: true;
  messageGroupId: string;
  messageDeduplicationId: string;
  messageAttributes?: SQSMessageAttributes;
  messageAttributesRaw?: SQS.MessageBodyAttributeMap;
  delaySeconds?: number;
};
export type SQSParameters = SQSParametersNonFifo | SQSParametersFifo;

export type SQSBatchMessage<T extends SQSParameters = SQSParameters> = {
  id: string;
  body: string;
} & T;

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
    await executeWithNetworkRetries(() => this.sqs.sendMessage(messageParams).promise());
  }

  /**
   * Sends messages to the queue in batches. If the array of messages is too large, it will be
   * split into chunks and sent in parallel.
   *
   * @param queueUrl - the URL of the queue to send the messages to
   * @param messages - the messages to send
   * @param progressCallback - A callback to report progress.
   * @returns the messages that failed to send
   */
  async sendMessagesToQueueInBatches(
    queueUrl: string,
    messages: SQSBatchMessage[],
    progressCallback?: (current: number, total: number) => void
  ): Promise<SQSBatchMessage[]> {
    if (messages.length < 1) return [];
    const failedMessages: SQSBatchMessage[] = [];
    const chunks = chunk(messages, batchSize);
    let current = 0;
    const total = messages.length;
    await executeAsynchronously(
      chunks,
      async aChunk => {
        try {
          const entries = aChunk.map(message => {
            const entry: SQS.SendMessageBatchRequestEntry = {
              Id: message.id,
              ...buildSQSMessage(message),
            };
            return entry;
          });
          const failedIdsOfChunk = await this.sendBatchToQueue(entries, queueUrl);
          const failedMessagesOfChunk = aChunk.filter(msg => failedIdsOfChunk.includes(msg.id));
          failedMessages.push(...failedMessagesOfChunk);
          current += aChunk.length;
          if (progressCallback) progressCallback(current, total);
        } catch (error) {
          failedMessages.push(...aChunk);
          current += aChunk.length;
          if (progressCallback) progressCallback(current, total);
        }
      },
      {
        numberOfParallelExecutions: batchNumberOfParallelExecutions,
        minJitterMillis: batchMinJitterMillis,
        maxJitterMillis: batchMaxJitterMillis,
      }
    );
    return failedMessages;
  }

  private async sendBatchToQueue(
    entries: SQS.SendMessageBatchRequestEntry[],
    queueUrl: string
  ): Promise<string[]> {
    const batchParams: SQS.Types.SendMessageBatchRequest = {
      QueueUrl: queueUrl,
      Entries: entries,
    };
    const result = await executeWithNetworkRetries(() =>
      this.sqs.sendMessageBatch(batchParams).promise()
    );
    const failed = result.Failed ?? [];
    return failed.map(failedEntry => failedEntry.Id);
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
    ...(delaySeconds != undefined && delaySeconds >= 0 ? { DelaySeconds: delaySeconds } : {}),
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
