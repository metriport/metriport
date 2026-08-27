import { MetriportError } from "@metriport/shared";
import { BatchUtils } from "../../../../external/aws/batch";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { CoreToHedisHandler, CoreToHedisRequest } from "./core-to-hedis";
import { coreDbSchema } from "../../fwh/utils";

export class CoreToHedisBatch extends CoreToHedisHandler {
  constructor(
    private readonly schema: string = coreDbSchema,
    private readonly batchJobQueueArn: string = Config.getCoreToHedisBatchJobQueueArn(),
    private readonly batchJobDefinitionArn: string = Config.getCoreToHedisBatchJobDefinitionArn(),
    private readonly batch: BatchUtils = new BatchUtils(Config.getAWSRegion())
  ) {
    super();
  }

  async processCoreToHedis(params: CoreToHedisRequest): Promise<string> {
    const { cxId, jobId: jobIdParam, database } = params;
    const jobId = jobIdParam || this.generateJobId();
    const { log } = out(`processCoreToHedis - cx ${cxId}, job ${jobId}`);

    log(`Starting batch job with queue ${this.batchJobQueueArn}`);
    const response = await this.batch.startJob({
      jobName: `${cxId}-${jobId}`,
      jobQueueArn: this.batchJobQueueArn,
      jobDefinitionArn: this.batchJobDefinitionArn,
      parameters: {
        cxId,
        jobId,
        database,
        schema: this.schema,
      },
    });

    if (!response?.jobId) {
      throw new MetriportError("Failed to start batch job", undefined, {
        cxId,
        jobId,
        database,
        schema: this.schema,
        response: JSON.stringify(response),
      });
    }

    return jobId;
  }
}
