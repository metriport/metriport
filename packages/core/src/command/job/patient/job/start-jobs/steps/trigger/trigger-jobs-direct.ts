import { executeAsynchronously } from "../../../../../../../util";
import { getJobs } from "../../../../api/get-jobs";
import { buildRunJobHandler } from "../run/run-job-factory";
import { TriggerJobsHandler, TriggerJobsRequest } from "./trigger-jobs";

const MAX_PARALLEL_EXECUTIONS = 10;

export class TriggerJobsDirect implements TriggerJobsHandler {
  private readonly next = buildRunJobHandler();

  async triggerJobs(request: TriggerJobsRequest): Promise<void> {
    const jobs = await getJobs(request);
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
