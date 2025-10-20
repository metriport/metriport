import { runJob } from "../../api/run-job";
import { RunJobHandler, RunJobRequest } from "./run-job";

export class RunJobDirect implements RunJobHandler {
  async runJob(request: RunJobRequest): Promise<void> {
    await runJob({
      jobId: request.id,
      cxId: request.cxId,
      runUrl: request.runUrl,
    });
  }
}
