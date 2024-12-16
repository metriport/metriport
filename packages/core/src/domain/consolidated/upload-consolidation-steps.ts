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
    await executeWithRetriesS3(
      () =>
        s3Utils.s3
          .upload({
            Bucket: conversionResultBucketName,
            Key: conversionResultFilename,
            Body: JSON.stringify(conversionResult),
            ContentType: FHIR_APP_MIME_TYPE,
          })
          .promise(),
      {
        ...defaultS3RetriesConfig,
        log,
      }
    );
  } catch (error) {
    const msg = "Error uploading conversion result";
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
  partitionedPayloads.forEach((payload, index) => {
    storePayloadInS3({
      s3Utils,
      payload,
      conversionResultBucketName,
      fileName: buildDocumentNameForPartialConversions(preConversionFilename, index),
      message,
      context,
      lambdaParams,
      log,
    });
  });
}

export async function storePayloadInS3({
  s3Utils,
  payload,
  conversionResultBucketName,
  fileName,
  message,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  payload: string;
  conversionResultBucketName: string;
  fileName: string;
  message: SQSRecord;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}) {
  try {
    await executeWithRetriesS3(
      () =>
        s3Utils.s3
          .upload({
            Bucket: conversionResultBucketName,
            Key: fileName,
            Body: payload,
            ContentType: XML_APP_MIME_TYPE,
          })
          .promise(),
      {
        ...defaultS3RetriesConfig,
        log,
      }
    );
  } catch (error) {
    const msg = `Error uploading conversion step file`;
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
  conversionResultBucketName,
  fileName,
  message,
  context,
  lambdaParams,
  log,
}: {
  s3Utils: S3Utils;
  bundle: Bundle<Resource>;
  conversionResultBucketName: string;
  fileName: string;
  message: SQSRecord;
  context: string;
  lambdaParams: Record<string, string | undefined>;
  log: typeof console.log;
}) {
  const fileNamePreNormalization = `${fileName}_normalized.json`;
  try {
    await executeWithRetriesS3(
      () =>
        s3Utils.s3
          .upload({
            Bucket: conversionResultBucketName,
            Key: fileNamePreNormalization,
            Body: JSON.stringify(bundle),
            ContentType: FHIR_APP_MIME_TYPE,
          })
          .promise(),
      {
        ...defaultS3RetriesConfig,
        log,
      }
    );
  } catch (error) {
    const msg = "Error uploading normalized conversion result";
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
