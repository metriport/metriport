import * as dotenv from "dotenv";
dotenv.config();

import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { S3Utils } from "@metriport/core/external/aws/s3";
import dayjs from "dayjs";
import path from "path";
import fs from "fs";
import axios from "axios";
import { execSync } from "child_process";
import { setTimeout as wait } from "timers/promises";
import { convert } from "./convert";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";

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
const REGION = getEnvVarOrFail("AWS_REGION");
const QUEUE_URL = getEnvVarOrFail("FHIR_CONVERTER_DLQ_URL");
const DATE_ID = dayjs().format("YYYY-MM-DD");
const OUTPUT_FILE = path.join(process.cwd(), `runs/fhir-dlq-${DATE_ID}.json`);
const MAX_MESSAGES = 10; // max AWS allows per call
const MAX_TOTAL_MESSAGES = 100; // max total messages to read
const MAX_PARALLEL_CONVERSIONS = 1;
const VISIBILITY_TIMEOUT = 0; // do not hide messages
const WAIT_BETWEEN_REQUESTS_MS = 200; // avoid throttling
const EXPECTED_BUCKET_NAME = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const LOCAL_FHIR_CONVERTER_URL = getEnvVarOrFail("LOCAL_FHIR_CONVERTER_URL");

// A file that will definitely be converted successfully, to test that the FHIR converter is working.
// Set to the empty string to skip the canary file test.
const CANARY_TEST_FILE = "runs/hl7-example-cda.xml";

// Path to CDA-to-HTML script
const CDA_TO_HTML_PATH = path.join(
  process.cwd(),
  "dist/utils/src/customer-requests/cda-to-html.js"
);

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

const localFhirConverter = axios.create({
  baseURL: LOCAL_FHIR_CONVERTER_URL,
});

async function dumpDlq() {
  if (CANARY_TEST_FILE) {
    await convert(process.cwd() + "/", CANARY_TEST_FILE, localFhirConverter, {
      hydrate: false,
      normalize: false,
      processAttachments: true,
    });
  }
  console.log("Canary conversion succeeded!");

  const sqs = new SQSClient({ region: REGION });
  const allMessages: DumpedMessage[] = [];
  let invalidBucketCount = 0;
  let failureCount = 0;

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
    console.log(`Read ${messages.length} messages from DLQ`);

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

  console.log(`Writing ${allMessages.length} messages to ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allMessages, null, 2), "utf8");

  console.log(`❌ ${invalidBucketCount} messages had an invalid bucket name`);

  console.log("Downloading all files from S3...");
  const outputFolder = path.join(process.cwd(), `runs/fhir-dlq-${DATE_ID}`);
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  let downloadedCount = 0;
  const s3 = new S3Utils(REGION);

  await executeAsynchronously(
    allMessages,
    async message => {
      const { s3FileName, s3BucketName } = message.Body;
      const fileName = path.basename(s3FileName);
      const outputFilePath = path.join(outputFolder, fileName);

      if (fs.existsSync(outputFilePath)) {
        console.log(`✅ ${fileName} already exists, skipping...`);
        return;
      }

      console.log(`📥 Downloading ${fileName}...`);
      const obj = await s3.downloadFile({ bucket: s3BucketName, key: s3FileName });
      if (obj) {
        fs.writeFileSync(outputFilePath, obj);

        try {
          execSync(`node ${CDA_TO_HTML_PATH} ${outputFilePath}`);
          console.log(`✅ ${fileName} converted to HTML`);
        } catch (error) {
          console.error(`❌ Error converting ${outputFilePath} to HTML: ${error}`);
        }

        try {
          const bundle = await convert(outputFolder + "/", fileName, localFhirConverter, {
            hydrate: true,
            normalize: true,
            processAttachments: true,
          });
          console.log(`✅ ${fileName} converted to FHIR`);
          fs.writeFileSync(
            path.join(outputFolder, fileName.replace(".xml", ".json")),
            JSON.stringify(bundle, null, 2)
          );
        } catch (error) {
          console.error(`❌ Error converting ${outputFilePath} to FHIR: ${error}`);
          failureCount++;
        }

        downloadedCount++;
        if (downloadedCount % 10 === 0) {
          console.log(`📥 Downloaded ${downloadedCount} files`);
        }
      }
    },
    {
      numberOfParallelExecutions: MAX_PARALLEL_CONVERSIONS,
    }
  );

  console.log(`❌ ${failureCount} files failed to convert`);
}

dumpDlq().catch(err => {
  console.error("❌ Error dumping DLQ:", err);
  process.exit(1);
});
