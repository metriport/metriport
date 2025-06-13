import {
  DischargeRequeryJob,
  DischargeRequeryParamsOps,
  dischargeRequeryParamsOpsSchema,
  NewDischargeRequeryParams,
} from "@metriport/core/domain/patient-monitoring/discharge-requery";
import {
  calculateScheduledAt,
  defaultRemainingAttempts,
  pickEarliestScheduledAt,
  pickLargestRemainingAttempts,
} from "@metriport/core/domain/patient-monitoring/utils";
import { capture, out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { createPatientJob } from "../../../../command/job/patient/create";
import { getPatientJobs } from "../../../../command/job/patient/get";
import { cancelPatientJob } from "../../../../command/job/patient/status/cancel";
import { PatientJob } from "@metriport/shared/domain/job/patient-job";

export const dischargeRequeryJobType = "discharge-requery";

export async function createDischargeRequeryJob(
  props: NewDischargeRequeryParams
): Promise<PatientJob> {
  const { cxId, patientId } = props;
  const { log } = out(`initializeDischargeRequeryJob - cx: ${cxId} pt: ${patientId}`);

  let newAttempts = props.remainingAttempts ?? defaultRemainingAttempts;
  let newScheduledAt = calculateScheduledAt(newAttempts);
  log(`remainingAttempts: ${newAttempts}, scheduledAt: ${newScheduledAt.toISOString()}`);

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

    existingJobs.forEach(async existingJob => {
      const existingRequeryJob = existingJob as DischargeRequeryJob;
      const existingOpsParams = dischargeRequeryParamsOpsSchema.parse(existingRequeryJob.paramsOps);

      newAttempts = pickLargestRemainingAttempts(existingOpsParams.remainingAttempts, newAttempts);
      newScheduledAt = pickEarliestScheduledAt(existingRequeryJob.scheduledAt, newScheduledAt);

      log(`cancelling existing job ${existingJob.id}`);
      await cancelPatientJob({
        cxId,
        jobId: existingJob.id,
        reason: "Deduplicated into a new job",
      });
    });
  }

  const paramsOps: DischargeRequeryParamsOps = {
    remainingAttempts: newAttempts,
  };
  const newDischargeRequeryJob = await createPatientJob({
    cxId,
    patientId,
    jobType: "discharge-requery",
    jobGroupId: uuidv7(),
    requestId: uuidv7(),
    scheduledAt: newScheduledAt,
    paramsOps,
  });

  log(`newDischargeRequeryJob: ${newDischargeRequeryJob.id}`);
  return newDischargeRequeryJob;
}
