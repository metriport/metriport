import { MetriportError } from "@metriport/shared";
import { BatchUtils } from "../../../../../external/aws/batch";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import {
  ExportCoreFromFwhToS3Handler,
  ExportCoreFromFwhToS3Request,
} from "./export-core-from-fwh-to-s3";

/**
 * Submits an AWS Batch job to export core from FWH to S3.
 * Use in production (Lambda trigger) instead of running the export in Lambda to avoid 15-min timeout.
 */
export class ExportCoreFromFwhToS3Batch extends ExportCoreFromFwhToS3Handler {
  constructor(
    private readonly batchJobQueueArn: string = Config.getExportCoreFromFwhToS3BatchJobQueueArn(),
    private readonly batchJobDefinitionArn: string = Config.getExportCoreFromFwhToS3BatchJobDefinitionArn(),
    private readonly batch: BatchUtils = new BatchUtils(Config.getAWSRegion())
  ) {
    super();
  }

  async exportCoreFromFwhToS3({
    cxId,
    rawToCoreJobId,
    jobId: jobIdParam,
  }: ExportCoreFromFwhToS3Request): Promise<string> {
    const jobId = jobIdParam || this.generateJobId();
    const { log } = out(`ExportCoreFromFwhToS3Batch - cx ${cxId}, job ${jobId}`);

    log(`Starting batch job with queue ${this.batchJobQueueArn}`);
    const response = await this.batch.startJob({
      jobName: `export-fwh-s3-${cxId}-${jobId}`.slice(0, 128),
      jobQueueArn: this.batchJobQueueArn,
      jobDefinitionArn: this.batchJobDefinitionArn,
      parameters: {
        cxId,
        rawToCoreJobId,
        jobId,
      },
    });

    if (!response?.jobId) {
      throw new MetriportError("Failed to start export FWH to S3 batch job", undefined, {
        cxId,
        jobId,
        response: JSON.stringify(response),
      });
    }

    return jobId;
  }
}
