import { Bundle, Resource } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { SQSRecord } from "aws-lambda";
import { S3Utils, executeWithRetriesS3 } from "../../external/aws/s3";
import { capture } from "../../util";
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
  try {
    await storeInS3WithRetries({
      s3Utils,
      payload: JSON.stringify(conversionResult),
      bucketName: conversionResultBucketName,
      fileName: conversionResultFilename,
      contentType: FHIR_APP_MIME_TYPE,
      log,
    });
  } catch (error) {
    const msg = "Error uploading converted FHIR Bundle";
    log(`${msg}: ${error}`);
    capture.error(msg, {
      extra: {
        message,
        ...lambdaParams,
        conversionResultFilename,
        context,
        error,
      },
    });
  }
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
  partitionedPayloads.forEach(async (payload, index) => {
    const nameWithPartNumber = buildDocumentNameForPartialConversions(preConversionFilename, index);
    try {
      await storeInS3WithRetries({
        s3Utils,
        payload,
        bucketName: conversionResultBucketName,
        fileName: nameWithPartNumber,
        contentType: XML_APP_MIME_TYPE,
        log,
      });
    } catch (error) {
      const msg = `Error uploading partitioned XML part`;
      log(`${msg}: ${error}`);
      capture.error(msg, {
        extra: {
          message,
          ...lambdaParams,
          fileName: nameWithPartNumber,
          context,
          error,
        },
      });
    }
  });
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
  try {
    await storeInS3WithRetries({
      s3Utils,
      payload,
      bucketName,
      fileName,
      contentType: XML_APP_MIME_TYPE,
      log,
    });
  } catch (error) {
    const msg = `Error uploading preprocessed XML`;
    log(`${msg}: ${error}`);
    capture.error(msg, {
      extra: {
        message,
        ...lambdaParams,
        fileName,
        context,
        error,
      },
    });
  }
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
  try {
    await storeInS3WithRetries({
      s3Utils,
      payload: JSON.stringify(bundle),
      bucketName,
      fileName: fileNamePreNormalization,
      contentType: FHIR_APP_MIME_TYPE,
      log,
    });
  } catch (error) {
    const msg = "Error uploading normalized FHIR Bundle";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        message,
        ...lambdaParams,
        conversionResultFilename: fileName,
        context,
        error,
      },
    });
  }
}

export async function storeInS3WithRetries({
  s3Utils,
  payload,
  bucketName,
  fileName,
  contentType,
  log,
}: {
  s3Utils: S3Utils;
  payload: string;
  bucketName: string;
  fileName: string;
  contentType: string;
  log: typeof console.log;
}) {
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
}
