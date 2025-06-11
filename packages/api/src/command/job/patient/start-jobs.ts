import { buildGetJobsHandler } from "@metriport/core/command/job/patient/job/start-jobs/steps/get/get-jobs-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { StartJobsParams } from "../shared";

/**
 * Runs the patient jobs scheduled before the given date.
 *
 * @param runDate - The cutoff schedule date for fetched jobs. If not provided, the current date will be used.
 * @param cxId - The customer ID. If not provided, all customers will be used.
 * @param patientId - The patient ID. If not provided, all patients will be used.
 * @param jobType - The job type. If not provided, all job types will be used.
 * @param status - The status to start the jobs. If not provided, all statuses will be used.
 */
export async function startJobs({
  runDate,
  cxId,
  patientId,
  jobType,
  status,
}: StartJobsParams): Promise<void> {
  const handler = buildGetJobsHandler();
  handler
    .getJobs({ runDate, cxId, patientId, jobType, status })
    .catch(processAsyncError("startPatientJobs"));
}
