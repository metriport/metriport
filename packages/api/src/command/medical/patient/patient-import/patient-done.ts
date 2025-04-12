import { PatientRecord } from "@metriport/core/command/patient-import/patient-import";
import { updatePatientRecord } from "@metriport/core/command/patient-import/record/create-or-update-patient-record";
import { fetchPatientMappingOrFail } from "@metriport/core/command/patient-import/record/fetch-patient-mapping";
import { fetchPatientRecordOrFail } from "@metriport/core/command/patient-import/record/fetch-patient-record";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
import { PatientImportEntryStatus } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import {
  PatientImportModel,
  patientImportRawColumnNames,
} from "../../../../models/medical/patient-import";
import { getPatientImportJobOrFail } from "./get";
import { FinishPatientImportParams, tryToFinishPatientImport } from "./try-finish-job";

dayjs.extend(duration);

const bucketName = Config.getPatientImportBucket();

const defaultReasonForCx = "Failed to obtain patient data";
const defaultReasonForDev = "failed";

/**
 * Finishes a single patient import and checks if the whole job is complete.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param patientId - The patient ID.
 * @param status - The status of the patient import.
 * @param reasonForDev - The reason for the patient import failure.
 */
export async function finishSinglePatientImport({
  cxId,
  jobId,
  patientId,
  status,
  reasonForDev,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  status: PatientImportEntryStatus;
  reasonForDev?: string | undefined;
}): Promise<void> {
  const { log } = out(
    `finishSinglePatientImport - cxId ${cxId}, jobId ${jobId}, patientId ${patientId}`
  );
  log(`Finishing import for patient, status ${status}`);

  try {
    const [patientMapping] = await Promise.all([
      fetchPatientMappingOrFail({ cxId, jobId, patientId }),
      // validate access to the job
      getPatientImportJobOrFail({ cxId, id: jobId }),
    ]);
    const rowNumber = patientMapping.rowNumber;

    const patientRecord = await fetchPatientRecordOrFail({
      cxId,
      jobId,
      rowNumber,
    });

    // Keep the order of operations, we want to make sure S3 is updated before we try to finish the job,
    // so there's no chance the result is incomplete
    await updatePatientRecordOnS3({ patientRecord, status, reasonForDev });

    const updatedJob = await updateTotalsOnDb({ cxId, jobId, status });

    await tryToFinishPatientImport(updatedJob);
  } catch (error) {
    const msg = `Error finishing single patient import`;
    log(`${msg}: ${errorToString(error)}`);
    const additionalInfo = {
      cxId,
      jobId,
      patientId,
      status,
      context: "patient-import.finishSinglePatientImport",
    };
    capture.error(msg, { extra: { ...additionalInfo, error } });
    throw new MetriportError(msg, error, additionalInfo);
  }
}

async function updateTotalsOnDb({
  cxId,
  jobId,
  status,
}: {
  cxId: string;
  jobId: string;
  status: PatientImportEntryStatus;
}): Promise<FinishPatientImportParams> {
  const [[updatedRows]] = await PatientImportModel.increment(
    [
      ...(status === "successful" ? ["successful" as const] : []),
      ...(status === "failed" ? ["failed" as const] : []),
    ],
    {
      where: {
        cxId,
        id: jobId,
      },
      // Sequelize types are a mismatch, had to force this
    } as IncrementDecrementOptionsWithBy<PatientImportModel>
  );
  // Using any because Sequelize doesn't map the columns to the model, even using mapToModel/model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedRaw = (updatedRows as unknown as any[] | undefined)?.[0];
  if (!updatedRaw) throw new MetriportError("Failed to get updated total from DB");
  return {
    id: updatedRaw[patientImportRawColumnNames.id],
    cxId: updatedRaw[patientImportRawColumnNames.cxId],
    status: updatedRaw[patientImportRawColumnNames.status],
    successful: updatedRaw[patientImportRawColumnNames.successful],
    failed: updatedRaw[patientImportRawColumnNames.failed],
    total: updatedRaw[patientImportRawColumnNames.total],
  };
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
