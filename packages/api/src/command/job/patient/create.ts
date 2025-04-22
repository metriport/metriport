import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, jobInitialStatus, PatientJob } from "@metriport/shared";
import { PatientJobModel } from "../../../models/patient-job";
import { getLatestPatientJobByStatus } from "./get";

export type CreatePatientJobParams = Pick<
  PatientJob,
  "cxId" | "patientId" | "jobTypeId" | "jobGroupId" | "requestId"
> & {
  limitedToOneRunningJob?: boolean;
};

export async function createPatientJob({
  limitedToOneRunningJob = false,
  requestId,
  ...params
}: CreatePatientJobParams): Promise<PatientJob> {
  if (limitedToOneRunningJob) {
    const runningJob = await getLatestPatientJobByStatus({
      ...params,
      status: ["waiting", "processing"],
    });
    if (runningJob) {
      throw new BadRequestError("Only one workflow can be running at a time", undefined, {
        ...params,
        runningJobId: runningJob.id,
      });
    }
  }
  const created = await PatientJobModel.create({
    id: uuidv7(),
    ...params,
    requestId,
    status: jobInitialStatus,
    total: 0,
    successful: 0,
    failed: 0,
  });
  return created.dataValues;
}
