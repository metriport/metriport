import { runJob } from "@metriport/core/command/job/patient/api/run-job";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { jobInitialStatus, PatientJob } from "@metriport/shared";
import { PatientJobModel } from "../../../models/patient-job";

export type CreatePatientJobParams = Pick<
  PatientJob,
  "cxId" | "patientId" | "jobType" | "jobGroupId" | "requestId" | "scheduledAt" | "paramsOps"
>;

export async function createPatientJob({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  requestId,
  scheduledAt,
  paramsOps,
}: CreatePatientJobParams): Promise<PatientJob> {
  const created = await PatientJobModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    jobType,
    jobGroupId,
    requestId,
    scheduledAt,
    status: jobInitialStatus,
    total: 0,
    successful: 0,
    failed: 0,
    paramsOps,
  });
  if (!scheduledAt) {
    runJob({ jobId: created.id, cxId, jobType }).catch(
      processAsyncError(`runJob ${created.jobType}`)
    );
  }
  return created.dataValues;
}
