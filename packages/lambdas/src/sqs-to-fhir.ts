import { MedplumClient } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import * as Sentry from "@sentry/serverless";
import { uuid4 } from "@sentry/utils";
import { SQSEvent } from "aws-lambda";
import fetch from "node-fetch";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvOrFail, isSandbox } from "./shared/env";
import { isAxiosBadGateway, isAxiosTimeout } from "./shared/http";
import { Log, prefixedLog } from "./shared/log";
import { apiClient } from "./shared/oss-api";
import { S3Utils } from "./shared/s3";
import { SQSUtils } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvOrFail("METRICS_NAMESPACE");
const apiURL = getEnvOrFail("API_URL");
const maxTimeoutRetries = Number(getEnvOrFail("MAX_TIMEOUT_RETRIES"));
const delayWhenRetryingSeconds = Number(getEnvOrFail("DELAY_WHEN_RETRY_SECONDS"));
const sourceQueueURL = getEnvOrFail("QUEUE_URL");
const dlqURL = getEnvOrFail("DLQ_URL");
const fhirServerUrl = getEnvOrFail("FHIR_SERVER_URL");

const sourceUrl = "https://api.metriport.com/cda/to/fhir";
const maxRetries = 10;

const sqsUtils = new SQSUtils(region, sourceQueueURL, dlqURL, delayWhenRetryingSeconds);
const s3Utils = new S3Utils(region);
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);
const placeholderReplaceRegex = new RegExp("66666666-6666-6666-6666-666666666666", "g");
const metriportPrefixRegex = new RegExp("Metriport/identifiers/Metriport/", "g");
const ossApi = apiClient(apiURL);

/* Example of a single message/record in event's `Records` array:
{
    "messageId": "2EBA03BC-D6D1-452B-BFC3-B1DD39F32947",
    "receiptHandle": "quite-long-string",
    "body": "{\"s3FileName\":\"nononononono\",\"s3BucketName\":\"nononono\"}",
    "attributes": {
        "ApproximateReceiveCount": "1",
        "AWSTraceHeader": "Root=1-646a7c8c-3c5f0ea61b9a8e633bfad33c;Parent=78bb05ac3530ad87;Sampled=0;Lineage=e4161027:0",
        "SentTimestamp": "1684700300546",
        "SequenceNumber": "18878027350649327616",
        "SenderId": "AROAWX27OVJFOXNNHQRAU:FHIRConverter_Retry_Lambda",
        "ApproximateFirstReceiveTimestamp": "1684700300546"
    },
    "messageAttributes": {
      cxId: {
        stringValue: '7006E0FB-33C8-42F4-B675-A3FD05717446',
        stringListValues: [],
        binaryListValues: [],
        dataType: 'String'
      }
    },
    "md5OfBody": "543u5y34ui53uih543uh5ui4",
    "eventSource": "aws:sqs",
    "eventSourceARN": "arn:aws:sqs:<region>:<acc>>:<queue-name>",
    "awsRegion": "<region>"
}
*/

type EventBody = {
  s3BucketName: string;
  s3FileName: string;
};

export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  try {
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
      if (!message.messageAttributes) throw new Error(`Missing message attributes`);
      if (!message.body) throw new Error(`Missing message body`);
      const attrib = message.messageAttributes;
      const cxId = attrib.cxId?.stringValue;
      const patientId = attrib.patientId?.stringValue;
      const jobId = attrib.jobId?.stringValue;
      const jobStartedAt = attrib.startedAt?.stringValue;
      const source = attrib.source?.stringValue;
      if (!cxId) throw new Error(`Missing cxId`);
      if (!patientId) throw new Error(`Missing patientId`);
      const log = prefixedLog(`${i}, patient ${patientId}, job ${jobId}`);

      try {
        log(`Body: ${message.body}`);
        const { s3BucketName, s3FileName } = parseBody(message.body);
        const metrics: Metrics = {};

        log(`Getting contents from bucket ${s3BucketName}, key ${s3FileName}`);
        const downloadStart = Date.now();
        const payloadRaw = await s3Utils.getFileContentsAsString(s3BucketName, s3FileName);
        metrics.download = {
          duration: Date.now() - downloadStart,
          timestamp: new Date(),
        };

        log(`Converting payload to JSON, length ${payloadRaw.length}`);
        let payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const idsReplaced = replaceIds(payloadRaw);
        log(`IDs replaced, length: ${idsReplaced.length}`);
        if (isSandbox()) {
          const placeholderUpdated = idsReplaced.replace(placeholderReplaceRegex, patientId);
          payload = JSON.parse(placeholderUpdated);
          log(`Payload to FHIR (length ${placeholderUpdated.length}): ${JSON.stringify(payload)}`);
        } else {
          payload = JSON.parse(idsReplaced);
        }

        // light validation to make sure it's a bundle
        if (payload.resourceType !== "Bundle") {
          throw new Error(`Not a FHIR Bundle`);
        }

        log(`Sending payload to FHIRServer...`);
        let response: Bundle<Resource> | undefined;
        const upsertStart = Date.now();
        const fhirApi = new MedplumClient({
          fetch,
          baseUrl: fhirServerUrl,
          fhirUrlPath: `fhir/${cxId}`,
        });
        let count = 0;
        let retry = true;
        while (retry) {
          count++;
          response = await fhirApi.executeBatch(payload);
          const errors = getErrorsFromReponse(response);
          if (errors.length <= 0) break;
          retry = count < maxRetries;
          log(`Got ${errors.length} errors from FHIR, ${retry ? "" : "NOT "}trying again...`);
          if (!retry) {
            throw new MetriportError(`Too many errors from FHIR`, undefined, {
              count: count.toString(),
              maxRetries: maxRetries.toString(),
            });
          }
        }
        metrics.errorCount = {
          count,
          timestamp: new Date(),
        };
        metrics.upsert = {
          duration: Date.now() - upsertStart,
          timestamp: new Date(),
        };

        if (jobStartedAt) {
          metrics.job = {
            duration: Date.now() - new Date(jobStartedAt).getTime(),
            timestamp: new Date(),
          };
        }

        processFHIRResponse(response, event, log);

        await cloudWatchUtils.reportMetrics(metrics);
        await ossApi.notifyApi({ cxId, patientId, status: "success", jobId, source }, log);
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // If it timed-out let's just reenqueue for future processing - NOTE: the destination MUST be idempotent!
        const count = message.attributes?.ApproximateReceiveCount
          ? Number(message.attributes?.ApproximateReceiveCount)
          : undefined;
        const isWithinRetryRange = count == null || count <= maxTimeoutRetries;
        const isRetryError = isAxiosTimeout(error) || isAxiosBadGateway(error);
        if (!(error instanceof MetriportError) && isRetryError && isWithinRetryRange) {
          console.log(`Timed out, reenqueue (${count} of ${maxTimeoutRetries}): `, message);
          capture.message("Sending to FHIR server timed out", {
            extra: { message, context: lambdaName, retryCount: count },
          });
          await sqsUtils.reEnqueue(message);
        } else {
          console.log(`Error processing message: ${JSON.stringify(message)}; \n${error.message}`);
          capture.error(error, {
            extra: { message, context: lambdaName, retryCount: count, error },
          });
          await sqsUtils.sendToDLQ(message);

          await ossApi.notifyApi(
            { cxId, patientId, status: "failed", details: error.message, jobId, source },
            log
          );
        }
      }
    }
    console.log(`Done`);
  } catch (err) {
    console.log(`Error processing event: ${JSON.stringify(event)}; ${err}`);
    capture.error(err, {
      extra: {
        event,
        context: lambdaName,
        additional: "outer catch",
        notes:
          "This means the API was notified about the failure, the patient's doc query is " +
          "likely not to get completed - needs manual intervention!",
      },
    });
    throw err;
  }
});

function parseBody(body: unknown): EventBody {
  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const s3BucketNameRaw = bodyAsJson.s3BucketName;
  if (!s3BucketNameRaw) throw new Error(`Missing s3BucketName`);
  if (typeof s3BucketNameRaw !== "string") throw new Error(`Invalid s3BucketName`);

  const s3FileNameRaw = bodyAsJson.s3FileName;
  if (!s3FileNameRaw) throw new Error(`Missing s3FileName`);
  if (typeof s3FileNameRaw !== "string") throw new Error(`Invalid s3FileName`);

  const s3BucketName = s3BucketNameRaw as string;
  const s3FileName = s3FileNameRaw as string;

  return { s3BucketName, s3FileName };
}

function replaceIds(payload: string) {
  const fhirBundle = JSON.parse(payload);
  const stringsToReplace: { old: string; new: string }[] = [];
  for (const bundleEntry of fhirBundle.entry) {
    // validate resource id
    const idToUse = bundleEntry.resource.id;
    const newId = uuid4();
    bundleEntry.resource.id = newId;
    stringsToReplace.push({ old: idToUse, new: newId });
    // replace meta's source and profile
    bundleEntry.resource.meta = {
      lastUpdated: bundleEntry.resource.meta?.lastUpdated ?? new Date().toISOString(),
      source: sourceUrl,
    };
  }
  let fhirBundleStr = JSON.stringify(fhirBundle);
  for (const stringToReplace of stringsToReplace) {
    // doing this is apparently more efficient than just using replace
    const regex = new RegExp(stringToReplace.old, "g");
    fhirBundleStr = fhirBundleStr.replace(regex, stringToReplace.new);
  }

  fhirBundleStr = fhirBundleStr.replace(metriportPrefixRegex, "");

  return fhirBundleStr;
}

function getErrorsFromReponse(response?: Bundle<Resource>) {
  const entries = response?.entry ? response.entry : [];
  const errors = entries.filter(
    // returns non-2xx responses AND null/undefined
    e => !e.response?.status?.startsWith("2")
  );
  return errors;
}

function processFHIRResponse(
  response: Bundle<Resource> | undefined,
  event: SQSEvent,
  log: Log
): void {
  const entries = response?.entry ? response.entry : [];
  const errors = getErrorsFromReponse(response);
  const countError = errors.length;
  const countSuccess = entries.length - countError;
  log(`Got ${countError} errors and ${countSuccess} successes from FHIR Server`);
  if (errors.length > 0) {
    errors.forEach(e => log(`Error from FHIR Server: ${JSON.stringify(e)}`));
    capture.message(`Error upserting Bundle on FHIR server`, {
      extra: {
        context: lambdaName,
        additional: "processResponse",
        event,
        countSuccess,
        countError,
      },
      level: "error",
    });
  }
}
