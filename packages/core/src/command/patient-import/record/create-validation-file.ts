import { errorToString, MetriportError } from "@metriport/shared";
import { out } from "../../../util/log";
import {
  CSV_FILE_EXTENSION,
  CSV_MIME_TYPE,
  JSON_FILE_EXTENSION,
  JSON_TXT_MIME_TYPE,
  NDJSON_FILE_EXTENSION,
  NDJSON_MIME_TYPE,
  TXT_FILE_EXTENSION,
  TXT_MIME_TYPE,
} from "../../../util/mime";
import { createFileKeyFiles, FileStages, getS3UtilsInstance } from "../patient-import-shared";

export type ValidationFileContentType =
  | typeof CSV_FILE_EXTENSION
  | typeof TXT_FILE_EXTENSION
  | typeof NDJSON_FILE_EXTENSION
  | typeof JSON_FILE_EXTENSION;

/**
 * Creates a validation file for a patient import.
 */
export async function createValidationFile({
  cxId,
  jobId,
  stage,
  contents,
  s3BucketName,
  contentType: contentTypeParam = CSV_FILE_EXTENSION,
}: {
  cxId: string;
  jobId: string;
  stage: FileStages;
  contents: Buffer;
  s3BucketName: string;
  contentType?: ValidationFileContentType;
}): Promise<void> {
  const { log } = out(
    `PatientImport createValidationFile - cxId ${cxId} jobId ${jobId} stage ${stage}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyFiles(cxId, jobId, stage, contentTypeParam);
  const contentType = getContentTypeFromParam(contentTypeParam);
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: contents,
      contentType,
    });
  } catch (error) {
    const msg = `Failure while creating validation file @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      stage,
      key,
      context: "patient-import.createValidationFile",
    });
  }
}

function getContentTypeFromParam(contentTypeParam: ValidationFileContentType): string {
  const mapping: Record<ValidationFileContentType, string> = {
    [CSV_FILE_EXTENSION]: CSV_MIME_TYPE,
    [JSON_FILE_EXTENSION]: JSON_TXT_MIME_TYPE,
    [NDJSON_FILE_EXTENSION]: NDJSON_MIME_TYPE,
    [TXT_FILE_EXTENSION]: TXT_MIME_TYPE,
  };
  const contentType = mapping[contentTypeParam];
  if (!contentType) {
    throw new MetriportError(`Invalid content type`, undefined, { contentTypeParam });
  }
  return contentType;
}
