import { PatientRecord } from "@metriport/core/command/patient-import/patient-import";
import { updatePatientRecord } from "@metriport/core/command/patient-import/record/create-or-update-patient-record";
import { fetchPatientRecordOrFail } from "@metriport/core/command/patient-import/record/fetch-patient-record";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
import { PatientImportEntryStatusFinal } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { tryToFinishPatientImportJob } from "./finish-job";
import { getPatientImportByRequestId } from "./get-mapping-and-import";

dayjs.extend(duration);

const defaultReasonForCx = "Failed to obtain patient data";
const defaultReasonForDev = "failed";

/**
 * Finishes a single patient import and tries to finish the whole job.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param requestId - The data pipeline request ID.
 * @param status - The status of the patient import entry.
 * @param reasonForDev - The reason for the patient import failure (optional).
 */
export async function finishSinglePatientImport({
  cxId,
  patientId,
  requestId: dataPipelineRequestId,
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
    `finishSinglePatientImport - cx ${cxId}, patient ${patientId}, dataPipelineReq ${dataPipelineRequestId}`
  );
  log(`Finishing import for patient, status ${status}`);

  try {
    const patientImportAndMapping = await getPatientImportByRequestId({
      cxId,
      patientId,
      dataPipelineRequestId,
    });
    if (!patientImportAndMapping) {
      // TODO 2330 Remove this on v2
      log(`Patient import and mapping not found, skipping`);
      return;
    }
    const { job: patientImport, mapping } = patientImportAndMapping;
    const jobId = patientImport.id;

    const patientRecord = await fetchPatientRecordOrFail({
      cxId,
      jobId,
      rowNumber: mapping.rowNumber,
    });
    await updatePatientRecordOnS3({ patientRecord, status, reasonForDev });

    await tryToFinishPatientImportJob({ cxId, jobId, entryStatus: status });
  } catch (error) {
    const msg = `Error finishing single patient import`;
    log(`${msg}: ${errorToString(error)}`);
    const additionalInfo = {
      cxId,
      patientId,
      dataPipelineRequestId,
      status,
      context: "patient-import.finishSinglePatientImport",
      action:
        "Might need to call POST /internal/patient/bulk/:id/done once all patients have been processed",
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
  status: PatientImportEntryStatusFinal;
  reasonForDev?: string | undefined;
}): Promise<PatientRecord> {
  const bucketName = Config.getPatientImportBucket();
  const statusAndReason =
    status === "failed"
      ? {
          status,
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
