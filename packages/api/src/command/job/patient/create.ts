import { buildRunJobHandler } from "@metriport/core/command/job/patient/command/run-job/run-job-factory";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, jobInitialStatus, PatientJob } from "@metriport/shared";
import { PatientJobModel } from "../../../models/patient-job";

export type CreatePatientJobParams = Pick<
  PatientJob,
  | "cxId"
  | "patientId"
  | "jobType"
  | "jobGroupId"
  | "requestId"
  | "scheduledAt"
  | "paramsOps"
  | "runUrl"
>;

export async function createPatientJob({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  requestId,
  scheduledAt,
  paramsOps,
  runUrl,
}: CreatePatientJobParams): Promise<PatientJob> {
  if (!runUrl) {
    throw new BadRequestError("runUrl is required", undefined, {
      cxId,
      patientId,
      jobType,
      jobGroupId,
      requestId,
    });
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
    runUrl,
  });
  if (!scheduledAt && created.runUrl) {
    const handler = buildRunJobHandler();
    await handler.runJob({ id: created.id, cxId: created.cxId, runUrl: created.runUrl });
  }
  return created.dataValues;
}
