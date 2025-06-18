import { RunJobRequest } from "@metriport/core/command/job/patient/command/run-job/run-job";
import { buildRunJobHandler } from "@metriport/core/command/job/patient/command/run-job/run-job-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { JobStatus, jobInitialStatus } from "@metriport/shared/domain/job/job-status";
import { getPatientJobs } from "../get";

const parallelJobs = 10;

export type StartJobsParams = {
  scheduledBefore?: Date;
  cxId?: string;
  patientId?: string;
  jobType?: string;
  jobGroupId?: string;
  status?: JobStatus;
};

/**
 * Runs the patient jobs scheduled before the given date.
 *
 * @param scheduledBefore - The cutoff schedule date for fetched jobs. If not provided, the current date will be used. If provided, only jobs scheduled before this date will be run.
 * @param status - The status to start the jobs. If not provided, the initial status will be used. If provided, only jobs with this status will be run.
 * @param cxId - The customer ID. If not provided, all customers will be run.
 * @param patientId - The patient ID. If not provided, all patients will be run.
 * @param jobType - The job type. If not provided, all job types will be run.
 * @param jobGroupId - The job group ID. If not provided, all job group IDs will be used.
 */
export async function startJobs({
  scheduledBefore: scheduledBeforeParam,
  status: statusParam,
  cxId,
  patientId,
  jobType,
  jobGroupId,
}: StartJobsParams): Promise<void> {
  const scheduledBefore = scheduledBeforeParam || buildDayjs().toDate();
  const status = statusParam || jobInitialStatus;
  const jobs = await getPatientJobs({
    scheduledBefore,
    cxId,
    patientId,
    jobType,
    jobGroupId,
    status,
  });
  if (jobs.length === 0) {
    out("startJobs").log("No scheduled patient jobs found");
    return;
  }
  const handler = buildRunJobHandler();
  const runJobsErrors: { error: unknown; id: string; cxId: string }[] = [];
  const runJobsArgs: RunJobRequest[] = jobs.flatMap(job => {
    if (!job.runUrl) return [];
    return [
      {
        id: job.id,
        cxId: job.cxId,
        runUrl: job.runUrl,
      },
    ];
  });
  await executeAsynchronously(
    runJobsArgs,
    async (params: RunJobRequest) => {
      try {
        await handler.runJob(params);
      } catch (error) {
        runJobsErrors.push({ ...params, error });
      }
    },
    {
      numberOfParallelExecutions: parallelJobs,
    }
  );
  if (runJobsErrors.length > 0) {
    const msg = "Failed to run some scheduled patient jobs";
    capture.message(msg, {
      extra: {
        runJobsArgsCount: runJobsArgs.length,
        errorCount: runJobsErrors.length,
        errors: runJobsErrors.map(error => ({
          id: error.id,
          cxId: error.cxId,
          error: errorToString(error.error),
        })),
        context: "patient-job.start-jobs",
      },
      level: "warning",
    });
  }
}
