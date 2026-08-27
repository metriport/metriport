import { MetriportError } from "@metriport/shared";
import { BatchUtils } from "../../../../external/aws/batch";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { SnowflakeIngestor, SnowflakeIngestorRequest } from "./snowflake-ingestor";

/**
 * Submits an AWS Batch job to ingest core from S3 into Snowflake.
 * Use in production (Lambda trigger) instead of running the ingest in Lambda to avoid 15-min timeout.
 */
export class SnowflakeIngestorBatch extends SnowflakeIngestor {
  constructor(
    private readonly batchJobQueueArn: string = Config.getSnowflakeConnectorBatchJobQueueArn(),
    private readonly batchJobDefinitionArn: string = Config.getSnowflakeConnectorBatchJobDefinitionArn(),
    private readonly batch: BatchUtils = new BatchUtils(Config.getAWSRegion())
  ) {
    super();
  }

  async ingestCoreIntoSnowflake({
    cxId,
    coreExportJobId,
    jobId: jobIdParam,
  }: SnowflakeIngestorRequest): Promise<string> {
    const jobId = jobIdParam || this.generateJobId();
    const { log } = out(`SnowflakeIngestorBatch - cx ${cxId}, job ${jobId}`);

    log(`Starting batch job with queue ${this.batchJobQueueArn}`);
    const response = await this.batch.startJob({
      jobName: `snowflake-ingest-${cxId}-${jobId}`.slice(0, 128),
      jobQueueArn: this.batchJobQueueArn,
      jobDefinitionArn: this.batchJobDefinitionArn,
      parameters: {
        cxId,
        coreExportJobId,
        jobId,
      },
    });

    if (!response?.jobId) {
      throw new MetriportError("Failed to start Snowflake connector batch job", undefined, {
        cxId,
        jobId,
        response: JSON.stringify(response),
      });
    }

    return jobId;
  }
}
