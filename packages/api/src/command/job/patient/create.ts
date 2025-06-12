import { runJob } from "@metriport/core/command/job/patient/api/run-job";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, jobInitialStatus, PatientJob } from "@metriport/shared";
import { PatientJobModel } from "../../../models/patient-job";
import { getLatestPatientJob } from "./get";

export type CreatePatientJobParams = Pick<
  PatientJob,
  "cxId" | "patientId" | "jobType" | "jobGroupId" | "requestId" | "scheduledAt" | "paramsOps"
> & {
  limitedToOneRunningJob?: boolean;
};

export async function createPatientJob({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  requestId,
  scheduledAt,
  paramsOps,
  limitedToOneRunningJob = false,
}: CreatePatientJobParams): Promise<PatientJob> {
  if (limitedToOneRunningJob && !scheduledAt) {
    const runningJob = await getLatestPatientJob({
      cxId,
      patientId,
      jobType,
      jobGroupId,
      status: ["waiting", "processing"],
    });
    if (runningJob) {
      throw new BadRequestError("Only one job can be running at a time", undefined, {
        cxId,
        patientId,
        jobType,
        jobGroupId,
        runningJobId: runningJob.id,
      });
    }
  }
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
