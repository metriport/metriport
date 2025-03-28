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
 * @throws BadRequestError if no facility ID is provided and there's more than one facility for the customer.
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

    const updateTotalsOnDb = async (): Promise<FinishPatientImportParams | undefined> => {
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
      if (!updatedRaw) return undefined;
      return {
        id: updatedRaw[patientImportRawColumnNames.id],
        cxId: updatedRaw[patientImportRawColumnNames.cxId],
        status: updatedRaw[patientImportRawColumnNames.status],
        successful: updatedRaw[patientImportRawColumnNames.successful],
        failed: updatedRaw[patientImportRawColumnNames.failed],
        total: updatedRaw[patientImportRawColumnNames.total],
      };
    };

    const updatePatientRecordOnS3 = async (): Promise<PatientRecord> => {
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
    };

    const [updatedJob] = await Promise.all([updateTotalsOnDb(), updatePatientRecordOnS3()]);

    if (updatedJob) {
      await tryToFinishPatientImport(updatedJob);
      return;
    }

    const msg = `updatedJob is undefined, this is not expected`;
    log(msg);
    capture.message(msg, { extra: { cxId, jobId, patientId }, level: "warning" });
    return;
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
    capture.error(msg, {
      extra: {
        ...additionalInfo,
        error,
      },
    });
    throw new MetriportError(msg, error, additionalInfo);
  }
}
