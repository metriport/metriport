import { PatientRecord } from "@metriport/core/command/patient-import/patient-import";
import { updatePatientRecord } from "@metriport/core/command/patient-import/record/create-or-update-patient-record";
import { fetchPatientRecordOrFail } from "@metriport/core/command/patient-import/record/fetch-patient-record";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
import {
  PatientImportEntryStatus,
  PatientImportEntryStatusFinal,
} from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { tryToFinishPatientImport } from "./finish-job";
import { getPatientImportByRequestIdOrFail } from "./get-mapping-and-import";

dayjs.extend(duration);

const defaultReasonForCx = "Failed to obtain patient data";
const defaultReasonForDev = "failed";

/**
 * Finishes a single patient import and checks if the whole job is complete.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param patientId - The patient ID.
 * @param status - The status of the patient import entry.
 * @param reasonForDev - The reason for the patient import failure.
 */
export async function finishSinglePatientImport({
  cxId,
  patientId,
  requestId,
  status,
  reasonForDev,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  status: PatientImportEntryStatusFinal;
  reasonForDev?: string | undefined;
}): Promise<void> {
  const { log } = out(
    `finishSinglePatientImport - cx ${cxId}, patient ${patientId}, req ${requestId}`
  );
  log(`Finishing import for patient, status ${status}`);

  try {
    const patientImportAndMapping = await getPatientImportByRequestIdOrFail({
      cxId,
      patientId,
      requestId,
    });
    const { import: patientImport, mapping } = patientImportAndMapping;
    const jobId = patientImport.id;

    // Keep the order of operations, we want to make sure S3 is updated before we try to finish the job,
    // so there's no chance the result is incomplete

    const patientRecord = await fetchPatientRecordOrFail({
      cxId,
      jobId,
      rowNumber: mapping.rowNumber,
    });
    await updatePatientRecordOnS3({ patientRecord, status, reasonForDev });

    await tryToFinishPatientImport({ cxId, jobId, status });
  } catch (error) {
    const msg = `Error finishing single patient import`;
    log(`${msg}: ${errorToString(error)}`);
    const additionalInfo = {
      cxId,
      patientId,
      requestId,
      status,
      context: "patient-import.finishSinglePatientImport",
    };
    capture.error(msg, { extra: { ...additionalInfo, error } });
    throw new MetriportError(msg, error, additionalInfo);
  }
}

async function updatePatientRecordOnS3({
  patientRecord,
  status,
  reasonForDev,
}: {
  patientRecord: PatientRecord;
  status: PatientImportEntryStatus;
  reasonForDev?: string | undefined;
}): Promise<PatientRecord> {
  const bucketName = Config.getPatientImportBucket();
  const statusAndReason =
    status === "failed"
      ? {
          status: "failed" as const,
          reasonForCx: defaultReasonForCx,
          reasonForDev: reasonForDev ?? defaultReasonForDev,
        }
      : { status };
  const updatedPatientRecord = {
    ...patientRecord,
    ...statusAndReason,
  };
  return updatePatientRecord({
    ...updatedPatientRecord,
    bucketName,
  });
}
