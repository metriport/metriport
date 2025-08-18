import { isDischargeRequeryFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import {
  CreateDischargeRequeryParams,
  DischargeRequeryParamsOps,
  parseDischargeRequeryJob,
} from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import {
  calculateScheduledAt,
  defaultRemainingAttempts,
  earliest,
  pickLargestRemainingAttempts,
} from "@metriport/shared/domain/patient/patient-monitoring/utils";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import _ from "lodash";
import { createPatientJob } from "../../../../job/patient/create";
import { getPatientJobs } from "../../../../job/patient/get";
import { cancelPatientJob } from "../../../../job/patient/status/cancel";

const INTERNAL_DISCHARGE_REQUERY_ENDPOINT =
  "/internal/patient/monitoring/job/discharge-requery/run";
export const dischargeRequeryJobType = "discharge-requery";

/**
 * Creates a new discharge requery job for a patient.
 *
 * The job is scheduled to run at a later time based on the number of remaining attempts and a scheduling map.
 *
 * If there is already a waiting job for the patient, it will be cancelled and a new one will be created,
 * with the remaining attempts set to the largest of the two jobs, and the scheduledAt set to the earliest of the two.
 * This ensures that the job will be run as soon as possible, but not more than once at a time, while also
 * preserving a paper trail for the previous job.
 *
 *
 * @param props - The parameters for the new discharge requery job.
 * @returns The newly created patient job.
 */
export async function createDischargeRequeryJob(
  props: CreateDischargeRequeryParams
): Promise<void> {
  const { cxId, patientId, dischargeData } = props;
  const localDischargeData = [...dischargeData];
  const { log } = out(`createDischargeRequeryJob - cx: ${cxId} pt: ${patientId}`);

  if (!(await isDischargeRequeryFeatureFlagEnabledForCx(cxId))) return;

  let remainingAttempts = props.remainingAttempts ?? defaultRemainingAttempts;
  let scheduledAt = calculateScheduledAt(remainingAttempts);
  log(`remainingAttempts: ${remainingAttempts}, scheduledAt: ${scheduledAt.toISOString()}`);

  const existingJobs = await getPatientJobs({
    cxId,
    patientId,
    jobType: dischargeRequeryJobType,
    status: "waiting",
  });

  if (existingJobs.length > 1) {
    const msg = `Found multiple waiting discharge-requery jobs`;
    log(`${msg} - ${existingJobs.length} jobs!`);
    capture.message(msg, {
      extra: { patientId, cxId, jobIds: existingJobs.map(j => j.id) },
      level: "warning",
    });
  }

  for (const existingJob of existingJobs) {
    const existingRequeryJob = parseDischargeRequeryJob(existingJob);

    remainingAttempts = pickLargestRemainingAttempts(
      existingRequeryJob.paramsOps.remainingAttempts,
      remainingAttempts
    );
    scheduledAt = earliest(existingRequeryJob.scheduledAt, scheduledAt);
    localDischargeData.push(...existingRequeryJob.paramsOps.dischargeData);

    log(`cancelling existing job ${existingJob.id}`);
    await cancelPatientJob({
      cxId,
      jobId: existingJob.id,
      reason: "Deduplicated into a new job",
    });
  }

  const paramsOps: DischargeRequeryParamsOps = {
    remainingAttempts,
    dischargeData: _.uniqBy(localDischargeData, "encounterEndDate"),
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

  log(`created discharge requery job id: ${newDischargeRequeryJob.id}`);
  return;
}
