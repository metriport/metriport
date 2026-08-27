import { MetriportError, sleep } from "@metriport/shared";
import { BatchUtils } from "../../../../external/aws/batch";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { appendFdwSchemaSuffix, rawDbSchema } from "../../fwh/utils";
import { RawToCoreHandler, RawToCoreRequest } from "./raw-to-core";

export class RawToCoreBatch extends RawToCoreHandler {
  constructor(
    private readonly schema: string = appendFdwSchemaSuffix(rawDbSchema),
    private readonly batchJobQueueArn: string = Config.getRawToCoreBatchJobQueueArn(),
    private readonly batchJobDefinitionArn: string = Config.getRawToCoreBatchJobDefinitionArn(),
    private readonly batch: BatchUtils = new BatchUtils(Config.getAWSRegion())
  ) {
    super();
  }

  async processRawToCore(params: RawToCoreRequest): Promise<string> {
    const {
      cxId,
      jobId: jobIdParam,
      database,
      fullRefresh: fullRefreshParam,
      lookbackTimestamp,
      lookbackHours,
      delay,
    } = params;
    const jobId = jobIdParam || this.generateJobId();
    const fullRefresh = fullRefreshParam ?? false;
    const { log } = out(`processRawToCore - cx ${cxId}, job ${jobId}`);

    if (delay) {
      log(`Sleeping for ${delay.asMilliseconds()} milliseconds`);
      await sleep(delay.asMilliseconds());
    }

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
        fullRefresh: fullRefresh.toString(),
        lookbackTimestamp: lookbackTimestamp?.toISOString() ?? "none",
        lookbackHours: lookbackHours?.toString() ?? "none",
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
