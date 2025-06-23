import { out } from "@metriport/core/util/log";
import { PatientJob } from "@metriport/shared/domain/job/patient-job";
import {
  DischargeRequeryJob,
  DischargeRequeryParamsOps,
  dischargeRequeryParamsOpsSchema,
  NewDischargeRequeryParams,
} from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import {
  calculateScheduledAt,
  defaultRemainingAttempts,
  pickEarliestScheduledAt,
  pickLargestRemainingAttempts,
} from "@metriport/shared/domain/patient/patient-monitoring/utils";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { capture } from "../../../../../shared/notifications";
import { createPatientJob } from "../../../../job/patient/create";
import { getPatientJobs } from "../../../../job/patient/get";
import { cancelPatientJob } from "../../../../job/patient/status/cancel";

const INTERNAL_DISCHARGE_REQUERY_ENDPOINT = "/internal/patient/monitoring/discharge-requery/run";
export const dischargeRequeryJobType = "discharge-requery";

export async function createDischargeRequeryJob(
  props: NewDischargeRequeryParams
): Promise<PatientJob> {
  const { cxId, patientId } = props;
  const { log } = out(`initializeDischargeRequeryJob - cx: ${cxId} pt: ${patientId}`);

  let remainingAttempts = props.remainingAttempts ?? defaultRemainingAttempts;
  let scheduledAt = calculateScheduledAt(remainingAttempts);
  log(`remainingAttempts: ${remainingAttempts}, scheduledAt: ${scheduledAt.toISOString()}`);

  const existingJobs = await getPatientJobs({
    cxId,
    patientId,
    jobType: dischargeRequeryJobType,
    status: ["waiting"],
  });

  if (existingJobs.length > 0) {
    if (existingJobs.length > 1) {
      const msg = `Found multiple waiting discharge-requery jobs`;
      log(`${msg} - ${existingJobs.length} jobs!`);
      capture.message(msg, {
        extra: { patientId, cxId, jobIds: [existingJobs.map(j => j.id)] },
        level: "warning",
      });
    }

    for (const existingJob of existingJobs) {
      const existingRequeryJob = existingJob as DischargeRequeryJob;
      const existingOpsParams = dischargeRequeryParamsOpsSchema.parse(existingRequeryJob.paramsOps);

      remainingAttempts = pickLargestRemainingAttempts(
        existingOpsParams.remainingAttempts,
        remainingAttempts
      );
      scheduledAt = pickEarliestScheduledAt(existingRequeryJob.scheduledAt, scheduledAt);

      log(`cancelling existing job ${existingJob.id}`);
      await cancelPatientJob({
        cxId,
        jobId: existingJob.id,
        reason: "Deduplicated into a new job",
      });
    }
  }

  const paramsOps: DischargeRequeryParamsOps = {
    remainingAttempts,
  };
  const newDischargeRequeryJob = await createPatientJob({
    cxId,
    patientId,
    jobType: dischargeRequeryJobType,
    jobGroupId: uuidv7(),
    requestId: undefined,
    scheduledAt,
    paramsOps,
    runUrl: INTERNAL_DISCHARGE_REQUERY_ENDPOINT,
  });

  log(`newDischargeRequeryJob: ${newDischargeRequeryJob.id}`);
  return newDischargeRequeryJob;
}
