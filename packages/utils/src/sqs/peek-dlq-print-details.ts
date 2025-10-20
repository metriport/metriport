import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { BadRequestError, errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { SQS } from "aws-sdk";
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * This script saves the details of the messages in the DLQ to a file.
 * It assumes the messages are from the FHIR Converter DLQ, so the body contains the s3FileName and s3BucketName.
 *
 * Usage:
 * - set the `DLQ_URL` environment variable to the URL of the DLQ
 * - ts-node src/sqs/peek-dlq-print-details.ts -m 100 # peeks 100 messages
 * - ts-node src/sqs/peek-dlq-print-details.ts -d     # downloads files from S3
 * - ts-node src/sqs/peek-dlq-print-details.ts        # peeks all messages
 */

const dlqUrl = getEnvVarOrFail("DLQ_URL");
const awsRegion = getEnvVarOrFail("AWS_REGION");

const numberOfParallelPeeks = 10;
const numberOfParallelDownloadsFromS3 = 10;
const messagesToRetrievePerReceiveMsg = 10;

/**
 * @deprecated Use @metriport/core instead
 */
const sqs = new SQS({ apiVersion: "2012-11-05", region: awsRegion });

const s3Utils = new S3Utils(awsRegion);

const program = new Command();
program
  .name("peek-dlq-print-details")
  .description("CLI to peek into DLQ messages and optionally download files from S3")
  .option("-m, --max-messages <number>", "Maximum number of messages to peek")
  .option("-d, --download-files", "Download files from S3", false)
  .showHelpAfterError()
  .action(main)
  .parse();

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

async function main({
  maxMessages,
  downloadFiles,
}: {
  maxMessages: string;
  downloadFiles: boolean;
}) {
  await sleep(50);
  const startedAt = Date.now();
  console.log(
    `###### Starting to peek into queue at ${buildDayjs(startedAt).toISOString()} ######`
  );

  const maxMessagesToPeek = maxMessages ? parseInt(maxMessages) : undefined;
  console.log(
    `Running with: maxMessagesToPeek: ${maxMessagesToPeek}, downloadFiles: ${downloadFiles}`
  );

  const dirName = `runs/sqs/fhir-converter-dlq_${buildDayjs()
    .toISOString()
    .replace("T", "_")
    .replace(":", "-")}`;

  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  if (!dlqUrl) throw new BadRequestError("Missing FHIR Server DLQ URL");

  const messageCount = await getMessageCountFromQueue(dlqUrl);
  console.log(`>>> Message count: ${messageCount}`);

  const messageDetailsMap = new Map<string, MessageDetails>();
  const uniqueCxIdPatientIds = new Set<string>();

  const messagesToPeek = Math.min(messageCount, maxMessagesToPeek ?? Number.MAX_SAFE_INTEGER);
  const peekRequestCount = Math.ceil(messagesToPeek / messagesToRetrievePerReceiveMsg);

  console.log(`>>> Getting messages from source queue...`);
  const loopArray = Array.from({ length: peekRequestCount }, (_, i) => i + 1);
  await executeAsynchronously(
    loopArray,
    async idx => {
      console.log(`Peek ${idx} of ${peekRequestCount}`);
      const messagesOfRequest = await peekMessagesFromQueue(dlqUrl);
      if (!messagesOfRequest || !messagesOfRequest.length) {
        console.log(`>>> No messages found`);
        return;
      }
      messagesOfRequest.forEach(m => {
        const attr = m.MessageAttributes as unknown as DlqMessageAttributes | undefined;
        if (!attr) return;
        const startedAt = attr.jobStartedAt?.StringValue ?? attr.startedAt?.StringValue;
        const patientId = attr.patientId?.StringValue;
        const body = m.Body ? JSON.parse(m.Body) : undefined;
        const s3FileName = body.s3FileName;
        const s3BucketName = body.s3BucketName;
        if (!patientId || !startedAt || !s3FileName || !s3BucketName || !m.MessageId) return;

        // Add cxId, patientId to unique set
        uniqueCxIdPatientIds.add(`${attr.cxId?.StringValue ?? ""},${patientId}`);

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

  // Store unique patient IDs to file
  const patientIdsArray = Array.from(uniqueCxIdPatientIds).sort();
  fs.writeFileSync(`${dirName}/patient_ids.csv`, ["cxId,patientId", ...patientIdsArray].join("\n"));
  console.log(`>>> Saved ${patientIdsArray.length} unique patient IDs to patient_ids.txt`);

  if (downloadFiles) {
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
  } else {
    console.log(`>>> Skipping S3 file downloads (--download-files not specified)`);
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
async function peekMessagesFromQueue(queueUrl: string): Promise<SQS.Message[]> {
  const messageParams: SQS.Types.ReceiveMessageRequest = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: messagesToRetrievePerReceiveMsg,
    VisibilityTimeout: 1, // we don't want to leave them "in flight" after we peek into them
    WaitTimeSeconds: 2, // Give it some time to get the messages
    AttributeNames: ["All"],
    MessageAttributeNames: ["All"],
  };

  const resultReceive = await sqs.receiveMessage(messageParams).promise();
  const messages = resultReceive.Messages ?? [];
  return messages;
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

export default program;
