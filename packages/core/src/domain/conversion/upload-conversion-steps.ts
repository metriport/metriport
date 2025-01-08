import { Bundle, Resource } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { SQSRecord } from "aws-lambda";
import { S3Utils, executeWithRetriesS3 } from "../../external/aws/s3";
import { capture } from "../../util";
import { executeAsynchronously } from "../../util/concurrency";
import { FHIR_APP_MIME_TYPE, XML_APP_MIME_TYPE } from "../../util/mime";
import { buildDocumentNameForPartialConversions } from "./filename";

export const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};

export async function storePreProcessedConversionResult({
  s3Utils,
  conversionResult,
  conversionResultBucketName,
  conversionResultFilename,
  message,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  conversionResult: Bundle<Resource>;
  conversionResultBucketName: string;
  conversionResultFilename: string;
  message: SQSRecord;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}) {
  await storeInS3WithRetries({
    s3Utils,
    payload: JSON.stringify(conversionResult),
    bucketName: conversionResultBucketName,
    fileName: conversionResultFilename,
    contentType: FHIR_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading converted FHIR Bundle",
      sqsMessage: message,
      context,
      captureParams: {
        message,
        ...lambdaParams,
      },
      shouldCapture: true,
    },
  });
}

export async function storePartitionedPayloadsInS3({
  s3Utils,
  partitionedPayloads,
  conversionResultBucketName,
  preConversionFilename,
  message,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  partitionedPayloads: string[];
  conversionResultBucketName: string;
  preConversionFilename: string;
  message: SQSRecord;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}) {
  const fileNames: string[] = [];

  const results = await executeAsynchronously(
    partitionedPayloads,
    async (payload, index) => {
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
          sqsMessage: message,
          context,
          captureParams: {
            message,
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
        message,
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
  message,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  payload: string;
  bucketName: string;
  fileName: string;
  message: SQSRecord;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}) {
  await storeInS3WithRetries({
    s3Utils,
    payload,
    bucketName,
    fileName,
    contentType: XML_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading preprocessed XML",
      sqsMessage: message,
      context,
      captureParams: {
        message,
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
  message,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  bundle: Bundle<Resource>;
  bucketName: string;
  fileName: string;
  message: SQSRecord;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}) {
  const fileNamePreNormalization = `${fileName}_normalized.json`;
  await storeInS3WithRetries({
    s3Utils,
    payload: JSON.stringify(bundle),
    bucketName,
    fileName: fileNamePreNormalization,
    contentType: FHIR_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading normalized FHIR Bundle",
      sqsMessage: message,
      context,
      captureParams: {
        conversionResultFilename: fileName,
        ...lambdaParams,
      },
      shouldCapture: true,
    },
  });
}

export async function storeInS3WithRetries({
  s3Utils,
  payload,
  bucketName,
  fileName,
  contentType,
  log,
  errorConfig,
}: {
  s3Utils: S3Utils;
  payload: string;
  bucketName: string;
  fileName: string;
  contentType: string;
  log: typeof console.log;
  errorConfig?: {
    errorMessage: string;
    sqsMessage: SQSRecord;
    context: string;
    captureParams?: Record<string, unknown>;
    shouldCapture: boolean;
  };
}) {
  try {
    await executeWithRetriesS3(
      () =>
        s3Utils.s3
          .upload({
            Bucket: bucketName,
            Key: fileName,
            Body: payload,
            ContentType: contentType,
          })
          .promise(),
      {
        ...defaultS3RetriesConfig,
        log,
      }
    );
  } catch (error) {
    const msg = errorConfig?.errorMessage ?? "Error uploading to S3";
    log(`${msg}: ${errorToString(error)}`);

    if (errorConfig?.shouldCapture) {
      capture.error(msg, {
        extra: {
          fileName,
          context: errorConfig.context,
          error,
          errorMessage: errorConfig.errorMessage,
          sqsMessage: errorConfig.sqsMessage,
          ...errorConfig.captureParams,
        },
      });
    }
    throw error;
  }
}
