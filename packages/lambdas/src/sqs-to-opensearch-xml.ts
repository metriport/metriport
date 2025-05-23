import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { OpenSearchFileIngestorDirect } from "@metriport/core/external/opensearch/file/file-ingestor-direct";
import { FileIngestorSQSPayload } from "@metriport/core/external/opensearch/file/file-ingestor-sqs";
import { errorToString, executeWithRetries, MetriportError } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";

dayjs.extend(duration);

// Keep this as early on the file as possible
capture.init();

/**
 * Larger delay to give OpenSearch more time to recover from any load related issues.
 * There's not much pressure to ingest these super quickly.
 */
const initialDelayBetweenRetries = dayjs.duration({ seconds: 1 });
/**
 * Fewer attempts to ingest, as OpenSearch doesn't often fail and five should be more than enough.
 * Also, considering the longer initial delay, more attempts would require capping max delay,
 * because of exponential backoff.
 */
const maxAttemptsToIngest = 5;

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvOrFail("METRICS_NAMESPACE");
const host = getEnvOrFail("SEARCH_HOST");
const username = getEnvOrFail("SEARCH_USER");
const secretName = getEnvOrFail("SEARCH_SECRET_NAME");
const indexName = getEnvOrFail("SEARCH_INDEX_NAME");

const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

type EventBody = FileIngestorSQSPayload;

// TODO move to capture.wrapHandler()
export async function handler(event: SQSEvent) {
  try {
    // Process messages from SQS
    const records = event.Records;
    if (!records || records.length < 1) {
      console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
      return;
    }

    const password = (await getSecret(secretName)) as string;
    if (!password) {
      throw new Error(`Config error - secret ${secretName} is empty/could not be retrieved`);
    }
    if (typeof password !== "string") {
      throw new Error(`Config error - secret ${secretName} is not a string`);
    }
    const openSearch = new OpenSearchFileIngestorDirect({
      region,
      endpoint: "https://" + host,
      indexName,
      username,
      password,
    });

    console.log(`Processing ${records.length} records...`);
    for (const [i, message] of records.entries()) {
      // Process one record from the SQS message
      console.log(`Record ${i}, messageId: ${message.messageId}`);
      if (!message.body) throw new Error(`Missing message body`);
      console.log(`Body: ${message.body}`);

      const params = parseBody(message.body);
      const { patientId, s3FileName, s3BucketName, requestId } = params;
      const log = prefixedLog(`${i}, patient ${patientId}, requestId ${requestId}`);
      const metrics: Metrics = {};

      await cloudWatchUtils.reportMemoryUsage();

      log(
        `Getting contents from bucket ${s3BucketName}, key ${s3FileName}, converting and ingesting into OpenSearch...`
      );
      const ingestionStart = Date.now();
      await executeWithRetries(async () => openSearch.ingest(params), {
        initialDelay: initialDelayBetweenRetries.asMilliseconds(),
        maxAttempts: maxAttemptsToIngest,
        log,
      });
      metrics.ingestion = {
        duration: Date.now() - ingestionStart,
        timestamp: new Date(),
      };
      await cloudWatchUtils.reportMemoryUsage();

      log(`Metrics: ${JSON.stringify(metrics)}`);
      await cloudWatchUtils.reportMetrics(metrics);
    }
    console.log(`Done`);
  } catch (error) {
    const msg = "Error ingesting message into OpenSearch";
    console.log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { event, context: lambdaName, error },
    });
    throw new MetriportError(msg, error);
  }
}

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
  const entryId = getStringBodyParam("entryId");
  const s3FileName = getStringBodyParam("s3FileName");
  const s3BucketName = getStringBodyParam("s3BucketName");
  const requestId = getStringBodyParam("requestId");
  const startedAt = getStringBodyParam("startedAt");

  return { cxId, patientId, entryId, s3FileName, s3BucketName, requestId, startedAt };
}
