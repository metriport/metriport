import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { createFileKeyFiles, FileStages, getS3UtilsInstance } from "../patient-import-shared";

// TODO 2330 add TSDoc
export async function creatValidationFile({
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
    `PatientImport ccreatValidationFile - cxId ${cxId} jobId ${jobId} stage ${stage}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyFiles(cxId, jobId, stage);
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(rows.join("\n"), "utf8"),
      contentType: "text/csv",
    });
  } catch (error) {
    const msg = `Failure while creating validation file @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        stage,
        key,
        context: "patient-import.create-validation-file",
        error,
      },
    });
    throw error;
  }
}
