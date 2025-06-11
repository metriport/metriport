import { Bundle, Resource } from "@medplum/fhirtypes";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { capture } from "../../util";
import { executeAsynchronously } from "../../util/concurrency";
import { FHIR_APP_MIME_TYPE, XML_APP_MIME_TYPE } from "../../util/mime";
import {
  buildDocumentNameForNormalizedConversion,
  buildDocumentNameForPartialConversions,
} from "./filename";

export const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};

export async function storePreProcessedConversionResult({
  s3Utils,
  conversionResult,
  conversionResultBucketName,
  conversionResultFilename,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  conversionResult: Bundle<Resource>;
  conversionResultBucketName: string;
  conversionResultFilename: string;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}): Promise<void> {
  await storeInS3WithRetries({
    s3Utils,
    payload: JSON.stringify(conversionResult),
    bucketName: conversionResultBucketName,
    fileName: conversionResultFilename,
    contentType: FHIR_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading converted FHIR Bundle",
      context,
      captureParams: lambdaParams,
      shouldCapture: true,
    },
  });
}

export async function storePartitionedPayloadsInS3({
  s3Utils,
  partitionedPayloads,
  conversionResultBucketName,
  preConversionFilename,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  partitionedPayloads: string[];
  conversionResultBucketName: string;
  preConversionFilename: string;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}): Promise<void> {
  const fileNames: string[] = [];

  const payloadsWithIndices = partitionedPayloads.map((payload, index) => ({ payload, index }));

  const results = await executeAsynchronously(
    payloadsWithIndices,
    async ({ payload, index }) => {
      const nameWithPartNumber = buildDocumentNameForPartialConversions(
        preConversionFilename,
        index
      );
      await storeInS3WithRetries({
        s3Utils,
        payload,
        bucketName: conversionResultBucketName,
        fileName: nameWithPartNumber,
        contentType: XML_APP_MIME_TYPE,
        log,
        errorConfig: {
          errorMessage: "Error uploading partitioned XML part",
          context,
          captureParams: {
            ...lambdaParams,
            partIndex: index,
          },
          shouldCapture: false,
        },
      });
      fileNames[index] = nameWithPartNumber;
    },
    {
      numberOfParallelExecutions: 3,
      keepExecutingOnError: true,
      log,
    }
  );

  const failures = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
  if (failures.length > 0) {
    const msg = `Error uploading partitioned XML parts`;
    log(`${msg} - ${failures.length} failures`);
    capture.error(msg, {
      extra: {
        ...lambdaParams,
        context,
        fileNames,
        errors: failures.map(f => f.reason),
      },
    });
  }
}

export async function storePreprocessedPayloadInS3({
  s3Utils,
  payload,
  bucketName,
  fileName,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  payload: string;
  bucketName: string;
  fileName: string;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}): Promise<void> {
  await storeInS3WithRetries({
    s3Utils,
    payload,
    bucketName,
    fileName,
    contentType: XML_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading preprocessed XML",
      context,
      captureParams: lambdaParams,
      shouldCapture: true,
    },
  });
}

export async function storeHydratedConversionResult({
  s3Utils,
  bundle,
  bucketName,
  fileName,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  bundle: Bundle<Resource>;
  bucketName: string;
  fileName: string;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}): Promise<void> {
  const fileNameHydrated = `${fileName}_hydrated.json`;
  await storeInS3WithRetries({
    s3Utils,
    payload: JSON.stringify(bundle),
    bucketName,
    fileName: fileNameHydrated,
    contentType: FHIR_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading hydrated FHIR Bundle",
      context,
      captureParams: {
        conversionResultFilename: fileName,
        ...lambdaParams,
      },
      shouldCapture: true,
    },
  });
}

export async function storeNormalizedConversionResult({
  s3Utils,
  bundle,
  bucketName,
  fileName,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  bundle: Bundle<Resource>;
  bucketName: string;
  fileName: string;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}): Promise<void> {
  const fileNameNormalization = buildDocumentNameForNormalizedConversion(fileName);
  await storeInS3WithRetries({
    s3Utils,
    payload: JSON.stringify(bundle),
    bucketName,
    fileName: fileNameNormalization,
    contentType: FHIR_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading normalized FHIR Bundle",
      context,
      captureParams: {
        conversionResultFilename: fileName,
        ...lambdaParams,
      },
      shouldCapture: true,
    },
  });
}
