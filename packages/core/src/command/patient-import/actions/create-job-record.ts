import { errorToString, MetriportError } from "@metriport/shared";
import { out } from "../../../util/log";
import { JobRecord } from "../patient-import";
import { createFileKeyJob, getS3UtilsInstance } from "../patient-import-shared";

// TODO 2330 add TSDoc
// TODO 2330 probably need a better name, as record represents the indivual rows of the CSV
export async function createJobRecord({
  cxId,
  jobId,
  data,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  data: JobRecord;
  s3BucketName: string;
}): Promise<{ key: string; bucket: string }> {
  const { log } = out(`PatientImport createJobRecord - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify(data), "utf8"),
      contentType: "application/json",
    });
    return { key, bucket: s3BucketName };
  } catch (error) {
    const msg = `Failure while creating job record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.createJobRecord",
    });
  }
}
