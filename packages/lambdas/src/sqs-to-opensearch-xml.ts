import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { Client } from "@opensearch-project/opensearch";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { S3Utils } from "./shared/s3";
import { SQSUtils } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvOrFail("METRICS_NAMESPACE");
const delayWhenRetryingSeconds = Number(getEnvOrFail("DELAY_WHEN_RETRY_SECONDS"));
const sourceQueueURL = getEnvOrFail("QUEUE_URL");
const dlqURL = getEnvOrFail("DLQ_URL");

const host = getEnvOrFail("SEARCH_HOST");
const username = getEnvOrFail("SEARCH_USER");
const secretName = getEnvOrFail("SEARCH_SECRET_NAME");
const indexName = getEnvOrFail("SEARCH_INDEX_NAME");

const sqsUtils = new SQSUtils(region, sourceQueueURL, dlqURL, delayWhenRetryingSeconds);
const s3Utils = new S3Utils(region);
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

type EventBody = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  s3BucketName: string;
  requestId: string;
  startedAt: string;
};

export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  const password = (await getSecret(secretName)) as string;
  if (!password) {
    throw new Error(`Config error - secret ${secretName} is empty/could not be retrieved`);
  }
  if (typeof password !== "string") {
    throw new Error(`Config error - secret ${secretName} is not a string`);
  }

  // Process messages from SQS
  const records = event.Records;
  if (!records || records.length < 1) {
    console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
    return;
  }
  if (records.length > 1) {
    capture.message("Got more than one message from SQS", {
      extra: {
        event,
        context: lambdaName,
        additional: `This lambda is supposed to run w/ only 1 message per batch, got ${records.length} (still processing them all)`,
      },
    });
  }
  console.log(`Processing ${records.length} records...`);
  for (const [i, message] of records.entries()) {
    // Process one record from the SQS message
    console.log(`Record ${i}, messageId: ${message.messageId}`);
    if (!message.body) throw new Error(`Missing message body`);

    try {
      const { cxId, patientId, s3FileName, s3BucketName, requestId } = parseBody(message.body);
      const log = prefixedLog(`${i}, patient ${patientId}, requestId ${requestId}`);
      log(`Body: ${message.body}`);

      const metrics: Metrics = {};

      log(`Getting contents from bucket ${s3BucketName}, key ${s3FileName}`);
      const downloadStart = Date.now();
      const fileContents = await s3Utils.getFileContentsAsString(s3BucketName, s3FileName);
      metrics.download = {
        duration: Date.now() - downloadStart,
        timestamp: new Date(),
      };
      await cloudWatchUtils.reportMemoryUsage();

      log(`Cleaning up file contents...`);
      const cleanUpStart = Date.now();
      const content = cleanUpContents(fileContents);
      metrics.cleanup = {
        duration: Date.now() - cleanUpStart,
        timestamp: new Date(),
      };
      await cloudWatchUtils.reportMemoryUsage();

      const auth = { username, password };
      const params = { cxId, patientId, fileName: s3FileName, content, auth };
      const ingestionStart = Date.now();
      await ingestIntoSearch(params);
      metrics.ingestion = {
        duration: Date.now() - ingestionStart,
        timestamp: new Date(),
      };
      await cloudWatchUtils.reportMemoryUsage();

      log(`Metrics: ${metrics}`);
      await cloudWatchUtils.reportMetrics(metrics);
    } catch (error) {
      console.log(`Error processing message: ${JSON.stringify(message)};\n${error}`);
      capture.error(error, {
        extra: { message, context: lambdaName, error },
      });
      await sqsUtils.sendToDLQ(message);
    }
  }
  console.log(`Done`);
});

function parseBody(body: unknown): EventBody {
  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const getStringBodyParam = (paramName: string): string => {
    const paramRaw = bodyAsJson[paramName];
    if (!paramRaw) throw new Error(`Missing ${paramName}`);
    if (typeof paramRaw !== "string") throw new Error(`Invalid ${paramName}`);
    return paramRaw as string;
  };

  const cxId = getStringBodyParam("cxId");
  const patientId = getStringBodyParam("patientId");
  const s3FileName = getStringBodyParam("s3FileName");
  const s3BucketName = getStringBodyParam("s3BucketName");
  const requestId = getStringBodyParam("requestId");
  const startedAt = getStringBodyParam("startedAt");

  return { cxId, patientId, s3FileName, s3BucketName, requestId, startedAt };
}

// IMPORTANT: keep this in sync w/ the API's connector-local.ts version of it.
// Ideally we would use the same code the API does, but since the cost/benefit doesn't seeem to be worth it.
export function cleanUpContents(contents: string): string {
  const result = contents
    .trim()
    .toLowerCase()
    .replace(/"/g, "")
    .replace(/(\s\s+)|(\n\n)|(\n)|(\t)|(\r)/g, " ");
  return result;
}

export async function ingestIntoSearch(params: {
  cxId: string;
  patientId: string;
  fileName: string;
  content: string;
  auth: { username: string; password: string };
}): Promise<void> {
  // ingest into OpenSearch
  const { cxId, patientId, fileName, content, auth } = params;

  const client = new Client({ node: host, auth });

  // create index if it doesn't already exist
  const indexExists = Boolean((await client.indices.exists({ index: indexName })).body);
  if (!indexExists) {
    const body = {
      mappings: {
        properties: {
          cxId: { type: "keyword" },
          patientId: { type: "keyword" },
          content: { type: "text" },
        },
      },
    };
    console.log(`Index ${indexName} doesn't exist, creating one...`);
    const createResult = (await client.indices.create({ index: indexName, body })).body;
    console.log(`Created index ${indexName}: ${JSON.stringify(createResult.body)}`);
  }

  // add a document to the index
  const document = {
    cxId,
    patientId,
    content,
  };

  console.log(`Ingesting file ${fileName} into index ${indexName}...`);
  const response = await client.index({
    index: indexName,
    id: fileName,
    body: document,
  });
  console.log(`Successfully ingested it, response: ${JSON.stringify(response.body)}`);
}
