import { errorToString, MetriportError } from "@metriport/shared";
import { out } from "../../../util/log";
import { createFileKeyFiles, FileStages, getS3UtilsInstance } from "../patient-import-shared";

// TODO 2330 add TSDoc
export async function createValidationFile({
  cxId,
  jobId,
  stage,
  rows,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  stage: FileStages;
  rows: string[];
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(
    `PatientImport createValidationFile - cxId ${cxId} jobId ${jobId} stage ${stage}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyFiles(cxId, jobId, stage);
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      content: Buffer.from(rows.join("\n"), "utf8"),
      contentType: "text/csv",
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
