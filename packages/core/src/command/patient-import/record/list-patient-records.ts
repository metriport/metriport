import { errorToString, MetriportError } from "@metriport/shared";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { createFolderNamePatientRecords, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Lists all patient records for a given job.
 *
 * @returns the list of file paths for the found patient records.
 */
export async function listPatientRecords({
  cxId,
  jobId,
  bucketName = Config.getPatientImportBucket(),
}: {
  cxId: string;
  jobId: string;
  bucketName?: string;
}): Promise<string[]> {
  const { log } = out(`PatientImport listPatientRecords - cxId ${cxId} jobId ${jobId}`);
  const key = createFolderNamePatientRecords(cxId, jobId);
  try {
    const s3Utils = getS3UtilsInstance();
    const files = await s3Utils.listObjects(bucketName, key);
    return files.flatMap(file => file.Key ?? []);
  } catch (error) {
    const msg = `Failure while listing patient records @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.listPatientRecords",
    });
  }
}
