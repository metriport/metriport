import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BadRequestError, getEnvVarOrFail } from "@metriport/shared";
import { SQS } from "aws-sdk";
import fs from "fs";
import { Config } from "../../../api/src/shared/config";

/**
 * This script saves the details of the messages in the DLQ to a file.
 */

// Link to the FHIR Server DLQ / FHIR Converter DLQ(https://sqs....)
const dlqUrl = getEnvVarOrFail("DLQ_URL");
const outputFileName = "fhir-converter-dlq";
const dirName = `runs/sqs/${outputFileName}`;

const maxNumberOfMessagesPerQuery = 1;

const sqsConfig = {
  awsRegion: Config.getAWSRegion(),
};
/**
 * @deprecated Use @metriport/core instead
 */
const sqs = new SQS({
  apiVersion: "2012-11-05",
  region: sqsConfig.awsRegion,
});

type GetMessageSQSParameters = SharedInternalGetMessageSQSParameters & {
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

export type MessageDetails = {
  messageId: string | undefined;
  bucketName: string | undefined;
  fileName: string;
  cxId: string | undefined;
  jobId: string | undefined;
  startedAt: string;
  patientId: string | undefined;
};

type DlqMessageAttributes = {
  cxId: {
    StringValue: string;
  };
  jobId: {
    StringValue: string;
  };
  patientId: {
    StringValue: string;
  };
  startedAt?: {
    StringValue: string;
  };
  jobStartedAt?: {
    StringValue: string;
  };
};

async function peekIntoQueue() {
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  if (!dlqUrl) throw new BadRequestError("Missing FHIR Server DLQ URL");
  if (!outputFileName.length) throw new BadRequestError("Set the output file name");

  const messageCount = await getMessageCountFromQueue(dlqUrl);
  console.log(`>>> Message count: ${messageCount}`);

  const messageDetailsMap = new Map<string, MessageDetails>();

  console.log(`>>> Getting messages from source queue...`);
  for (let i = 0; i < messageCount; i++) {
    const messagesOfRequest = await peekMessagesFromQueue(dlqUrl, {
      maxNumberOfMessagesPerQuery,
      maxNumberOfMessages: maxNumberOfMessagesPerQuery,
    });

    if (!messagesOfRequest || !messagesOfRequest.length) {
      console.log(`>>> No messages found`);
      return { messageCount: 0, first10Items: [] };
    }

    messagesOfRequest.forEach(m => {
      const attr = m.MessageAttributes as DlqMessageAttributes | undefined;
      if (!attr) return;
      const startedAt = attr.jobStartedAt?.StringValue ?? attr.startedAt?.StringValue;
      const patientId = attr.patientId?.StringValue;
      const body = m.Body ? JSON.parse(m.Body) : undefined;
      const s3FileName = body.s3FileName;
      const s3BucketName = body.s3BucketName;
      if (!patientId || !startedAt || !s3FileName || !s3BucketName || !m.MessageId) return;

      const details: MessageDetails = {
        messageId: m.MessageId,
        bucketName: s3BucketName,
        fileName: s3FileName,
        cxId: attr.cxId?.StringValue,
        jobId: attr.jobId?.StringValue,
        startedAt: startedAt,
        patientId: patientId,
      };

      messageDetailsMap.set(m.MessageId, details);
    });
  }

  const uniqueMessageDetails = Array.from(messageDetailsMap.values());
  fs.writeFileSync(`${dirName}/${outputFileName}.json`, JSON.stringify(uniqueMessageDetails));

  console.log(`>>> Saved ${uniqueMessageDetails.length} unique messages to file`);
}

/**
 * Reads messages from the queue, returns them, but does not remove them.
 * Only queries the queue once.
 */
async function peekMessagesFromQueue(
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

  if (poolUntilEmpty) {
    // SQS is a distributed system and the consensus about the message count take some time to be reached.
    const preUpdatedTotal1 = await getMessageCountFromQueue(queueUrl);
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
async function getMessageCountFromQueue(queueUrl: string): Promise<number> {
  const resultTotal = await sqs
    .getQueueAttributes({
      QueueUrl: queueUrl,
      AttributeNames: ["ApproximateNumberOfMessages"],
    })
    .promise();
  const total = Number(resultTotal.Attributes?.ApproximateNumberOfMessages ?? "-1");
  return total;
}

peekIntoQueue();
