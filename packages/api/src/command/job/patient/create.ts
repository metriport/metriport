import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, jobInitialStatus, PatientJob } from "@metriport/shared";
import { PatientJobModel } from "../../../models/patient-job";
import { getLatestPatientJob } from "./get";

export type CreatePatientJobParams = Pick<
  PatientJob,
  "cxId" | "patientId" | "jobType" | "jobGroupId" | "requestId"
> & {
  limitedToOneRunningJob?: boolean;
};

export async function createPatientJob({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  requestId,
  limitedToOneRunningJob = false,
}: CreatePatientJobParams): Promise<PatientJob> {
  if (limitedToOneRunningJob) {
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
    status: jobInitialStatus,
    total: 0,
    successful: 0,
    failed: 0,
  });
  return created.dataValues;
}
