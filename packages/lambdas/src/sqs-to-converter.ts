import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import axios from "axios";
import * as uuid from "uuid";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvOrFail } from "./shared/env";
import { isAxiosBadGateway, isAxiosTimeout } from "./shared/http";
import { Log, prefixedLog } from "./shared/log";
import { apiClient } from "./shared/oss-api";
import { S3Utils } from "./shared/s3";
import { SQSUtils } from "./shared/sqs";
import { cleanUpPayload } from "./sqs-to-converter/cleanup";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvOrFail("METRICS_NAMESPACE");
const apiURL = getEnvOrFail("API_URL");
const axiosTimeoutSeconds = Number(getEnvOrFail("AXIOS_TIMEOUT_SECONDS"));
const maxTimeoutRetries = Number(getEnvOrFail("MAX_TIMEOUT_RETRIES"));
const delayWhenRetryingSeconds = Number(getEnvOrFail("DELAY_WHEN_RETRY_SECONDS"));
const sourceQueueURL = getEnvOrFail("QUEUE_URL");
const dlqURL = getEnvOrFail("DLQ_URL");
const conversionResultQueueURL = getEnvOrFail("CONVERSION_RESULT_QUEUE_URL");
const conversionResultBucketName = getEnvOrFail("CONVERSION_RESULT_BUCKET_NAME");

const sourceUrl = "https://api.metriport.com/cda/to/fhir";

const sqsUtils = new SQSUtils(region, sourceQueueURL, dlqURL, delayWhenRetryingSeconds);
const s3Utils = new S3Utils(region);
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);
const fhirConverter = axios.create({
  // Only response timeout, no option for connection timeout: https://github.com/axios/axios/issues/4835
  timeout: axiosTimeoutSeconds * 1_000, // should be less than the lambda timeout
  transitional: {
    // enables ETIMEDOUT instead of ECONNABORTED for timeouts - https://betterstack.com/community/guides/scaling-nodejs/nodejs-errors/
    clarifyTimeoutError: true,
  },
});
const ossApi = apiClient(apiURL);

function replaceIDs(fhirBundle: FHIRBundle, patientId: string): FHIRBundle {
  const stringsToReplace: { old: string; new: string }[] = [];
  for (const bundleEntry of fhirBundle.entry) {
    if (!bundleEntry.resource.id) throw new Error(`Missing resource id`);
    if (bundleEntry.resource.id === patientId) continue;
    const idToUse = bundleEntry.resource.id;
    const newId = uuid.v4();
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

  console.log(`Bundle being sent to FHIR server: ${fhirBundleStr}`);
  return JSON.parse(fhirBundleStr);
}

/* Example of a single message/record in event's `Records` array:
{
    "messageId": "2EBA03BC-D6D1-452B-BFC3-B1DD39F32947",
    "receiptHandle": "quite-long-string",
    "body": "{\"s3FileName\":\"nononononono\",\"s3BucketName\":\"nononono\"},\"documentExtension\":\"{...}\"}",
    "attributes": {
        "ApproximateReceiveCount": "1",
        "AWSTraceHeader": "Root=1-646a7c8c-3c5f0ea61b9a8e633bfad33c;Parent=78bb05ac3530ad87;Sampled=0;Lineage=e4161027:0",
        "SentTimestamp": "1684700300546",
        "SequenceNumber": "18878027350649327616",
        "SenderId": "AROAWX27OVJFOXNNHQRAU:FHIRConverter_Retry_Lambda",
        "ApproximateFirstReceiveTimestamp": "1684700300546"
    },
    "messageAttributes": ...,
    "md5OfBody": "543u5y34ui53uih543uh5ui4",
    "eventSource": "aws:sqs",
    "eventSourceARN": "arn:aws:sqs:<region>:<acc>>:<queue-name>",
    "awsRegion": "<region>"
}
*/

type EventBody = {
  s3BucketName: string;
  s3FileName: string;
  documentExtension: FHIRExtension;
};

type FHIRExtension = {
  url: string;
  valueString: string;
};

type FHIRBundle = {
  resourceType: "Bundle";
  type: "batch";
  entry: {
    fullUrl: string;
    resource: {
      resourceType: string;
      id: string;
      extension?: FHIRExtension[];
      meta?: {
        lastUpdated: string;
        source: string;
      };
    };
    request?: {
      method: string;
      url: string;
    };
  }[];
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
        const { s3BucketName, s3FileName, documentExtension } = parseBody(message.body);
        const metrics: Metrics = {};

        await cloudWatchUtils.reportMemoryUsage();
        log(`Getting contents from bucket ${s3BucketName}, key ${s3FileName}`);
        const downloadStart = Date.now();
        const payloadRaw = await s3Utils.getFileContentsAsString(s3BucketName, s3FileName);
        if (payloadRaw.includes("nonXMLBody")) {
          const msg = "XML document is unstructured CDA with nonXMLBody";
          console.log(`${msg}, skipping...`);
          capture.message(msg, {
            extra: { context: lambdaName, fileName: s3FileName, patientId, cxId, jobId },
            level: "warning",
          });
          await ossApi.notifyApi({ cxId, patientId, status: "failed", jobId, source }, log);
          return;
        }
        const payloadClean = cleanUpPayload(payloadRaw);
        metrics.download = {
          duration: Date.now() - downloadStart,
          timestamp: new Date(),
        };

        if (!payloadClean.trim().length) {
          console.log("XML document is empty, skipping...");
          capture.message("XML document is empty", {
            extra: { context: lambdaName, fileName: s3FileName, patientId, cxId, jobId },
            level: "warning",
          });
          await ossApi.notifyApi({ cxId, patientId, status: "failed", jobId, source }, log);
          return;
        }

        await cloudWatchUtils.reportMemoryUsage();
        const conversionStart = Date.now();

        const converterUrl = attrib.serverUrl?.stringValue;
        if (!converterUrl) throw new Error(`Missing converterUrl`);
        const unusedSegments = attrib.unusedSegments?.stringValue;
        const invalidAccess = attrib.invalidAccess?.stringValue;
        const params = { patientId, fileName: s3FileName, unusedSegments, invalidAccess };
        log(`Calling converter on url ${converterUrl} with params ${JSON.stringify(params)}`);
        const res = await fhirConverter.post(converterUrl, payloadClean, {
          params,
          headers: { "Content-Type": "text/plain" },
        });
        const conversionResult = res.data.fhirResource as FHIRBundle;
        metrics.conversion = {
          duration: Date.now() - conversionStart,
          timestamp: new Date(),
        };

        const preProcessedFilename = `${s3FileName}.from_converter.json`;

        try {
          await s3Utils.s3
            .upload({
              Bucket: conversionResultBucketName,
              Key: preProcessedFilename,
              Body: JSON.stringify(conversionResult),
              ContentType: "application/fhir+json",
            })
            .promise();
        } catch (error) {
          console.log(`Error uploading pre-processed file: ${error}`);
          capture.error(error, {
            extra: { context: lambdaName, preProcessedFilename, patientId, cxId, jobId },
          });
        }

        await cloudWatchUtils.reportMemoryUsage();

        // post-process conversion result
        const postProcessStart = Date.now();
        const updatedConversionResult = replaceIDs(conversionResult, patientId);
        addExtensionToConversion(updatedConversionResult, documentExtension);
        removePatientFromConversion(updatedConversionResult);
        addMissingRequests(updatedConversionResult);
        metrics.postProcess = {
          duration: Date.now() - postProcessStart,
          timestamp: new Date(),
        };

        await cloudWatchUtils.reportMemoryUsage();
        await sendConversionResult(
          cxId,
          patientId,
          s3FileName,
          updatedConversionResult,
          jobStartedAt,
          jobId,
          source,
          log
        );

        await cloudWatchUtils.reportMemoryUsage();
        await cloudWatchUtils.reportMetrics(metrics);
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // If it timed-out let's just reenqueue for future processing - NOTE: the destination MUST be idempotent!
        const count = message.attributes?.ApproximateReceiveCount
          ? Number(message.attributes?.ApproximateReceiveCount)
          : undefined;
        const isWithinRetryRange = count == null || count <= maxTimeoutRetries;
        const isRetryError = isAxiosTimeout(err) || isAxiosBadGateway(err);
        if (isRetryError && isWithinRetryRange) {
          const details = `${err.code}/${err.response?.status}`;
          console.log(
            `Timed out (${details}), reenqueue (${count} of ${maxTimeoutRetries}): `,
            message
          );
          capture.message("Conversion timed out", {
            extra: { message, context: lambdaName, retryCount: count },
          });
          await sqsUtils.reEnqueue(message);
        } else {
          console.log(`Error processing message: ${JSON.stringify(message)}; \n${err}: ${err}`);
          // Axios error response
          if (err.response) {
            const resp = err.response;
            const responseData = resp.data ? JSON.stringify(resp.data) : "undefined";
            console.log(`Response body: ${responseData}`);
          }
          capture.error(err, {
            extra: { message, context: lambdaName, retryCount: count },
          });
          await sqsUtils.sendToDLQ(message);

          await ossApi.notifyApi({ cxId, patientId, status: "failed", jobId, source }, log);
        }
      }
    }
    console.log(`Done`);
  } catch (err) {
    console.log(`Error processing event: ${JSON.stringify(event)}; ${err}`);
    capture.error(err, {
      extra: { event, context: lambdaName, additional: "outer catch" },
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

  const documentExtensionRaw = bodyAsJson.documentExtension;
  if (!documentExtensionRaw) throw new Error(`Missing documentExtension`);

  const s3BucketName = s3BucketNameRaw as string;
  const s3FileName = s3FileNameRaw as string;
  const documentExtension = documentExtensionRaw as FHIRExtension;

  return { s3BucketName, s3FileName, documentExtension };
}

function addExtensionToConversion(fhirBundle: FHIRBundle, extension: FHIRExtension) {
  if (fhirBundle?.entry?.length) {
    for (const bundleEntry of fhirBundle.entry) {
      if (!bundleEntry.resource) continue;
      if (!bundleEntry.resource.extension) bundleEntry.resource.extension = [];
      bundleEntry.resource.extension.push(extension);
    }
  }
}

function removePatientFromConversion(fhirBundle: FHIRBundle) {
  const entries = fhirBundle?.entry ?? [];
  const pos = entries.findIndex(e => e.resource?.resourceType === "Patient");
  if (pos >= 0) fhirBundle.entry.splice(pos, 1);
}

function addMissingRequests(fhirBundle: FHIRBundle) {
  if (!fhirBundle?.entry?.length) return;
  fhirBundle.entry.forEach(e => {
    if (!e.request && e.resource) {
      e.request = {
        method: "PUT",
        url: `${e.resource.resourceType}/${e.resource.id}`,
      };
    }
  });
}

async function sendConversionResult(
  cxId: string,
  patientId: string,
  sourceFileName: string,
  conversionPayload: FHIRBundle,
  jobStartedAt: string | undefined,
  jobId: string | undefined,
  source: string | undefined,
  log: Log
) {
  const fileName = `${sourceFileName}.json`;
  log(`Uploading result to S3, bucket ${conversionResultBucketName}, key ${fileName}`);
  await s3Utils.s3
    .upload({
      Bucket: conversionResultBucketName,
      Key: fileName,
      Body: JSON.stringify(conversionPayload),
      ContentType: "application/fhir+json",
    })
    .promise();

  log(`Sending result info to queue`);
  const queuePayload = JSON.stringify({
    s3BucketName: conversionResultBucketName,
    s3FileName: fileName,
  });

  const sendParams = {
    MessageBody: queuePayload,
    QueueUrl: conversionResultQueueURL,
    MessageAttributes: {
      ...sqsUtils.singleAttributeToSend("cxId", cxId),
      ...sqsUtils.singleAttributeToSend("patientId", patientId),
      ...(jobStartedAt ? sqsUtils.singleAttributeToSend("jobStartedAt", jobStartedAt) : {}),
      ...(jobId ? sqsUtils.singleAttributeToSend("jobId", jobId) : {}),
      ...(source ? sqsUtils.singleAttributeToSend("source", source) : {}),
    },
  };
  await sqsUtils.sqs.sendMessage(sendParams).promise();
}
