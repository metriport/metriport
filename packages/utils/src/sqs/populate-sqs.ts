import { SQS } from "aws-sdk";
import { Command } from "commander";
import * as fs from "fs";
import { chunk, uniq } from "lodash";
import path from "path";
import { uuidv4 } from "../shared/uuid-v7";

/**
 * Script to populate the SQS queue with messages from a JSON file.
 *
 * It was originally created to send messages pulled from a DLQ but that failed to be sent
 * to the destination queue.
 *
 * The file is expected to be with the following format:
 * [
 *   { "s3FileName": "cxId/patientId/fileName", "s3BucketName": "bucketName", "documentExtension": "pdf" },
 *   ...
 * ]
 */

const cwd = process.cwd();
const paths = [cwd, ...(cwd.includes("src") ? [] : ["src"])];

/**
 * UPDATE THESE
 */
const fileName = path.resolve(...paths, "sqs", "messages.json");
const destinationQueueUrl = "";
const awsRegion = "";
const maxItemsPerBatch = 10;

type Params = {
  dryrun?: boolean;
};
const program = new Command();
program
  .name("populate-sqs")
  .description("CLI to send messages to SQS.")
  .option(`--dryrun`, "Just dedup/prepare the messages but not send them")
  .showHelpAfterError();

const sqsConfig = {
  awsRegion,
};
export const sqs = new SQS({
  apiVersion: "2012-11-05",
  region: sqsConfig.awsRegion,
});

async function main() {
  program.parse();
  const { dryrun: dryRun } = program.opts<Params>();

  console.log(
    `Running with:\n` +
      `- fileName: ${fileName}\n` +
      `- destinationQueueUrl: ${destinationQueueUrl}\n` +
      `- awsRegion: ${awsRegion}\n` +
      `- maxItemsPerBatch: ${maxItemsPerBatch}\n`
  );
  console.log(`Reading file ${fileName}...`);
  const contents = fs.readFileSync(fileName, "utf8");

  console.log(`Parsing its contents...`);
  const payload = JSON.parse(contents) as {
    s3FileName: string;
    s3BucketName: string;
    documentExtension: unknown;
  }[];
  if (!Array.isArray(payload)) {
    throw new Error(`Payload is not an array`);
  }

  const filteredPayload = payload.filter(item => !item.s3FileName.includes(".pdf"));
  console.log(`Started w/ ${payload.length}, filtered to ${filteredPayload.length} messages`);

  const chunks = chunk(filteredPayload, maxItemsPerBatch);
  const n = chunks.length;
  console.log(
    `${dryRun ? "[dry-run] " : ""}Sending messages to the queue in ${n} chunks in parallel...`
  );

  const promises = chunks.map(chunk => {
    const batchEntries = chunk.map(item => {
      const s3FileName = item.s3FileName;
      const cxId = s3FileName.split("/")[0];
      const patientId = s3FileName.split("/")[1];
      return {
        Id: uuidv4(),
        MessageBody: JSON.stringify(item),
        MessageAttributes: {
          ...singleAttributeToSend("cxId", cxId),
          ...singleAttributeToSend("patientId", patientId),
        },
      };
    });
    // Max individual entry and total request size can't be more than 256KB
    if (!dryRun) {
      console.log(`Sending ${batchEntries.length} messages...`);
      return sqs
        .sendMessageBatch({ QueueUrl: destinationQueueUrl, Entries: batchEntries })
        .promise();
    }
  });

  const res = await Promise.allSettled(promises);
  const failed = res.flatMap(r => (r.status === "rejected" ? String(r.reason) : []));
  if (failed.length) {
    const succeeded = res.filter(r => r.status === "fulfilled");
    const uniqueMsgs = uniq(failed);
    console.log(
      `>>> Failed to get messages from SQS (total errors ${failed.length}, ` +
        `unique errors ${uniqueMsgs.length}, succeeded ${succeeded.length}): ` +
        `${uniqueMsgs.join("; ")}`
    );
  }

  console.log(`Done.`);
}

function singleAttributeToSend(
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

main();
