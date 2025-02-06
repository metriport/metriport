import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { PatientRecord } from "../patient-import";
import { createFileKeyPatient } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

// TODO 2330 add TSDoc
export async function fetchPatientRecord({
  cxId,
  jobId,
  patientId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  s3BucketName: string;
}): Promise<PatientRecord> {
  const { log } = out(
    `PatientImport fetchPatientRecord - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
  try {
    const file = await s3Utils.getFileContentsAsString(s3BucketName, key);
    return JSON.parse(file);
  } catch (error) {
    const msg = `Failure while fetching patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        patientId,
        key,
        context: "patient-import.fetch-patient-record",
        error,
      },
    });
    throw error;
  }
}
