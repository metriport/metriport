import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { S3Utils } from "@metriport/core/external/aws/s3";
import dayjs from "dayjs";
import path from "path";
import fs from "fs";
import { setTimeout as wait } from "timers/promises";

/**
 * This script is used to download all failing XML files from the FHIR Converter DLQ,
 * and automatically try to process them with CDA-to-HTML and a local FHIR converter to
 * diagnose the potential issue.
 *
 * To run the script, cd into the `utils` folder and execute:
 * > npm run fhir-converter-dlq
 *
 * This will create a file named "fhir-dlq-YYYY-MM-DD.json" in the current directory.
 */
const REGION = "us-west-1"; // change to your region
const QUEUE_URL = "https://sqs.us-west-1.amazonaws.com/463519787594/FHIRConverterDLQ";
const DATE_ID = dayjs().format("YYYY-MM-DD");
const OUTPUT_FILE = path.join(process.cwd(), `runs/fhir-dlq-${DATE_ID}.json`);
const MAX_MESSAGES = 10; // max AWS allows per call
const MAX_TOTAL_MESSAGES = 30; // max total messages to read
const VISIBILITY_TIMEOUT = 0; // do not hide messages
const WAIT_BETWEEN_REQUESTS_MS = 200; // avoid throttling
const EXPECTED_BUCKET_NAME = "metriport-medical-documents";

interface DumpedMessage {
  MessageId: string;
  Body: ParsedBody;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, unknown>;
}

interface ParsedBody {
  s3FileName: string;
  s3BucketName: string;
}

async function dumpDlq() {
  const sqs = new SQSClient({ region: REGION });
  const allMessages: DumpedMessage[] = [];
  let invalidBucketCount = 0;

  console.log(`📥 Reading messages from DLQ: ${QUEUE_URL}`);

  while (allMessages.length < MAX_TOTAL_MESSAGES) {
    const command = new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: MAX_MESSAGES,
      VisibilityTimeout: VISIBILITY_TIMEOUT,
      AttributeNames: ["All"],
      MessageAttributeNames: ["All"],
      WaitTimeSeconds: 0,
    });

    const response = await sqs.send(command);
    const messages = response.Messages || [];
    console.log(`📥 Read ${messages.length} messages from DLQ`);

    if (messages.length === 0) {
      break;
    }

    for (const m of messages) {
      if (!m.MessageId || !m.Body) {
        continue;
      }
      const Body = JSON.parse(m.Body) as ParsedBody;
      if (Body.s3BucketName !== EXPECTED_BUCKET_NAME) {
        invalidBucketCount++;
        continue;
      }

      allMessages.push({
        MessageId: m.MessageId,
        Body,
        Attributes: m.Attributes,
        MessageAttributes: m.MessageAttributes,
      });
    }

    // avoid rate limiting
    await wait(WAIT_BETWEEN_REQUESTS_MS);
  }

  console.log(`📝 Writing ${allMessages.length} messages to ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allMessages, null, 2), "utf8");
  console.log("✅ Done!");

  console.log(`❌ ${invalidBucketCount} messages had an invalid bucket name`);

  console.log("Downloading all files from S3...");
  const outputFolder = path.join(process.cwd(), `runs/fhir-dlq-${DATE_ID}`);
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  let downloadedCount = 0;
  const s3 = new S3Utils(REGION);
  for (const message of allMessages) {
    const { s3FileName, s3BucketName } = message.Body;
    const obj = await s3.downloadFile({ bucket: s3BucketName, key: s3FileName });
    if (obj) {
      const fileName = `failure_${downloadedCount}.xml`;
      fs.writeFileSync(path.join(outputFolder, fileName), obj);
      downloadedCount++;
      if (downloadedCount % 10 === 0) {
        console.log(`📥 Downloaded ${downloadedCount} files`);
      }
    }
  }
}

dumpDlq().catch(err => {
  console.error("❌ Error dumping DLQ:", err);
  process.exit(1);
});
