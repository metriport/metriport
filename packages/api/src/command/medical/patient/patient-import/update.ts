import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { validateNewStatus } from "@metriport/shared/domain/patient/patient-import/status";
import {
  PatientImport,
  PatientImportStatus,
} from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientImportModel } from "../../../../models/medical/patient-import";
import { getPatientImportJobOrFail } from "./get";

dayjs.extend(duration);

export type PatientImportUpdateCmd = {
  cxId: string;
  jobId: string;
  status: PatientImportStatus;
  forceStatusUpdate?: boolean | undefined;
};

/**
 * Updates a bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal
 *                            flows/endpoints).
 * @returns the updated job.
 * @throws BadRequestError if the status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updatePatientImport({
  cxId,
  jobId,
  status,
  forceStatusUpdate = false,
}: PatientImportUpdateCmd): Promise<PatientImport> {
  const { log } = out(`updatePatientImport - cxId ${cxId} jobId ${jobId}`);

  const job = await getPatientImportJobOrFail({ cxId, id: jobId });

  if (job.status === status) {
    log(`Job already in status ${status}, skipping update`);
    return job;
  }

  const newStatus = forceStatusUpdate ? status : validateNewStatus(job.status, status);

  const dataToUpdate = { ...job, status: newStatus };
  if (newStatus === "processing") {
    dataToUpdate.startedAt = buildDayjs().toDate();
  }

  await PatientImportModel.update(dataToUpdate, {
    where: { cxId, id: jobId },
  });

  if (newStatus === "completed") {
    log(`Sending WH to cx for patient import, status ${newStatus} for job`);
    // TODO 2330 send WH to cx
    // await sendWHToCx(updatedJobRecord);
  }
  return dataToUpdate;
}
