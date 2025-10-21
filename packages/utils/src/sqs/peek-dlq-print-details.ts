import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { BadRequestError, errorToString, getEnvVarOrFail } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { SQS } from "aws-sdk";
import fs from "fs";
import path from "path";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * This script saves the details of the messages in the DLQ to a file.
 *
 * Usage:
 * - set the `DLQ_URL` environment variable to the URL of the DLQ
 * - ts-node src/sqs/peek-dlq-print-details.ts     # peek all messages
 * - ts-node src/sqs/peek-dlq-print-details.ts 100 # peek 100 messages
 */

const dlqUrl = getEnvVarOrFail("DLQ_URL");
const awsRegion = getEnvVarOrFail("AWS_REGION");

const dirName = `runs/sqs/fhir-converter-dlq_${buildDayjs()
  .toISOString()
  .replace("T", "_")
  .replace(":", "-")}`;

const maxNumberOfMessagesPerQuery = 1;
const numberOfParallelPeeks = 10;
const numberOfParallelDownloadsFromS3 = 10;
const maxMessagesToPeek = process.argv[2] ? parseInt(process.argv[2]) : undefined;

/**
 * @deprecated Use @metriport/core instead
 */
const sqs = new SQS({
  apiVersion: "2012-11-05",
  region: awsRegion,
});

const s3Utils = new S3Utils(awsRegion);

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

type MessageDetails = {
  messageId: string | undefined;
  bucketName: string | undefined;
  fileName: string;
  cxId: string | undefined;
  jobId: string | undefined;
  startedAt: string;
  patientId: string | undefined;
  messageBody: string | undefined;
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
  const startedAt = Date.now();
  console.log(
    `###### Starting to peek into queue at ${buildDayjs(startedAt).toISOString()} ######`
  );
  console.log(`Running with maxMessagesToPeek: ${maxMessagesToPeek}`);

  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  if (!dlqUrl) throw new BadRequestError("Missing FHIR Server DLQ URL");

  const messageCount = await getMessageCountFromQueue(dlqUrl);
  console.log(`>>> Message count: ${messageCount}`);

  const messageDetailsMap = new Map<string, MessageDetails>();

  const messagesToPeek = Math.min(messageCount, maxMessagesToPeek ?? messageCount);

  console.log(`>>> Getting messages from source queue...`);
  const tmpArr = Array.from({ length: messagesToPeek }, (_, i) => i + 1);
  await executeAsynchronously(
    tmpArr,
    async idx => {
      console.log(`>>> Peek ${idx} of ${messagesToPeek}`);
      const messagesOfRequest = await peekMessagesFromQueue(dlqUrl, {
        maxNumberOfMessagesPerQuery,
        maxNumberOfMessages: maxNumberOfMessagesPerQuery,
      });

      if (!messagesOfRequest || !messagesOfRequest.length) {
        console.log(`>>> No messages found`);
        return;
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
          messageBody: m.Body,
        };

        messageDetailsMap.set(m.MessageId, details);
      });
    },
    {
      numberOfParallelExecutions: numberOfParallelPeeks,
    }
  );

  const uniqueMessageDetails = Array.from(messageDetailsMap.values());

  console.log(`>>> Downloading files from S3 for ${uniqueMessageDetails.length} messages...`);
  const errors: unknown[] = [];
  await executeAsynchronously(
    uniqueMessageDetails,
    async messageDetails => {
      try {
        await downloadFileFromS3(messageDetails, dirName);
      } catch (error) {
        errors.push(error);
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelDownloadsFromS3,
    }
  );

  if (errors.length > 0) {
    console.error(`>>> Failed to download files for ${errors.length} messages:`);
    errors.forEach(error => {
      console.error(errorToString(error));
    });
  }

  // Also store a general summary of the messages in a file with the name of the output file.
  fs.writeFileSync(`${dirName}/_all_messages.json`, JSON.stringify(uniqueMessageDetails, null, 2));

  console.log(
    `>>> Saved ${uniqueMessageDetails.length} unique messages to file, in ${elapsedTimeAsStr(
      startedAt
    )}`
  );
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
};

async function _getMessagesFromQueue(
  queueUrl: string,
  sqsParams: InternalGetMessageSQSParameters,
  rollingResult: SQS.Message[] = []
): Promise<SQS.Message[]> {
  const { maxNumberOfMessages = 10, maxNumberOfMessagesPerQuery = 1 } = sqsParams;

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

/**
 * Downloads a file from S3 and saves it locally, along with the message body as JSON
 */
async function downloadFileFromS3(
  messageDetails: MessageDetails,
  outputDir: string
): Promise<void> {
  if (!messageDetails.bucketName || !messageDetails.fileName) {
    console.warn(`>>> Skipping message ${messageDetails.messageId} - missing bucket or filename`);
    return;
  }

  try {
    // Download the original file from S3 using S3Utils
    const fileBuffer = await s3Utils.downloadFile({
      bucket: messageDetails.bucketName,
      key: messageDetails.fileName,
    });

    // Create safe filename by replacing problematic characters
    const safeFileName = messageDetails.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const originalFilePath = path.join(outputDir, safeFileName);

    // Write the original file
    fs.writeFileSync(originalFilePath, fileBuffer);
    console.log(`>>> Downloaded: ${safeFileName}`);

    // Save the message body as JSON
    const bodyFilePath = path.join(outputDir, `${safeFileName}_body.json`);
    let messageBodyContent;

    if (messageDetails.messageBody) {
      try {
        // Try to parse and pretty-print the JSON
        const parsedBody = JSON.parse(messageDetails.messageBody);
        messageBodyContent = JSON.stringify(parsedBody, null, 2);
      } catch {
        // If parsing fails, save as raw string
        messageBodyContent = messageDetails.messageBody;
      }
    } else {
      // Create metadata file if no body available
      messageBodyContent = JSON.stringify(
        {
          messageId: messageDetails.messageId,
          bucketName: messageDetails.bucketName,
          fileName: messageDetails.fileName,
          cxId: messageDetails.cxId,
          jobId: messageDetails.jobId,
          startedAt: messageDetails.startedAt,
          patientId: messageDetails.patientId,
          downloadedAt: buildDayjs().toISOString(),
        },
        null,
        2
      );
    }

    fs.writeFileSync(bodyFilePath, messageBodyContent);
  } catch (error) {
    console.error(
      `>>> Error downloading ${messageDetails.fileName} from bucket ${messageDetails.bucketName}:`,
      error
    );
    throw error;
  }
}

peekIntoQueue();
