import { runJob } from "../../../../api/run-job";
import { RunJobHandler, RunJobRequest } from "./run-job";

export class RunJobDirect implements RunJobHandler {
  async runJob(request: RunJobRequest): Promise<void> {
    const payload = {
      ...(request.paramsCx && { paramsCx: request.paramsCx }),
      ...(request.paramsOps && { paramsOps: request.paramsOps }),
      ...(request.data ? { data: request.data } : {}),
    };
    await runJob({
      jobId: request.id,
      cxId: request.cxId,
      jobType: request.jobType,
      payload,
    });
  }
}
