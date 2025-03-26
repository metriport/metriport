import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import {
  FhirConverterParams,
  FhirExtension,
} from "@metriport/core/domain/conversion/bundle-modifications/modifications";
import { postProcessBundle } from "@metriport/core/domain/conversion/bundle-modifications/post-process";
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";
import {
  buildDocumentNameForCleanConversion,
  buildDocumentNameForConversionResult,
  buildDocumentNameForFromConverter,
  buildDocumentNameForPreConversion,
} from "@metriport/core/domain/conversion/filename";
import {
  defaultS3RetriesConfig,
  storeHydratedConversionResult,
  storeNormalizedConversionResult,
  storePartitionedPayloadsInS3,
  storePreProcessedConversionResult,
  storePreprocessedPayloadInS3,
} from "@metriport/core/domain/conversion/upload-conversion-steps";
import { S3Utils, executeWithRetriesS3 } from "@metriport/core/external/aws/s3";
import { partitionPayload } from "@metriport/core/external/cda/partition-payload";
import { processAttachments } from "@metriport/core/external/cda/process-attachments";
import { removeBase64PdfEntries } from "@metriport/core/external/cda/remove-b64";
import { hydrate } from "@metriport/core/external/fhir/consolidated/hydrate";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { FHIR_APP_MIME_TYPE, TXT_MIME_TYPE } from "@metriport/core/util/mime";
import { MetriportError, errorToString, executeWithNetworkRetries } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import axios from "axios";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvOrFail } from "./shared/env";
import { Log, prefixedLog } from "./shared/log";
import { apiClient } from "./shared/oss-api";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvOrFail("METRICS_NAMESPACE");
const apiUrl = getEnvOrFail("API_URL");
const fhirUrl = getEnvOrFail("FHIR_SERVER_URL");
const medicalDocumentsBucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const axiosTimeoutSeconds = Number(getEnvOrFail("AXIOS_TIMEOUT_SECONDS"));
const conversionResultBucketName = getEnvOrFail("CONVERSION_RESULT_BUCKET_NAME");

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
const ossApi = apiClient(apiUrl);
const LARGE_CHUNK_SIZE_IN_BYTES = 50_000_000;

const HYDRATION_TIMEOUT_MS = 5_000;

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
  documentExtension: FhirExtension;
};

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
// TODO: 2502 - Migrate most of the logic to the core to simplify the lambda handler as much as possible
export async function handler(event: SQSEvent) {
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
      const medicalDataSource = attrib.source?.stringValue;
      if (!cxId) throw new Error(`Missing cxId`);
      if (!patientId) throw new Error(`Missing patientId`);
      const log = prefixedLog(`${i}, patient ${patientId}, job ${jobId}`);
      const lambdaParams = { cxId, patientId, jobId, source: medicalDataSource };
      try {
        log(`Body: ${message.body}`);
        const { s3BucketName, s3FileName, documentExtension } = parseBody(message.body);
        const metrics: Metrics = {};

        log(`Getting contents from bucket ${s3BucketName}, key ${s3FileName}`);
        const downloadStart = Date.now();
        const payloadRaw = await s3Utils.getFileContentsAsString(s3BucketName, s3FileName);
        if (payloadRaw.includes("nonXMLBody")) {
          log(
            `XML document is unstructured CDA with nonXMLBody, skipping... Filename: ${s3FileName}`
          );
          await ossApi.internal.notifyApi({ ...lambdaParams, status: "failed" }, log);
          continue;
        }
        const { documentContents: payloadNoB64, b64Attachments } =
          removeBase64PdfEntries(payloadRaw);

        if (b64Attachments && b64Attachments.total > 0) {
          log(`Extracted ${b64Attachments.total} B64 attachments - will process them soon`);
        }
        const dealWithAttachments = async () => {
          if (b64Attachments && b64Attachments.total > 0) {
            await processAttachments({
              b64Attachments,
              cxId,
              patientId,
              filePath: s3FileName,
              medicalDataSource,
              s3BucketName: medicalDocumentsBucketName,
              fhirUrl,
            });
          }
        };

        const payloadClean = cleanUpPayload(payloadNoB64);
        metrics.download = {
          duration: Date.now() - downloadStart,
          timestamp: new Date(),
        };

        if (!payloadClean.trim().length) {
          log(`XML document is empty, skipping... Filename: ${s3FileName}`);
          await ossApi.internal.notifyApi({ ...lambdaParams, status: "failed" }, log);
          continue;
        }

        const conversionStart = Date.now();

        const converterUrl = attrib.serverUrl?.stringValue;
        if (!converterUrl) throw new Error(`Missing converterUrl`);
        const unusedSegments = attrib.unusedSegments?.stringValue;
        const invalidAccess = attrib.invalidAccess?.stringValue;
        const converterParams: FhirConverterParams = {
          patientId,
          fileName: s3FileName,
          unusedSegments,
          invalidAccess,
        };

        const preConversionFilename = buildDocumentNameForPreConversion(s3FileName);
        const cleanFileName = buildDocumentNameForCleanConversion(s3FileName);
        const conversionResultFilename = buildDocumentNameForFromConverter(s3FileName);

        await storePreprocessedPayloadInS3({
          s3Utils,
          payload: payloadClean,
          bucketName: conversionResultBucketName,
          fileName: cleanFileName,
          context: lambdaName,
          lambdaParams,
          log,
        });

        const partitionedPayloads = partitionPayload(payloadClean);

        const [conversionResult] = await Promise.all([
          convertPayloadToFHIR({
            converterUrl,
            partitionedPayloads,
            converterParams,
            log,
          }),
          dealWithAttachments(),
          storePartitionedPayloadsInS3({
            s3Utils,
            partitionedPayloads,
            conversionResultBucketName,
            preConversionFilename,
            context: lambdaName,
            lambdaParams,
            log,
          }),
        ]);

        metrics.conversion = {
          duration: Date.now() - conversionStart,
          timestamp: new Date(),
        };

        await storePreProcessedConversionResult({
          s3Utils,
          conversionResult,
          conversionResultBucketName,
          conversionResultFilename,
          context: lambdaName,
          lambdaParams,
          log,
        });

        let hydratedBundle = conversionResult;
        try {
          const hydratedResult = await Promise.race<Bundle<Resource>>([
            hydrate({
              cxId,
              patientId,
              bundle: conversionResult,
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Hydration timeout")), HYDRATION_TIMEOUT_MS)
            ),
          ]);

          hydratedBundle = hydratedResult;

          await storeHydratedConversionResult({
            s3Utils,
            bundle: hydratedBundle,
            bucketName: conversionResultBucketName,
            fileName: s3FileName,
            context: lambdaName,
            lambdaParams,
            log,
          });
        } catch (error) {
          const msg = "Failed to hydrate the converted bundle";
          log(`${msg}: ${errorToString(error)}`);
          capture.message(msg, {
            extra: {
              error,
              cxId,
              patientId,
              context: lambdaName,
              s3FileName,
            },
            level: "warning",
          });
        }

        const normalizedBundle = await normalize({
          cxId,
          patientId,
          bundle: hydratedBundle,
        });

        await storeNormalizedConversionResult({
          s3Utils,
          bundle: normalizedBundle,
          bucketName: conversionResultBucketName,
          fileName: s3FileName,
          context: lambdaName,
          lambdaParams,
          log,
        });

        const postProcessStart = Date.now();
        const updatedConversionResult = postProcessBundle(
          normalizedBundle,
          patientId,
          documentExtension
        );
        metrics.postProcess = {
          duration: Date.now() - postProcessStart,
          timestamp: new Date(),
        };

        // Store the conversion result in S3 and send it to the destination(s)
        await sendConversionResult({
          cxId,
          patientId,
          sourceFileName: s3FileName,
          conversionPayload: updatedConversionResult,
          jobId,
          medicalDataSource,
          log,
        });

        await cloudWatchUtils.reportMetrics(metrics);
      } catch (error) {
        await ossApi.internal.notifyApi({ ...lambdaParams, status: "failed" }, log);
        throw error;
      }
    }
    console.log(`Done`);
  } catch (error) {
    const msg = "Error processing event on " + lambdaName;
    console.log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { event, context: lambdaName, error },
    });
    throw new MetriportError(msg);
  }
}

async function convertPayloadToFHIR({
  converterUrl,
  partitionedPayloads,
  converterParams,
  log,
}: {
  converterUrl: string;
  partitionedPayloads: string[];
  converterParams: FhirConverterParams;
  log: typeof console.log;
}): Promise<Bundle<Resource>> {
  log(`Calling converter on url ${converterUrl} with params ${JSON.stringify(converterParams)}`);

  const combinedBundle: Bundle<Resource> = {
    resourceType: "Bundle",
    type: "batch",
    entry: [],
  };

  if (partitionedPayloads.length > 1) {
    log(`The file was partitioned into ${partitionedPayloads.length} parts...`);
  }

  const bundleEntrySet = new Set<BundleEntry<Resource>>();
  for (let index = 0; index < partitionedPayloads.length; index++) {
    const payload = partitionedPayloads[index];

    const chunkSize = payload ? new Blob([payload]).size : 0;
    if (chunkSize > LARGE_CHUNK_SIZE_IN_BYTES) {
      const msg = `Chunk size is too large`;
      log(`${msg} - chunkSize ${chunkSize} on ${index}`);
      capture.message(msg, {
        extra: {
          chunkSize,
          patientId: converterParams.patientId,
          fileName: converterParams.fileName,
        },
        level: "warning",
      });
    }

    const res = await executeWithNetworkRetries(
      () =>
        fhirConverter.post(converterUrl, payload, {
          params: converterParams,
          headers: { "Content-Type": TXT_MIME_TYPE },
        }),
      {
        // No retries on timeout b/c we want to re-enqueue instead of trying within the same lambda run,
        // it could lead to timing out the lambda execution.
        log,
      }
    );

    const conversionResult = res.data.fhirResource as Bundle<Resource>;

    if (conversionResult?.entry && conversionResult.entry.length > 0) {
      log(
        `Current partial bundle with index ${index} contains: ${conversionResult.entry.length} resources...`
      );
      conversionResult.entry.forEach(entry => bundleEntrySet.add(entry));
    }
  }
  combinedBundle.entry = [...bundleEntrySet];

  log(`Combined bundle contains: ${combinedBundle.entry.length} resources`);
  return combinedBundle;
}

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
  const documentExtension = documentExtensionRaw as FhirExtension;

  return { s3BucketName, s3FileName, documentExtension };
}

async function sendConversionResult({
  cxId,
  patientId,
  sourceFileName,
  conversionPayload,
  jobId,
  medicalDataSource,
  log,
}: {
  cxId: string;
  patientId: string;
  sourceFileName: string;
  conversionPayload: Bundle<Resource>;
  jobId: string | undefined;
  medicalDataSource: string | undefined;
  log: Log;
}) {
  const fileName = buildDocumentNameForConversionResult(sourceFileName);
  log(`Uploading result to S3, bucket ${conversionResultBucketName}, key ${fileName}`);

  await executeWithRetriesS3(
    () =>
      s3Utils.s3
        .upload({
          Bucket: conversionResultBucketName,
          Key: fileName,
          Body: JSON.stringify(conversionPayload),
          ContentType: FHIR_APP_MIME_TYPE,
        })
        .promise(),
    {
      ...defaultS3RetriesConfig,
      log,
    }
  );

  log(`Sending result info to the API`);
  await ossApi.internal.notifyApi(
    { cxId, patientId, jobId, source: medicalDataSource, status: "success" },
    log
  );
}
