import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import axios from "axios";
import * as uuid from "uuid";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnv, getEnvOrFail } from "./shared/env";
import { isAxiosBadGateway, isAxiosTimeout } from "./shared/http";
import { Log, prefixedLog } from "./shared/log";
import { apiClient } from "./shared/oss-api";
import { S3Utils } from "./shared/s3";
import { sleep } from "./shared/sleep";
import { SQSUtils } from "./shared/sqs";

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
// sidechain converter config
const sidechainFHIRConverterUrl = getEnv("SIDECHAIN_FHIR_CONVERTER_URL");
const sidechainFHIRConverterUrlBlacklist = getEnv("SIDECHAIN_FHIR_CONVERTER_URL_BLACKLIST");
const sidechainWordsToRemove = getEnv("SIDECHAIN_FHIR_CONVERTER_WORDS_TO_REMOVE");
const sidechainFHIRConverterKeysSecretName = isSidechainConnector()
  ? getEnvOrFail("SIDECHAIN_FHIR_CONVERTER_KEYS")
  : undefined;

const baseReplaceUrl = "https://public.metriport.com";
const sourceUrl = "https://api.metriport.com/cda/to/fhir";
const MAX_SIDECHAIN_ATTEMPTS = 5;
const SIDECHAIN_INITIAL_TIME_BETTWEEN_ATTEMPTS_MILLIS = 500;

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

function isSidechainConnector() {
  return sidechainFHIRConverterUrl ? true : false;
}

async function getSidechainConverterAPIKey(): Promise<string> {
  if (!sidechainFHIRConverterKeysSecretName) {
    throw new Error(`Programming error - sidechainFHIRConverterKeys is not set`);
  }

  const secret = await getSecret(sidechainFHIRConverterKeysSecretName);
  if (!secret) {
    throw new Error(`Config error - sidechainFHIRConverterKeysSecret doesn't exist`);
  }

  const keys = String(secret).split(",");
  if (keys.length < 1) {
    throw new Error(
      `Config error - sidechainFHIRConverterKeysSecret needs to be a comma separated string of keys`
    );
  }
  // pick a key at random
  return keys[Math.floor(Math.random() * keys.length)];
}

function postProcessSidechainFHIRBundle(
  fhirBundle: FHIRBundle,
  extension: FHIRExtension,
  patientId: string
): FHIRBundle {
  fhirBundle.type = "batch";

  const stringsToReplace: { old: string; new: string }[] = [];
  let curIndex = 0;
  let patientIndex = -1;
  let operationOutcomeIndex = -1;

  if (fhirBundle?.entry?.length) {
    for (const bundleEntry of fhirBundle.entry) {
      if (!bundleEntry.resource) continue;
      // replace meta's source and profile - trying to keep those short b/c of HAPI constraint of 100 chars on URLs
      bundleEntry.resource.meta = {
        lastUpdated: bundleEntry.resource.meta?.lastUpdated ?? new Date().toISOString(),
        source: sourceUrl,
      };

      // validate resource id
      let idToUse = bundleEntry.resource.id;

      // save index of the patient resource (if any)
      if (bundleEntry.resource.resourceType === "Patient") {
        patientIndex = curIndex;
      }
      // save index of the operation outcome resource (if any)
      if (bundleEntry.resource.resourceType === "OperationOutcome") {
        operationOutcomeIndex = curIndex;
      }

      if (idToUse) {
        if (!uuid.validate(idToUse) && idToUse !== patientId) {
          // if it's not valid, we'll need to generate a valid UUID
          const newId = uuid.v4();
          bundleEntry.resource.id = newId;

          // save the old/new ID pair so we later replace all occurences
          // of the old one with the new one
          stringsToReplace.push({ old: idToUse, new: newId });

          idToUse = newId;
        }

        // change the fullUrl in the resource to match what our converter would generate
        bundleEntry.fullUrl = `urn:uuid:${idToUse}`;

        // add missing request
        if (!bundleEntry.request) {
          bundleEntry.request = {
            method: "PUT",
            url: `${bundleEntry.resource.resourceType}/${bundleEntry.resource.id}`,
          };
        }

        // add doc id extension
        if (!bundleEntry.resource.extension) bundleEntry.resource.extension = [];
        bundleEntry.resource.extension.push(extension);
      }

      curIndex++;
    }

    // remove the patient resource if it was found in the bundle
    let indexModifier = 0;
    if (patientIndex >= 0) {
      fhirBundle.entry.splice(patientIndex, 1);
      indexModifier = 1;
    }
    // likewise, remove the operation outcome resource if it was found
    if (operationOutcomeIndex >= 0)
      fhirBundle.entry.splice(operationOutcomeIndex - indexModifier, 1);
  }

  // replace all old ids & blacklisted urls
  if (sidechainFHIRConverterUrlBlacklist) {
    const blacklistedUrls = sidechainFHIRConverterUrlBlacklist.split(",");
    for (const url of blacklistedUrls) {
      stringsToReplace.push({ old: url, new: baseReplaceUrl });
    }
  }

  let fhirBundleStr = JSON.stringify(fhirBundle);
  for (const stringToReplace of stringsToReplace) {
    // doing this is apparently more efficient than just using replace
    const regex = new RegExp(stringToReplace.old, "g");
    fhirBundleStr = fhirBundleStr.replace(regex, stringToReplace.new);
  }

  if (sidechainWordsToRemove) {
    const words = sidechainWordsToRemove.split(",");
    for (const word of words) {
      const regex = new RegExp(word, "gi");
      fhirBundleStr = fhirBundleStr.replace(regex, "");
    }
  }

  console.log(`Bundle being sent to FHIR server: ${fhirBundleStr}`);
  return JSON.parse(fhirBundleStr);
}

async function postToSidechainConverter(payload: unknown, patientId: string, log: Log) {
  const sidechainUrl = `${sidechainFHIRConverterUrl}/${patientId}`;
  let attempt = 0;
  let timeBetweenAttemptsMillis = SIDECHAIN_INITIAL_TIME_BETTWEEN_ATTEMPTS_MILLIS;
  let apiKey: string;
  while (attempt++ < MAX_SIDECHAIN_ATTEMPTS) {
    apiKey = await getSidechainConverterAPIKey();
    log(`(${attempt}) Calling sidechain converter on url ${sidechainUrl}`);
    try {
      const res = await fhirConverter.post(sidechainUrl, payload, {
        headers: {
          "Content-Type": "application/xml",
          Accept: "application/json",
          "x-api-key": apiKey,
        },
      });
      return res;
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if ([401, 429].includes(error.response?.status)) {
        const msg = "Sidechain quota/auth error, trying again";
        const extra = {
          url: sidechainUrl,
          apiKey,
          statusCode: error.response?.status,
          attempt,
          error,
        };
        log(msg, extra);
        capture.message(msg, { extra, level: "info" });
        await sleep(timeBetweenAttemptsMillis);
        timeBetweenAttemptsMillis *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Too many errors from sidechain converter`);
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
        metrics.download = {
          duration: Date.now() - downloadStart,
          timestamp: new Date(),
        };

        await cloudWatchUtils.reportMemoryUsage();
        const conversionStart = Date.now();
        let conversionResult: FHIRBundle;
        if (isSidechainConnector()) {
          const res = await postToSidechainConverter(payloadRaw, patientId, log);
          conversionResult = res.data;
        } else {
          const converterUrl = attrib.serverUrl?.stringValue;
          if (!converterUrl) throw new Error(`Missing converterUrl`);
          const unusedSegments = attrib.unusedSegments?.stringValue;
          const invalidAccess = attrib.invalidAccess?.stringValue;
          const params = { patientId, fileName: s3FileName, unusedSegments, invalidAccess };
          log(`Calling converter on url ${converterUrl} with params ${JSON.stringify(params)}`);
          const res = await fhirConverter.post(converterUrl, payloadRaw, {
            params,
            headers: { "Content-Type": "text/plain" },
          });
          conversionResult = res.data.fhirResource;
        }
        metrics.conversion = {
          duration: Date.now() - conversionStart,
          timestamp: new Date(),
        };

        await cloudWatchUtils.reportMemoryUsage();

        // post-process conversion result
        const postProcessStart = Date.now();
        if (isSidechainConnector()) {
          conversionResult = postProcessSidechainFHIRBundle(
            conversionResult,
            documentExtension,
            patientId
          );
        } else {
          addExtensionToConversion(conversionResult, documentExtension);
          removePatientFromConversion(conversionResult);
          addMissingRequests(conversionResult);
        }
        metrics.postProcess = {
          duration: Date.now() - postProcessStart,
          timestamp: new Date(),
        };

        await cloudWatchUtils.reportMemoryUsage();
        await sendConversionResult(
          cxId,
          patientId,
          s3FileName,
          conversionResult,
          jobStartedAt,
          jobId,
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
          capture.error(err, {
            extra: { message, context: lambdaName, retryCount: count },
          });
          await sqsUtils.sendToDLQ(message);

          if (isSidechainConnector()) {
            await ossApi.notifyApi({ cxId, patientId, status: "failed", jobId }, log);
          }
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

  if (isSidechainConnector()) {
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
      },
    };
    await sqsUtils.sqs.sendMessage(sendParams).promise();
  } else {
    log(`Skipping sending result info to queue`);
  }
}
