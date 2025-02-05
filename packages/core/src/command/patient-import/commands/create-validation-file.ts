import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { FileStages, createFileKeyFiles } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function creatValidationFile({
  cxId,
  jobId,
  jobStartedAt,
  stage,
  rows,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  stage: FileStages;
  rows: string[];
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(
    `PatientImport ccreatValidationFile - cxId ${cxId} jobId ${jobId} stage ${stage}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyFiles(cxId, jobStartedAt, jobId, stage);
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
