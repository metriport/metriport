import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { createFileKeyFiles } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function updateValidFileWithPatientId({
  cxId,
  jobId,
  jobStartedAt,
  patientId,
  patientRowIndex,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  patientId: string;
  patientRowIndex: string;
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(
    `PatientImport update valid file with patient id - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyFiles(cxId, jobStartedAt, jobId, "raw");
  try {
    const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, key);
    const allRows = csvAsString.split("\n");
    const targetIndex = +patientRowIndex + 1;
    const targetRow = allRows[targetIndex];
    if (!targetRow)
      throw new Error(`targetRow does not exist in valid file at index ${targetIndex}`);
    allRows[targetIndex] = `${patientId}` + targetRow;
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(allRows.join("\n"), "utf8"),
      contentType: "text/csv",
    });
  } catch (error) {
    const msg = `Failure while updating valid file with patient id @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        key,
        context: "patient-import.update-valid-file-with-patient-id",
        error,
      },
    });
    throw error;
  }
}
