import { buildDayjs } from "@metriport/shared/common/date";
import { jobInitialStatus } from "@metriport/shared/domain/job/job-status";
import { executeAsynchronously } from "../../../../../../../util";
import { getJobs } from "../../../../api/get-jobs";
import { buildRunJobHandler } from "../run/run-job-factory";
import { TriggerJobsHandler, TriggerJobsRequest } from "./trigger-jobs";

const MAX_PARALLEL_EXECUTIONS = 10;

export class TriggerJobsDirect implements TriggerJobsHandler {
  private readonly next = buildRunJobHandler();

  async triggerJobs(request: TriggerJobsRequest): Promise<void> {
    const requestStatus = request.status ?? jobInitialStatus;
    const requestScheduledBefore = request.scheduledBefore ?? buildDayjs().toDate();
    const getJobsRequest = {
      ...request,
      status: requestStatus,
      scheduledBefore: requestScheduledBefore,
    };
    const { jobs } = await getJobs(getJobsRequest);
    const runJobArgs = jobs.flatMap(job => {
      if (!job.runUrl) return [];
      return {
        id: job.id,
        cxId: job.cxId,
        runUrl: job.runUrl,
      };
    });
    await executeAsynchronously(runJobArgs, job => this.next.runJob(job), {
      numberOfParallelExecutions: MAX_PARALLEL_EXECUTIONS,
    });
  }
}
