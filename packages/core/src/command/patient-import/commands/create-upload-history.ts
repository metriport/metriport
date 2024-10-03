import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { createHistoryFileKey } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function creatUploadHistory({
  cxId,
  jobId,
  patientImportBucket,
  s3FileName,
}: {
  cxId: string;
  jobId: string;
  patientImportBucket: string;
  s3FileName: string;
}): Promise<void> {
  const { log } = out(
    `PatientImport create upload history - cxId ${cxId} jobId ${jobId} s3FileName ${s3FileName}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createHistoryFileKey(cxId, s3FileName, jobId);
  try {
    const fileExists = await s3Utils.fileExists(patientImportBucket, key);
    if (fileExists) throw new Error(`Duplicate job ids for ${s3FileName}`);
    await s3Utils.uploadFile({
      bucket: patientImportBucket,
      key,
      file: Buffer.from(JSON.stringify({}), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating upload history @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        s3FileName,
        context: "patient-import.create-upload-history",
        error,
      },
    });
    throw error;
  }
}
